export interface MediaClock {
  currentTime: number; duration: number; paused: boolean;
  play(): Promise<void>; pause(): void;
}
export function seekTo(player: MediaClock, seconds: number): void {
  if (!Number.isFinite(seconds) || !Number.isFinite(player.duration) || player.duration <= 0) return;
  player.currentTime = Math.max(0, Math.min(player.duration, seconds));
}
/** Queues the latest user-requested seek until the W3C player reports readiness. */
export class PendingSeekQueue {
  private pending: number | undefined;
  request(seconds: number, ready: boolean, execute: (seconds: number) => void): 'queued' | 'executed' | 'ignored' {
    if (!Number.isFinite(seconds)) return 'ignored';
    if (!ready) { this.pending = seconds; return 'queued'; }
    execute(seconds); return 'executed';
  }
  flush(ready: boolean, execute: (seconds: number) => void): number | undefined {
    if (!ready || this.pending === undefined) return undefined;
    const seconds = this.pending;
    this.pending = undefined;
    execute(seconds);
    return seconds;
  }
  clear(): void { this.pending = undefined; }
}
export class PeekSession {
  // Score Peek is an informational overlay. It deliberately leaves the media
  // clock and play/pause state alone; transport remains the user's control.
  enter(_player: MediaClock) {}
  async leave(_player: MediaClock) {}
  cancelResume() {}
}
