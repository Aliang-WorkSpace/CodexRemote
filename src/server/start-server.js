import { LocalCodexAdapter } from "../agent/local-codex-adapter.js";
import path from "node:path";
import os from "node:os";

import { FileCommandStore } from "./command-store.js";
import { createCodexRemoteServer } from "./create-server.js";
import { DeviceRegistry } from "./device-registry.js";
import { JsonFileSyncSink, SyncEngine } from "../sync/sync-engine.js";
import { SupabaseRestSyncSink } from "../sync/supabase-sink.js";
import { SyncScheduler } from "../sync/sync-scheduler.js";
import { BonjourAdvertiser } from "./bonjour-advertiser.js";
import { buildAccessUrls } from "./network-info.js";

const port = Number(envValue("CODEX_REMOTE_PORT", "CONTROL_PLANE_PORT") ?? "8793");
const host = envValue("CODEX_REMOTE_HOST", "CONTROL_PLANE_HOST") ?? "127.0.0.1";
const authToken = envValue("CODEX_REMOTE_TOKEN", "CONTROL_PLANE_TOKEN") ?? null;
const syncTarget = envValue("CODEX_REMOTE_SYNC_TARGET", "CONTROL_PLANE_SYNC_TARGET") ?? "none";
const syncIntervalMs = Number(envValue("CODEX_REMOTE_SYNC_INTERVAL_MS", "CONTROL_PLANE_SYNC_INTERVAL_MS") ?? "0");
const workspaceId = envValue("CODEX_REMOTE_WORKSPACE_ID", "CONTROL_PLANE_WORKSPACE_ID") ?? "local-mac";
const workspaceName = envValue("CODEX_REMOTE_WORKSPACE_NAME", "CONTROL_PLANE_WORKSPACE_NAME") ?? "Local Mac";
const controlPlaneRoot =
  envValue("CODEX_REMOTE_HOME", "CONTROL_PLANE_HOME") ?? path.join(os.homedir(), ".codex", "control-plane");
const commandStorePath =
  envValue("CODEX_REMOTE_COMMAND_STORE_PATH", "CONTROL_PLANE_COMMAND_STORE_PATH") ??
  path.join(controlPlaneRoot, "commands.jsonl");
const deviceFilePath =
  envValue("CODEX_REMOTE_DEVICE_FILE_PATH", "CONTROL_PLANE_DEVICE_FILE_PATH") ??
  path.join(controlPlaneRoot, "device.json");
const syncExportPath =
  envValue("CODEX_REMOTE_SYNC_EXPORT_PATH", "CONTROL_PLANE_SYNC_EXPORT_PATH") ??
  path.join(controlPlaneRoot, "sync-payload.json");
const publicBaseUrlOverride = envValue("CODEX_REMOTE_PUBLIC_BASE_URL", "CONTROL_PLANE_PUBLIC_BASE_URL") ?? null;
const accessUrls = buildAccessUrls({
  port,
  listenHost: host,
  publicBaseUrl: publicBaseUrlOverride
});
const publicBaseUrl = accessUrls.publicBaseUrl;

const deviceRegistry = new DeviceRegistry({
  filePath: deviceFilePath
});
const adapter = new LocalCodexAdapter();
const commandStore = new FileCommandStore({ filePath: commandStorePath });

const device = await deviceRegistry.loadOrCreate({
  workspaceId,
  workspaceName
});

const bonjourAdvertiser =
  accessUrls.phoneAccessUrl
    ? new BonjourAdvertiser({
        name: `Codex Remote - ${workspaceName}`,
        port
      })
    : null;

const syncScheduler = createSyncScheduler({
  syncTarget,
  syncIntervalMs,
  adapter,
  commandStore,
  deviceRegistry,
  workspaceId,
  workspaceName,
  syncExportPath
});

syncScheduler?.start();

const server = createCodexRemoteServer({
  adapter,
  commandStore,
  deviceRegistry,
  publicBaseUrl,
  localBaseUrl: accessUrls.localBaseUrl,
  accessUrls,
  resolveAccessUrls: () => buildAccessUrls({
    port,
    listenHost: host,
    publicBaseUrl: publicBaseUrlOverride
  }),
  syncScheduler,
  workspaceId,
  authToken
});

server.listen(port, host, () => {
  bonjourAdvertiser?.start();
  console.log(`Codex Remote server listening on ${host}:${port}`);
  console.log(`Command store: ${commandStorePath}`);
  console.log(`Device file: ${deviceFilePath}`);
  console.log(`Device id: ${device.deviceId}`);
  console.log(`Auth token enabled: ${authToken ? "yes" : "no"}`);
  console.log(`Local base URL: ${accessUrls.localBaseUrl}`);
  console.log(`Public base URL: ${publicBaseUrl}`);
  console.log(`Phone access URL: ${accessUrls.phoneAccessUrl ?? "not available"}`);
  console.log(`Sync target: ${syncTarget}`);
  console.log(`Sync interval ms: ${syncIntervalMs}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    bonjourAdvertiser?.stop();
    syncScheduler?.stop();
    server.close(() => {
      process.exit(0);
    });
  });
}

function createSyncScheduler({
  syncTarget,
  syncIntervalMs,
  adapter,
  commandStore,
  deviceRegistry,
  workspaceId,
  workspaceName,
  syncExportPath
}) {
  if (syncTarget === "none" || syncIntervalMs <= 0) {
    return null;
  }

  let sink;

  if (syncTarget === "json-file") {
    sink = new JsonFileSyncSink({
      outputPath: syncExportPath
    });
  } else if (syncTarget === "supabase") {
    sink = new SupabaseRestSyncSink({
      baseUrl: process.env.SUPABASE_URL,
      apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
    });
  } else {
    throw new Error(`Unsupported CODEX_REMOTE_SYNC_TARGET: ${syncTarget}`);
  }

  return new SyncScheduler({
    intervalMs: syncIntervalMs,
    engine: new SyncEngine({
      adapter,
      commandStore,
      deviceRegistry,
      sink,
      workspaceId,
      workspaceName
    })
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
