import XCTest

final class JankifyLaunchTests: XCTestCase {
    func testBundledFrontendLaunchesWithPrimaryControls() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews["jankify-offline-ready"]
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        XCTAssertTrue(
            webView.descendants(matching: .any)["Rendering mode"].exists
        )
        XCTAssertTrue(
            webView.descendants(matching: .any)["Choose an image"].exists
        )
    }
}
