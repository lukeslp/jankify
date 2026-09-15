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

    @MainActor
    func testEditAndCreateStayInsideTheNativeApp() {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews["jankify-offline-ready"]
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        let create = webView.links["Create"]
        XCTAssertTrue(create.waitForExistence(timeout: 10))
        create.tap()

        XCTAssertTrue(webView.staticTexts["Effects"].waitForExistence(timeout: 10))
        XCTAssertTrue(webView.buttons["Export PNG"].waitForExistence(timeout: 10))

        let edit = webView.links["EDIT"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()

        XCTAssertTrue(
            webView.descendants(matching: .any)["Rendering mode"].waitForExistence(timeout: 10)
        )
    }
}
