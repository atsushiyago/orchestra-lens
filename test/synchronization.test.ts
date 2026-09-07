import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {selectScoreEvent, validateTimeline} from '../src/hooks/scoreSynchronization';
import {PeekSession, PendingSeekQueue, seekTo, type MediaClock} from '../src/playback/controller';
import {getOrchestraXRay} from '../src/data/orchestraXRay';
import {getSmartScoreParts} from '../src/data/smartScore';
import {getThemeLens} from '../src/data/themeLens';
import {brahmsMovement4PerformanceAlignment} from '../src/data/performanceAlignment';
import {scoreAssetVerification} from '../src/data/scoreAssetVerification';

test('measures 30, 62, 290, and 407 resolve their Smart Score and relationship data', () => {
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
  assert.deepEqual(getSmartScoreParts(290), [
    {instrument: 'Horn', asset: 'm290-horn'},
  ]);
  assert.deepEqual(getThemeLens(290), {
    currentMeasure: 290,
    headline: "YOU'VE HEARD THIS BEFORE",
    firstHeard: {measure: 30, instrument: 'Horn', label: 'Alphorn Theme'},
    now: {measure: 290, label: 'Transformed Return'},
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
test('audited score assets contain their intended target measures', () => {
  for (const asset of Object.values(scoreAssetVerification)) {
    assert.ok(asset.sourceMeasureStart <= asset.targetMeasure);
    assert.ok(asset.targetMeasure <= asset.sourceMeasureEnd);
  }
  assert.equal(scoreAssetVerification['m290-horn'].sourceMeasureStart, 289);
  assert.equal(scoreAssetVerification['m407-chorale'].sourceMeasureStart, 407);
});

test('real clock samples move across all four cues and backward seeks', () => {
  validateTimeline(scoreEvents);
  const {30: m30, 62: m62, 290: m290, 407: m407} = brahmsMovement4PerformanceAlignment.cues;
  const times = [0, m30.timeSeconds - .001, m30.timeSeconds, m30.timeSeconds + 14.999,
    m62.timeSeconds, m290.timeSeconds, m407.timeSeconds, m407.timeSeconds + 14.999,
    m407.timeSeconds + 15, m30.timeSeconds + 1, m290.timeSeconds + 1, m62.timeSeconds + 1, 0];
  assert.deepEqual(times.map(t => selectScoreEvent(scoreEvents, t)?.measure),
    [undefined, undefined, 30, 30, 62, 290, 407, 407, undefined, 30, 290, 62, undefined]);
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
function fake(paused: boolean): MediaClock & {pauseCalls: number; playCalls: number} {
  return {currentTime: 20, duration: 90, paused, pauseCalls: 0, playCalls: 0,
    async play() {this.playCalls++; this.paused = false;}, pause() {this.pauseCalls++; this.paused = true;}};
}
test('Score Peek opening and BACK preserve playback state without pausing', async () => {
  for (const paused of [true, false]) {
    const media = fake(paused), peek = new PeekSession();
    peek.enter(media); peek.enter(media);
    assert.equal(media.paused, paused);
    assert.equal(media.currentTime, 20);
    await peek.leave(media); await peek.leave(media);
    assert.equal(media.paused, paused);
    assert.equal(media.pauseCalls, 0);
    assert.equal(media.playCalls, 0);
  }
});
test('COMPARE has no playback lifecycle because Score Peek never mutates MediaClock', async () => {
  const media = fake(false), peek = new PeekSession();
  peek.enter(media); peek.cancelResume(); await peek.leave(media);
  assert.equal(media.paused, false);
  assert.equal(media.pauseCalls, 0);
  assert.equal(media.playCalls, 0);
});
test('seek clamps to duration and ignores invalid/unknown duration', () => {
  const media = fake(false);
  seekTo(media, -20); assert.equal(media.currentTime, 0);
  seekTo(media, 200); assert.equal(media.currentTime, 90);
  seekTo(media, NaN); assert.equal(media.currentTime, 90);
  media.duration = NaN; seekTo(media, 30); assert.equal(media.currentTime, 90);
});
test('Debug review seeks queue until media readiness and use the mounted player once ready', () => {
  const queue = new PendingSeekQueue();
  const executed: number[] = [];
  assert.equal(queue.request(942.83, false, target => executed.push(target)), 'queued');
  assert.equal(executed.length, 0);
  assert.equal(queue.request(860.573, false, target => executed.push(target)), 'queued');
  assert.equal(queue.flush(false, target => executed.push(target)), undefined);
  assert.equal(queue.flush(true, target => executed.push(target)), 860.573);
  assert.deepEqual(executed, [860.573]);
});
