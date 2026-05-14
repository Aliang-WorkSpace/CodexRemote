import test from "node:test";
import assert from "node:assert/strict";

import { SyncScheduler } from "../src/sync/sync-scheduler.js";

test("SyncScheduler records successful sync status", async () => {
  const scheduler = new SyncScheduler({
    intervalMs: 1000,
    engine: {
      async syncOnce() {
        return {
          result: {
            type: "memory",
            syncedTables: ["workspaces", "sessions"]
          }
        };
      }
    }
  });

  const result = await scheduler.runOnce();
  const status = scheduler.getStatus();

  assert.equal(result.type, "memory");
  assert.equal(status.isSyncing, false);
  assert.deepEqual(status.lastResult.syncedTables, ["workspaces", "sessions"]);
  assert.equal(typeof status.lastSucceededAt, "string");
});

test("SyncScheduler records sync failures", async () => {
  const scheduler = new SyncScheduler({
    intervalMs: 1000,
    engine: {
      async syncOnce() {
        throw new Error("boom");
      }
    }
  });

  await assert.rejects(() => scheduler.runOnce(), /boom/);

  const status = scheduler.getStatus();
  assert.equal(status.isSyncing, false);
  assert.equal(status.lastError, "boom");
  assert.equal(typeof status.lastFailedAt, "string");
});

test("SyncScheduler deduplicates concurrent sync requests", async () => {
  let calls = 0;
  const scheduler = new SyncScheduler({
    intervalMs: 1000,
    engine: {
      async syncOnce() {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          result: {
            type: "memory"
          }
        };
      }
    }
  });

  await Promise.all([scheduler.runOnce(), scheduler.runOnce(), scheduler.runOnce()]);

  assert.equal(calls, 1);
});
