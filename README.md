# Codex Remote

`Codex Remote` 当前只保留一条主线：

- `Mac = 主控台`
- `iPhone / iPad = 副控端`
- `本地优先，局域网可用`

它的核心用途是：

- 在 Mac 上查看和接管本机 Codex 会话
- 在 iPhone / iPad 上查看总览、恢复连接、继续会话

## 当前能力

### Mac 主控台

- 本地读取 Codex 会话、运行状态、自动化、模板、额度和最近命令
- Web 控制台总览、任务焦点、待处理队列、接管列表、会话工作台
- 本地启动器自动拉起服务并打开控制台

### iPhone / iPad 副控端

- 原生 SwiftUI App
- 首次 onboarding、帮助页、演示模式
- 已信任设备恢复、附近 Mac 发现、二维码 / 地址 / 配对码接入
- 首页总览、任务焦点、待处理队列、会话列表
- 会话详情与基础控制

## 常用命令

运行 Node 测试：

```bash
npm test
```

运行 Swift 测试：

```bash
swift test
```

运行全部测试：

```bash
npm run test:all
```

启动本地服务：

```bash
npm run server:start
```

打包本地桌面使用包：

```bash
npm run app:package
```

打开 iPhone / iPad 工程：

```bash
npm run ios:open
```

构建 iPhone / iPad 工程：

```bash
npm run ios:build
```

## 本地入口

当前默认本地入口：

- [http://127.0.0.1:8793/app](http://127.0.0.1:8793/app)

打包后的本地启动器：

- `dist/Codex Remote.app`
- `dist/Launch Codex Remote.command`
- `dist/Stop Codex Remote.command`

说明：

- 启动器会优先复用一个已经可用的本地端口
- 默认首选 `8793`
- 如果该端口不可用，会自动切换到备用端口并打开正确地址

## 主要目录

服务端与本地控制面：

- `src/server`
- `src/agent`

Web 主控台：

- `public/app`
- `src/client`

iPhone / iPad App：

- `Apps/ControlPlaneMobile`
- `Sources/ControlPlaneMobileCore`

测试：

- Node 测试：`test`
- Swift 测试：`Tests`

归档 / 非主线目录：

- 历史设计与计划：`docs/superpowers`
- 临时实验区：`Try2`

## 主线接口

面向当前产品主线保留的接口：

- `GET /app`
- `GET /health`
- `GET /pairing`
- `GET /pairing/token`
- `GET /pairing/bootstrap`
- `GET /mobile/bootstrap`
- `GET /mobile/dashboard`
- `GET /mobile/sessions/:sessionId`
- `GET /commands`
- `POST /commands`
- `POST /pairing/rotate`

以下接口保留为开发 / 诊断能力，不作为主文档主路径：

- `GET /snapshot`
- `GET /events?runId=<thread-id>&limit=20`
- `GET /sync/status`
- `POST /sync/run`

## 当前边界

- 当前项目优先保证 `Mac 主控台` 和 `iPhone / iPad 副控端` 的本地自用体验
- 连接层仍以本地 / 局域网 / 私网可达为主
- 云端中继、公开托管和更多实验能力暂时不作为当前主线
- `dist` 是生成产物目录，不作为源码维护入口
