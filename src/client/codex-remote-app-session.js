import {
  BootstrapStore,
  CommandComposer,
  PairingStore,
  SessionStore
} from "./codex-remote-stores.js";

export class AppSessionController {
  #pairingStore;
  #bootstrapStore;
  #sessionStore;
  #commandComposer;

  constructor({
    pairingStore = new PairingStore(),
    bootstrapStore = null,
    sessionStore = null,
    commandComposer = null
  } = {}) {
    this.#pairingStore = pairingStore;
    this.#bootstrapStore = bootstrapStore;
    this.#sessionStore = sessionStore;
    this.#commandComposer = commandComposer;
  }

  get state() {
    return {
      pairing: this.#pairingStore?.state ?? null,
      bootstrap: this.#bootstrapStore?.state ?? null,
      session: this.#sessionStore?.state ?? null,
      composer: this.#commandComposer?.state ?? null
    };
  }

  get client() {
    return this.#pairingStore?.state.client ?? null;
  }

  get dashboard() {
    return this.#bootstrapStore?.dashboard ?? null;
  }

  get selectedSession() {
    return this.#sessionStore?.state.detail ?? null;
  }

  async discover(baseUrl) {
    return this.#pairingStore.discover(baseUrl);
  }

  async connectWithPairingCode(pairingCode) {
    const bootstrap = await this.#pairingStore.connectWithPairingCode(pairingCode);
    this.#initializeClientStores();
    this.#bootstrapStore.state.bootstrap = bootstrap;
    this.#bootstrapStore.state.requestId = this.#pairingStore.state.requestId;
    return bootstrap;
  }

  async connectDirect(baseUrl) {
    const bootstrap = await this.#pairingStore.connectDirect(baseUrl);
    this.#initializeClientStores();
    this.#bootstrapStore.state.bootstrap = bootstrap;
    this.#bootstrapStore.state.requestId = this.#pairingStore.state.requestId;
    return bootstrap;
  }

  async restoreFromBundle(bundle) {
    const bootstrap = await this.#pairingStore.connectWithBundle(bundle);
    this.#initializeClientStores();
    this.#bootstrapStore.state.bootstrap = bootstrap;
    this.#bootstrapStore.state.requestId = this.#pairingStore.state.requestId;
    return bootstrap;
  }

  hydrate({ publicPairing = null, bundle = null, bootstrap = null } = {}) {
    this.#pairingStore.hydrate({
      publicPairing,
      bundle,
      bootstrap
    });

    if (bundle) {
      this.#initializeClientStores();
      this.#bootstrapStore.state.bootstrap = bootstrap;
    }

    return this.state;
  }

  async refreshBootstrap() {
    this.#ensureConnected();
    return this.#bootstrapStore.load();
  }

  async openSession(sessionId) {
    this.#ensureConnected();
    return this.#sessionStore.load(sessionId);
  }

  async refreshSession() {
    this.#ensureConnected();
    return this.#sessionStore.refresh();
  }

  async sendPrompt({ sessionId, prompt, attachments = [] }) {
    this.#ensureConnected();
    const result = await this.#commandComposer.sendPrompt({
      sessionId,
      prompt,
      attachments
    });

    if (this.#sessionStore?.state.sessionId === sessionId) {
      await this.#sessionStore.refresh();
    }

    return result;
  }

  async resumeRun({ sessionId }) {
    return this.#submitSessionCommand({
      sessionId,
      submit: () => this.#commandComposer.resumeRun({ sessionId })
    });
  }

  async retryRun({ sessionId }) {
    return this.#submitSessionCommand({
      sessionId,
      submit: () => this.#commandComposer.retryRun({ sessionId })
    });
  }

  async stopRun({ sessionId, reason = null }) {
    return this.#submitSessionCommand({
      sessionId,
      submit: () => this.#commandComposer.stopRun({ sessionId, reason })
    });
  }

  async startAutomation({ automationId, input = null }) {
    this.#ensureConnected();
    const result = await this.#commandComposer.startAutomation({
      workspaceId: this.dashboard?.workspace?.id ?? "local-mac",
      automationId,
      input
    });
    await this.#bootstrapStore.load();
    return result;
  }

  async startTemplate({ templateId, input = null }) {
    this.#ensureConnected();
    const result = await this.#commandComposer.startTemplate({
      workspaceId: this.dashboard?.workspace?.id ?? "local-mac",
      templateId,
      input
    });
    await this.#bootstrapStore.load();
    return result;
  }

  #initializeClientStores() {
    const client = this.#pairingStore.state.client;
    this.#bootstrapStore = new BootstrapStore({ client });
    this.#sessionStore = new SessionStore({ client });
    this.#commandComposer = new CommandComposer({ client });
  }

  async #submitSessionCommand({ sessionId, submit }) {
    this.#ensureConnected();
    const result = await submit();

    if (this.#sessionStore?.state.sessionId === sessionId) {
      await this.#sessionStore.refresh();
    }

    await this.#bootstrapStore.load();
    return result;
  }

  #ensureConnected() {
    if (!this.client) {
      throw new Error("Client is not connected");
    }
  }
}
