import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileCommandStore } from "../src/server/command-store.js";

test("persists commands as jsonl records", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "command-store-"));
  const filePath = path.join(tempDir, "commands.jsonl");

  const store = new FileCommandStore({ filePath });
  const record = await store.create({
    id: "cmd_1",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_1" },
    payload: { kind: "sendPrompt", prompt: "hello", attachments: [] },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  const content = await fs.readFile(filePath, "utf8");
  const parsed = content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(record.status, "queued");
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "cmd_1");
});

test("preserves command origin and lifecycle fields in stored records", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "command-store-"));
  const filePath = path.join(tempDir, "commands.jsonl");

  const store = new FileCommandStore({ filePath });
  const record = await store.create({
    id: "cmd_3",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_3" },
    payload: { kind: "resumeRun" },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  assert.equal(record.origin, "local");
  assert.equal(record.createdByDeviceId, null);
  assert.equal(record.claimedByDeviceId, null);
  assert.equal(record.claimedAt, null);
  assert.equal(record.leaseExpiresAt, null);
  assert.equal(record.acknowledgedAt, null);
});

test("updates command status and keeps the latest in memory", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "command-store-"));
  const filePath = path.join(tempDir, "commands.jsonl");

  const store = new FileCommandStore({ filePath });
  await store.create({
    id: "cmd_2",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_2" },
    payload: { kind: "retryRun" },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  const updated = await store.updateStatus("cmd_2", {
    status: "completed",
    completedAt: "2026-04-02T00:00:02.000Z"
  });

  assert.equal(updated.status, "completed");
  assert.equal((await store.list())[0].status, "completed");

  const content = await fs.readFile(filePath, "utf8");
  assert.equal(content.trim().split("\n").length, 2);
});
