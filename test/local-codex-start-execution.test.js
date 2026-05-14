import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildExecCommand,
  LocalCodexAdapter
} from "../src/agent/local-codex-adapter.js";

test("builds a codex exec command for automation or template execution", () => {
  const command = buildExecCommand({
    prompt: "Run the automation",
    cwd: "/Users/demo/workspace",
    outputFile: "/tmp/out.txt",
    model: "gpt-5.4",
    reasoningEffort: "medium"
  });

  assert.deepEqual(command, {
    file: "codex",
    args: [
      "exec",
      "--skip-git-repo-check",
      "-C",
      "/Users/demo/workspace",
      "-m",
      "gpt-5.4",
      "-c",
      "reasoning_effort=\"medium\"",
      "--output-last-message",
      "/tmp/out.txt",
      "Run the automation"
    ],
    cwd: "/Users/demo/workspace"
  });
});

test("starts an automation by executing its prompt", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-codex-automation-"));
  const automationDir = path.join(tempRoot, "automations", "ai");
  await fs.mkdir(automationDir, { recursive: true });
  await fs.writeFile(
    path.join(automationDir, "automation.toml"),
    [
      'id = "ai"',
      'name = "AI早报飞书群推送"',
      `prompt = "Collect today's AI news"`,
      'model = "gpt-5.4"',
      'reasoning_effort = "medium"',
      'status = "ACTIVE"',
      'cwds = ["/Users/demo/workspace"]'
    ].join("\n")
  );

  const calls = [];
  const adapter = new LocalCodexAdapter({
    codexHome: tempRoot,
    runCommand: async (command) => {
      calls.push(command);
    }
  });

  const event = await adapter.execute({
    target: { type: "automation", id: "ai" },
    payload: { kind: "startAutomation", automationID: "ai", input: "Focus on model launches." }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "codex");
  assert.match(calls[0].args.at(-1), /Collect today's AI news/);
  assert.match(calls[0].args.at(-1), /Focus on model launches/);
  assert.match(event.message, /Automation ai started successfully/);
});

test("starts a template by executing its prompt file", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-codex-template-"));
  const promptsDir = path.join(tempRoot, "prompts");
  await fs.mkdir(promptsDir, { recursive: true });
  await fs.writeFile(path.join(promptsDir, "daily.md"), "Write a concise daily status.");

  const calls = [];
  const adapter = new LocalCodexAdapter({
    codexHome: tempRoot,
    runCommand: async (command) => {
      calls.push(command);
    }
  });

  const event = await adapter.execute({
    target: { type: "template", id: "daily" },
    payload: { kind: "startTemplate", templateID: "daily", input: "Cover backend progress." }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "codex");
  assert.match(calls[0].args.at(-1), /Write a concise daily status/);
  assert.match(calls[0].args.at(-1), /Cover backend progress/);
  assert.match(event.message, /Template daily started successfully/);
});
