import test from "node:test";
import assert from "node:assert/strict";

import {
  PairingStore,
  BootstrapStore,
  CommandComposer,
  SessionStore
} from "../src/client/codex-remote-stores.js";
import { CodexRemoteApiError } from "../src/client/codex-remote-client.js";

test("PairingStore discovers a public relay endpoint", async () => {
  const store = new PairingStore({
    pairingClientFactory: () => ({
      withToken() {
        return this;
      },
      async getPairing() {
        return {
          requestId: "req_pairing",
          data: {
            deviceId: "device_1"
          }
        };
      }
    })
  });

  const pairing = await store.discover("http://192.0.2.10:8788");

  assert.equal(pairing.deviceId, "device_1");
  assert.equal(store.state.requestId, "req_pairing");
  assert.equal(store.state.publicPairing.deviceId, "device_1");
});

test("PairingStore forwards fetch context when discovering and connecting directly", async () => {
  const sentinel = { tag: "host-fetch-context" };
  const calls = [];
  const directClient = {
    async getMobileBootstrap() {
      return {
        requestId: "req_bootstrap",
        data: {
          workspace: {
            id: "local-mac"
          }
        }
      };
    }
  };

  const store = new PairingStore({
    fetchImpl: async function hostFetch() {
      return {
        ok: true,
        headers: new Headers(),
        async json() {
          return {};
        }
      };
    },
    fetchContext: sentinel,
    pairingClientFactory: ({ bundle, fetchImpl, fetchContext }) => {
      calls.push({
        baseUrl: bundle.transport.baseUrl,
        fetchImpl,
        fetchContext
      });

      if (calls.length === 1) {
        return {
          withToken() {
            return this;
          },
          async getPairing() {
            return {
              requestId: "req_pairing",
              data: {
                deviceId: "device_1"
              }
            };
          }
        };
      }

      if (calls.length === 2) {
        return {
          withToken() {
            return this;
          },
          async getPairingBootstrap() {
            return {
              requestId: "req_pairing_bootstrap",
              data: {
                bundle: {
                  transport: {
                    baseUrl: "http://192.0.2.10:8788"
                  },
                  pairingToken: "pair_123"
                }
              }
            };
          }
        };
      }

      return directClient;
    }
  });

  await store.discover("http://192.0.2.10:8788");
  await store.connectDirect("http://192.0.2.10:8788");

  assert.equal(calls[0].fetchImpl.name, "hostFetch");
  assert.equal(calls[0].fetchContext, sentinel);
  assert.equal(calls[1].fetchContext, sentinel);
  assert.equal(calls[2].fetchContext, sentinel);
  assert.equal(store.state.client, directClient);
});

test("PairingStore connects with a pairing code and stores the paired client", async () => {
  const bundle = {
    transport: {
      baseUrl: "http://192.0.2.10:8788"
    },
    pairingToken: "pair_123"
  };
  const pairingCode = Buffer.from(JSON.stringify(bundle)).toString("base64url");
  const pairedClient = {
    token: "pair_123",
    async getMobileBootstrap() {
      return {
        requestId: "req_bootstrap",
        data: {
          workspace: {
            id: "local-mac"
          }
        }
      };
    }
  };

  const store = new PairingStore({
    pairingClientFactory: ({ pairingCode: incomingPairingCode, bundle: incomingBundle }) => {
      assert.equal(incomingPairingCode, pairingCode);
      assert.deepEqual(incomingBundle, bundle);
      return pairedClient;
    }
  });

  const bootstrap = await store.connectWithPairingCode(pairingCode);

  assert.equal(bootstrap.workspace.id, "local-mac");
  assert.deepEqual(store.state.bundle, bundle);
  assert.equal(store.state.client, pairedClient);
  assert.equal(store.state.bootstrap.workspace.id, "local-mac");
});

test("PairingStore reconnects from a persisted bundle", async () => {
  const bundle = {
    transport: {
      baseUrl: "http://192.0.2.10:8788"
    },
    pairingToken: "pair_123"
  };
  const pairedClient = {
    async getMobileBootstrap() {
      return {
        requestId: "req_bootstrap",
        data: {
          workspace: {
            id: "local-mac"
          }
        }
      };
    }
  };

  const store = new PairingStore({
    pairingClientFactory: ({ bundle: incomingBundle }) => {
      assert.deepEqual(incomingBundle, bundle);
      return pairedClient;
    }
  });

  const bootstrap = await store.connectWithBundle(bundle);

  assert.equal(bootstrap.workspace.id, "local-mac");
  assert.deepEqual(store.state.bundle, bundle);
  assert.equal(store.state.client, pairedClient);
});

test("BootstrapStore loads and exposes bootstrap-derived state", async () => {
  const store = new BootstrapStore({
    client: {
      async getMobileBootstrap() {
        return {
          requestId: "req_bootstrap",
          data: {
            supportedCommands: ["sendPrompt", "retryRun"],
            sync: { enabled: true },
            dashboard: {
              stats: { sessionCount: 2 }
            }
          }
        };
      }
    }
  });

  const bootstrap = await store.load();

  assert.equal(store.state.isLoading, false);
  assert.equal(store.state.requestId, "req_bootstrap");
  assert.equal(bootstrap.dashboard.stats.sessionCount, 2);
  assert.deepEqual(store.supportedCommands, ["sendPrompt", "retryRun"]);
  assert.equal(store.syncStatus.enabled, true);
});

test("BootstrapStore preserves API errors in state", async () => {
  const error = new CodexRemoteApiError({
    status: 401,
    requestId: "req_unauthorized",
    code: "unauthorized",
    message: "Unauthorized"
  });
  const store = new BootstrapStore({
    client: {
      async getMobileBootstrap() {
        throw error;
      }
    }
  });

  await assert.rejects(() => store.load(), /Unauthorized/);
  assert.equal(store.state.error, error);
  assert.equal(store.state.isLoading, false);
});

test("SessionStore loads and refreshes a session detail", async () => {
  const calls = [];
  const store = new SessionStore({
    client: {
      async getSessionDetail(sessionId) {
        calls.push(sessionId);
        return {
          requestId: `req_${sessionId}`,
          data: {
            session: { id: sessionId }
          }
        };
      }
    }
  });

  await store.load("thread_1");
  await store.refresh();

  assert.deepEqual(calls, ["thread_1", "thread_1"]);
  assert.equal(store.state.detail.session.id, "thread_1");
});

test("CommandComposer sends a prompt and stores the last command", async () => {
  const store = new CommandComposer({
    client: {
      async submitCommand(body) {
        assert.equal(body.target.id, "thread_1");
        assert.equal(body.payload.kind, "sendPrompt");
        return {
          requestId: "req_cmd",
          data: {
            command: {
              id: "cmd_1",
              status: "completed"
            }
          }
        };
      }
    }
  });

  const result = await store.sendPrompt({
    sessionId: "thread_1",
    prompt: "Continue from here"
  });

  assert.equal(store.state.requestId, "req_cmd");
  assert.equal(store.state.lastCommand.id, "cmd_1");
  assert.equal(result.command.status, "completed");
});

test("CommandComposer exposes convenience actions for control commands", async () => {
  const calls = [];
  const store = new CommandComposer({
    client: {
      async submitCommand(body) {
        calls.push(body);
        return {
          requestId: `req_${body.payload.kind}`,
          data: {
            command: {
              id: `cmd_${body.payload.kind}`,
              status: "completed"
            }
          }
        };
      }
    }
  });

  await store.resumeRun({ sessionId: "thread_1" });
  await store.retryRun({ sessionId: "thread_1" });
  await store.stopRun({ sessionId: "thread_1", reason: "Stop now" });
  await store.startAutomation({
    workspaceId: "workspace_1",
    automationId: "daily",
    input: "Backend focus"
  });
  await store.startTemplate({
    workspaceId: "workspace_1",
    templateId: "weekly",
    input: "Wrap up"
  });

  assert.deepEqual(
    calls.map((call) => call.payload.kind),
    ["resumeRun", "retryRun", "stopRun", "startAutomation", "startTemplate"]
  );
  assert.equal(calls[0].target.id, "thread_1");
  assert.equal(calls[2].payload.reason, "Stop now");
  assert.equal(calls[3].target.id, "workspace_1");
  assert.equal(calls[3].payload.automationID, "daily");
  assert.equal(calls[4].target.id, "workspace_1");
  assert.equal(calls[4].payload.templateID, "weekly");
});

test("CommandComposer keeps failed submissions in error state", async () => {
  const error = new CodexRemoteApiError({
    status: 400,
    requestId: "req_invalid",
    code: "invalid_command",
    message: "target.type and target.id are required"
  });

  const store = new CommandComposer({
    client: {
      async submitCommand() {
        throw error;
      }
    }
  });

  await assert.rejects(
    () =>
      store.submit({
        target: { type: "session", id: "thread_1" },
        payload: { kind: "sendPrompt", prompt: "hello", attachments: [] }
      }),
    /target.type and target.id are required/
  );

  assert.equal(store.state.error, error);
  assert.equal(store.state.isSubmitting, false);
});
