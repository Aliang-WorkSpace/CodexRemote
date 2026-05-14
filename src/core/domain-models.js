export const runStatuses = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  WAITING_FOR_INPUT: "waitingForInput",
  IDLE: "idle",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled"
});

export function isActiveRun(run) {
  return [
    runStatuses.QUEUED,
    runStatuses.RUNNING,
    runStatuses.WAITING_FOR_INPUT
  ].includes(run.status);
}

export function groupChildRunsByParent(runs) {
  return runs.reduce((accumulator, run) => {
    if (!run.parentRunId) {
      return accumulator;
    }

    const current = accumulator.get(run.parentRunId) ?? [];
    current.push(run);
    accumulator.set(run.parentRunId, current);
    return accumulator;
  }, new Map());
}

export function createWorkspaceSnapshot({
  workspace,
  sessions = [],
  runs = [],
  automations = []
}) {
  return {
    workspace,
    sessions,
    runs,
    automations
  };
}

export function listActiveRuns(snapshot) {
  return snapshot.runs.filter(isActiveRun);
}
