import SwiftUI
#if canImport(ControlPlaneMobileCore)
import ControlPlaneMobileCore
#endif

@main
struct ControlPlaneMobileApp: App {
    @State private var appState = MobileAppState()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ControlPlaneRootView(appState: appState)
                .onOpenURL { url in
                    Task { await appState.handleIncomingURL(url) }
                }
                .task {
                    await appState.handleScenePhaseChange(ScenePhase.active)
                }
                .onChange(of: scenePhase) { _, newPhase in
                    Task { await appState.handleScenePhaseChange(newPhase) }
                }
        }
    }
}
