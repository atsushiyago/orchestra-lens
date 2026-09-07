import generatedHighlights from '../data/generated/brahms-op68-movement4-highlights.json';
import generatedBeethovenHighlights from '../data/generated/beethoven-op67-movement1-highlights.json';
import {scoreEvents} from '../data/brahms1Movement4';

export type HighlightReviewCandidate = {
  rank: number;
  measure: number;
  occurrence?: number;
  timeSeconds: number | null;
  score: number;
  activeInstruments: string[];
  hauptstimme: Array<{part: string; instrument: string; label: string; startsHere: boolean}>;
  reasons: string[];
  features: {textureDensity: number};
};

type GeneratedHighlights = {detector: {config: {maxCandidates: number}}; candidates: HighlightReviewCandidate[]};
export type HighlightReviewWork = 'brahms-op68-4' | 'beethoven-op67-1';
export const highlightReviewWorkLabels: Record<HighlightReviewWork, string> = {
  'brahms-op68-4': 'BRAHMS 1 / IV', 'beethoven-op67-1': 'BEETHOVEN 5 / I',
};
const artifacts: Record<HighlightReviewWork, GeneratedHighlights> = {
  'brahms-op68-4': generatedHighlights as GeneratedHighlights,
  'beethoven-op67-1': generatedBeethovenHighlights as GeneratedHighlights,
};

/** Debug review reads rank and timestamps from the generated artifact, never from cue data. */
export const highlightReviewCandidatesFor = (work: HighlightReviewWork): HighlightReviewCandidate[] => {
  const highlights = artifacts[work];
  return highlights.candidates.slice().sort((left, right) => left.rank - right.rank).slice(0, highlights.detector.config.maxCandidates);
};
export const highlightReviewCandidates = highlightReviewCandidatesFor('brahms-op68-4');

export type HighlightReviewDecision = 'KEEP' | 'SKIP' | 'UNREVIEWED';
export type HighlightReviewDecisions = Readonly<Record<number, HighlightReviewDecision>>;

export function setHighlightReviewDecision(
  decisions: HighlightReviewDecisions,
  measure: number,
  decision: HighlightReviewDecision,
): HighlightReviewDecisions {
  return {...decisions, [measure]: decision};
}

/** Removing a decision restores the implicit UNREVIEWED state. */
export function clearHighlightReviewDecision(
  decisions: HighlightReviewDecisions,
  measure: number,
): HighlightReviewDecisions {
  const {[measure]: _removed, ...remaining} = decisions;
  return remaining;
}

export const highlightReviewDecision = (decisions: HighlightReviewDecisions, measure: number): HighlightReviewDecision =>
  decisions[measure] ?? 'UNREVIEWED';

export function highlightReviewTarget(work: HighlightReviewWork, rank: number, direction: 'next' | 'previous'): HighlightReviewCandidate | undefined;
export function highlightReviewTarget(rank: number, direction: 'next' | 'previous'): HighlightReviewCandidate | undefined;
export function highlightReviewTarget(workOrRank: HighlightReviewWork | number, rankOrDirection: number | 'next' | 'previous', maybeDirection?: 'next' | 'previous'): HighlightReviewCandidate | undefined {
  const work: HighlightReviewWork = typeof workOrRank === 'string' ? workOrRank : 'brahms-op68-4';
  const rank = typeof workOrRank === 'number' ? workOrRank : rankOrDirection as number;
  const direction = typeof workOrRank === 'number' ? rankOrDirection as 'next' | 'previous' : maybeDirection!;
  const candidates = highlightReviewCandidatesFor(work);
  const index = candidates.findIndex(candidate => candidate.rank === rank);
  return candidates[index + (direction === 'next' ? 1 : -1)];
}

/** Informational only; it has no input to detector scoring or ranking. */
export const nearbyCuratedCues = (measure: number, radius = 12): readonly number[] =>
  scoreEvents.filter(event => Math.abs(event.measure - measure) <= radius).map(event => event.measure);

export const isHighlightReviewAvailable = (debug: boolean): boolean => debug;
