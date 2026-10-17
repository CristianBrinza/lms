import Foundation
import Security
import WebKit

/// The access key the app made for itself, in the Keychain: readable after the first unlock (so a
/// sync in the background works), kept on this iPhone only, never shown to anyone.
enum KeyStore {
    private static let service = "md.shades.lms"
    private static let account = "health-access-key"

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func read() -> String? {
        var search = query
        search[kSecReturnData as String] = true
        search[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(search as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func save(_ key: String) {
        delete()
        var add = query
        add[kSecValueData as String] = Data(key.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func delete() {
        SecItemDelete(query as CFDictionary)
    }
}

/// How the app gets its key without anyone copying one: the person is signed in to LMS in the
/// web view, so the page's own session asks LMS for a key (POST /api/me/tokens, "LMS iPhone app",
/// scope food), the way Settings → Claude access does. Only the app sees the answer.
@MainActor
enum AccessKey {
    private static var making: Task<String, Error>?

    /// The stored key, or a new one made through the signed-in page.
    static func ensure() async throws -> String {
        if let key = KeyStore.read() { return key }
        if let making { return try await making.value }
        let task = Task { try await AccessKey.make() }
        making = task
        defer { making = nil }
        return try await task.value
    }

    private static func make() async throws -> String {
        let webView = AppModel.shared.webView
        guard AppConfig.isApp(webView.url) else { throw NativeError.notSignedIn }
        // Runs in the page's document (same origin, its cookies), in the app's own script world.
        // A 401 means the short-lived session cookie expired: refresh it once, as the web app's
        // own client does (under the same lock, so the two never rotate it at once).
        let script = """
        const body = JSON.stringify({ name, scope: 'food' });
        const post = () => fetch('/api/me/tokens', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
        });
        let response = await post();
        if (response.status === 401) {
          const refresh = () => fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
          const refreshed = navigator.locks
            ? await navigator.locks.request('lms-session-refresh', refresh)
            : await refresh();
          if (refreshed.ok || refreshed.status === 409) response = await post();
        }
        if (!response.ok) return { status: response.status };
        const json = await response.json();
        return { status: response.status, token: json.token };
        """
        let result = try await callAsync(webView, script, ["name": AppConfig.keyName])
        let answer = result as? [String: Any]
        if let token = answer?["token"] as? String, token.hasPrefix("lms_") {
            KeyStore.save(token)
            return token
        }
        let status = (answer?["status"] as? NSNumber)?.intValue ?? 0
        if status == 401 || status == 403 || status == 0 { throw NativeError.notSignedIn }
        throw LMSClient.Failure.http(status)
    }

    private static func callAsync(_ webView: WKWebView, _ body: String, _ arguments: [String: Any]) async throws -> Any? {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Any?, Error>) in
            webView.callAsyncJavaScript(body, arguments: arguments, in: nil, in: .defaultClient) { result in
                switch result {
                case .success(let value): continuation.resume(returning: value)
                case .failure(let error): continuation.resume(throwing: error)
                }
            }
        }
    }
}
