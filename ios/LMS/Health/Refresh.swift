import BackgroundTasks
import Foundation

/// BGAppRefresh: iOS wakes the app now and then (it decides when, from how the app is used) to
/// sync even on days Health's background delivery stays quiet.
enum Refresh {
    /// Must run before the app finishes launching.
    static func register() {
        _ = BGTaskScheduler.shared.register(forTaskWithIdentifier: AppConfig.refreshTask, using: nil) { task in
            Refresh.handle(task)
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: AppConfig.refreshTask)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 2 * 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    private static func handle(_ task: BGTask) {
        schedule()
        let finish = Once { success in task.setTaskCompleted(success: success) }
        let work = Task { @MainActor in
            await HealthSync.shared.sync(.background)
            finish.call(true)
        }
        task.expirationHandler = {
            work.cancel()
            finish.call(false)
        }
    }
}

/// Calls its action once, whoever comes first (the work finishing or iOS running out of patience).
final class Once {
    private let lock = NSLock()
    private var done = false
    private let action: (Bool) -> Void

    init(_ action: @escaping (Bool) -> Void) {
        self.action = action
    }

    func call(_ value: Bool) {
        lock.lock()
        let first = !done
        done = true
        lock.unlock()
        if first { action(value) }
    }
}
