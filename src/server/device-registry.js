import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

export class DeviceRegistry {
  #filePath;
  #now;
  #cachedDevice = null;

  constructor({ filePath, now = () => new Date().toISOString() }) {
    this.#filePath = filePath;
    this.#now = now;
  }

  async loadOrCreate({ workspaceId, workspaceName }) {
    if (this.#cachedDevice) {
      return this.#cachedDevice;
    }

    const existing = await this.#readDevice();
    if (existing) {
      this.#cachedDevice = existing;
      return existing;
    }

    const timestamp = this.#now();
    const device = {
      deviceId: randomUUID(),
      workspaceId,
      workspaceName,
      pairingToken: createPairingToken(),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.#writeDevice(device);
    this.#cachedDevice = device;
    return device;
  }

  async rotatePairingToken() {
    const device = await this.#requireDevice();
    const updated = {
      ...device,
      pairingToken: createPairingToken(),
      updatedAt: this.#now()
    };

    await this.#writeDevice(updated);
    this.#cachedDevice = updated;
    return updated;
  }

  async #requireDevice() {
    const existing = this.#cachedDevice ?? (await this.#readDevice());
    if (!existing) {
      throw new Error("Device registration does not exist yet");
    }
    return existing;
  }

  async #readDevice() {
    try {
      const content = await fs.readFile(this.#filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async #writeDevice(device) {
    await fs.mkdir(path.dirname(this.#filePath), { recursive: true });
    await fs.writeFile(this.#filePath, JSON.stringify(device, null, 2));
  }
}

export function createPairingToken() {
  return randomBytes(24).toString("base64url");
}
