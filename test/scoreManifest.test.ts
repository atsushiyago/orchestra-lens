import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateScoreManifest, parseMusicXml} from '../tools/generateScoreManifest';

const fixturePath = join(import.meta.dirname, '../scores/example.musicxml');

test('MusicXML manifest extracts objective per-part measure facts', () => {
  const manifest = parseMusicXml(readFileSync(fixturePath, 'utf8'));
  assert.deepEqual(manifest.work, {title: 'Orchestra Lens Generator Fixture', composer: 'Test Composer'});
  assert.deepEqual(Object.keys(manifest.measures), ['1', '2', '3']);
  assert.deepEqual(manifest.measures['1'], {
    parts: [
      {name: 'Violin I', active: true, noteCount: 2, lowestPitch: 'C4', highestPitch: 'E5', dynamics: ['mf'], articulations: ['staccato']},
      {name: 'Viola', active: false, noteCount: 0, lowestPitch: null, highestPitch: null, dynamics: ['p'], articulations: []},
      {name: 'Cello', active: true, noteCount: 1, lowestPitch: 'G2', highestPitch: 'G2', dynamics: [], articulations: []},
    ],
    activeInstruments: ['Violin I', 'Cello'],
    textureDensity: 3,
  });
  assert.deepEqual(manifest.measures['2'].activeInstruments, ['Viola']);
  assert.equal(manifest.measures['2'].parts[1].lowestPitch, 'Db3');
  assert.deepEqual(manifest.measures['2'].parts[1].dynamics, ['f']);
  assert.equal(manifest.measures['3'].textureDensity, 4);
  assert.deepEqual(manifest.measures['3'].parts[2].dynamics, ['ff']);
});

test('generator writes a machine-readable manifest without touching curated data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'orchestra-lens-manifest-'));
  const output = join(directory, 'manifest.json');
  try {
    generateScoreManifest(fixturePath, output);
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')).measures['1'].activeInstruments, ['Violin I', 'Cello']);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});
