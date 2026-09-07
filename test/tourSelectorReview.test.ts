import assert from 'node:assert/strict';
import {test} from 'node:test';
import brahmsSelection from '../src/data/generated/brahms-op68-movement4-tour-selection.json';
import beethovenSelection from '../src/data/generated/beethoven-op67-movement1-tour-selection.json';
import {selectorTourCandidatesFor, selectorTourCountFor} from '../src/data/developmentTourSelectorWorks';
import {developmentReviewMediaFor} from '../src/data/developmentReviewWorks';
import {highlightsTourCandidates, highlightsTourConfig} from '../src/hooks/useHighlightsTour';

test('DEV selector-review tours read only generated selector moments in performance order', () => {
  for (const [work, artifact] of [
    ['brahms-op68-4', brahmsSelection],
    ['beethoven-op67-1', beethovenSelection],
  ] as const) {
    const candidates = selectorTourCandidatesFor(work);
    assert.equal(selectorTourCountFor(work), artifact.selected.length);
    assert.deepEqual(
      candidates.map(candidate => [candidate.rank, candidate.detectorRank, candidate.measure, candidate.occurrence, candidate.timeSeconds, candidate.score, candidate.selectorReasons]),
      artifact.selected.map((moment, index) => [index + 1, moment.detectorRank, moment.measure, moment.occurrence, moment.timeSeconds, moment.detectorScore, moment.selectorReasons]),
    );
    assert.ok(candidates.every((candidate, index) => index === 0 || candidate.timeSeconds > candidates[index - 1]!.timeSeconds));
  }
});

test('selector review uses work descriptor media URIs while Release remains Brahms-only', () => {
  assert.match(developmentReviewMediaFor('brahms-op68-4'), /brahms/i);
  assert.match(developmentReviewMediaFor('beethoven-op67-1'), /beethoven/i);
  assert.deepEqual(highlightsTourCandidates.map(candidate => candidate.measure), brahmsSelection.selected.map(moment => moment.measure));
  assert.equal(highlightsTourCandidates.length, brahmsSelection.selected.length);
});
