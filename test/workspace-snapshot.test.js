import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkspaceSnapshot,
  groupChildRunsByParent,
  listActiveRuns,
  runStatuses
} from "../src/core/domain-models.js";

test("returns only active runs from a workspace snapshot", () => {
  const snapshot = createWorkspaceSnapshot({
    workspace: {
      id: "ws_main",
      name: "Primary Mac"
    },
    sessions: [
      {
        id: "session_1",
        title: "Build iOS client",
        status: "active",
        latestRunId: "run_active"
      }
    ],
    runs: [
      {
        id: "run_active",
        status: runStatuses.RUNNING
      },
      {
        id: "run_done",
        status: runStatuses.COMPLETED
      }
    ]
  });

  assert.deepEqual(
    listActiveRuns(snapshot).map((run) => run.id),
    ["run_active"]
  );
});

test("groups child runs by parent run id", () => {
  const grouped = groupChildRunsByParent([
    {
      id: "run_parent",
      parentRunId: null,
      status: runStatuses.RUNNING
    },
    {
      id: "run_child_1",
      parentRunId: "run_parent",
      status: runStatuses.RUNNING
    },
    {
      id: "run_child_2",
      parentRunId: "run_parent",
      status: runStatuses.FAILED
    }
  ]);

  assert.deepEqual(
    grouped.get("run_parent").map((run) => run.id),
    ["run_child_1", "run_child_2"]
  );
});
