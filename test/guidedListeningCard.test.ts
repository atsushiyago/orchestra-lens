import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {buildGuidedListeningCard} from '../tools/generateGuidedListeningCard';
import type {ListeningCueManifest} from '../tools/generateListeningCues';
import type {ScoreManifest} from '../tools/generateScoreManifest';
import type {VerovioBatchManifest} from '../tools/generateVerovioSmartScorePrototype';

const json = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

test('Guided Listening Card gives MAIN VOICE only to Hauptstimme evidence and keeps other selected parts objectively active', () => {
  const cue = json<ListeningCueManifest>('../src/data/generated/brahms-op68-movement4-listening-cues.json').cues.find(item => item.id === 'cue-m38-o1')!;
  const score = json<ScoreManifest>('../src/data/generated/brahms-op68-movement4-manifest.json');
  const verovio = json<VerovioBatchManifest>('../src/assets/generated/smart-score-verovio/brahms-op68-movement4/production-prototype/manifest.json');
  const asset = verovio.cues.find(item => item.cueId === cue.id)!.svg;
  const card = buildGuidedListeningCard(cue, score, asset, {composer: 'Brahms', title: 'Symphony No. 1', movement: 'Movement IV'});
  assert.equal(card.label, cue.label);
  assert.equal(card.mainVoice?.instrument, 'Flute I');
  assert.equal(card.mainVoice?.evidence, 'hauptstimme');
  assert.deepEqual(card.activeInstruments, ['Bassoon I', 'B♭ Clarinet I', 'B♭ Clarinet II']);
  assert.match(card.listenerHint, /annotated main voice/);
  assert.doesNotMatch(card.listenerHint, /above|support|foundation/i);
  assert.equal(card.scoreAsset, 'cue-cue-m38-o1.svg');
  assert.deepEqual(card.provenance.curated, []);
});

test('active status and low pitch cannot create semantic roles without Hauptstimme evidence', () => {
  const cue = json<ListeningCueManifest>('../src/data/generated/brahms-op68-movement4-listening-cues.json').cues.find(item => item.id === 'cue-m38-o1')!;
  const score = json<ScoreManifest>('../src/data/generated/brahms-op68-movement4-manifest.json');
  const verovio = json<VerovioBatchManifest>('../src/assets/generated/smart-score-verovio/brahms-op68-movement4/production-prototype/manifest.json');
  const asset = verovio.cues.find(item => item.cueId === cue.id)!.svg;
  const withoutEvidence = {...cue, hauptstimme: []};
  const first = buildGuidedListeningCard(withoutEvidence, score, asset, {composer: 'Brahms', title: 'Symphony No. 1', movement: 'Movement IV'});
  const second = buildGuidedListeningCard(withoutEvidence, score, asset, {composer: 'Brahms', title: 'Symphony No. 1', movement: 'Movement IV'});
  assert.equal(first.mainVoice, undefined);
  assert.deepEqual(first.activeInstruments, ['Flute I', 'Bassoon I', 'B♭ Clarinet I', 'B♭ Clarinet II']);
  assert.equal(first.listenerHint, 'Listen as new instruments enter.');
  assert.deepEqual(first, second);
  const source = readFileSync(new URL('../tools/generateGuidedListeningCard.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /foundation|support/);
});
