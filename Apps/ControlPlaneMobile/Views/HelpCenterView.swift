import SwiftUI

struct HelpCenterView: View {
    let appState: MobileAppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    heroCard
                    connectionQuickStartCard
                    quickStartCard
                    dashboardGuideCard
                    sessionGuideCard
                    statusGuideCard
                    privacyCard
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("使用帮助")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        appState.dismissHelp()
                    }
                }
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("欢迎使用 Codex Remote")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Text("这是一台随身副控台：Mac 是主控端，iPhone 负责查看总览、接管等待输入的会话、重试失败任务，以及在离开工位时继续推进工作。")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.84))

            Label("先连接主控 Mac，再看总览、焦点和待处理队列。", systemImage: "iphone.gen3.radiowaves.left.and.right")
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
    }

    private var connectionQuickStartCard: some View {
        helpCard(title: "最小连接步骤", systemImage: "point.3.connected.trianglepath.dotted") {
            helpStep("第 1 步：先在 Mac 上启动 Codex Remote", "Mac 端需要先把本地控制台服务跑起来，iPhone 才有可连接的主控目标。")
            helpStep("第 2 步：确认 iPhone 和 Mac 在同一个 Wi-Fi", "当前版本主要走局域网直连；如果不在同一网络，先不要急着连。")
            helpStep("第 3 步：在 iPhone 上点击“直接接入这台 Mac”", "优先使用已发现的附近 Mac 或已信任设备；手动输入时请填写 Mac 的局域网地址。")
        }
    }

    private var quickStartCard: some View {
        helpCard(title: "3 分钟上手", systemImage: "sparkles") {
            helpStep("1. 先连接", "优先恢复已信任设备，其次接入附近 Mac，再用剪贴板、二维码或手动地址兜底。")
            helpStep("2. 看总览", "首页先看待接管、运行中、异常和自动化，再决定先处理哪个会话。")
            helpStep("3. 进会话", "点开会话后，可以继续发送提示词、重试失败任务，或者停止当前运行。")
        }
    }

    private var dashboardGuideCard: some View {
        helpCard(title: "首页怎么看", systemImage: "rectangle.3.group.bubble") {
            helpStep("总览 Hero", "看这台 Mac 当前有多少运行中、多少待接管、有没有异常。")
            helpStep("任务焦点", "系统会自动把最值得优先处理的会话放在最前面。")
            helpStep("待处理队列", "这里适合快速判断下一步先接哪一个，不需要一条条翻完整列表。")
        }
    }

    private var sessionGuideCard: some View {
        helpCard(title: "会话怎么接管", systemImage: "terminal") {
            helpStep("继续输入", "当会话显示“等待输入”时，直接进入详情继续发送下一条提示词。")
            helpStep("查看回执", "先看最近命令和事件时间线，判断当前是执行中、失败还是已完成。")
            helpStep("快捷动作", "需要恢复时优先用“继续运行”或“重试运行”，必要时再停止。")
        }
    }

    private var statusGuideCard: some View {
        helpCard(title: "常见状态说明", systemImage: "trafficlight") {
            helpStep("等待输入", "当前最适合人工接管，通常优先级最高。")
            helpStep("执行中 / 排队中", "说明 Mac 还在跑，适合先观察，不一定要立即干预。")
            helpStep("异常", "建议先看最近回执和事件，再决定是重试还是回到 Mac 端继续处理。")
        }
    }

    private var privacyCard: some View {
        helpCard(title: "隐私与连接", systemImage: "lock.shield") {
            helpStep("主控在 Mac", "Codex 进程、工作区和执行上下文都保留在 Mac 上，iPhone 只是副控端。")
            helpStep("当前连接方式", "现在主要是局域网/可信设备恢复，后续再升级到更稳的远程连接层。")
            helpStep("首次失败别着急", "先确认 Mac 控制台服务已启动，再检查 iPhone 和 Mac 是否在同一网络，并确认填写的是 Mac 的局域网地址。")
        }
    }

    @ViewBuilder
    private func helpCard<Content: View>(title: String, systemImage: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content()
        }
        .padding(18)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    @ViewBuilder
    private func helpStep(_ title: String, _ copy: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(copy)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
