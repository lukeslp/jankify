import XCTest
@testable import Jankify

final class BundleContentTests: XCTestCase {
    func testBundledIndexContainsNativeBridgeAndNoRemoteDependencies() throws {
        let indexURL = try BundleContent.indexURL(in: .main)
        let html = try String(contentsOf: indexURL, encoding: .utf8)

        XCTAssertTrue(html.contains("ios-bridge.js"))
        XCTAssertTrue(html.contains("offline.css"))
        XCTAssertFalse(html.contains("https://fonts.googleapis.com"))
        XCTAssertFalse(html.contains("cdnjs.cloudflare.com"))
        XCTAssertFalse(html.contains("stats.dr.eamer.dev/count.js"))
    }
}
