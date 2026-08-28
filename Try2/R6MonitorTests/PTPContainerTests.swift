import XCTest
@testable import R6Monitor

final class PTPContainerTests: XCTestCase {
    func testCommandWithoutParametersUsesLittleEndianPTPHeader() {
        let command = PTPCommand(operationCode: 0x9153, transactionID: 7)

        XCTAssertEqual(
            Array(command.encoded()),
            [0x0C, 0x00, 0x00, 0x00, 0x01, 0x00, 0x53, 0x91, 0x07, 0x00, 0x00, 0x00]
        )
    }

    func testCommandAppendsUInt32Parameters() {
        let command = PTPCommand(
            operationCode: 0x9114,
            transactionID: 0x0102_0304,
            parameters: [1, 0xAABB_CCDD]
        )

        XCTAssertEqual(
            Array(command.encoded()),
            [
                0x14, 0x00, 0x00, 0x00,
                0x01, 0x00,
                0x14, 0x91,
                0x04, 0x03, 0x02, 0x01,
                0x01, 0x00, 0x00, 0x00,
                0xDD, 0xCC, 0xBB, 0xAA,
            ]
        )
    }

    func testResponseParsesSuccessCodeAndTransaction() throws {
        let response = try PTPResponse(
            data: Data([0x0C, 0, 0, 0, 0x03, 0, 0x01, 0x20, 0x07, 0, 0, 0])
        )

        XCTAssertEqual(response.responseCode, 0x2001)
        XCTAssertEqual(response.transactionID, 7)
        XCTAssertTrue(response.isSuccess)
    }

    func testResponseRejectsShortContainer() {
        XCTAssertThrowsError(try PTPResponse(data: Data(repeating: 0, count: 11))) {
            XCTAssertEqual($0 as? PTPContainerError, .tooShort)
        }
    }

    func testResponseRejectsInconsistentLength() {
        let bytes: [UInt8] = [0x10, 0, 0, 0, 0x03, 0, 0x01, 0x20, 0x07, 0, 0, 0]

        XCTAssertThrowsError(try PTPResponse(data: Data(bytes))) {
            XCTAssertEqual($0 as? PTPContainerError, .invalidLength(declared: 16, actual: 12))
        }
    }

    func testResponseRejectsNonResponseContainer() {
        let bytes: [UInt8] = [0x0C, 0, 0, 0, 0x01, 0, 0x01, 0x20, 0x07, 0, 0, 0]

        XCTAssertThrowsError(try PTPResponse(data: Data(bytes))) {
            XCTAssertEqual($0 as? PTPContainerError, .unexpectedType(1))
        }
    }
}
