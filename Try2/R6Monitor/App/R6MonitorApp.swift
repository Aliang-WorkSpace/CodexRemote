import SwiftUI

@main
struct R6MonitorApp: App {
    @StateObject private var viewModel = MonitorViewModel()

    var body: some Scene {
        WindowGroup {
            MonitorView(viewModel: viewModel)
                .preferredColorScheme(.dark)
        }
    }
}
