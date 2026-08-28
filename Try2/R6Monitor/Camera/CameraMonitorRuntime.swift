import Foundation
import ImageCaptureCore

@MainActor
protocol LiveViewSession: AnyObject {
    func start() async throws
    func nextFrame() async throws -> Data
    func stop() async
}

extension CanonEOSSession: LiveViewSession {}

struct CameraConnection {
    let id: String
    let name: String
    let makeSession: @MainActor () -> any LiveViewSession
}

@MainActor
protocol MonitorRuntime: AnyObject {
    var onConnection: ((CameraConnection) -> Void)? { get set }
    var onUnsupportedCamera: ((String) -> Void)? { get set }
    var onRemoval: ((String) -> Void)? { get set }
    func start()
    func stop()
}

@MainActor
final class ImageCaptureMonitorRuntime: MonitorRuntime {
    var onConnection: ((CameraConnection) -> Void)?
    var onUnsupportedCamera: ((String) -> Void)?
    var onRemoval: ((String) -> Void)?

    private let discovery: CameraDiscovery
    private let log: DiagnosticLog

    init(log: DiagnosticLog) {
        self.log = log
        discovery = CameraDiscovery(log: log)
        discovery.onSupportedCamera = { [weak self] camera in
            guard let self else { return }
            let name = camera.name ?? "Canon EOS R6"
            let id = camera.uuidString ?? name
            self.onConnection?(
                CameraConnection(id: id, name: name) { [log] in
                    CanonEOSSession(
                        transport: ImageCapturePTPTransport(device: camera, log: log)
                    )
                }
            )
        }
        discovery.onUnsupportedCamera = { [weak self] name in
            self?.onUnsupportedCamera?(name)
        }
        discovery.onCameraRemoved = { [weak self] id in
            self?.onRemoval?(id)
        }
    }

    func start() {
        discovery.start()
    }

    func stop() {
        discovery.stop()
    }
}
