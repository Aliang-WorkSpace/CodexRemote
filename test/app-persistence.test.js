import test from "node:test";
import assert from "node:assert/strict";

import {
  clearPersistedAppState,
  getAppPersistenceKey,
  loadPersistedAppState,
  savePersistedAppState
} from "../src/client/app-persistence.js";

test("app persistence saves and loads the current client state", () => {
  const storage = createMemoryStorage();

  savePersistedAppState(
    {
      pairingBundle: {
        transport: { baseUrl: "http://127.0.0.1:8788" },
        pairingToken: "pair_123"
      },
      selectedSessionId: "thread_1",
      isPollingEnabled: true,
      isConnectionPanelExpanded: false
    },
    storage
  );

  assert.deepEqual(loadPersistedAppState(storage), {
    pairingBundle: {
      transport: { baseUrl: "http://127.0.0.1:8788" },
      pairingToken: "pair_123"
    },
    selectedSessionId: "thread_1",
    isPollingEnabled: true,
    isConnectionPanelExpanded: false
  });
});

test("app persistence returns null for missing or invalid state", () => {
  const storage = createMemoryStorage();
  assert.equal(loadPersistedAppState(storage), null);

  storage.setItem(getAppPersistenceKey(), "{not-json");
  assert.equal(loadPersistedAppState(storage), null);
});

test("app persistence clears saved state", () => {
  const storage = createMemoryStorage();

  savePersistedAppState(
    {
      pairingBundle: { transport: { baseUrl: "http://127.0.0.1:8788" } },
      selectedSessionId: "thread_1",
      isPollingEnabled: false
    },
    storage
  );
  clearPersistedAppState(storage);

  assert.equal(storage.getItem(getAppPersistenceKey()), null);
});

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}
