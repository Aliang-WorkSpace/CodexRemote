import XCTest
@testable import R6Monitor

final class CanonEVFParserTests: XCTestCase {
    private let jpeg = Data([0xFF, 0xD8, 0x01, 0x02, 0xFF, 0xD9])

    func testExtractsJPEGFromKnownCanonBlockTypes() throws {
        for type: UInt32 in [1, 9, 11] {
            XCTAssertEqual(
                try CanonEVFParser.extractJPEG(from: block(type: type, payload: jpeg)),
                jpeg
            )
        }
    }

    func testWalksPastUnrelatedBlock() throws {
        let metadata = block(type: 3, payload: Data([0x10, 0x20]))
        let image = block(type: 11, payload: jpeg)

        XCTAssertEqual(try CanonEVFParser.extractJPEG(from: metadata + image), jpeg)
    }

    func testFallsBackToBoundedJPEGMarkerScan() throws {
        let vendorEnvelope = Data([0x99, 0x88, 0x77]) + jpeg + Data([0x66])

        XCTAssertEqual(try CanonEVFParser.extractJPEG(from: vendorEnvelope), jpeg)
    }

    func testRejectsZeroLengthBlockWithoutLooping() {
        XCTAssertThrowsError(try CanonEVFParser.extractJPEG(from: Data(repeating: 0, count: 8))) {
            XCTAssertEqual($0 as? CanonEVFParserError, .invalidBlockLength(0))
        }
    }

    func testRejectsBlockShorterThanHeader() {
        let invalid = littleEndian(UInt32(7)) + littleEndian(UInt32(1))

        XCTAssertThrowsError(try CanonEVFParser.extractJPEG(from: invalid)) {
            XCTAssertEqual($0 as? CanonEVFParserError, .invalidBlockLength(7))
        }
    }

    func testRejectsBlockExtendingPastPayload() {
        let invalid = littleEndian(UInt32(100)) + littleEndian(UInt32(1)) + Data([0xFF])

        XCTAssertThrowsError(try CanonEVFParser.extractJPEG(from: invalid)) {
            XCTAssertEqual(
                $0 as? CanonEVFParserError,
                .blockExceedsPayload(offset: 0, length: 100, payloadCount: 9)
            )
        }
    }

    func testRejectsJPEGWithoutEndMarker() {
        let invalidJPEG = Data([0xFF, 0xD8, 0x01, 0x02])

        XCTAssertThrowsError(
            try CanonEVFParser.extractJPEG(from: block(type: 1, payload: invalidJPEG))
        ) {
            XCTAssertEqual($0 as? CanonEVFParserError, .jpegNotFound)
        }
    }

    func testRejectsOversizedPayload() {
        let oversized = Data(repeating: 0, count: CanonEVFParser.maximumPayloadBytes + 1)

        XCTAssertThrowsError(try CanonEVFParser.extractJPEG(from: oversized)) {
            XCTAssertEqual(
                $0 as? CanonEVFParserError,
                .payloadTooLarge(oversized.count)
            )
        }
    }

    private func block(type: UInt32, payload: Data) -> Data {
        littleEndian(UInt32(payload.count + 8)) + littleEndian(type) + payload
    }

    private func littleEndian(_ value: UInt32) -> Data {
        Data([
            UInt8(truncatingIfNeeded: value),
            UInt8(truncatingIfNeeded: value >> 8),
            UInt8(truncatingIfNeeded: value >> 16),
            UInt8(truncatingIfNeeded: value >> 24),
        ])
    }
}
