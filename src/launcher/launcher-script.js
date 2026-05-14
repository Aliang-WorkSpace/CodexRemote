export function buildLauncherShellScript() {
  return `#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ "$SCRIPT_DIR" == *".app/Contents/Resources" ]]; then
  DIST_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
else
  DIST_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
fi

APP_ROOT="$DIST_ROOT/codex-remote-app"
DEFAULT_PORT="\${CODEX_REMOTE_PORT:-\${CONTROL_PLANE_PORT:-8793}}"
HOST="\${CODEX_REMOTE_HOST:-\${CONTROL_PLANE_HOST:-0.0.0.0}}"
FALLBACK_PORTS_RAW="\${CODEX_REMOTE_FALLBACK_PORTS:-\${CONTROL_PLANE_FALLBACK_PORTS:-8793 8794 8795}}"
START_PATH="\${CODEX_REMOTE_START_PATH:-\${CONTROL_PLANE_START_PATH:-/app}}"
AUTO_OPEN="\${CODEX_REMOTE_AUTO_OPEN:-\${CONTROL_PLANE_AUTO_OPEN:-1}}"
LOG_DIR="\${CODEX_REMOTE_LOG_DIR:-\${CONTROL_PLANE_LOG_DIR:-$HOME/Library/Logs/CodexRemote}}"
STATE_DIR="\${CODEX_REMOTE_STATE_DIR:-\${CONTROL_PLANE_STATE_DIR:-$HOME/Library/Application Support/CodexRemote}}"
LOG_FILE="$LOG_DIR/server.log"
PID_FILE="$STATE_DIR/server.pid"
PORT_FILE="$STATE_DIR/selected-port"

mkdir -p "$LOG_DIR" "$STATE_DIR"

probe_health() {
  local port="$1"
  curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1
}

port_in_use() {
  local port="$1"
  lsof -n -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

resolve_lan_ip() {
  local candidate=""

  for device in en0 en1; do
    candidate="$(ipconfig getifaddr "$device" 2>/dev/null || true)"
    if [[ -n "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  candidate="$(ifconfig | awk '/inet / && $2 != "127.0.0.1" && $2 !~ /^169\\.254\\./ { print $2; exit }')"
  if [[ -n "$candidate" ]]; then
    echo "$candidate"
    return 0
  fi

  return 1
}

resolve_port() {
  local candidates=()
  candidates+=("$DEFAULT_PORT")

  for candidate in \${=FALLBACK_PORTS_RAW}; do
    candidates+=("$candidate")
  done

  local seen=""
  for candidate in "\${candidates[@]}"; do
    [[ -z "$candidate" ]] && continue
    if [[ " $seen " == *" $candidate "* ]]; then
      continue
    fi
    seen="$seen $candidate"

    if probe_health "$candidate"; then
      SELECTED_PORT="$candidate"
      PORT_MODE="reuse"
      return 0
    fi

    if ! port_in_use "$candidate"; then
      SELECTED_PORT="$candidate"
      PORT_MODE="start"
      return 0
    fi
  done

  return 1
}

if ! resolve_port; then
  osascript -e 'display alert "Codex Remote" message "No free local port is available for Codex Remote." as critical'
  exit 1
fi

LAN_IP=""
if [[ "$HOST" != "127.0.0.1" && "$HOST" != "localhost" ]]; then
  LAN_IP="$(resolve_lan_ip || true)"
fi

PUBLIC_BASE_URL="\${CODEX_REMOTE_PUBLIC_BASE_URL:-\${CONTROL_PLANE_PUBLIC_BASE_URL:-}}"
if [[ -z "$PUBLIC_BASE_URL" ]]; then
  if [[ -n "$LAN_IP" ]]; then
    PUBLIC_BASE_URL="http://$LAN_IP:$SELECTED_PORT"
  else
    PUBLIC_BASE_URL="http://127.0.0.1:$SELECTED_PORT"
  fi
fi

BASE_URL="$PUBLIC_BASE_URL$START_PATH"
PROBE_URL="http://127.0.0.1:$SELECTED_PORT/health"
echo "$SELECTED_PORT" > "$PORT_FILE"

if [[ "$PORT_MODE" == "start" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Codex Remote on port $SELECTED_PORT" >> "$LOG_FILE"
  (
    cd "$APP_ROOT"
    CODEX_REMOTE_PORT="$SELECTED_PORT" \\
    CODEX_REMOTE_HOST="$HOST" \\
    CODEX_REMOTE_PUBLIC_BASE_URL="$PUBLIC_BASE_URL" \\
    nohup node src/server/start-server.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  for _ in {1..30}; do
    if probe_health "$SELECTED_PORT"; then
      break
    fi
    sleep 1
  done
fi

if ! probe_health "$SELECTED_PORT"; then
  osascript -e 'display alert "Codex Remote" message "Local server did not become ready. The log file will open next." as critical'
  open "$LOG_FILE"
  exit 1
fi

if [[ "$AUTO_OPEN" == "1" ]]; then
  open "$BASE_URL"
fi
`;
}

export function buildStopShellScript() {
  return `#!/bin/zsh
set -euo pipefail

STATE_DIR="\${CODEX_REMOTE_STATE_DIR:-\${CONTROL_PLANE_STATE_DIR:-$HOME/Library/Application Support/CodexRemote}}"
PID_FILE="$STATE_DIR/server.pid"
PORT_FILE="$STATE_DIR/selected-port"
PORT="\${CODEX_REMOTE_PORT:-\${CONTROL_PLANE_PORT:-}}"

find_listening_pid() {
  local port="$1"
  lsof -n -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1
}

if [[ -z "$PORT" && -f "$PORT_FILE" ]]; then
  PORT="$(cat "$PORT_FILE")"
fi

PID=""
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
fi

if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
  kill "$PID"
  echo "Stopped Codex Remote server ($PID)."
elif [[ -n "$PORT" ]]; then
  PID="$(find_listening_pid "$PORT")"
  if [[ -n "$PID" ]]; then
    kill "$PID"
    echo "Stopped Codex Remote server on port $PORT ($PID)."
  else
    echo "No running Codex Remote server found on port $PORT."
  fi
else
  echo "No remembered port found for Codex Remote."
fi

rm -f "$PID_FILE"
`;
}

export function buildAppleScriptSource() {
  return [
    "use scripting additions",
    "",
    "on run",
    "  set appPath to POSIX path of (path to me)",
    '  set launcherPath to POSIX file (appPath & "Contents/Resources/start-control-plane.command")',
    '  tell application "Finder"',
    "    open launcherPath",
    "  end tell",
    "end run",
    ""
  ].join("\n");
}
