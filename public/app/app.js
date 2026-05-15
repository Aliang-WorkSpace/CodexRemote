import { AppSessionController } from "../../src/client/codex-remote-app-session.js";
import {
  clearPersistedAppState,
  loadPersistedAppState,
  savePersistedAppState
} from "../../src/client/app-persistence.js";
import {
  buildAttentionQueueView,
  buildConnectionStatusView,
  buildLocalControlStatusView,
  buildMissionControlView,
  buildProcessOverviewView,
  buildSessionTakeoverListView,
  buildTaskLaneView,
  buildWorkbenchView
} from "../../src/client/codex-remote-view-models.js";

const controller = new AppSessionController();
const initialState = globalThis.__CODEX_REMOTE_INITIAL_STATE__ ?? globalThis.__CONTROL_PLANE_INITIAL_STATE__ ?? null;

const POLLING_INTERVAL_MS = 15000;
const SESSION_LIST_PAGE_SIZE = 8;
let installPromptEvent = null;

const elements = {
  pairingCodeInput: document.querySelector("#pairingCodeInput"),
  pairingBootstrapButton: document.querySelector("#pairingBootstrapButton"),
  connectButton: document.querySelector("#connectButton"),
  copyAppLinkButton: document.querySelector("#copyAppLinkButton"),
  refreshBootstrapButton: document.querySelector("#refreshBootstrapButton"),
  togglePollingButton: document.querySelector("#togglePollingButton"),
  forgetDeviceButton: document.querySelector("#forgetDeviceButton"),
  pairingMeta: document.querySelector("#pairingMeta"),
  appPairingMeta: document.querySelector("#appPairingMeta"),
  appPairingLink: document.querySelector("#appPairingLink"),
  pairingQrImage: document.querySelector("#pairingQrImage"),
  globalError: document.querySelector("#globalError"),
  processSummary: document.querySelector("#processSummary"),
  processSupport: document.querySelector("#processSupport"),
  processQuotaMeta: document.querySelector("#processQuotaMeta"),
  processPrimaryMetric: document.querySelector("#processPrimaryMetric"),
  processDashboardStrip: document.querySelector("#processDashboardStrip"),
  processHeroChips: document.querySelector("#processHeroChips"),
  syncStatusValue: document.querySelector("#syncStatusValue"),
  syncStatusCard: document.querySelector("#syncStatusCard .status-dot"),
  connectionStatusTitle: document.querySelector("#connectionStatusTitle"),
  connectionDeviceLabel: document.querySelector("#connectionDeviceLabel"),
  connectionToggleButton: document.querySelector("#connectionToggleButton"),
  connectionManagementBody: document.querySelector("#connectionManagementBody"),
  connectionSummary: document.querySelector("#connectionSummary"),
  connectionAddressLabel: document.querySelector("#connectionAddressLabel"),
  connectionAddress: document.querySelector("#connectionAddress"),
  localConnectionAddress: document.querySelector("#localConnectionAddress"),
  connectionGuideTitle: document.querySelector("#connectionGuideTitle"),
  connectionSteps: document.querySelector("#connectionSteps"),
  copyAddressButton: document.querySelector("#copyAddressButton"),
  workspaceTitle: document.querySelector("#workspaceTitle"),
  workspaceSummary: document.querySelector("#workspaceSummary"),
  workspaceMeta: document.querySelector("#workspaceMeta"),
  workspaceHealthLabel: document.querySelector("#workspaceHealthLabel"),
  overviewStatCards: document.querySelector("#overviewStatCards"),
  missionMeta: document.querySelector("#missionMeta"),
  focusCard: document.querySelector("#focusCard"),
  attentionMeta: document.querySelector("#attentionMeta"),
  attentionList: document.querySelector("#attentionList"),
  taskLaneMeta: document.querySelector("#taskLaneMeta"),
  taskLane: document.querySelector("#taskLane"),
  resumeTitle: document.querySelector("#resumeTitle"),
  resumeBadge: document.querySelector("#resumeBadge"),
  resumeMeta: document.querySelector("#resumeMeta"),
  resumeOpenButton: document.querySelector("#resumeOpenButton"),
  freshnessTitle: document.querySelector("#freshnessTitle"),
  freshnessBadge: document.querySelector("#freshnessBadge"),
  freshnessMeta: document.querySelector("#freshnessMeta"),
  installTitle: document.querySelector("#installTitle"),
  installBadge: document.querySelector("#installBadge"),
  installMeta: document.querySelector("#installMeta"),
  installAppButton: document.querySelector("#installAppButton"),
  automationListMeta: document.querySelector("#automationListMeta"),
  automationList: document.querySelector("#automationList"),
  templateListMeta: document.querySelector("#templateListMeta"),
  templateList: document.querySelector("#templateList"),
  sessionListMeta: document.querySelector("#sessionListMeta"),
  sessionList: document.querySelector("#sessionList"),
  sessionListFooter: document.querySelector("#sessionListFooter"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sessionSubtitle: document.querySelector("#sessionSubtitle"),
  selectedSessionHint: document.querySelector("#selectedSessionHint"),
  sessionRunStatus: document.querySelector("#sessionRunStatus"),
  sessionModel: document.querySelector("#sessionModel"),
  sessionUpdated: document.querySelector("#sessionUpdated"),
  workbenchStatus: document.querySelector("#workbenchStatus"),
  workbenchSummary: document.querySelector("#workbenchSummary"),
  workbenchBlocker: document.querySelector("#workbenchBlocker"),
  workbenchAction: document.querySelector("#workbenchAction"),
  workbenchRail: document.querySelector("#workbenchRail"),
  promptInput: document.querySelector("#promptInput"),
  sendPromptButton: document.querySelector("#sendPromptButton"),
  resumeRunButton: document.querySelector("#resumeRunButton"),
  retryRunButton: document.querySelector("#retryRunButton"),
  stopRunButton: document.querySelector("#stopRunButton"),
  refreshSessionButton: document.querySelector("#refreshSessionButton"),
  composerMeta: document.querySelector("#composerMeta"),
  recentCommandStatus: document.querySelector("#recentCommandStatus"),
  recentCommandTitle: document.querySelector("#recentCommandTitle"),
  recentCommandMeta: document.querySelector("#recentCommandMeta"),
  commandList: document.querySelector("#commandList"),
  eventList: document.querySelector("#eventList")
};

const uiState = {
  isPollingEnabled: false,
  pollingTimer: null,
  isBackgroundRefreshing: false,
  isRestoring: false,
  isOnline: navigator.onLine,
  installState: "browser",
  isConnectionPanelExpanded: false,
  sessionListVisibleCount: SESSION_LIST_PAGE_SIZE,
  relayProbeState: "idle",
  relayProbeError: null,
  appPairingUrl: null,
  qrImageUrl: null
};

  elements.connectButton.addEventListener("click", async () => {
  const pairingCode = elements.pairingCodeInput.value.trim();
  if (!pairingCode) {
    renderError("请先粘贴 /pairing/bootstrap 返回的配对码，或先加载连接信息。");
    return;
  }

  await runAction(async () => {
    await controller.connectWithPairingCode(pairingCode);
    uiState.isPollingEnabled = true;
    schedulePolling();
    persistAppState();
    renderAll();
  });
});

elements.refreshBootstrapButton.addEventListener("click", async () => {
  await runAction(async () => {
    await refreshConnectedState();
  });
});

elements.togglePollingButton.addEventListener("click", () => {
  uiState.isPollingEnabled = !uiState.isPollingEnabled;
  schedulePolling();
  persistAppState();
  renderAll();
});

elements.forgetDeviceButton.addEventListener("click", () => {
  clearPersistedAppState();
  uiState.isPollingEnabled = false;
  schedulePolling();
  window.location.reload();
});

elements.resumeOpenButton.addEventListener("click", async () => {
  const sessionId = controller.state.session?.sessionId ?? loadPersistedAppState()?.selectedSessionId;
  if (!sessionId) {
    renderError("当前还没有可恢复的历史会话。");
    return;
  }

  await openSession(sessionId);
});

elements.installAppButton.addEventListener("click", async () => {
  if (!installPromptEvent) {
    return;
  }

  installPromptEvent.prompt();
  const result = await installPromptEvent.userChoice;
  installPromptEvent = null;
  uiState.installState = result.outcome === "accepted" ? "installed" : "browser";
  renderAll();
});

elements.copyAddressButton.addEventListener("click", async () => {
  const address = elements.connectionAddress.textContent?.trim();
  if (!address) {
    return;
  }

  try {
    await navigator.clipboard.writeText(address);
    elements.connectionSummary.textContent = "连接地址已复制到剪贴板。";
  } catch {
    renderError("复制失败，请手动复制当前地址。");
  }
});

elements.connectionToggleButton.addEventListener("click", () => {
  uiState.isConnectionPanelExpanded = !uiState.isConnectionPanelExpanded;
  persistAppState();
  renderConnectionPanel();
});

elements.copyAppLinkButton.addEventListener("click", async () => {
  if (!uiState.appPairingUrl) {
    renderError("还没有生成 App 配对链接。");
    return;
  }

  try {
    await navigator.clipboard.writeText(uiState.appPairingUrl);
    elements.appPairingMeta.textContent = "App 配对链接已复制，可以直接发到 iPhone 上打开。";
  } catch {
    renderError("复制失败，请手动复制 App 配对链接。");
  }
});

elements.sendPromptButton.addEventListener("click", async () => {
  const sessionId = controller.state.session?.sessionId;
  const prompt = elements.promptInput.value.trim();
  if (!sessionId || !prompt) {
    renderError("请先选择一个会话，并输入要发送的提示词。");
    return;
  }

  await runAction(async () => {
    await controller.sendPrompt({
      sessionId,
      prompt
    });
    elements.promptInput.value = "";
    await refreshConnectedState({ refreshSession: true });
  });
});

elements.resumeRunButton.addEventListener("click", async () => {
  const sessionId = controller.state.session?.sessionId;
  if (!sessionId) {
    renderError("请先选择一个会话。");
    return;
  }

  await runAction(async () => {
    await controller.resumeRun({ sessionId });
    await refreshConnectedState({ refreshSession: true });
  });
});

elements.retryRunButton.addEventListener("click", async () => {
  const sessionId = controller.state.session?.sessionId;
  if (!sessionId) {
    renderError("请先选择一个会话。");
    return;
  }

  await runAction(async () => {
    await controller.retryRun({ sessionId });
    await refreshConnectedState({ refreshSession: true });
  });
});

elements.stopRunButton.addEventListener("click", async () => {
  const sessionId = controller.state.session?.sessionId;
  if (!sessionId) {
    renderError("请先选择一个会话。");
    return;
  }

  await runAction(async () => {
    await controller.stopRun({
      sessionId,
      reason: "已从本地应用停止"
    });
    await refreshConnectedState({ refreshSession: true });
  });
});

elements.refreshSessionButton.addEventListener("click", async () => {
  await runAction(async () => {
    await controller.refreshSession();
    renderAll();
  });
});

elements.pairingBootstrapButton.addEventListener("click", async () => {
  await runAction(async () => {
    await discoverCurrentRelay();
  });
});

window.addEventListener("online", () => {
  uiState.isOnline = true;
  renderAll();
});

window.addEventListener("offline", () => {
  uiState.isOnline = false;
  renderAll();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPromptEvent = event;
  uiState.installState = "promptable";
  renderAll();
});

window.addEventListener("appinstalled", () => {
  installPromptEvent = null;
  uiState.installState = "installed";
  renderAll();
});

renderAll();
initializeApp();
registerServiceWorker();

async function initializeApp() {
  const persisted = loadPersistedAppState();
  if (persisted) {
    uiState.isConnectionPanelExpanded = persisted.isConnectionPanelExpanded;
    uiState.isPollingEnabled = persisted.isPollingEnabled;
  }

  hydrateFromInitialState();
  if (controller.client && initialState?.bundle) {
    if (persisted?.selectedSessionId) {
      await openSession(persisted.selectedSessionId);
    }
    schedulePolling();
    persistAppState();
    renderAll();
  } else {
    await restorePersistedState();
  }
  if (!controller.client) {
    await discoverCurrentRelay();
  }
}

function hydrateFromInitialState() {
  if (!initialState) {
    return;
  }

  controller.hydrate({
    publicPairing: initialState.publicPairing ?? null,
    bundle: initialState.bundle ?? null,
    bootstrap: initialState.bootstrap ?? null
  });

  uiState.relayProbeState = "ready";
  uiState.relayProbeError = null;
  uiState.appPairingUrl = initialState.publicPairing?.appPairingUrl ?? null;
  uiState.qrImageUrl = initialState.publicPairing?.qrImageUrl
    ? new URL(initialState.publicPairing.qrImageUrl, window.location.origin).toString()
    : null;

  if (initialState.bundle) {
    uiState.isPollingEnabled = true;
    schedulePolling();
    persistAppState();
  }

  renderAll();
}

async function openSession(sessionId) {
  await runAction(async () => {
    await controller.openSession(sessionId);
    persistAppState();
    renderAll();
  });
}

async function triggerAutomation(automationId) {
  await runAction(async () => {
    await controller.startAutomation({
      automationId,
      input: "从远程控制台触发。"
    });
    await refreshConnectedState();
  });
}

async function triggerTemplate(templateId) {
  await runAction(async () => {
    await controller.startTemplate({
      templateId,
      input: "从远程控制台触发。"
    });
    await refreshConnectedState();
  });
}

async function refreshConnectedState({ refreshSession = false } = {}) {
  await controller.refreshBootstrap();
  if (refreshSession && controller.state.session?.sessionId) {
    await controller.refreshSession();
  }
  persistAppState();
  renderAll();
}

async function restorePersistedState() {
  const persisted = loadPersistedAppState();
  if (!persisted?.pairingBundle) {
    return;
  }

  uiState.isRestoring = true;
  uiState.isPollingEnabled = persisted.isPollingEnabled;
  uiState.isConnectionPanelExpanded = persisted.isConnectionPanelExpanded;
  renderAll();

  try {
    await controller.restoreFromBundle(persisted.pairingBundle);
    if (persisted.selectedSessionId) {
      await controller.openSession(persisted.selectedSessionId);
    }
    schedulePolling();
    persistAppState();
    renderAll();
  } catch (error) {
    clearPersistedAppState();
    renderError(`自动恢复失败：${error.message}`);
  } finally {
    uiState.isRestoring = false;
    renderAll();
  }
}

async function discoverCurrentRelay() {
  uiState.relayProbeState = "probing";
  uiState.relayProbeError = null;
  renderAll();

  try {
    await controller.discover(window.location.origin);
    const pairing = controller.state.pairing?.publicPairing;
    uiState.relayProbeState = "ready";
    uiState.appPairingUrl = pairing?.appPairingUrl ?? null;
    uiState.qrImageUrl = pairing?.qrImageUrl
      ? new URL(pairing.qrImageUrl, window.location.origin).toString()
      : null;

    if (pairing?.pairingStatus === "direct-bootstrap-available" && !controller.client) {
      await controller.connectDirect(window.location.origin);
      uiState.isPollingEnabled = true;
      schedulePolling();
      persistAppState();
      elements.pairingMeta.textContent = "本机主控制面已经就绪；如需手机副控，可以继续扫码或复制连接信息。";
    } else if (pairing?.transport?.phoneAccessUrl) {
      elements.pairingMeta.textContent = `如需手机副控，请在同一网络中打开 ${pairing.transport.phoneAccessUrl}，或直接扫描二维码。`;
    } else {
      elements.pairingMeta.textContent = "当前地址只在这台 Mac 上可用。桌面端已可直接管理进程，手机接入可稍后再做。";
    }

    renderAll();
  } catch (error) {
    uiState.relayProbeState = "error";
    uiState.relayProbeError = error?.message ?? "无法读取本机控制面的连接信息。";
    renderAll();
  }
}

function persistAppState() {
  savePersistedAppState({
    pairingBundle: controller.state.pairing?.bundle ?? null,
    selectedSessionId: controller.state.session?.sessionId ?? null,
    isPollingEnabled: uiState.isPollingEnabled,
    isConnectionPanelExpanded: uiState.isConnectionPanelExpanded
  });
}

function schedulePolling() {
  if (uiState.pollingTimer) {
    window.clearInterval(uiState.pollingTimer);
    uiState.pollingTimer = null;
  }

  if (!uiState.isPollingEnabled || !controller.client) {
    return;
  }

  uiState.pollingTimer = window.setInterval(() => {
    runBackgroundRefresh();
  }, POLLING_INTERVAL_MS);
}

async function runBackgroundRefresh() {
  if (uiState.isBackgroundRefreshing || !controller.client) {
    return;
  }

  uiState.isBackgroundRefreshing = true;

  try {
    await controller.refreshBootstrap();
    if (controller.state.session?.sessionId) {
      await controller.refreshSession();
    }
    renderAll();
  } catch (error) {
    renderError(error.message);
  } finally {
    uiState.isBackgroundRefreshing = false;
  }
}

async function runAction(action) {
  clearError();
  setGlobalBusyState(true);
  try {
    await action();
  } catch (error) {
    renderError(error.message);
  } finally {
    setGlobalBusyState(false);
  }
}

function setGlobalBusyState(isBusy) {
  const detail = controller.selectedSession;
  const composerState = controller.state.composer;
  const disableSessionActions = !detail || isBusy || composerState?.isSubmitting;

  elements.connectButton.disabled = isBusy;
  elements.pairingBootstrapButton.disabled = isBusy;
  elements.refreshBootstrapButton.disabled = !controller.client || isBusy;
  elements.togglePollingButton.disabled = !controller.client || isBusy;
  elements.forgetDeviceButton.disabled = !controller.client || isBusy;
  elements.sendPromptButton.disabled =
    disableSessionActions || !elements.promptInput.value.trim();
  elements.resumeRunButton.disabled = disableSessionActions;
  elements.retryRunButton.disabled = disableSessionActions;
  elements.stopRunButton.disabled = disableSessionActions;
  elements.refreshSessionButton.disabled = disableSessionActions;
}

function renderAll() {
  renderBootstrap();
  renderConnectionPanel();
  renderOverviewStrip();
  renderSessions();
  renderSelectedSession();
  setGlobalBusyState(false);
}

function renderConnectionPanel() {
  const view = buildConnectionStatusView({
    origin: window.location.origin,
    pairingState: controller.state.pairing,
    bootstrap: controller.state.bootstrap?.bootstrap ?? null,
    dashboard: controller.dashboard,
    isOnline: uiState.isOnline,
    isRestoring: uiState.isRestoring
  });

  elements.connectionStatusTitle.textContent = view.status;
  elements.connectionDeviceLabel.textContent = view.device;
  elements.connectionSummary.textContent = view.summary;
  elements.connectionAddressLabel.textContent = view.addressLabel;
  elements.connectionAddress.textContent = view.address;
  elements.localConnectionAddress.textContent = view.localAddress;
  elements.connectionGuideTitle.textContent = view.helperTitle;
  elements.connectionSteps.innerHTML = view.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  elements.copyAddressButton.textContent = view.addressLabel === "手机访问地址" ? "复制手机地址" : "复制地址";
  elements.connectionToggleButton.textContent = uiState.isConnectionPanelExpanded ? "收起连接管理" : "展开连接管理";
  elements.connectionManagementBody.classList.toggle("collapsed", !uiState.isConnectionPanelExpanded);
  elements.connectionSummary.textContent = uiState.isConnectionPanelExpanded ? view.summary : view.compactSummary;
  elements.connectionStatusTitle.textContent = uiState.isConnectionPanelExpanded ? view.status : view.compactTitle;
}

function renderOverviewStrip() {
  renderResumeStrip();
  renderFreshnessStrip();
  renderInstallStrip();
}

function renderBootstrap() {
  const dashboard = controller.dashboard;
  const sync = controller.state.bootstrap?.bootstrap?.sync ?? null;
  const pairingState = controller.state.pairing;
  const processView = buildProcessOverviewView({
    dashboard
  });
  const localStatusView = buildLocalControlStatusView({
    pairingState,
    dashboard,
    sync,
    relayProbeState: uiState.relayProbeState,
    relayProbeError: uiState.relayProbeError,
    isOnline: uiState.isOnline,
    isRestoring: uiState.isRestoring
  });

  elements.workspaceTitle.textContent = processView.headerTitle ?? dashboard?.workspace?.name ?? "Local Mac";
  elements.workspaceSummary.textContent = processView.headerSubtitle ?? "正在读取这台 Mac 的工作区和会话状态";
  elements.workspaceMeta.textContent = dashboard
    ? `${dashboard.device.workspaceName} · ${dashboard.stats.sessionCount} 个会话`
    : "正在读取这台 Mac 的工作区";
  elements.workspaceHealthLabel.textContent = processView.healthLabel ?? "本机已就绪";
  elements.workspaceHealthLabel.className = `health-chip ${healthToneClass(processView.healthLabel)}`;
  elements.processSummary.textContent = processView.summary;
  elements.processSupport.textContent = localStatusView.detail ?? "本机状态准备就绪后，这里会显示当前主控说明。";
  elements.processPrimaryMetric.innerHTML = `
    <span class="hero-metric-label">${escapeHtml(processView.primaryMetric.label)}</span>
    <strong class="hero-metric-value">${escapeHtml(String(processView.primaryMetric.value))}</strong>
    <p class="hero-metric-copy">${escapeHtml(processView.primaryMetric.copy)}</p>
  `;
  elements.processDashboardStrip.innerHTML = [
    processView.primaryMetric,
    ...(processView.secondaryMetrics ?? [])
  ]
    .map(
      (metric) => `
        <div class="dashboard-pill">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(String(metric.value))}</strong>
        </div>
      `
    )
    .join("");
  elements.processHeroChips.innerHTML = processView.chips
    .map((chip) => `<span class="hero-chip">${escapeHtml(chip)}</span>`)
    .join("");
  if (processView.quotaSummary) {
    elements.processQuotaMeta.hidden = false;
    elements.processQuotaMeta.textContent =
      `${processView.quotaSummary.windowLabel}额度 · 剩余 ${processView.quotaSummary.cardValue}% · ${processView.quotaSummary.resetLabel}`;
  } else {
    elements.processQuotaMeta.hidden = true;
    elements.processQuotaMeta.textContent = "";
  }
  elements.overviewStatCards.innerHTML = (processView.statCards ?? [])
    .map(
      (card) => `
        <div class="stat-card stat-card-${escapeHtml(card.tone ?? "neutral")}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(String(card.value))}</strong>
        </div>
      `
    )
    .join("");
  elements.automationListMeta.textContent = `${dashboard?.automations?.length ?? 0} 项`;
  elements.templateListMeta.textContent = `${dashboard?.templates?.length ?? 0} 项`;
  elements.sessionListMeta.textContent = `${dashboard?.sessions?.length ?? 0} 项`;

  elements.syncStatusValue.textContent = localStatusView.title;
  elements.syncStatusCard.className = `status-dot ${localStatusToneClass(localStatusView.tone, sync)}`;

  elements.togglePollingButton.textContent = uiState.isPollingEnabled
    ? "自动刷新已开启"
    : "自动刷新已关闭";

  if (pairingState?.bundle) {
  elements.pairingMeta.textContent = `已连接到 ${pairingState.bundle.transport.baseUrl}`;
  } else if (uiState.isRestoring) {
    elements.pairingMeta.textContent = "正在恢复上次连接的设备和会话...";
  }

  elements.appPairingLink.textContent = uiState.appPairingUrl ?? "controlplane://pair";
  elements.appPairingMeta.textContent = uiState.appPairingUrl
    ? "扫码后会直接打开 iPhone App，并把这台 Mac 的地址带过去。"
    : "先加载配对信息，再生成可扫码的 App 配对链接。";
  if (uiState.qrImageUrl) {
    elements.pairingQrImage.src = uiState.qrImageUrl;
    elements.pairingQrImage.hidden = false;
  } else {
    elements.pairingQrImage.removeAttribute("src");
    elements.pairingQrImage.hidden = true;
  }

  renderMissionControl();
  renderAttentionQueue();
  renderTaskLane();
  renderAutomationList();
  renderTemplateList();
}

function renderMissionControl() {
  const view = buildMissionControlView({
    dashboard: controller.dashboard,
    selectedSession: controller.selectedSession?.session ?? null,
    composerState: controller.state.composer
  });

  if (!view.focus) {
    elements.missionMeta.textContent = controller.client ? "就绪" : "空闲";
    elements.focusCard.innerHTML = `
      <p class="focus-eyebrow">任务焦点</p>
      <h3 class="focus-title">本机主控已就绪，等待载入进程状态</h3>
      <p class="focus-copy">当前首页会优先展示这台 Mac 上最值得接手的会话、最近命令结果，以及整个 Codex 工作区的运行压力。手机接入会留在后面的连接管理区域。</p>
      <div class="focus-meta-row">
        <span class="focus-chip">当前还没有焦点会话</span>
      </div>
    `;
    return;
  }

  elements.missionMeta.textContent = view.meta;
  elements.focusCard.innerHTML = `
    <p class="focus-eyebrow">当前焦点</p>
    <h3 class="focus-title">${escapeHtml(view.focus.title)}</h3>
    <p class="focus-copy">${escapeHtml(view.focus.copy)}</p>
    <div class="focus-meta-row">
      ${view.focus.chips.map((chip) => `<span class="focus-chip">${escapeHtml(chip)}</span>`).join("")}
    </div>
  `;
}

function renderAttentionQueue() {
  const view = buildAttentionQueueView({
    sessions: controller.dashboard?.sessions ?? []
  });

  elements.attentionMeta.textContent = view.meta;

  if (view.items.length === 0) {
    elements.attentionList.innerHTML = `
      <div class="activity-row">
        <p class="row-title">当前没有紧急事项</p>
        <p class="row-sub">当某个运行中的任务需要输入、刚刚失败，或最近刚更新时，它会出现在这里，方便你优先处理。</p>
      </div>
    `;
    return;
  }

  elements.attentionList.innerHTML = view.items
    .map(
      (session) => `
        <button class="session-row" data-attention-session-id="${escapeHtml(session.id)}" type="button">
          <div class="row-top">
            <div class="row-copy">
              <p class="row-title">${escapeHtml(session.title)}</p>
              <p class="row-sub">${escapeHtml(session.summary)}</p>
            </div>
            <span class="badge ${statusColor(session.runStatus ?? session.status)}">${escapeHtml(
              translateDisplayStatus(session.runStatus ?? session.status ?? "idle")
            )}</span>
          </div>
        </button>
      `
    )
    .join("");

  elements.attentionList.querySelectorAll("[data-attention-session-id]").forEach((node) => {
    node.addEventListener("click", () => {
      openSession(node.getAttribute("data-attention-session-id"));
    });
  });
}

function renderResumeStrip() {
  const detail = controller.selectedSession;
  const persisted = loadPersistedAppState();
  const sessionId = detail?.session?.id ?? persisted?.selectedSessionId ?? null;
  const sessionTitle = detail?.session?.title ?? (sessionId ? `会话 ${sessionId.slice(0, 8)}` : null);
  const command = controller.state.composer?.lastCommand ?? null;

  elements.resumeTitle.textContent = sessionTitle ?? "还没有恢复会话";
  elements.resumeBadge.textContent = command?.status
    ? translateDisplayStatus(command.status)
    : sessionId
      ? "就绪"
      : "空闲";
  elements.resumeMeta.textContent = sessionId
    ? detail?.session?.cwd ?? "回到最近一次使用的会话，并从那里继续。"
    : "先在这台 Mac 上打开一个会话，这里就会成为你的快速返回入口。";
  elements.resumeOpenButton.disabled = !sessionId || !controller.client;
}

function renderFreshnessStrip() {
  const sync = controller.state.bootstrap?.bootstrap?.sync ?? null;
  const sessionUpdatedAt = controller.selectedSession?.session?.updatedAt ?? null;
  const freshestTimestamp = sync?.lastSucceededAt ?? sessionUpdatedAt ?? null;
  const ageMs = freshestTimestamp ? Date.now() - new Date(freshestTimestamp).getTime() : null;
  const isFresh = ageMs != null && ageMs < 2 * POLLING_INTERVAL_MS;
  const status = !controller.client
    ? "过期"
    : !uiState.isOnline
      ? "离线"
      : isFresh
        ? "实时"
        : "变旧";

  elements.freshnessTitle.textContent = freshestTimestamp
    ? `最近更新：${formatRelativeTime(freshestTimestamp)}`
    : "等待首次同步";
  elements.freshnessBadge.textContent = status;
  elements.freshnessMeta.textContent = !controller.client
    ? "准备好本机控制面后，才会开始追踪状态新鲜度。"
    : !uiState.isOnline
      ? "当前设备已离线，页面显示的是最近一次成功获取到的控制状态。"
      : freshestTimestamp
        ? `轮询${uiState.isPollingEnabled ? "已开启" : "已关闭"} · 来源${sync?.lastSucceededAt ? "同步" : "会话"}`
        : "已经连接，但还没有完成过同步，也还没有选中会话。";
}

function renderInstallStrip() {
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const state = isStandalone ? "installed" : uiState.installState;

  elements.installTitle.textContent =
    state === "installed"
      ? "独立应用模式"
      : state === "promptable"
        ? "可以安装"
        : "浏览器模式";
  elements.installBadge.textContent =
    state === "installed" ? "已安装" : state === "promptable" ? "可安装" : "网页";
  elements.installMeta.textContent =
    state === "installed"
      ? "控制台当前正以独立桌面外壳的方式运行。"
      : state === "promptable"
        ? "安装这个外壳后，你会获得启动图标、独立窗口和更稳定的本机主控入口。"
        : "当浏览器提供安装入口时，这个页面就可以被安装。";
  elements.installAppButton.disabled = state !== "promptable";
}

function renderAutomationList() {
  const automations = controller.dashboard?.automations ?? [];

  if (automations.length === 0) {
    elements.automationList.innerHTML = `<div class="activity-row"><p class="row-title">还没有自动化任务</p><p class="row-sub">来自 ~/.codex/automations 的自动化任务会显示在这里。</p></div>`;
    return;
  }

  elements.automationList.innerHTML = automations
    .map(
      (automation) => `
        <div class="activity-row action-row">
          <div class="action-copy">
            <div class="row-top">
              <p class="row-title">${escapeHtml(automation.name)}</p>
              <span class="badge ${automation.isEnabled ? "green" : "red"}">${escapeHtml(
                automation.isEnabled ? "已启用" : "已暂停"
              )}</span>
            </div>
            <p class="row-sub">${escapeHtml(automation.id)}</p>
          </div>
          <div class="action-buttons">
            <button class="ghost-button" data-automation-id="${escapeHtml(automation.id)}" type="button">运行</button>
          </div>
        </div>
      `
    )
    .join("");

  elements.automationList.querySelectorAll("[data-automation-id]").forEach((node) => {
    node.addEventListener("click", () => {
      triggerAutomation(node.getAttribute("data-automation-id"));
    });
  });
}

function renderTemplateList() {
  const templates = controller.dashboard?.templates ?? [];

  if (templates.length === 0) {
    elements.templateList.innerHTML = `<div class="activity-row"><p class="row-title">还没有模板</p><p class="row-sub">来自 ~/.codex/prompts 的提示词模板会显示在这里。</p></div>`;
    return;
  }

  elements.templateList.innerHTML = templates
    .map(
      (template) => `
        <div class="activity-row action-row">
          <div class="action-copy">
            <p class="row-title">${escapeHtml(template.name)}</p>
            <p class="row-sub">${escapeHtml(template.id)}</p>
          </div>
          <div class="action-buttons">
            <button class="ghost-button" data-template-id="${escapeHtml(template.id)}" type="button">启动</button>
          </div>
        </div>
      `
    )
    .join("");

  elements.templateList.querySelectorAll("[data-template-id]").forEach((node) => {
    node.addEventListener("click", () => {
      triggerTemplate(node.getAttribute("data-template-id"));
    });
  });
}

function renderSessions() {
  const view = buildSessionTakeoverListView({
    sessions: controller.dashboard?.sessions ?? []
  });
  const selectedSessionId = controller.state.session?.sessionId;
  const selectedIndex = selectedSessionId
    ? view.items.findIndex((item) => item.id === selectedSessionId)
    : -1;

  if (selectedIndex >= uiState.sessionListVisibleCount) {
    uiState.sessionListVisibleCount =
      Math.ceil((selectedIndex + 1) / SESSION_LIST_PAGE_SIZE) * SESSION_LIST_PAGE_SIZE;
  }

  elements.sessionListMeta.textContent = view.items.length
    ? `${view.meta} · 已显示 ${Math.min(uiState.sessionListVisibleCount, view.items.length)}/${view.items.length}`
    : "0 项";

  if (view.items.length === 0) {
    elements.sessionList.innerHTML = `<div class="activity-row"><p class="row-title">还没有会话</p><p class="row-sub">当前这台 Mac 上还没有可接管的会话，等进程状态载入后会出现在这里。</p></div>`;
    elements.sessionListFooter.innerHTML = "";
    uiState.sessionListVisibleCount = SESSION_LIST_PAGE_SIZE;
    return;
  }

  const visibleItems = view.items.slice(0, uiState.sessionListVisibleCount);

  elements.sessionList.innerHTML = visibleItems
    .map(
      (session) => `
        <button class="session-row takeover-row ${takeoverEmphasisClass(session.emphasis)} ${session.id === selectedSessionId ? "active" : ""}" data-session-id="${escapeHtml(session.id)}" type="button">
          <div class="row-top">
            <div class="row-copy">
              <p class="row-title">${escapeHtml(session.title)}</p>
              <p class="row-sub">${escapeHtml(session.summary)}</p>
            </div>
            <span class="badge ${statusColor(session.status)}">${escapeHtml(translateDisplayStatus(session.status))}</span>
          </div>
          <div class="takeover-row-meta">${escapeHtml(session.meta || "暂无最近上下文")}</div>
          <div class="takeover-row-footer">
            <span class="takeover-emphasis ${takeoverEmphasisClass(session.emphasis)}">${escapeHtml(
              translateTakeoverEmphasis(session.emphasis)
            )}</span>
            <span class="micro-label">${session.id === selectedSessionId ? "当前接管中" : `下一步：${escapeHtml(session.nextAction)}`}</span>
          </div>
        </button>
      `
    )
    .join("");

  elements.sessionList.querySelectorAll("[data-session-id]").forEach((node) => {
    node.addEventListener("click", () => {
      openSession(node.getAttribute("data-session-id"));
    });
  });

  renderSessionListFooter({
    totalCount: view.items.length,
    visibleCount: visibleItems.length
  });
}

function renderSessionListFooter({ totalCount, visibleCount }) {
  const canShowMore = visibleCount < totalCount;
  const canCollapse = visibleCount > SESSION_LIST_PAGE_SIZE;

  if (!canShowMore && !canCollapse) {
    elements.sessionListFooter.innerHTML = "";
    return;
  }

  elements.sessionListFooter.innerHTML = `
    <div class="session-list-footer-inner">
      <span class="meta-note">优先展示接管优先级最高的会话，避免列表一次性铺满。</span>
      <div class="session-list-footer-actions">
        ${canShowMore ? `<button class="ghost-button" id="showMoreSessionsButton" type="button">再显示 ${Math.min(SESSION_LIST_PAGE_SIZE, totalCount - visibleCount)} 项</button>` : ""}
        ${canCollapse ? `<button class="ghost-button" id="collapseSessionsButton" type="button">收起到前 ${SESSION_LIST_PAGE_SIZE} 项</button>` : ""}
      </div>
    </div>
  `;

  elements.sessionListFooter
    .querySelector("#showMoreSessionsButton")
    ?.addEventListener("click", () => {
      uiState.sessionListVisibleCount += SESSION_LIST_PAGE_SIZE;
      renderSessions();
    });

  elements.sessionListFooter
    .querySelector("#collapseSessionsButton")
    ?.addEventListener("click", () => {
      uiState.sessionListVisibleCount = SESSION_LIST_PAGE_SIZE;
      renderSessions();
    });
}

function renderSelectedSession() {
  const detail = controller.selectedSession;
  const commandState = controller.state.composer;
  const workbench = buildWorkbenchView({
    detail,
    commandState
  });

  if (!detail) {
    elements.sessionTitle.textContent = "选择一个会话";
    elements.sessionSubtitle.textContent = "尚未选择会话";
    elements.selectedSessionHint.textContent = "当前还没有选中接管对象。请先从左侧接管列表中打开一个会话。";
    elements.sessionRunStatus.textContent = "-";
    elements.sessionModel.textContent = "-";
    elements.sessionUpdated.textContent = "-";
    elements.promptInput.disabled = true;
    elements.promptInput.value = "";
    elements.workbenchStatus.textContent = workbench.status;
    elements.workbenchSummary.textContent = workbench.summary;
    elements.workbenchBlocker.textContent = workbench.currentBlocker;
    elements.workbenchAction.textContent = workbench.primaryAction.label;
    elements.workbenchAction.className = `workbench-action-pill ${workbenchActionToneClass(workbench.primaryAction.tone)}`;
    elements.workbenchRail.innerHTML = buildWorkbenchRailMarkup(workbench.steps);
    renderRecentCommandSpotlight(null);
    elements.commandList.innerHTML = `<div class="activity-row"><p class="row-title">还没有命令历史</p></div>`;
    elements.eventList.innerHTML = `<div class="activity-row timeline-row"><p class="row-title">还没有事件</p></div>`;
    elements.composerMeta.textContent = "选择一个会话后即可启用远程控制。";
    return;
  }

  elements.sessionTitle.textContent = detail.session.title;
  elements.sessionSubtitle.textContent = detail.session.cwd ?? "暂无工作目录";
  elements.selectedSessionHint.textContent = `当前正在接管：${detail.session.title} · ${translateDisplayStatus(
    detail.run?.status ?? detail.session.status
  )}`;
  elements.sessionRunStatus.textContent = translateDisplayStatus(detail.run?.status ?? detail.session.status);
  elements.sessionModel.textContent = detail.session.model ?? "-";
  elements.sessionUpdated.textContent = formatDateTime(detail.session.updatedAt);
  elements.promptInput.disabled = false;
  elements.workbenchStatus.textContent = workbench.status;
  elements.workbenchSummary.textContent = workbench.summary;
  elements.workbenchBlocker.textContent = workbench.currentBlocker;
  elements.workbenchAction.textContent = workbench.primaryAction.label;
  elements.workbenchAction.className = `workbench-action-pill ${workbenchActionToneClass(workbench.primaryAction.tone)}`;
  elements.workbenchRail.innerHTML = buildWorkbenchRailMarkup(workbench.steps);
  renderRecentCommandSpotlight(commandState?.lastCommand ?? detail.recentCommands?.[0] ?? null);
  elements.composerMeta.textContent = commandState?.isSubmitting
    ? "命令发送中..."
    : commandState?.lastCommand
      ? `最近命令：${commandState.lastCommand.id} · ${translateDisplayStatus(commandState.lastCommand.status)}`
      : "从这里接管当前会话，继续输入、重试或停止运行。";

  elements.commandList.innerHTML = (
    detail.recentCommands?.length
      ? detail.recentCommands
      : [{ kind: "none", acknowledgementMessage: "还没有命令", status: "idle" }]
  )
    .map(
      (command) => `
        <div class="activity-row">
          <div class="row-top">
            <p class="row-title">${escapeHtml(translateCommandKindLabel(command.kind ?? "none"))}</p>
            <span class="badge ${statusColor(command.status ?? "idle")}">${escapeHtml(translateDisplayStatus(command.status ?? "idle"))}</span>
          </div>
          <p class="row-sub">${escapeHtml(command.acknowledgementMessage ?? command.prompt ?? "还没有回执")}</p>
          <p class="command-history-meta">${escapeHtml(command.id ?? "本地命令")} · ${escapeHtml(buildCommandMeta(command))}</p>
        </div>
      `
    )
    .join("");

  elements.eventList.innerHTML = (
    detail.recentEvents?.length
      ? detail.recentEvents
      : [{ level: "info", message: "还没有事件", occurredAt: null, repeatCount: 1 }]
  )
    .map(
      (event) => `
        <div class="activity-row timeline-row">
          <div class="timeline-dot ${timelineDotClass(event.level)}"></div>
          <div class="row-top">
            <p class="row-title">${escapeHtml(event.message)}</p>
            <span class="badge ${statusColor(event.level)}">${escapeHtml(translateEventLevel(event.level))}</span>
          </div>
          <p class="row-sub">${escapeHtml(buildEventMeta(event))}</p>
        </div>
      `
    )
    .join("");
}

function renderRecentCommandSpotlight(command) {
  if (!command) {
    elements.recentCommandStatus.textContent = "无";
    elements.recentCommandTitle.textContent = "还没有命令回执";
    elements.recentCommandMeta.textContent = "选中会话后，这里会优先显示最近一条命令的回执和下一步建议。";
    return;
  }

  elements.recentCommandStatus.textContent = translateDisplayStatus(command.status ?? "idle");
  elements.recentCommandTitle.textContent = translateCommandKindLabel(command.kind ?? "none");
  elements.recentCommandMeta.textContent = command.acknowledgementMessage
    ?? command.prompt
    ?? "这条命令还没有补充回执。";
}

function renderTaskLane() {
  const view = buildTaskLaneView({
    sessions: controller.dashboard?.sessions ?? []
  });

  elements.taskLaneMeta.textContent = view.meta;

  if (view.items.length === 0) {
    elements.taskLane.innerHTML = `
      <div class="activity-row">
        <p class="row-title">当前没有进行中的任务</p>
        <p class="row-sub">当任务进入队列、开始执行、等待输入或失败时，它们会出现在这里。</p>
      </div>
    `;
    return;
  }

  elements.taskLane.innerHTML = view.items
    .map(
      (session) => `
        <button class="session-row" data-task-session-id="${escapeHtml(session.id)}" type="button">
          <div class="row-top">
            <div class="row-copy">
              <p class="row-title">${escapeHtml(session.title)}</p>
              <p class="row-sub">${escapeHtml(session.summary)}</p>
            </div>
            <span class="badge ${statusColor(session.runStatus ?? session.status)}">${escapeHtml(
              translateDisplayStatus(session.runStatus ?? session.status ?? "idle")
            )}</span>
          </div>
        </button>
      `
    )
    .join("");

  elements.taskLane.querySelectorAll("[data-task-session-id]").forEach((node) => {
    node.addEventListener("click", () => {
      openSession(node.getAttribute("data-task-session-id"));
    });
  });
}

function buildWorkbenchRailMarkup(steps) {
  return steps
    .map((step) => {
      return `
        <div class="workbench-step ${step.state}">
          <strong>${escapeHtml(step.title)}</strong>
          <span>${escapeHtml(step.copy)}</span>
        </div>
      `;
    })
    .join("");
}

function renderError(message) {
  elements.globalError.textContent = message;
  elements.globalError.classList.remove("hidden");
}

function clearError() {
  elements.globalError.textContent = "";
  elements.globalError.classList.add("hidden");
}

function buildEventMeta(event) {
  const parts = [];
  if (event.occurredAt) {
    parts.push(formatDateTime(event.occurredAt));
  }
  if (event.repeatCount && event.repeatCount > 1) {
    parts.push(`${event.repeatCount} 条相似事件`);
  }
  return parts.join(" · ") || "没有时间戳";
}

function buildCommandMeta(command) {
  const parts = [];
  if (command.origin) {
    parts.push(command.origin === "remote" ? "远程" : "本地");
  }
  if (command.createdAt) {
    parts.push(formatDateTime(command.createdAt));
  }
  return parts.join(" · ") || "暂无更多元数据";
}

function healthToneClass(healthLabel) {
  if (!healthLabel) {
    return "neutral";
  }

  if (healthLabel.includes("待接管")) {
    return "urgent";
  }

  if (healthLabel.includes("异常")) {
    return "warning";
  }

  if (healthLabel.includes("运行中")) {
    return "active";
  }

  return "neutral";
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/app/service-worker.js", {
      scope: "/app/",
      updateViaCache: "none"
    });
    await registration.update();
  } catch {
    // Best-effort install shell registration; the app still works without it.
  }
}

function statusColor(status) {
  switch (status) {
    case "completed":
    case "enabled":
    case "active":
    case "waitingForInput":
    case "info":
      return "green";
    case "failed":
    case "error":
    case "paused":
      return "red";
    default:
      return "blue";
  }
}

function localStatusToneClass(tone, sync) {
  if (sync?.lastError) {
    return "status-error";
  }

  switch (tone) {
    case "active":
    case "ready":
      return "status-ok";
    case "warning":
      return "status-warning";
    default:
      return "status-idle";
  }
}

function workbenchActionToneClass(tone) {
  switch (tone) {
    case "urgent":
      return "tone-urgent";
    case "warning":
      return "tone-warning";
    case "active":
      return "tone-active";
    case "ready":
      return "tone-ready";
    default:
      return "tone-idle";
  }
}

function takeoverEmphasisClass(emphasis) {
  switch (emphasis) {
    case "urgent":
      return "is-urgent";
    case "warning":
      return "is-warning";
    case "active":
      return "is-active";
    default:
      return "is-idle";
  }
}

function translateTakeoverEmphasis(emphasis) {
  switch (emphasis) {
    case "urgent":
      return "优先接管";
    case "warning":
      return "异常待处理";
    case "active":
      return "持续观察";
    default:
      return "可稍后处理";
  }
}

function translateDisplayStatus(status) {
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
    case "enabled":
      return "已启用";
    case "paused":
      return "已暂停";
    case "idle":
      return "空闲";
    case "none":
      return "无";
    default:
      return status ?? "-";
  }
}

function translateCommandKindLabel(kind) {
  switch (kind) {
    case "sendPrompt":
      return "发送提示词";
    case "resumeRun":
      return "继续运行";
    case "retryRun":
      return "重试运行";
    case "stopRun":
      return "停止运行";
    case "startAutomation":
      return "启动自动化";
    case "startTemplate":
      return "启动模板";
    default:
      return kind ?? "无";
  }
}

function translateEventLevel(level) {
  switch (level) {
    case "info":
      return "信息";
    case "error":
      return "错误";
    default:
      return level ?? "-";
  }
}

function timelineDotClass(level) {
  switch (level) {
    case "error":
      return "is-error";
    default:
      return "is-info";
  }
}

function formatRelativeTime(value) {
  const time = normalizeTimestampValue(value);
  if (!time) {
    return String(value);
  }

  const diffMs = time - Date.now();
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const time = normalizeTimestampValue(value);
  if (!time) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(time));
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

elements.promptInput.addEventListener("input", () => {
  setGlobalBusyState(false);
});
