import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {defaultListeningCueConfig, generateListeningCues} from '../tools/generateListeningCues';
import type {ScoreManifest} from '../tools/generateScoreManifest';
import type {HauptstimmeEvidenceManifest} from '../src/types/hauptstimme';
import type {PerformanceAlignment, HighlightManifest} from '../tools/generateHighlights';

const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const inputs = (work: 'brahms-op68-movement4' | 'beethoven-op67-movement1') => ({
  score: json<ScoreManifest>(`../src/data/generated/${work}-manifest.json`),
  evidence: json<HauptstimmeEvidenceManifest>(`../src/data/generated/${work === 'brahms-op68-movement4' ? 'hauptstimmeEvidence' : `${work}-hauptstimme-evidence`}.json`),
  alignment: json<PerformanceAlignment>(`../src/data/generated/${work}-performance-alignment.json`),
  highlights: json<HighlightManifest>(`../src/data/generated/${work}-highlights.json`),
});

test('Brahms and Beethoven use the exact same generic Listening Cue configuration', () => {
  const brahms = inputs('brahms-op68-movement4');
  const beethoven = inputs('beethoven-op67-movement1');
  const first = generateListeningCues(brahms.score, brahms.evidence, brahms.alignment, brahms.highlights);
  const second = generateListeningCues(beethoven.score, beethoven.evidence, beethoven.alignment, beethoven.highlights);
  assert.deepEqual(first.generator.config, defaultListeningCueConfig);
  assert.deepEqual(second.generator.config, defaultListeningCueConfig);
  assert.ok(first.cues.length >= 20 && first.cues.length <= 30);
});

test('cue output is deterministic, performance ordered, and uses only active generated staves', () => {
  const source = inputs('brahms-op68-movement4');
  const one = generateListeningCues(source.score, source.evidence, source.alignment, source.highlights);
  const two = generateListeningCues(source.score, source.evidence, source.alignment, source.highlights);
  assert.deepEqual(one, two);
  for (let index = 1; index < one.cues.length; index++) assert.ok(one.cues[index - 1]!.timestampSec < one.cues[index]!.timestampSec);
  for (const cue of one.cues) {
    const active = new Set(source.score.measures[String(cue.measure)]!.activeInstruments);
    assert.ok(cue.recommendedStaves.length >= 1 && cue.recommendedStaves.length <= 4);
    assert.ok(cue.recommendedStaves.every(staff => active.has(staff)));
    assert.ok(cue.region.endSec - cue.region.startSec >= defaultListeningCueConfig.regionSeconds);
  }
});

test('nearby adjacent candidates are suppressed without altering detector or tour artifacts', () => {
  const source = inputs('beethoven-op67-movement1');
  const beforeHighlights = JSON.stringify(source.highlights);
  const beforeTour = readFileSync(new URL('../src/data/generated/beethoven-op67-movement1-tour-selection.json', import.meta.url), 'utf8');
  const result = generateListeningCues(source.score, source.evidence, source.alignment, source.highlights);
  for (let index = 1; index < result.cues.length; index++) {
    assert.ok(result.cues[index]!.timestampSec - result.cues[index - 1]!.timestampSec >= defaultListeningCueConfig.minimumTimeSeparationSeconds);
  }
  assert.equal(JSON.stringify(source.highlights), beforeHighlights);
  assert.equal(readFileSync(new URL('../src/data/generated/beethoven-op67-movement1-tour-selection.json', import.meta.url), 'utf8'), beforeTour);
});

test('generator source contains no work-specific cue measure list', () => {
  const source = readFileSync(new URL('../tools/generateListeningCues.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\[30,\s*62,\s*290,\s*407\]/);
  assert.doesNotMatch(source, /brahms-op68|beethoven-op67/);
});
