import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {brahmsMovement4PerformanceAlignment, brahmsMovement4Recording} from '../src/data/performanceAlignment';
import {mediaSource} from '../src/data/media';
import {selectScoreEvent} from '../src/hooks/scoreSynchronization';
import {getRuntimeCue} from '../src/data/runtimeCue';
import {buildAskTheScoreRequest} from '../src/askTheScore';
import generatedAlignment from '../src/data/generated/brahms-op68-movement4-performance-alignment.json';

test('the staged demo recording is the CC0 Brahms movement-IV performance', () => {
  assert.equal(brahmsMovement4Recording.license, 'CC0-1.0');
  assert.equal(brahmsMovement4Recording.performer, 'Musopen Symphony Orchestra');
  assert.equal(brahmsMovement4Recording.durationSeconds, 1016.928);
  assert.match(brahmsMovement4Recording.sourcePage, /commons\.wikimedia\.org/);
  assert.equal(mediaSource.recordingId, brahmsMovement4Recording.id);
  // The app must not hotlink Commons; it uses the dedicated HTTPS delivery URL.
  assert.doesNotMatch(mediaSource.uri, /wikimedia\.org/);
  assert.match(mediaSource.uri, /^https:\/\/d25q8u9cz8hosu\.cloudfront\.net\/media\//);
});

test('all target measures have strictly increasing performance timestamps', () => {
  const measures = [30, 47, 62, 290, 407] as const;
  const times = measures.map(measure => brahmsMovement4PerformanceAlignment.cues[measure].timeSeconds);
  assert.equal(times.length, 5);
  assert.ok(times.every(Number.isFinite));
  assert.ok(times.every((time, index) => index === 0 || time > times[index - 1]));
});

test('aligned cue lookup preserves score experiences and Ask the Score at m.62', () => {
  for (const measure of [30, 62, 290, 407] as const) {
    const time = brahmsMovement4PerformanceAlignment.cues[measure].timeSeconds;
    assert.equal(selectScoreEvent(scoreEvents, time)?.measure, measure);
    assert.equal(getRuntimeCue(measure)?.measure, measure);
  }
  const cue = getRuntimeCue(62);
  assert.ok(cue);
  assert.equal(buildAskTheScoreRequest(cue).context.measure, 62);
});

test('Release m.407 contextual timing derives from the validated generated alignment', () => {
  assert.equal(brahmsMovement4PerformanceAlignment.cues[407].timeSeconds, generatedAlignment.measures['407'].timeSeconds);
  assert.equal(brahmsMovement4PerformanceAlignment.cues[47].timeSeconds, 168.36);
});
