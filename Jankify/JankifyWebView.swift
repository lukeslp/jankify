import SwiftUI
@preconcurrency import WebKit

struct JankifyWebView: UIViewRepresentable {
    static let messageHandlerName = "jankify"

    @ObservedObject var controller: BridgeController

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(
            context.coordinator,
            name: Self.messageHandlerName
        )

        do {
            let webDirectory = try BundleContent.webDirectoryURL(in: .main)
            configuration.setURLSchemeHandler(
                BundleSchemeHandler(root: webDirectory),
                forURLScheme: "jankify"
            )
        } catch {
            controller.report(error)
        }

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.accessibilityIdentifier = "jankify-offline-ready"
        webView.accessibilityLabel = "Jankify editor and creator"
        #if DEBUG
        webView.isInspectable = true
        #endif

        controller.webView = webView
        WKContentRuleListStore.default().compileContentRuleList(
            forIdentifier: "com.lukesteuber.jankify.offline-v1",
            encodedContentRuleList: AppContentSecurityPolicy.contentBlockerRules
        ) { ruleList, error in
            if let ruleList {
                configuration.userContentController.add(ruleList)
            } else if let error {
                Task { @MainActor in controller.report(error) }
            }
            Task { @MainActor in
                webView.load(URLRequest(url: BundleContent.appURL))
            }
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        controller.webView = webView
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: messageHandlerName
        )
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let controller: BridgeController
        private let navigationPolicy = AppNavigationPolicy()

        init(controller: BridgeController) {
            self.controller = controller
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard BridgeMessageOriginPolicy().allows(
                isMainFrame: message.frameInfo.isMainFrame,
                sourceURL: message.frameInfo.request.url
            ) else {
                controller.report(ResourceServingError.invalidOrigin)
                return
            }
            do {
                try controller.process(message.body)
            } catch {
                controller.report(error)
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction
        ) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            if navigationPolicy.allows(url) { return .allow }
            if navigationAction.navigationType == .linkActivated,
               url.scheme == "https" || url.scheme == "http" {
                await UIApplication.shared.open(url)
            }
            return .cancel
        }
    }
}
