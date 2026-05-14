import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DeviceRegistry,
  createPairingToken
} from "../src/server/device-registry.js";

test("creates and persists a device registration", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "device-registry-"));
  const filePath = path.join(tempDir, "device.json");

  const registry = new DeviceRegistry({
    filePath,
    now: () => "2026-04-02T06:20:00.000Z"
  });

  const device = await registry.loadOrCreate({
    workspaceId: "local-mac",
    workspaceName: "Local Mac"
  });

  assert.equal(device.workspaceId, "local-mac");
  assert.equal(device.workspaceName, "Local Mac");
  assert.equal(device.createdAt, "2026-04-02T06:20:00.000Z");
  assert.ok(device.deviceId);
  assert.ok(device.pairingToken);

  const persisted = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(persisted.deviceId, device.deviceId);
});

test("reuses an existing persisted device registration", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "device-registry-"));
  const filePath = path.join(tempDir, "device.json");

  await fs.writeFile(
    filePath,
    JSON.stringify({
      deviceId: "device_1",
      workspaceId: "local-mac",
      workspaceName: "Local Mac",
      pairingToken: "pair_123",
      createdAt: "2026-04-02T06:20:00.000Z",
      updatedAt: "2026-04-02T06:20:00.000Z"
    })
  );

  const registry = new DeviceRegistry({
    filePath,
    now: () => "2026-04-02T06:21:00.000Z"
  });

  const device = await registry.loadOrCreate({
    workspaceId: "ignored",
    workspaceName: "Ignored"
  });

  assert.equal(device.deviceId, "device_1");
  assert.equal(device.pairingToken, "pair_123");
});

test("rotates the pairing token and persists the change", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "device-registry-"));
  const filePath = path.join(tempDir, "device.json");

  const registry = new DeviceRegistry({
    filePath,
    now: () => "2026-04-02T06:20:00.000Z"
  });

  const original = await registry.loadOrCreate({
    workspaceId: "local-mac",
    workspaceName: "Local Mac"
  });

  const updated = await registry.rotatePairingToken();

  assert.notEqual(updated.pairingToken, original.pairingToken);

  const persisted = JSON.parse(await fs.readFile(filePath, "utf8"));
  assert.equal(persisted.pairingToken, updated.pairingToken);
});

test("creates a url-safe pairing token", () => {
  const token = createPairingToken();
  assert.match(token, /^[A-Za-z0-9_-]{24,}$/);
});

