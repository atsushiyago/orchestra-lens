import assert from 'node:assert/strict';
import {test} from 'node:test';
import brahmsSelection from '../src/data/generated/brahms-op68-movement4-tour-selection.json';
import beethovenSelection from '../src/data/generated/beethoven-op67-movement1-tour-selection.json';
import {defaultWork, workById, workCatalog, workSwitchNeedsSourceReload} from '../src/data/workCatalog';

test('Release catalog contains Brahms and Beethoven with their own media and generated selector tours', () => {
  assert.deepEqual(workCatalog.map(work => work.id), ['brahms-op68-4', 'beethoven-op67-1']);
  const brahms = workById('brahms-op68-4');
  const beethoven = workById('beethoven-op67-1');
  assert.match(brahms.media.uri, /brahms-op68-movement4-musopen-cc0\.m4a$/);
  assert.match(beethoven.media.uri, /beethoven-op67-movement1-musopen-pd\.m4a$/);
  assert.deepEqual(brahms.tourCandidates.map(candidate => [candidate.measure, candidate.occurrence, candidate.timeSeconds]), brahmsSelection.selected.map(candidate => [candidate.measure, candidate.occurrence, candidate.timeSeconds]));
  assert.deepEqual(beethoven.tourCandidates.map(candidate => [candidate.measure, candidate.occurrence, candidate.timeSeconds]), beethovenSelection.selected.map(candidate => [candidate.measure, candidate.occurrence, candidate.timeSeconds]));
  assert.equal(brahms.tourCandidates.length, 9);
  assert.equal(beethoven.tourCandidates.length, 6);
});

test('capabilities keep unsupported Beethoven editorial controls out of Release', () => {
  const brahms = workById('brahms-op68-4');
  const beethoven = workById('beethoven-op67-1');
  assert.equal(brahms.capabilities.smartScore, true);
  assert.equal(brahms.capabilities.askTheScore, true);
  assert.deepEqual(beethoven.capabilities, {fullMovement: true, highlightsTour: true, smartScore: false, orchestraXRay: false, askTheScore: false, themeLens: false});
});

test('switching catalog works requires the new media URI and does not retain the prior source', () => {
  const brahms = workById('brahms-op68-4');
  const beethoven = workById('beethoven-op67-1');
  assert.equal(workSwitchNeedsSourceReload(brahms, beethoven), true);
  assert.equal(workSwitchNeedsSourceReload(beethoven, brahms), true);
  assert.equal(workSwitchNeedsSourceReload(defaultWork, brahms), false);
});
