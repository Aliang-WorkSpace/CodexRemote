import XCTest
@testable import R6Monitor

@MainActor
final class MonitorViewModelTests: XCTestCase {
    func testConnectionStartsSessionAndPublishesNewestFrame() async {
        let runtime = FakeMonitorRuntime()
        let session = FakeLiveViewSession(frames: [validImageData])
        var idleTimerValues: [Bool] = []
        let viewModel = MonitorViewModel(
            runtime: runtime,
            log: DiagnosticLog(environment: "Tests"),
            setIdleTimerDisabled: { idleTimerValues.append($0) }
        )

        viewModel.start()
        runtime.emitConnection(session: session)
        await waitUntil { viewModel.latestImage != nil }

        XCTAssertEqual(session.startCount, 1)
        XCTAssertTrue(viewModel.status.isStreaming)
        XCTAssertEqual(idleTimerValues.last, true)
    }

    func testRemovalStopsSessionAndReturnsToDisconnected() async {
        let runtime = FakeMonitorRuntime()
        let session = FakeLiveViewSession()
        let viewModel = MonitorViewModel(runtime: runtime, log: DiagnosticLog(environment: "Tests"))
        viewModel.start()
        runtime.emitConnection(session: session)
        await waitUntil { session.startCount == 1 }

        runtime.emitRemoval(id: "camera-1")
        await waitUntil { session.stopCount == 1 }

        XCTAssertEqual(viewModel.status, .disconnected)
    }

    func testBackgroundStopsSessionAndReenablesIdleTimer() async {
        let runtime = FakeMonitorRuntime()
        let session = FakeLiveViewSession()
        var idleTimerValues: [Bool] = []
        let viewModel = MonitorViewModel(
            runtime: runtime,
            log: DiagnosticLog(environment: "Tests"),
            setIdleTimerDisabled: { idleTimerValues.append($0) }
        )
        viewModel.start()
        runtime.emitConnection(session: session)
        await waitUntil { session.startCount == 1 }

        await viewModel.applicationDidEnterBackground()

        XCTAssertEqual(session.stopCount, 1)
        XCTAssertEqual(idleTimerValues.last, false)
    }

    func testRetryUsesFreshSessionFromConnectionFactory() async {
        let runtime = FakeMonitorRuntime()
        var sessions: [FakeLiveViewSession] = []
        let viewModel = MonitorViewModel(runtime: runtime, log: DiagnosticLog(environment: "Tests"))
        viewModel.start()
        runtime.emitConnection {
            let session = FakeLiveViewSession()
            sessions.append(session)
            return session
        }
        await waitUntil { sessions.first?.startCount == 1 }

        await viewModel.retry()
        await waitUntil { sessions.count == 2 && sessions[1].startCount == 1 }

        XCTAssertEqual(sessions[0].stopCount, 1)
    }

    private var validImageData: Data {
        Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
    }

    private func waitUntil(
        attempts: Int = 100,
        condition: @escaping @MainActor () -> Bool
    ) async {
        for _ in 0..<attempts {
            if condition() { return }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTFail("Condition did not become true")
    }
}

@MainActor
private final class FakeMonitorRuntime: MonitorRuntime {
    var onConnection: ((CameraConnection) -> Void)?
    var onUnsupportedCamera: ((String) -> Void)?
    var onRemoval: ((String) -> Void)?
    private(set) var startCount = 0
    private(set) var stopCount = 0

    func start() { startCount += 1 }
    func stop() { stopCount += 1 }

    func emitConnection(session: FakeLiveViewSession) {
        emitConnection { session }
    }

    func emitConnection(factory: @escaping @MainActor () -> any LiveViewSession) {
        onConnection?(CameraConnection(id: "camera-1", name: "Canon EOS R6", makeSession: factory))
    }

    func emitRemoval(id: String) {
        onRemoval?(id)
    }
}

@MainActor
private final class FakeLiveViewSession: LiveViewSession {
    var frames: [Data]
    private(set) var startCount = 0
    private(set) var stopCount = 0

    init(frames: [Data] = []) {
        self.frames = frames
    }

    func start() async throws {
        startCount += 1
    }

    func nextFrame() async throws -> Data {
        if !frames.isEmpty {
            return frames.removeFirst()
        }
        try await Task.sleep(nanoseconds: 60_000_000_000)
        throw CancellationError()
    }

    func stop() async {
        stopCount += 1
    }
}
