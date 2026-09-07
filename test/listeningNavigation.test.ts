import assert from 'node:assert/strict';
import {test} from 'node:test';
import {leaveFullMovementForMenu} from '../src/playback/listeningNavigation';

test('leaving Full Movement pauses while preserving position and returning inside the selected work', () => {
  assert.deepEqual(leaveFullMovementForMenu(), {pause: true, preservePosition: true, destination: 'work-entry'});
});
