export function buildSyncPayload({ snapshot, commands, device, generatedAt }) {
  return {
    generatedAt,
    workspace: snapshot.workspace,
    device: {
      deviceId: device.deviceId,
      workspaceId: device.workspaceId,
      workspaceName: device.workspaceName,
      updatedAt: device.updatedAt
    },
    sessions: snapshot.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      latestRunId: session.latestRunId ?? null,
      cwd: session.cwd ?? null,
      model: session.model ?? null,
      reasoningEffort: session.reasoningEffort ?? null,
      updatedAt: session.updatedAt
    })),
    runs: snapshot.runs.map((run) => ({
      id: run.id,
      sessionId: run.sessionId ?? null,
      parentRunId: run.parentRunId ?? null,
      automationId: run.automationId ?? null,
      status: run.status,
      summary: run.summary ?? null
    })),
    automations: snapshot.automations.map((automation) => ({
      id: automation.id,
      name: automation.name,
      isEnabled: automation.isEnabled,
      schedule: automation.schedule ?? null,
      cwd: automation.cwd ?? null,
      updatedAt: automation.updatedAt ?? null
    })),
    templates: (snapshot.templates ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      path: template.path
    })),
    commands: commands.map((command) => ({
      id: command.id,
      workspaceId: command.workspaceId,
      target: command.target,
      payload: command.payload,
      origin: command.origin ?? null,
      createdByDeviceId: command.createdByDeviceId ?? null,
      claimedByDeviceId: command.claimedByDeviceId ?? null,
      claimedAt: command.claimedAt ?? null,
      leaseExpiresAt: command.leaseExpiresAt ?? null,
      acknowledgedAt: command.acknowledgedAt ?? null,
      status: command.status,
      createdAt: command.createdAt,
      startedAt: command.startedAt ?? null,
      completedAt: command.completedAt ?? null,
      acknowledgementMessage: command.acknowledgementMessage ?? null,
      errorMessage: command.errorMessage ?? null
    }))
  };
}
