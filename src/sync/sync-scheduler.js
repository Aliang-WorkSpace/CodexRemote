export class SyncScheduler {
  #engine;
  #inFlight;
  #intervalMs;
  #state;
  #timer;

  constructor({ engine, intervalMs }) {
    this.#engine = engine;
    this.#intervalMs = intervalMs;
    this.#inFlight = null;
    this.#timer = null;
    this.#state = {
      enabled: intervalMs > 0,
      intervalMs,
      isSyncing: false,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastSucceededAt: null,
      lastFailedAt: null,
      lastError: null,
      lastResult: null
    };
  }

  start() {
    if (!this.#state.enabled || this.#timer) {
      return;
    }

    this.#timer = setInterval(() => {
      this.runOnce().catch(() => {});
    }, this.#intervalMs);
    this.#timer.unref?.();

    this.runOnce().catch(() => {});
  }

  stop() {
    if (!this.#timer) {
      return;
    }

    clearInterval(this.#timer);
    this.#timer = null;
  }

  getStatus() {
    return {
      ...this.#state
    };
  }

  async runOnce() {
    if (this.#inFlight) {
      return this.#inFlight;
    }

    this.#state.isSyncing = true;
    this.#state.lastStartedAt = new Date().toISOString();

    this.#inFlight = this.#engine
      .syncOnce()
      .then(({ result }) => {
        const completedAt = new Date().toISOString();
        this.#state.isSyncing = false;
        this.#state.lastCompletedAt = completedAt;
        this.#state.lastSucceededAt = completedAt;
        this.#state.lastError = null;
        this.#state.lastResult = result;
        return result;
      })
      .catch((error) => {
        const completedAt = new Date().toISOString();
        this.#state.isSyncing = false;
        this.#state.lastCompletedAt = completedAt;
        this.#state.lastFailedAt = completedAt;
        this.#state.lastError = error instanceof Error ? error.message : "Unknown sync failure";
        throw error;
      })
      .finally(() => {
        this.#inFlight = null;
      });

    return this.#inFlight;
  }
}
