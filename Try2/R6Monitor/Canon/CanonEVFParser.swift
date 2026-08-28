import Foundation

enum CanonEVFParserError: Error, Equatable {
    case payloadTooLarge(Int)
    case invalidBlockLength(Int)
    case blockExceedsPayload(offset: Int, length: Int, payloadCount: Int)
    case jpegNotFound
}

enum CanonEVFParser {
    static let maximumPayloadBytes = 32 * 1024 * 1024
    private static let jpegBlockTypes: Set<UInt32> = [1, 9, 11]

    static func extractJPEG(from data: Data) throws -> Data {
        guard data.count <= maximumPayloadBytes else {
            throw CanonEVFParserError.payloadTooLarge(data.count)
        }

        var offset = 0
        while offset + 8 <= data.count {
            let length = Int(data.littleEndianUInt32(at: offset))
            let type = data.littleEndianUInt32(at: offset + 4)

            guard length >= 8 else {
                throw CanonEVFParserError.invalidBlockLength(length)
            }

            guard length <= data.count - offset else {
                if jpegBlockTypes.contains(type) {
                    throw CanonEVFParserError.blockExceedsPayload(
                        offset: offset,
                        length: length,
                        payloadCount: data.count
                    )
                }
                break
            }

            if jpegBlockTypes.contains(type) {
                let payload = data.subdata(in: (offset + 8)..<(offset + length))
                if let jpeg = jpegRange(in: payload) {
                    return payload.subdata(in: jpeg)
                }
            }

            offset += length
        }

        if let jpeg = jpegRange(in: data) {
            return data.subdata(in: jpeg)
        }
        throw CanonEVFParserError.jpegNotFound
    }

    private static func jpegRange(in data: Data) -> Range<Int>? {
        guard data.count >= 4 else { return nil }

        var start: Int?
        var index = 0
        while index + 1 < data.count {
            let first = data[index]
            let second = data[index + 1]
            if start == nil, first == 0xFF, second == 0xD8 {
                start = index
                index += 2
                continue
            }
            if let start, first == 0xFF, second == 0xD9 {
                return start..<(index + 2)
            }
            index += 1
        }
        return nil
    }
}
