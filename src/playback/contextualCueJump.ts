import type {WorkCapabilities} from '../data/workCatalog';
import type {ScoreEvent} from '../types/score';
import {contextualOverlayFor} from './contextualOverlay';

export type ContextualCueJumpTarget = {measure: number; timeSeconds: number; label: string};

/**
 * Debug navigation derives its targets from the aligned score-event timeline.
 * It exposes prepared Ask/Theme-Lens regions without duplicating timestamps.
 */
export const contextualCueJumpTargets = (
  events: readonly ScoreEvent[],
  capabilities: Pick<WorkCapabilities, 'smartScore' | 'askTheScore'>,
): readonly ContextualCueJumpTarget[] => events.flatMap(event => {
  const overlay = contextualOverlayFor(capabilities, event);
  if (!overlay || (!overlay.canAskTheScore && !overlay.hasThemeLens)) return [];
  return [{measure: event.measure, timeSeconds: event.startTime, label: overlay.canAskTheScore ? 'ASK THE SCORE' : 'THEME LENS'}];
});
