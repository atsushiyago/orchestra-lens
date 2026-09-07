import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {maySeekActiveSource, SourceTransitionCoordinator, sourceIsReady} from '../src/playback/mediaSourceLifecycle';
import {workById} from '../src/data/workCatalog';

test('cue navigation waits for the currently requested source and a non-zero duration', () => {
  const brahms = workById('brahms-op68-4').media.uri;
  const beethoven = workById('beethoven-op67-1').media.uri;
  assert.equal(sourceIsReady(brahms, brahms, true), true);
  assert.equal(sourceIsReady(brahms, beethoven, true), false);
  assert.equal(maySeekActiveSource({requestedUri: brahms, readyUri: brahms, ready: true, duration: 1016}), true);
  assert.equal(maySeekActiveSource({requestedUri: brahms, readyUri: brahms, ready: true, duration: 0}), false);
  assert.equal(maySeekActiveSource({requestedUri: brahms, readyUri: beethoven, ready: true, duration: 1016}), false);
});

test('only the latest source transition can authorize a ready callback', () => {
  const coordinator = new SourceTransitionCoordinator();
  const brahmsLoad = coordinator.begin();
  const beethovenLoad = coordinator.begin();
  assert.equal(coordinator.isCurrent(brahmsLoad), false);
  assert.equal(coordinator.isCurrent(beethovenLoad), true);
});

test('cue-jump UI owns only position while selected-work lifecycle owns URI replacement', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /full-movement reclaiming selected work URI/);
  assert.match(app, /Debug cue jump m\.\$\{target\.measure\}[\s\S]{0,500}playback\.seek\(target\.timeSeconds\)[\s\S]{0,200}setDebugCue/);
  assert.doesNotMatch(app, /JUMP TO CUE[\s\S]{0,800}setActiveMediaUri/);
});

test('retry reloads the hook URI, which is the selected work URI after leaving DEV review', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/hooks/usePlayback.ts', import.meta.url), 'utf8');
  assert.match(app, /if \(activeMediaUri !== selectedWork\.media\.uri\)/);
  assert.match(hook, /retry requested uri=\$\{requestedUriRef\.current\}/);
  assert.match(hook, /player\.src = uri/);
});
