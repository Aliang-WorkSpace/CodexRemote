import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

struct PairingView: View {
    let appState: MobileAppState

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var isManualAddressExpanded = false
    @State private var isPairingCodeExpanded = false

    private var baseURLBinding: Binding<String> {
        Binding(
            get: { appState.baseURLText },
            set: { appState.baseURLText = $0 }
        )
    }

    private var pairingCodeBinding: Binding<String> {
        Binding(
            get: { appState.pairingCode },
            set: { appState.pairingCode = $0 }
        )
    }

    var body: some View {
        GeometryReader { proxy in
            let isWideLayout = horizontalSizeClass == .regular && proxy.size.width >= 900

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    heroCard
                    firstRunGuideCard
                    recommendedConnectCard

                    if isWideLayout {
                        LazyVGrid(
                            columns: [
                                GridItem(.flexible(minimum: 280, maximum: 560), spacing: 16, alignment: .top),
                                GridItem(.flexible(minimum: 280, maximum: 560), spacing: 16, alignment: .top),
                            ],
                            alignment: .leading,
                            spacing: 16
                        ) {
                            reviewModeCard

                            if appState.hasTrustedDevice {
                                trustedDeviceCard
                            }

                            discoveryCard
                            quickConnectCard
                            manualAddressCard
                            pairingCodeCard
                        }
                    } else {
                        reviewModeCard

                        if appState.hasTrustedDevice {
                            trustedDeviceCard
                        }

                        discoveryCard
                        quickConnectCard
                        manualAddressCard
                        pairingCodeCard
                    }

                    if appState.isRestoring {
                        loadingCard(
                            title: "正在恢复上次连接",
                            subtitle: "iPhone 正在尝试重新连回这台 Mac，成功后会自动回到上次工作。"
                        )
                    } else if let error = appState.errorMessage {
                        statusCard(
                            title: "暂时连不上这台 Mac",
                            subtitle: "\(error)\n请确认 Mac 上的控制台已经启动，并且手机和 Mac 在同一个网络。",
                            tone: .red
                        )
                    }
                }
                .frame(maxWidth: isWideLayout ? 1120 : 720)
                .padding(.horizontal, isWideLayout ? 28 : 20)
                .padding(.vertical, 20)
            }
            .frame(maxWidth: .infinity)
            .background(screenBackground.ignoresSafeArea())
        }
        .navigationTitle("连接主控 Mac")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    appState.presentHelp()
                } label: {
                    Label("使用帮助", systemImage: "questionmark.circle")
                }
            }
        }
        .task {
            appState.refreshClipboardSuggestion()
        }
    }

    private var screenBackground: some View {
        ZStack {
            Color(.systemGroupedBackground)
            LinearGradient(
                colors: [
                    Color(red: 0.90, green: 0.95, blue: 1.0).opacity(0.55),
                    Color.clear,
                    Color(red: 0.91, green: 0.98, blue: 0.97).opacity(0.42)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("连接你的主控 Mac")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Text("优先自动发现附近的 Mac，其次直接扫电脑上的二维码，最后再手动输入地址或配对码。接入一次后，这台 iPhone 会记住它。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.82))

            Label(appState.connectionStepSummary, systemImage: "iphone.gen3.radiowaves.left.and.right")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.white.opacity(0.14), in: Capsule())
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.21, blue: 0.53),
                    Color(red: 0.16, green: 0.37, blue: 0.85),
                    Color(red: 0.11, green: 0.56, blue: 0.74)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(.white.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: Color(red: 0.08, green: 0.21, blue: 0.53).opacity(0.18), radius: 24, y: 14)
    }

    @ViewBuilder
    private var firstRunGuideCard: some View {
        cardContainer(title: "首次连接只要 3 步", trailing: "新手引导") {
            VStack(alignment: .leading, spacing: 12) {
                onboardingStep(
                    index: 1,
                    title: "先在 Mac 上启动 Codex Remote",
                    copy: "iPhone 连的不是 Codex 进程本身，而是 Mac 上的本地控制台服务。"
                )
                onboardingStep(
                    index: 2,
                    title: "确认 iPhone 和 Mac 在同一个 Wi‑Fi",
                    copy: "当前版本主要走局域网直连。同一网络下，自动发现和直接接入最稳定。"
                )
                onboardingStep(
                    index: 3,
                    title: "回到这里点击“直接接入这台 Mac”",
                    copy: "优先选择已信任设备或附近 Mac。手动输入时请填写 Mac 的局域网地址，不要使用 127.0.0.1。"
                )
            }
        }
    }

    @ViewBuilder
    private var recommendedConnectCard: some View {
        cardContainer(title: "推荐接入方式", trailing: appState.isConnected ? "已接通" : "主路径") {
            VStack(alignment: .leading, spacing: 12) {
                Text(appState.recommendedConnectionTitle)
                    .font(.headline)

                Text(appState.recommendedConnectionSubtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button(appState.recommendedConnectionButtonTitle) {
                    Task { await appState.performRecommendedConnection() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.controller.isLoading || appState.isConnected)
            }
        }
    }

    @ViewBuilder
    private func onboardingStep(index: Int, title: String, copy: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(index)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(
                    LinearGradient(
                        colors: [Color.blue, Color.teal],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))

                Text(copy)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private var reviewModeCard: some View {
        cardContainer(title: "审核演示模式", trailing: "App Review 友好") {
            VStack(alignment: .leading, spacing: 10) {
                Text("没有配套 Mac 时，也可以先进入一套只读演示数据，直接查看首页总览、焦点任务、待处理队列和会话详情。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Button("查看演示模式") {
                    appState.enterReviewMode()
                }
                .buttonStyle(.bordered)
                .disabled(appState.controller.isLoading)
            }
        }
    }

    @ViewBuilder
    private var trustedDeviceCard: some View {
        cardContainer(title: "已信任设备", trailing: "自动恢复优先") {
            VStack(alignment: .leading, spacing: 10) {
                Text(appState.trustedDeviceName)
                    .font(.headline)
                if let address = appState.trustedDeviceAddress {
                    Text(address)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
                Text("后续回到前台时，iPhone 会优先恢复这台 Mac，不需要你每次重新输入地址。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    Button("恢复连接") {
                        Task { await appState.retryLastDeviceConnection() }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("忘记这台设备") {
                        appState.disconnect()
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }

    @ViewBuilder
    private var discoveryCard: some View {
        cardContainer(title: "自动发现", trailing: appState.isDiscoveringRelays ? "扫描中" : "\(appState.discoveredRelays.count) 台") {
            VStack(alignment: .leading, spacing: 12) {
                if appState.isDiscoveringRelays {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("正在寻找同一局域网内的 Mac")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if appState.discoveredRelays.isEmpty {
                    Text("还没有发现可接入的 Mac。请确认 iPhone 和 Mac 在同一 Wi‑Fi，或者直接扫电脑页面上的二维码。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(appState.discoveredRelays) { relay in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(relay.name)
                                        .font(.headline)
                                    Text(relay.baseURL)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("附近 Mac")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.teal)
                            }

                            HStack(spacing: 10) {
                                Button("立即接入") {
                                    Task { await appState.connectToDiscoveredRelay(relay) }
                                }
                                .buttonStyle(.borderedProminent)

                                Button("填入地址") {
                                    appState.useDiscoveredRelay(relay)
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding(14)
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var quickConnectCard: some View {
        cardContainer(title: "快速接入", trailing: "推荐") {
            VStack(alignment: .leading, spacing: 10) {
                Text("如果你刚扫了二维码，或者已经从 Mac 复制了连接链接、地址、配对码，直接从剪贴板导入就行。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if let hint = appState.clipboardConnectionHint {
                    Text(hint)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.teal)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.teal.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                #if canImport(UIKit)
                Button("从剪贴板快速接入") {
                    guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
                        return
                    }

                    Task {
                        await appState.connectUsingInput(text)
                    }
                }
                .buttonStyle(.borderedProminent)
                #endif

                Text("支持三种内容：`controlplane://pair?...` 链接、Mac 的局域网地址、一次性配对码。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var manualAddressCard: some View {
        DisclosureGroup(isExpanded: $isManualAddressExpanded) {
            VStack(alignment: .leading, spacing: 12) {
                TextField("手机访问地址", text: baseURLBinding)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)

                #if canImport(UIKit)
                Button("从剪贴板粘贴地址") {
                    if let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
                        appState.baseURLText = text
                    }
                }
                .buttonStyle(.bordered)
                #endif

                Button("直接接入这台 Mac") {
                    Task { await appState.connectDirect() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(appState.controller.isLoading)

                Text("例如 `http://192.168.x.x:8793`。只有在自动发现和二维码都不可用时，再使用这个入口。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 12)
        } label: {
            sectionLabel(
                title: "手动输入地址",
                subtitle: "高级选项"
            )
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var pairingCodeCard: some View {
        DisclosureGroup(isExpanded: $isPairingCodeExpanded) {
            VStack(alignment: .leading, spacing: 12) {
                TextEditor(text: pairingCodeBinding)
                    .frame(minHeight: 140)
                    .padding(8)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                #if canImport(UIKit)
                Button("从剪贴板粘贴配对码") {
                    if let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
                        appState.pairingCode = text
                    }
                }
                .buttonStyle(.bordered)
                #endif

                Button("使用配对码连接") {
                    Task { await appState.connectWithPairingCode() }
                }
                .buttonStyle(.bordered)
                .disabled(appState.controller.isLoading)
            }
            .padding(.top, 12)
        } label: {
            sectionLabel(
                title: "一次性配对码",
                subtitle: "扫码失败时再用"
            )
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    @ViewBuilder
    private func cardContainer<Content: View>(title: String, trailing: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline.weight(.semibold))
                Spacer()
                if let trailing {
                    Text(trailing)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.62), in: Capsule())
                }
            }
            content()
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color.white.opacity(0.58), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.04), radius: 18, y: 10)
    }

    @ViewBuilder
    private func statusCard(title: String, subtitle: String, tone: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundStyle(tone)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(tone.opacity(0.12), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func loadingCard(title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            ProgressView()
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color.white.opacity(0.58), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func sectionLabel(title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
