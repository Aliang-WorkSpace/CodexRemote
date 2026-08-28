import XCTest
@testable import R6Monitor

@MainActor
final class CanonEOSSessionTests: XCTestCase {
    func testStartsInRequiredOrderAndFetchesOneJPEGFrame() async throws {
        let transport = ScriptedPTPTransport()
        let jpeg = Data([0xFF, 0xD8, 0x44, 0xFF, 0xD9])
        transport.dataByOperation[CanonEOS.Operation.getViewFinderData.rawValue] = block(
            type: 11,
            payload: jpeg
        )
        let session = CanonEOSSession(transport: transport)

        try await session.start()
        let frame = try await session.nextFrame()

        XCTAssertEqual(frame, jpeg)
        XCTAssertEqual(
            transport.operations,
            [0x9114, 0x9115, 0x9110, 0x9110, 0x9153]
        )
        XCTAssertEqual(transport.transactionIDs, [1, 2, 3, 4, 5])
        XCTAssertEqual(session.state, .streaming)
    }

    func testStartupFailureDoesNotSendLaterInitializationCommands() async {
        let transport = ScriptedPTPTransport(responseCodes: [0x2001, 0x2019])
        let session = CanonEOSSession(transport: transport)

        do {
            try await session.start()
            XCTFail("Expected camera response failure")
        } catch {
            XCTAssertEqual(error as? CanonEOSSessionError, .cameraResponse(operation: 0x9115, code: 0x2019))
        }

        XCTAssertEqual(transport.operations, [0x9114, 0x9115])
        XCTAssertEqual(transport.closeCount, 1)
        XCTAssertEqual(session.state, .failed("相机拒绝了命令 0x9115（响应 0x2019）"))
    }

    func testStopDisablesOutputThenModeAndClosesTransport() async throws {
        let transport = ScriptedPTPTransport()
        let session = CanonEOSSession(transport: transport)
        try await session.start()

        await session.stop()

        XCTAssertEqual(transport.operations.suffix(2), [0x9110, 0x9110])
        XCTAssertEqual(
            transport.outboundData.suffix(2),
            [
                CanonEOS.extendedPropertyPayload(property: .evfOutputDevice, value: 0),
                CanonEOS.extendedPropertyPayload(property: .evfMode, value: 0),
            ]
        )
        XCTAssertEqual(transport.closeCount, 1)
        XCTAssertEqual(session.state, .idle)
    }

    func testRepeatedStartAndStopAreIdempotent() async throws {
        let transport = ScriptedPTPTransport()
        let session = CanonEOSSession(transport: transport)

        try await session.start()
        try await session.start()
        XCTAssertEqual(transport.openCount, 1)
        XCTAssertEqual(transport.operations.count, 4)

        await session.stop()
        await session.stop()
        XCTAssertEqual(transport.closeCount, 1)
        XCTAssertEqual(transport.operations.count, 6)
    }

    func testFifthMalformedFrameMovesSessionToFailedState() async throws {
        let transport = ScriptedPTPTransport()
        transport.dataByOperation[CanonEOS.Operation.getViewFinderData.rawValue] = Data([0x01, 0x02])
        let session = CanonEOSSession(transport: transport)
        try await session.start()

        do {
            _ = try await session.nextFrame()
            XCTFail("Expected malformed frame limit failure")
        } catch {
            XCTAssertEqual(error as? CanonEVFParserError, .jpegNotFound)
        }

        XCTAssertEqual(
            transport.operations.filter { $0 == CanonEOS.Operation.getViewFinderData.rawValue }.count,
            5
        )
        XCTAssertEqual(session.state, .failed("连续 5 帧无法解析，实时取景已停止"))
    }

    func testMalformedFramesAreSkippedUntilAValidFrameArrives() async throws {
        let transport = ScriptedPTPTransport()
        let jpeg = Data([0xFF, 0xD8, 0x42, 0xFF, 0xD9])
        transport.queuedDataByOperation[CanonEOS.Operation.getViewFinderData.rawValue] = [
            Data([0x01, 0x02]),
            block(type: 11, payload: jpeg),
        ]
        let session = CanonEOSSession(transport: transport)
        try await session.start()

        let frame = try await session.nextFrame()

        XCTAssertEqual(frame, jpeg)
        XCTAssertEqual(
            transport.operations.filter { $0 == CanonEOS.Operation.getViewFinderData.rawValue }.count,
            2
        )
        XCTAssertEqual(session.state, .streaming)
    }

    func testCameraResponseMessageAppliesToFrameCommandsToo() {
        let error = CanonEOSSessionError.cameraResponse(operation: 0x9153, code: 0x2019)

        XCTAssertEqual(error.userMessage, "相机拒绝了命令 0x9153（响应 0x2019）")
    }

    private func block(type: UInt32, payload: Data) -> Data {
        var data = Data()
        data.appendLittleEndian(UInt32(payload.count + 8))
        data.appendLittleEndian(type)
        data.append(payload)
        return data
    }
}

@MainActor
private final class ScriptedPTPTransport: PTPTransport {
    var responseCodes: [UInt16]
    var dataByOperation: [UInt16: Data] = [:]
    var queuedDataByOperation: [UInt16: [Data]] = [:]
    private(set) var openCount = 0
    private(set) var closeCount = 0
    private(set) var operations: [UInt16] = []
    private(set) var transactionIDs: [UInt32] = []
    private(set) var outboundData: [Data?] = []

    init(responseCodes: [UInt16] = []) {
        self.responseCodes = responseCodes
    }

    func open() async throws {
        openCount += 1
    }

    func send(_ command: PTPCommand, outData: Data?) async throws -> PTPExchange {
        operations.append(command.operationCode)
        transactionIDs.append(command.transactionID)
        outboundData.append(outData)
        let code = responseCodes.isEmpty ? PTPResponse.successCode : responseCodes.removeFirst()
        var ptpResponseData = Data()
        ptpResponseData.appendLittleEndian(UInt32(12))
        ptpResponseData.appendLittleEndian(UInt16(3))
        ptpResponseData.appendLittleEndian(code)
        ptpResponseData.appendLittleEndian(command.transactionID)
        let payloadData: Data
        if var queue = queuedDataByOperation[command.operationCode], !queue.isEmpty {
            payloadData = queue.removeFirst()
            queuedDataByOperation[command.operationCode] = queue
        } else {
            payloadData = dataByOperation[command.operationCode] ?? Data()
        }
        return PTPExchange(
            response: try PTPResponse(data: ptpResponseData),
            data: payloadData
        )
    }

    func close() async {
        closeCount += 1
    }
}
