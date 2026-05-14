import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { createCodexRemoteHandler } from "../src/server/create-server.js";
import { InMemoryCommandStore } from "../src/server/command-store.js";

function createStubDeviceRegistry() {
  let device = {
    deviceId: "device_1",
    workspaceId: "local-mac",
    workspaceName: "Local Mac",
    pairingToken: "pair_123",
    updatedAt: "2026-04-02T00:00:00.000Z"
  };

  return {
    async loadOrCreate() {
      return device;
    },
    async rotatePairingToken() {
      device = {
        ...device,
        pairingToken: "pair_rotated",
        updatedAt: "2026-04-02T00:01:00.000Z"
      };
      return device;
    }
  };
}

test("rejects requests without the expected bearer token", async () => {
  const adapter = {
    async fetchSnapshot() {
      return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
    },
    async fetchRecentEvents() {
      return [];
    },
    async execute() {
      return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
    }
  };

  const handler = createCodexRemoteHandler({
    adapter,
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/snapshot"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "unauthorized");
  assert.equal(body.error.message, "Unauthorized");
  assert.equal(typeof body.requestId, "string");
  assert.equal(typeof response.headers["x-request-id"], "string");
});

test("accepts an authenticated command and persists it", async () => {
  const adapter = {
    async fetchSnapshot() {
      return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
    },
    async fetchRecentEvents() {
      return [];
    },
    async execute(commandEnvelope) {
      return {
        id: "evt_1",
        runId: commandEnvelope.target.id,
        level: "info",
        message: "queued",
        occurredAt: "2026-04-02T00:00:00.000Z"
      };
    }
  };

  const commandStore = new InMemoryCommandStore();
  const handler = createCodexRemoteHandler({
    adapter,
    commandStore,
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "POST",
      url: "/commands",
      headers: {
        authorization: "Bearer secret-token"
      },
      body: {
        target: { type: "session", id: "thread_1" },
        payload: { kind: "sendPrompt", prompt: "hello", attachments: [] }
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 202);
  assert.equal(body.command.target.id, "thread_1");
  assert.equal(body.command.status, "completed");
  assert.equal(body.command.acknowledgementMessage, "queued");
  assert.equal(body.command.origin, "local");
  assert.ok(body.command.acknowledgedAt);
  assert.equal((await commandStore.list()).length, 1);
});

test("lists persisted commands for authenticated requests", async () => {
  const commandStore = new InMemoryCommandStore();
  commandStore.create({
    id: "cmd_existing",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_9" },
    payload: { kind: "resumeRun" },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore,
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/commands",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0].id, "cmd_existing");
});

test("returns pairing information without requiring bearer auth", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry()
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/pairing"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.deviceId, "device_1");
  assert.equal(body.pairingStatus, "direct-bootstrap-available");
  assert.equal(body.authRequired, false);
  assert.equal("pairingToken" in body, false);
  assert.equal(body.transport.baseUrl, "http://127.0.0.1:8793");
  assert.equal(body.transport.localBaseUrl, "http://127.0.0.1:8793");
  assert.equal(body.transport.publicBaseUrl, "http://127.0.0.1:8793");
  assert.equal(body.transport.phoneAccessUrl, null);
  assert.equal(body.transport.isLocalOnly, true);
  assert.equal(body.appPairingUrl, "controlplane://pair?base=http%3A%2F%2F127.0.0.1%3A8793");
  assert.equal(body.qrImageUrl, "/pairing/qr.png");
});

test("returns phone-friendly transport hints when a LAN address is available", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    publicBaseUrl: "http://192.168.1.8:8793",
    localBaseUrl: "http://127.0.0.1:8793",
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/pairing"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.pairingStatus, "manual-bootstrap-required");
  assert.equal(body.authRequired, true);
  assert.equal(body.transport.baseUrl, "http://192.168.1.8:8793");
  assert.equal(body.transport.publicBaseUrl, "http://192.168.1.8:8793");
  assert.equal(body.transport.localBaseUrl, "http://127.0.0.1:8793");
  assert.equal(body.transport.phoneAccessUrl, "http://192.168.1.8:8793");
  assert.equal(body.transport.isLocalOnly, false);
  assert.match(body.transport.hint, /同一网络/);
  assert.equal(body.appPairingUrl, "controlplane://pair?base=http%3A%2F%2F192.168.1.8%3A8793");
  assert.equal(body.qrImageUrl, "/pairing/qr.png");
});

test("serves a pairing qr image without requiring auth", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    publicBaseUrl: "http://192.168.1.8:8793",
    localBaseUrl: "http://127.0.0.1:8793",
    pairingQrRenderer: async (value) => {
      assert.equal(value, "controlplane://pair?base=http%3A%2F%2F192.168.1.8%3A8793");
      return Buffer.from("png-bytes");
    }
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/pairing/qr.png"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(response.body, "png-bytes");
});

test("serves the local web app without requiring auth", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/app"
    })
  );

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.body, /进程控制中心/);
  assert.match(response.body, /手机副控/);
  assert.match(response.body, /__CODEX_REMOTE_INITIAL_STATE__/);
  assert.match(response.body, /"workspaceName":"Local Mac"/);
});

test("returns pairing token only for authenticated requests", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/pairing/token",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.deviceId, "device_1");
  assert.equal(body.pairingToken, "pair_123");
});

test("returns an authenticated pairing bootstrap bundle", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    publicBaseUrl: "http://192.168.1.8:8793",
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/pairing/bootstrap",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.bundle.transport.baseUrl, "http://192.168.1.8:8793");
  assert.equal(body.bundle.pairingToken, "pair_123");
  assert.equal(typeof body.pairingCode, "string");
});

test("returns a mobile-friendly dashboard for authenticated requests", async () => {
  const commandStore = new InMemoryCommandStore();
  commandStore.create({
    id: "cmd_existing",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_9" },
    payload: { kind: "resumeRun" },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return {
          workspace: { id: "local-mac", name: "Local Mac" },
          sessions: [
            {
              id: "thread_9",
              title: "A very long title that should become compact on the phone because it is much longer than the screen can comfortably handle in one row",
              status: "active",
              cwd: "/Users/demo/workspace",
              model: "gpt-5.4",
              updatedAt: 1775110500
            }
          ],
          runs: [
            {
              id: "thread_9",
              sessionId: "thread_9",
              parentRunId: null,
              status: "waitingForInput"
            }
          ],
          automations: []
          ,
          templates: [
            {
              id: "pua",
              name: "pua.md"
            }
          ]
        };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore,
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/mobile/dashboard",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.stats.sessionCount, 1);
  assert.equal(body.sessions[0].title.endsWith("..."), true);
  assert.equal(body.templates.length, 1);
  assert.equal(body.recentCommands.length, 1);
});

test("returns a mobile bootstrap payload for authenticated requests", async () => {
  const commandStore = new InMemoryCommandStore();
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return {
          workspace: { id: "local-mac", name: "Local Mac" },
          sessions: [],
          runs: [],
          automations: [],
          templates: []
        };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore,
    deviceRegistry: createStubDeviceRegistry(),
    syncScheduler: {
      getStatus() {
        return {
          enabled: true,
          lastSucceededAt: "2026-04-02T07:00:00.000Z"
        };
      }
    },
    publicBaseUrl: "http://192.168.1.8:8793",
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/mobile/bootstrap",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.transport.baseUrl, "http://192.168.1.8:8793");
  assert.equal(body.sync.enabled, true);
  assert.equal(body.supportedCommands.includes("sendPrompt"), true);
});

test("returns a mobile session detail payload for authenticated requests", async () => {
  const commandStore = new InMemoryCommandStore();
  commandStore.create({
    id: "cmd_existing",
    workspaceId: "local-mac",
    target: { type: "session", id: "thread_9" },
    payload: { kind: "sendPrompt", prompt: "hello" },
    requestedAt: "2026-04-02T00:00:00.000Z"
  });

  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return {
          workspace: { id: "local-mac", name: "Local Mac" },
          sessions: [
            {
              id: "thread_9",
              title: "A session title that is much too long for a phone detail header without truncation",
              status: "active",
              cwd: "/Users/demo/workspace",
              model: "gpt-5.4",
              updatedAt: 1775110500
            }
          ],
          runs: [
            {
              id: "thread_9",
              sessionId: "thread_9",
              parentRunId: null,
              status: "waitingForInput",
              automationId: null
            }
          ],
          automations: []
        };
      },
      async fetchRecentEvents() {
        return [
          {
            id: "evt_1",
            level: "info",
            message: "A very long event message that should be compacted for the phone detail page because raw logs should not render in full by default on mobile",
            occurredAt: "2026-04-02T00:00:00.000Z"
          }
        ];
      },
      async execute() {
        return { id: "evt_2", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore,
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/mobile/sessions/thread_9",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.session.id, "thread_9");
  assert.equal(body.recentCommands.length, 1);
  assert.equal(body.recentEvents.length, 1);
});

test("returns 404 for an unknown mobile session", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return {
          workspace: { id: "local-mac", name: "Local Mac" },
          sessions: [],
          runs: [],
          automations: [],
          templates: []
        };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/mobile/sessions/thread_missing",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "session_not_found");
  assert.equal(body.error.message, "Session not found");
  assert.equal(typeof body.requestId, "string");
  assert.equal(typeof response.headers["x-request-id"], "string");
});

test("rotates pairing token for authenticated requests", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "POST",
      url: "/pairing/rotate",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.pairingToken, "pair_rotated");
});

test("rejects sync runs when no scheduler is configured", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "POST",
      url: "/sync/run",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "sync_scheduler_not_configured");
  assert.equal(body.error.message, "Sync scheduler is not configured");
  assert.equal(typeof body.requestId, "string");
  assert.equal(typeof response.headers["x-request-id"], "string");
});

test("rejects invalid command payloads with a client error", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "POST",
      url: "/commands",
      headers: {
        authorization: "Bearer secret-token"
      },
      body: {}
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_command");
  assert.equal(body.error.message, "target.type and target.id are required");
  assert.equal(typeof body.requestId, "string");
  assert.equal(typeof response.headers["x-request-id"], "string");
});

test("returns sync status for authenticated requests", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    syncScheduler: {
      getStatus() {
        return {
          enabled: true,
          isSyncing: false,
          lastSucceededAt: "2026-04-02T07:00:00.000Z"
        };
      }
    },
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "GET",
      url: "/sync/status",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.enabled, true);
  assert.equal(body.lastSucceededAt, "2026-04-02T07:00:00.000Z");
});

test("runs an on-demand sync for authenticated requests", async () => {
  const handler = createCodexRemoteHandler({
    adapter: {
      async fetchSnapshot() {
        return { workspace: { id: "ws", name: "Mac" }, sessions: [], runs: [], automations: [] };
      },
      async fetchRecentEvents() {
        return [];
      },
      async execute() {
        return { id: "evt_1", runId: "run_1", level: "info", message: "ok", occurredAt: "2026-04-02T00:00:00.000Z" };
      }
    },
    commandStore: new InMemoryCommandStore(),
    deviceRegistry: createStubDeviceRegistry(),
    syncScheduler: {
      getStatus() {
        return {
          enabled: true,
          isSyncing: false,
          lastSucceededAt: "2026-04-02T07:00:00.000Z"
        };
      },
      async runOnce() {
        return {
          type: "supabase-rest",
          syncedTables: ["workspaces", "sessions"]
        };
      }
    },
    authToken: "secret-token"
  });

  const response = await invokeHandler(
    handler,
    createRequest({
      method: "POST",
      url: "/sync/run",
      headers: {
        authorization: "Bearer secret-token"
      }
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.deepEqual(body.result.syncedTables, ["workspaces", "sessions"]);
});

function createRequest({ method, url, headers = {}, body = null }) {
  const payload = body == null ? [] : [Buffer.from(JSON.stringify(body))];
  const stream = Readable.from(payload);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

async function invokeHandler(handler, request) {
  return new Promise((resolve, reject) => {
    const response = {
      status: 200,
      headers: {},
      body: "",
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
      },
      end(chunk) {
        this.body += chunk ?? "";
        resolve(this);
      }
    };

    Promise.resolve(handler(request, response)).catch(reject);
  });
}
