import Foundation
import ImageCaptureCore

enum ImageCaptureTransportError: Error {
    case missingPTPResponse
}

@MainActor
final class ImageCapturePTPTransport: PTPTransport {
    let device: ICCameraDevice
    private let log: DiagnosticLog

    init(device: ICCameraDevice, log: DiagnosticLog) {
        self.device = device
        self.log = log
    }

    func open() async throws {
        if device.hasOpenSession {
            log.record("ImageCapture session already open")
            return
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            device.requestOpenSession(options: nil) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
        log.record("ImageCapture session opened")
    }

    func send(_ command: PTPCommand, outData: Data?) async throws -> PTPExchange {
        let result = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<(Data, Data), Error>) in
            device.requestSendPTPCommand(command.encoded(), outData: outData) {
                inData,
                ptpResponseData,
                error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (inData, ptpResponseData))
                }
            }
        }

        guard !result.1.isEmpty else {
            throw ImageCaptureTransportError.missingPTPResponse
        }
        let response = try PTPResponse(data: result.1)
        log.recordPTP(
            operation: command.operationCode,
            response: response.responseCode,
            dataCount: result.0.count
        )
        return PTPExchange(response: response, data: result.0)
    }

    func close() async {
        guard device.hasOpenSession else { return }
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            device.requestCloseSession(options: nil) { _ in
                continuation.resume()
            }
        }
        log.record("ImageCapture session closed")
    }
}
