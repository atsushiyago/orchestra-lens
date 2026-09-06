export interface MediaClock {
  currentTime: number; duration: number; paused: boolean;
  play(): Promise<void>; pause(): void;
}
export function seekTo(player: MediaClock, seconds: number): void {
  if (!Number.isFinite(seconds) || !Number.isFinite(player.duration) || player.duration <= 0) return;
  player.currentTime = Math.max(0, Math.min(player.duration, seconds));
}
export class PeekSession {
  private resume = false;
  private open = false;
  enter(player: MediaClock) {
    if (this.open) return;
    this.open = true;
    this.resume = !player.paused;
    player.pause();
  }
  async leave(player: MediaClock) {
    if (!this.open) return;
    this.open = false;
    const resume = this.resume;
    this.resume = false;
    if (resume) await player.play();
  }
  cancelResume() { this.resume = false; }
}
