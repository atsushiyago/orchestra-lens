import {scoreEvents} from '../data/brahms1Movement4';
import type {ScoreEvent} from '../types/score';
import {developmentValidationCueTime} from './developmentAlignment';

/** Debug-only resolver input. Release continues to use scoreEvents unchanged. */
export const developmentValidationScoreEvents: readonly ScoreEvent[] = scoreEvents.map(event => {
  const measure = event.measure as 30 | 62 | 290 | 407;
  const startTime = developmentValidationCueTime(measure);
  const duration = event.endTime === undefined ? undefined : event.endTime - event.startTime;
  return {...event, startTime, ...(duration === undefined ? {} : {endTime: startTime + duration})};
});
