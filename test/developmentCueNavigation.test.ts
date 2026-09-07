import {test} from 'node:test';
import assert from 'node:assert/strict';
import generatedAlignment from '../src/data/generated/brahms-op68-movement4-performance-alignment.json';
import {alignedCueTime} from '../src/data/performanceAlignment';
import {developmentValidationCueTime} from '../src/playback/developmentAlignment';
import {developmentValidationScoreEvents} from '../src/playback/developmentScoreEvents';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {selectScoreEvent} from '../src/hooks/scoreSynchronization';
import {debugCueClock, developmentCueMeasures, developmentCueTarget} from '../src/playback/developmentCueNavigation';

test('development Right advances through the four user-facing score cues', () => {
  assert.deepEqual(developmentCueMeasures, [30, 62, 290, 407]);
  assert.deepEqual(developmentCueTarget(alignedCueTime(30), 'next'), {measure: 62, timeSeconds: alignedCueTime(62), automatic: false});
  assert.deepEqual(developmentCueTarget(alignedCueTime(62), 'next'), {measure: 290, timeSeconds: generatedAlignment.measures['290'].timeSeconds, automatic: true});
  assert.deepEqual(developmentCueTarget(developmentValidationCueTime(290), 'next'), {measure: 407, timeSeconds: generatedAlignment.measures['407'].timeSeconds, automatic: true});
});

test('development Left returns to the previous user-facing score cue', () => {
  assert.deepEqual(developmentCueTarget(developmentValidationCueTime(407), 'previous'), {measure: 290, timeSeconds: generatedAlignment.measures['290'].timeSeconds, automatic: true});
  assert.deepEqual(developmentCueTarget(developmentValidationCueTime(290), 'previous'), {measure: 62, timeSeconds: alignedCueTime(62), automatic: false});
  assert.deepEqual(developmentCueTarget(alignedCueTime(62), 'previous'), {measure: 30, timeSeconds: alignedCueTime(30), automatic: false});
});

test('m.47 is skipped and generated cue times read the alignment artifact', () => {
  assert.ok(!(developmentCueMeasures as readonly number[]).includes(47));
  assert.equal(developmentCueTarget(alignedCueTime(30), 'next')?.timeSeconds, alignedCueTime(62));
  assert.equal(developmentValidationCueTime(290), generatedAlignment.measures['290'].timeSeconds);
  assert.equal(developmentValidationCueTime(407), generatedAlignment.measures['407'].timeSeconds);
  assert.equal(alignedCueTime(290), generatedAlignment.measures['290'].timeSeconds);
  assert.equal(alignedCueTime(407), generatedAlignment.measures['407'].timeSeconds);
  assert.equal(debugCueClock(developmentValidationCueTime(290)), '11:52.24');
});

test('Debug resolver and navigation share generated m.290/m.407 alignment', () => {
  for (const measure of [290, 407] as const) {
    const target = developmentCueTarget(developmentValidationCueTime(measure) - .01, 'next');
    assert.equal(target?.measure, measure);
    assert.equal(target?.timeSeconds, developmentValidationCueTime(measure));
    assert.equal(selectScoreEvent(developmentValidationScoreEvents, target!.timeSeconds)?.measure, measure);
  }
});

test('Release resolver exposes the approved m.290 cue while m.285 is not user-facing', () => {
  assert.equal(selectScoreEvent(scoreEvents, alignedCueTime(290))?.measure, 290);
  assert.equal(selectScoreEvent(scoreEvents, generatedAlignment.measures['285'].timeSeconds), undefined);
  assert.equal(selectScoreEvent(scoreEvents, alignedCueTime(407))?.measure, 407);
  assert.equal(selectScoreEvent(scoreEvents, developmentValidationCueTime(407))?.measure, 407);
});
