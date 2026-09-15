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
        XCTAssertTrue(html.contains("href=\"create/app/index.html#/effects\""))
    }

    func testCreateWorkspaceIsBundledWithEveryModeAndNoRemoteRuntime() throws {
        let webDirectory = try BundleContent.webDirectoryURL(in: .main)
        let createIndex = webDirectory.appendingPathComponent("create/app/index.html")
        let html = try String(contentsOf: createIndex, encoding: .utf8)

        XCTAssertTrue(html.contains("../native-shell.js"))
        XCTAssertFalse(html.contains("stats.dr.eamer.dev"))
        for mode in ["backgrounds", "effects", "explosions", "planets", "ships", "sprites", "starscapes"] {
            XCTAssertTrue(FileManager.default.fileExists(
                atPath: webDirectory.appendingPathComponent("create/app/js/modes/\(mode).js").path
            ))
        }
    }
}
