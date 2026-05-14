import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { LocalCodexAdapter } from "../agent/local-codex-adapter.js";
import { FileCommandStore } from "../server/command-store.js";
import { DeviceRegistry } from "../server/device-registry.js";
import { buildSyncPayload } from "./build-sync-payload.js";

export class SyncEngine {
  #adapter;
  #commandStore;
  #deviceRegistry;
  #sink;
  #workspaceId;
  #workspaceName;

  constructor({
    adapter = new LocalCodexAdapter(),
    commandStore = new FileCommandStore({
      filePath: path.join(
        envValue("CODEX_REMOTE_HOME", "CONTROL_PLANE_HOME") ?? path.join(os.homedir(), ".codex", "control-plane"),
        "commands.jsonl"
      )
    }),
    deviceRegistry = new DeviceRegistry({
      filePath: path.join(
        envValue("CODEX_REMOTE_HOME", "CONTROL_PLANE_HOME") ?? path.join(os.homedir(), ".codex", "control-plane"),
        "device.json"
      )
    }),
    sink,
    workspaceId = "local-mac",
    workspaceName = "Local Mac"
  }) {
    this.#adapter = adapter;
    this.#commandStore = commandStore;
    this.#deviceRegistry = deviceRegistry;
    this.#sink = sink;
    this.#workspaceId = workspaceId;
    this.#workspaceName = workspaceName;
  }

  async buildPayload() {
    const [snapshot, commands, device] = await Promise.all([
      this.#adapter.fetchSnapshot(),
      this.#commandStore.list(),
      this.#deviceRegistry.loadOrCreate({
        workspaceId: this.#workspaceId,
        workspaceName: this.#workspaceName
      })
    ]);

    return buildSyncPayload({
      snapshot,
      commands,
      device,
      generatedAt: new Date().toISOString()
    });
  }

  async syncOnce() {
    const payload = await this.buildPayload();
    const result = await this.#sink.write(payload);
    return {
      payload,
      result
    };
  }
}

export class JsonFileSyncSink {
  #outputPath;

  constructor({ outputPath }) {
    this.#outputPath = outputPath;
  }

  async write(payload) {
    await fs.mkdir(path.dirname(this.#outputPath), { recursive: true });
    await fs.writeFile(this.#outputPath, JSON.stringify(payload, null, 2));
    return {
      type: "json-file",
      outputPath: this.#outputPath
    };
  }
}

function envValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && value !== "") {
      return value;
    }
  }

  return null;
}
