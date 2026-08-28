import Foundation

enum CanonEOS {
    static let usbVendorID: Int = 0x04A9

    enum Operation: UInt16 {
        case setDevicePropertyValueEx = 0x9110
        case setRemoteMode = 0x9114
        case setEventMode = 0x9115
        case getViewFinderData = 0x9153
    }

    enum Property: UInt32 {
        case evfOutputDevice = 0xD1B0
        case evfMode = 0xD1B1
    }

    static func extendedPropertyPayload(property: Property, value: UInt32) -> Data {
        var data = Data()
        data.appendLittleEndian(UInt32(12))
        data.appendLittleEndian(property.rawValue)
        data.appendLittleEndian(value)
        return data
    }
}
