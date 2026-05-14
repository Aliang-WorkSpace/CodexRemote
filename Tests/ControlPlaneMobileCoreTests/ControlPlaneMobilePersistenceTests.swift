import Foundation
import Testing
@testable import ControlPlaneMobileCore

@Test func userDefaultsStoreRoundTripsKnownDevice() throws {
    let suiteName = "ControlPlaneMobilePersistenceTests.roundTrip.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        Issue.record("Failed to create isolated UserDefaults suite")
        return
    }
    defaults.removePersistentDomain(forName: suiteName)

    let store = UserDefaultsKnownDeviceStore(defaults: defaults)
    let savedDevice = SavedKnownDevice(
        bundle: PairingBundle(
            version: 1,
            generatedAt: "2026-04-02T12:00:00Z",
            deviceID: "device_1",
            workspaceID: "local-mac",
            workspaceName: "Local Mac",
            pairingToken: "pair_123",
            transport: TransportInfo(
                type: "http",
                baseURL: "http://192.168.1.8:8793",
                localBaseURL: "http://127.0.0.1:8793",
                phoneAccessURL: "http://192.168.1.8:8793",
                isLocalOnly: false,
                hint: "same wifi"
            ),
            capabilities: ControlPlaneCapabilities(
                commandSubmission: true,
                sessionInspection: true,
                eventStreaming: false,
                backgroundSync: true
            )
        ),
        lastSessionID: "session_1",
        savedAt: "2026-04-02T12:01:00Z"
    )

    try store.saveKnownDevice(savedDevice)
    let restored = try store.loadKnownDevice()

    #expect(restored == savedDevice)
}

@Test func userDefaultsStoreClearsKnownDevice() throws {
    let suiteName = "ControlPlaneMobilePersistenceTests.clear.\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        Issue.record("Failed to create isolated UserDefaults suite")
        return
    }
    defaults.removePersistentDomain(forName: suiteName)

    let store = UserDefaultsKnownDeviceStore(defaults: defaults)
    let savedDevice = SavedKnownDevice(
        bundle: PairingBundle(
            version: 1,
            generatedAt: "2026-04-02T12:00:00Z",
            deviceID: "device_1",
            workspaceID: "local-mac",
            workspaceName: "Local Mac",
            pairingToken: nil,
            transport: TransportInfo(
                type: "http",
                baseURL: "http://192.168.1.8:8793",
                localBaseURL: nil,
                phoneAccessURL: "http://192.168.1.8:8793",
                isLocalOnly: false,
                hint: nil
            ),
            capabilities: ControlPlaneCapabilities(
                commandSubmission: true,
                sessionInspection: true,
                eventStreaming: false,
                backgroundSync: true
            )
        ),
        lastSessionID: nil,
        savedAt: nil
    )

    try store.saveKnownDevice(savedDevice)
    try store.clearKnownDevice()

    #expect(try store.loadKnownDevice() == nil)
}
