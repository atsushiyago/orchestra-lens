import selection from './generated/brahms-op68-movement4-tour-selection.json';
import {releaseTourCandidatesFrom, type ReleaseTourCandidate} from './tourCandidates';

/**
 * The production Brahms tour reads this generated artifact in performance
 * order. `rank` is the listener-facing tour position; detector rank remains
 * available for traceability but is never presented as product UI.
 */
export type {ReleaseTourCandidate};
export const releaseHighlightsTourCandidates = releaseTourCandidatesFrom(selection);
