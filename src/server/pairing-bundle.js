export function buildPairingBundle({
  device,
  publicBaseUrl,
  accessUrls = null,
  generatedAt = new Date().toISOString()
}) {
  return {
    version: 1,
    generatedAt,
    deviceId: device.deviceId,
    workspaceId: device.workspaceId,
    workspaceName: device.workspaceName,
    pairingToken: device.pairingToken,
    transport: {
      type: "http",
      baseUrl: publicBaseUrl,
      localBaseUrl: accessUrls?.localBaseUrl ?? publicBaseUrl,
      phoneAccessUrl: accessUrls?.phoneAccessUrl ?? null,
      isLocalOnly: accessUrls?.isLocalOnly ?? false,
      hint: accessUrls?.hint ?? null
    },
    capabilities: {
      commandSubmission: true,
      sessionInspection: true,
      eventStreaming: false,
      backgroundSync: true
    }
  };
}

export function encodePairingBundle(bundle) {
  return Buffer.from(JSON.stringify(bundle)).toString("base64url");
}
