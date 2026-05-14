import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAppleScriptSource,
  buildLauncherShellScript,
  buildStopShellScript
} from "../src/launcher/launcher-script.js";

test("buildLauncherShellScript selects a reusable or free port before starting", () => {
  const script = buildLauncherShellScript();

  assert.match(script, /resolve_port/);
  assert.match(script, /resolve_lan_ip/);
  assert.match(script, /CODEX_REMOTE_FALLBACK_PORTS/);
  assert.match(script, /CODEX_REMOTE_HOST/);
  assert.match(script, /selected-port/);
  assert.match(script, /\/health/);
  assert.match(script, /open "\$BASE_URL"/);
});

test("buildStopShellScript reads the selected port file for shutdown", () => {
  const script = buildStopShellScript();

  assert.match(script, /selected-port/);
  assert.match(script, /PORT_FILE/);
  assert.match(script, /find_listening_pid/);
});

test("buildAppleScriptSource produces multiline AppleScript content", () => {
  const source = buildAppleScriptSource();

  assert.match(source, /on run/);
  assert.match(source, /\n/);
  assert.doesNotMatch(source, /\\n/);
});
