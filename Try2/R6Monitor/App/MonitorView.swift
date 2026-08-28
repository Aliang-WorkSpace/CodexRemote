import SwiftUI
import UIKit

struct MonitorView: View {
    @ObservedObject var viewModel: MonitorViewModel
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let image = viewModel.latestImage {
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.medium)
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                connectionPrompt
            }

            VStack(spacing: 0) {
                statusPill
                Spacer()
                controls
            }
            .padding()
        }
        .foregroundStyle(.white)
        .onAppear { viewModel.start() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await viewModel.applicationDidBecomeActive() }
            } else {
                Task { await viewModel.applicationDidEnterBackground() }
            }
        }
        .sheet(isPresented: $viewModel.isShowingDiagnostics) {
            ShareSheet(items: [viewModel.diagnosticReport])
                .presentationDetents([.medium, .large])
        }
    }

    private var connectionPrompt: some View {
        VStack(spacing: 18) {
            Image(systemName: "cable.connector")
                .font(.system(size: 50, weight: .light))
                .foregroundStyle(.white.opacity(0.75))
            Text(viewModel.status.message)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("请使用支持数据传输的 USB-C 线；相机保持开机并切到拍照模式。")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)
        }
        .padding(28)
    }

    private var statusPill: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(viewModel.status.isStreaming ? Color.green : Color.orange)
                .frame(width: 8, height: 8)
            Text(viewModel.status.message)
                .font(.caption.weight(.semibold))
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.black.opacity(0.68), in: Capsule())
    }

    private var controls: some View {
        HStack(spacing: 12) {
            Button {
                viewModel.isShowingDiagnostics = true
            } label: {
                Label("诊断", systemImage: "doc.text.magnifyingglass")
            }

            Spacer()

            if viewModel.status.isStreaming {
                Button(role: .destructive) {
                    Task { await viewModel.stop() }
                } label: {
                    Label("停止", systemImage: "stop.fill")
                }
            } else if case .failed = viewModel.status {
                retryButton
            } else if case .unsupported = viewModel.status {
                retryButton
            }
        }
        .font(.callout.weight(.semibold))
        .buttonStyle(.bordered)
        .tint(.white)
        .padding(12)
        .background(.black.opacity(0.68), in: RoundedRectangle(cornerRadius: 18))
    }

    private var retryButton: some View {
        Button {
            Task { await viewModel.retry() }
        } label: {
            Label("重试", systemImage: "arrow.clockwise")
        }
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
