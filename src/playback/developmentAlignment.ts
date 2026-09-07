import generatedAlignment from '../data/generated/brahms-op68-movement4-performance-alignment.json';
import {alignedCueTime, brahmsMovement4PerformanceAlignment} from '../data/performanceAlignment';

type CueMeasure = keyof typeof brahmsMovement4PerformanceAlignment.cues;
type GeneratedMeasure = keyof typeof generatedAlignment.measures;

/**
 * Debug validation only. Release cues continue to read performanceAlignment.ts.
 * The automatic values are read from the generated artifact, never duplicated.
 */
export function developmentValidationCueTime(measure: CueMeasure): number {
  if (measure === 290 || measure === 407) {
    return generatedAlignment.measures[String(measure) as GeneratedMeasure].timeSeconds;
  }
  return alignedCueTime(measure);
}

export function isAutomaticValidationCue(measure: CueMeasure): boolean {
  return measure === 290 || measure === 407;
}
