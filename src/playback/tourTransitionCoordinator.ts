/** Monotonic tokens make every asynchronous tour callback safely cancellable. */
export class TourTransitionCoordinator {
  private current = 0;
  begin(): number { this.current += 1; return this.current; }
  cancel(): void { this.current += 1; }
  isCurrent(id: number): boolean { return id === this.current; }
}
