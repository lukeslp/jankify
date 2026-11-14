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

        let duo = DuoBridge(configuration: configuration)
        let webView = LayoutReportingWebView(frame: .zero, configuration: configuration)
        duo.attach(to: webView)
        webView.onLayout = { [weak duo] in duo?.refresh() }
        context.coordinator.duo = duo
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
        context.coordinator.duo?.refresh()
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
        var duo: DuoBridge?
        #if DEBUG
        private let capture = CaptureFixture(arguments: ProcessInfo.processInfo.arguments)
        #endif

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

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            duo?.resend()
            #if DEBUG
            capture.apply(to: webView, controller: controller)
            #endif
        }
    }
}

#if DEBUG
/// Debug builds only: launch arguments that open a bundled image and set controls, so
/// screenshots need no taps. `scripts/capture-duo.sh` passes them through `simctl launch`.
///
///     -JankifyCaptureSample create/icon.png        a file inside the bundled Web folder
///     -JankifyCaptureControls "mode=emoji;emoji-window=5"   element id=value, in order
///     -JankifyCaptureScroll aside                  CSS selector to scroll to the top
///     -JankifyCaptureRoute "create/app/index.html#/effects"   open this page instead of Edit
@MainActor
final class CaptureFixture {
    private let sample: String?
    private let controls: [[String]]
    private let scroll: String?
    private var route: String?
    private var applied = false

    init(arguments: [String]) {
        func value(_ flag: String) -> String? {
            guard let index = arguments.firstIndex(of: flag), index + 1 < arguments.count else {
                return nil
            }
            return arguments[index + 1]
        }
        sample = value("-JankifyCaptureSample")
        controls = (value("-JankifyCaptureControls") ?? "")
            .split(separator: ";")
            .map { $0.split(separator: "=", maxSplits: 1).map(String.init) }
            .filter { $0.count == 2 }
        scroll = value("-JankifyCaptureScroll")
        route = value("-JankifyCaptureRoute")
    }

    func apply(to webView: WKWebView, controller: BridgeController) {
        if let route {
            self.route = nil
            if let url = URL(string: route, relativeTo: BundleContent.appURL)?.absoluteURL {
                webView.load(URLRequest(url: url))
                return
            }
        }
        guard !applied, webView.url?.path == BundleContent.appURL.path else { return }
        guard sample != nil || !controls.isEmpty || scroll != nil else { return }
        applied = true
        Task { await applyToEdit(webView, controller: controller) }
    }

    private func applyToEdit(_ webView: WKWebView, controller: BridgeController) async {
        do {
            if let sample {
                let root = try BundleContent.webDirectoryURL(in: .main).standardizedFileURL
                let file = root.appendingPathComponent(sample).standardizedFileURL
                guard file.path.hasPrefix(root.path + "/") else { return }
                let data = try Data(contentsOf: file)
                let mimeType = ImageMIMETypeSniffer.mimeType(for: data) ?? "image/png"
                try await controller.sendMedia(data, mimeType: mimeType)
            }
            _ = try await webView.callAsyncJavaScript(
                """
                for (const [id, value] of controls) {
                  const el = document.getElementById(id);
                  if (!el) continue;
                  if (el.type === "checkbox") el.checked = value === "true"; else el.value = value;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                }
                """,
                arguments: ["controls": controls],
                in: nil,
                contentWorld: .page
            )
            if let scroll {
                try await Task.sleep(for: .milliseconds(800))
                _ = try await webView.callAsyncJavaScript(
                    "document.querySelector(selector)?.scrollIntoView({ block: \"start\" });",
                    arguments: ["selector": scroll],
                    in: nil,
                    contentWorld: .page
                )
            }
        } catch {
            print("Jankify capture fixture: \(error)")
        }
    }
}
#endif

/// Reports layout passes so the iPhone Duo fold position is re-read after rotation
/// or a size change, which do not always reach `updateUIView`.
final class LayoutReportingWebView: WKWebView {
    var onLayout: (() -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        onLayout?()
    }
}
