import SwiftUI

@main
struct ControlPlaneDesktopApp: App {
    private let config = AppConfig()

    var body: some Scene {
        WindowGroup(config.title) {
            ContentView(config: config)
                .frame(minWidth: 1120, minHeight: 760)
        }
        .windowResizability(.contentMinSize)
        .defaultSize(width: 1360, height: 900)
    }
}
