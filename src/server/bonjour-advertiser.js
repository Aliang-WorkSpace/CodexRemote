import { spawn } from "node:child_process";

export const BONJOUR_SERVICE_TYPE = "_codexctl._tcp";

export function buildBonjourAdvertiseArgs({
  name,
  port,
  domain = "local."
}) {
  return ["-R", name, BONJOUR_SERVICE_TYPE, domain, String(port)];
}

export class BonjourAdvertiser {
  constructor({
    name,
    port,
    spawnImpl = spawn
  }) {
    this.name = name;
    this.port = port;
    this.spawnImpl = spawnImpl;
    this.process = null;
  }

  start() {
    if (this.process) {
      return;
    }

    this.process = this.spawnImpl("dns-sd", buildBonjourAdvertiseArgs({
      name: this.name,
      port: this.port
    }), {
      stdio: "ignore"
    });

    this.process.once("exit", () => {
      this.process = null;
    });
  }

  stop() {
    if (!this.process) {
      return;
    }

    this.process.kill("SIGTERM");
    this.process = null;
  }
}
