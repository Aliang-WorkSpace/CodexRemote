export function buildAppPairingUrl({ baseUrl = null, pairingCode = null } = {}) {
  const params = new URLSearchParams();

  if (pairingCode) {
    params.set("code", pairingCode);
  } else if (baseUrl) {
    params.set("base", baseUrl);
  } else {
    return null;
  }

  return `controlplane://pair?${params.toString()}`;
}
