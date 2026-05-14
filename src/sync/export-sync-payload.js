import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DeviceRegistry } from "../server/device-registry.js";
import { FileCommandStore } from "../server/command-store.js";
import { JsonFileSyncSink, SyncEngine } from "./sync-engine.js";

const controlPlaneRoot =
  envValue("CODEX_REMOTE_HOME", "CONTROL_PLANE_HOME") ?? path.join(os.homedir(), ".codex", "control-plane");

export function createExportSyncContext({
  commandStorePath = envValue("CODEX_REMOTE_COMMAND_STORE_PATH", "CONTROL_PLANE_COMMAND_STORE_PATH") ??
    path.join(controlPlaneRoot, "commands.jsonl"),
  deviceFilePath = envValue("CODEX_REMOTE_DEVICE_FILE_PATH", "CONTROL_PLANE_DEVICE_FILE_PATH") ??
    path.join(controlPlaneRoot, "device.json"),
  outputPath = envValue("CODEX_REMOTE_SYNC_EXPORT_PATH", "CONTROL_PLANE_SYNC_EXPORT_PATH") ??
    path.join(controlPlaneRoot, "sync-payload.json"),
  commandStoreFactory = (options) => new FileCommandStore(options),
  deviceRegistryFactory = (options) => new DeviceRegistry(options),
  sinkFactory = (options) => new JsonFileSyncSink(options),
  engineFactory = (options) => new SyncEngine(options)
} = {}) {
  const commandStore = commandStoreFactory({ filePath: commandStorePath });
  const deviceRegistry = deviceRegistryFactory({ filePath: deviceFilePath });
  const sink = sinkFactory({ outputPath });
  const engine = engineFactory({
    commandStore,
    deviceRegistry,
    sink
  });

  return {
    commandStorePath,
    deviceFilePath,
    outputPath,
    commandStore,
    deviceRegistry,
    sink,
    engine
  };
}

async function main() {
  const { engine, outputPath } = createExportSyncContext();

  const { result } = await engine.syncOnce();

  console.log(`Sync payload written to ${result.outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
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
