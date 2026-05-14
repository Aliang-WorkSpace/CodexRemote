import http from "node:http";
import { randomUUID } from "node:crypto";

import { createCommandEnvelope } from "../core/command-envelope.js";
import {
  buildMobileBootstrapResponse,
  buildDashboardResponse,
  buildMobileSessionDetail
} from "./mobile-api.js";
import { buildPairingBundle, encodePairingBundle } from "./pairing-bundle.js";
import { buildAppPairingUrl } from "./pairing-link.js";
import { renderPairingQrPng } from "./pairing-qr.js";
import path from "node:path";
import { tryServeClientModule, tryServeStaticApp, tryServeStaticAppIndex } from "./static-app.js";
import { buildAccessUrls } from "./network-info.js";

export function createCodexRemoteServer({
  adapter,
  commandStore,
  deviceRegistry,
  publicBaseUrl = "http://127.0.0.1:8793",
  localBaseUrl = "http://127.0.0.1:8793",
  accessUrls = null,
  resolveAccessUrls = null,
  syncScheduler = null,
  workspaceId = "local-mac",
  authToken = null,
  pairingQrRenderer = renderPairingQrPng
}) {
  const handler = createCodexRemoteHandler({
    adapter,
    commandStore,
    deviceRegistry,
    publicBaseUrl,
    localBaseUrl,
    accessUrls,
    resolveAccessUrls,
    syncScheduler,
    workspaceId,
    authToken,
    pairingQrRenderer
  });

  return http.createServer((request, response) => {
    handler(request, response);
  });
}

export function createCodexRemoteHandler({
  adapter,
  commandStore,
  deviceRegistry,
  publicBaseUrl = "http://127.0.0.1:8793",
  localBaseUrl = "http://127.0.0.1:8793",
  accessUrls = null,
  resolveAccessUrls = null,
  syncScheduler = null,
  workspaceId = "local-mac",
  authToken = null,
  pairingQrRenderer = renderPairingQrPng
}) {
  const fallbackPort = safePortFromBaseUrl(localBaseUrl);

  function getResolvedAccessUrls() {
    if (typeof resolveAccessUrls === "function") {
      return resolveAccessUrls();
    }

    if (accessUrls) {
      return accessUrls;
    }

    return buildAccessUrls({
      port: fallbackPort,
      publicBaseUrl,
      localBaseUrl
    });
  }

  return async function handleRequest(request, response) {
    const requestId = randomUUID();
    const appRoot = path.join(process.cwd(), "public", "app");
    const clientRoot = path.join(process.cwd(), "src", "client");

    try {
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET") {
        const resolvedAccessUrls = getResolvedAccessUrls();
        const transport = buildTransportPayload({
          accessUrls: resolvedAccessUrls,
          localBaseUrl,
          publicBaseUrl: resolvedAccessUrls?.publicBaseUrl ?? publicBaseUrl
        });
        const requestOrigin = buildRequestOrigin(request, localBaseUrl);
        const initialState = await buildInitialAppState({
          adapter,
          commandStore,
          deviceRegistry,
          syncScheduler,
          workspaceId,
          transport,
          requestOrigin
        });
        const servedDynamicIndex = await tryServeStaticAppIndex({
          pathname: url.pathname,
          appRoot,
          response,
          requestId,
          initialState
        });

        if (servedDynamicIndex) {
          return;
        }

        const servedStaticApp = await tryServeStaticApp({
          pathname: url.pathname,
          appRoot,
          response,
          requestId
        });

        if (servedStaticApp) {
          return;
        }

        const servedClientModule = await tryServeClientModule({
          pathname: url.pathname,
          clientRoot,
          response,
          requestId
        });

        if (servedClientModule) {
          return;
        }
      }

      if (request.method === "GET" && url.pathname === "/pairing") {
        const device = await deviceRegistry.loadOrCreate({
          workspaceId,
          workspaceName: "Local Mac"
        });
        const resolvedAccessUrls = getResolvedAccessUrls();
        const transport = buildTransportPayload({
          accessUrls: resolvedAccessUrls,
          localBaseUrl,
          publicBaseUrl: resolvedAccessUrls?.publicBaseUrl ?? publicBaseUrl
        });
        return sendJson(response, 200, {
          deviceId: device.deviceId,
          workspaceId: device.workspaceId,
          workspaceName: device.workspaceName,
          updatedAt: device.updatedAt,
          authRequired: Boolean(authToken),
          pairingStatus: authToken ? "manual-bootstrap-required" : "direct-bootstrap-available",
          transport,
          appPairingUrl: buildAppPairingUrl({
            baseUrl: transport.phoneAccessUrl ?? transport.baseUrl
          }),
          qrImageUrl: "/pairing/qr.png"
        }, requestId);
      }

      if (request.method === "GET" && url.pathname === "/pairing/qr.png") {
        const resolvedAccessUrls = getResolvedAccessUrls();
        const transport = buildTransportPayload({
          accessUrls: resolvedAccessUrls,
          localBaseUrl,
          publicBaseUrl: resolvedAccessUrls?.publicBaseUrl ?? publicBaseUrl
        });
        const appPairingUrl = buildAppPairingUrl({
          baseUrl: transport.phoneAccessUrl ?? transport.baseUrl
        });

        if (!appPairingUrl) {
          return sendError(response, 400, "pairing_link_unavailable", "Pairing link unavailable", requestId);
        }

        const png = await pairingQrRenderer(appPairingUrl);
        return sendBytes(response, 200, png, "image/png", requestId);
      }

      if (!isAuthorized(request, authToken)) {
        return sendError(response, 401, "unauthorized", "Unauthorized", requestId);
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, {
          ok: true,
          sync: syncScheduler?.getStatus() ?? null
        }, requestId);
      }

      if (request.method === "GET" && url.pathname === "/snapshot") {
        const snapshot = await adapter.fetchSnapshot();
        return sendJson(response, 200, snapshot, requestId);
      }

      if (request.method === "GET" && url.pathname === "/events") {
        const runId = url.searchParams.get("runId") ?? undefined;
        const limit = Number(url.searchParams.get("limit") ?? "20");
        const events = await adapter.fetchRecentEvents({ runId, limit });
        return sendJson(response, 200, events, requestId);
      }

      if (request.method === "GET" && url.pathname === "/mobile/dashboard") {
        const [snapshot, commands, device] = await Promise.all([
          adapter.fetchSnapshot(),
          commandStore.list(),
          deviceRegistry.loadOrCreate({
            workspaceId,
            workspaceName: "Local Mac"
          })
        ]);

        return sendJson(
          response,
          200,
          buildDashboardResponse({
            snapshot,
            commands,
            device
          }),
          requestId
        );
      }

      if (request.method === "GET" && url.pathname === "/mobile/bootstrap") {
        const resolvedAccessUrls = getResolvedAccessUrls();
        const [snapshot, commands, device] = await Promise.all([
          adapter.fetchSnapshot(),
          commandStore.list(),
          deviceRegistry.loadOrCreate({
            workspaceId,
            workspaceName: "Local Mac"
          })
        ]);

        return sendJson(
          response,
          200,
          buildMobileBootstrapResponse({
            snapshot,
            commands,
            device,
            syncStatus: syncScheduler?.getStatus() ?? { enabled: false },
            publicBaseUrl: resolvedAccessUrls?.publicBaseUrl ?? publicBaseUrl,
            accessUrls: buildTransportPayload({
              accessUrls: resolvedAccessUrls,
              localBaseUrl,
              publicBaseUrl: resolvedAccessUrls?.publicBaseUrl ?? publicBaseUrl
            })
          }),
          requestId
        );
      }

      if (request.method === "GET" && url.pathname.startsWith("/mobile/sessions/")) {
        const sessionId = decodeURIComponent(url.pathname.replace("/mobile/sessions/", ""));
        const [snapshot, commands, events] = await Promise.all([
          adapter.fetchSnapshot(),
          commandStore.list(),
          adapter.fetchRecentEvents({ runId: sessionId, limit: 30 })
        ]);

        const session = snapshot.sessions.find((item) => item.id === sessionId);
        if (!session) {
          return sendError(response, 404, "session_not_found", "Session not found", requestId);
        }

        const run = snapshot.runs.find((item) => item.sessionId === sessionId) ?? null;
        const sessionCommands = commands.filter((command) => command.target.id === sessionId);

        return sendJson(
          response,
          200,
          buildMobileSessionDetail({
            session,
            run,
            commands: sessionCommands,
            events
          }),
          requestId
        );
      }

      if (request.method === "GET" && url.pathname === "/commands") {
        const commands = await commandStore.list();
        return sendJson(response, 200, commands, requestId);
      }

      if (request.method === "GET" && url.pathname === "/sync/status") {
        return sendJson(response, 200, syncScheduler?.getStatus() ?? { enabled: false }, requestId);
      }

      if (request.method === "GET" && url.pathname === "/pairing/token") {
        const device = await deviceRegistry.loadOrCreate({
          workspaceId,
          workspaceName: "Local Mac"
        });
        return sendJson(response, 200, {
          deviceId: device.deviceId,
          pairingToken: device.pairingToken,
          updatedAt: device.updatedAt
        }, requestId);
      }

      if (request.method === "GET" && url.pathname === "/pairing/bootstrap") {
        const device = await deviceRegistry.loadOrCreate({
          workspaceId,
          workspaceName: "Local Mac"
        });
        const bundle = buildPairingBundle({
          device,
          publicBaseUrl,
          accessUrls: buildTransportPayload({
            accessUrls,
            localBaseUrl,
            publicBaseUrl
          })
        });

        return sendJson(response, 200, {
          bundle,
          pairingCode: encodePairingBundle(bundle)
        }, requestId);
      }

      if (request.method === "POST" && url.pathname === "/pairing/rotate") {
        const device = await deviceRegistry.rotatePairingToken();
        return sendJson(response, 200, {
          deviceId: device.deviceId,
          pairingToken: device.pairingToken,
          updatedAt: device.updatedAt
        }, requestId);
      }

      if (request.method === "POST" && url.pathname === "/sync/run") {
        if (!syncScheduler) {
          return sendError(
            response,
            400,
            "sync_scheduler_not_configured",
            "Sync scheduler is not configured",
            requestId
          );
        }

        const result = await syncScheduler.runOnce();
        return sendJson(response, 202, {
          ok: true,
          result,
          status: syncScheduler.getStatus()
        }, requestId);
      }

      if (request.method === "POST" && url.pathname === "/commands") {
        const body = await readJsonBody(request);
        const device = await deviceRegistry.loadOrCreate({
          workspaceId,
          workspaceName: "Local Mac"
        });
        const envelope = createCommandEnvelope({
          id: body.id ?? randomUUID(),
          workspaceId,
          target: body.target,
          payload: body.payload,
          origin: "local",
          createdByDeviceId: device.deviceId
        });

        let record = await commandStore.create(envelope);
        record = await commandStore.updateStatus(record.id, {
          status: "running",
          startedAt: new Date().toISOString()
        });

        try {
          const ackEvent = await adapter.execute(envelope);
          record = await commandStore.updateStatus(record.id, {
            status: "completed",
            completedAt: new Date().toISOString(),
            acknowledgementId: ackEvent.id,
            acknowledgementLevel: ackEvent.level,
            acknowledgementMessage: ackEvent.message,
            acknowledgedAt: new Date().toISOString()
          });

          return sendJson(response, 202, {
            command: record,
            acknowledgement: ackEvent
          }, requestId);
        } catch (error) {
          record = await commandStore.updateStatus(record.id, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errorMessage: error instanceof Error ? error.message : "Unknown command failure"
          });

          return sendError(
            response,
            500,
            "command_execution_failed",
            record.errorMessage ?? "Unknown command failure",
            requestId,
            {
              command: record
            }
          );
        }
      }

      return sendError(response, 404, "not_found", "Not found", requestId);
    } catch (error) {
      if (isCommandValidationError(error)) {
        return sendError(
          response,
          400,
          "invalid_command",
          error.message,
          requestId
        );
      }

      if (error instanceof SyntaxError) {
        return sendError(response, 400, "invalid_json", "Invalid JSON body", requestId);
      }

      return sendError(response, 500, "internal_error", "Internal server error", requestId);
    }
  };
}

export {
  createCodexRemoteHandler as createControlPlaneHandler,
  createCodexRemoteServer as createControlPlaneServer
};

function safePortFromBaseUrl(value) {
  try {
    return Number(new URL(value).port || "80");
  } catch {
    return 8793;
  }
}

function buildTransportPayload({ accessUrls, localBaseUrl, publicBaseUrl }) {
  if (accessUrls) {
    return {
      type: "http",
      baseUrl: accessUrls.publicBaseUrl ?? accessUrls.phoneAccessUrl ?? localBaseUrl,
      localBaseUrl: accessUrls.localBaseUrl ?? localBaseUrl,
      publicBaseUrl: accessUrls.publicBaseUrl ?? accessUrls.phoneAccessUrl ?? localBaseUrl,
      phoneAccessUrl: accessUrls.phoneAccessUrl ?? null,
      isLocalOnly: accessUrls.isLocalOnly ?? false,
      hint: accessUrls.hint ?? null
    };
  }

  const isLocalOnly = publicBaseUrl === localBaseUrl;
  return {
    type: "http",
    baseUrl: publicBaseUrl,
    localBaseUrl,
    publicBaseUrl,
    phoneAccessUrl: isLocalOnly ? null : publicBaseUrl,
    isLocalOnly,
    hint: isLocalOnly
      ? "当前地址只在这台 Mac 上可用。"
      : "请让 iPhone 和 Mac 连接到同一网络，再在手机上打开这个地址。"
  };
}

async function buildInitialAppState({
  adapter,
  commandStore,
  deviceRegistry,
  syncScheduler,
  workspaceId,
  transport,
  requestOrigin
}) {
  const [snapshot, commands, device] = await Promise.all([
    adapter.fetchSnapshot(),
    commandStore.list(),
    deviceRegistry.loadOrCreate({
      workspaceId,
      workspaceName: "Local Mac"
    })
  ]);

  const dashboardBootstrap = buildMobileBootstrapResponse({
    snapshot,
    commands,
    device,
    syncStatus: syncScheduler?.getStatus() ?? { enabled: false },
    publicBaseUrl: requestOrigin,
    accessUrls: transport
  });

  const publicPairing = {
    deviceId: device.deviceId,
    workspaceId: device.workspaceId,
    workspaceName: device.workspaceName,
    updatedAt: device.updatedAt,
    authRequired: false,
    pairingStatus: "direct-bootstrap-available",
    transport,
    appPairingUrl: buildAppPairingUrl({
      baseUrl: transport.phoneAccessUrl ?? requestOrigin
    }),
    qrImageUrl: "/pairing/qr.png"
  };

  const bundle = buildPairingBundle({
    device,
    publicBaseUrl: requestOrigin,
    accessUrls: transport
  });

  return {
    publicPairing,
    bundle,
    bootstrap: dashboardBootstrap
  };
}

function buildRequestOrigin(request, fallbackBaseUrl) {
  const host = request.headers?.host;
  if (!host) {
    return fallbackBaseUrl;
  }

  return `http://${host}`;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function isAuthorized(request, authToken) {
  if (!authToken) {
    return true;
  }

  const header = request.headers.authorization ?? "";
  return header === `Bearer ${authToken}`;
}

function isCommandValidationError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "Command id is required",
    "workspaceId is required",
    "target.type and target.id are required",
    "payload.kind is required"
  ].includes(error.message);
}

function sendJson(response, statusCode, payload, requestId) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendBytes(response, statusCode, payload, contentType, requestId) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "content-length": payload.length,
    "cache-control": "no-store",
    "x-request-id": requestId
  });
  response.end(payload);
}

function sendError(response, statusCode, code, message, requestId, extra = {}) {
  return sendJson(
    response,
    statusCode,
    {
      requestId,
      error: {
        code,
        message
      },
      ...extra
    },
    requestId
  );
}
