import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAskTheScoreRequest, createAskTheScoreClient, requestAskTheScore} from '../src/askTheScore';
import {getRuntimeCue} from '../src/data/runtimeCue';
import {getThemeLens} from '../src/data/themeLens';
import {askTheScoreQuestion} from '../shared/askTheScore';

test('Ask the Score sends only the structured measure-62 context after an explicit ask action', async () => {
  const cue = getRuntimeCue(62);
  assert.ok(cue);
  const request = buildAskTheScoreRequest(cue);
  assert.equal(request.question, askTheScoreQuestion);
  assert.deepEqual(request.context.work, {composer: 'BRAHMS', title: 'SYMPHONY NO. 1', movement: 'IV. Adagio – Allegro non troppo'});
  assert.equal(request.context.measure, 62);
  assert.deepEqual(request.context.hauptstimmeEvidence, [{part: 'Vln 1', instrument: 'Vln', label: 'a', startMeasure: 62}]);
  assert.deepEqual(request.context.curatedRoles.map(role => role.role), ['Main Theme', 'Harmonic Foundation', 'Orchestral Support']);
  assert.equal(request.context.objectiveFacts.textureDensity, 7);

  let calls = 0;
  let requestBody = '';
  const client = createAskTheScoreClient('https://api.example.test/ask-the-score', 'demo-test-token', async (_url, init) => {
    calls += 1; requestBody = init.body;
    return {ok: true, status: 200, json: async () => ({answer: 'The violins carry the main idea while horns and lower strings support it.'})};
  });
  assert.equal(calls, 0);
  await client(cue);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(requestBody).question, askTheScoreQuestion);
  assert.deepEqual(JSON.parse(requestBody), request);
});

test('Ask the Score rejects unsupported cues and leaves curated Theme Lens relationships unchanged', () => {
  assert.throws(() => buildAskTheScoreRequest(getRuntimeCue(30)!), /measure 62/);
  assert.equal(getThemeLens(285)?.firstHeard.measure, 30);
  assert.equal(getThemeLens(407)?.firstHeard.measure, 47);
});

test('backend/client failures resolve to a TV-safe error state', async () => {
  const status = await requestAskTheScore(getRuntimeCue(62)!, async () => { throw new Error('network failure'); });
  assert.deepEqual(status, {kind: 'error', message: 'Unable to reach Ask the Score. Please try again later.'});
});
