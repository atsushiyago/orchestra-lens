import {askTheScoreQuestion, type AskTheScoreContext, type AskTheScoreRequest, type AskTheScoreResponse} from '../shared/askTheScore';
import {work} from './data/brahms1Movement4';
import {getHauptstimmeAnnotationsAtMeasure} from './data/hauptstimmeEvidence';
import type {OrchestraLensRuntimeCue} from './data/runtimeCue';

export type AskTheScoreStatus =
  | {kind: 'idle'}
  | {kind: 'loading'}
  | {kind: 'success'; answer: string}
  | {kind: 'error'; message: string};

export type FetchLike = (input: string, init: {method: string; headers: Record<string, string>; body: string}) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;
export type AskTheScoreClient = (cue: OrchestraLensRuntimeCue) => Promise<string>;

export function buildAskTheScoreRequest(cue: OrchestraLensRuntimeCue): AskTheScoreRequest {
  if (cue.measure !== 62 || !cue.objectiveFacts) throw new Error('Ask the Score is currently available only for measure 62.');
  return {
    question: askTheScoreQuestion,
    context: {
      work: {composer: work.composer, title: work.title, movement: work.movement},
      measure: cue.measure,
      objectiveFacts: cue.objectiveFacts,
      hauptstimmeEvidence: getHauptstimmeAnnotationsAtMeasure(cue.measure).map(span => ({
        part: span.part, instrument: span.instrument, label: span.label, startMeasure: span.startMeasure,
      })),
      curatedRoles: cue.smartScoreParts.flatMap(part => part.curatedRole ? [{
        instrument: part.curatedRole.instrument, role: part.curatedRole.role, emphasis: part.curatedRole.emphasis,
      }] : []),
    },
  };
}

export function createAskTheScoreClient(endpoint: string | undefined, token: string | undefined, request: FetchLike): AskTheScoreClient {
  return async cue => {
    if (!endpoint?.startsWith('https://') || !token) throw new Error('Ask the Score is not configured for this build.');
    const response = await request(endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Orchestra-Lens-Token': token}, body: JSON.stringify(buildAskTheScoreRequest(cue)),
    });
    const payload = await response.json() as Partial<AskTheScoreResponse>;
    if (!response.ok || typeof payload.answer !== 'string' || !payload.answer.trim()) throw new Error('Ask the Score could not return an explanation.');
    return payload.answer;
  };
}

export async function requestAskTheScore(cue: OrchestraLensRuntimeCue, client: AskTheScoreClient): Promise<AskTheScoreStatus> {
  try {
    return {kind: 'success', answer: await client(cue)};
  } catch {
    return {kind: 'error', message: 'Unable to reach Ask the Score. Please try again later.'};
  }
}
