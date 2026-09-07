import {getRuntimeCue, type OrchestraLensRuntimeCue} from '../data/runtimeCue';
import type {WorkCapabilities} from '../data/workCatalog';
import type {ScoreEvent} from '../types/score';

export type ContextualOverlay = {
  event: ScoreEvent;
  cue: OrchestraLensRuntimeCue;
  hasThemeLens: boolean;
  canAskTheScore: boolean;
};

/**
 * Maps the actual synchronized playback event to existing prepared score
 * content. No timestamp is authored here; score-event alignment remains the
 * only timing source.
 */
export const contextualOverlayFor = (
  capabilities: Pick<WorkCapabilities, 'smartScore' | 'askTheScore'>,
  event?: ScoreEvent,
): ContextualOverlay | undefined => {
  if (!capabilities.smartScore || !event) return undefined;
  const cue = getRuntimeCue(event.measure);
  if (!cue || (!cue.smartScoreParts.length && !cue.themeLens)) return undefined;
  return {event, cue, hasThemeLens: Boolean(cue.themeLens), canAskTheScore: capabilities.askTheScore && cue.measure === 62};
};
