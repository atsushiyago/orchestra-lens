import {mediaSource} from './media';
import type {HighlightReviewWork} from '../playback/highlightReview';

/** DEV-only review media. Release continues to use `mediaSource` directly. */
export const developmentReviewWorks: Record<HighlightReviewWork, {mediaUri: string}> = {
  'brahms-op68-4': {mediaUri: mediaSource.uri},
  'beethoven-op67-1': {mediaUri: 'https://d25q8u9cz8hosu.cloudfront.net/media/beethoven-op67-movement1-musopen-pd.m4a'},
};

export const developmentReviewMediaFor = (work: HighlightReviewWork): string => developmentReviewWorks[work].mediaUri;
