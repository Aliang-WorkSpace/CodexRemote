import test from "node:test";
import assert from "node:assert/strict";

import { mapLogRowsToRunEvents } from "../src/agent/local-codex-adapter.js";

test("maps Codex log rows into run events", () => {
  const events = mapLogRowsToRunEvents([
    {
      id: 101,
      ts: 1775100879,
      level: "DEBUG",
      feedback_log_body: "Assistant produced output",
      thread_id: "thread_1"
    },
    {
      id: 102,
      ts: 1775100880,
      level: "ERROR",
      feedback_log_body: "Tool execution failed",
      thread_id: "thread_1"
    }
  ]);

  assert.deepEqual(events, [
    {
      id: "log_101",
      runId: "thread_1",
      level: "info",
      message: "Assistant produced output",
      occurredAt: "2026-04-02T03:34:39.000Z"
    },
    {
      id: "log_102",
      runId: "thread_1",
      level: "error",
      message: "Tool execution failed",
      occurredAt: "2026-04-02T03:34:40.000Z"
    }
  ]);
});
