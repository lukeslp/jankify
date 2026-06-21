import SwiftUI
import PhotosUI

struct ContentView: View {
    @StateObject private var bridge = BridgeController()
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            JankifyWebView(controller: bridge)
                .ignoresSafeArea(.container, edges: .bottom)
        }
        .photosPicker(
            isPresented: $bridge.isPhotoPickerPresented,
            selection: $selectedPhoto,
            matching: .images
        )
        .onChange(of: selectedPhoto) { _, item in
            Task { await bridge.importPhoto(item) }
        }
        .onChange(of: bridge.pendingClipboardText) { _, text in
            guard let text else { return }
            UIPasteboard.general.string = text
            bridge.pendingClipboardText = nil
        }
        .sheet(item: $bridge.pendingShare) { item in
            ActivityView(items: [item.url])
        }
        .alert(
            "Jankify",
            isPresented: Binding(
                get: { bridge.errorMessage != nil },
                set: { if !$0 { bridge.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(bridge.errorMessage ?? "")
        }
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(
        _ uiViewController: UIActivityViewController,
        context: Context
    ) {}
}
