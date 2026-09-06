export type ScoreEvent = {
  startTime: number;
  endTime?: number;
  measure: number;
  beat?: number;
  title: string;
  description?: string;
  primaryInstruments?: readonly string[];
  eventType?: 'theme' | 'theme_return' | 'instrument_entry' | 'transition' | 'chorale' | 'other';
};
