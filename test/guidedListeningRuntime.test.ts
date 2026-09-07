import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {activeGuidedListeningCue, brahmsGuidedListeningCues, guidedListeningCuesFor} from '../src/data/guidedListening';
import {workById} from '../src/data/workCatalog';
import sourceCues from '../src/data/generated/brahms-op68-movement4-listening-cues.json';

const brahms = workById('brahms-op68-4');
const beethoven = workById('beethoven-op67-1');

test('Guided Listening runtime manifest contains all generated Brahms cards and their static assets', () => {
  assert.equal(brahmsGuidedListeningCues.length, 26);
  assert.equal(guidedListeningCuesFor(brahms).length, 26);
  assert.ok(brahmsGuidedListeningCues.every(cue => cue.startTime < cue.endTime && cue.scoreAssetKey === cue.id));
  assert.ok(brahmsGuidedListeningCues.every(cue => cue.mainVoice?.evidence === 'hauptstimme' || cue.mainVoice === undefined));
});

test('the scheduler is a pure media-clock consumer and recalculates cards across cue boundaries', () => {
  const cue = brahmsGuidedListeningCues.find(item => item.measure === 62)!;
  assert.equal(activeGuidedListeningCue(brahmsGuidedListeningCues, cue.startTime)?.id, cue.id);
  assert.equal(activeGuidedListeningCue(brahmsGuidedListeningCues, cue.endTime), undefined);
  assert.equal(activeGuidedListeningCue(brahmsGuidedListeningCues, cue.startTime - .01), undefined);
  assert.equal(activeGuidedListeningCue(brahmsGuidedListeningCues, cue.startTime + 1)?.id, cue.id);
});

test('runtime cue windows derive from the generated Listening Cue regions without a second timing list', () => {
  assert.deepEqual(
    brahmsGuidedListeningCues.map(cue => [cue.id, cue.startTime, cue.endTime]),
    sourceCues.cues.map(cue => [cue.id, cue.region.startSec, cue.region.endSec]),
  );
});

test('Guided Listening state clears when leaving Brahms or switching to unsupported Beethoven', () => {
  assert.deepEqual(guidedListeningCuesFor(beethoven), []);
  assert.equal(beethoven.capabilities.guidedListening, false);
  assert.equal(activeGuidedListeningCue(guidedListeningCuesFor(beethoven), 62), undefined);
});

test('the overlay has no playback or media-source ownership and old automatic overlay wiring is absent', () => {
  const overlay = readFileSync(new URL('../src/components/GuidedListeningCardOverlay.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(overlay, /usePlayback|VideoPlayer|\.play\(|\.pause\(|\.seek\(|\.load\(|\.src\s*=/);
  assert.doesNotMatch(app, /contextualOverlayFor/);
  assert.match(app, /activeGuidedListeningCue/);
});

test('Ask the Score remains an explicit control only for the supported m.62 card', () => {
  const overlay = readFileSync(new URL('../src/components/GuidedListeningCardOverlay.tsx', import.meta.url), 'utf8');
  const m62 = brahmsGuidedListeningCues.find(cue => cue.measure === 62)!;
  const m30 = brahmsGuidedListeningCues.find(cue => cue.measure === 30)!;
  assert.equal(m62.measure === 62 && brahms.capabilities.askTheScore, true);
  assert.equal(m30.measure === 62 && brahms.capabilities.askTheScore, false);
  assert.match(overlay, /onPress=\{\(\) => void ask\(askCue\)\}/);
  assert.doesNotMatch(overlay, /useEffect/);
});
