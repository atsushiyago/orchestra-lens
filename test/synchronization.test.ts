import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {selectScoreEvent, validateTimeline} from '../src/hooks/scoreSynchronization';
import {PeekSession, seekTo, type MediaClock} from '../src/playback/controller';
import {getOrchestraXRay} from '../src/data/orchestraXRay';
import {getSmartScoreParts} from '../src/data/smartScore';
import {getThemeLens} from '../src/data/themeLens';

test('measures 30, 62, 285, and 407 resolve their Smart Score and relationship data', () => {
  assert.deepEqual(getOrchestraXRay(30), [
    {instrument: 'Horn', role: 'Main Theme', emphasis: 'primary'},
    {instrument: 'Strings', role: 'Harmonic Support', emphasis: 'secondary'},
    {instrument: 'Flute', role: 'Upcoming Theme Handoff', emphasis: 'upcoming'},
  ]);
  assert.deepEqual(getSmartScoreParts(30), [
    {instrument: 'Horn', asset: 'm30-horn'},
    {instrument: 'Flute', asset: 'm30-flute'},
    {instrument: 'Strings', asset: 'm30-strings'},
  ]);
  assert.deepEqual(getOrchestraXRay(62), [
    {instrument: 'Violins', role: 'Main Theme', emphasis: 'primary'},
    {instrument: 'Lower Strings', role: 'Harmonic Foundation', emphasis: 'secondary'},
    {instrument: 'Horn', role: 'Orchestral Support', emphasis: 'supporting'},
  ]);
  assert.deepEqual(getSmartScoreParts(62), [
    {instrument: 'Violins', asset: 'm62-violins'},
    {instrument: 'Lower Strings', asset: 'm62-lower-strings'},
    {instrument: 'Horn', asset: 'm62-horn'},
  ]);
  assert.deepEqual(getSmartScoreParts(285), [
    {instrument: 'Horn', asset: 'm285-horn'},
  ]);
  assert.deepEqual(getThemeLens(285), {
    currentMeasure: 285,
    headline: "YOU'VE HEARD THIS BEFORE",
    firstHeard: {measure: 30, instrument: 'Horn', label: 'Alphorn Theme'},
    now: {measure: 285, label: 'Transformed Return'},
  });
  assert.deepEqual(getSmartScoreParts(407), [
    {instrument: 'Brass', asset: 'm407-chorale'},
  ]);
  assert.deepEqual(getThemeLens(407), {
    currentMeasure: 407,
    headline: "YOU'VE HEARD THIS BEFORE",
    firstHeard: {measure: 47, label: 'Chorale'},
    now: {measure: 407, label: 'Climactic Return'},
  });
});

test('real clock samples move across all four cues and backward seeks', () => {
  validateTimeline(scoreEvents);
  const times = [0, 4.999, 5, 19.999, 20, 40, 60, 79.999, 80, 6, 45, 21, 0];
  assert.deepEqual(times.map(t => selectScoreEvent(scoreEvents, t)?.measure),
    [undefined, undefined, 30, 30, 62, 285, 407, 407, undefined, 30, 285, 62, undefined]);
});
test('explicit gaps and omitted end times', () => {
  const events = [{startTime: 10, endTime: 12, measure: 1, title: 'A'}, {startTime: 15, measure: 2, title: 'B'}, {startTime: 20, measure: 3, title: 'C'}];
  for (const t of [-1, NaN, Infinity, 0, 12, 14]) assert.equal(selectScoreEvent(events, t), undefined);
  assert.equal(selectScoreEvent(events, 19.9)?.measure, 2);
  assert.equal(selectScoreEvent(events, 200)?.measure, 3);
  assert.equal(selectScoreEvent([], 20), undefined);
});
test('rejects malformed and ambiguous annotations', () => {
  for (const events of [
    [{startTime: -1, measure: 1, title: 'A'}],
    [{startTime: 1, endTime: 1, measure: 1, title: 'A'}],
    [{startTime: 1, measure: 0, title: 'A'}],
    [{startTime: 1, measure: 1, title: ''}],
    [{startTime: 1, measure: 1, title: 'A'}, {startTime: 1, measure: 2, title: 'B'}],
    [{startTime: 1, endTime: 3, measure: 1, title: 'A'}, {startTime: 2, measure: 2, title: 'B'}],
  ]) assert.throws(() => validateTimeline(events));
});
function fake(paused: boolean): MediaClock {
  return {currentTime: 20, duration: 90, paused,
    async play() {this.paused = false;}, pause() {this.paused = true;}};
}
test('Score Peek pauses, retains position, resumes only prior playback', async () => {
  for (const paused of [true, false]) {
    const media = fake(paused), peek = new PeekSession();
    peek.enter(media); peek.enter(media);
    assert.equal(media.paused, true);
    assert.equal(media.currentTime, 20);
    await peek.leave(media); await peek.leave(media);
    assert.equal(media.paused, paused);
  }
});
test('backgrounding cancels automatic resume', async () => {
  const media = fake(false), peek = new PeekSession();
  peek.enter(media); peek.cancelResume(); await peek.leave(media);
  assert.equal(media.paused, true);
});
test('seek clamps to duration and ignores invalid/unknown duration', () => {
  const media = fake(false);
  seekTo(media, -20); assert.equal(media.currentTime, 0);
  seekTo(media, 200); assert.equal(media.currentTime, 90);
  seekTo(media, NaN); assert.equal(media.currentTime, 90);
  media.duration = NaN; seekTo(media, 30); assert.equal(media.currentTime, 90);
});
