export function buildMissionControlView({
  dashboard,
  selectedSession = null,
  composerState = null,
  now = Date.now()
}) {
  const sessions = dashboard?.sessions ?? [];
  const focus = selectedSession ?? pickFocusSession(sessions, now);
  const lastCommand =
    composerState?.lastCommand ??
    dashboard?.recentCommands?.[0] ??
    null;

  if (!focus) {
    return {
      meta: "空闲",
      focus: null
    };
  }

  return {
    meta: selectedSession ? "当前选中" : "自动聚焦",
    focus: {
      id: focus.id,
      title: focus.title,
      status: focus.runStatus ?? focus.status ?? "idle",
      copy: buildMissionCopy(focus, lastCommand),
      chips: compact([
        translateCommandStatus(focus.runStatus ?? focus.status ?? "idle"),
        focus.model ?? null,
        focus.cwd ?? null,
        lastCommand?.status ? `命令 ${translateCommandStatus(lastCommand.status)}` : null
      ])
    }
  };
}

export function buildProcessOverviewView({
  dashboard,
  now = Date.now()
}) {
  const stats = dashboard?.stats ?? {};
  const quota = dashboard?.quota ?? null;
  const sessions = dashboard?.sessions ?? [];
  const attentionCount = sessions.filter((session) => (session.runStatus ?? session.status ?? "idle") === "waitingForInput").length;
  const failureCount = sessions.filter((session) => (session.runStatus ?? session.status ?? "idle") === "failed").length;
  const activeCount = Number(stats.activeRunCount ?? 0);
  const sessionCount = Number(stats.sessionCount ?? sessions.length ?? 0);
  const automationCount = Number(stats.automationCount ?? 0);
  const commandCount = Number(stats.commandCount ?? 0);
  const hottestSession = pickFocusSession(sessions, now);
  const primaryMetric = buildPrimaryProcessMetric({
    attentionCount,
    failureCount,
    activeCount,
    hottestSession
  });
  const headerTitle =
    dashboard?.workspace?.name ??
    dashboard?.device?.workspaceName ??
    "Local Mac";
  const healthLabel = buildProcessHealthLabel({
    attentionCount,
    failureCount,
    activeCount
  });
  const quotaSummary = buildQuotaSummary(quota, now);

  return {
    title: "本机 Codex 进程总览",
    headerTitle,
    headerSubtitle: compact([
      `${sessionCount} 个会话`,
      `${activeCount} 个运行中`,
      attentionCount > 0 ? `${attentionCount} 个待接管` : null,
      failureCount > 0 ? `${failureCount} 个异常` : null
    ]).join(" · "),
    healthLabel,
    summary: compact([
      activeCount > 0 ? `${activeCount} 个运行中` : "当前没有运行中的进程",
      attentionCount > 0 ? `${attentionCount} 个等待接管` : null,
      failureCount > 0 ? `${failureCount} 个异常` : null,
      hottestSession ? `优先关注 ${hottestSession.title}` : null
    ]).join("，"),
    chips: [
      `运行中 ${activeCount}`,
      `待接管 ${attentionCount}`,
      `异常 ${failureCount}`,
      `自动化 ${automationCount}`,
      quotaSummary?.chip ?? null
    ].filter(Boolean),
    quotaSummary,
    statCards: [
      { label: "会话数", value: sessionCount, tone: "neutral" },
      { label: "运行中任务", value: activeCount, tone: "active" },
      { label: "待接管", value: attentionCount, tone: "urgent" },
      { label: "异常", value: failureCount, tone: "warning" },
      { label: "自动化", value: automationCount, tone: "success" },
      { label: "命令数", value: commandCount, tone: "neutral" },
      ...(quotaSummary
        ? [
            {
              label: quotaSummary.cardLabel,
              value: quotaSummary.cardValue,
              tone: quotaSummary.cardTone
            }
          ]
        : [])
    ],
    primaryMetric,
    secondaryMetrics: [
      { label: "运行中", value: activeCount },
      { label: "异常", value: failureCount },
      { label: "自动化", value: automationCount },
      ...(quotaSummary ? [{ label: "额度剩余", value: quotaSummary.cardValue }] : [])
    ]
  };
}

export function buildLocalControlStatusView({
  pairingState = null,
  dashboard = null,
  sync = null,
  relayProbeState = "idle",
  relayProbeError = null,
  isOnline = true,
  isRestoring = false
}) {
  if (isRestoring) {
    return {
      title: "恢复中",
      tone: "pending",
      detail: "正在恢复上次的本机控制上下文。"
    };
  }

  if (!isOnline) {
    return {
      title: "离线缓存",
      tone: "warning",
      detail: "当前网络不可用，页面显示的是最近一次成功同步到本机的状态。"
    };
  }

  if (relayProbeState === "error") {
    return {
      title: "检测失败",
      tone: "warning",
      detail: relayProbeError
        ? `本机控制面检测失败：${relayProbeError}`
        : "本机控制面检测失败，请稍后重试。"
    };
  }

  if (relayProbeState === "probing") {
    return {
      title: "正在检测",
      tone: "pending",
      detail: "正在检测这台 Mac 的本机控制面和当前可用地址。"
    };
  }

  if (dashboard) {
    const activeCount = Number(dashboard.stats?.activeRunCount ?? 0);
    return {
      title: "正在主控",
      tone: "active",
      detail: activeCount > 0
        ? `${dashboard.workspace?.name ?? "当前工作区"} 正在由这台 Mac 主控，当前有 ${activeCount} 个运行中。`
        : `${dashboard.workspace?.name ?? "当前工作区"} 已载入，这台 Mac 正在作为主控制台工作。`
    };
  }

  if (pairingState?.bundle || pairingState?.publicPairing) {
    return {
      title: "本机已就绪",
      tone: "ready",
      detail: "当前 Mac 控制面已经可用，正在等待载入会话和进程状态。"
    };
  }

  if (sync?.lastSucceededAt) {
    return {
      title: "已同步",
      tone: "ready",
      detail: "最近一次本机同步已经完成，正在等待刷新当前控制面。"
    };
  }

  return {
    title: "准备中",
    tone: "idle",
    detail: "正在准备这台 Mac 的本机控制面。"
  };
}

export function buildConnectionStatusView({
  origin,
  pairingState = null,
  bootstrap = null,
  dashboard = null,
  isOnline = true,
  isRestoring = false
}) {
  const transport =
    pairingState?.bundle?.transport ??
    bootstrap?.transport ??
    pairingState?.publicPairing?.transport ??
    buildFallbackTransport(origin);
  const address = transport.phoneAccessUrl ?? transport.baseUrl ?? origin ?? "http://127.0.0.1";
  const device =
    dashboard?.device?.workspaceName ??
    dashboard?.workspace?.name ??
    "本地设备";
  const addressLabel = transport.phoneAccessUrl
    ? "手机访问地址"
    : transport.isLocalOnly
      ? "当前仅本机可用"
      : "当前访问地址";

  if (isRestoring) {
    return {
      status: "恢复中",
      compactTitle: "恢复中",
      compactSummary: "正在恢复上一次连接的设备",
      address,
      device,
      addressLabel,
      localAddress: transport.localBaseUrl ?? address,
      helperTitle: "正在恢复",
      steps: [
        "正在恢复上一次连接的设备",
        "恢复成功后会自动回到上次会话",
        "如果长时间没有反应，可以手动刷新"
      ],
      summary: "正在恢复上一次连接的设备和会话。"
    };
  }

  if (!isOnline) {
    return {
      status: "离线",
      compactTitle: "离线",
      compactSummary: "手机副控当前离线",
      address,
      device,
      addressLabel,
      localAddress: transport.localBaseUrl ?? address,
      helperTitle: "离线提示",
      steps: [
        "当前设备已经离线",
        "你看到的是最近一次成功获取到的状态",
        "恢复网络后页面会继续同步"
      ],
      summary: "当前设备离线，页面显示的是最近一次成功获取到的状态。"
    };
  }

  if (pairingState?.bundle || dashboard) {
    return {
      status: "手机副控已接入",
      compactTitle: "手机副控已接入",
      compactSummary: `${device} 已接入手机副控`,
      address,
      device,
      addressLabel,
      localAddress: transport.localBaseUrl ?? address,
      helperTitle: "如需手机副控",
      steps: [
        "当前主要在这台 Mac 上管理会话和进程",
        "离开桌面时，可以在手机上继续查看和下发命令",
        "需要重新配对或换手机时，再回到这里处理"
      ],
      summary: `${device} 的手机副控已接入。桌面端仍是主控制台，手机可在离开工位时继续跟进。`
    };
  }

  if (pairingState?.publicPairing?.pairingStatus === "direct-bootstrap-available") {
    return {
      status: transport.isLocalOnly ? "仅本机主控可用" : "手机副控可接入",
      compactTitle: transport.isLocalOnly ? "仅本机主控可用" : "手机副控可接入",
      compactSummary: transport.isLocalOnly ? "当前只有本机主控可用" : `副控地址 ${address}`,
      address,
      device,
      addressLabel,
      localAddress: transport.localBaseUrl ?? address,
      helperTitle: "如需手机副控",
      steps: transport.isLocalOnly
        ? [
            "先继续在这台 Mac 上管理会话和进程",
            "如果要让手机接入，需要让中继提供局域网地址",
            "拿到手机访问地址后，再在手机上打开"
          ]
        : [
            "确保 iPhone 和 Mac 在同一 Wi‑Fi 下",
            "在手机上打开这个地址或扫描配对二维码",
            "连接成功后，手机会作为当前 Mac 的辅助控制端"
          ],
      summary: transport.isLocalOnly
        ? "当前地址只在这台 Mac 上可用。桌面端已经是主控制台，手机接入是可选的附属能力。"
        : "当前中继已经可用。如需把手机作为副控端加入，现在可以在同一网络下接入。"
    };
  }

  if (pairingState?.publicPairing) {
    return {
      status: "手机副控待接入",
      compactTitle: "手机副控待接入",
      compactSummary: `副控地址 ${address}`,
      address,
      device,
      addressLabel,
      localAddress: transport.localBaseUrl ?? address,
      helperTitle: "如需手机副控",
      steps: transport.isLocalOnly
        ? [
            "先继续在这台 Mac 上管理会话和进程",
            "如果要让手机接入，需要让中继提供局域网地址",
            "拿到手机访问地址后，再在手机上打开"
          ]
        : [
            "确保 iPhone 和 Mac 在同一 Wi‑Fi 下",
            "在手机上打开这个地址或扫描配对二维码",
            "连接成功后，手机会作为当前 Mac 的辅助控制端"
          ],
      summary: transport.isLocalOnly
        ? "127.0.0.1 只会指向这台 Mac 自己。当前先以 Mac 端管理为主，如需手机副控，再提供局域网地址。"
        : "当前 Mac 已经可以被手机作为副控端接入。请在同一网络下打开地址或扫描配对二维码。"
    };
  }

  return {
    status: "本机主控准备中",
    compactTitle: "本机主控准备中",
    compactSummary: "先让这台 Mac 的主控制面准备好",
    address,
    device,
    addressLabel,
    localAddress: transport.localBaseUrl ?? address,
    helperTitle: "如需手机副控",
    steps: [
      "先加载本机控制面，确认当前 Mac 中继是否可用",
      "如果出现手机访问地址，就可以让 iPhone 作为副控端加入",
      "如果只有本机地址，先在这台 Mac 上继续操作"
    ],
    summary: "当前还没有发现可用的本机中继。先让这台 Mac 的主控制面准备好，手机接入可以稍后再做。"
  };
}

export function buildAttentionQueueView({ sessions = [], now = Date.now() }) {
  const items = [...sessions]
    .filter((session) => sessionPriority(session, now) > 0)
    .sort((left, right) => compareSessions(left, right, now))
    .slice(0, 4)
    .map((session) => ({
      id: session.id,
      title: session.title,
      status: session.runStatus ?? session.status ?? "idle",
      summary: buildSessionSummary(session)
    }));

  return {
    meta: `${items.length} 项`,
    items
  };
}

export function buildTaskLaneView({ sessions = [], now = Date.now() }) {
  const items = [...sessions]
    .filter((session) => isLiveTask(session))
    .sort((left, right) => compareSessions(left, right, now))
    .slice(0, 4)
    .map((session) => ({
      id: session.id,
      title: session.title,
      status: session.runStatus ?? session.status ?? "idle",
      summary: buildTaskLaneSummary(session)
    }));

  return {
    meta: `${items.length} 个任务`,
    items
  };
}

export function buildSessionTakeoverListView({ sessions = [], now = Date.now() }) {
  const items = [...sessions]
    .sort((left, right) => compareSessions(left, right, now))
    .map((session) => ({
      id: session.id,
      title: session.title,
      status: session.runStatus ?? session.status ?? "idle",
      summary: buildTakeoverSummary(session),
      nextAction: buildTakeoverAction(session),
      emphasis: buildTakeoverEmphasis(session),
      meta: compact([
        session.updatedAt ? `更新于${formatRelativeTime(session.updatedAt, now)}` : null,
        session.cwd ?? null,
        session.model ?? null
      ]).join(" · ")
    }));

  return {
    meta: "按接管优先级排序",
    items
  };
}

export function buildWorkbenchView({
  detail = null,
  commandState = null
}) {
  if (!detail) {
    return {
      status: "空闲",
      summary: "选择一个会话后，就可以从这里开始下发命令。",
      currentBlocker: "还没有选中会话，先从左侧接管列表里打开一个会话。",
      primaryAction: {
        label: "选择会话",
        tone: "idle"
      },
      steps: buildWorkbenchSteps("idle", null)
    };
  }

  const command = commandState?.lastCommand ?? detail.recentCommands?.[0] ?? null;
  const status = commandState?.isSubmitting
    ? "submitting"
    : command?.status ?? detail.run?.status ?? detail.session?.status ?? "idle";

  return {
    status: translateCommandStatus(status),
    summary: buildWorkbenchSummary(detail, commandState),
    currentBlocker: buildWorkbenchBlocker(detail, commandState),
    primaryAction: buildWorkbenchPrimaryAction(detail, commandState),
    steps: buildWorkbenchSteps(status, command)
  };
}

export function buildMissionCopy(session, command) {
  const status = session.runStatus ?? session.status ?? "idle";
  const commandPhrase = command?.status
    ? `最近一条命令当前是${translateCommandStatus(command.status)}。`
    : "还没有拿到最近命令的回执。";

  if (status === "waitingForInput") {
    return `${session.title} 当前已停在等待输入状态，随时可以继续发送下一条提示词。${commandPhrase}`;
  }

  if (status === "active" || status === "running") {
    return `${session.title} 正在本机中继上执行中。${commandPhrase}`;
  }

  if (status === "failed") {
    return `${session.title} 上一次运行失败了，需要你接手处理。${commandPhrase}`;
  }

  return `${session.title} 当前可被远程接管。${commandPhrase}`;
}

export function buildWorkbenchSummary(detail, commandState) {
  if (commandState?.isSubmitting) {
    return "中继已经接收这条请求，命令正在进入执行队列。";
  }

  const command = commandState?.lastCommand ?? detail.recentCommands?.[0] ?? null;
  const status = command?.status ?? detail.run?.status ?? detail.session?.status ?? "idle";

  switch (status) {
    case "queued":
      return "最近一条命令已经入队，保持当前会话打开就能继续观察后续执行。";
    case "running":
    case "active":
      return "中继正在处理这个会话，下面的事件流和命令列表会继续更新。";
    case "completed":
      return "上一条命令已经完成，你可以继续发送下一条提示词，或者先查看最新事件。";
    case "failed":
      return "上一条命令执行失败了，建议先看事件轨迹，再决定是否重试。";
    case "waitingForInput":
      return "这个会话正在等待你的下一条指令，输入框已经可以继续使用。";
    default:
      return "从这个工作台选择下一步操作，继续推进当前会话。";
  }
}

export function buildWorkbenchSteps(status, command) {
  const normalized = normalizeWorkbenchStatus(status);
  const steps = [
    {
      key: "compose",
      title: "准备",
      copy: command?.kind ? `上一条：${translateCommandKind(command.kind)}` : "准备下一条指令"
    },
    {
      key: "queued",
      title: "排队",
      copy: "中继已接收命令"
    },
    {
      key: "running",
      title: "执行中",
      copy: "Codex 正在 Mac 上运行"
    },
    {
      key: "completed",
      title: "结果",
      copy: normalized === "failed" ? "执行失败，请检查后重试" : "已完成，或已准备好进入下一步"
    }
  ];

  return steps.map((step) => ({
    ...step,
    state: workbenchStepState(step.key, normalized)
  }));
}

export function buildTaskLaneSummary(session) {
  return compact([
    taskLaneLabel(session.runStatus ?? session.status ?? "idle"),
    session.model ?? null,
    session.updatedAt ? `更新于${formatRelativeTime(session.updatedAt)}` : null
  ]).join(" · ");
}

export function buildSessionSummary(session) {
  return compact([
    session.cwd ?? null,
    session.model ?? null,
    session.updatedAt ? `更新于${formatRelativeTime(session.updatedAt)}` : null
  ]).join(" · ") || "暂无最近元数据";
}

function buildTakeoverSummary(session) {
  const status = session.runStatus ?? session.status ?? "idle";
  const prefix = {
    waitingForInput: "等待你接管",
    running: "正在执行",
    active: "正在执行",
    failed: "执行失败",
    queued: "排队中",
    idle: "空闲可继续"
  }[status] ?? "可继续";

  return compact([
    prefix,
    session.cwd ?? null,
    session.model ?? null
  ]).join(" · ");
}

function buildProcessHealthLabel({
  attentionCount,
  failureCount,
  activeCount
}) {
  if (attentionCount > 0) {
    return "待接管优先";
  }

  if (failureCount > 0) {
    return "异常待处理";
  }

  if (activeCount > 0) {
    return "运行中观察";
  }

  return "本机已就绪";
}

function buildTakeoverAction(session) {
  const status = session.runStatus ?? session.status ?? "idle";
  switch (status) {
    case "waitingForInput":
      return "继续输入";
    case "failed":
      return "检查并重试";
    case "running":
    case "active":
      return "查看进度";
    case "queued":
      return "观察队列";
    default:
      return "打开会话";
  }
}

function buildTakeoverEmphasis(session) {
  const status = session.runStatus ?? session.status ?? "idle";
  switch (status) {
    case "waitingForInput":
      return "urgent";
    case "failed":
      return "warning";
    case "running":
    case "active":
    case "queued":
      return "active";
    default:
      return "idle";
  }
}

function buildPrimaryProcessMetric({
  attentionCount,
  failureCount,
  activeCount,
  hottestSession
}) {
  if (attentionCount > 0) {
    return {
      label: "待接管",
      value: attentionCount,
      copy: hottestSession
        ? `${attentionCount} 个会话正在等待你马上接手，优先关注 ${hottestSession.title}。`
        : `${attentionCount} 个会话正在等待你马上接手。`
    };
  }

  if (failureCount > 0) {
    return {
      label: "异常",
      value: failureCount,
      copy: `${failureCount} 个会话刚刚失败，建议先看事件轨迹再决定是否重试。`
    };
  }

  return {
    label: "运行中",
    value: activeCount,
    copy: activeCount > 0
      ? `${activeCount} 个会话正在这台 Mac 上推进。`
      : "当前没有运行中的会话，可以从模板或自动化启动新的任务。"
  };
}

function buildWorkbenchPrimaryAction(detail, commandState) {
  if (commandState?.isSubmitting) {
    return {
      label: "等待回执",
      tone: "active"
    };
  }

  const status = commandState?.lastCommand?.status ?? detail.run?.status ?? detail.session?.status ?? "idle";
  switch (status) {
    case "waitingForInput":
      return {
        label: "继续输入",
        tone: "urgent"
      };
    case "failed":
      return {
        label: "检查并重试",
        tone: "warning"
      };
    case "running":
    case "active":
      return {
        label: "查看最新进度",
        tone: "active"
      };
    case "queued":
      return {
        label: "等待执行开始",
        tone: "active"
      };
    case "completed":
      return {
        label: "发送下一条提示词",
        tone: "ready"
      };
    default:
      return {
        label: "从这里接管",
        tone: "idle"
      };
  }
}

function buildWorkbenchBlocker(detail, commandState) {
  if (commandState?.isSubmitting) {
    return "这条命令已经发出，正在等待本机中继回执。";
  }

  const command = commandState?.lastCommand ?? detail.recentCommands?.[0] ?? null;
  const status = command?.status ?? detail.run?.status ?? detail.session?.status ?? "idle";
  switch (status) {
    case "waitingForInput":
      return "当前卡点是等待你的下一条输入，直接在下方输入区继续即可。";
    case "failed":
      return "上一条命令失败了，建议先看最近事件，再决定是否重试。";
    case "running":
    case "active":
      return "当前不需要人工输入，优先观察最近事件和命令回执。";
    case "queued":
      return "命令已入队，等待本机开始真正执行。";
    default:
      return "当前没有明显阻塞，可以继续输入、刷新状态，或切换到其他会话。";
  }
}

function buildFallbackTransport(origin) {
  const baseUrl = origin ?? "http://127.0.0.1";
  const isLocalOnly = /:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(baseUrl);

  return {
    baseUrl,
    localBaseUrl: baseUrl,
    phoneAccessUrl: isLocalOnly ? null : baseUrl,
    isLocalOnly
  };
}

function isLiveTask(session) {
  return ["queued", "running", "active", "waitingForInput", "failed"].includes(
    session.runStatus ?? session.status ?? "idle"
  );
}

function pickFocusSession(sessions, now) {
  const ordered = [...sessions].sort((left, right) => compareSessions(left, right, now));
  return ordered[0] ?? null;
}

function compareSessions(left, right, now) {
  const leftScore = sessionPriority(left, now);
  const rightScore = sessionPriority(right, now);
  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  return sessionTimestamp(right) - sessionTimestamp(left);
}

function sessionPriority(session, now) {
  const status = session.runStatus ?? session.status ?? "idle";
  switch (status) {
    case "waitingForInput":
      return 4;
    case "active":
    case "running":
      return 3;
    case "failed":
    case "queued":
      return 2;
    default:
      return now - sessionTimestamp(session) < 30 * 60 * 1000 ? 1 : 0;
  }
}

function sessionTimestamp(session) {
  return normalizeTimestampValue(session.updatedAt);
}

function normalizeWorkbenchStatus(status) {
  switch (status) {
    case "submitting":
      return "queued";
    case "active":
      return "running";
    case "waitingForInput":
      return "completed";
    default:
      return status ?? "idle";
  }
}

function workbenchStepState(step, status) {
  if (status === "failed") {
    if (step === "completed") {
      return "error";
    }
    if (step === "compose") {
      return "done";
    }
    return ["queued", "running"].includes(step) ? "done" : "pending";
  }

  const order = ["compose", "queued", "running", "completed"];
  const statusIndex = {
    idle: 0,
    queued: 1,
    running: 2,
    completed: 3
  }[status] ?? 0;
  const stepIndex = order.indexOf(step);

  if (stepIndex < statusIndex) {
    return "done";
  }
  if (stepIndex === statusIndex) {
    return "active";
  }
  return "pending";
}

function taskLaneLabel(status) {
  switch (status) {
    case "waitingForInput":
      return "正在等待下一条提示词";
    case "active":
    case "running":
      return "正在中继上运行";
    case "queued":
      return "已进入执行队列";
    case "failed":
      return "需要恢复处理";
    default:
      return "可继续操作";
  }
}

function buildQuotaSummary(quota, now) {
  const primary = quota?.primary ?? null;
  if (!primary) {
    return null;
  }

  const windowLabel = primary.windowMinutes
    ? formatQuotaWindowLabel(primary.windowMinutes)
    : "额度窗口";
  const remainingPercent = Number(primary.remainingPercent ?? 0);
  const usedPercent = Number(primary.usedPercent ?? 0);
  const resetLabel = primary.resetsAt
    ? `恢复于${formatRelativeTime(primary.resetsAt, now)}`
    : "恢复时间待确认";

  return {
    summary: `${windowLabel}剩余 ${Math.round(remainingPercent)}%，${resetLabel}`,
    chip: `额度剩余 ${Math.round(remainingPercent)}%`,
    cardLabel: "额度剩余",
    cardValue: Math.round(remainingPercent),
    cardTone: remainingPercent <= 20 || usedPercent >= 80 ? "warning" : "success",
    resetLabel,
    windowLabel
  };
}

function formatQuotaWindowLabel(windowMinutes) {
  if (windowMinutes % (24 * 60) === 0) {
    const days = windowMinutes / (24 * 60);
    return `${days}天`;
  }

  if (windowMinutes % 60 === 0) {
    const hours = windowMinutes / 60;
    return `${hours}小时`;
  }

  return `${windowMinutes}分钟`;
}

function formatRelativeTime(value, referenceTime = Date.now()) {
  const time = normalizeTimestampValue(value);
  if (!time) {
    return String(value);
  }

  const diffMs = time - referenceTime;
  const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  const seconds = Math.round(diffMs / 1000);

  if (Math.abs(seconds) < 60) {
    return formatter.format(seconds, "second");
  }

  const minutes = Math.round(diffMs / (60 * 1000));
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return formatter.format(days, "day");
}

function normalizeTimestampValue(value) {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }

    const parsed = new Date(trimmed).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function translateCommandStatus(status) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
    case "active":
      return "执行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "waitingForInput":
      return "等待输入";
    case "idle":
      return "空闲";
    default:
      return status ?? "未知状态";
  }
}

function translateCommandKind(kind) {
  switch (kind) {
    case "sendPrompt":
      return "发送提示词";
    case "resumeRun":
      return "继续运行";
    case "retryRun":
      return "重试";
    case "stopRun":
      return "停止";
    case "startAutomation":
      return "启动自动化";
    case "startTemplate":
      return "启动模板";
    default:
      return kind ?? "命令";
  }
}

function compact(values) {
  return values.filter((value) => value != null && value !== "");
}
