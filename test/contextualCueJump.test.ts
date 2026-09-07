import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {workById} from '../src/data/workCatalog';
import {contextualCueJumpTargets} from '../src/playback/contextualCueJump';
import {contextualOverlayFor} from '../src/playback/contextualOverlay';
import {developmentValidationScoreEvents} from '../src/playback/developmentScoreEvents';
import {selectScoreEvent} from '../src/hooks/scoreSynchronization';
import generatedAlignment from '../src/data/generated/brahms-op68-movement4-performance-alignment.json';
import {brahmsMovement4Recording} from '../src/data/performanceAlignment';

test('Debug contextual cue jumps derive supported targets and timestamps from existing cue events', () => {
  const brahms = workById('brahms-op68-4');
  const targets = contextualCueJumpTargets(brahms.scoreEvents, brahms.capabilities);
  assert.deepEqual(targets.map(target => [target.measure, target.timeSeconds, target.label]), scoreEvents
    .map(event => ({event, overlay: contextualOverlayFor(brahms.capabilities, event)}))
    .filter(({overlay}) => overlay?.canAskTheScore || overlay?.hasThemeLens)
    .map(({event, overlay}) => [event.measure, event.startTime, overlay!.canAskTheScore ? 'ASK THE SCORE' : 'THEME LENS']));
});

test('works without prepared contextual features expose no Debug cue jumps', () => {
  const beethoven = workById('beethoven-op67-1');
  assert.deepEqual(contextualCueJumpTargets(beethoven.scoreEvents, beethoven.capabilities), []);
});

test('Debug m.407 jump uses the same generated timeline as the Debug cue resolver', () => {
  const brahms = workById('brahms-op68-4');
  const target = contextualCueJumpTargets(developmentValidationScoreEvents, brahms.capabilities)
    .find(candidate => candidate.measure === 407);
  assert.equal(target?.timeSeconds, generatedAlignment.measures['407'].timeSeconds);
  assert.equal(selectScoreEvent(developmentValidationScoreEvents, target!.timeSeconds)?.measure, 407);
  // Release now uses the same validated generated m.407 source.
  assert.equal(target?.timeSeconds, scoreEvents.find(event => event.measure === 407)?.startTime);
});

test('the generated m.407 Debug target is well before the recording end', () => {
  const target = generatedAlignment.measures['407'].timeSeconds;
  assert.equal(target, 946.315);
  assert.equal(brahmsMovement4Recording.durationSeconds, 1016.928);
  assert.ok(brahmsMovement4Recording.durationSeconds - target > 70);
});
