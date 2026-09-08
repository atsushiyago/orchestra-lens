import assert from 'node:assert/strict';
import {test} from 'node:test';
import generatedSelection from '../src/data/generated/brahms-op68-movement4-tour-selection.json';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {hasPlayedExcerpt, highlightsTourCandidates, highlightsTourConfig, mayBeginExcerpt, transitionSteps} from '../src/hooks/useHighlightsTour';
import {TourTransitionCoordinator} from '../src/playback/tourTransitionCoordinator';
import {formatHighlightsTourWork} from '../src/data/highlightsTourMetadata';
import {workById} from '../src/data/workCatalog';

test('Release Highlights Tour reads generated selector moments in performance order without authored measures', () => {
  assert.deepEqual(
    highlightsTourCandidates.map(candidate => [candidate.rank, candidate.detectorRank, candidate.measure, candidate.occurrence, candidate.timeSeconds, candidate.score, candidate.selectorScore, candidate.selectorReasons]),
    generatedSelection.selected.map((moment, index) => [index + 1, moment.detectorRank, moment.measure, moment.occurrence, moment.timeSeconds, moment.detectorScore, moment.selectorScore, moment.selectorReasons]),
  );
  assert.ok(highlightsTourCandidates.every((candidate, index) => index === 0 || candidate.timeSeconds > highlightsTourCandidates[index - 1]!.timeSeconds));
});

test('Tour overlay uses concise selector-derived reasons while retaining generated scores for traceability', () => {
  const candidate = highlightsTourCandidates[0]!;
  const generated = generatedSelection.selected[0]!;
  assert.deepEqual(candidate.selectorReasons, generated.selectorReasons);
  assert.equal(candidate.score, generated.detectorScore);
  assert.equal(candidate.selectorScore, generated.selectorScore);
  assert.ok(candidate.reasons.every(reason => !reason.startsWith('High detector score')));
});

test('Tour work label derives from the selected catalog work without stale Brahms text', () => {
  const brahms = workById('brahms-op68-4');
  const beethoven = workById('beethoven-op67-1');
  assert.equal(formatHighlightsTourWork(brahms), 'BRAHMS · SYMPHONY NO. 1 IN C MINOR, OP. 68 · IV');
  assert.equal(formatHighlightsTourWork(beethoven), 'BEETHOVEN · SYMPHONY NO. 5 IN C MINOR, OP. 67 · I');
  assert.notEqual(formatHighlightsTourWork(brahms), formatHighlightsTourWork(beethoven));
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

test('tour uses bounded stabilization, no fade settings, and actual media time for excerpts', () => {
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
  assert.equal(highlightsTourCandidates.length, generatedSelection.selected.length);
  assert.deepEqual(scoreEvents.map(event => event.measure), [30, 62, 290, 407]);
});
