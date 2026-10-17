import Foundation
import WebKit

/// The page's way in: `window.LMSNative` (frontend/src/lib/native.ts), put on every LMS page
/// before its own code runs. Each call is a `window.webkit.messageHandlers.lms.postMessage(…)`
/// that answers with a Promise. Only LMS's own pages, in the top frame, are answered.
final class Bridge: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "lms"

    /// The user script that defines window.LMSNative.
    static var script: WKUserScript {
        let source = """
        (function () {
          'use strict';
          var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.lms;
          if (!handler || window.LMSNative) return;
          function call(type, extra) {
            var message = { type: type };
            if (extra) for (var key in extra) message[key] = extra[key];
            return handler.postMessage(message);
          }
          var bridge = {
            platform: 'ios',
            version: \(jsString(AppConfig.version)),
            health: Object.freeze({
              connect: function () { return call('health.connect'); },
              syncNow: function () { return call('health.sync'); },
              status: function () { return call('health.status'); }
            }),
            location: Object.freeze({
              request: function () { return call('location.request'); },
              current: function () { return call('location.current'); },
              status: function () { return call('location.status'); },
              regions: function () { return call('location.regions'); },
              setRegions: function (regions) { return call('location.setRegions', { regions: regions }); }
            })
          };
          Object.defineProperty(window, 'LMSNative', { value: Object.freeze(bridge), writable: false, configurable: false });
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == AppConfig.host else {
            replyHandler(nil, NativeError.notAllowed.code)
            return
        }
        guard let body = message.body as? [String: Any], var type = body["type"] as? String else {
            replyHandler(nil, NativeError.badMessage.code)
            return
        }
        // Also { type: 'location', action: 'current' }.
        if let action = body["action"] as? String, !type.contains(".") { type += ".\(action)" }
        let call = type
        Task { @MainActor in
            do {
                let result = try await Bridge.handle(call, body)
                replyHandler(result, nil)
            } catch {
                replyHandler(nil, NativeError.code(for: error))
            }
        }
    }

    @MainActor
    private static func handle(_ type: String, _ body: [String: Any]) async throws -> Any? {
        switch type {
        case "health.status": return HealthSync.shared.status()
        case "health.connect": return try await HealthSync.shared.connect()
        case "health.sync", "health.syncNow": return await HealthSync.shared.syncNow()
        case "location.status": return LocationService.shared.status()
        case "location.request": return await LocationService.shared.request()
        case "location.current": return try await LocationService.shared.current()
        case "location.regions": return LocationService.shared.regions()
        case "location.setRegions": return try await LocationService.shared.setRegions(body["regions"])
        default: throw NativeError.badMessage
        }
    }

    private static func jsString(_ text: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [text])) ?? Data("[\"\"]".utf8)
        let array = String(data: data, encoding: .utf8) ?? "[\"\"]"
        return String(array.dropFirst().dropLast())
    }
}
