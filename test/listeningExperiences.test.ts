import assert from 'node:assert/strict';
import {test} from 'node:test';
import generatedSelection from '../src/data/generated/brahms-op68-movement4-tour-selection.json';
import {listeningExperiences, highlightsTourSummary, showDevelopmentControls} from '../src/data/listeningExperiences';
import {highlightsTourCandidates, highlightsTourConfig, hasPlayedExcerpt, mayBeginExcerpt, transitionSteps} from '../src/hooks/useHighlightsTour';

test('Release entry offers normal listening and the generated Highlights Tour', () => {
  assert.deepEqual(listeningExperiences.map(experience => experience.label), ['PLAY FULL MOVEMENT', 'HIGHLIGHTS TOUR']);
  assert.equal(highlightsTourSummary(highlightsTourCandidates.length), `${highlightsTourCandidates.length} recommended moments · about 3 minutes`);
});

test('Release tour count and moments are driven by the generated Brahms selector artifact', () => {
  assert.equal(highlightsTourCandidates.length, generatedSelection.selected.length);
  assert.equal(highlightsTourSummary(), `${generatedSelection.selected.length} recommended moments · about 3 minutes`);
  assert.deepEqual(highlightsTourCandidates.map(candidate => candidate.measure), generatedSelection.selected.map(moment => moment.measure));
});

test('Release tour retains the proven no-fade media-time coordinator', () => {
  assert.deepEqual(transitionSteps, ['seeking', 'waiting-to-play', 'stabilizing', 'playing']);
  assert.equal('fadeOutMilliseconds' in highlightsTourConfig, false);
  assert.equal(mayBeginExcerpt(true), true);
  assert.equal(hasPlayedExcerpt(400, 419.99, 20), false);
  assert.equal(hasPlayedExcerpt(400, 420, 20), true);
});

test('development controls are absent from Release', () => {
  assert.equal(showDevelopmentControls(false), false);
  assert.equal(showDevelopmentControls(true), true);
});
