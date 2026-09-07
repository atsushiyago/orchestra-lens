import selection from './generated/brahms-op68-movement4-tour-selection.json';
import type {HighlightReviewCandidate} from '../playback/highlightReview';

type GeneratedSelection = {selected: Array<{
  detectorRank: number;
  measure: number;
  occurrence: number;
  timeSeconds: number;
  detectorScore: number;
  selectorScore: number;
  selectorReasons: string[];
  detectorReasons: string[];
  activeInstruments: string[];
  hauptstimme: HighlightReviewCandidate['hauptstimme'];
}>};

export type ReleaseTourCandidate = Omit<HighlightReviewCandidate, 'occurrence' | 'timeSeconds'> & {
  occurrence: number;
  timeSeconds: number;
  detectorRank: number;
  selectorScore: number;
  selectorReasons: string[];
};

const listenerReasons = (reasons: readonly string[]): string[] => {
  const concise = reasons.flatMap(reason => {
    if (reason.startsWith('High detector score')) return [];
    if (reason.startsWith('Extends performance coverage')) return ['Adds contrast across the movement'];
    if (reason.startsWith('Adds a distinct score profile')) return ['Offers a distinct orchestral texture'];
    if (reason.startsWith('Hauptstimme profile')) return ['Features a distinct prominent-instrument profile'];
    return [reason];
  });
  return concise.length ? concise : ['Selected from the generated listening tour'];
};

const emptyFeatures: HighlightReviewCandidate['features'] = {textureDensity: 0};

/**
 * The production Brahms tour reads this generated artifact in performance
 * order. `rank` is the listener-facing tour position; detector rank remains
 * available for traceability but is never presented as product UI.
 */
export const releaseHighlightsTourCandidates: readonly ReleaseTourCandidate[] = (selection as GeneratedSelection).selected.map((item, index) => ({
  rank: index + 1,
  detectorRank: item.detectorRank,
  measure: item.measure,
  occurrence: item.occurrence,
  timeSeconds: item.timeSeconds,
  score: item.detectorScore,
  selectorScore: item.selectorScore,
  selectorReasons: [...item.selectorReasons],
  reasons: listenerReasons(item.selectorReasons),
  activeInstruments: [...item.activeInstruments],
  hauptstimme: item.hauptstimme.map(span => ({...span})),
  features: {...emptyFeatures},
}));
