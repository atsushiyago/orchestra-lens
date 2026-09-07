import {workById} from './workCatalog';
import type {HighlightReviewWork} from '../playback/highlightReview';

/** DEV-only review media. Release continues to use `mediaSource` directly. */
export const developmentReviewWorks: Record<HighlightReviewWork, {mediaUri: string}> = {
  'brahms-op68-4': {mediaUri: workById('brahms-op68-4').media.uri},
  'beethoven-op67-1': {mediaUri: workById('beethoven-op67-1').media.uri},
};

export const developmentReviewMediaFor = (work: HighlightReviewWork): string => developmentReviewWorks[work].mediaUri;
