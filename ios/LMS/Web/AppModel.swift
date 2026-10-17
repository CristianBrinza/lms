import SwiftUI
import UIKit
import WebKit

/// The one web view: https://lms.shades.md, the whole app, with its own sign-in. Cookies live in
/// the default (persistent) website data store, so the session survives restarts like Safari's.
@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()
    /// The model once something made it: a launch in the background (a Health update, a watched
    /// place) doesn't load the page just to tell it something.
    private(set) static var existing: AppModel?

    let webView: WKWebView
    /// The first page couldn't load (no network): the app shows a native "try again".
    @Published var loadFailed = false
    private var coordinator: WebCoordinator?

    private init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        // Keeps WebKit's own "Mobile/…" and says which app this is.
        configuration.applicationNameForUserAgent = "Mobile/15E148 LMSiOS/\(AppConfig.version.split(separator: " ").first ?? "1")"
        let controller = WKUserContentController()
        controller.addUserScript(Bridge.script)
        controller.addScriptMessageHandler(Bridge(), contentWorld: .page, name: Bridge.name)
        configuration.userContentController = controller

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        // The page lays itself out around the notch and the home bar (viewport-fit=cover).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }

        let coordinator = WebCoordinator(model: self)
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        self.coordinator = coordinator
        webView.load(URLRequest(url: AppConfig.home))
        Self.existing = self
    }

    func retry() {
        loadFailed = false
        if webView.url == nil {
            webView.load(URLRequest(url: AppConfig.home))
        } else {
            webView.reload()
        }
    }

    /// Tells the page something changed: `window` gets a `lmsnative` event with this as `detail`.
    func emit(_ detail: [String: Any]) {
        guard AppConfig.isApp(webView.url),
              JSONSerialization.isValidJSONObject(detail),
              let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('lmsnative', { detail: \(json) }));", completionHandler: nil)
    }
}

/// Navigation and the page's dialogs. LMS's pages stay in the app; every other link opens in
/// Safari (or Maps, Mail, Phone…).
@MainActor
final class WebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    private unowned let model: AppModel

    init(model: AppModel) {
        self.model = model
        super.init()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if AppConfig.isApp(url) || ["about", "blob", "data"].contains(url.scheme ?? "") {
            decisionHandler(.allow)
            return
        }
        // Something embedded in an LMS page (a map, a video) loads where it is.
        if let frame = navigationAction.targetFrame, !frame.isMainFrame {
            decisionHandler(.allow)
            return
        }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        model.loadFailed = false
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        // A cancelled load (a new one started) or a link handed to another app isn't a failure.
        guard code != NSURLErrorCancelled, code != 102 else { return }
        model.loadFailed = true
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    /// target="_blank" and window.open: LMS in this same view, the rest in Safari.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            if AppConfig.isApp(url) {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    // MARK: alert(), confirm(), prompt(): a web view shows none of them by itself.

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L("alert.ok"), style: .default) { _ in completionHandler() })
        present(alert, from: webView, otherwise: completionHandler)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L("alert.cancel"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: L("alert.ok"), style: .default) { _ in completionHandler(true) })
        present(alert, from: webView) { completionHandler(false) }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: L("alert.cancel"), style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: L("alert.ok"), style: .default) { _ in
            completionHandler(alert.textFields?.first?.text ?? "")
        })
        present(alert, from: webView) { completionHandler(nil) }
    }

    private func present(_ alert: UIAlertController, from webView: WKWebView, otherwise: @escaping () -> Void) {
        var top = webView.window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        guard let top else {
            otherwise()
            return
        }
        top.present(alert, animated: true)
    }
}
