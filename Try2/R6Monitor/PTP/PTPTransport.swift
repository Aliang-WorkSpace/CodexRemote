import Foundation

struct PTPExchange: Equatable {
    let response: PTPResponse
    let data: Data
}

@MainActor
protocol PTPTransport: AnyObject {
    func open() async throws
    func send(_ command: PTPCommand, outData: Data?) async throws -> PTPExchange
    func close() async
}
