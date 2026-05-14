import test from "node:test";
import assert from "node:assert/strict";

import { buildMobileSessionDetail } from "../src/server/mobile-api.js";

test("builds a compact mobile session detail payload", () => {
  const detail = buildMobileSessionDetail({
    session: {
      id: "thread_1",
      title: "A very long title for a mobile session detail page that should still preserve the full title separately for later display",
      status: "active",
      cwd: "/Users/demo/workspace",
      model: "gpt-5.4",
      updatedAt: 1775110500
    },
    run: {
      id: "thread_1",
      status: "waitingForInput",
      parentRunId: null,
      automationId: null
    },
    commands: [
      {
        id: "cmd_1",
        status: "completed",
        payload: {
          kind: "sendPrompt",
          prompt: "hello"
        },
        createdAt: "2026-04-02T06:20:00.000Z",
        completedAt: "2026-04-02T06:20:01.000Z"
      }
    ],
    events: [
      {
        id: "evt_1",
        level: "info",
        message: "session_loop{thread_id=thread_1}:submission_dispatch{otel.name=\"op.dispatch.user_input\"}:receiving_stream:handle_responses{otel.name=\"function_call\" tool_name=\"exec_command\"}",
        occurredAt: "2026-04-02T06:20:02.000Z"
      },
      {
        id: "evt_2",
        level: "info",
        message: "session_loop{thread_id=thread_1}:submission_dispatch{otel.name=\"op.dispatch.user_input\"}:receiving_stream:handle_responses{otel.name=\"function_call\" tool_name=\"exec_command\"}",
        occurredAt: "2026-04-02T06:20:02.000Z"
      }
    ]
  });

  assert.equal(detail.session.id, "thread_1");
  assert.equal(detail.run.status, "waitingForInput");
  assert.equal(detail.recentCommands.length, 1);
  assert.equal(detail.recentEvents.length, 1);
  assert.equal(detail.recentEvents[0].repeatCount, 2);
  assert.ok(detail.session.title.endsWith("..."));
  assert.ok(detail.recentEvents[0].message.length <= 160);
  assert.equal(detail.recentEvents[0].message, "Tool call: exec_command");
});
