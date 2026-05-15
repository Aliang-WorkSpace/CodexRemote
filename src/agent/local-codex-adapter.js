import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { runStatuses } from "../core/domain-models.js";

const execFileAsync = promisify(execFile);

export class LocalCodexAdapter {
  #codexHome;
  #workspaceId;
  #workspaceName;
  #now;
  #queryThreadsOverride;
  #querySpawnEdgesOverride;
  #queryLatestProcessForThreadOverride;
  #runCommand;

  constructor({
    codexHome = path.join(os.homedir(), ".codex"),
    workspaceId = "local-mac",
    workspaceName = "Local Mac",
    now = () => Date.now(),
    queryThreads,
    querySpawnEdges,
    queryLatestProcessForThread,
    runCommand
  } = {}) {
    this.#codexHome = codexHome;
    this.#workspaceId = workspaceId;
    this.#workspaceName = workspaceName;
    this.#now = now;
    this.#queryThreadsOverride = queryThreads;
    this.#querySpawnEdgesOverride = querySpawnEdges;
    this.#queryLatestProcessForThreadOverride = queryLatestProcessForThread;
    this.#runCommand = runCommand ?? runLocalCommand;
  }

  async fetchSnapshot() {
    const [threads, spawnEdges, automations, threadNameOverrides] = await Promise.all([
      this.#queryThreads(),
      this.#querySpawnEdges(),
      this.#loadAutomations(),
      this.#loadThreadNameOverrides()
    ]);
    const templates = await this.#loadTemplates();
    const quota = await this.#loadQuotaSnapshot(threads);

    const parentByChild = new Map(
      spawnEdges.map((edge) => [edge.child_thread_id, edge.parent_thread_id])
    );

    return {
      workspace: {
        id: this.#workspaceId,
        name: this.#workspaceName
      },
      sessions: threads.map((thread) => ({
        id: thread.id,
        title: threadNameOverrides.get(thread.id) ?? thread.title,
        status: mapSessionStatus(thread, this.#now()),
        latestRunId: thread.id,
        cwd: thread.cwd,
        model: thread.model,
        reasoningEffort: thread.reasoning_effort ?? null,
        updatedAt: thread.updated_at
      })),
      runs: threads.map((thread) => ({
        id: thread.id,
        sessionId: thread.id,
        parentRunId: parentByChild.get(thread.id) ?? null,
        automationId: inferAutomationId(thread.title, automations),
        status: mapRunStatus(thread, this.#now()),
        summary: threadNameOverrides.get(thread.id) ?? thread.title
      })),
      automations
      ,
      templates,
      quota
    };
  }

  async execute(commandEnvelope) {
    switch (commandEnvelope.payload.kind) {
      case "startAutomation":
        return this.#startAutomation(
          commandEnvelope.payload.automationID,
          commandEnvelope.payload.input ?? null
        );
      case "startTemplate":
        return this.#startTemplate(
          commandEnvelope.payload.templateID,
          commandEnvelope.payload.input ?? null
        );
      case "sendPrompt":
        return this.#resumeSessionWithPrompt(
          commandEnvelope.target.id,
          commandEnvelope.payload.prompt
        );
      case "resumeRun":
        return this.#resumeSessionWithPrompt(
          commandEnvelope.target.id,
          "Continue from the current state."
        );
      case "retryRun":
        return this.#resumeSessionWithPrompt(
          commandEnvelope.target.id,
          "Retry the last request from scratch."
        );
      case "stopRun":
        return this.#stopThreadProcess(commandEnvelope.target.id);
      default:
        return {
          id: randomUUID(),
          runId: commandEnvelope.target.id,
          level: "warning",
          message: `Command ${commandEnvelope.payload.kind} is not implemented yet`,
          occurredAt: new Date(this.#now()).toISOString()
        };
    }
  }

  async fetchRecentEvents({ runId, limit = 20 } = {}) {
    let logs = [];

    try {
      logs = await querySqliteJson(
        path.join(this.#codexHome, "logs_1.sqlite"),
        `
          select
            id,
            ts,
            level,
            feedback_log_body,
            thread_id
          from logs
          where thread_id is not null
          ${runId ? `and thread_id = '${escapeSqlLiteral(runId)}'` : ""}
          order by ts desc, id desc
          limit ${Number(limit)}
        `
      );
    } catch (error) {
      if (isMissingLogsTableError(error)) {
        return [];
      }

      throw error;
    }

    return mapLogRowsToRunEvents(logs);
  }

  async #queryThreads() {
    if (this.#queryThreadsOverride) {
      return this.#queryThreadsOverride();
    }

    return querySqliteJson(
      path.join(this.#codexHome, "state_5.sqlite"),
      `
        select
          id,
          title,
          cwd,
          updated_at,
          archived,
          model,
          reasoning_effort,
          rollout_path
        from threads
        order by updated_at desc
        limit 200
      `
    );
  }

  async #querySpawnEdges() {
    if (this.#querySpawnEdgesOverride) {
      return this.#querySpawnEdgesOverride();
    }

    return querySqliteJson(
      path.join(this.#codexHome, "state_5.sqlite"),
      `
        select
          parent_thread_id,
          child_thread_id,
          status
        from thread_spawn_edges
      `
    );
  }

  async #queryLatestProcessForThread(threadId) {
    if (this.#queryLatestProcessForThreadOverride) {
      return this.#queryLatestProcessForThreadOverride(threadId);
    }

    const rows = await querySqliteJson(
      path.join(this.#codexHome, "logs_1.sqlite"),
      `
        select process_uuid
        from logs
        where thread_id = '${escapeSqlLiteral(threadId)}'
          and process_uuid is not null
        order by ts desc, id desc
        limit 1
      `
    );

    return rows[0]?.process_uuid ?? null;
  }

  async #loadThreadNameOverrides() {
    const sessionIndexPath = path.join(this.#codexHome, "session_index.jsonl");
    let content = "";

    try {
      content = await fs.readFile(sessionIndexPath, "utf8");
    } catch {
      return new Map();
    }

    const overrides = new Map();

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const record = JSON.parse(trimmed);
        const threadId = typeof record.id === "string" ? record.id : null;
        const threadName = typeof record.thread_name === "string" ? record.thread_name.trim() : "";
        if (threadId && threadName) {
          overrides.set(threadId, threadName);
        }
      } catch {
        // Ignore malformed legacy lines and keep going with best-effort overrides.
      }
    }

    return overrides;
  }

  async #loadAutomations() {
    const root = path.join(this.#codexHome, "automations");
    let entries = [];

    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const automations = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const automationPath = path.join(root, entry.name, "automation.toml");

      try {
        const content = await fs.readFile(automationPath, "utf8");
        automations.push(parseAutomationToml(content));
      } catch {
        continue;
      }
    }

    return automations.filter((automation) => automation.id && automation.name);
  }

  async #loadTemplates() {
    const root = path.join(this.#codexHome, "prompts");
    let entries = [];

    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const templates = [];

    for (const entry of entries) {
      const templatePath = path.join(root, entry.name);
      if (!(entry.isFile() || entry.isSymbolicLink())) {
        continue;
      }

      const templateId = entry.name.replace(/\.md$/i, "");
      templates.push({
        id: templateId,
        name: entry.name,
        path: templatePath
      });
    }

    return templates.sort((left, right) => left.name.localeCompare(right.name));
  }

  async #startAutomation(automationId, input) {
    const automations = await this.#loadAutomations();
    const automation = automations.find((item) => item.id === automationId);

    if (!automation?.prompt) {
      throw new Error(`Automation ${automationId} was not found or has no prompt`);
    }

    const prompt = joinPromptParts(automation.prompt, input);
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "codex-remote-"));
    const outputFile = path.join(outputDir, `${automationId}-automation-last-message.txt`);
    const command = buildExecCommand({
      prompt,
      cwd: automation.cwd ?? process.cwd(),
      outputFile,
      model: automation.model ?? null,
      reasoningEffort: automation.reasoningEffort ?? null
    });

    await this.#runCommand(command);
    const lastMessage = await readOptionalFile(outputFile);

    return {
      id: randomUUID(),
      runId: automationId,
      level: "info",
      message: lastMessage?.trim()
        ? `Automation ${automationId} completed. Last message: ${truncate(lastMessage.trim(), 160)}`
        : `Automation ${automationId} started successfully`,
      occurredAt: new Date(this.#now()).toISOString()
    };
  }

  async #startTemplate(templateId, input) {
    const templatePath = await this.#resolveTemplatePath(templateId);
    const templateContent = await fs.readFile(templatePath, "utf8");
    const prompt = joinPromptParts(templateContent, input);
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "codex-remote-"));
    const outputFile = path.join(outputDir, `${templateId}-template-last-message.txt`);
    const command = buildExecCommand({
      prompt,
      cwd: process.cwd(),
      outputFile
    });

    await this.#runCommand(command);
    const lastMessage = await readOptionalFile(outputFile);

    return {
      id: randomUUID(),
      runId: templateId,
      level: "info",
      message: lastMessage?.trim()
        ? `Template ${templateId} completed. Last message: ${truncate(lastMessage.trim(), 160)}`
        : `Template ${templateId} started successfully`,
      occurredAt: new Date(this.#now()).toISOString()
    };
  }

  async #resumeSessionWithPrompt(sessionId, prompt) {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "codex-remote-"));
    const outputFile = path.join(outputDir, `${sessionId}-last-message.txt`);
    const session = await this.#loadSession(sessionId);
    const command = buildResumeCommand({
      sessionId,
      prompt,
      cwd: session?.cwd ?? process.cwd(),
      outputFile
    });

    await this.#runCommand(command);
    const lastMessage = await readOptionalFile(outputFile);

    return {
      id: randomUUID(),
      runId: sessionId,
      level: "info",
      message: lastMessage?.trim()
        ? `Command executed. Last message: ${truncate(lastMessage.trim(), 160)}`
        : `Command executed for session ${sessionId}`,
      occurredAt: new Date(this.#now()).toISOString()
    };
  }

  async #stopThreadProcess(threadId) {
    const processUUID = await this.#queryLatestProcessForThread(threadId);
    const pid = parsePid(processUUID);

    if (!pid) {
      return {
        id: randomUUID(),
        runId: threadId,
        level: "warning",
        message: `No active process found for session ${threadId}`,
        occurredAt: new Date(this.#now()).toISOString()
      };
    }

    await this.#runCommand({
      file: "kill",
      args: ["-TERM", String(pid)],
      cwd: process.cwd()
    });

    return {
      id: randomUUID(),
      runId: threadId,
      level: "info",
      message: `Sent SIGTERM to process ${pid} for session ${threadId}`,
      occurredAt: new Date(this.#now()).toISOString()
    };
  }

  async #loadSession(sessionId) {
    const snapshot = await this.fetchSnapshot();
    return snapshot.sessions.find((session) => session.id === sessionId) ?? null;
  }

  async #resolveTemplatePath(templateId) {
    const candidates = [];
    if (path.isAbsolute(templateId)) {
      candidates.push(templateId);
    } else {
      candidates.push(path.join(this.#codexHome, "prompts", templateId));
      if (!templateId.endsWith(".md")) {
        candidates.push(path.join(this.#codexHome, "prompts", `${templateId}.md`));
      }
    }

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new Error(`Template ${templateId} could not be resolved`);
  }

  async #loadQuotaSnapshot(threads) {
    const rolloutPaths = threads
      .map((thread) => thread.rollout_path)
      .filter(Boolean);

    for (const rolloutPath of rolloutPaths) {
      const quota = await readQuotaSnapshotFromRollout(rolloutPath);
      if (quota) {
        return quota;
      }
    }

    return null;
  }
}

export function parseAutomationToml(content) {
  return {
    id: extractQuotedValue(content, "id"),
    name: extractQuotedValue(content, "name"),
    isEnabled: extractQuotedValue(content, "status") === "ACTIVE",
    schedule: extractQuotedValue(content, "rrule"),
    cwd: extractFirstArrayValue(content, "cwds"),
    prompt: extractQuotedValue(content, "prompt"),
    model: extractQuotedValue(content, "model"),
    reasoningEffort: extractQuotedValue(content, "reasoning_effort"),
    updatedAt: extractIntegerValue(content, "updated_at")
  };
}

export function mapLogRowsToRunEvents(rows) {
  return rows.map((row) => ({
    id: `log_${row.id}`,
    runId: row.thread_id,
    level: mapLogLevel(row.level),
    message: row.feedback_log_body ?? "",
    occurredAt: new Date(row.ts * 1000).toISOString()
  }));
}

export function buildResumeCommand({ sessionId, prompt, cwd, outputFile }) {
  return {
    file: "codex",
    args: [
      "exec",
      "resume",
      sessionId,
      prompt,
      "--skip-git-repo-check",
      "--output-last-message",
      outputFile
    ],
    cwd
  };
}

export function buildExecCommand({
  prompt,
  cwd,
  outputFile,
  model = null,
  reasoningEffort = null
}) {
  const args = ["exec", "--skip-git-repo-check", "-C", cwd];

  if (model) {
    args.push("-m", model);
  }

  if (reasoningEffort) {
    args.push("-c", `reasoning_effort="${reasoningEffort}"`);
  }

  args.push("--output-last-message", outputFile, prompt);

  return {
    file: "codex",
    args,
    cwd
  };
}

async function querySqliteJson(databasePath, sql) {
  const { stdout } = await execFileAsync("sqlite3", ["-json", databasePath, sql]);
  if (!stdout.trim()) {
    return [];
  }
  return JSON.parse(stdout);
}

async function runLocalCommand({ file, args, cwd }) {
  await execFileAsync(file, args, { cwd });
}

async function readOptionalFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readQuotaSnapshotFromRollout(rolloutPath) {
  const content = await readOptionalFile(rolloutPath);
  if (!content) {
    return null;
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let parsedLine;

    try {
      parsedLine = JSON.parse(lines[index]);
    } catch {
      continue;
    }

    const payload = parsedLine?.payload;
    if (payload?.type !== "token_count" || !payload.rate_limits) {
      continue;
    }

    const rateLimits = payload.rate_limits;
    const primary = buildQuotaWindow(rateLimits.primary);
    const secondary = buildQuotaWindow(rateLimits.secondary);

    if (!primary && !secondary) {
      continue;
    }

    return {
      planType: rateLimits.plan_type ?? null,
      credits: normalizeNumber(rateLimits.credits),
      primary,
      secondary,
      sourcedAt: parsedLine.timestamp ?? null
    };
  }

  return null;
}

function buildQuotaWindow(window) {
  if (!window || window.used_percent == null) {
    return null;
  }

  const usedPercent = normalizeUsedPercent(window.used_percent);
  if (usedPercent == null) {
    return null;
  }

  return {
    usedPercent,
    remainingPercent: Math.max(0, Math.min(100, Number((100 - usedPercent).toFixed(1)))),
    windowMinutes: normalizeNumber(window.window_minutes),
    resetsAt: normalizeNumber(window.resets_at)
  };
}

function normalizeUsedPercent(value) {
  const numeric = normalizeNumber(value);
  if (numeric == null) {
    return null;
  }

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Number(percent.toFixed(1))));
}

function normalizeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapSessionStatus(thread, now) {
  if (thread.archived) {
    return "archived";
  }

  if (isRecentlyUpdated(thread.updated_at, now)) {
    return "active";
  }

  return "idle";
}

function mapRunStatus(thread, now) {
  if (thread.archived) {
    return runStatuses.COMPLETED;
  }

  if (isRecentlyUpdated(thread.updated_at, now)) {
    return runStatuses.WAITING_FOR_INPUT;
  }

  return runStatuses.IDLE;
}

function isRecentlyUpdated(updatedAtSeconds, nowMs) {
  return nowMs - updatedAtSeconds * 1000 <= 15 * 60 * 1000;
}

function inferAutomationId(title, automations) {
  const automation = automations.find((candidate) => title.includes(`Automation ID: ${candidate.id}`));
  return automation?.id ?? null;
}

function mapLogLevel(level) {
  switch (level) {
    case "ERROR":
      return "error";
    case "WARN":
      return "warning";
    default:
      return "info";
  }
}

function escapeSqlLiteral(value) {
  return value.replaceAll("'", "''");
}

function isMissingLogsTableError(error) {
  const message = String(error?.stderr ?? error?.message ?? "");
  return message.includes("no such table: logs");
}

function parsePid(processUUID) {
  if (!processUUID) {
    return null;
  }

  const match = processUUID.match(/^pid:(\d+):/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function truncate(value, limit) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 3)}...`;
}

function joinPromptParts(basePrompt, extraInput) {
  if (!extraInput) {
    return basePrompt;
  }

  return `${basePrompt}\n\nAdditional input:\n${extraInput}`;
}

function extractQuotedValue(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
  return match ? match[1] : null;
}

function extractIntegerValue(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, "m"));
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractFirstArrayValue(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*\\["([^"]*)"`, "m"));
  return match ? match[1] : null;
}
