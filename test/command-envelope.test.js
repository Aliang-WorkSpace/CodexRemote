import test from "node:test";
import assert from "node:assert/strict";

import {
  commandKinds,
  createCommandEnvelope,
  deserializeCommandEnvelope,
  serializeCommandEnvelope
} from "../src/core/command-envelope.js";

test("serializes and deserializes a sendPrompt command envelope", () => {
  const envelope = createCommandEnvelope({
    id: "cmd_123",
    workspaceId: "ws_main",
    target: {
      type: "session",
      id: "session_1"
    },
    payload: {
      kind: commandKinds.SEND_PROMPT,
      prompt: "Continue the refactor",
      attachments: ["spec.md"]
    },
    requestedAt: "2026-04-02T10:00:00.000Z"
  });

  const decoded = deserializeCommandEnvelope(serializeCommandEnvelope(envelope));

  assert.deepEqual(decoded, envelope);
});

test("defaults command origin to local and lifecycle fields to null", () => {
  const envelope = createCommandEnvelope({
    id: "cmd_456",
    workspaceId: "ws_main",
    target: {
      type: "session",
      id: "session_1"
    },
    payload: {
      kind: commandKinds.STOP_RUN
    }
  });

  assert.equal(envelope.origin, "local");
  assert.equal(envelope.createdByDeviceId, null);
  assert.equal(envelope.claimedByDeviceId, null);
  assert.equal(envelope.claimedAt, null);
  assert.equal(envelope.leaseExpiresAt, null);
  assert.equal(envelope.acknowledgedAt, null);
});

test("rejects an envelope without a target id", () => {
  assert.throws(() => {
    createCommandEnvelope({
      id: "cmd_234",
      workspaceId: "ws_main",
      target: {
        type: "run"
      },
      payload: {
        kind: commandKinds.STOP_RUN
      }
    });
  }, /target\.type and target\.id are required/);
});
