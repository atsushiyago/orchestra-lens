import assert from 'node:assert/strict';
import {existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {generateBrahmsGuidedListeningCards} from '../tools/generateBrahmsGuidedListeningCards';

const scorePath = new URL('../scores/real/Brahms_Op68_Movement4.musicxml', import.meta.url).pathname;
const factsPath = new URL('../src/data/generated/brahms-op68-movement4-manifest.json', import.meta.url).pathname;
const cuePath = new URL('../src/data/generated/brahms-op68-movement4-listening-cues.json', import.meta.url).pathname;

test('all generated Brahms Listening Cues receive deterministic, conservative Guided Listening cards', async () => {
  const first = await generateBrahmsGuidedListeningCards(scorePath, factsPath, cuePath, mkdtempSync(join(tmpdir(), 'orchestra-guided-')));
  const second = await generateBrahmsGuidedListeningCards(scorePath, factsPath, cuePath, mkdtempSync(join(tmpdir(), 'orchestra-guided-')));
  assert.equal(first.cards.length, 26);
  assert.deepEqual(first, second);
  for (const card of first.cards) {
    assert.equal(card.status, 'generated');
    if (card.status !== 'generated') continue;
    assert.ok(card.semanticConsistency);
    assert.ok(card.noStrayAnalyticalLetters);
    assert.ok(card.listenerHint.length > 0);
  }
});
