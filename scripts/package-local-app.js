import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildAppleScriptSource,
  buildLauncherShellScript,
  buildStopShellScript
} from "../src/launcher/launcher-script.js";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const outputRoot = path.join(projectRoot, "dist", "codex-remote-app");
const launcherAppPath = path.join(projectRoot, "dist", "Codex Remote.app");
const launcherCommandPath = path.join(projectRoot, "dist", "Launch Codex Remote.command");
const stopCommandPath = path.join(projectRoot, "dist", "Stop Codex Remote.command");
const legacyArtifacts = [
  path.join(projectRoot, "dist", "control-plane-app"),
  path.join(projectRoot, "dist", "Codex Control Plane.app"),
  path.join(projectRoot, "dist", "Launch Codex Control Plane.command"),
  path.join(projectRoot, "dist", "Stop Codex Control Plane.command")
];

const directoriesToCopy = [
  "Sources",
  "Tests",
  "src",
  "public",
  "supabase"
];

const filesToCopy = [
  "Package.swift",
  "package.json",
  "README.md"
];

async function main() {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.rm(launcherAppPath, { recursive: true, force: true });
  await fs.rm(launcherCommandPath, { recursive: true, force: true });
  await fs.rm(stopCommandPath, { recursive: true, force: true });
  for (const legacyArtifact of legacyArtifacts) {
    await fs.rm(legacyArtifact, { recursive: true, force: true });
  }
  await fs.mkdir(outputRoot, { recursive: true });

  for (const directory of directoriesToCopy) {
    await copyRecursive(path.join(projectRoot, directory), path.join(outputRoot, directory));
  }

  for (const file of filesToCopy) {
    await fs.copyFile(path.join(projectRoot, file), path.join(outputRoot, file));
  }

  await fs.writeFile(
    path.join(outputRoot, "RUN_APP.md"),
    [
      "# Run Packaged App",
      "",
      "1. `cd dist/codex-remote-app`",
      "2. `npm run server:start`",
      "3. Open `http://127.0.0.1:8793/app`",
      "4. Optional desktop shell: `npm run desktop:build` then `swift run ControlPlaneDesktop`",
      "5. Or double-click `dist/Codex Remote.app` / `dist/Launch Codex Remote.command`",
      "6. Stop the background server with `dist/Stop Codex Remote.command`",
      "",
      "Optional environment variables:",
      "",
      "- `CODEX_REMOTE_TOKEN`",
      "- `CODEX_REMOTE_DESKTOP_URL=http://127.0.0.1:8793/app`",
      "- `CODEX_REMOTE_SYNC_TARGET=json-file|supabase`",
      "- `CODEX_REMOTE_SYNC_INTERVAL_MS=30000`",
      "- `CODEX_REMOTE_PUBLIC_BASE_URL=http://127.0.0.1:8793`",
      "- `SUPABASE_URL`",
      "- `SUPABASE_SERVICE_ROLE_KEY`"
    ].join("\n")
  );

  await createMacLauncherArtifacts();

  console.log(`Packaged app written to ${outputRoot}`);
}

async function createMacLauncherArtifacts() {
  const launcherScript = buildLauncherShellScript();
  const stopScript = buildStopShellScript();
  const appleScriptPath = path.join(projectRoot, "dist", "launcher.applescript");

  await fs.writeFile(launcherCommandPath, launcherScript, { mode: 0o755 });
  await fs.writeFile(stopCommandPath, stopScript, { mode: 0o755 });
  await fs.writeFile(appleScriptPath, buildAppleScriptSource(), "utf8");

  await execFileAsync("osacompile", [
    "-o",
    launcherAppPath,
    appleScriptPath
  ]);

  const resourcesRoot = path.join(launcherAppPath, "Contents", "Resources");
  const bundledLauncherScript = path.join(resourcesRoot, "start-control-plane.command");
  await fs.mkdir(resourcesRoot, { recursive: true });
  await fs.writeFile(bundledLauncherScript, launcherScript, { mode: 0o755 });
  await fs.rm(appleScriptPath, { force: true });
}

async function copyRecursive(source, destination) {
  const stats = await fs.stat(source);

  if (stats.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyRecursive(
        path.join(source, entry.name),
        path.join(destination, entry.name)
      );
    }
    return;
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
