import Foundation

enum PTPContainerError: Error, Equatable {
    case tooShort
    case invalidLength(declared: Int, actual: Int)
    case unexpectedType(UInt16)
}

struct PTPCommand: Equatable {
    let operationCode: UInt16
    let transactionID: UInt32
    var parameters: [UInt32] = []

    func encoded() -> Data {
        precondition(parameters.count <= 5, "PTP commands support at most five parameters")

        var data = Data()
        data.appendLittleEndian(UInt32(12 + parameters.count * 4))
        data.appendLittleEndian(UInt16(1))
        data.appendLittleEndian(operationCode)
        data.appendLittleEndian(transactionID)
        for parameter in parameters {
            data.appendLittleEndian(parameter)
        }
        return data
    }
}

struct PTPResponse: Equatable {
    static let successCode: UInt16 = 0x2001

    let responseCode: UInt16
    let transactionID: UInt32

    var isSuccess: Bool { responseCode == Self.successCode }

    init(data: Data) throws {
        guard data.count >= 12 else {
            throw PTPContainerError.tooShort
        }

        let declaredLength = Int(data.littleEndianUInt32(at: 0))
        guard declaredLength == data.count else {
            throw PTPContainerError.invalidLength(declared: declaredLength, actual: data.count)
        }

        let containerType = data.littleEndianUInt16(at: 4)
        guard containerType == 3 else {
            throw PTPContainerError.unexpectedType(containerType)
        }

        responseCode = data.littleEndianUInt16(at: 6)
        transactionID = data.littleEndianUInt32(at: 8)
    }
}

extension Data {
    mutating func appendLittleEndian(_ value: UInt16) {
        append(UInt8(truncatingIfNeeded: value))
        append(UInt8(truncatingIfNeeded: value >> 8))
    }

    mutating func appendLittleEndian(_ value: UInt32) {
        append(UInt8(truncatingIfNeeded: value))
        append(UInt8(truncatingIfNeeded: value >> 8))
        append(UInt8(truncatingIfNeeded: value >> 16))
        append(UInt8(truncatingIfNeeded: value >> 24))
    }

    func littleEndianUInt16(at offset: Int) -> UInt16 {
        UInt16(self[offset]) | (UInt16(self[offset + 1]) << 8)
    }

    func littleEndianUInt32(at offset: Int) -> UInt32 {
        UInt32(self[offset])
            | (UInt32(self[offset + 1]) << 8)
            | (UInt32(self[offset + 2]) << 16)
            | (UInt32(self[offset + 3]) << 24)
    }
}
