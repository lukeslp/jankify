import XCTest
@testable import Jankify

@MainActor
final class BridgeControllerTests: XCTestCase {
    private var temporaryDirectory: URL!

    override func setUpWithError() throws {
        temporaryDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: temporaryDirectory,
            withIntermediateDirectories: true
        )
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: temporaryDirectory)
    }

    func testShareMessageCreatesExportFileWithExactContents() throws {
        let controller = BridgeController(temporaryDirectory: temporaryDirectory)
        let expected = Data("<svg/>".utf8)

        try controller.process([
            "action": "share",
            "payload": [
                "filename": "render.svg",
                "mimeType": "image/svg+xml",
                "base64": expected.base64EncodedString()
            ]
        ])

        let url = try XCTUnwrap(controller.pendingShare?.url)
        XCTAssertEqual(url.lastPathComponent, "render.svg")
        XCTAssertEqual(try Data(contentsOf: url), expected)
    }

    func testCopyMessagePublishesExactText() throws {
        let controller = BridgeController(temporaryDirectory: temporaryDirectory)

        try controller.process([
            "action": "copyText",
            "payload": ["text": "ABC 123"]
        ])

        XCTAssertEqual(controller.pendingClipboardText, "ABC 123")
    }

    func testPickImageMessageRequestsPicker() throws {
        let controller = BridgeController(temporaryDirectory: temporaryDirectory)

        try controller.process(["action": "pickImage"])

        XCTAssertTrue(controller.isPhotoPickerPresented)
    }

    func testInvalidMessageThrowsWithoutPublishingSideEffects() {
        let controller = BridgeController(temporaryDirectory: temporaryDirectory)

        XCTAssertThrowsError(try controller.process(["action": "deleteEverything"]))
        XCTAssertNil(controller.pendingShare)
        XCTAssertNil(controller.pendingClipboardText)
        XCTAssertFalse(controller.isPhotoPickerPresented)
    }
}
