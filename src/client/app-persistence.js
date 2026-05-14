const STORAGE_KEY = "codex-remote.app-state.v2";
const LEGACY_STORAGE_KEYS = [
  "codex-control-plane.app-state.v1"
];

export function loadPersistedAppState(storage = globalThis.localStorage) {
  if (!storage?.getItem) {
    return null;
  }

  try {
    const raw =
      storage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((key) => storage.getItem(key)).find(Boolean) ??
      null;
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return {
      pairingBundle: parsed.pairingBundle ?? null,
      selectedSessionId: parsed.selectedSessionId ?? null,
      isPollingEnabled: Boolean(parsed.isPollingEnabled),
      isConnectionPanelExpanded: Boolean(parsed.isConnectionPanelExpanded)
    };
  } catch {
    return null;
  }
}

export function savePersistedAppState(state, storage = globalThis.localStorage) {
  if (!storage?.setItem) {
    return;
  }

  const payload = JSON.stringify({
    pairingBundle: state.pairingBundle ?? null,
    selectedSessionId: state.selectedSessionId ?? null,
    isPollingEnabled: Boolean(state.isPollingEnabled),
    isConnectionPanelExpanded: Boolean(state.isConnectionPanelExpanded)
  });

  storage.setItem(STORAGE_KEY, payload);

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    storage.removeItem?.(legacyKey);
  }
}

export function clearPersistedAppState(storage = globalThis.localStorage) {
  if (!storage?.removeItem) {
    return;
  }

  storage.removeItem(STORAGE_KEY);
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    storage.removeItem(legacyKey);
  }
}

export function getAppPersistenceKey() {
  return STORAGE_KEY;
}
