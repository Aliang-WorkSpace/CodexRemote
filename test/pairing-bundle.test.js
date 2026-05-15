import test from "node:test";
import assert from "node:assert/strict";

import { buildPairingBundle, encodePairingBundle } from "../src/server/pairing-bundle.js";

test("buildPairingBundle produces a mobile bootstrap payload", () => {
  const bundle = buildPairingBundle({
    device: {
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      pairingToken: "pair_123"
    },
    publicBaseUrl: "http://192.0.2.10:8793",
    generatedAt: "2026-04-02T07:20:00.000Z"
  });

  assert.equal(bundle.transport.baseUrl, "http://192.0.2.10:8793");
  assert.equal(bundle.pairingToken, "pair_123");
  assert.equal(bundle.capabilities.backgroundSync, true);
});

test("encodePairingBundle returns a compact base64url string", () => {
  const encoded = encodePairingBundle({
    version: 1,
    pairingToken: "pair_123"
  });

  const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.equal(decoded.version, 1);
  assert.equal(decoded.pairingToken, "pair_123");
});
