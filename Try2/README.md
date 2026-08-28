# R6 Monitor

用一根 USB-C 数据线，把 USB-C iPhone 变成原代 Canon EOS R6 的有线监视器。

> 当前状态：**实验性，等待原代 EOS R6 真机验证。** 工程、协议编码、EVF 解析、会话清理和界面均已实现并通过自动化测试，但维护者尚未拿到目标相机的首轮诊断日志。请先按[真机测试清单](docs/hardware-test-checklist.md)逐步验证。

## 功能范围

- iPhone 通过 ImageCaptureCore 发现 USB 相机；
- 使用最少量 Canon EOS PTP 指令开启实时取景；
- 解析相机返回的 EVF JPEG 并全屏显示；
- 显示即时帧率，串流期间保持屏幕常亮；
- 拔线、相机关机或 App 进入后台时停止会话并尽力关闭 EVF；
- 导出不含画面内容的诊断日志，方便远程排错。

第一版不提供拍照、录像、音频、对焦、参数控制、波形、LUT 或 Wi-Fi 连接，也不声称支持 R6 Mark II、R6 Mark III 或其他相机。

## 硬件与软件

- 原代 Canon EOS R6；
- 带 USB-C 接口的 iPhone；
- 支持数据传输的 USB-C to USB-C 线，而不是仅充电线；
- iOS 17 或更高版本；
- 一台能运行 Xcode 16 或更高版本的 Mac；本仓库当前使用 Xcode 26.5 验证；
- 任意 Apple ID。只在自己的手机上测试时可以使用免费的 Personal Team。

## 免费安装到 iPhone

1. 克隆或下载这个仓库，在 Mac 上打开 `Try2/R6Monitor.xcodeproj`。
2. 用 USB 线把 iPhone 接到 Mac，在 iPhone 上选择信任，并按 Xcode 提示开启“开发者模式”。
3. 在 Xcode 左侧选择蓝色的 `R6Monitor` 工程，再选择 `R6Monitor` target 的 **Signing & Capabilities**。
4. 勾选 **Automatically manage signing**，Team 选择自己的 Personal Team。
5. 把 Bundle Identifier 从 `app.r6monitor.wired` 改成只属于自己的值，例如 `com.yourname.r6monitor`。
6. Xcode 顶部运行设备选择自己的 iPhone，按 `⌘R` 安装。
7. 首次启动时允许 App 控制外接相机。

免费的 Personal Team 不需要付费，但签名是临时的，需要定期重新连接 Xcode 构建。具体限制以 [Apple Developer Account 帮助](https://developer.apple.com/help/account/basics/about-your-developer-account/)为准。

你的朋友可以把仓库交给他 Mac 上的 AI，让 AI 检查 Xcode、选择他自己的 Team 和 Bundle Identifier，再在他的手机上构建。Apple ID、证书和签名只保留在他的 Mac 上，不需要发给仓库维护者。

## 使用

1. 相机切到拍照模式，退出相机菜单并保持开机。
2. 如果相机正在使用 Wi-Fi、蓝牙遥控或 EOS Utility，先结束对应连接。
3. 在 iPhone 上打开 R6 Monitor。
4. 用数据线直接连接 R6 和 iPhone；不要经过 Mac 或扩展坞。
5. 允许系统的外接相机控制请求。App 识别到原代 R6 后会自动尝试启动监看。
6. 如果失败，点左下角“诊断”，把文本日志分享给维护者；日志不包含 JPEG 画面。

不要在首次测试时反复自动重试。请按[真机测试清单](docs/hardware-test-checklist.md)记录每一阶段的结果。

## 本地验证

先启动一个可用的 iOS 模拟器，然后运行：

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17' test

xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

模拟器无法访问 USB 相机，因此只验证协议、解析器、状态机、日志和界面。真正的 ImageCaptureCore USB 路径必须在 iPhone 上测试。

## 技术结构

```text
ICDeviceBrowser
    ↓ 发现原代 EOS R6
ImageCapturePTPTransport
    ↓ 原始 PTP 请求/响应
CanonEOSSession
    ↓ Remote Mode → Event Mode → EVF Mode → EVF Output
CanonEVFParser
    ↓ 从 Canon 数据块提取 JPEG
MonitorViewModel / SwiftUI
```

佳能私有操作码集中在 `R6Monitor/Canon/CanonEOSProtocol.swift`。项目不包含 Canon SDK、固件、保密文档或第三方 GPL 源代码。相关研究来源和许可证见 [NOTICE.md](NOTICE.md)。

## 已知限制

- 原代 R6 的实际固件响应仍待真机日志验证；初始化顺序可能需要根据固件补充事件轮询或能力降级。
- iOS 模拟器没有实现外接相机控制授权，App 会在模拟器中安全跳过发现流程。
- 实时取景的帧率、延迟、温度和耗电尚未经过目标硬件测量。
- App 不保存画面，也不保证色彩准确性。
- 该项目与 Canon Inc. 无隶属、授权或背书关系。

## 许可证

本项目使用 [MIT License](LICENSE)。
