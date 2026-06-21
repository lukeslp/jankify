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
        case let .copyText(text):
            pendingClipboardText = text
        }
    }

    func importPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw BridgeControllerError.imageDataUnavailable
            }
            let mimeType = item.supportedContentTypes
                .compactMap(\.preferredMIMEType)
                .first ?? "image/jpeg"
            try await sendImage(data, mimeType: mimeType)
        } catch {
            errorMessage = "Could not load that image."
        }
    }

    func sendImage(_ data: Data, mimeType: String) async throws {
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
    case imageDataUnavailable
    case webViewUnavailable
}
