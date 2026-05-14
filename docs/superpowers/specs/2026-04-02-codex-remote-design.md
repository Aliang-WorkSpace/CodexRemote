# Codex Remote Design

**Goal**

Build a self-use remote control product that lets an iPhone control all Codex activity running on one personal Mac.

## Scope

V1 is intentionally narrow:

- Single user
- Single Mac workspace
- iPhone as the primary remote control surface
- Cloud relay for sync and command delivery
- Mac-resident control agent that discovers and manages Codex activity

V1 should support:

- Viewing active and historical Codex sessions
- Viewing runs, child-agent relationships, and automation executions
- Triggering templates and automations
- Sending follow-up prompts into an existing session
- Executing operational commands such as stop, retry, and resume

## Architecture

The system has four runtime parts:

1. `iPhone App`
   Displays sessions, runs, automations, recent events, and sends remote commands.
2. `Cloud Relay Layer`
   Stores state and acts as the command relay. Supabase is the initial implementation target.
3. `Mac Control Agent`
   Runs locally on the Mac, watches Codex state, syncs snapshots and events, polls for commands, and executes them.
4. `Codex Adapter`
   Converts Codex-specific runtime details into a stable domain model used by all clients.

## Data Model

The primary entities are:

- `Workspace`: One managed Mac environment
- `Session`: A long-lived Codex conversation
- `Run`: A concrete execution attached to a session, automation, or template
- `Automation`: A reusable scheduled or manual task definition
- `CommandEnvelope`: A remote instruction issued by the phone and consumed by the Mac agent
- `RunEvent`: Append-only event stream for state transitions, logs, and command acknowledgements

## Sync Model

- The cloud database is the shared state source for metadata and event history.
- The Mac agent is the execution source of truth for command outcomes.
- The iPhone never controls local processes directly.
- Every remote action is recorded as a command and acknowledged by a resulting event.

## Command Model

The first command set is:

- `startAutomation`
- `startTemplate`
- `sendPrompt`
- `stopRun`
- `retryRun`
- `resumeRun`
- `cancelCommand`

Each command carries:

- Stable command id
- Target entity id
- Workspace id
- Optional session id or run id
- Payload
- Requested timestamp

## Reliability

- Commands are idempotent by command id.
- Agent-side execution should write an acknowledgement event before and after execution.
- State snapshots and append-only events should both be stored so the phone can render fast lists and also inspect history.
- Unknown Codex details are isolated behind the adapter so later support for Claude Code or Cursor does not break the shared protocol.

## Initial Milestone

The first coding milestone does not attempt to ship the full app. It creates the foundation needed for both clients:

- Shared JavaScript domain package for the control-plane model and command protocol
- Supabase SQL schema for workspaces, sessions, runs, automations, commands, and events
- Mac Control Agent scaffold with adapter protocol, in-memory registry, and command execution loop stub
- Automated tests for command serialization and run/session indexing

## Out of Scope For This Milestone

- Full iPhone UI
- Full macOS UI
- Push notifications
- Live Codex process discovery
- Authentication and device pairing UX
