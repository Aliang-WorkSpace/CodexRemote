export class DemoCodexAdapter {
  async fetchSnapshot() {
    return {
      workspace: {
        id: "ws_main",
        name: "Primary Mac"
      },
      sessions: [
        {
          id: "session_demo",
          title: "Remote control plane bootstrap",
          status: "active",
          latestRunId: "run_demo"
        }
      ],
      runs: [
        {
          id: "run_demo",
          sessionId: "session_demo",
          parentRunId: null,
          automationId: null,
          status: "waitingForInput",
          summary: "Awaiting remote prompt"
        }
      ],
      automations: [
        {
          id: "automation_nightly",
          name: "Nightly workspace summary",
          isEnabled: true
        }
      ]
    };
  }

  async execute(commandEnvelope) {
    return {
      id: crypto.randomUUID(),
      runId: commandEnvelope.target.id,
      level: "info",
      message: `Executed ${commandEnvelope.payload.kind} for ${commandEnvelope.target.type}:${commandEnvelope.target.id}`,
      occurredAt: new Date().toISOString()
    };
  }
}

