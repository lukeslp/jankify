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
