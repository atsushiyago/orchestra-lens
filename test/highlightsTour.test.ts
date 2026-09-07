import assert from 'node:assert/strict';
import {test} from 'node:test';
import generatedHighlights from '../src/data/generated/brahms-op68-movement4-highlights.json';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {highlightReviewCandidates} from '../src/playback/highlightReview';
import {hasPlayedExcerpt, highlightsTourCandidates, highlightsTourConfig, mayBeginExcerpt, transitionSteps} from '../src/hooks/useHighlightsTour';
import {TourTransitionCoordinator} from '../src/playback/tourTransitionCoordinator';

test('Auto Highlights Tour uses the generated ranking order and timestamps without authored measures', () => {
  const expected = generatedHighlights.candidates.slice().sort((left, right) => left.rank - right.rank).slice(0, highlightsTourConfig.candidateCount);
  assert.deepEqual(highlightsTourCandidates.map(candidate => [candidate.rank, candidate.measure, candidate.timeSeconds]), expected.map(candidate => [candidate.rank, candidate.measure, candidate.timeSeconds]));
  assert.deepEqual(highlightsTourCandidates, highlightReviewCandidates.slice(0, highlightsTourConfig.candidateCount));
  assert.ok(highlightsTourCandidates.every(candidate => candidate.timeSeconds !== null));
});

test('Tour overlay explanations and scores are the generated detector values', () => {
  const candidate = highlightsTourCandidates[0]!;
  const generated = generatedHighlights.candidates.find(item => item.rank === candidate.rank)!;
  assert.deepEqual(candidate.reasons, generated.reasons);
  assert.equal(candidate.score, generated.score);
});

test('Tour transition seeks, explicitly stabilizes with a pause/play kick, then starts playback', () => {
  assert.deepEqual(transitionSteps, ['seeking', 'waiting-to-play', 'stabilizing', 'playing']);
  assert.ok(highlightsTourConfig.leadInSeconds > 0);
  assert.ok(highlightsTourConfig.excerptSeconds >= 15 && highlightsTourConfig.excerptSeconds <= 25);
});

test('only the current transition token can change the player after a manual replacement', () => {
  const coordinator = new TourTransitionCoordinator();
  const first = coordinator.begin();
  assert.equal(coordinator.isCurrent(first), true);
  const second = coordinator.begin();
  assert.equal(coordinator.isCurrent(first), false);
  assert.equal(coordinator.isCurrent(second), true);
  coordinator.cancel();
  assert.equal(coordinator.isCurrent(second), false);
});

test('diagnostic tour uses bounded stabilization, no fade settings, and actual media time for excerpts', () => {
  assert.ok(highlightsTourConfig.seekReadyTimeoutMilliseconds > 0);
  assert.ok(highlightsTourConfig.firstPlayStabilizationMilliseconds >= 400);
  assert.ok(highlightsTourConfig.kickPauseMilliseconds >= 100);
  assert.ok(!('fadeOutMilliseconds' in highlightsTourConfig));
  assert.equal(mayBeginExcerpt(false), false);
  assert.equal(mayBeginExcerpt(true), true);
  assert.equal(hasPlayedExcerpt(100, 119.9, 20), false);
  assert.equal(hasPlayedExcerpt(100, 120, 20), true);
});

test('Tour data does not modify detector results or Release cue behavior', () => {
  const scores = highlightsTourCandidates.map(candidate => candidate.score);
  assert.deepEqual(scores, generatedHighlights.candidates.slice().sort((left, right) => left.rank - right.rank).slice(0, highlightsTourConfig.candidateCount).map(candidate => candidate.score));
  assert.deepEqual(scoreEvents.map(event => event.measure), [30, 62, 290, 407]);
});
