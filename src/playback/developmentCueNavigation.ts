import {brahmsMovement4PerformanceAlignment} from '../data/performanceAlignment';
import {developmentValidationCueTime, isAutomaticValidationCue} from './developmentAlignment';

type AlignedCueMeasure = keyof typeof brahmsMovement4PerformanceAlignment.cues;

// m.47 remains a Theme Lens comparison reference, not a user-facing jump cue.
export const developmentCueMeasures = [30, 62, 290, 407] as const satisfies readonly AlignedCueMeasure[];

export type DevelopmentCueTarget = {measure: AlignedCueMeasure; timeSeconds: number; automatic: boolean};

export function developmentCueTarget(currentTime: number, direction: 'next' | 'previous'): DevelopmentCueTarget | undefined {
  const targets = developmentCueMeasures.map(measure => ({measure, timeSeconds: developmentValidationCueTime(measure), automatic: isAutomaticValidationCue(measure)}));
  const epsilon = .001;
  const target = direction === 'next'
    ? targets.find(candidate => candidate.timeSeconds > currentTime + epsilon)
    : [...targets].reverse().find(candidate => candidate.timeSeconds < currentTime - epsilon);
  return target;
}

export const debugCueClock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
