import brahmsSelection from './generated/brahms-op68-movement4-tour-selection.json';
import beethovenSelection from './generated/beethoven-op67-movement1-tour-selection.json';
import type {HighlightReviewCandidate, HighlightReviewWork} from '../playback/highlightReview';

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

export type SelectorReviewCandidate = Omit<HighlightReviewCandidate, 'occurrence' | 'timeSeconds'> & {
  occurrence: number;
  timeSeconds: number;
  detectorRank: number;
  selectorScore: number;
  selectorReasons: string[];
};

const artifacts: Record<HighlightReviewWork, GeneratedSelection> = {
  'brahms-op68-4': brahmsSelection,
  'beethoven-op67-1': beethovenSelection,
};

const emptyFeatures: HighlightReviewCandidate['features'] = {textureDensity: 0};

const normalize = (selection: GeneratedSelection): SelectorReviewCandidate[] => selection.selected.map((item, index) => ({
  // `rank` is the selected-tour position. The original detector rank remains
  // explicit and is displayed as evidence rather than reordered away.
  rank: index + 1,
  detectorRank: item.detectorRank,
  measure: item.measure,
  occurrence: item.occurrence,
  timeSeconds: item.timeSeconds,
  score: item.detectorScore,
  selectorScore: item.selectorScore,
  selectorReasons: [...item.selectorReasons],
  reasons: [...item.detectorReasons],
  activeInstruments: [...item.activeInstruments],
  hauptstimme: item.hauptstimme.map(span => ({...span})),
  features: {...emptyFeatures},
}));

const tours: Record<HighlightReviewWork, SelectorReviewCandidate[]> = {
  'brahms-op68-4': normalize(artifacts['brahms-op68-4']),
  'beethoven-op67-1': normalize(artifacts['beethoven-op67-1']),
};

/** DEV-only normalization of the generated selector artifacts for the existing tour coordinator. */
export const selectorTourCandidatesFor = (work: HighlightReviewWork): readonly SelectorReviewCandidate[] => tours[work];
export const selectorTourCountFor = (work: HighlightReviewWork): number => tours[work].length;
