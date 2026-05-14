import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  LocalCodexAdapter,
  buildResumeCommand
} from "../src/agent/local-codex-adapter.js";

test("builds a codex exec resume command for sendPrompt execution", () => {
  const command = buildResumeCommand({
    sessionId: "thread_1",
    prompt: "Continue the task",
    cwd: "/Users/demo/workspace",
    outputFile: "/tmp/last-message.txt"
  });

  assert.deepEqual(command, {
    file: "codex",
    args: [
      "exec",
      "resume",
      "thread_1",
      "Continue the task",
      "--skip-git-repo-check",
      "--output-last-message",
      "/tmp/last-message.txt"
    ],
    cwd: "/Users/demo/workspace"
  });
});

test("executes sendPrompt by resuming the target session", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-codex-exec-"));
  const calls = [];

  const adapter = new LocalCodexAdapter({
    codexHome: tempRoot,
    now: () => Date.parse("2026-04-02T06:30:00.000Z"),
    queryThreads: async () => [
      {
        id: "thread_1",
        title: "Build remote control plane",
        cwd: "/Users/demo/workspace",
        updated_at: Math.floor(Date.parse("2026-04-02T06:29:00.000Z") / 1000),
        archived: 0,
        model: "gpt-5.4",
        reasoning_effort: "medium"
      }
    ],
    querySpawnEdges: async () => [],
    runCommand: async (command) => {
      calls.push(command);
      const outputFile = command.args[command.args.indexOf("--output-last-message") + 1];
      await fs.writeFile(outputFile, "Done from resumed session");
    }
  });

  const event = await adapter.execute({
    target: { type: "session", id: "thread_1" },
    payload: { kind: "sendPrompt", prompt: "Continue the task", attachments: [] }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "codex");
  assert.equal(calls[0].args[0], "exec");
  assert.equal(calls[0].args[1], "resume");
  assert.equal(calls[0].args[2], "thread_1");
  assert.equal(event.runId, "thread_1");
  assert.match(event.message, /Done from resumed session/);
});

test("stops a run by terminating the latest thread process", async () => {
  const calls = [];
  const adapter = new LocalCodexAdapter({
    queryLatestProcessForThread: async () => "pid:1574:uuid-123",
    runCommand: async (command) => {
      calls.push(command);
    }
  });

  const event = await adapter.execute({
    target: { type: "run", id: "thread_1" },
    payload: { kind: "stopRun", reason: "Stopped from phone" }
  });

  assert.deepEqual(calls[0], {
    file: "kill",
    args: ["-TERM", "1574"],
    cwd: process.cwd()
  });
  assert.match(event.message, /Sent SIGTERM to process 1574/);
});
