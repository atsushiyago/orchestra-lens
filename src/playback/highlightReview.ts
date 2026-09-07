import generatedHighlights from '../data/generated/brahms-op68-movement4-highlights.json';
import {scoreEvents} from '../data/brahms1Movement4';

export type HighlightReviewCandidate = {
  rank: number;
  measure: number;
  timeSeconds: number | null;
  score: number;
  activeInstruments: string[];
  hauptstimme: Array<{part: string; instrument: string; label: string; startsHere: boolean}>;
  reasons: string[];
  features: {textureDensity: number};
};

type GeneratedHighlights = {detector: {config: {maxCandidates: number}}; candidates: HighlightReviewCandidate[]};
const highlights = generatedHighlights as GeneratedHighlights;

/** Debug review reads rank and timestamps from the generated artifact, never from cue data. */
export const highlightReviewCandidates = highlights.candidates
  .slice()
  .sort((left, right) => left.rank - right.rank)
  .slice(0, highlights.detector.config.maxCandidates);

export type HighlightReviewDecision = 'KEEP' | 'SKIP' | 'UNREVIEWED';
export type HighlightReviewDecisions = Readonly<Record<number, HighlightReviewDecision>>;

export function setHighlightReviewDecision(
  decisions: HighlightReviewDecisions,
  measure: number,
  decision: HighlightReviewDecision,
): HighlightReviewDecisions {
  return {...decisions, [measure]: decision};
}

export const highlightReviewDecision = (decisions: HighlightReviewDecisions, measure: number): HighlightReviewDecision =>
  decisions[measure] ?? 'UNREVIEWED';

export function highlightReviewTarget(rank: number, direction: 'next' | 'previous'): HighlightReviewCandidate | undefined {
  const index = highlightReviewCandidates.findIndex(candidate => candidate.rank === rank);
  return highlightReviewCandidates[index + (direction === 'next' ? 1 : -1)];
}

/** Informational only; it has no input to detector scoring or ranking. */
export const nearbyCuratedCues = (measure: number, radius = 12): readonly number[] =>
  scoreEvents.filter(event => Math.abs(event.measure - measure) <= radius).map(event => event.measure);

export const isHighlightReviewAvailable = (debug: boolean): boolean => debug;
