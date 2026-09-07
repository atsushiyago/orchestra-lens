import assert from 'node:assert/strict';
import {test} from 'node:test';
import {developmentReviewMediaFor} from '../src/data/developmentReviewWorks';
import {mediaSource} from '../src/data/media';

test('DEV review resolves each work to its own approved media source', () => {
  assert.equal(developmentReviewMediaFor('brahms-op68-4'), mediaSource.uri);
  assert.equal(developmentReviewMediaFor('beethoven-op67-1'), 'https://d25q8u9cz8hosu.cloudfront.net/media/beethoven-op67-movement1-musopen-pd.m4a');
  assert.notEqual(developmentReviewMediaFor('brahms-op68-4'), developmentReviewMediaFor('beethoven-op67-1'));
});

test('Release continues to resolve only the existing Brahms media source', () => {
  assert.match(mediaSource.uri, /brahms-op68-movement4-musopen-cc0\.m4a$/);
});
