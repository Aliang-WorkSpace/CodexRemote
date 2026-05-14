# Codex Remote for Mac 安装与启动说明

`Codex Remote` 由两部分组成：

- `Mac 主控端`
- `iPhone / iPad 副控端`

移动端 App 不能单独工作。第一次使用前，需要先在 Mac 上准备好主控端。

## 新用户第一次使用的最小步骤

1. 在 Mac 上安装 `Codex Remote`
2. 启动 `Codex Remote`，并确认本地控制台服务已经运行
3. 让 Mac 和 iPhone / iPad 保持在同一个 Wi‑Fi
4. 回到手机端，点击“直接接入这台 Mac”

## 如果 Mac 端未来上架 Mac App Store

建议引导文案直接写成：

1. 在 Mac 上打开 `App Store`
2. 搜索 `Codex Remote`
3. 下载并打开
4. 首次启动后保持主控端运行
5. 回到 iPhone / iPad 完成连接

## 如果 Mac 端暂时还没上架 Mac App Store

建议移动端里的引导不要假装“已经可以下载”，而要明确告诉用户：

- 目前需要先在 Mac 上安装桌面主控端
- 安装后再回到手机连接
- 手机端不能替代 Mac 主控端本身

## 连接成功后，用户可以做什么

- 查看这台 Mac 的总览状态
- 查看运行中任务
- 接管等待输入的会话
- 重试失败任务
- 查看最近命令和事件轨迹

## 常见误区

- `127.0.0.1` 不能填在 iPhone / iPad 里
  - 这个地址只代表手机自己，不代表你的 Mac
- 只在同一局域网，不代表一定能连
  - Mac 主控端也必须先启动
- 手机端不是独立运行 Codex
  - 真实执行上下文仍然在 Mac 上
