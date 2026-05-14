import fs from "node:fs/promises";
import path from "node:path";

import { createCommandEnvelope } from "../core/command-envelope.js";

function createRecord(commandEnvelope) {
  return {
    ...createCommandEnvelope(commandEnvelope),
    status: "queued",
    createdAt: new Date().toISOString()
  };
}

function applyStatusPatch(record, patch) {
  return {
    ...record,
    ...patch
  };
}

export class InMemoryCommandStore {
  #commands = [];

  create(commandEnvelope) {
    const record = createRecord(commandEnvelope);

    this.#commands.unshift(record);
    return record;
  }

  async list() {
    return [...this.#commands];
  }

  updateStatus(commandId, patch) {
    const index = this.#commands.findIndex((command) => command.id === commandId);
    if (index === -1) {
      throw new Error(`Unknown command: ${commandId}`);
    }

    const updated = applyStatusPatch(this.#commands[index], patch);
    this.#commands[index] = updated;
    return updated;
  }
}

export class FileCommandStore {
  #filePath;
  #commands = new Map();
  #initialized = false;

  constructor({ filePath }) {
    this.#filePath = filePath;
  }

  async create(commandEnvelope) {
    await this.#ensureLoaded();
    const record = createRecord(commandEnvelope);
    this.#commands.set(record.id, record);
    await this.#appendRecord(record);
    return record;
  }

  async list() {
    await this.#ensureLoaded();
    return [...this.#commands.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  async updateStatus(commandId, patch) {
    await this.#ensureLoaded();
    const existing = this.#commands.get(commandId);
    if (!existing) {
      throw new Error(`Unknown command: ${commandId}`);
    }

    const updated = applyStatusPatch(existing, patch);
    this.#commands.set(commandId, updated);
    await this.#appendRecord(updated);
    return updated;
  }

  async #ensureLoaded() {
    if (this.#initialized) {
      return;
    }

    this.#initialized = true;

    try {
      const content = await fs.readFile(this.#filePath, "utf8");
      for (const line of content.split("\n")) {
        if (!line.trim()) {
          continue;
        }
        const record = JSON.parse(line);
        this.#commands.set(record.id, record);
      }
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  async #appendRecord(record) {
    await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
    await fs.appendFile(this.#filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
