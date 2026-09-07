import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {extractMusicXmlExcerpt, extractMusicXmlExcerptWithReport, filterNonPerformanceAnnotations, validateExcerptIntegrity, validateSvgGlyphs} from '../tools/generateVerovioSmartScoreProof';
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

test('excerpt integrity fingerprints source-position measures and catches a wrong tail after a correct prefix', () => {
  const source = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Violin I</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure><measure number="2"><note><rest/><duration>1</duration></note></measure><measure number="3"><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><chord/></note></measure><measure number="4"><note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
  const extracted = extractMusicXmlExcerptWithReport(source, ['Violin I'], {startMeasure: 1, endMeasure: 3});
  assert.equal(extracted.integrity.valid, true);
  assert.deepEqual(extracted.integrity.parts[0]?.measures.map(measure => [measure.sourceMeasureIndex, measure.sourceMeasureNumber, measure.outputMeasureIndex, measure.outputMeasureNumber]), [[0, '1', 0, '1'], [1, '2', 1, '2'], [2, '3', 2, '3']]);
  const corrupted = extracted.musicxml.replace('<measure number="3"><note><pitch><step>D</step>', '<measure number="4"><note><pitch><step>E</step>');
  const check = validateExcerptIntegrity(source, corrupted, [{id: 'P1', name: 'Violin I'}], {startMeasure: 1, endMeasure: 3});
  assert.equal(check.valid, false);
  assert.match(check.mismatches.join(' '), /fingerprint mismatch/);
});

test('instrumental filtering preserves dynamic expression text while normalizing other-dynamics away from private-use SVG text', () => {
  const source = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Horn I</part-name></score-part></part-list><part id="P1"><measure number="1"><direction placement="below"><direction-type><dynamics><f/><other-dynamics>sempre e passionato</other-dynamics></dynamics></direction-type></direction></measure></part></score-partwise>`;
  const filtered = filterNonPerformanceAnnotations(source);
  assert.equal(filtered.normalizedOtherDynamics, 1);
  assert.match(filtered.musicxml, /<f\/>/);
  assert.match(filtered.musicxml, /<words>sempre e passionato<\/words>/);
  assert.doesNotMatch(filtered.musicxml, /other-dynamics/);
});

test('SVG glyph validation rejects private-use text but permits Verovio use-based notation glyphs', () => {
  assert.equal(validateSvgGlyphs('<svg><use href="#E0A2"/><text>Allegro</text></svg>', true).valid, true);
  const invalid = validateSvgGlyphs('<svg><text>\ue522</text></svg>', true);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.privateUseTextGlyphs, 1);
});
