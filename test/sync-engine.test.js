import test from "node:test";
import assert from "node:assert/strict";

import { SyncEngine } from "../src/sync/sync-engine.js";

test("builds and writes a sync payload through the configured sink", async () => {
  let writtenPayload = null;

  const engine = new SyncEngine({
    adapter: {
      async fetchSnapshot() {
        return {
          workspace: { id: "local-mac", name: "Local Mac" },
          sessions: [],
          runs: [],
          automations: [],
          templates: []
        };
      }
    },
    commandStore: {
      async list() {
        return [];
      }
    },
    deviceRegistry: {
      async loadOrCreate() {
        return {
          deviceId: "device_1",
          workspaceId: "local-mac",
          workspaceName: "Local Mac",
          updatedAt: "2026-04-02T06:40:00.000Z"
        };
      }
    },
    sink: {
      async write(payload) {
        writtenPayload = payload;
        return { type: "memory" };
      }
    }
  });

  const result = await engine.syncOnce();

  assert.equal(result.result.type, "memory");
  assert.equal(writtenPayload.workspace.id, "local-mac");
});

