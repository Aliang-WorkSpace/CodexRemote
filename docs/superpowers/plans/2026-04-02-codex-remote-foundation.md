# Codex Remote Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first implementation slice of a self-use Codex remote control product: shared domain types, command protocol, Supabase schema, and a Mac agent scaffold.

**Architecture:** Use a small JavaScript package as the immediately runnable shared foundation for the Mac agent and protocol work, while keeping the data model stable for future iPhone and macOS clients. Keep Codex-specific behavior behind an adapter protocol and use a Supabase-oriented schema for cloud relay state.

**Tech Stack:** Node.js, native node:test, JavaScript ES modules, SQL

---

### Task 1: Package Skeleton

**Files:**
- Create: `package.json`
- Create: `src/core/`
- Create: `src/agent/`
- Create: `test/`

- [ ] Create the package manifest with one test command and one demo agent command.
- [ ] Add the `src/core` area for shared models and protocol helpers.
- [ ] Add the `src/agent` area for the Mac agent runtime and Codex adapter.
- [ ] Add the `test` area for command and snapshot behavior tests.

### Task 2: Command Protocol With TDD

**Files:**
- Create: `test/command-envelope.test.js`
- Create: `src/core/command-envelope.js`

- [ ] Write tests for command encoding and decoding.
- [ ] Run `npm test` and confirm the new tests fail.
- [ ] Implement `CommandEnvelope` and `CommandPayload`.
- [ ] Run `npm test` and confirm the command tests pass.

### Task 3: Session And Run Indexing With TDD

**Files:**
- Create: `test/workspace-snapshot.test.js`
- Create: `src/core/domain-models.js`

- [ ] Write tests covering active run filtering and child-run grouping.
- [ ] Run `npm test` and confirm the new tests fail.
- [ ] Implement the minimal domain models and snapshot helpers.
- [ ] Run `npm test` and confirm the snapshot tests pass.

### Task 4: Agent Scaffold

**Files:**
- Create: `src/agent/demo-agent.js`
- Create: `src/agent/agent-runtime.js`
- Create: `src/agent/codex-adapter.js`

- [ ] Add an adapter protocol for listing sessions and executing commands.
- [ ] Add an in-memory agent runtime that refreshes snapshots and routes commands.
- [ ] Add a small executable entry point that boots the runtime in demo mode.

### Task 5: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] Add tables for workspaces, sessions, runs, automations, commands, and run events.
- [ ] Add enum types and indexes required for the first milestone.
- [ ] Keep the schema aligned with the shared Swift model names.

### Task 6: Verify Foundation

**Files:**
- Modify: `README.md`

- [ ] Add a short project README describing the milestone scope and how to run tests.
- [ ] Run `npm test`.
- [ ] Run `npm run agent:demo`.
