import XCTest

final class JankifyLaunchTests: XCTestCase {
    @MainActor
    func testBundledFrontendLaunchesWithPrimaryControls() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews["jankify-offline-ready"]
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        let renderingMode = webView.descendants(matching: .any)["Rendering mode"]
        let imagePicker = webView.descendants(matching: .any)["Choose a photo, animated GIF, or video from your device"]

        XCTAssertTrue(renderingMode.waitForExistence(timeout: 10))
        XCTAssertTrue(imagePicker.waitForExistence(timeout: 10))
    }
}
