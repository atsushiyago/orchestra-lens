import assert from 'node:assert/strict';
import {test} from 'node:test';
import brahms from '../src/data/generated/brahms-op68-movement4-highlights.json';
import beethoven from '../src/data/generated/beethoven-op67-movement1-highlights.json';
import type {HighlightCandidate, HighlightManifest} from '../tools/generateHighlights';
import {defaultTourSelectorConfig, selectTour} from '../tools/generateTourSelection';

const detector = (candidates: HighlightCandidate[]): HighlightManifest => ({
  work: {title: 'Fixture', composer: 'Test'},
  detector: {version: 1, description: 'fixture', config: {} as HighlightManifest['detector']['config'], sourceMeasures: 3},
  candidates,
});

const candidate = (rank: number, timeSeconds: number, activeInstruments: string[], density = 10): HighlightCandidate => ({
  rank, measure: rank, occurrence: 1, timeSeconds, score: 50 - rank,
  activeInstruments, hauptstimme: [], reasons: ['fixture'],
  features: {
    activeInstrumentCount: activeInstruments.length, activeInstrumentChange: 0,
    enteringInstruments: [], droppingInstruments: [], textureDensity: density, densityChange: 0,
    dynamicChanges: [], articulationChanges: [], pitchRangeChange: 0, hauptstimmeStarts: [],
    hauptstimmeInstrumentChanged: false, hauptstimmeLabelChanged: false,
    returningHauptstimmeLabels: [], sparseTexture: false, suddenFullTexture: false,
  },
});

test('one unchanged selector configuration deterministically selects ordered tours for Brahms and Beethoven', () => {
  const brahmsInput = structuredClone(brahms) as unknown as HighlightManifest;
  const beethovenInput = structuredClone(beethoven) as unknown as HighlightManifest;
  const brahmsFirst = selectTour(brahmsInput);
  const brahmsSecond = selectTour(brahmsInput);
  const beethovenTour = selectTour(beethovenInput);
  assert.deepEqual(brahmsFirst, brahmsSecond);
  assert.deepEqual(brahmsFirst.selector.config, defaultTourSelectorConfig);
  assert.deepEqual(beethovenTour.selector.config, defaultTourSelectorConfig);
  for (const selection of [brahmsFirst, beethovenTour]) {
    assert.ok(selection.selected.length <= 9);
    assert.ok(selection.selected.every((moment, index, moments) => index === 0 || moment.timeSeconds > moments[index - 1]!.timeSeconds));
  }
  assert.deepEqual(brahmsInput, brahms);
  assert.deepEqual(beethovenInput, beethoven);
});

test('near-identical, close candidates are suppressed without modifying detector candidates', () => {
  const first = candidate(1, 100, ['Violin', 'Viola'], 24);
  const duplicate = candidate(2, 112, ['Violin', 'Viola'], 24);
  const distinct = candidate(3, 210, ['Trumpet', 'Timpani'], 80);
  const source = detector([first, duplicate, distinct]);
  const result = selectTour(source, {candidatePoolSize: 3, maxHighlights: 3, minimumTimeSeparationSeconds: 38, closeTimeDistinctnessThreshold: .5});
  assert.deepEqual(result.selected.map(moment => moment.detectorRank), [1, 3]);
  assert.equal(result.rejected.find(item => item.detectorRank === 2)?.reason, 'Excluded as a nearby similar candidate.');
  assert.equal(source.candidates[1]?.timeSeconds, 112);
});

test('occurrence-aware detector candidates retain their generated occurrence and timestamp', () => {
  const repeated = candidate(1, 50, ['Violin']);
  repeated.measure = 8;
  repeated.occurrence = 2;
  const selection = selectTour(detector([repeated]));
  assert.deepEqual(selection.selected[0] && [selection.selected[0].measure, selection.selected[0].occurrence, selection.selected[0].timeSeconds], [8, 2, 50]);
});
