import Foundation
import Testing
@testable import ControlPlaneDesktop

@Test func hostLabelUsesConfiguredPort() async throws {
    let config = AppConfig(baseURL: URL(string: "http://127.0.0.1:8790/app")!)
    #expect(config.hostLabel == "127.0.0.1:8790")
}

@Test func hostLabelFallsBackToAbsoluteString() async throws {
    let config = AppConfig(baseURL: URL(string: "file:///tmp/index.html")!)
    #expect(config.hostLabel == "file:///tmp/index.html")
}
