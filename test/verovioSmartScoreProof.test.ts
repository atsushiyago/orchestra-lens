import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractMusicXmlExcerpt, filterNonPerformanceAnnotations} from '../tools/generateVerovioSmartScoreProof';
import type {ListeningCueManifest} from '../tools/generateListeningCues';

const scorePath = new URL('../scores/real/Brahms_Op68_Movement4.musicxml', import.meta.url);
const cuePath = new URL('../src/data/generated/brahms-op68-movement4-listening-cues.json', import.meta.url);

test('Verovio proof extracts the generated m.97 staff choice and its generic four-measure window without flattening MusicXML', () => {
  const cues = JSON.parse(readFileSync(cuePath, 'utf8')) as ListeningCueManifest;
  const cue = cues.cues.find(item => item.measure === 97)!;
  const excerpt = extractMusicXmlExcerpt(readFileSync(scorePath, 'utf8'), cue.recommendedStaves, {startMeasure: cue.measure - 1, endMeasure: cue.measure + 2});
  assert.equal((excerpt.match(/<part id=/g) ?? []).length, cue.recommendedStaves.length);
  assert.match(excerpt, /<measure number="96"/);
  assert.match(excerpt, /<measure number="99"/);
  assert.doesNotMatch(excerpt, /<measure number="95"/);
  assert.match(excerpt, /<clef>/);
  assert.match(excerpt, /<key>/);
  assert.match(excerpt, /<time/);
  assert.match(excerpt, /<beam number=/);
  assert.match(excerpt, /<voice>/);
  assert.match(excerpt, /<direction/);
  for (const staff of cue.recommendedStaves) assert.match(excerpt, new RegExp(`<part-name>${staff}</part-name>`));
});

test('analysis-code lyric filtering removes only colored single-letter analytical annotations and preserves musical text', () => {
  const source = '<note><lyric number="1" color="#FF0000" relative-y="-30"><syllabic>single</syllabic><text>e</text></lyric><lyric number="2"><syllabic>single</syllabic><text>allegrо</text></lyric></note><direction><direction-type><words>sempre e passionato</words></direction-type></direction><direction><direction-type><dynamics><f/></dynamics></direction-type></direction>';
  const filtered = filterNonPerformanceAnnotations(source);
  assert.equal(filtered.removedAnalyticalLyrics, 1);
  assert.doesNotMatch(filtered.musicxml, /#FF0000/);
  assert.match(filtered.musicxml, /allegrо/);
  assert.match(filtered.musicxml, /sempre e passionato/);
  assert.match(filtered.musicxml, /<f\/>/);
});
