import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRuntimeCue, getRuntimeCue} from '../src/data/runtimeCue';
import {getOrchestraXRay} from '../src/data/orchestraXRay';
import {getThemeLens} from '../src/data/themeLens';
import {deriveRuntimeScoreFacts} from '../tools/generateRuntimeScoreFacts';
import type {RuntimeScoreFactsManifest} from '../src/types/scoreFacts';
import type {ScoreManifest} from '../tools/generateScoreManifest';

const fullManifest = JSON.parse(readFileSync(new URL('../src/data/generated/brahms-op68-movement4-manifest.json', import.meta.url), 'utf8')) as ScoreManifest;
const runtimeFacts = deriveRuntimeScoreFacts(fullManifest);

test('m.62 merges generated objective facts with unchanged curated roles', () => {
  const cue = buildRuntimeCue(62, runtimeFacts);
  assert.ok(cue?.objectiveFacts);
  assert.deepEqual(cue.objectiveFacts.activeInstruments, [
    'C Horn 1', 'C Horn 2', 'Violin 1', 'Violin 2', 'Viola', 'Violoncello', 'Contrabass',
  ]);
  assert.equal(cue.objectiveFacts.textureDensity, 7);
  assert.deepEqual(cue.smartScoreParts.find(part => part.instrument === 'Violins')?.objectiveParts.map(part => part.name), ['Violin 1', 'Violin 2']);
  assert.deepEqual(cue.smartScoreParts.find(part => part.instrument === 'Lower Strings')?.objectiveParts.map(part => [part.name, part.active]), [['Violoncello', true], ['Contrabass', true]]);
  assert.deepEqual(cue.smartScoreParts.find(part => part.instrument === 'Horn')?.objectiveParts.filter(part => part.active).map(part => part.name), ['C Horn 1', 'C Horn 2']);
  assert.deepEqual(cue.smartScoreParts.map(part => part.curatedRole?.role), ['Main Theme', 'Harmonic Foundation', 'Orchestral Support']);
  assert.deepEqual(getOrchestraXRay(62), [
    {instrument: 'Violins', role: 'Main Theme', emphasis: 'primary'},
    {instrument: 'Lower Strings', role: 'Harmonic Foundation', emphasis: 'secondary'},
    {instrument: 'Horn', role: 'Orchestral Support', emphasis: 'supporting'},
  ]);
});

test('merged objective data responds to regenerated score facts without changing curated interpretation', () => {
  const altered: RuntimeScoreFactsManifest = structuredClone(runtimeFacts);
  altered.measures['62'].textureDensity = 99;
  altered.measures['62'].parts.find(part => part.name === 'Violin 1')!.noteCount = 12;
  const cue = buildRuntimeCue(62, altered);
  assert.equal(cue?.objectiveFacts?.textureDensity, 99);
  assert.equal(cue?.smartScoreParts.find(part => part.instrument === 'Violins')?.objectiveParts[0].noteCount, 12);
  assert.equal(cue?.smartScoreParts.find(part => part.instrument === 'Violins')?.curatedRole?.role, 'Main Theme');
});

test('Theme Lens relationships remain curated while runtime facts power all current cue measures', () => {
  for (const measure of [30, 62, 285, 407]) assert.ok(getRuntimeCue(measure)?.objectiveFacts);
  assert.deepEqual(getThemeLens(285)?.firstHeard.measure, 30);
  assert.deepEqual(getThemeLens(407)?.firstHeard.measure, 47);
  const m30Strings = getRuntimeCue(30)?.smartScoreParts.find(part => part.instrument === 'Strings')?.objectiveParts;
  assert.deepEqual(m30Strings?.filter(part => part.active).map(part => part.name), ['Violoncello', 'Contrabass']);
  assert.deepEqual(m30Strings?.filter(part => !part.active).map(part => part.name), ['Violin 1', 'Violin 2', 'Viola']);
});
