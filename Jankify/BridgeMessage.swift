import Foundation

enum BridgeMessage: Equatable {
    case pickImage
    case share(ExportPayload)
    case copyText(String)

    static func decode(_ body: Any) throws -> BridgeMessage {
        guard
            let dictionary = body as? [String: Any],
            let action = dictionary["action"] as? String
        else {
            throw BridgeError.invalidMessage
        }

        switch action {
        case "pickImage":
            return .pickImage
        case "share":
            guard
                let payload = dictionary["payload"] as? [String: Any],
                let filename = payload["filename"] as? String,
                let mimeType = payload["mimeType"] as? String,
                let base64 = payload["base64"] as? String
            else {
                throw BridgeError.invalidMessage
            }
            return .share(try ExportPayload(
                filename: filename,
                mimeType: mimeType,
                base64: base64
            ))
        case "copyText":
            guard
                let payload = dictionary["payload"] as? [String: Any],
                let text = payload["text"] as? String
            else {
                throw BridgeError.invalidMessage
            }
            return .copyText(text)
        default:
            throw BridgeError.unsupportedAction
        }
    }
}

struct ExportPayload: Equatable {
    static let maximumDecodedBytes = 50 * 1_024 * 1_024

    let filename: String
    let mimeType: String
    let base64: String

    init(filename: String, mimeType: String, base64: String) throws {
        guard Self.allowedMIMETypes.contains(mimeType) else {
            throw BridgeError.unsupportedMIMEType
        }
        self.filename = filename
        self.mimeType = mimeType
        self.base64 = base64
    }

    var safeFilename: String {
        let leaf = URL(fileURLWithPath: filename).lastPathComponent
        let scalars = leaf.unicodeScalars.map { scalar -> Character in
            if CharacterSet.alphanumerics.contains(scalar) || ".-_".unicodeScalars.contains(scalar) {
                return Character(String(scalar))
            }
            return "-"
        }
        let sanitized = String(scalars).trimmingCharacters(in: CharacterSet(charactersIn: "."))
        return sanitized.isEmpty ? "jankify-export" : sanitized
    }

    func decodedData() throws -> Data {
        let maximumEncodedLength = ((Self.maximumDecodedBytes + 2) / 3) * 4
        guard base64.utf8.count <= maximumEncodedLength else {
            throw BridgeError.payloadTooLarge
        }
        guard let data = Data(base64Encoded: base64) else {
            throw BridgeError.invalidBase64
        }
        guard data.count <= Self.maximumDecodedBytes else {
            throw BridgeError.payloadTooLarge
        }
        return data
    }

    private static let allowedMIMETypes: Set<String> = [
        "application/json",
        "image/gif",
        "image/png",
        "image/svg+xml",
        "text/css",
        "text/html",
        "text/plain",
        "video/mp4",
        "video/webm"
    ]
}

enum BridgeError: Error, Equatable {
    case invalidMessage
    case unsupportedAction
    case unsupportedMIMEType
    case invalidBase64
    case payloadTooLarge
}
