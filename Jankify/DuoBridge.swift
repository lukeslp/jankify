// DuoBridge: tells a WKWebView page where iPhone Duo's fold is and how far the
// hinge is open. Pair with duo-fold.js, which turns the payload into a
// `duo:fold` event, `--duo-fold-*` CSS variables and `data-duo-pose` on <html>.
//
// Why a bridge: Safari 27.1 has the Viewport Segments and Device Posture web
// APIs only behind feature flags, and WKWebView has no public switch for them.
// The shim prefers those APIs whenever a browser does have them.
//
// Use (UIKit):
//   let config = WKWebViewConfiguration()
//   duo = DuoBridge(configuration: config)            // before making the web view
//   webView = WKWebView(frame: .zero, configuration: config)
//   duo.attach(to: webView)
//   override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); duo.refresh() }
// Capacitor: in a CAPBridgeViewController subclass, override
// `webViewConfiguration(for:)` to make the bridge, then attach in `capacitorDidLoad()`.
//
// Coordinates: the fold rectangle is sent in the web view's own points, which are
// CSS px when the page uses width=device-width at scale 1 and the scroll view has
// no automatic inset (`scrollView.contentInsetAdjustmentBehavior = .never`).
// Layout should follow the fold region; the hinge angle is for effects.
import UIKit
import WebKit

@MainActor
final class DuoBridge: NSObject, WKScriptMessageHandler {
    static let messageName = "duoFold"

    private weak var webView: WKWebView?
    private var hingeStatus = "unknown"
    private var hingeAngle: Double?
    private var hasHinge = false
    private var lastSent: String?
    /// Debug builds only: a fold to report instead of the real one, for screenshots
    /// on a simulator that cannot fold. Never set it in a release build.
    var simulated: [String: Any]?

    /// Adds the shim to every frame (child frames take the main frame's state) and
    /// listens for the shim's "ready" call. Call before making the web view.
    init(configuration: WKWebViewConfiguration, shim: String? = DuoBridge.bundledShim()) {
        super.init()
        let content = configuration.userContentController
        if let shim {
            content.addUserScript(WKUserScript(source: shim, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        }
        content.add(WeakHandler(self), name: Self.messageName)
    }

    /// `duo-fold.js` from the app bundle.
    nonisolated static func bundledShim(named name: String = "duo-fold") -> String? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "js") else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }

    /// Starts hinge updates for this web view (iOS 27.1 and later; earlier systems
    /// and devices without a hinge simply report none).
    func attach(to webView: WKWebView) {
        self.webView = webView
        if #available(iOS 27.1, *) {
            let interaction = UIHingeInteraction { [weak self] _, update in
                MainActor.assumeIsolated { self?.hingeChanged(update.hinge) }
            }
            webView.addInteraction(interaction)
        }
        refresh()
    }

    @available(iOS 27.1, *)
    private func hingeChanged(_ hinge: UIHinge?) {
        hasHinge = hinge != nil
        hingeAngle = hinge.map { Double($0.angle) * 180 / .pi }
        switch hinge?.status {
        case .closed: hingeStatus = "closed"
        case .partiallyOpen: hingeStatus = "partially-open"
        case .fullyOpen: hingeStatus = "fully-open"
        default: hingeStatus = "unknown"
        }
        refresh()
        // The fold region can settle a moment after the hinge reports; look again.
        DispatchQueue.main.async { [weak self] in self?.refresh() }
    }

    /// Re-reads the fold and sends it if anything changed. Call from
    /// `viewDidLayoutSubviews`; hinge updates call it too.
    func refresh() {
        guard let webView else { return }
        var payload: [String: Any] = ["hinge": hasHinge, "status": hingeStatus, "angle": hingeAngle as Any? ?? NSNull(),
                                      "fold": NSNull(), "reserved": NSNull()]
        if #available(iOS 27.1, *) {
            let active = webView.reservedRegions(kind: .division).first { $0.isActive }
            let any = webView.reservedRegions(kind: .division, options: .includeInactive).first
            if active != nil || any != nil { payload["hinge"] = true }
            if let active { payload["fold"] = Self.rect(active.frame) }
            if let any { payload["reserved"] = Self.rect(any.frame) }
        }
        if let simulated { payload.merge(simulated) { _, new in new } }
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8), json != lastSent else { return }
        lastSent = json
        #if DEBUG
        NSLog("DuoBridge: %@", json)
        #endif
        webView.evaluateJavaScript("window.DuoFold && window.DuoFold._native(\(json))", completionHandler: nil)
    }

    /// Sends the current state again (a new page, or a page that asked).
    func resend() {
        lastSent = nil
        refresh()
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.frameInfo.isMainFrame { resend() }
    }

    private static func rect(_ r: CGRect) -> [String: Double] {
        ["x": Double(r.minX), "y": Double(r.minY), "width": Double(r.width), "height": Double(r.height)]
    }
}

/// WKUserContentController keeps its handlers strongly; this breaks the cycle.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: (any WKScriptMessageHandler)?
    init(_ target: any WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
