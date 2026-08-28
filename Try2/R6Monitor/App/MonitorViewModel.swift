import Combine
import Foundation
import UIKit

enum MonitorStatus: Equatable {
    case disconnected
    case unsupported(String)
    case connecting(String)
    case streaming(fps: Double)
    case stopping
    case failed(String)

    var message: String {
        switch self {
        case .disconnected:
            return "打开佳能 R6，并用 USB-C 数据线连接"
        case let .unsupported(name):
            return "检测到 \(name)，第一版只支持原代 EOS R6"
        case let .connecting(name):
            return "正在连接 \(name)…"
        case let .streaming(fps):
            return fps > 0 ? String(format: "USB 监看 · %.1f fps", fps) : "USB 监看"
        case .stopping:
            return "正在安全关闭实时取景…"
        case let .failed(message):
            return message
        }
    }

    var isStreaming: Bool {
        if case .streaming = self { return true }
        return false
    }
}

@MainActor
final class MonitorViewModel: ObservableObject {
    @Published private(set) var status: MonitorStatus = .disconnected
    @Published private(set) var latestImage: UIImage?
    @Published var isShowingDiagnostics = false

    let log: DiagnosticLog
    private let runtime: MonitorRuntime
    private let setIdleTimerDisabled: (Bool) -> Void
    private var currentConnection: CameraConnection?
    private var activeSession: (any LiveViewSession)?
    private var frameTask: Task<Void, Never>?
    private var hasStarted = false

    convenience init() {
        let log = DiagnosticLog()
        self.init(runtime: ImageCaptureMonitorRuntime(log: log), log: log)
    }

    init(
        runtime: MonitorRuntime,
        log: DiagnosticLog,
        setIdleTimerDisabled: ((Bool) -> Void)? = nil
    ) {
        self.runtime = runtime
        self.log = log
        self.setIdleTimerDisabled = setIdleTimerDisabled ?? {
            UIApplication.shared.isIdleTimerDisabled = $0
        }

        runtime.onConnection = { [weak self] connection in
            Task { @MainActor in
                await self?.connect(connection)
            }
        }
        runtime.onUnsupportedCamera = { [weak self] name in
            self?.status = .unsupported(name)
        }
        runtime.onRemoval = { [weak self] id in
            Task { @MainActor in
                await self?.handleRemoval(id: id)
            }
        }
    }

    func start() {
        guard !hasStarted else { return }
        hasStarted = true
        log.record("Monitor discovery started")
        runtime.start()
    }

    func stop() async {
        await stopCurrentSession(finalStatus: .disconnected)
    }

    func retry() async {
        guard let connection = currentConnection else {
            status = .disconnected
            runtime.start()
            return
        }
        await connect(connection)
    }

    func applicationDidEnterBackground() async {
        log.record("Application entered background")
        await stopCurrentSession(finalStatus: .disconnected)
    }

    var diagnosticReport: String { log.textReport }

    private func connect(_ connection: CameraConnection) async {
        await stopCurrentSession(finalStatus: nil)
        currentConnection = connection
        status = .connecting(connection.name)
        latestImage = nil
        log.record("Starting camera id=\(connection.id) name=\(connection.name)")

        let session = connection.makeSession()
        activeSession = session
        frameTask = Task { @MainActor [weak self, weak session] in
            guard let self, let session else { return }
            do {
                try await session.start()
                try Task.checkCancellation()
                self.status = .streaming(fps: 0)
                self.setIdleTimerDisabled(true)
                var previousFrameTime: ContinuousClock.Instant?
                let clock = ContinuousClock()

                while !Task.isCancelled {
                    let data = try await session.nextFrame()
                    try Task.checkCancellation()
                    guard let image = UIImage(data: data) else {
                        throw MonitorViewModelError.invalidImage
                    }
                    self.latestImage = image

                    let now = clock.now
                    if let previousFrameTime {
                        let duration = previousFrameTime.duration(to: now)
                        let seconds = Double(duration.components.seconds)
                            + Double(duration.components.attoseconds) / 1e18
                        if seconds > 0 {
                            self.status = .streaming(fps: 1 / seconds)
                        }
                    }
                    previousFrameTime = now
                }
            } catch is CancellationError {
                return
            } catch {
                self.log.record("Live view failed error=\(error.localizedDescription)")
                self.status = .failed("实时取景失败。请导出诊断日志后重试")
                self.setIdleTimerDisabled(false)
                await session.stop()
                if self.activeSession === session {
                    self.activeSession = nil
                }
            }
        }
    }

    private func handleRemoval(id: String) async {
        guard currentConnection?.id == id else { return }
        log.record("Active camera removed id=\(id)")
        await stopCurrentSession(finalStatus: .disconnected)
        currentConnection = nil
    }

    private func stopCurrentSession(finalStatus: MonitorStatus?) async {
        let task = frameTask
        let session = activeSession
        if task != nil || session != nil {
            status = .stopping
        }
        frameTask = nil
        activeSession = nil
        task?.cancel()
        if let session {
            await session.stop()
        }
        await task?.value
        setIdleTimerDisabled(false)
        if let finalStatus {
            status = finalStatus
            latestImage = nil
        }
    }
}

private enum MonitorViewModelError: Error {
    case invalidImage
}
