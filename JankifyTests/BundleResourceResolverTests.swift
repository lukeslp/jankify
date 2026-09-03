import XCTest
@testable import Jankify

final class BundleResourceResolverTests: XCTestCase {
    private func makeRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try Data("<html><head></head><body>Create</body></html>".utf8)
            .write(to: root.appendingPathComponent("index.html"))
        return root
    }

    func testServesBundledFilesFromPrivateOrigin() throws {
        let root = try makeRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let resolver = BundleResourceResolver(root: root)

        let resource = try resolver.resource(
            for: URLRequest(url: URL(string: "jankify://app/index.html?version=1")!)
        )

        XCTAssertEqual(resource.mimeType, "text/html")
        XCTAssertTrue(String(decoding: resource.data, as: UTF8.self).contains("Create"))
    }

    func testRejectsTraversalAndForeignOrigins() throws {
        let root = try makeRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let resolver = BundleResourceResolver(root: root)

        XCTAssertThrowsError(try resolver.resource(
            for: URLRequest(url: URL(string: "jankify://app/%2e%2e/secrets.txt")!)
        ))
        XCTAssertThrowsError(try resolver.resource(
            for: URLRequest(url: URL(string: "https://jankify.app/index.html")!)
        ))
    }

    func testRecognizesJavaScriptModuleMimeType() {
        XCTAssertEqual(BundleResourceResolver.mimeType(for: "mjs"), "text/javascript")
    }

    func testNavigationAndBridgeOriginsStayInsideTheApp() {
        let appURL = URL(string: "jankify://app/create/app/index.html#/effects")!
        let publicURL = URL(string: "https://jankify.app/create/app/")!

        XCTAssertTrue(AppNavigationPolicy().allows(appURL))
        XCTAssertFalse(AppNavigationPolicy().allows(publicURL))
        XCTAssertTrue(BridgeMessageOriginPolicy().allows(isMainFrame: true, sourceURL: appURL))
        XCTAssertFalse(BridgeMessageOriginPolicy().allows(isMainFrame: false, sourceURL: appURL))
    }
}
