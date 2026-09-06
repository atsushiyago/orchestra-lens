import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getHauptstimmeAnnotationsAtMeasure} from '../src/data/hauptstimmeEvidence';
import {getThemeLens} from '../src/data/themeLens';
import {measureAtQstamp, parseHauptstimmeEvidence, parseScorePositions} from '../tools/generateHauptstimmeEvidence';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Hauptstimme parser preserves spans and multiple annotated instruments', () => {
  const evidence = parseHauptstimmeEvidence(fixture('hauptstimme-annotations.csv'), fixture('hauptstimme-positions.csv'));
  assert.equal(evidence.spans.length, 3);
  assert.deepEqual(evidence.spans.filter(span => span.startMeasure === 3).map(span => span.part), ['Vln 1', 'Fl 1']);
  assert.equal(evidence.spans[0].endQstamp, 14);
  assert.equal(evidence.spans[2].endQstamp, null);
});

test('qstamp mapping uses corpus score positions and leaves unannotated measures empty', () => {
  const positions = parseScorePositions(fixture('hauptstimme-positions.csv'));
  assert.equal(measureAtQstamp(13.5, positions), 3);
  assert.equal(measureAtQstamp(14, positions), 4);
  const evidence = parseHauptstimmeEvidence(fixture('hauptstimme-annotations.csv'), fixture('hauptstimme-positions.csv'));
  const activeAtThree = evidence.spans.filter(span => span.startQstamp <= evidence.measureStartQstamps['3'] && (span.endQstamp === null || evidence.measureStartQstamps['3'] < span.endQstamp));
  assert.deepEqual(activeAtThree.map(span => span.instrument), ['Vln', 'Fl']);
  assert.equal(evidence.measureStartQstamps['2'], undefined);
});

test('real Hauptstimme evidence covers the demo measures without changing curated Theme Lens', () => {
  assert.deepEqual(getHauptstimmeAnnotationsAtMeasure(30).map(span => [span.part, span.label]), [['Hn 1', 'e']]);
  assert.deepEqual(getHauptstimmeAnnotationsAtMeasure(62).map(span => [span.part, span.label]), [['Vln 1', 'a']]);
  assert.deepEqual(getHauptstimmeAnnotationsAtMeasure(285).map(span => [span.part, span.label]), [['Fl 1', 'p']]);
  assert.deepEqual(getHauptstimmeAnnotationsAtMeasure(407).map(span => [span.part, span.label]), [['Fl 1', 'q']]);
  assert.equal(getHauptstimmeAnnotationsAtMeasure(1).length, 0);
  assert.equal(getThemeLens(285)?.firstHeard.measure, 30);
  assert.equal(getThemeLens(407)?.firstHeard.measure, 47);
});
