import XCTest
@testable import R6Monitor

final class CanonEOSProtocolTests: XCTestCase {
    func testOperationAndPropertyIdentifiersRemainCentralized() {
        XCTAssertEqual(CanonEOS.Operation.setDevicePropertyValueEx.rawValue, 0x9110)
        XCTAssertEqual(CanonEOS.Operation.setRemoteMode.rawValue, 0x9114)
        XCTAssertEqual(CanonEOS.Operation.setEventMode.rawValue, 0x9115)
        XCTAssertEqual(CanonEOS.Operation.getViewFinderData.rawValue, 0x9153)
        XCTAssertEqual(CanonEOS.Property.evfOutputDevice.rawValue, 0xD1B0)
        XCTAssertEqual(CanonEOS.Property.evfMode.rawValue, 0xD1B1)
    }

    func testExtendedPropertyPayloadIsTwelveByteLittleEndianDataset() {
        let payload = CanonEOS.extendedPropertyPayload(property: .evfMode, value: 1)

        XCTAssertEqual(
            Array(payload),
            [
                0x0C, 0x00, 0x00, 0x00,
                0xB1, 0xD1, 0x00, 0x00,
                0x01, 0x00, 0x00, 0x00,
            ]
        )
    }
}
