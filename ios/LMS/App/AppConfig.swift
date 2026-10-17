import Foundation

/// Where LMS lives and what the app calls itself there.
enum AppConfig {
    static let host = "lms.shades.md"
    static let origin = "https://lms.shades.md"
    static let home = URL(string: "https://lms.shades.md/")!
    /// The name of the access key the app makes for itself (Settings → Claude access lists it).
    static let keyName = "LMS iPhone app"
    /// BGTaskScheduler's id; also in Info.plist (BGTaskSchedulerPermittedIdentifiers).
    static let refreshTask = "md.shades.lms.refresh"

    /// "1.0.0 (42)": the marketing version and CI's build number.
    static var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = info?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    /// A page of LMS itself (everything else opens in Safari).
    static func isApp(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == host
    }
}

/// Text from Localizable.strings (en, ro, ru).
func L(_ key: String) -> String {
    NSLocalizedString(key, comment: "")
}

/// What the page gets back when a native call fails: the Error's message is this short code,
/// which the web app turns into a sentence in its own language.
enum NativeError: Error {
    case notAllowed
    case badMessage
    case notSignedIn
    case healthUnavailable
    case locationDenied
    case locationUnavailable

    var code: String {
        switch self {
        case .notAllowed: return "notAllowed"
        case .badMessage: return "badMessage"
        case .notSignedIn: return "notSignedIn"
        case .healthUnavailable: return "healthUnavailable"
        case .locationDenied: return "locationDenied"
        case .locationUnavailable: return "locationUnavailable"
        }
    }

    static func code(for error: Error) -> String {
        if let native = error as? NativeError { return native.code }
        if let lms = error as? LMSClient.Failure { return lms.code }
        return "health"
    }
}

/// Day keys and timestamps as LMS writes them: the phone's local day, ISO times with the offset.
enum Days {
    /// Gregorian whatever the phone's calendar setting, in the phone's time zone now.
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone.current
        return calendar
    }

    /// "2026-10-17" in the phone's time zone.
    static func key(_ date: Date) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    /// "2026-10-17T07:30:00+03:00".
    static func isoLocal(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.timeZone = TimeZone.current
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: date)
    }

    /// "2026-10-17T04:30:00Z", for the page.
    static func iso(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }
}

/// nil as JSON's null, for answers to the page.
func orNull(_ value: Any?) -> Any {
    value ?? NSNull()
}
