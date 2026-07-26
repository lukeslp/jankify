import SwiftUI

@main
struct JankifyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear { ReviewPromptPolicy().recordSession() }
        }
    }
}
