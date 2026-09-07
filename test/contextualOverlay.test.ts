import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {scoreEvents} from '../src/data/brahms1Movement4';
import {workById} from '../src/data/workCatalog';
import {selectScoreEvent} from '../src/hooks/scoreSynchronization';
import {contextualOverlayFor} from '../src/playback/contextualOverlay';

const brahms = workById('brahms-op68-4');
const beethoven = workById('beethoven-op67-1');
const overlayAt = (time: number) => contextualOverlayFor(brahms.capabilities, selectScoreEvent(brahms.scoreEvents, time));

test('Full Movement has no global SCORE transport action', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const transport = app.slice(app.indexOf('<View style={styles.transport}>'), app.indexOf('</View>', app.indexOf('<View style={styles.transport}>')));
  assert.doesNotMatch(transport, /label="SCORE"/);
});

test('Brahms synchronized cue entry and seeking show prepared contextual score content, while gaps hide it', () => {
  const m30 = scoreEvents.find(event => event.measure === 30)!;
  const m62 = scoreEvents.find(event => event.measure === 62)!;
  assert.equal(overlayAt(m30.startTime)?.cue.measure, 30);
  assert.equal(overlayAt(m30.startTime + 14.999)?.cue.measure, 30);
  assert.equal(overlayAt(m30.endTime!), undefined);
  assert.equal(overlayAt(m62.startTime)?.cue.measure, 62);
  // A backward seek returns directly to the matching existing cue.
  assert.equal(overlayAt(m30.startTime + 1)?.cue.measure, 30);
});

test('Theme Lens and Ask the Score appear only where existing curated/backend context supports them', () => {
  const m62 = scoreEvents.find(event => event.measure === 62)!;
  const m290 = scoreEvents.find(event => event.measure === 290)!;
  const m407 = scoreEvents.find(event => event.measure === 407)!;
  assert.equal(overlayAt(m62.startTime)?.hasThemeLens, false);
  assert.equal(overlayAt(m62.startTime)?.canAskTheScore, true);
  assert.equal(overlayAt(m290.startTime)?.hasThemeLens, true);
  assert.equal(overlayAt(m290.startTime)?.canAskTheScore, false);
  assert.equal(overlayAt(m407.startTime)?.hasThemeLens, true);
});

test('Beethoven has no unsupported contextual overlay or Ask the Score control', () => {
  assert.equal(contextualOverlayFor(beethoven.capabilities, {startTime: 1, endTime: 10, measure: 62, title: 'Generated cue'}), undefined);
  assert.equal(beethoven.capabilities.askTheScore, false);
  assert.equal(beethoven.capabilities.smartScore, false);
});
