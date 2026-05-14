import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProcessOverviewView,
  buildConnectionStatusView,
  buildLocalControlStatusView,
  buildMissionControlView,
  buildSessionTakeoverListView,
  buildTaskLaneView,
  buildWorkbenchView
} from "../src/client/codex-remote-view-models.js";

test("buildMissionControlView prioritizes waiting sessions and exposes command-aware copy", () => {
  const view = buildMissionControlView({
    dashboard: {
      sessions: [
        {
          id: "session_idle",
          title: "Idle session",
          status: "idle",
          runStatus: "completed",
          updatedAt: "2026-04-02T08:00:00.000Z"
        },
        {
          id: "session_waiting",
          title: "Need follow-up",
          status: "active",
          runStatus: "waitingForInput",
          cwd: "/tmp/project",
          model: "gpt-5.4",
          updatedAt: "2026-04-02T08:05:00.000Z"
        }
      ]
    },
    selectedSession: null,
    composerState: {
      lastCommand: {
        id: "cmd_1",
        status: "completed",
        kind: "sendPrompt"
      }
    }
  });

  assert.equal(view.meta, "自动聚焦");
  assert.equal(view.focus.title, "Need follow-up");
  assert.equal(view.focus.status, "waitingForInput");
  assert.match(view.focus.copy, /继续发送下一条提示词/);
  assert.equal(view.focus.chips.includes("命令 已完成"), true);
});

test("buildTaskLaneView surfaces only live sessions in priority order", () => {
  const lane = buildTaskLaneView({
    sessions: [
      {
        id: "recent_idle",
        title: "Recent idle",
        status: "idle",
        updatedAt: "2026-04-02T08:00:00.000Z"
      },
      {
        id: "running_one",
        title: "Running one",
        status: "active",
        runStatus: "running",
        model: "gpt-5.4",
        updatedAt: "2026-04-02T08:05:00.000Z"
      },
      {
        id: "waiting_one",
        title: "Waiting one",
        status: "active",
        runStatus: "waitingForInput",
        updatedAt: "2026-04-02T08:06:00.000Z"
      },
      {
        id: "failed_one",
        title: "Failed one",
        status: "failed",
        runStatus: "failed",
        updatedAt: "2026-04-02T08:04:00.000Z"
      }
    ]
  });

  assert.equal(lane.meta, "3 个任务");
  assert.deepEqual(
    lane.items.map((item) => item.id),
    ["waiting_one", "running_one", "failed_one"]
  );
  assert.match(lane.items[0].summary, /等待下一条提示词/);
});

test("buildSessionTakeoverListView sorts sessions by takeover priority and exposes next actions", () => {
  const view = buildSessionTakeoverListView({
    sessions: [
      {
        id: "idle_one",
        title: "Idle session",
        status: "idle",
        model: "gpt-5.4",
        updatedAt: "2026-04-02T08:00:00.000Z"
      },
      {
        id: "failed_one",
        title: "Failed session",
        status: "failed",
        runStatus: "failed",
        model: "gpt-5.4-mini",
        cwd: "/tmp/failed",
        updatedAt: "2026-04-02T08:04:00.000Z"
      },
      {
        id: "waiting_one",
        title: "Waiting session",
        status: "active",
        runStatus: "waitingForInput",
        model: "gpt-5.4",
        cwd: "/tmp/waiting",
        updatedAt: "2026-04-02T08:06:00.000Z"
      }
    ]
  });

  assert.equal(view.meta, "按接管优先级排序");
  assert.deepEqual(
    view.items.map((item) => item.id),
    ["waiting_one", "failed_one", "idle_one"]
  );
  assert.equal(view.items[0].nextAction, "继续输入");
  assert.equal(view.items[0].emphasis, "urgent");
  assert.equal(view.items[1].emphasis, "warning");
  assert.equal(view.items[2].emphasis, "idle");
  assert.match(view.items[1].summary, /失败/);
});

test("buildSessionTakeoverListView formats unix-second timestamps as recent relative time", () => {
  const now = Date.UTC(2026, 3, 30, 4, 0, 0);
  const updatedAtSeconds = Math.floor((now - 2 * 60 * 1000) / 1000);
  const view = buildSessionTakeoverListView({
    now,
    sessions: [
      {
        id: "waiting_one",
        title: "Waiting session",
        status: "active",
        runStatus: "waitingForInput",
        model: "gpt-5.4",
        cwd: "/tmp/waiting",
        updatedAt: updatedAtSeconds
      }
    ]
  });

  assert.match(view.items[0].meta, /更新于2分钟前/);
});

test("buildProcessOverviewView summarizes local process pressure before phone connectivity", () => {
  const view = buildProcessOverviewView({
    dashboard: {
      stats: {
        sessionCount: 8,
        activeRunCount: 2,
        automationCount: 3,
        commandCount: 14
      },
      quota: {
        primary: {
          usedPercent: 28,
          remainingPercent: 72,
          windowMinutes: 300,
          resetsAt: "2026-04-02T09:00:00.000Z"
        }
      },
      sessions: [
        {
          id: "waiting_one",
          title: "Need human input",
          status: "active",
          runStatus: "waitingForInput",
          updatedAt: "2026-04-02T08:06:00.000Z"
        },
        {
          id: "failed_one",
          title: "Recover failed run",
          status: "failed",
          runStatus: "failed",
          updatedAt: "2026-04-02T08:04:00.000Z"
        },
        {
          id: "running_one",
          title: "Running now",
          status: "active",
          runStatus: "running",
          updatedAt: "2026-04-02T08:05:00.000Z"
        }
      ]
    }
  });

  assert.equal(view.title, "本机 Codex 进程总览");
  assert.match(view.summary, /2 个运行中/);
  assert.match(view.summary, /1 个等待接管/);
  assert.match(view.summary, /1 个异常/);
  assert.deepEqual(view.chips, ["运行中 2", "待接管 1", "异常 1", "自动化 3", "额度剩余 72%"]);
  assert.equal(view.quotaSummary.cardLabel, "额度剩余");
  assert.equal(view.quotaSummary.cardValue, 72);
  assert.match(view.quotaSummary.summary, /5小时/);
  assert.match(view.quotaSummary.summary, /剩余 72%/);
  assert.equal(view.primaryMetric.label, "待接管");
  assert.equal(view.primaryMetric.value, 1);
  assert.match(view.primaryMetric.copy, /等待你马上接手/);
  assert.deepEqual(
    view.statCards.map((item) => [item.label, item.value, item.tone]),
    [
      ["会话数", 8, "neutral"],
      ["运行中任务", 2, "active"],
      ["待接管", 1, "urgent"],
      ["异常", 1, "warning"],
      ["自动化", 3, "success"],
      ["命令数", 14, "neutral"],
      ["额度剩余", 72, "success"]
    ]
  );
  assert.deepEqual(view.secondaryMetrics, [
    { label: "运行中", value: 2 },
    { label: "异常", value: 1 },
    { label: "自动化", value: 3 },
    { label: "额度剩余", value: 72 }
  ]);
});

test("buildProcessOverviewView exposes a cockpit header summary and last sync hint", () => {
  const view = buildProcessOverviewView({
    dashboard: {
      workspace: {
        id: "local-mac",
        name: "Local Mac"
      },
      device: {
        workspaceName: "Local Mac"
      },
      stats: {
        sessionCount: 123,
        activeRunCount: 2,
        automationCount: 1,
        commandCount: 8
      },
      sessions: [
        {
          id: "waiting_one",
          title: "AI早报飞书群推送",
          status: "active",
          runStatus: "waitingForInput",
          updatedAt: "2026-04-02T08:06:00.000Z"
        },
        {
          id: "running_one",
          title: "我想做一个 APP，希望可以同步管理你的所有进程",
          status: "active",
          runStatus: "running",
          updatedAt: "2026-04-02T08:05:00.000Z"
        }
      ]
    }
  });

  assert.equal(view.headerTitle, "Local Mac");
  assert.match(view.headerSubtitle, /123 个会话/);
  assert.match(view.headerSubtitle, /2 个运行中/);
  assert.match(view.headerSubtitle, /1 个待接管/);
  assert.equal(view.healthLabel, "待接管优先");
});

test("buildProcessOverviewView falls back to failures when nothing is waiting for takeover", () => {
  const view = buildProcessOverviewView({
    dashboard: {
      stats: {
        activeRunCount: 1,
        automationCount: 2
      },
      sessions: [
        {
          id: "failed_one",
          title: "Broken run",
          status: "failed",
          runStatus: "failed",
          updatedAt: "2026-04-02T08:04:00.000Z"
        },
        {
          id: "running_one",
          title: "Still running",
          status: "active",
          runStatus: "running",
          updatedAt: "2026-04-02T08:05:00.000Z"
        }
      ]
    }
  });

  assert.equal(view.primaryMetric.label, "异常");
  assert.equal(view.primaryMetric.value, 1);
  assert.match(view.primaryMetric.copy, /建议先看事件轨迹/);
});

test("buildProcessOverviewView falls back to running work when the board is healthy", () => {
  const view = buildProcessOverviewView({
    dashboard: {
      stats: {
        activeRunCount: 2,
        automationCount: 1
      },
      sessions: [
        {
          id: "running_one",
          title: "Still running",
          status: "active",
          runStatus: "running",
          updatedAt: "2026-04-02T08:05:00.000Z"
        }
      ]
    }
  });

  assert.equal(view.primaryMetric.label, "运行中");
  assert.equal(view.primaryMetric.value, 2);
  assert.match(view.primaryMetric.copy, /正在这台 Mac 上推进/);
});

test("buildLocalControlStatusView treats an available local relay as ready instead of disconnected", () => {
  const view = buildLocalControlStatusView({
    pairingState: {
      publicPairing: {
        pairingStatus: "direct-bootstrap-available"
      }
    },
    dashboard: null,
    sync: null,
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.title, "本机已就绪");
  assert.equal(view.tone, "ready");
  assert.match(view.detail, /当前 Mac 控制面已经可用/);
});

test("buildLocalControlStatusView treats loaded dashboard data as actively managed", () => {
  const view = buildLocalControlStatusView({
    pairingState: {
      client: {}
    },
    dashboard: {
      workspace: {
        name: "Codex 工作区"
      },
      stats: {
        activeRunCount: 3
      }
    },
    sync: {
      lastSucceededAt: "2026-04-02T08:06:00.000Z"
    },
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.title, "正在主控");
  assert.equal(view.tone, "active");
  assert.match(view.detail, /3 个运行中/);
});

test("buildLocalControlStatusView surfaces relay probe errors instead of staying in preparing state", () => {
  const view = buildLocalControlStatusView({
    pairingState: null,
    dashboard: null,
    sync: null,
    relayProbeState: "error",
    relayProbeError: "无法读取 /pairing",
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.title, "检测失败");
  assert.equal(view.tone, "warning");
  assert.match(view.detail, /无法读取 \/pairing/);
});

test("buildLocalControlStatusView shows probing state while relay discovery is running", () => {
  const view = buildLocalControlStatusView({
    pairingState: null,
    dashboard: null,
    sync: null,
    relayProbeState: "probing",
    relayProbeError: null,
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.title, "正在检测");
  assert.equal(view.tone, "pending");
  assert.match(view.detail, /检测这台 Mac 的本机控制面/);
});

test("buildWorkbenchView derives a four-step state rail from command status", () => {
  const view = buildWorkbenchView({
    detail: {
      session: {
        id: "session_1",
        title: "Build the app"
      },
      run: {
        status: "running"
      },
      recentCommands: [
        {
          id: "cmd_2",
          kind: "sendPrompt",
          status: "running"
        }
      ]
    },
    commandState: {
      isSubmitting: false,
      lastCommand: {
        id: "cmd_2",
        kind: "sendPrompt",
        status: "running"
      }
    }
  });

  assert.equal(view.status, "执行中");
  assert.match(view.summary, /继续更新/);
  assert.equal(view.primaryAction.label, "查看最新进度");
  assert.equal(view.primaryAction.tone, "active");
  assert.match(view.currentBlocker, /当前不需要人工输入/);
  assert.deepEqual(
    view.steps.map((step) => step.state),
    ["done", "done", "active", "pending"]
  );
});

test("buildWorkbenchView surfaces blockers and retry actions for failed sessions", () => {
  const view = buildWorkbenchView({
    detail: {
      session: {
        id: "session_failed",
        title: "Recover the failed run",
        status: "failed"
      },
      run: {
        status: "failed"
      },
      recentCommands: [
        {
          id: "cmd_3",
          kind: "retryRun",
          status: "failed"
        }
      ]
    },
    commandState: {
      isSubmitting: false,
      lastCommand: {
        id: "cmd_3",
        kind: "retryRun",
        status: "failed"
      }
    }
  });

  assert.equal(view.status, "失败");
  assert.equal(view.primaryAction.label, "检查并重试");
  assert.equal(view.primaryAction.tone, "warning");
  assert.match(view.currentBlocker, /上一条命令失败/);
});

test("buildConnectionStatusView prefers paired relay address and workspace identity", () => {
  const view = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {
      bundle: {
        transport: {
          baseUrl: "http://127.0.0.1:8794"
        }
      }
    },
    dashboard: {
      device: {
        workspaceName: "本机 Mac"
      },
      workspace: {
        name: "Codex 工作区"
      }
    },
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.status, "手机副控已接入");
  assert.equal(view.address, "http://127.0.0.1:8794");
  assert.equal(view.device, "本机 Mac");
  assert.match(view.summary, /手机副控已接入/);
});

test("buildConnectionStatusView reports offline and restoring states", () => {
  const restoring = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {},
    dashboard: null,
    isOnline: true,
    isRestoring: true
  });

  const offline = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {},
    dashboard: null,
    isOnline: false,
    isRestoring: false
  });

  assert.equal(restoring.status, "恢复中");
  assert.match(restoring.summary, /恢复/);
  assert.equal(offline.status, "离线");
  assert.match(offline.summary, /离线/);
});

test("buildConnectionStatusView prefers the phone access address before pairing", () => {
  const view = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {
      publicPairing: {
        pairingStatus: "manual-bootstrap-required",
        transport: {
          publicBaseUrl: "http://192.168.1.8:8793",
          localBaseUrl: "http://127.0.0.1:8793",
          phoneAccessUrl: "http://192.168.1.8:8793",
          isLocalOnly: false
        }
      }
    },
    dashboard: null,
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.status, "手机副控待接入");
  assert.equal(view.address, "http://192.168.1.8:8793");
  assert.equal(view.addressLabel, "手机访问地址");
  assert.match(view.summary, /手机作为副控/);
  assert.equal(view.helperTitle, "如需手机副控");
  assert.deepEqual(view.steps, [
    "确保 iPhone 和 Mac 在同一 Wi‑Fi 下",
    "在手机上打开这个地址或扫描配对二维码",
    "连接成功后，手机会作为当前 Mac 的辅助控制端"
  ]);
});

test("buildConnectionStatusView explains when the current address is Mac-only", () => {
  const view = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {
      publicPairing: {
        pairingStatus: "direct-bootstrap-available",
        transport: {
          publicBaseUrl: "http://127.0.0.1:8793",
          localBaseUrl: "http://127.0.0.1:8793",
          phoneAccessUrl: null,
          isLocalOnly: true
        }
      }
    },
    dashboard: null,
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.address, "http://127.0.0.1:8793");
  assert.equal(view.addressLabel, "当前仅本机可用");
  assert.match(view.summary, /这台 Mac/);
  assert.equal(view.localAddress, "http://127.0.0.1:8793");
  assert.equal(view.helperTitle, "如需手机副控");
  assert.deepEqual(view.steps, [
    "先继续在这台 Mac 上管理会话和进程",
    "如果要让手机接入，需要让中继提供局域网地址",
    "拿到手机访问地址后，再在手机上打开"
  ]);
});

test("buildConnectionStatusView exposes a compact helper summary for collapsed management", () => {
  const view = buildConnectionStatusView({
    origin: "http://127.0.0.1:8793",
    pairingState: {
      publicPairing: {
        pairingStatus: "manual-bootstrap-required",
        transport: {
          publicBaseUrl: "http://192.168.1.8:8793",
          localBaseUrl: "http://127.0.0.1:8793",
          phoneAccessUrl: "http://192.168.1.8:8793",
          isLocalOnly: false
        }
      }
    },
    dashboard: null,
    isOnline: true,
    isRestoring: false
  });

  assert.equal(view.compactTitle, "手机副控待接入");
  assert.match(view.compactSummary, /192\.168\.1\.8:8793/);
});
