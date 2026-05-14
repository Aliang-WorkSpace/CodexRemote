import test from "node:test";
import assert from "node:assert/strict";

import { buildSupabaseSyncPlan, SupabaseRestSyncSink } from "../src/sync/supabase-sink.js";

function createPayload() {
  return {
    generatedAt: "2026-04-02T08:00:00.000Z",
    workspace: { id: "local-mac", name: "Local Mac" },
    device: {
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      updatedAt: "2026-04-02T07:59:00.000Z"
    },
    sessions: [
      {
        id: "thread_1",
        title: "Remote control plane",
        status: "active",
        latestRunId: "run_1",
        cwd: "/Users/demo/project",
        model: "gpt-5.4",
        reasoningEffort: "medium",
        updatedAt: 1775116800
      }
    ],
    runs: [
      {
        id: "run_1",
        sessionId: "thread_1",
        parentRunId: null,
        automationId: null,
        status: "waitingForInput",
        summary: "Awaiting remote input"
      }
    ],
    automations: [
      {
        id: "auto_1",
        name: "Morning report",
        isEnabled: true,
        schedule: "FREQ=WEEKLY;BYDAY=MO",
        cwd: "/Users/demo/project",
        updatedAt: 1775116800
      }
    ],
    templates: [
      {
        id: "template_1",
        name: "daily.md",
        path: "/Users/demo/.codex/prompts/daily.md"
      }
    ],
    commands: [
      {
        id: "cmd_1",
        workspaceId: "local-mac",
        target: {
          type: "session",
          id: "thread_1"
        },
        payload: {
          kind: "sendPrompt",
          prompt: "continue",
          attachments: []
        },
        status: "completed",
        createdAt: "2026-04-02T07:58:00.000Z",
        startedAt: "2026-04-02T07:58:01.000Z",
        completedAt: "2026-04-02T07:58:02.000Z",
        acknowledgementMessage: "Done.",
        errorMessage: null
      }
    ]
  };
}

test("buildSupabaseSyncPlan maps sync payload into normalized rows", () => {
  const plan = buildSupabaseSyncPlan(createPayload());

  assert.deepEqual(
    plan.map((step) => step.table),
    [
      "workspaces",
      "devices",
      "automations",
      "templates",
      "runs",
      "sessions",
      "commands",
      "sync_snapshots"
    ]
  );
  assert.equal(plan[1].rows[0].workspace_name, "Local Mac");
  assert.equal(plan[4].rows[0].status, "waitingForInput");
  assert.equal(plan[5].rows[0].reasoning_effort, "medium");
  assert.equal(plan[6].rows[0].acknowledgement_message, "Done.");
});

test("SupabaseRestSyncSink upserts every planned table", async () => {
  const requests = [];
  const sink = new SupabaseRestSyncSink({
    baseUrl: "https://demo.supabase.co",
    apiKey: "service-role-key",
    fetchImpl: async (url, options) => {
      requests.push({
        url: String(url),
        method: options.method,
        headers: options.headers,
        body: JSON.parse(options.body)
      });

      return {
        ok: true,
        async text() {
          return "";
        }
      };
    }
  });

  const result = await sink.write(createPayload());

  assert.equal(result.type, "supabase-rest");
  assert.deepEqual(result.syncedTables, [
    "workspaces",
    "devices",
    "automations",
    "templates",
    "runs",
    "sessions",
    "commands",
    "sync_snapshots"
  ]);
  assert.equal(requests.length, 8);
  assert.match(requests[0].url, /\/rest\/v1\/workspaces\?on_conflict=id$/);
  assert.equal(requests[0].headers.Authorization, "Bearer service-role-key");
  assert.equal(requests[6].body[0].kind, "sendPrompt");
});

test("SupabaseRestSyncSink surfaces HTTP failures with table context", async () => {
  const sink = new SupabaseRestSyncSink({
    baseUrl: "https://demo.supabase.co",
    apiKey: "service-role-key",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async text() {
        return "unauthorized";
      }
    })
  });

  await assert.rejects(
    () => sink.write(createPayload()),
    /Supabase sync failed for workspaces: 401 unauthorized/
  );
});
