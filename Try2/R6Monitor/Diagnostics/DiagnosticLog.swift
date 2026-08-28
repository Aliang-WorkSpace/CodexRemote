import Combine
import Foundation
import UIKit

@MainActor
final class DiagnosticLog: ObservableObject {
    private let maxEntries: Int
    private let now: () -> Date
    private let environment: String
    private let formatter: ISO8601DateFormatter
    @Published private(set) var entries: [String] = []

    init(
        maxEntries: Int = 1_000,
        now: @escaping () -> Date = Date.init,
        environment: String? = nil
    ) {
        self.maxEntries = max(1, maxEntries)
        self.now = now
        self.environment = environment ?? Self.defaultEnvironment
        formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
    }

    func record(_ message: String) {
        let sanitized = Self.sanitize(message)
        entries.append("\(formatter.string(from: now())) \(sanitized)")
        if entries.count > maxEntries {
            entries.removeFirst(entries.count - maxEntries)
        }
    }

    func recordPTP(operation: UInt16, response: UInt16?, dataCount: Int) {
        let responseText = response.map { String(format: "0x%04X", $0) } ?? "none"
        record(
            String(
                format: "PTP op=0x%04X response=%@ bytes=%d",
                operation,
                responseText,
                dataCount
            )
        )
    }

    var textReport: String {
        ([
            "R6 Monitor diagnostics",
            environment,
            "Experimental Canon USB/PTP implementation; JPEG payloads are not logged.",
            "---",
        ] + entries).joined(separator: "\n")
    }

    private static func sanitize(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\r\n", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\t", with: " ")
    }

    private static var defaultEnvironment: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            ?? "unknown"
        return "app=\(version) os=\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"
    }
}
