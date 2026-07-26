import Foundation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import WebKit

struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}

@MainActor
final class BridgeController: ObservableObject {
    @Published var isPhotoPickerPresented = false
    @Published var pendingShare: ShareItem?
    @Published var pendingClipboardText: String?
    @Published var errorMessage: String?

    weak var webView: WKWebView?

    private let temporaryDirectory: URL

    init(temporaryDirectory: URL = FileManager.default.temporaryDirectory) {
        self.temporaryDirectory = temporaryDirectory
    }

    func process(_ body: Any) throws {
        switch try BridgeMessage.decode(body) {
        case .pickImage:
            isPhotoPickerPresented = true
        case let .share(payload):
            let data = try payload.decodedData()
            let url = temporaryDirectory.appendingPathComponent(payload.safeFilename)
            try data.write(to: url, options: .atomic)
            pendingShare = ShareItem(url: url)
            // Export/share is the peak completion moment — gate StoreKit there.
            ReviewPromptPolicy().noteSuccessAndRequestIfAppropriate()
        case let .copyText(text):
            pendingClipboardText = text
        }
    }

    func importMedia(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw BridgeControllerError.mediaDataUnavailable
            }
            let declared = item.supportedContentTypes
                .compactMap(\.preferredMIMEType)
                .first
            let mimeType = Self.sniffedMIMEType(for: data) ?? declared ?? "image/jpeg"
            guard Self.isSupportedImportMIMEType(mimeType) else {
                throw BridgeControllerError.unsupportedMediaType
            }
            try await sendMedia(data, mimeType: mimeType)
        } catch {
            errorMessage = "Could not load that photo or video."
        }
    }

    static func isSupportedImportMIMEType(_ mimeType: String) -> Bool {
        mimeType.hasPrefix("image/") || mimeType.hasPrefix("video/")
    }

    static func sniffedMIMEType(for data: Data) -> String? {
        ImageMIMETypeSniffer.mimeType(for: data)
    }

    func sendMedia(_ data: Data, mimeType: String) async throws {
        guard let webView else {
            throw BridgeControllerError.webViewUnavailable
        }
        _ = try await webView.callAsyncJavaScript(
            "window.jankifyReceiveImage(base64, mimeType)",
            arguments: [
                "base64": data.base64EncodedString(),
                "mimeType": mimeType
            ],
            in: nil,
            contentWorld: .page
        )
    }

    func report(_ error: Error) {
        #if DEBUG
        print("Jankify bridge error: \(error)")
        #endif
        errorMessage = "That action could not be completed."
    }
}

enum BridgeControllerError: Error {
    case mediaDataUnavailable
    case unsupportedMediaType
    case webViewUnavailable
}

enum ImageMIMETypeSniffer {
    static func mimeType(for data: Data) -> String? {
        if data.starts(with: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
            || data.starts(with: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) {
            return "image/gif"
        }

        if data.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
            return "image/png"
        }

        if data.starts(with: [0xFF, 0xD8, 0xFF]) {
            return "image/jpeg"
        }

        return nil
    }
}
