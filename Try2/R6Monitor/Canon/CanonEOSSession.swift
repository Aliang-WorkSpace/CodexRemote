import Foundation

enum CanonEOSSessionError: Error, Equatable {
    case cameraResponse(operation: UInt16, code: UInt16)
    case transactionMismatch(expected: UInt32, actual: UInt32)
    case invalidState

    var userMessage: String {
        switch self {
        case let .cameraResponse(operation, code):
            return String(
                format: "相机拒绝了命令 0x%04X（响应 0x%04X）",
                operation,
                code
            )
        case .transactionMismatch:
            return "相机返回了不匹配的事务编号"
        case .invalidState:
            return "实时取景会话当前不可用"
        }
    }
}

@MainActor
final class CanonEOSSession {
    enum State: Equatable {
        case idle
        case opening
        case preparing(String)
        case streaming
        case stopping
        case failed(String)
    }

    private let transport: PTPTransport
    private var nextTransactionID: UInt32 = 1
    private var isOpen = false
    private var evfModeEnabled = false
    private var evfOutputEnabled = false
    private var malformedFrameCount = 0

    private(set) var state: State = .idle

    init(transport: PTPTransport) {
        self.transport = transport
    }

    func start() async throws {
        if state == .streaming { return }
        guard state == .idle else { throw CanonEOSSessionError.invalidState }

        state = .opening
        do {
            try await transport.open()
            isOpen = true

            state = .preparing("正在进入远程模式")
            try await sendSuccess(.setRemoteMode, parameters: [1])

            state = .preparing("正在启用相机事件")
            try await sendSuccess(.setEventMode, parameters: [1])

            state = .preparing("正在开启实时取景")
            try await setProperty(.evfMode, value: 1)
            evfModeEnabled = true

            try await setProperty(.evfOutputDevice, value: 2)
            evfOutputEnabled = true
            malformedFrameCount = 0
            state = .streaming
        } catch {
            await cleanupProtocolState()
            if isOpen {
                await transport.close()
                isOpen = false
            }
            let message = (error as? CanonEOSSessionError)?.userMessage
                ?? "无法启动实时取景：\(error.localizedDescription)"
            state = .failed(message)
            throw error
        }
    }

    func nextFrame() async throws -> Data {
        guard state == .streaming else { throw CanonEOSSessionError.invalidState }

        while malformedFrameCount < 5 {
            try Task.checkCancellation()
            let exchange = try await sendSuccess(.getViewFinderData)
            do {
                let jpeg = try CanonEVFParser.extractJPEG(from: exchange.data)
                malformedFrameCount = 0
                return jpeg
            } catch {
                malformedFrameCount += 1
                if malformedFrameCount >= 5 {
                    state = .failed("连续 5 帧无法解析，实时取景已停止")
                    throw error
                }
            }
        }

        throw CanonEOSSessionError.invalidState
    }

    func stop() async {
        if state == .idle || state == .stopping { return }
        state = .stopping
        await cleanupProtocolState()
        if isOpen {
            await transport.close()
            isOpen = false
        }
        malformedFrameCount = 0
        state = .idle
    }

    private func cleanupProtocolState() async {
        if evfOutputEnabled {
            try? await setProperty(.evfOutputDevice, value: 0)
            evfOutputEnabled = false
        }
        if evfModeEnabled {
            try? await setProperty(.evfMode, value: 0)
            evfModeEnabled = false
        }
    }

    @discardableResult
    private func sendSuccess(
        _ operation: CanonEOS.Operation,
        parameters: [UInt32] = [],
        outData: Data? = nil
    ) async throws -> PTPExchange {
        let transactionID = nextTransactionID
        nextTransactionID &+= 1
        let command = PTPCommand(
            operationCode: operation.rawValue,
            transactionID: transactionID,
            parameters: parameters
        )
        let exchange = try await transport.send(command, outData: outData)
        guard exchange.response.transactionID == transactionID else {
            throw CanonEOSSessionError.transactionMismatch(
                expected: transactionID,
                actual: exchange.response.transactionID
            )
        }
        guard exchange.response.isSuccess else {
            throw CanonEOSSessionError.cameraResponse(
                operation: operation.rawValue,
                code: exchange.response.responseCode
            )
        }
        return exchange
    }

    private func setProperty(_ property: CanonEOS.Property, value: UInt32) async throws {
        try await sendSuccess(
            .setDevicePropertyValueEx,
            outData: CanonEOS.extendedPropertyPayload(property: property, value: value)
        )
    }
}
