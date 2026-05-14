export class CodexRemoteApiError extends Error {
  constructor({ status, requestId, code, message }) {
    super(message);
    this.name = "CodexRemoteApiError";
    this.status = status;
    this.requestId = requestId ?? null;
    this.code = code ?? "unknown_error";
  }
}

export function decodePairingCode(pairingCode) {
  if (typeof Buffer !== "undefined") {
    return JSON.parse(Buffer.from(pairingCode, "base64url").toString("utf8"));
  }

  const normalized = pairingCode.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  return JSON.parse(decoded);
}

export function createPairedClientFromBootstrapBundle({
  bundle,
  fetchImpl = globalThis.fetch,
  fetchContext = globalThis
}) {
  return new CodexRemoteClient({
    baseUrl: bundle.transport.baseUrl,
    token: bundle.pairingToken,
    fetchImpl,
    fetchContext
  });
}

export function createPairedClientFromPairingCode({
  pairingCode,
  fetchImpl = globalThis.fetch,
  fetchContext = globalThis
}) {
  return createPairedClientFromBootstrapBundle({
    bundle: decodePairingCode(pairingCode),
    fetchImpl,
    fetchContext
  });
}

export class CodexRemoteClient {
  #baseUrl;
  #fetchImpl;
  #fetchContext;
  #token;

  constructor({
    baseUrl,
    token = null,
    fetchImpl = globalThis.fetch,
    fetchContext = globalThis
  }) {
    if (!baseUrl) {
      throw new Error("baseUrl is required");
    }

    if (typeof fetchImpl !== "function") {
      throw new Error("fetchImpl must be a function");
    }

    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#token = token;
    this.#fetchImpl = fetchImpl;
    this.#fetchContext = fetchContext;
  }

  withToken(token) {
    return new CodexRemoteClient({
      baseUrl: this.#baseUrl,
      token,
      fetchImpl: this.#fetchImpl,
      fetchContext: this.#fetchContext
    });
  }

  async getPairing() {
    return this.#request("/pairing", { requiresAuth: false });
  }

  async getPairingToken() {
    return this.#request("/pairing/token");
  }

  async getPairingBootstrap() {
    return this.#request("/pairing/bootstrap");
  }

  async getMobileBootstrap() {
    return this.#request("/mobile/bootstrap");
  }

  async getMobileDashboard() {
    return this.#request("/mobile/dashboard");
  }

  async getSessionDetail(sessionId) {
    return this.#request(`/mobile/sessions/${encodeURIComponent(sessionId)}`);
  }

  async getHealth() {
    return this.#request("/health");
  }

  async getSnapshot() {
    return this.#request("/snapshot");
  }

  async getEvents({ runId, limit } = {}) {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set("runId", runId);
    }
    if (limit != null) {
      searchParams.set("limit", String(limit));
    }

    const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
    return this.#request(`/events${suffix}`);
  }

  async listCommands() {
    return this.#request("/commands");
  }

  async submitCommand(body) {
    return this.#request("/commands", {
      method: "POST",
      body
    });
  }

  async rotatePairingToken() {
    return this.#request("/pairing/rotate", {
      method: "POST"
    });
  }

  async getSyncStatus() {
    return this.#request("/sync/status");
  }

  async triggerSync() {
    return this.#request("/sync/run", {
      method: "POST"
    });
  }

  get baseUrl() {
    return this.#baseUrl;
  }

  get token() {
    return this.#token;
  }

  async #request(pathname, { method = "GET", body, requiresAuth = true } = {}) {
    const headers = {
      Accept: "application/json"
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (requiresAuth && this.#token) {
      headers.Authorization = `Bearer ${this.#token}`;
    }

    const response = await Reflect.apply(this.#fetchImpl, this.#fetchContext, [`${this.#baseUrl}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }]);

    const requestId = response.headers.get("x-request-id");
    const payload = await response.json();

    if (!response.ok) {
      throw new CodexRemoteApiError({
        status: response.status,
        requestId: payload.requestId ?? requestId,
        code: payload.error?.code,
        message: payload.error?.message ?? `Request failed with status ${response.status}`
      });
    }

    return {
      requestId,
      data: payload
    };
  }
}

export {
  CodexRemoteApiError as ControlPlaneApiError,
  CodexRemoteClient as ControlPlaneClient
};
