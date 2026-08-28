import XCTest
@testable import R6Monitor

final class CallbackAwaiterTests: XCTestCase {
    func testReturnsCallbackValue() async throws {
        let value: Int = try await CallbackAwaiter.value(
            operation: "test",
            timeoutNanoseconds: 100_000_000
        ) { completion in
            completion(.success(42))
        }

        XCTAssertEqual(value, 42)
    }

    func testThrowsTimeoutWhenCallbackNeverArrives() async {
        do {
            let _: Int = try await CallbackAwaiter.value(
                operation: "send",
                timeoutNanoseconds: 10_000_000
            ) { _ in }
            XCTFail("Expected timeout")
        } catch {
            XCTAssertEqual(error as? CallbackAwaiterError, .timedOut(operation: "send"))
        }
    }

    func testLateCallbackAfterTimeoutIsIgnored() async {
        do {
            let _: Int = try await CallbackAwaiter.value(
                operation: "late",
                timeoutNanoseconds: 10_000_000
            ) { completion in
                Task {
                    try? await Task.sleep(nanoseconds: 30_000_000)
                    completion(.success(7))
                }
            }
            XCTFail("Expected timeout")
        } catch {
            XCTAssertEqual(error as? CallbackAwaiterError, .timedOut(operation: "late"))
        }

        try? await Task.sleep(nanoseconds: 50_000_000)
    }
}
