create type session_status as enum ('active', 'idle', 'archived');
create type run_status as enum ('queued', 'running', 'waitingForInput', 'completed', 'failed', 'cancelled');
create type command_kind as enum ('startAutomation', 'startTemplate', 'sendPrompt', 'stopRun', 'retryRun', 'resumeRun', 'cancelCommand');
create type command_status as enum ('queued', 'acked', 'running', 'completed', 'failed', 'cancelled');
create type event_level as enum ('info', 'warning', 'error');

create table if not exists workspaces (
    id text primary key,
    name text not null,
    created_at timestamptz not null default now()
);

create table if not exists sessions (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    title text not null,
    status session_status not null,
    latest_run_id text,
    cwd text,
    model text,
    reasoning_effort text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists automations (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    name text not null,
    is_enabled boolean not null default true,
    schedule text,
    cwd text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists devices (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    workspace_name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists templates (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    name text not null,
    path text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists runs (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    session_id text references sessions(id) on delete set null,
    parent_run_id text references runs(id) on delete set null,
    automation_id text references automations(id) on delete set null,
    status run_status not null,
    summary text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table sessions
    add constraint sessions_latest_run_fk
    foreign key (latest_run_id) references runs(id) on delete set null;

create table if not exists commands (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    target_type text not null,
    target_id text not null,
    kind command_kind not null,
    payload jsonb not null,
    status command_status not null default 'queued',
    requested_at timestamptz not null,
    started_at timestamptz,
    completed_at timestamptz,
    acknowledgement_message text,
    error_message text
);

create table if not exists run_events (
    id text primary key,
    workspace_id text not null references workspaces(id) on delete cascade,
    run_id text not null references runs(id) on delete cascade,
    level event_level not null,
    message text not null,
    occurred_at timestamptz not null
);

create table if not exists sync_snapshots (
    workspace_id text not null references workspaces(id) on delete cascade,
    device_id text not null references devices(id) on delete cascade,
    generated_at timestamptz not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    primary key (workspace_id, device_id, generated_at)
);

create index if not exists idx_sessions_workspace on sessions(workspace_id);
create index if not exists idx_automations_workspace on automations(workspace_id);
create index if not exists idx_devices_workspace on devices(workspace_id);
create index if not exists idx_templates_workspace on templates(workspace_id);
create index if not exists idx_runs_workspace on runs(workspace_id);
create index if not exists idx_runs_session on runs(session_id);
create index if not exists idx_runs_parent on runs(parent_run_id);
create index if not exists idx_commands_workspace_status on commands(workspace_id, status);
create index if not exists idx_events_run_occurred on run_events(run_id, occurred_at desc);
create index if not exists idx_sync_snapshots_workspace_generated on sync_snapshots(workspace_id, generated_at desc);
