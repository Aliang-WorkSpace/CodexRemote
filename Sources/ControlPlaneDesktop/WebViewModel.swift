import Foundation

@MainActor
final class WebViewModel: ObservableObject {
    enum Phase: Equatable {
        case loading
        case ready
        case failed(String)
    }

    @Published var phase: Phase = .loading
    @Published var currentURL: URL?

    let config: AppConfig

    init(config: AppConfig) {
        self.config = config
        self.currentURL = config.baseURL
    }

    func loadHome() {
        currentURL = config.baseURL
        phase = .loading
    }

    func markReady(url: URL?) {
        currentURL = url ?? currentURL
        phase = .ready
    }

    func markFailed(_ message: String) {
        phase = .failed(message)
    }
}
