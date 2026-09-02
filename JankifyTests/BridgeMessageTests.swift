import XCTest
@testable import Jankify

final class BridgeMessageTests: XCTestCase {
    func testDecodesPickImageAction() throws {
        let message = try BridgeMessage.decode(["action": "pickImage"])

        XCTAssertEqual(message, .pickImage)
    }

    func testDecodesValidSharePayload() throws {
        let message = try BridgeMessage.decode([
            "action": "share",
            "payload": [
                "filename": "jankify.png",
                "mimeType": "image/png",
                "base64": Data("png".utf8).base64EncodedString()
            ]
        ])

        guard case let .share(payload) = message else {
            return XCTFail("Expected a share message")
        }
        XCTAssertEqual(try payload.decodedData(), Data("png".utf8))
    }

    func testRejectsUnsupportedAction() {
        XCTAssertThrowsError(try BridgeMessage.decode(["action": "openURL"]))
    }

    func testRejectsMalformedBase64() throws {
        let message = try BridgeMessage.decode([
            "action": "share",
            "payload": [
                "filename": "jankify.png",
                "mimeType": "image/png",
                "base64": "not base64"
            ]
        ])

        guard case let .share(payload) = message else {
            return XCTFail("Expected a share message")
        }
        XCTAssertThrowsError(try payload.decodedData())
    }

    func testSanitizesExportFilename() throws {
        let message = try BridgeMessage.decode([
            "action": "share",
            "payload": [
                "filename": "../../My Jank!.svg",
                "mimeType": "image/svg+xml",
                "base64": Data().base64EncodedString()
            ]
        ])

        guard case let .share(payload) = message else {
            return XCTFail("Expected a share message")
        }
        XCTAssertEqual(payload.safeFilename, "My-Jank-.svg")
    }

    func testAcceptsGifMIMEType() throws {
        let message = try BridgeMessage.decode([
            "action": "share",
            "payload": [
                "filename": "jankify.gif",
                "mimeType": "image/gif",
                "base64": Data("GIF".utf8).base64EncodedString()
            ]
        ])

        guard case let .share(payload) = message else {
            return XCTFail("Expected a share message")
        }
        XCTAssertEqual(try payload.decodedData(), Data("GIF".utf8))
    }

    func testAcceptsCanonicalVideoMIMETypes() throws {
        for mimeType in ["video/mp4", "video/webm"] {
            let message = try BridgeMessage.decode([
                "action": "share",
                "payload": [
                    "filename": "jankify-video",
                    "mimeType": mimeType,
                    "base64": Data("video".utf8).base64EncodedString()
                ]
            ])

            guard case let .share(payload) = message else {
                return XCTFail("Expected a share message for \(mimeType)")
            }
            XCTAssertEqual(try payload.decodedData(), Data("video".utf8))
        }
    }

    @MainActor
    func testImportPolicyAcceptsImagesAndVideosOnly() {
        XCTAssertTrue(BridgeController.isSupportedImportMIMEType("image/gif"))
        XCTAssertTrue(BridgeController.isSupportedImportMIMEType("video/mp4"))
        XCTAssertTrue(BridgeController.isSupportedImportMIMEType("video/quicktime"))
        XCTAssertFalse(BridgeController.isSupportedImportMIMEType("application/pdf"))
    }

    func testRejectsExportsLargerThanFiftyMegabytes() throws {
        let oversized = Data(count: 50 * 1_024 * 1_024 + 1)
        let message = try BridgeMessage.decode([
            "action": "share",
            "payload": [
                "filename": "large.png",
                "mimeType": "image/png",
                "base64": oversized.base64EncodedString()
            ]
        ])

        guard case let .share(payload) = message else {
            return XCTFail("Expected a share message")
        }
        XCTAssertThrowsError(try payload.decodedData())
    }
}
