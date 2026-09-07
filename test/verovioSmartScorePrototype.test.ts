import assert from 'node:assert/strict';
import {existsSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {generateVerovioSmartScorePrototype, tvVerovioOptions} from '../tools/generateVerovioSmartScorePrototype';

const scorePath = new URL('../scores/real/Brahms_Op68_Movement4.musicxml', import.meta.url).pathname;
const cuePath = new URL('../src/data/generated/brahms-op68-movement4-listening-cues.json', import.meta.url).pathname;

test('Verovio batch uses the generated six-cue prototype selection and one generic TV layout profile', async () => {
  const output = mkdtempSync(join(tmpdir(), 'orchestra-verovio-'));
  const generated = await generateVerovioSmartScorePrototype(scorePath, cuePath, output);
  assert.deepEqual(generated.cues.map(cue => cue.measure), [1, 30, 38, 97, 280, 404]);
  assert.equal(generated.generator.options, tvVerovioOptions);
  for (const cue of generated.cues) {
    assert.ok(existsSync(join(output, cue.musicxml)));
    assert.ok(existsSync(join(output, cue.svg)));
    assert.equal(cue.renderWindow.endMeasure - cue.renderWindow.startMeasure + 1 >= 2, true);
    assert.equal(cue.renderWindow.endMeasure - cue.renderWindow.startMeasure + 1 <= 4, true);
    assert.ok(cue.layout.systemCount >= 1);
  }
});
