#if DEBUG
import XCTest
import UIKit
@testable import R6Monitor

@MainActor
final class DemoMonitorRuntimeTests: XCTestCase {
    func testDemoSessionProducesAValidPreviewImage() async throws {
        let session = DemoLiveViewSession()

        try await session.start()
        let frame = try await session.nextFrame()

        XCTAssertNotNil(UIImage(data: frame))
    }
}
#endif
