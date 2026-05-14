import Foundation

public struct SavedKnownDevice: Codable, Equatable, Sendable {
    public let bundle: PairingBundle
    public let lastSessionID: String?
    public let savedAt: String?

    public init(bundle: PairingBundle, lastSessionID: String? = nil, savedAt: String? = nil) {
        self.bundle = bundle
        self.lastSessionID = lastSessionID
        self.savedAt = savedAt
    }
}

public protocol KnownDeviceStoring {
    func loadKnownDevice() throws -> SavedKnownDevice?
    func saveKnownDevice(_ device: SavedKnownDevice) throws
    func clearKnownDevice() throws
}

public final class UserDefaultsKnownDeviceStore: KnownDeviceStoring {
    private let defaults: UserDefaults
    private let key: String
    private let legacyKeys: [String]
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(
        defaults: UserDefaults = .standard,
        key: String = "codex-remote.known-device",
        legacyKeys: [String] = ["control-plane.known-device"]
    ) {
        self.defaults = defaults
        self.key = key
        self.legacyKeys = legacyKeys
    }

    public func loadKnownDevice() throws -> SavedKnownDevice? {
        let data =
            defaults.data(forKey: key)
            ?? legacyKeys.compactMap { defaults.data(forKey: $0) }.first

        guard let data else {
            return nil
        }

        return try decoder.decode(SavedKnownDevice.self, from: data)
    }

    public func saveKnownDevice(_ device: SavedKnownDevice) throws {
        defaults.set(try encoder.encode(device), forKey: key)
        legacyKeys.forEach { defaults.removeObject(forKey: $0) }
    }

    public func clearKnownDevice() throws {
        defaults.removeObject(forKey: key)
        legacyKeys.forEach { defaults.removeObject(forKey: $0) }
    }
}
