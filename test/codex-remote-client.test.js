import test from "node:test";
import assert from "node:assert/strict";

import {
  CodexRemoteApiError,
  CodexRemoteClient,
  createPairedClientFromBootstrapBundle,
  createPairedClientFromPairingCode,
  decodePairingCode
} from "../src/client/codex-remote-client.js";

test("CodexRemoteClient adds bearer auth and returns request metadata", async () => {
  const client = new CodexRemoteClient({
    baseUrl: "http://127.0.0.1:8793",
    token: "secret-token",
    fetchImpl: async (url, options) => {
      assert.equal(url, "http://127.0.0.1:8793/mobile/bootstrap");
      assert.equal(options.headers.Authorization, "Bearer secret-token");

      return createResponse({
        ok: true,
        headers: {
          "x-request-id": "req_123"
        },
        json: {
          workspace: { id: "local-mac", name: "Local Mac" }
        }
      });
    }
  });

  const response = await client.getMobileBootstrap();

  assert.equal(response.requestId, "req_123");
  assert.equal(response.data.workspace.id, "local-mac");
});

test("CodexRemoteClient omits auth for public pairing discovery", async () => {
  const client = new CodexRemoteClient({
    baseUrl: "http://127.0.0.1:8793",
    token: "secret-token",
    fetchImpl: async (_url, options) => {
      assert.equal("Authorization" in options.headers, false);

      return createResponse({
        ok: true,
        headers: {},
        json: {
          deviceId: "device_1"
        }
      });
    }
  });

  const response = await client.getPairing();
  assert.equal(response.data.deviceId, "device_1");
});

test("CodexRemoteClient surfaces API errors with stable fields", async () => {
  const client = new CodexRemoteClient({
    baseUrl: "http://127.0.0.1:8793",
    token: "secret-token",
    fetchImpl: async () =>
      createResponse({
        ok: false,
        status: 404,
        headers: {
          "x-request-id": "req_404"
        },
        json: {
          requestId: "req_404",
          error: {
            code: "session_not_found",
            message: "Session not found"
          }
        }
      })
  });

  await assert.rejects(
    () => client.getSessionDetail("missing"),
    (error) =>
      error instanceof CodexRemoteApiError &&
      error.status === 404 &&
      error.requestId === "req_404" &&
      error.code === "session_not_found" &&
      error.message === "Session not found"
  );
});

test("CodexRemoteClient submits commands as json", async () => {
  const client = new CodexRemoteClient({
    baseUrl: "http://127.0.0.1:8793",
    token: "secret-token",
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Type"], "application/json");

      const body = JSON.parse(options.body);
      assert.equal(body.target.id, "thread_1");
      assert.equal(body.payload.kind, "sendPrompt");

      return createResponse({
        ok: true,
        headers: {
          "x-request-id": "req_cmd"
        },
        json: {
          command: {
            id: "cmd_1"
          }
        }
      });
    }
  });

  const response = await client.submitCommand({
    target: { type: "session", id: "thread_1" },
    payload: { kind: "sendPrompt", prompt: "Continue", attachments: [] }
  });

  assert.equal(response.requestId, "req_cmd");
  assert.equal(response.data.command.id, "cmd_1");
});

test("CodexRemoteClient preserves fetch receiver semantics for host-provided fetch implementations", async () => {
  const sentinel = { tag: "host-fetch" };
  let observedThis = null;

  async function hostFetch() {
    observedThis = this;
    return createResponse({
      ok: true,
      headers: {},
      json: {
        ok: true
      }
    });
  }

  const client = new CodexRemoteClient({
    baseUrl: "http://127.0.0.1:8793",
    fetchImpl: hostFetch,
    fetchContext: sentinel
  });

  await client.getHealth();

  assert.equal(observedThis, sentinel);
});

test("decodePairingCode decodes bootstrap payloads", () => {
  const original = {
    version: 1,
    deviceId: "device_1",
    pairingToken: "pair_123"
  };
  const encoded = Buffer.from(JSON.stringify(original)).toString("base64url");

  assert.deepEqual(decodePairingCode(encoded), original);
});

test("createPairedClientFromBootstrapBundle builds an authenticated client", () => {
  const client = createPairedClientFromBootstrapBundle({
    bundle: {
      transport: {
        baseUrl: "http://192.0.2.10:8788"
      },
      pairingToken: "pair_123"
    },
    fetchImpl: async () => {
      throw new Error("not used");
    }
  });

  assert.equal(client.baseUrl, "http://192.0.2.10:8788");
  assert.equal(client.token, "pair_123");
});

test("createPairedClientFromPairingCode decodes and builds an authenticated client", () => {
  const pairingCode = Buffer.from(
    JSON.stringify({
      transport: {
        baseUrl: "http://192.0.2.10:8788"
      },
      pairingToken: "pair_123"
    })
  ).toString("base64url");

  const client = createPairedClientFromPairingCode({
    pairingCode,
    fetchImpl: async () => {
      throw new Error("not used");
    }
  });

  assert.equal(client.baseUrl, "http://192.0.2.10:8788");
  assert.equal(client.token, "pair_123");
});

function createResponse({ ok, status = ok ? 200 : 500, headers = {}, json }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return headers[name] ?? headers[name.toLowerCase()] ?? null;
      }
    },
    async json() {
      return json;
    }
  };
}
