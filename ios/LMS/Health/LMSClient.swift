import Foundation

/// LMS's API with the app's own access key: send the health days, read what was eaten today.
/// The same two calls the Android companion makes (android/…/LmsClient.kt).
struct LMSClient {
    enum Failure: Error {
        /// The key was revoked, or never was.
        case unauthorized
        case http(Int)
        case network

        var code: String {
            switch self {
            case .unauthorized: return "signedOut"
            case .http: return "server"
            case .network: return "network"
            }
        }
    }

    let key: String

    /// POST /api/training/health: `{ source: "apple", days: […], workouts: […] }`.
    func sendHealth(_ body: [String: Any]) async throws {
        let data = try JSONSerialization.data(withJSONObject: body)
        _ = try await request("POST", "/api/training/health", body: data)
    }

    /// GET /api/training/energy/today: kcal eaten on that day, from the meals logged in LMS.
    func eatenKcal(on day: String) async throws -> Double {
        let data = try await request("GET", "/api/training/energy/today?today=\(day)", body: nil)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return (json?["eatenKcal"] as? NSNumber)?.doubleValue ?? 0
    }

    private func request(_ method: String, _ path: String, body: Data?) async throws -> Data {
        guard let url = URL(string: AppConfig.origin + path) else { throw Failure.http(0) }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = method
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let language = Locale.preferredLanguages.first {
            request.setValue(language, forHTTPHeaderField: "Accept-Language")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        let result: (Data, URLResponse)
        do {
            result = try await URLSession.shared.data(for: request)
        } catch {
            throw Failure.network
        }
        let (data, response) = result
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw Failure.unauthorized }
        guard (200..<300).contains(status) else { throw Failure.http(status) }
        return data
    }
}
