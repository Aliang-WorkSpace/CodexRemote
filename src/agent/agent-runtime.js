import { listActiveRuns } from "../core/domain-models.js";

export class AgentRuntime {
  #adapter;
  #latestSnapshot = null;

  constructor({ adapter }) {
    this.#adapter = adapter;
  }

  get latestSnapshot() {
    return this.#latestSnapshot;
  }

  async refresh() {
    const snapshot = await this.#adapter.fetchSnapshot();
    this.#latestSnapshot = snapshot;
    return snapshot;
  }

  async handle(commandEnvelope) {
    return this.#adapter.execute(commandEnvelope);
  }

  async summarize() {
    const snapshot = this.#latestSnapshot ?? (await this.refresh());
    return {
      workspaceName: snapshot.workspace.name,
      sessionCount: snapshot.sessions.length,
      activeRunCount: listActiveRuns(snapshot).length,
      automationCount: snapshot.automations.length
    };
  }
}

