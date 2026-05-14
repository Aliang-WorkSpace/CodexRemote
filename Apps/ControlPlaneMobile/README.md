# Codex Remote iPhone App

`Codex Remote` 是当前项目的 iPhone 副控端。

它只关注 3 件事：

- 恢复已信任的 Mac
- 接入附近或可达的 Mac
- 查看总览、进入会话并继续控制

## 当前结构

- App 入口：
  - `Apps/ControlPlaneMobile/ControlPlaneMobileApp.swift`
- 状态层：
  - `Apps/ControlPlaneMobile/State/MobileAppState.swift`
  - `Apps/ControlPlaneMobile/State/BonjourRelayDiscovery.swift`
- 页面：
  - `Apps/ControlPlaneMobile/Views/PairingView.swift`
  - `Apps/ControlPlaneMobile/Views/DashboardView.swift`
  - `Apps/ControlPlaneMobile/Views/SessionDetailView.swift`

共享协议与客户端核心在：

- `Sources/ControlPlaneMobileCore`

## 当前连接方式

优先级如下：

1. 恢复已信任设备
2. 接入自动发现到的附近 Mac
3. 从剪贴板快速导入
4. 手动输入地址
5. 手动输入一次性配对码

## Xcode 工程

- `Apps/ControlPlaneMobile/ControlPlaneMobile.xcodeproj`

## 常用命令

打开工程：

```bash
npm run ios:open
```

构建工程：

```bash
npm run ios:build
```

运行 Swift 测试：

```bash
swift test
```
