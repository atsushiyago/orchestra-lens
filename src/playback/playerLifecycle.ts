/** The subset of Vega's W3C player used while owning its native lifetime. */
export interface NativePlayerLifecycle {
  initialize(): Promise<void>;
  deinitialize(): Promise<void>;
}

/**
 * Serializes native decoder ownership. A generation changes immediately when
 * teardown is requested, so callbacks from the retired session are ignored
 * while the actual native destroy operation finishes in sequence.
 */
export class PlayerLifecycle {
  private chain: Promise<void> = Promise.resolve();
  private generation = 0;
  private initialized = false;

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.chain.then(operation, operation);
    this.chain = result.then(() => undefined, () => undefined);
    return result;
  }

  initialize(player: NativePlayerLifecycle): Promise<number> {
    const session = ++this.generation;
    return this.enqueue(async () => {
      if (!this.initialized) {
        await player.initialize();
        this.initialized = true;
      }
      return session;
    });
  }

  deinitialize(player: NativePlayerLifecycle): Promise<number> {
    const retiredSession = ++this.generation;
    return this.enqueue(async () => {
      if (this.initialized) {
        await player.deinitialize();
        this.initialized = false;
      }
      return retiredSession;
    });
  }

  isCurrent(session: number): boolean {
    return this.initialized && session === this.generation;
  }
}
