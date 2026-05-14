import Foundation

struct DiscoveredRelay: Identifiable, Equatable {
    let id: String
    let name: String
    let hostName: String
    let port: Int
    let baseURL: String
}

@MainActor
final class BonjourRelayDiscovery: NSObject {
    private let browser = NetServiceBrowser()
    private var services: [NetService] = []

    var onUpdate: (([DiscoveredRelay], Bool) -> Void)?
    private(set) var relays: [DiscoveredRelay] = []
    private(set) var isBrowsing = false

    override init() {
        super.init()
        browser.delegate = self
    }

    func start() {
        guard !isBrowsing else {
            return
        }

        relays = []
        services = []
        isBrowsing = true
        onUpdate?(relays, isBrowsing)
        browser.searchForServices(ofType: "_codexctl._tcp.", inDomain: "local.")
    }

    func stop() {
        guard isBrowsing else {
            return
        }

        browser.stop()
        services.removeAll()
        isBrowsing = false
        onUpdate?(relays, isBrowsing)
    }
}

extension BonjourRelayDiscovery: NetServiceBrowserDelegate {
    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        service.delegate = self
        services.append(service)
        service.resolve(withTimeout: 5)

        if !moreComing {
            onUpdate?(relays, isBrowsing)
        }
    }

    func netServiceBrowserDidStopSearch(_ browser: NetServiceBrowser) {
        isBrowsing = false
        onUpdate?(relays, isBrowsing)
    }
}

extension BonjourRelayDiscovery: NetServiceDelegate {
    func netServiceDidResolveAddress(_ sender: NetService) {
        guard let hostName = sender.hostName?.trimmingCharacters(in: CharacterSet(charactersIn: ".")),
              sender.port > 0 else {
            return
        }

        let relay = DiscoveredRelay(
            id: "\(sender.name)-\(hostName)-\(sender.port)",
            name: sender.name,
            hostName: hostName,
            port: sender.port,
            baseURL: "http://\(hostName):\(sender.port)"
        )

        if !relays.contains(where: { $0.id == relay.id }) {
            relays.append(relay)
            relays.sort { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
            onUpdate?(relays, isBrowsing)
        }
    }
}
