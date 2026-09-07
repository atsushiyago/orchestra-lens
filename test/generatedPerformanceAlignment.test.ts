import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const generated = JSON.parse(readFileSync(new URL('../src/data/generated/brahms-op68-movement4-performance-alignment.json', import.meta.url), 'utf8')) as {
  durationSeconds: number;
  inputSha256: Record<string, string>;
  anchorPolicy: {usedAsConstraints: Record<string, number>};
  measures: Record<string, {timeSeconds: number}>;
};

test('generated performance alignment covers all MusicXML measures within the recording', () => {
  const measures = Object.entries(generated.measures).map(([measure, value]) => [Number(measure), value.timeSeconds] as const);
  assert.equal(measures.length, 458);
  assert.deepEqual([measures[0][0], measures.at(-1)?.[0]], [1, 458]);
  for (const [measure, time] of measures) {
    assert.ok(Number.isInteger(measure));
    assert.ok(time >= 0 && time <= generated.durationSeconds);
  }
  for (let index = 1; index < measures.length; index++) assert.ok(measures[index - 1][1] < measures[index][1]);
});

test('accepted anchors are explicitly recorded and the approved Horn cue is present', () => {
  assert.deepEqual(generated.anchorPolicy.usedAsConstraints, {'30': 126.36, '62': 271});
  assert.equal(generated.measures['30'].timeSeconds, 126.36);
  assert.equal(generated.measures['62'].timeSeconds, 271);
  assert.equal(generated.measures['290'].timeSeconds, 712.239);
  assert.notEqual(generated.measures['285'].timeSeconds, 761.8);
  assert.notEqual(generated.measures['407'].timeSeconds, 965.28);
});

test('generated alignment identifies deterministic local inputs', () => {
  assert.match(generated.inputSha256.musicxml, /^[a-f0-9]{64}$/);
  assert.match(generated.inputSha256.positions, /^[a-f0-9]{64}$/);
  assert.match(generated.inputSha256.audio, /^[a-f0-9]{64}$/);
});
