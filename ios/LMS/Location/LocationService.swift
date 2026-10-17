import CoreLocation
import Foundation
import UIKit
import UserNotifications

/// A place the web app asked to watch. Saved, so a region event after a relaunch still knows it.
struct WatchedRegion: Codable {
    let id: String
    let lat: Double
    let lng: Double
    let radius: Double
    let message: String?
    let onEnter: Bool
    let onExit: Bool

    var json: [String: Any] {
        [
            "id": id, "lat": lat, "lng": lng, "radius": radius,
            "message": orNull(message), "onEnter": onEnter, "onExit": onExit,
        ]
    }
}

extension WatchedRegion {
    init?(json: [String: Any]) {
        guard let id = json["id"] as? String, !id.isEmpty, id.count <= 100,
              let lat = (json["lat"] as? NSNumber)?.doubleValue, (-90...90).contains(lat),
              let lng = (json["lng"] as? NSNumber)?.doubleValue, (-180...180).contains(lng)
        else { return nil }
        let message = (json["message"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.init(
            id: id,
            lat: lat,
            lng: lng,
            radius: (json["radius"] as? NSNumber)?.doubleValue ?? 150,
            message: message?.isEmpty == false ? String(message!.prefix(200)) : nil,
            onEnter: (json["onEnter"] as? Bool) ?? true,
            onExit: (json["onExit"] as? Bool) ?? false
        )
    }
}

/// Location for the web app: permission ("While using" first, then "Always", each asked once as
/// iOS allows), the current position, and watched places (geofences) the backend can set up later.
/// Arriving at (or leaving) a watched place with a message shows that message as a notification;
/// either way the page hears about it (a `lmsnative` event, `{ type: 'region' }`).
@MainActor
final class LocationService: NSObject, CLLocationManagerDelegate {
    static let shared = LocationService(manager: CLLocationManager())

    private let manager: CLLocationManager
    private let defaults = UserDefaults.standard
    private var authorizationWaiters: [CheckedContinuation<Void, Never>] = []
    private var locationWaiters: [CheckedContinuation<CLLocation, Error>] = []
    private var askedAt = Date.distantPast

    private init(manager: CLLocationManager) {
        self.manager = manager
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        // A permission prompt doesn't always change anything (keeping "While using" when asked
        // for "Always"): the app becoming active again after it ends the wait.
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 700_000_000)
                // Only for a prompt that was up a while (not one asked a moment ago).
                if Date().timeIntervalSince(self.askedAt) > 1.5 { self.resumeAuthorizationWaiters() }
            }
        }
    }

    // MARK: Permission

    func status() -> [String: Any] {
        [
            "authorization": Self.name(manager.authorizationStatus),
            "precise": manager.accuracyAuthorization == .fullAccuracy,
            "regions": manager.monitoredRegions.count,
        ]
    }

    /// "While using" first; once that is given, "Always" (iOS shows that prompt only once).
    func request() async -> [String: Any] {
        if manager.authorizationStatus == .notDetermined {
            await waitForAnswer { $0.requestWhenInUseAuthorization() }
        }
        if manager.authorizationStatus == .authorizedWhenInUse, !defaults.bool(forKey: "location.askedAlways") {
            defaults.set(true, forKey: "location.askedAlways")
            await waitForAnswer { $0.requestAlwaysAuthorization() }
        }
        return status()
    }

    private func waitForAnswer(_ ask: (CLLocationManager) -> Void) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            authorizationWaiters.append(continuation)
            askedAt = Date()
            ask(manager)
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                self.resumeAuthorizationWaiters()
            }
        }
    }

    private func resumeAuthorizationWaiters() {
        let waiters = authorizationWaiters
        authorizationWaiters = []
        waiters.forEach { $0.resume() }
    }

    // MARK: Where the phone is

    func current() async throws -> [String: Any] {
        if manager.authorizationStatus == .notDetermined {
            await waitForAnswer { $0.requestWhenInUseAuthorization() }
        }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: break
        default: throw NativeError.locationDenied
        }
        let location: CLLocation = try await withCheckedThrowingContinuation { continuation in
            locationWaiters.append(continuation)
            if locationWaiters.count == 1 { manager.requestLocation() }
        }
        return [
            "lat": location.coordinate.latitude,
            "lng": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "at": Days.iso(location.timestamp),
        ]
    }

    // MARK: Watched places

    /// Replaces the watched places (iOS watches at most 20 per app). An empty list stops watching.
    func setRegions(_ raw: Any?) async throws -> [String: Any] {
        guard let list = raw as? [[String: Any]] else { throw NativeError.badMessage }
        let regions = list.compactMap(WatchedRegion.init(json:)).prefix(20)
        if !regions.isEmpty {
            guard manager.authorizationStatus == .authorizedAlways else { throw NativeError.locationDenied }
            guard CLLocationManager.isMonitoringAvailable(for: CLCircularRegion.self) else {
                throw NativeError.locationUnavailable
            }
        }
        for region in manager.monitoredRegions { manager.stopMonitoring(for: region) }
        for region in regions {
            let circle = CLCircularRegion(
                center: CLLocationCoordinate2D(latitude: region.lat, longitude: region.lng),
                radius: min(max(region.radius, 100), manager.maximumRegionMonitoringDistance),
                identifier: region.id
            )
            circle.notifyOnEntry = region.onEnter
            circle.notifyOnExit = region.onExit
            manager.startMonitoring(for: circle)
        }
        saveRegions(Array(regions))
        if regions.contains(where: { $0.message != nil }) {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
        }
        return status()
    }

    func regions() -> [String: Any] {
        [
            "regions": savedRegions().map(\.json),
            "events": defaults.array(forKey: "location.events") ?? [],
        ]
    }

    private func savedRegions() -> [WatchedRegion] {
        guard let data = defaults.data(forKey: "location.regions") else { return [] }
        return (try? JSONDecoder().decode([WatchedRegion].self, from: data)) ?? []
    }

    private func saveRegions(_ regions: [WatchedRegion]) {
        defaults.set(try? JSONEncoder().encode(regions), forKey: "location.regions")
    }

    private func regionEvent(_ id: String, _ event: String) {
        var events = defaults.array(forKey: "location.events") as? [[String: String]] ?? []
        events.insert(["id": id, "event": event, "at": Days.iso(Date())], at: 0)
        defaults.set(Array(events.prefix(50)), forKey: "location.events")

        if let region = savedRegions().first(where: { $0.id == id }), let message = region.message {
            let content = UNMutableNotificationContent()
            content.title = L("region.title")
            content.body = message
            content.sound = .default
            let request = UNNotificationRequest(identifier: "region-\(id)-\(event)", content: content, trigger: nil)
            UNUserNotificationCenter.current().add(request)
        }
        AppModel.existing?.emit(["type": "region", "id": id, "event": event])
    }

    // MARK: CLLocationManagerDelegate (called on the main thread: the manager was made there)

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.resumeAuthorizationWaiters()
            AppModel.existing?.emit(["type": "location", "status": self.status()])
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            let waiters = self.locationWaiters
            self.locationWaiters = []
            waiters.forEach { $0.resume(returning: location) }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            let waiters = self.locationWaiters
            self.locationWaiters = []
            waiters.forEach { $0.resume(throwing: NativeError.locationUnavailable) }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        let id = region.identifier
        Task { @MainActor in self.regionEvent(id, "enter") }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        let id = region.identifier
        Task { @MainActor in self.regionEvent(id, "exit") }
    }

    private static func name(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorizedWhenInUse: return "whenInUse"
        case .authorizedAlways: return "always"
        @unknown default: return "denied"
        }
    }
}
