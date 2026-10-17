import Foundation
import HealthKit
import UIKit

/// Apple Health → LMS, and LMS's eaten energy → Apple Health. Runs on opening, on coming back to
/// the foreground, when Health has new data (background delivery), from BGAppRefresh, and from
/// the page's "Sync now". One sync at a time; automatic ones at most every few minutes.
@MainActor
final class HealthSync {
    static let shared = HealthSync()

    enum Trigger {
        case launch, foreground, background, manual, connect

        /// Asked for by the person: may make a new key through the page, and is never skipped.
        var byHand: Bool { self == .manual || self == .connect }
    }

    let store = HKHealthStore()
    private lazy var reader = HealthReader(store: store)
    private let defaults = UserDefaults.standard
    private var running: Task<Void, Never>?
    private var lastAttempt: Date?
    private var observing = false

    private init() {}

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }

    // MARK: State kept between launches

    private(set) var connected: Bool {
        get { defaults.bool(forKey: "health.connected") }
        set { defaults.set(newValue, forKey: "health.connected") }
    }

    private var lastSync: Date? {
        get { defaults.object(forKey: "health.lastSync") as? Date }
        set { defaults.set(newValue, forKey: "health.lastSync") }
    }

    private var lastError: String? {
        get { defaults.string(forKey: "health.lastError") }
        set { defaults.set(newValue, forKey: "health.lastError") }
    }

    private var lastCounts: (days: Int, workouts: Int) {
        get { (defaults.integer(forKey: "health.lastDays"), defaults.integer(forKey: "health.lastWorkouts")) }
        set {
            defaults.set(newValue.days, forKey: "health.lastDays")
            defaults.set(newValue.workouts, forKey: "health.lastWorkouts")
        }
    }

    /// What `LMSNative.health.status()` answers (frontend/src/lib/native.ts, NativeHealthStatus).
    func status() -> [String: Any] {
        [
            "available": Self.available,
            "connected": connected,
            "linked": KeyStore.read() != nil,
            "syncing": running != nil,
            "lastSync": orNull(lastSync.map(Days.iso)),
            "lastError": orNull(lastError),
            "days": lastCounts.days,
            "workouts": lastCounts.workouts,
            "writesEaten": Self.available && store.authorizationStatus(for: HealthReader.dietaryEnergy) == .sharingAuthorized,
        ]
    }

    // MARK: Connecting

    /// The page's "Connect Apple Health": the app's key (made through the signed-in page), Apple's
    /// Health sheet, background delivery, then a first sync of the last month.
    func connect() async throws -> [String: Any] {
        guard Self.available else { throw NativeError.healthUnavailable }
        _ = try await AccessKey.ensure()
        try await requestAuthorization()
        connected = true
        startObserving()
        Refresh.schedule()
        await sync(.connect)
        return status()
    }

    func syncNow() async -> [String: Any] {
        await sync(.manual)
        return status()
    }

    private func requestAuthorization() async throws {
        let store = self.store
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            store.requestAuthorization(
                toShare: Set<HKSampleType>([HealthReader.dietaryEnergy]),
                read: HealthReader.readTypes
            ) { _, error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            }
        }
    }

    // MARK: Background delivery

    /// HealthKit wakes the app when these change (observer queries must be set up on every launch).
    /// Heart rate and the like change all day; these few are enough to keep LMS current.
    func startObserving() {
        guard connected, Self.available, !observing else { return }
        observing = true
        let watched: [(HKSampleType, HKUpdateFrequency)] = [
            (HKQuantityType(.stepCount) as HKSampleType, .hourly),
            (HKQuantityType(.activeEnergyBurned) as HKSampleType, .hourly),
            (HKQuantityType(.restingHeartRate) as HKSampleType, .hourly),
            (HKCategoryType(.sleepAnalysis) as HKSampleType, .hourly),
            (HKQuantityType(.bodyMass) as HKSampleType, .immediate),
            (HKObjectType.workoutType() as HKSampleType, .immediate),
        ]
        for (type, frequency) in watched {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                if error != nil {
                    completion()
                    return
                }
                Task { @MainActor in
                    await HealthSync.shared.sync(.background)
                    completion()
                }
            }
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: frequency) { _, _ in }
        }
    }

    // MARK: Syncing

    func sync(_ trigger: Trigger) async {
        guard connected, Self.available else { return }
        if let running {
            await running.value
            if !trigger.byHand { return }
        }
        // Health's store is locked with the phone: nothing can be read until it is unlocked.
        guard UIApplication.shared.isProtectedDataAvailable else { return }
        if !trigger.byHand, let lastAttempt, Date().timeIntervalSince(lastAttempt) < 180 { return }

        let background = BackgroundTime()
        let task = Task { await self.run(trigger) }
        running = task
        emit()
        await task.value
        running = nil
        emit()
        background.end()
    }

    private func run(_ trigger: Trigger) async {
        lastAttempt = Date()
        do {
            guard var key = try await accessKey(trigger) else {
                lastError = "signedOut"
                return
            }
            // The first sync takes the last month (as on Android); after that, today and the 7 days before.
            let (days, workouts) = await reader.read(days: lastSync == nil ? 30 : 8)
            let sentDays = days.compactMap(\.json)
            let body: [String: Any] = [
                "source": "apple",
                "days": sentDays,
                "workouts": workouts.map(\.json),
            ]
            do {
                try await LMSClient(key: key).sendHealth(body)
            } catch LMSClient.Failure.unauthorized {
                // The key was revoked. Make a new one only when the person is here to see it.
                KeyStore.delete()
                guard trigger.byHand else { throw LMSClient.Failure.unauthorized }
                key = try await AccessKey.ensure()
                try await LMSClient(key: key).sendHealth(body)
            }
            let now = Date()
            let eaten = try await LMSClient(key: key).eatenKcal(on: Days.key(now))
            // Writing back is a bonus: a refusal there doesn't make the sync fail.
            try? await reader.writeEaten(kcal: eaten, on: now)
            lastSync = now
            lastError = nil
            lastCounts = (sentDays.count, workouts.count)
        } catch {
            lastError = NativeError.code(for: error)
        }
    }

    private func accessKey(_ trigger: Trigger) async throws -> String? {
        if let key = KeyStore.read() { return key }
        guard trigger.byHand else { return nil }
        return try await AccessKey.ensure()
    }

    private func emit() {
        AppModel.existing?.emit(["type": "health", "status": status()])
    }
}

/// Asks iOS for time to finish a sync that started while the app was in the background.
@MainActor
final class BackgroundTime {
    private var id: UIBackgroundTaskIdentifier = .invalid

    init() {
        id = UIApplication.shared.beginBackgroundTask(withName: "lms.health") { [weak self] in
            guard let self else { return }
            Task { @MainActor in self.end() }
        }
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}
