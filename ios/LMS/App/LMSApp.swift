import SwiftUI
import UIKit
import UserNotifications
import WebKit

/// LMS for iPhone: the web app in a native shell, plus what only an app may do: Apple Health,
/// location in the background. Built by Shades Media Group.
@main
struct LMSApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var model = AppModel.shared
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .onChange(of: phase) { phase in
                    switch phase {
                    case .active:
                        Task { await HealthSync.shared.sync(.foreground) }
                    case .background:
                        Refresh.schedule()
                    default:
                        break
                    }
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Both must be set up on every launch, before it ends: iOS may have woken the app only
        // for a Health update, a background refresh or a watched place.
        Refresh.register()
        HealthSync.shared.startObserving()
        _ = LocationService.shared
        UNUserNotificationCenter.current().delegate = self
        Task { await HealthSync.shared.sync(.launch) }
        return true
    }

    /// A watched place's reminder shows even with the app open.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}

struct ContentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            WebView(webView: model.webView)
                .ignoresSafeArea()
            if model.loadFailed {
                OfflineView(retry: model.retry)
            }
        }
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
    }
}

/// The app's one web view, made once (AppModel) and kept across SwiftUI updates.
struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// When LMS can't be reached on opening.
struct OfflineView: View {
    let retry: @MainActor () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(L("offline.title"))
                .font(.headline)
            Text(L("offline.body"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(action: retry) {
                Text(L("offline.retry"))
                    .font(.body.weight(.semibold))
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .foregroundStyle(Color(uiColor: .systemBackground))
                    .background(Capsule().fill(Color.primary))
            }
            .padding(.top, 6)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
    }
}
