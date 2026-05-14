import AppKit
import SwiftUI

struct ContentView: View {
    @StateObject private var model: WebViewModel
    @State private var coordinator: ControlPlaneWebView.Coordinator?

    init(config: AppConfig) {
        _model = StateObject(wrappedValue: WebViewModel(config: config))
    }

    var body: some View {
        ZStack(alignment: .top) {
            ControlPlaneWebView(model: model)
                .background(Color(nsColor: .windowBackgroundColor))
                .onAppear {
                    model.loadHome()
                }

            VStack(spacing: 12) {
                headerBar

                if case let .failed(message) = model.phase {
                    failureCard(message: message)
                }
            }
            .padding(16)
        }
        .toolbar {
            ToolbarItemGroup {
                Button("Home") {
                    model.loadHome()
                }

                Button("Reload") {
                    model.loadHome()
                }
            }
        }
    }

    private var headerBar: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Codex Remote")
                    .font(.system(size: 20, weight: .semibold))
                Text(model.config.hostLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            phaseBadge
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    @ViewBuilder
    private var phaseBadge: some View {
        switch model.phase {
        case .loading:
            badge("Loading", color: .blue)
        case .ready:
            badge("Ready", color: .green)
        case .failed:
            badge("Offline", color: .red)
        }
    }

    private func failureCard(message: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Codex Remote is not reachable")
                .font(.system(size: 16, weight: .semibold))
            Text("Start the local server, then reload this desktop shell.")
                .foregroundStyle(.secondary)
            Text(message)
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(.secondary)
            HStack {
                Button("Open Default URL") {
                    model.loadHome()
                }
                Button("Copy URL") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.config.baseURL.absoluteString, forType: .string)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: 480, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.08), radius: 22, y: 14)
    }

    private func badge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }
}
