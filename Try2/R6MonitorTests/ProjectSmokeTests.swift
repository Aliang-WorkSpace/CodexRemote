import XCTest
@testable import R6Monitor

final class ProjectSmokeTests: XCTestCase {
    func testInitialStatusExplainsHowToConnect() {
        XCTAssertEqual(
            MonitorStatus.disconnected.message,
            "打开佳能 R6，并用 USB-C 数据线连接"
        )
    }

    func testPausedStatusExplainsHowToResume() {
        XCTAssertEqual(MonitorStatus.paused.message, "监看已停止")
    }
}
