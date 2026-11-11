import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Re-renders its host every second while a deadline is set. */
export class CountdownController implements ReactiveController {
  #host: ReactiveControllerHost;
  #timer?: ReturnType<typeof setInterval>;
  #deadline?: number;
  #onExpire?: () => void;
  #fired = false;

  constructor(host: ReactiveControllerHost, onExpire?: () => void) {
    this.#host = host;
    this.#onExpire = onExpire;
    host.addController(this);
  }

  /** Unix ms deadline (undefined to stop). */
  set deadline(ms: number | undefined) {
    if (ms === this.#deadline) return;
    this.#deadline = ms;
    this.#fired = false;
    this.#restart();
  }

  get deadline(): number | undefined {
    return this.#deadline;
  }

  /** Whole seconds remaining (≥ 0), or undefined without a deadline. */
  get remaining(): number | undefined {
    if (this.#deadline === undefined) return undefined;
    return Math.max(0, Math.ceil((this.#deadline - Date.now()) / 1000));
  }

  hostConnected(): void {
    this.#restart();
  }

  hostDisconnected(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #restart() {
    clearInterval(this.#timer);
    this.#timer = undefined;
    if (this.#deadline === undefined) return;
    this.#timer = setInterval(() => {
      this.#host.requestUpdate();
      if (this.remaining === 0 && !this.#fired) {
        this.#fired = true;
        clearInterval(this.#timer);
        this.#onExpire?.();
      }
    }, 1000);
  }
}
