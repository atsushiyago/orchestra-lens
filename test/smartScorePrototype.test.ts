import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {generateSmartScorePrototype, parseMeasure, parseScoreParts, renderSmartScoreSvg, selectPrototypeCues} from '../tools/generateSmartScorePrototype';
import {instrumentFamily, validateCueStaffConsistency} from '../tools/generateListeningCues';
import type {ListeningCueManifest} from '../tools/generateListeningCues';

const root = new URL('..', import.meta.url);
const scorePath = new URL('../scores/real/Brahms_Op68_Movement4.musicxml', import.meta.url).pathname;
const cuesPath = new URL('../src/data/generated/brahms-op68-movement4-listening-cues.json', import.meta.url).pathname;
const cues = JSON.parse(readFileSync(cuesPath, 'utf8')) as ListeningCueManifest;

test('prototype cue list is selected from the generated Listening Cue artifact', () => {
  const expected = selectPrototypeCues(cues.cues).map(cue => cue.id);
  const output = mkdtempSync(join(tmpdir(), 'orchestra-smart-score-'));
  const generated = generateSmartScorePrototype(scorePath, cuesPath, output);
  assert.deepEqual(generated.cues.map(cue => cue.cueId), expected);
  assert.ok(generated.cues.length >= 5 && generated.cues.length <= 6);
});

test('every rendered excerpt uses only the generated recommended staves and a generic 2–4 measure window', () => {
  const output = mkdtempSync(join(tmpdir(), 'orchestra-smart-score-'));
  const generated = generateSmartScorePrototype(scorePath, cuesPath, output);
  for (const cue of generated.cues) {
    const svg = readFileSync(join(output, cue.asset), 'utf8');
    assert.ok(cue.renderWindow.endMeasure - cue.renderWindow.startMeasure + 1 >= 2);
    assert.ok(cue.renderWindow.endMeasure - cue.renderWindow.startMeasure + 1 <= 4);
    for (const staff of cue.recommendedStaves) assert.match(svg, new RegExp(`>${staff.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`));
    assert.equal((svg.match(/class="label"/g) ?? []).length, cue.recommendedStaves.length);
    assert.ok(cue.staffConsistency.valid);
  }
});

const notationFixture = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>Horn I</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions><key><fifths>-3</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time><clef><sign>F</sign><line>4</line></clef><transpose><chromatic>-2</chromatic></transpose></attributes><direction><direction-type><dynamics><mf/></dynamics></direction-type></direction><note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><voice>1</voice><beam number="1">begin</beam><tie type="start"/><notations><articulations><staccato/></articulations></notations></note><note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><voice>1</voice><beam number="1">end</beam><notations><articulations><accent/></articulations></notations></note></measure><measure number="2"><note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><voice>1</voice><tie type="stop"/></note></measure></part></score-partwise>`;

test('renderer emits MusicXML clef, written key/meter, beams, ties, and basic expression without applying transpose', () => {
  const rendered = renderSmartScoreSvg(parseScoreParts(notationFixture), ['Horn I'], {startMeasure: 1, endMeasure: 2});
  assert.match(rendered.svg, /class="clef"/);
  assert.match(rendered.svg, /class="key-signature"/);
  assert.match(rendered.svg, /class="time-signature"/);
  assert.match(rendered.svg, /class="beam"/);
  assert.match(rendered.svg, /class="tie"/);
  assert.match(rendered.svg, /class="dynamics"/);
  assert.match(rendered.svg, /class="articulation"/);
  assert.deepEqual(rendered.transposingParts, ['Horn I']);
  const alto = renderSmartScoreSvg(parseScoreParts(notationFixture.replace('<sign>F</sign><line>4</line>', '<sign>C</sign><line>3</line>')), ['Horn I'], {startMeasure: 1, endMeasure: 2});
  assert.match(alto.svg, /𝄡/);
});

test('cue family consistency rejects a dominated label and accepts a visible lead family', () => {
  assert.equal(instrumentFamily('Bassoon 1'), 'WOODWINDS');
  assert.equal(instrumentFamily('Contrabassoon'), 'WOODWINDS');
  assert.equal(validateCueStaffConsistency('WOODWINDS TAKE THE LEAD', ['Flute 1', 'Trombone 1', 'Trombone 2', 'Trombone 3']).valid, false);
  assert.equal(validateCueStaffConsistency('WOODWINDS TAKE THE LEAD', ['Flute 1', 'Oboe 1', 'Clarinet 1', 'Horn 1']).valid, true);
  assert.equal(validateCueStaffConsistency('ORCHESTRA EXPANDS', ['Flute 1', 'Horn 1']).valid, true);
});

test('multi-voice and tuplet notation is detected rather than silently claimed as fully engraved', () => {
  const parsed = parseMeasure('<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>2</voice><time-modification><actual-notes>3</actual-notes></time-modification></note>');
  assert.equal(parsed.unsupported.length, 2);
});

test('repeated generation produces the same manifest and deterministic asset paths without authored cue mappings', () => {
  const first = generateSmartScorePrototype(scorePath, cuesPath, mkdtempSync(join(tmpdir(), 'orchestra-smart-score-')));
  const second = generateSmartScorePrototype(scorePath, cuesPath, mkdtempSync(join(tmpdir(), 'orchestra-smart-score-')));
  assert.deepEqual(first, second);
  assert.ok(first.cues.every(cue => cue.asset === `cue-${cue.cueId}.svg`));
  const source = readFileSync(new URL('../tools/generateSmartScorePrototype.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /m\.30|m\.62|m\.290|m\.407/);
});
