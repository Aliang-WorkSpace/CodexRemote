import Foundation

enum MonitorStatus: Equatable {
    case disconnected

    var message: String {
        switch self {
        case .disconnected:
            return "打开佳能 R6，并用 USB-C 数据线连接"
        }
    }
}
