import {useMemo} from 'react';
import type {ScoreEvent} from '../types/score';
import {selectScoreEvent, validateTimeline} from './scoreSynchronization';
export function useScoreSynchronization(events: readonly ScoreEvent[], time: number) {
  useMemo(() => validateTimeline(events), [events]);
  return selectScoreEvent(events, time);
}
