function normalizeTimestamp(value) {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  return value;
}

function buildWorkspaceRows(payload) {
  return [
    {
      id: payload.workspace.id,
      name: payload.workspace.name,
      updated_at: payload.generatedAt
    }
  ];
}

function buildDeviceRows(payload) {
  return [
    {
      id: payload.device.deviceId,
      workspace_id: payload.device.workspaceId,
      workspace_name: payload.device.workspaceName,
      updated_at: payload.device.updatedAt
    }
  ];
}

function buildSessionRows(payload) {
  return payload.sessions.map((session) => ({
    id: session.id,
    workspace_id: payload.workspace.id,
    title: session.title,
    status: session.status,
    latest_run_id: session.latestRunId,
    cwd: session.cwd,
    model: session.model,
    reasoning_effort: session.reasoningEffort,
    updated_at: normalizeTimestamp(session.updatedAt) ?? payload.generatedAt
  }));
}

function buildRunRows(payload) {
  return payload.runs.map((run) => ({
    id: run.id,
    workspace_id: payload.workspace.id,
    session_id: run.sessionId,
    parent_run_id: run.parentRunId,
    automation_id: run.automationId,
    status: run.status,
    summary: run.summary ?? "",
    updated_at: payload.generatedAt
  }));
}

function buildAutomationRows(payload) {
  return payload.automations.map((automation) => ({
    id: automation.id,
    workspace_id: payload.workspace.id,
    name: automation.name,
    is_enabled: automation.isEnabled,
    schedule: automation.schedule,
    cwd: automation.cwd,
    updated_at: normalizeTimestamp(automation.updatedAt) ?? payload.generatedAt
  }));
}

function buildTemplateRows(payload) {
  return payload.templates.map((template) => ({
    id: template.id,
    workspace_id: payload.workspace.id,
    name: template.name,
    path: template.path,
    updated_at: payload.generatedAt
  }));
}

function buildCommandRows(payload) {
  return payload.commands.map((command) => ({
    id: command.id,
    workspace_id: command.workspaceId,
    target_type: command.target.type,
    target_id: command.target.id,
    kind: command.payload.kind,
    payload: command.payload,
    status: command.status,
    requested_at: command.createdAt,
    started_at: command.startedAt,
    completed_at: command.completedAt,
    acknowledgement_message: command.acknowledgementMessage,
    error_message: command.errorMessage
  }));
}

function buildSnapshotRows(payload) {
  return [
    {
      workspace_id: payload.workspace.id,
      device_id: payload.device.deviceId,
      generated_at: payload.generatedAt,
      payload
    }
  ];
}

export function buildSupabaseSyncPlan(payload) {
  return [
    {
      table: "workspaces",
      onConflict: "id",
      rows: buildWorkspaceRows(payload)
    },
    {
      table: "devices",
      onConflict: "id",
      rows: buildDeviceRows(payload)
    },
    {
      table: "automations",
      onConflict: "id",
      rows: buildAutomationRows(payload)
    },
    {
      table: "templates",
      onConflict: "id",
      rows: buildTemplateRows(payload)
    },
    {
      table: "runs",
      onConflict: "id",
      rows: buildRunRows(payload)
    },
    {
      table: "sessions",
      onConflict: "id",
      rows: buildSessionRows(payload)
    },
    {
      table: "commands",
      onConflict: "id",
      rows: buildCommandRows(payload)
    },
    {
      table: "sync_snapshots",
      onConflict: "workspace_id,device_id,generated_at",
      rows: buildSnapshotRows(payload)
    }
  ].filter((step) => step.rows.length > 0);
}

export class SupabaseRestSyncSink {
  #apiKey;
  #baseUrl;
  #fetchImpl;

  constructor({ baseUrl, apiKey, fetchImpl = globalThis.fetch }) {
    this.#baseUrl = baseUrl?.replace(/\/$/, "");
    this.#apiKey = apiKey;
    this.#fetchImpl = fetchImpl;
  }

  async write(payload) {
    if (!this.#baseUrl) {
      throw new Error("Supabase baseUrl is required.");
    }

    if (!this.#apiKey) {
      throw new Error("Supabase apiKey is required.");
    }

    if (typeof this.#fetchImpl !== "function") {
      throw new Error("A fetch implementation is required for Supabase sync.");
    }

    const steps = buildSupabaseSyncPlan(payload);
    const syncedTables = [];

    for (const step of steps) {
      await this.#upsert(step);
      syncedTables.push(step.table);
    }

    return {
      type: "supabase-rest",
      baseUrl: this.#baseUrl,
      syncedTables
    };
  }

  async #upsert(step) {
    const url = new URL(`${this.#baseUrl}/rest/v1/${step.table}`);
    url.searchParams.set("on_conflict", step.onConflict);

    const response = await this.#fetchImpl(url, {
      method: "POST",
      headers: {
        apikey: this.#apiKey,
        Authorization: `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(step.rows)
    });

    if (response.ok) {
      return;
    }

    const details = await response.text();
    throw new Error(`Supabase sync failed for ${step.table}: ${response.status} ${details}`);
  }
}
