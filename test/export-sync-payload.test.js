import test from "node:test";
import assert from "node:assert/strict";

import { createExportSyncContext } from "../src/sync/export-sync-payload.js";

test("wires export sync paths into the sync engine dependencies", () => {
  const calls = [];

  const context = createExportSyncContext({
    commandStorePath: "/tmp/custom-commands.jsonl",
    deviceFilePath: "/tmp/custom-device.json",
    outputPath: "/tmp/custom-sync.json",
    commandStoreFactory: (options) => {
      calls.push(["commandStore", options.filePath]);
      return { kind: "commandStore" };
    },
    deviceRegistryFactory: (options) => {
      calls.push(["deviceRegistry", options.filePath]);
      return { kind: "deviceRegistry" };
    },
    sinkFactory: (options) => {
      calls.push(["sink", options.outputPath]);
      return { kind: "sink" };
    },
    engineFactory: ({ commandStore, deviceRegistry, sink }) => {
      calls.push(["engine", commandStore.kind, deviceRegistry.kind, sink.kind]);
      return { kind: "engine" };
    }
  });

  assert.deepEqual(calls, [
    ["commandStore", "/tmp/custom-commands.jsonl"],
    ["deviceRegistry", "/tmp/custom-device.json"],
    ["sink", "/tmp/custom-sync.json"],
    ["engine", "commandStore", "deviceRegistry", "sink"]
  ]);
  assert.equal(context.commandStorePath, "/tmp/custom-commands.jsonl");
  assert.equal(context.deviceFilePath, "/tmp/custom-device.json");
  assert.equal(context.outputPath, "/tmp/custom-sync.json");
});
