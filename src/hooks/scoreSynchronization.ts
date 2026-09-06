import type {ScoreEvent} from '../types/score';

export function validateTimeline(events: readonly ScoreEvent[]): void {
  events.forEach((event, i) => {
    if (!Number.isFinite(event.startTime) || event.startTime < 0 ||
        !Number.isInteger(event.measure) || event.measure < 1 || !event.title.trim()) {
      throw new Error(`Invalid score event at index ${i}`);
    }
    if (i > 0 && events[i - 1].startTime >= event.startTime) {
      throw new Error('Score events must have unique, ascending start times');
    }
    if (event.endTime !== undefined && (!Number.isFinite(event.endTime) || event.endTime <= event.startTime)) {
      throw new Error(`Invalid end time at index ${i}`);
    }
    if (event.endTime !== undefined && events[i + 1] && event.endTime > events[i + 1].startTime) {
      throw new Error('Score events must not overlap');
    }
  });
}

// Half-open intervals: [start, end). An omitted end lasts until the next event.
// No event is invented before the first cue or inside an explicitly marked gap.
export function selectScoreEvent(events: readonly ScoreEvent[], time: number): ScoreEvent | undefined {
  if (!Number.isFinite(time) || time < 0) return undefined;
  let low = 0, high = events.length - 1, found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (events[mid].startTime <= time) { found = mid; low = mid + 1; }
    else high = mid - 1;
  }
  const event = events[found];
  return event && (event.endTime === undefined || time < event.endTime) ? event : undefined;
}
