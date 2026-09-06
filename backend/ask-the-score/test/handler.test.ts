import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildAskTheScoreRequest} from '../../../src/askTheScore';
import {getRuntimeCue} from '../../../src/data/runtimeCue';
import {createAskTheScoreHandler, limitAnswer, type BedrockTextModel} from '../src/handler';

const token = 'a-demo-test-token-with-at-least-32-characters';
const eventForMeasure62 = () => ({body: JSON.stringify(buildAskTheScoreRequest(getRuntimeCue(62)!)), headers: {'X-Orchestra-Lens-Token': token}});

test('Bedrock is never called until a valid explicit Ask the Score request reaches the handler', async () => {
  let calls = 0;
  const model: BedrockTextModel = {answer: async context => { calls += 1; assert.equal(context.measure, 62); return 'The violins carry the main theme. Horns and lower strings support it.'; }};
  const handler = createAskTheScoreHandler(model, token);
  assert.equal(calls, 0);
  const rejected = await handler({body: JSON.stringify({question: 'Anything else?', context: {measure: 30}}), headers: {'X-Orchestra-Lens-Token': token}});
  assert.equal(rejected.statusCode, 400);
  assert.equal(calls, 0);
  const accepted = await handler(eventForMeasure62());
  assert.equal(accepted.statusCode, 200);
  assert.equal(calls, 1);
});

test('backend caps a model answer at four sentences and handles Bedrock errors safely', async () => {
  const longAnswer = `${'A'.repeat(950)}. Two. Three. Four. Five.`;
  assert.ok(limitAnswer(longAnswer).length <= 900);
  assert.ok((limitAnswer(longAnswer).match(/[.!?]/g) ?? []).length <= 4);
  const failed = createAskTheScoreHandler({answer: async () => { throw new Error('mock failure'); }}, token);
  const response = await failed(eventForMeasure62());
  assert.equal(response.statusCode, 502);
  assert.deepEqual(JSON.parse(response.body), {error: 'Ask the Score is temporarily unavailable.'});
});

test('missing or incorrect demo token returns 401 before Bedrock', async () => {
  let calls = 0;
  const handler = createAskTheScoreHandler({answer: async () => { calls += 1; return 'Never called.'; }}, token);
  for (const headers of [{}, {'X-Orchestra-Lens-Token': 'wrong-token'}]) {
    const response = await handler({...eventForMeasure62(), headers});
    assert.equal(response.statusCode, 401);
  }
  assert.equal(calls, 0);
});
