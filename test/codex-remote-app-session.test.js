import test from "node:test";
import assert from "node:assert/strict";

import { AppSessionController } from "../src/client/codex-remote-app-session.js";

test("AppSessionController connects with a pairing code and seeds bootstrap state", async () => {
  const controller = new AppSessionController({
    pairingStore: {
      state: {
        client: null,
        requestId: null
      },
      async connectWithPairingCode(pairingCode) {
        assert.equal(pairingCode, "pairing-code");
        this.state.client = {
          async getMobileBootstrap() {
            return {
              requestId: "req_bootstrap_refresh",
              data: {
                dashboard: {
                  stats: { sessionCount: 3 }
                }
              }
            };
          }
        };
        this.state.requestId = "req_bootstrap";
        return {
          dashboard: {
            stats: { sessionCount: 2 }
          }
        };
      },
      async discover() {
        return {};
      }
    }
  });

  const bootstrap = await controller.connectWithPairingCode("pairing-code");

  assert.equal(bootstrap.dashboard.stats.sessionCount, 2);
  assert.equal(controller.dashboard.stats.sessionCount, 2);
  assert.equal(controller.state.bootstrap.requestId, "req_bootstrap");
});

test("AppSessionController restores from a persisted pairing bundle", async () => {
  const controller = new AppSessionController({
    pairingStore: {
      state: {
        client: null,
        requestId: null
      },
      async connectWithBundle(bundle) {
        assert.equal(bundle.transport.baseUrl, "http://127.0.0.1:8788");
        this.state.client = {
          async getMobileBootstrap() {
            return {
              requestId: "req_bootstrap_refresh",
              data: {
                dashboard: {
                  stats: { sessionCount: 4 }
                }
              }
            };
          }
        };
        this.state.requestId = "req_restore";
        return {
          dashboard: {
            stats: { sessionCount: 4 }
          }
        };
      },
      async connectWithPairingCode() {
        throw new Error("not used");
      },
      async discover() {
        return {};
      }
    }
  });

  const bootstrap = await controller.restoreFromBundle({
    transport: { baseUrl: "http://127.0.0.1:8788" },
    pairingToken: "pair_123"
  });

  assert.equal(bootstrap.dashboard.stats.sessionCount, 4);
  assert.equal(controller.dashboard.stats.sessionCount, 4);
  assert.equal(controller.state.bootstrap.requestId, "req_restore");
});

test("AppSessionController hydrates from server-provided initial state without fetching", () => {
  const pairedClient = {
    async getMobileBootstrap() {
      throw new Error("should not fetch during hydration");
    }
  };

  const controller = new AppSessionController({
    pairingStore: {
      state: {
        publicPairing: null,
        bundle: null,
        client: null,
        requestId: null
      },
      hydrate({ publicPairing, bundle, bootstrap }) {
        this.state.publicPairing = publicPairing;
        this.state.bundle = bundle;
        this.state.client = pairedClient;
        this.state.bootstrap = bootstrap;
      },
      async discover() {
        return {};
      }
    }
  });

  controller.hydrate({
    publicPairing: {
      deviceId: "device_1"
    },
    bundle: {
      transport: { baseUrl: "http://127.0.0.1:8793" },
      pairingToken: "pair_123"
    },
    bootstrap: {
      dashboard: {
        stats: { sessionCount: 5 }
      }
    }
  });

  assert.equal(controller.state.pairing.publicPairing.deviceId, "device_1");
  assert.equal(controller.client, pairedClient);
  assert.equal(controller.dashboard.stats.sessionCount, 5);
});

test("AppSessionController opens a session and refreshes it after sending a prompt", async () => {
  let detailCalls = 0;
  let submitCalls = 0;

  const client = {
    async getMobileBootstrap() {
      return {
        requestId: "req_bootstrap",
        data: {
          dashboard: {
            stats: { sessionCount: 1 }
          }
        }
      };
    },
    async getSessionDetail(sessionId) {
      detailCalls += 1;
      return {
        requestId: `req_detail_${detailCalls}`,
        data: {
          session: { id: sessionId },
          recentCommands: []
        }
      };
    },
    async submitCommand(body) {
      submitCalls += 1;
      assert.equal(body.target.id, "thread_1");
      return {
        requestId: "req_command",
        data: {
          command: {
            id: "cmd_1",
            status: "completed"
          }
        }
      };
    }
  };

  const controller = new AppSessionController({
    pairingStore: {
      state: {
        client,
        requestId: "req_bootstrap"
      },
      async connectWithPairingCode() {
        return {
          dashboard: {
            stats: { sessionCount: 1 }
          }
        };
      },
      async discover() {
        return {};
      }
    }
  });

  await controller.connectWithPairingCode("pairing-code");
  await controller.openSession("thread_1");
  const result = await controller.sendPrompt({
    sessionId: "thread_1",
    prompt: "Continue"
  });

  assert.equal(result.command.id, "cmd_1");
  assert.equal(detailCalls, 2);
  assert.equal(submitCalls, 1);
  assert.equal(controller.selectedSession.session.id, "thread_1");
});

test("AppSessionController supports run controls and workspace launches", async () => {
  const submittedKinds = [];
  let bootstrapCalls = 0;
  let sessionCalls = 0;

  const client = {
    async getMobileBootstrap() {
      bootstrapCalls += 1;
      return {
        requestId: `req_bootstrap_${bootstrapCalls}`,
        data: {
          dashboard: {
            stats: { sessionCount: 1 }
          }
        }
      };
    },
    async getSessionDetail(sessionId) {
      sessionCalls += 1;
      return {
        requestId: `req_detail_${sessionCalls}`,
        data: {
          session: { id: sessionId },
          recentCommands: []
        }
      };
    },
    async submitCommand(body) {
      submittedKinds.push(body.payload.kind);
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
  };

  const controller = new AppSessionController({
    pairingStore: {
      state: {
        client,
        requestId: "req_bootstrap"
      },
      async connectWithPairingCode() {
        return {
          dashboard: {
            stats: { sessionCount: 1 }
          }
        };
      },
      async discover() {
        return {};
      }
    }
  });

  await controller.connectWithPairingCode("pairing-code");
  await controller.openSession("thread_1");
  await controller.resumeRun({ sessionId: "thread_1" });
  await controller.retryRun({ sessionId: "thread_1" });
  await controller.stopRun({ sessionId: "thread_1", reason: "Stop now" });
  await controller.startAutomation({ automationId: "daily", input: "Check launches" });
  await controller.startTemplate({ templateId: "weekly", input: "Check risks" });

  assert.deepEqual(submittedKinds, [
    "resumeRun",
    "retryRun",
    "stopRun",
    "startAutomation",
    "startTemplate"
  ]);
  assert.equal(sessionCalls, 4);
  assert.equal(bootstrapCalls, 5);
});

test("AppSessionController refuses session actions before pairing", async () => {
  const controller = new AppSessionController({
    pairingStore: {
      state: {
        client: null
      },
      async discover() {
        return {};
      },
      async connectWithPairingCode() {
        return {};
      }
    }
  });

  await assert.rejects(() => controller.openSession("thread_1"), /Client is not connected/);
});
