/**
 * Source ownership is deliberately separate from playback-position controls.
 * A seek may run only after the URI requested by the application has itself
 * reached readiness; a late event from a previous URI must not authorize it.
 */
export function sourceIsReady(requestedUri: string, readyUri: string | undefined, ready: boolean): boolean {
  return ready && readyUri === requestedUri;
}

export function maySeekActiveSource(input: {
  requestedUri: string;
  readyUri: string | undefined;
  ready: boolean;
  duration: number;
}): boolean {
  return sourceIsReady(input.requestedUri, input.readyUri, input.ready)
    && Number.isFinite(input.duration) && input.duration > 0;
}

/** Keeps stale source-ready callbacks from applying after a newer URI wins. */
export class SourceTransitionCoordinator {
  private generation = 0;
  begin(): number { this.generation += 1; return this.generation; }
  isCurrent(generation: number): boolean { return generation === this.generation; }
}
