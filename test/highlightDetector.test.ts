import assert from 'node:assert/strict';
import {test} from 'node:test';
import {detectHighlights, defaultHighlightConfig, markdownReport} from '../tools/generateHighlights';
import type {ScoreManifest} from '../tools/generateScoreManifest';
import type {HauptstimmeEvidenceManifest} from '../src/types/hauptstimme';

const part = (name: string, active: boolean, noteCount = active ? 1 : 0, dynamics: string[] = []) => ({
  name, active, noteCount, lowestPitch: active ? 'C4' : null, highestPitch: active ? 'C5' : null, dynamics, articulations: [],
});

const score = (rows: Array<{active: string[]; density: number; dynamics?: string[]}>) => ({
  work: {title: 'Fixture', composer: 'Test'},
  measures: Object.fromEntries(rows.map((row, index) => {
    const all = ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'];
    const parts = all.map(name => part(name, row.active.includes(name), row.active.includes(name) ? Math.max(1, Math.ceil(row.density / Math.max(1, row.active.length))) : 0, row.dynamics));
    return [String(index + 1), {parts, activeInstruments: row.active, textureDensity: row.density}];
  })),
}) satisfies ScoreManifest;

const evidence = (spans: HauptstimmeEvidenceManifest['spans'] = []): HauptstimmeEvidenceManifest => ({
  source: {project: 'fixture', license: 'fixture', coordinateMapping: 'fixture'},
  measureStartQstamps: {'1': 0, '2': 4, '3': 8, '4': 12, '5': 16},
  spans,
});

const alignment = {measures: Object.fromEntries([1, 2, 3, 4, 5].map(measure => [String(measure), {timeSeconds: measure * 10}]))};
const hsAtTwo: HauptstimmeEvidenceManifest['spans'][number] = {
  id: 'hs-1', startQstamp: 4, endQstamp: 12, startMeasure: 2, endMeasureExclusive: 4,
  startBeat: 1, label: 'a', part: 'Violin 1', partNumber: 1, instrument: 'Vln',
};

test('Highlight Detector output is deterministic, ordered, and explains source facts', () => {
  const source = score([
    {active: ['Cello'], density: 1},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 20, dynamics: ['f']},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 18},
    {active: ['Cello'], density: 1},
    {active: ['Violin 1', 'Cello'], density: 4},
  ]);
  const first = detectHighlights(source, evidence([hsAtTwo]), alignment, {minimumSeparationMeasures: 1});
  const second = detectHighlights(source, evidence([hsAtTwo]), alignment, {minimumSeparationMeasures: 1});
  assert.deepEqual(first, second);
  assert.ok(first.candidates.every((candidate, index) => index === 0 || first.candidates[index - 1].score >= candidate.score));
  const candidate = first.candidates.find(item => item.measure === 2);
  assert.ok(candidate);
  assert.equal(candidate.timeSeconds, 20);
  assert.equal(candidate.features.enteringInstruments.length, 3);
  assert.ok(candidate.reasons.includes('3 instruments enter'));
  assert.ok(candidate.reasons.includes('New Hauptstimme span begins in Violin 1 (label a)'));
});

test('repeat-aware alignments select the first performed occurrence without changing detector weights', () => {
  const repeated = {occurrences: [
    {measure: 1, occurrence: 1, performanceIndex: 1, timeSeconds: 10},
    {measure: 2, occurrence: 1, performanceIndex: 2, timeSeconds: 20},
    {measure: 1, occurrence: 2, performanceIndex: 3, timeSeconds: 30},
  ]};
  const result = detectHighlights(score([
    {active: ['Cello'], density: 1},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 20, dynamics: ['f']},
  ]), evidence([hsAtTwo]), repeated, {minimumSeparationMeasures: 1});
  const candidate = result.candidates.find(item => item.measure === 2);
  assert.equal(candidate?.timeSeconds, 20);
  assert.equal(candidate?.occurrence, 1);
  assert.deepEqual(result.detector.config.weights, defaultHighlightConfig.weights);
});

test('nearby measures deduplicate unless they begin distinct Hauptstimme evidence', () => {
  const source = score([
    {active: ['Cello'], density: 1},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 20, dynamics: ['f']},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 21, dynamics: ['ff']},
    {active: ['Cello'], density: 1},
    {active: ['Violin 1', 'Cello'], density: 4},
  ]);
  const deduplicated = detectHighlights(source, evidence(), alignment, {minimumSeparationMeasures: 4});
  assert.ok(deduplicated.candidates.filter(candidate => candidate.measure === 2 || candidate.measure === 3).length <= 1);
  const distinct = {...hsAtTwo, id: 'hs-2', startQstamp: 8, startMeasure: 3, part: 'Flute 1', instrument: 'Fl', label: 'b'};
  const retained = detectHighlights(source, evidence([hsAtTwo, distinct]), alignment, {minimumSeparationMeasures: 4});
  assert.ok(retained.candidates.some(candidate => candidate.measure === 2));
  assert.ok(retained.candidates.some(candidate => candidate.measure === 3));
});

test('Hauptstimme, orchestration, and density features independently affect candidate scoring', () => {
  const stable = score([
    {active: ['Cello'], density: 1}, {active: ['Cello'], density: 1}, {active: ['Cello'], density: 1},
    {active: ['Cello'], density: 1}, {active: ['Cello'], density: 1},
  ]);
  const withHauptstimme = detectHighlights(stable, evidence([hsAtTwo]), alignment, {minimumSeparationMeasures: 1});
  assert.ok(withHauptstimme.candidates.find(candidate => candidate.measure === 2)?.score! >= defaultHighlightConfig.weights.hauptstimmeStart);
  const transition = score([
    {active: ['Cello'], density: 1}, {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 20},
    {active: ['Violin 1', 'Flute 1', 'Horn 1', 'Cello'], density: 20}, {active: ['Cello'], density: 1}, {active: ['Cello'], density: 1},
  ]);
  const orchestration = detectHighlights(transition, evidence(), alignment, {minimumSeparationMeasures: 1});
  const candidate = orchestration.candidates.find(item => item.measure === 2);
  assert.ok(candidate?.reasons.some(reason => reason.includes('Active instrumentation changes')));
  assert.ok(candidate?.reasons.some(reason => reason.includes('Note-event density increases')));
});

test('the detector needs only its supplied source data; the report labels curated-measure comparison separately', () => {
  const result = detectHighlights(score([
    {active: ['Cello'], density: 1}, {active: ['Violin 1'], density: 2}, {active: ['Flute 1'], density: 3},
    {active: ['Horn 1'], density: 4}, {active: ['Cello'], density: 1},
  ]), evidence(), alignment, {minimumSeparationMeasures: 1});
  assert.equal(result.detector.sourceMeasures, 5);
  assert.match(markdownReport(result), /Existing curated measures \(not detector inputs\)/);
});
