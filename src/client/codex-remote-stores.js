import {
  decodePairingCode,
  createPairedClientFromBootstrapBundle,
  createPairedClientFromPairingCode
} from "./codex-remote-client.js";

export class PairingStore {
  #fetchImpl;
  #fetchContext;
  #pairingClientFactory;
  state;

  constructor({
    fetchImpl = globalThis.fetch,
    fetchContext = globalThis,
    pairingClientFactory = ({
      bundle,
      pairingCode,
      fetchImpl: clientFetchImpl,
      fetchContext: clientFetchContext
    }) =>
      bundle
        ? createPairedClientFromBootstrapBundle({
            bundle,
            fetchImpl: clientFetchImpl,
            fetchContext: clientFetchContext
          })
        : createPairedClientFromPairingCode({
            pairingCode,
            fetchImpl: clientFetchImpl,
            fetchContext: clientFetchContext
          })
  } = {}) {
    this.#fetchImpl = fetchImpl;
    this.#fetchContext = fetchContext;
    this.#pairingClientFactory = pairingClientFactory;
    this.state = {
      publicPairing: null,
      bundle: null,
      client: null,
      bootstrap: null,
      requestId: null,
      isLoading: false,
      error: null
    };
  }

  async discover(baseUrl) {
    this.state.isLoading = true;
    this.state.error = null;

    try {
      const client = this.#pairingClientFactory({
        bundle: {
          transport: {
            baseUrl
          },
          pairingToken: null
        },
        fetchImpl: this.#fetchImpl,
        fetchContext: this.#fetchContext
      }).withToken(null);
      const response = await client.getPairing();
      this.state.requestId = response.requestId;
      this.state.publicPairing = response.data;
      return response.data;
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectWithPairingCode(pairingCode) {
    this.state.isLoading = true;
    this.state.error = null;

    try {
      const bundle = decodePairingCode(pairingCode);
      return this.connectWithBundle(bundle, { pairingCode });
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectDirect(baseUrl) {
    this.state.isLoading = true;
    this.state.error = null;

    try {
      const client = this.#pairingClientFactory({
        bundle: {
          transport: {
            baseUrl
          },
          pairingToken: null
        },
        fetchImpl: this.#fetchImpl,
        fetchContext: this.#fetchContext
      }).withToken(null);
      const response = await client.getPairingBootstrap();
      this.state.requestId = response.requestId;
      return this.connectWithBundle(response.data.bundle);
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectWithBundle(bundle, { pairingCode = null } = {}) {
    this.state.isLoading = true;
    this.state.error = null;

    try {
      const client = this.#pairingClientFactory({
        bundle,
        pairingCode,
        fetchImpl: this.#fetchImpl,
        fetchContext: this.#fetchContext
      });
      const response = await client.getMobileBootstrap();
      this.state.requestId = response.requestId;
      this.state.bundle = bundle;
      this.state.client = client;
      this.state.bootstrap = response.data;
      return response.data;
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  hydrate({ publicPairing = null, bundle = null, bootstrap = null } = {}) {
    if (publicPairing) {
      this.state.publicPairing = publicPairing;
    }

    if (!bundle) {
      return this.state;
    }

    const client = this.#pairingClientFactory({
      bundle,
      fetchImpl: this.#fetchImpl,
      fetchContext: this.#fetchContext
    });

    this.state.bundle = bundle;
    this.state.client = client;
    this.state.bootstrap = bootstrap;
    return this.state;
  }
}

export class BootstrapStore {
  #client;
  state;

  constructor({ client }) {
    this.#client = client;
    this.state = {
      requestId: null,
      bootstrap: null,
      isLoading: false,
      error: null
    };
  }

  async load() {
    this.state.isLoading = true;
    this.state.error = null;

    try {
      const response = await this.#client.getMobileBootstrap();
      this.state.requestId = response.requestId;
      this.state.bootstrap = response.data;
      return response.data;
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  get dashboard() {
    return this.state.bootstrap?.dashboard ?? null;
  }

  get supportedCommands() {
    return this.state.bootstrap?.supportedCommands ?? [];
  }

  get syncStatus() {
    return this.state.bootstrap?.sync ?? null;
  }
}

export class SessionStore {
  #client;
  state;

  constructor({ client }) {
    this.#client = client;
    this.state = {
      requestId: null,
      sessionId: null,
      detail: null,
      isLoading: false,
      error: null
    };
  }

  async load(sessionId) {
    this.state.isLoading = true;
    this.state.error = null;
    this.state.sessionId = sessionId;

    try {
      const response = await this.#client.getSessionDetail(sessionId);
      this.state.requestId = response.requestId;
      this.state.detail = response.data;
      return response.data;
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async refresh() {
    if (!this.state.sessionId) {
      throw new Error("sessionId is not set");
    }

    return this.load(this.state.sessionId);
  }
}

export class CommandComposer {
  #client;
  state;

  constructor({ client }) {
    this.#client = client;
    this.state = {
      requestId: null,
      lastCommand: null,
      isSubmitting: false,
      error: null
    };
  }

  async sendPrompt({ sessionId, prompt, attachments = [] }) {
    return this.#submit({
      target: {
        type: "session",
        id: sessionId
      },
      payload: {
        kind: "sendPrompt",
        prompt,
        attachments
      }
    });
  }

  async resumeRun({ sessionId }) {
    return this.#submit({
      target: {
        type: "session",
        id: sessionId
      },
      payload: {
        kind: "resumeRun"
      }
    });
  }

  async retryRun({ sessionId }) {
    return this.#submit({
      target: {
        type: "session",
        id: sessionId
      },
      payload: {
        kind: "retryRun"
      }
    });
  }

  async stopRun({ sessionId, reason = null }) {
    return this.#submit({
      target: {
        type: "session",
        id: sessionId
      },
      payload: {
        kind: "stopRun",
        reason
      }
    });
  }

  async startAutomation({ workspaceId = "local-mac", automationId, input = null }) {
    return this.#submit({
      target: {
        type: "workspace",
        id: workspaceId
      },
      payload: {
        kind: "startAutomation",
        automationID: automationId,
        input
      }
    });
  }

  async startTemplate({ workspaceId = "local-mac", templateId, input = null }) {
    return this.#submit({
      target: {
        type: "workspace",
        id: workspaceId
      },
      payload: {
        kind: "startTemplate",
        templateID: templateId,
        input
      }
    });
  }

  async submit(body) {
    return this.#submit(body);
  }

  async #submit(body) {
    this.state.isSubmitting = true;
    this.state.error = null;

    try {
      const response = await this.#client.submitCommand(body);
      this.state.requestId = response.requestId;
      this.state.lastCommand = response.data.command ?? null;
      return response.data;
    } catch (error) {
      this.state.error = error;
      throw error;
    } finally {
      this.state.isSubmitting = false;
    }
  }
}
