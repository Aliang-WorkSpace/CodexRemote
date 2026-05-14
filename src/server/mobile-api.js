import { listActiveRuns } from "../core/domain-models.js";

export function buildDashboardResponse({ snapshot, commands, device }) {
  const childRunCountByParent = snapshot.runs.reduce((accumulator, run) => {
    if (!run.parentRunId) {
      return accumulator;
    }

    accumulator.set(run.parentRunId, (accumulator.get(run.parentRunId) ?? 0) + 1);
    return accumulator;
  }, new Map());

  const latestRunBySessionId = new Map(
    snapshot.runs
      .filter((run) => run.sessionId)
      .map((run) => [run.sessionId, run])
  );

  return {
    workspace: snapshot.workspace,
    device: {
      deviceId: device.deviceId,
      workspaceId: device.workspaceId,
      workspaceName: device.workspaceName,
      updatedAt: device.updatedAt
    },
    stats: {
      sessionCount: snapshot.sessions.length,
      activeRunCount: listActiveRuns(snapshot).length,
      automationCount: snapshot.automations.length,
      templateCount: (snapshot.templates ?? []).length,
      commandCount: commands.length
    },
    quota: normalizeQuotaSnapshot(snapshot.quota),
    sessions: snapshot.sessions.map((session) =>
      buildMobileSessionSummary({
        session,
        run: latestRunBySessionId.get(session.id) ?? null,
        childRunCount: childRunCountByParent.get(session.id) ?? 0
      })
    ),
    automations: snapshot.automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      isEnabled: automation.isEnabled
    })),
    templates: (snapshot.templates ?? []).map((template) => ({
      id: template.id,
      name: template.name
    })),
    recentCommands: commands.slice(0, 20).map((command) => ({
      id: command.id,
      status: command.status,
      kind: command.payload.kind,
      targetType: command.target.type,
      targetId: command.target.id,
      createdAt: command.createdAt,
      completedAt: command.completedAt ?? null,
      acknowledgementMessage: command.acknowledgementMessage ?? null
    }))
  };
}

function normalizeQuotaSnapshot(quota) {
  if (!quota) {
    return null;
  }

  return {
    planType: quota.planType ?? null,
    credits: quota.credits ?? null,
    sourcedAt: normalizeTimestamp(quota.sourcedAt),
    primary: normalizeQuotaWindow(quota.primary),
    secondary: normalizeQuotaWindow(quota.secondary)
  };
}

function normalizeQuotaWindow(window) {
  if (!window) {
    return null;
  }

  return {
    usedPercent: window.usedPercent,
    remainingPercent: window.remainingPercent,
    windowMinutes: window.windowMinutes ?? null,
    resetsAt: normalizeTimestamp(window.resetsAt)
  };
}

function normalizeTimestamp(value) {
  if (value == null || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const millis = numeric < 1e12 ? numeric * 1000 : numeric;
    return new Date(millis).toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString();
}

export function buildMobileBootstrapResponse({
  snapshot,
  commands,
  device,
  syncStatus,
  publicBaseUrl,
  accessUrls = null
}) {
  const dashboard = buildDashboardResponse({
    snapshot,
    commands,
    device
  });

  return {
    workspace: dashboard.workspace,
    device: dashboard.device,
    transport: {
      type: "http",
      baseUrl: publicBaseUrl,
      localBaseUrl: accessUrls?.localBaseUrl ?? publicBaseUrl,
      phoneAccessUrl: accessUrls?.phoneAccessUrl ?? null,
      isLocalOnly: accessUrls?.isLocalOnly ?? false,
      hint: accessUrls?.hint ?? null
    },
    sync: syncStatus ?? { enabled: false },
    supportedCommands: [
      "startAutomation",
      "startTemplate",
      "sendPrompt",
      "stopRun",
      "retryRun",
      "resumeRun",
      "cancelCommand"
    ],
    dashboard
  };
}

export function buildMobileSessionSummary({ session, run, childRunCount }) {
  return {
    id: session.id,
    title: compactTitle(session.title),
    status: session.status,
    runStatus: run?.status ?? null,
    cwd: session.cwd ?? null,
    model: session.model ?? null,
    childRunCount,
    updatedAt: session.updatedAt
  };
}

export function buildMobileSessionDetail({ session, run, commands, events }) {
  return {
    session: {
      id: session.id,
      title: compactTitle(session.title),
      fullTitle: session.title,
      status: session.status,
      cwd: session.cwd ?? null,
      model: session.model ?? null,
      updatedAt: session.updatedAt
    },
    run: run
      ? {
          id: run.id,
          status: run.status,
          parentRunId: run.parentRunId ?? null,
          automationId: run.automationId ?? null
        }
      : null,
    recentCommands: commands.slice(0, 20).map((command) => ({
      id: command.id,
      status: command.status,
      kind: command.payload.kind,
      prompt: command.payload.prompt ?? null,
      createdAt: command.createdAt,
      completedAt: command.completedAt ?? null,
      acknowledgementMessage: command.acknowledgementMessage ?? null
    })),
    recentEvents: compactRecentEvents(events, 20)
  };
}

function compactTitle(title) {
  const singleLine = title.replaceAll(/\s+/g, " ").trim();
  if (singleLine.length <= 80) {
    return singleLine;
  }
  return `${singleLine.slice(0, 77)}...`;
}

function compactEventMessage(message) {
  const singleLine = normalizeEventMessage(message).replaceAll(/\s+/g, " ").trim();
  if (singleLine.length <= 160) {
    return singleLine;
  }
  return `${singleLine.slice(0, 157)}...`;
}

function compactRecentEvents(events, limit) {
  const compacted = [];

  for (const event of events) {
    const message = compactEventMessage(event.message);
    const previous = compacted[compacted.length - 1];

    if (
      previous &&
      previous.level === event.level &&
      previous.message === message &&
      previous.occurredAt === event.occurredAt
    ) {
      previous.repeatCount += 1;
      continue;
    }

    compacted.push({
      id: event.id,
      level: event.level,
      message,
      occurredAt: event.occurredAt,
      repeatCount: 1
    });
  }

  return compacted.slice(0, limit);
}

function normalizeEventMessage(message) {
  const toolMatch = message.match(/tool_name="?([a-zA-Z0-9_:-]+)"?/);
  if (toolMatch) {
    return `Tool call: ${toolMatch[1]}`;
  }

  if (message.includes('otel.name="message_from_assistant"')) {
    return "Assistant response received";
  }

  if (message.includes("run_sampling_request")) {
    return "Model request running";
  }

  if (message.includes("submission_dispatch")) {
    return "User input dispatched";
  }

  if (message.includes("WouldBlock")) {
    return "Waiting for process output";
  }

  return message;
}
