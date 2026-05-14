import SwiftUI
import WebKit

struct ControlPlaneWebView: NSViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.setValue(false, forKey: "drawsBackground")

        if let url = model.currentURL {
            view.load(URLRequest(url: url))
        }

        context.coordinator.webView = view
        return view
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard let url = model.currentURL else {
            return
        }

        if webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        @MainActor
        let model: WebViewModel
        weak var webView: WKWebView?

        @MainActor
        init(model: WebViewModel) {
            self.model = model
        }

        func reload() {
            if let webView {
                model.phase = .loading
                webView.reload()
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in
                model.markReady(url: webView.url)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in
                model.markFailed(error.localizedDescription)
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in
                model.markFailed(error.localizedDescription)
            }
        }
    }
}
