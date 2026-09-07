/** Keeps DEV review candidate changes isolated from the Highlights Tour coordinator. */
export class ReviewTransitionCoordinator {
  private token = 0;
  begin(): number { this.token += 1; return this.token; }
  isCurrent(token: number): boolean { return token === this.token; }
  cancel(): void { this.token += 1; }
}

export const reviewTransitionReady = (requestedUri: string, readyUri: string | undefined): boolean => requestedUri === readyUri;
