import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ReviewTransitionCoordinator, reviewTransitionReady} from '../src/playback/reviewTransitionCoordinator';

test('each review candidate transition supersedes stale seek callbacks', () => {
  const coordinator = new ReviewTransitionCoordinator();
  const first = coordinator.begin();
  const second = coordinator.begin();
  assert.equal(coordinator.isCurrent(first), false);
  assert.equal(coordinator.isCurrent(second), true);
});

test('review waits only for the exact selected work URI and then can seek same-source candidates', () => {
  const brahms = 'https://example.test/brahms.m4a';
  const beethoven = 'https://example.test/beethoven.m4a';
  assert.equal(reviewTransitionReady(brahms, brahms), true);
  assert.equal(reviewTransitionReady(beethoven, brahms), false);
  assert.equal(reviewTransitionReady(beethoven, beethoven), true);
});

test('an already-ready URI lets a first Review entry begin without waiting for another canplay', () => {
  const alreadyReadyBrahms = 'https://example.test/brahms.m4a';
  assert.equal(reviewTransitionReady(alreadyReadyBrahms, alreadyReadyBrahms), true);
});
