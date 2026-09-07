import type {HighlightReviewCandidate} from '../playback/highlightReview';

export type GeneratedTourSelection = {selected: Array<{
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

const emptyFeatures: HighlightReviewCandidate['features'] = {textureDensity: 0};

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

/** Converts a generated selector artifact into the existing, proven tour input shape. */
export const releaseTourCandidatesFrom = (selection: GeneratedTourSelection): readonly ReleaseTourCandidate[] => selection.selected.map((item, index) => ({
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
