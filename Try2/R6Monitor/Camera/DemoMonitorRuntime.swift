#if DEBUG
import Foundation
import UIKit

@MainActor
final class DemoMonitorRuntime: MonitorRuntime {
    var onConnection: ((CameraConnection) -> Void)?
    var onUnsupportedCamera: ((String) -> Void)?
    var onRemoval: ((String) -> Void)?

    private let log: DiagnosticLog
    private var connectionTask: Task<Void, Never>?

    init(log: DiagnosticLog) {
        self.log = log
    }

    func start() {
        guard connectionTask == nil else { return }
        log.record("Demo monitor runtime started")
        connectionTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard let self, !Task.isCancelled else { return }
            self.onConnection?(
                CameraConnection(id: "demo-r6", name: "Canon EOS R6 · 演示") {
                    DemoLiveViewSession()
                }
            )
        }
    }

    func stop() {
        connectionTask?.cancel()
        connectionTask = nil
    }
}

@MainActor
final class DemoLiveViewSession: LiveViewSession {
    private var isRunning = false
    private var frameIndex = 0

    func start() async throws {
        isRunning = true
    }

    func nextFrame() async throws -> Data {
        guard isRunning else { throw CancellationError() }
        try await Task.sleep(nanoseconds: 80_000_000)
        try Task.checkCancellation()
        frameIndex += 1
        return Self.renderFrame(frameIndex: frameIndex)
    }

    func stop() async {
        isRunning = false
    }

    private static func renderFrame(frameIndex: Int) -> Data {
        let size = CGSize(width: 1_280, height: 720)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
            let colors = [
                UIColor(red: 0.05, green: 0.12, blue: 0.17, alpha: 1).cgColor,
                UIColor(red: 0.16, green: 0.34, blue: 0.32, alpha: 1).cgColor,
            ] as CFArray
            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: colors,
                locations: [0, 1]
            )!
            context.cgContext.drawLinearGradient(
                gradient,
                start: .zero,
                end: CGPoint(x: size.width, y: size.height),
                options: []
            )

            let horizon = CGRect(x: 0, y: 430, width: size.width, height: 290)
            UIColor(red: 0.04, green: 0.08, blue: 0.07, alpha: 0.86).setFill()
            context.fill(horizon)

            let title = "DEMO PREVIEW"
            let subtitle = "Canon EOS R6 · USB-C LIVE VIEW"
            title.draw(
                at: CGPoint(x: 64, y: 58),
                withAttributes: [
                    .font: UIFont.monospacedSystemFont(ofSize: 28, weight: .bold),
                    .foregroundColor: UIColor.white,
                ]
            )
            subtitle.draw(
                at: CGPoint(x: 64, y: 104),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 22, weight: .medium),
                    .foregroundColor: UIColor.white.withAlphaComponent(0.78),
                ]
            )

            let frameText = String(format: "FRAME %05d", frameIndex)
            frameText.draw(
                at: CGPoint(x: 64, y: 638),
                withAttributes: [
                    .font: UIFont.monospacedDigitSystemFont(ofSize: 20, weight: .semibold),
                    .foregroundColor: UIColor.white.withAlphaComponent(0.72),
                ]
            )
        }
        return image.jpegData(compressionQuality: 0.85) ?? Data()
    }
}
#endif
