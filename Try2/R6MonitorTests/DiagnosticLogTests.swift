import XCTest
@testable import R6Monitor

@MainActor
final class DiagnosticLogTests: XCTestCase {
    private let date = Date(timeIntervalSince1970: 1_788_000_000)

    func testRetainsOnlyNewestEntries() {
        let log = DiagnosticLog(maxEntries: 2, now: { self.date }, environment: "Test Environment")

        log.record("first")
        log.record("second")
        log.record("third")

        XCTAssertFalse(log.textReport.contains("first"))
        XCTAssertTrue(log.textReport.contains("second"))
        XCTAssertTrue(log.textReport.contains("third"))
    }

    func testSanitizesExternalTextAndUsesStableTimestamp() {
        let log = DiagnosticLog(maxEntries: 10, now: { self.date }, environment: "Test Environment")

        log.record("device=EOS R6\nsecret-looking-next-line")

        XCTAssertTrue(log.textReport.contains("2026-08-29T10:40:00.000Z"))
        XCTAssertTrue(log.textReport.contains("device=EOS R6 secret-looking-next-line"))
    }

    func testPTPEntryContainsCodesAndByteCountButNotPayload() {
        let log = DiagnosticLog(maxEntries: 10, now: { self.date }, environment: "Test Environment")

        log.recordPTP(operation: 0x9153, response: 0x2001, dataCount: 123_456)

        XCTAssertTrue(log.textReport.contains("op=0x9153"))
        XCTAssertTrue(log.textReport.contains("response=0x2001"))
        XCTAssertTrue(log.textReport.contains("bytes=123456"))
        XCTAssertFalse(log.textReport.contains("FFD8"))
    }
}
