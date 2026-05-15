import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDashboardResponse,
  buildMobileBootstrapResponse,
  buildMobileSessionSummary
} from "../src/server/mobile-api.js";

test("truncates long titles for mobile session summaries", () => {
  const summary = buildMobileSessionSummary({
    session: {
      id: "thread_1",
      title: "Automation: AI早报飞书群推送\nAutomation ID: ai\nA very long automation body that should not be shown in full on the phone client",
      status: "active",
      cwd: "/Users/demo/workspace",
      model: "gpt-5.4",
      updatedAt: 1775110500
    },
    run: {
      id: "thread_1",
      status: "waitingForInput"
    },
    childRunCount: 2
  });

  assert.equal(summary.id, "thread_1");
  assert.equal(summary.status, "active");
  assert.equal(summary.runStatus, "waitingForInput");
  assert.equal(summary.childRunCount, 2);
  assert.ok(summary.title.length <= 81);
  assert.ok(!summary.title.includes("\n"));
});

test("builds a compact dashboard payload", () => {
  const payload = buildDashboardResponse({
    snapshot: {
      workspace: { id: "local-mac", name: "Local Mac" },
      sessions: [
        {
          id: "thread_1",
          title: "Build remote control plane",
          status: "active",
          cwd: "/Users/demo/workspace",
          model: "gpt-5.4",
          updatedAt: 1775110500
        }
      ],
      runs: [
        {
          id: "thread_1",
          sessionId: "thread_1",
          parentRunId: null,
          status: "waitingForInput"
        }
      ],
      automations: [
        {
          id: "ai",
          name: "AI早报飞书群推送",
          isEnabled: true
        }
      ],
      templates: [
        {
          id: "pua",
          name: "pua.md"
        }
      ]
    },
    commands: [
      {
        id: "cmd_1",
        status: "completed",
        target: { type: "session", id: "thread_1" },
        payload: { kind: "sendPrompt" },
        createdAt: "2026-04-02T06:20:00.000Z"
      }
    ],
    device: {
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      pairingToken: "pair_123",
      updatedAt: "2026-04-02T06:20:00.000Z"
    }
  });

  assert.equal(payload.workspace.id, "local-mac");
  assert.equal(payload.stats.sessionCount, 1);
  assert.equal(payload.stats.activeRunCount, 1);
  assert.equal(payload.stats.automationCount, 1);
  assert.equal(payload.stats.templateCount, 1);
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.templates.length, 1);
  assert.equal(payload.recentCommands.length, 1);
});

test("builds a bootstrap payload for the mobile client", () => {
  const payload = buildMobileBootstrapResponse({
    snapshot: {
      workspace: { id: "local-mac", name: "Local Mac" },
      sessions: [],
      runs: [],
      automations: [],
      templates: []
    },
    commands: [],
    device: {
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      updatedAt: "2026-04-02T00:00:00.000Z"
    },
    syncStatus: {
      enabled: true,
      lastSucceededAt: "2026-04-02T01:00:00.000Z"
    },
    publicBaseUrl: "http://192.0.2.10:8793"
  });

  assert.equal(payload.transport.baseUrl, "http://192.0.2.10:8793");
  assert.equal(payload.sync.enabled, true);
  assert.equal(payload.supportedCommands.includes("sendPrompt"), true);
  assert.equal(payload.dashboard.stats.sessionCount, 0);
});
