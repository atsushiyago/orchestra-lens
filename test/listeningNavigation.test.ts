import assert from 'node:assert/strict';
import {test} from 'node:test';
import {leaveFullMovementForMenu} from '../src/playback/listeningNavigation';

test('leaving Full Movement pauses while preserving the mounted player position for the entry menu', () => {
  assert.deepEqual(leaveFullMovementForMenu(), {pause: true, preservePosition: true, destination: 'entry'});
});
