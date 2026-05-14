import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  LocalCodexAdapter,
  parseAutomationToml
} from "../src/agent/local-codex-adapter.js";

test("parses the key automation fields from automation.toml", () => {
  const automation = parseAutomationToml(`
version = 1
id = "ai"
name = "AI早报飞书群推送"
status = "ACTIVE"
rrule = "FREQ=WEEKLY;BYDAY=MO,TU;BYHOUR=10;BYMINUTE=30"
cwds = ["/Users/demo/workspace"]
updated_at = 1775015700000
`);

  assert.deepEqual(automation, {
    id: "ai",
    name: "AI早报飞书群推送",
    isEnabled: true,
    schedule: "FREQ=WEEKLY;BYDAY=MO,TU;BYHOUR=10;BYMINUTE=30",
    cwd: "/Users/demo/workspace",
    prompt: null,
    model: null,
    reasoningEffort: null,
    updatedAt: 1775015700000
  });
});

test("maps local Codex state into sessions, runs, and automations", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-adapter-"));
  const automationDir = path.join(tempRoot, "automations", "ai");
  const promptsDir = path.join(tempRoot, "prompts");
  const sessionsDir = path.join(tempRoot, "sessions", "2026", "04", "02");
  await fs.mkdir(automationDir, { recursive: true });
  await fs.mkdir(promptsDir, { recursive: true });
  await fs.mkdir(sessionsDir, { recursive: true });
  const rolloutPath = path.join(sessionsDir, "rollout.jsonl");
  await fs.writeFile(
    path.join(automationDir, "automation.toml"),
    [
      'id = "ai"',
      'name = "AI早报飞书群推送"',
      'status = "ACTIVE"',
      'rrule = "FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=30"',
      'cwds = ["/Users/demo/workspace"]',
      "updated_at = 1775015700000"
    ].join("\n")
  );
  await fs.writeFile(path.join(promptsDir, "daily.md"), "Write a short daily update.");
  await fs.writeFile(
    rolloutPath,
    [
      JSON.stringify({
        timestamp: "2026-04-02T10:01:00.000Z",
        payload: {
          type: "token_count",
          rate_limits: {
            plan_type: "plus",
            credits: 12.5,
            primary: {
              used_percent: 28,
              window_minutes: 300,
              resets_at: 1775019600
            },
            secondary: {
              used_percent: 1,
              window_minutes: 10080,
              resets_at: 1775600000
            }
          }
        }
      })
    ].join("\n")
  );

  const adapter = new LocalCodexAdapter({
    codexHome: tempRoot,
    now: () => Date.parse("2026-04-02T10:05:00.000Z"),
    queryThreads: async () => [
      {
        id: "thread_active",
        title: "Build remote control plane",
        cwd: "/Users/demo/workspace",
        updated_at: Math.floor(Date.parse("2026-04-02T10:00:00.000Z") / 1000),
        archived: 0,
        model: "gpt-5.4",
        reasoning_effort: "medium",
        rollout_path: rolloutPath
      },
      {
        id: "thread_idle",
        title: "Older planning session",
        cwd: "/Users/demo/workspace",
        updated_at: Math.floor(Date.parse("2026-04-01T10:00:00.000Z") / 1000),
        archived: 0,
        model: "gpt-5.4",
        reasoning_effort: "medium",
        rollout_path: null
      }
    ],
    querySpawnEdges: async () => [
      {
        parent_thread_id: "thread_active",
        child_thread_id: "thread_idle",
        status: "running"
      }
    ]
  });

  const snapshot = await adapter.fetchSnapshot();

  assert.equal(snapshot.workspace.id, "local-mac");
  assert.equal(snapshot.sessions.length, 2);
  assert.equal(snapshot.automations.length, 1);
  assert.equal(snapshot.templates.length, 1);
  assert.equal(snapshot.quota.primary.remainingPercent, 72);
  assert.equal(snapshot.quota.secondary.remainingPercent, 0);
  assert.equal(snapshot.quota.primary.windowMinutes, 300);
  assert.deepEqual(
    snapshot.runs.map((run) => ({ id: run.id, parentRunId: run.parentRunId, status: run.status })),
    [
      { id: "thread_active", parentRunId: null, status: "waitingForInput" },
      { id: "thread_idle", parentRunId: "thread_active", status: "idle" }
    ]
  );
  assert.equal(snapshot.templates[0].id, "daily");
});

test("returns an empty event list when the local logs database has no logs table", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codex-adapter-"));
  await fs.writeFile(path.join(tempRoot, "logs_1.sqlite"), "");

  const adapter = new LocalCodexAdapter({
    codexHome: tempRoot
  });

  const events = await adapter.fetchRecentEvents({
    runId: "thread_missing_logs",
    limit: 5
  });

  assert.deepEqual(events, []);
});
