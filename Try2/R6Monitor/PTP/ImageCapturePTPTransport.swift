import Foundation
import ImageCaptureCore

enum ImageCaptureTransportError: Error {
    case missingPTPResponse
}

@MainActor
final class ImageCapturePTPTransport: PTPTransport {
    private enum Timeout {
        static let open: UInt64 = 10_000_000_000
        static let send: UInt64 = 8_000_000_000
        static let close: UInt64 = 3_000_000_000
    }

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

        let _: Void = try await CallbackAwaiter.value(
            operation: "Open camera session",
            timeoutNanoseconds: Timeout.open
        ) {
            completion in
            device.requestOpenSession(options: nil) { error in
                if let error {
                    completion(.failure(error))
                } else {
                    completion(.success(()))
                }
            }
        }
        log.record("ImageCapture session opened")
    }

    func send(_ command: PTPCommand, outData: Data?) async throws -> PTPExchange {
        let result: (Data, Data) = try await CallbackAwaiter.value(
            operation: String(format: "PTP command 0x%04X", command.operationCode),
            timeoutNanoseconds: Timeout.send
        ) { completion in
            device.requestSendPTPCommand(command.encoded(), outData: outData) {
                inData,
                ptpResponseData,
                error in
                if let error {
                    completion(.failure(error))
                } else {
                    completion(.success((inData, ptpResponseData)))
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
        do {
            let _: Void = try await CallbackAwaiter.value(
                operation: "Close camera session",
                timeoutNanoseconds: Timeout.close
            ) { completion in
                device.requestCloseSession(options: nil) { error in
                    if let error {
                        completion(.failure(error))
                    } else {
                        completion(.success(()))
                    }
                }
            }
            log.record("ImageCapture session closed")
        } catch {
            log.record("ImageCapture session close failed error=\(error.localizedDescription)")
        }
    }
}
