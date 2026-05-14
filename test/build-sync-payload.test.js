import test from "node:test";
import assert from "node:assert/strict";

import { buildSyncPayload } from "../src/sync/build-sync-payload.js";

test("builds a cloud-sync-friendly payload from local state", () => {
  const payload = buildSyncPayload({
    generatedAt: "2026-04-02T06:40:00.000Z",
    snapshot: {
      workspace: { id: "local-mac", name: "Local Mac" },
      sessions: [
        {
          id: "thread_1",
          title: "Build remote control plane",
          status: "active",
          latestRunId: "run_1",
          cwd: "/Users/demo/workspace",
          model: "gpt-5.4",
          reasoningEffort: "medium",
          updatedAt: 1775112000
        }
      ],
      runs: [
        {
          id: "run_1",
          sessionId: "thread_1",
          parentRunId: null,
          automationId: null,
          status: "waitingForInput",
          summary: "Awaiting remote prompt"
        }
      ],
      automations: [
        {
          id: "ai",
          name: "AI早报飞书群推送",
          isEnabled: true,
          schedule: "FREQ=WEEKLY;BYDAY=MO",
          cwd: "/Users/demo/workspace",
          updatedAt: 1775111900
        }
      ],
      templates: [
        {
          id: "pua",
          name: "pua.md",
          path: "/Users/demo/.codex/prompts/pua.md"
        }
      ]
    },
    commands: [
      {
        id: "cmd_1",
        workspaceId: "local-mac",
        target: { type: "session", id: "thread_1" },
        payload: { kind: "sendPrompt", prompt: "hello", attachments: [] },
        origin: "remote",
        createdByDeviceId: "device_1",
        claimedByDeviceId: "device_2",
        claimedAt: "2026-04-02T06:35:00.000Z",
        leaseExpiresAt: "2026-04-02T06:40:00.000Z",
        acknowledgedAt: "2026-04-02T06:35:03.000Z",
        status: "completed",
        createdAt: "2026-04-02T06:35:00.000Z",
        startedAt: "2026-04-02T06:35:01.000Z",
        completedAt: "2026-04-02T06:35:02.000Z",
        acknowledgementMessage: "Command executed.",
        errorMessage: null
      }
    ],
    device: {
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      updatedAt: "2026-04-02T06:30:00.000Z"
    }
  });

  assert.equal(payload.workspace.id, "local-mac");
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.runs.length, 1);
  assert.equal(payload.automations.length, 1);
  assert.equal(payload.templates.length, 1);
  assert.equal(payload.commands[0].acknowledgementMessage, "Command executed.");
  assert.equal(payload.commands[0].origin, "remote");
  assert.equal(payload.commands[0].createdByDeviceId, "device_1");
  assert.equal(payload.commands[0].claimedByDeviceId, "device_2");
  assert.equal(payload.commands[0].acknowledgedAt, "2026-04-02T06:35:03.000Z");
});
