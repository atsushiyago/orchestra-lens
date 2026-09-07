import assert from 'node:assert/strict';
import {test} from 'node:test';
import generatedHighlights from '../src/data/generated/brahms-op68-movement4-highlights.json';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {highlightReviewCandidates, highlightReviewDecision, highlightReviewTarget, isHighlightReviewAvailable, nearbyCuratedCues, setHighlightReviewDecision} from '../src/playback/highlightReview';

test('Highlight Review order, measure selection, timestamps, and reasons come from generated ranks', () => {
  const expected = generatedHighlights.candidates.slice().sort((left, right) => left.rank - right.rank).slice(0, generatedHighlights.detector.config.maxCandidates);
  assert.deepEqual(highlightReviewCandidates.map(candidate => [candidate.rank, candidate.measure, candidate.timeSeconds]), expected.map(candidate => [candidate.rank, candidate.measure, candidate.timeSeconds]));
  assert.ok(highlightReviewCandidates.every(candidate => candidate.timeSeconds !== null));
  assert.ok(highlightReviewCandidates.every(candidate => candidate.reasons.length > 0));
  const first = highlightReviewCandidates[0]!;
  const second = highlightReviewCandidates[1]!;
  assert.deepEqual(highlightReviewTarget(first.rank, 'next'), second);
  assert.equal(highlightReviewTarget(first.rank, 'previous'), undefined);
});

test('KEEP and SKIP are in-memory review decisions and cannot change generated detector scores', () => {
  const candidate = highlightReviewCandidates[0]!;
  const originalScore = candidate.score;
  let decisions = setHighlightReviewDecision({}, candidate.measure, 'KEEP');
  assert.equal(highlightReviewDecision(decisions, candidate.measure), 'KEEP');
  decisions = setHighlightReviewDecision(decisions, candidate.measure, 'SKIP');
  assert.equal(highlightReviewDecision(decisions, candidate.measure), 'SKIP');
  assert.equal(candidate.score, originalScore);
});

test('curated-cue proximity is informational and derived from existing cue data', () => {
  const nearby = nearbyCuratedCues(404);
  assert.deepEqual(nearby, scoreEvents.filter(event => Math.abs(event.measure - 404) <= 12).map(event => event.measure));
  assert.ok(nearby.includes(407));
  assert.ok(nearbyCuratedCues(292).includes(290));
});

test('Highlight Review is unavailable outside Debug and does not alter Release score events', () => {
  const releaseEvents = structuredClone(scoreEvents);
  assert.equal(isHighlightReviewAvailable(false), false);
  assert.equal(isHighlightReviewAvailable(true), true);
  assert.deepEqual(scoreEvents, releaseEvents);
});
