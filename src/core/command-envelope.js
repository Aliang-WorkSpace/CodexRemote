export const commandKinds = Object.freeze({
  START_AUTOMATION: "startAutomation",
  START_TEMPLATE: "startTemplate",
  SEND_PROMPT: "sendPrompt",
  STOP_RUN: "stopRun",
  RETRY_RUN: "retryRun",
  RESUME_RUN: "resumeRun",
  CANCEL_COMMAND: "cancelCommand"
});

export const commandOrigins = Object.freeze({
  LOCAL: "local",
  REMOTE: "remote"
});

export function createCommandEnvelope({
  id,
  workspaceId,
  target,
  payload,
  requestedAt,
  origin = commandOrigins.LOCAL,
  createdByDeviceId = null,
  claimedByDeviceId = null,
  claimedAt = null,
  leaseExpiresAt = null,
  acknowledgedAt = null
}) {
  if (!id) {
    throw new Error("Command id is required");
  }

  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  if (!target?.type || !target?.id) {
    throw new Error("target.type and target.id are required");
  }

  if (!payload?.kind) {
    throw new Error("payload.kind is required");
  }

  return {
    id,
    workspaceId,
    target,
    payload,
    requestedAt: requestedAt ?? new Date().toISOString(),
    origin,
    createdByDeviceId,
    claimedByDeviceId,
    claimedAt,
    leaseExpiresAt,
    acknowledgedAt
  };
}

export function serializeCommandEnvelope(envelope) {
  return JSON.stringify(envelope);
}

export function deserializeCommandEnvelope(json) {
  return JSON.parse(json);
}
