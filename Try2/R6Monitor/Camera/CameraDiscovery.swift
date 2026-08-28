import Combine
import Foundation
import ImageCaptureCore

@MainActor
final class CameraDiscovery: NSObject, ObservableObject {
    enum Authorization: Equatable {
        case notRequested
        case authorized
        case denied
    }

    @Published private(set) var authorization: Authorization = .notRequested
    var onSupportedCamera: ((ICCameraDevice) -> Void)?
    var onUnsupportedCamera: ((String) -> Void)?
    var onCameraRemoved: ((String) -> Void)?

    private let browser = ICDeviceBrowser()
    private let log: DiagnosticLog

    init(log: DiagnosticLog) {
        self.log = log
        super.init()
        browser.delegate = self
        browser.browsedDeviceTypeMask = ICDeviceTypeMask(rawValue: 0x0000_0101)!
    }

    func start() {
#if targetEnvironment(simulator)
        authorization = .denied
        log.record("Camera discovery is unavailable in the iOS Simulator")
        return
#else
        browser.requestControlAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                if status == .authorized {
                    self.authorization = .authorized
                    self.log.record("Camera control authorization granted")
                    self.browser.start()
                } else {
                    self.authorization = .denied
                    self.log.record("Camera control authorization denied status=\(status)")
                }
            }
        }
#endif
    }

    func stop() {
        browser.stop()
    }

    private func isOriginalR6(_ device: ICCameraDevice) -> Bool {
        let name = (device.name ?? "").uppercased()
        let excluded = ["MARK II", "MARK III", "R6M2", "R6M3"]
        return device.usbVendorID == CanonEOS.usbVendorID
            && name.contains("EOS R6")
            && !excluded.contains(where: name.contains)
    }
}

extension CameraDiscovery: @preconcurrency ICDeviceBrowserDelegate {
    func deviceBrowser(
        _ browser: ICDeviceBrowser,
        didAdd device: ICDevice,
        moreComing: Bool
    ) {
        guard let camera = device as? ICCameraDevice else { return }
        let name = camera.name ?? "Unknown Camera"
        log.record(
            String(
                format: "Camera added name=%@ vendor=0x%04X product=0x%04X",
                name,
                camera.usbVendorID,
                camera.usbProductID
            )
        )
        if isOriginalR6(camera) {
            onSupportedCamera?(camera)
        } else {
            onUnsupportedCamera?(name)
        }
    }

    func deviceBrowser(
        _ browser: ICDeviceBrowser,
        didRemove device: ICDevice,
        moreGoing: Bool
    ) {
        let name = device.name ?? "Unknown Camera"
        log.record("Camera removed name=\(name)")
        onCameraRemoved?(device.uuidString ?? name)
    }
}
