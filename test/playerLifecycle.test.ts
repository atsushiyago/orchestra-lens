import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {PlayerLifecycle, type NativePlayerLifecycle} from '../src/playback/playerLifecycle';

function deferred(): {promise: Promise<void>; resolve: () => void} {
  let resolve!: () => void;
  return {promise: new Promise<void>(done => { resolve = done; }), resolve};
}

test('retry-style teardown completes before a new native initialize starts', async () => {
  const calls: string[] = [];
  const destroy = deferred();
  const player: NativePlayerLifecycle = {
    initialize: async () => { calls.push('initialize'); },
    deinitialize: async () => { calls.push('deinitialize'); await destroy.promise; },
  };
  const lifecycle = new PlayerLifecycle();
  await lifecycle.initialize(player);
  const release = lifecycle.deinitialize(player);
  const restore = lifecycle.initialize(player);
  await Promise.resolve();
  assert.deepEqual(calls, ['initialize', 'deinitialize']);
  destroy.resolve();
  await Promise.all([release, restore]);
  assert.deepEqual(calls, ['initialize', 'deinitialize', 'initialize']);
});

test('repeated lifecycle requests serialize native calls and retire stale sessions immediately', async () => {
  const calls: string[] = [];
  const player: NativePlayerLifecycle = {
    initialize: async () => { calls.push('initialize'); },
    deinitialize: async () => { calls.push('deinitialize'); },
  };
  const lifecycle = new PlayerLifecycle();
  const first = await lifecycle.initialize(player);
  assert.equal(lifecycle.isCurrent(first), true);
  const release = lifecycle.deinitialize(player);
  assert.equal(lifecycle.isCurrent(first), false);
  const foreground = lifecycle.initialize(player);
  const duplicateForeground = lifecycle.initialize(player);
  const [, restored, current] = await Promise.all([release, foreground, duplicateForeground]);
  assert.deepEqual(calls, ['initialize', 'deinitialize', 'initialize']);
  assert.equal(lifecycle.isCurrent(restored), false);
  assert.equal(lifecycle.isCurrent(current), true);
});

test('hook snapshots background source, position, and play intent, then reloads without retry reinitialization', () => {
  const hook = readFileSync(new URL('../src/hooks/usePlayback.ts', import.meta.url), 'utf8');
  assert.match(hook, /const snapshot = \{uri: requestedUriRef\.current, time: Number\.isFinite\(player\.currentTime\) \? player\.currentTime : 0, shouldPlay: !player\.paused\}/);
  assert.match(hook, /lifecycle\.current\.deinitialize\(player\)/);
  assert.match(hook, /void initializeSession\('foreground'\)/);
  assert.match(hook, /pendingSeek\.current\.request\(restore\.time, false/);
  assert.match(hook, /retry reload requested/);
  assert.doesNotMatch(hook, /setAttempt/);
});
