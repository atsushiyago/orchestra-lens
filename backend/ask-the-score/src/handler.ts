import {BedrockRuntimeClient, ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
import {timingSafeEqual} from 'node:crypto';
import {askTheScoreQuestion, type AskTheScoreContext, type AskTheScoreRequest, type AskTheScoreResponse} from './contract';

export const defaultModelId = 'amazon.nova-micro-v1:0';
export const maxOutputTokens = 160;

const groundingInstruction = `You are the explanatory layer for Orchestra Lens.
Use only the supplied score context. Do not invent historical, analytical, or musicological facts.
If the supplied context does not support a claim, omit it or say the information is not available.
Explain the passage for a general classical-music listener. Answer in 2-4 concise sentences.`;

export type BedrockTextModel = {answer(context: AskTheScoreContext): Promise<string>};
export type HttpEvent = {body?: string | null; headers?: Record<string, string | undefined>};
export type HttpResponse = {statusCode: number; headers: Record<string, string>; body: string};

const response = (statusCode: number, body: object): HttpResponse => ({
  statusCode,
  headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
  body: JSON.stringify(body),
});

const asRequest = (event: HttpEvent): AskTheScoreRequest | undefined => {
  try {
    const request = JSON.parse(event.body ?? '') as Partial<AskTheScoreRequest>;
    if (request.question !== askTheScoreQuestion || request.context?.measure !== 62 || !request.context.objectiveFacts || !Array.isArray(request.context.curatedRoles) || !Array.isArray(request.context.hauptstimmeEvidence)) return undefined;
    return request as AskTheScoreRequest;
  } catch { return undefined; }
};

export function limitAnswer(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim().slice(0, 900);
  const sentences = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.slice(0, 4).join('').trim();
}

const tokenFrom = (event: HttpEvent): string | undefined => Object.entries(event.headers ?? {})
  .find(([name]) => name.toLowerCase() === 'x-orchestra-lens-token')?.[1];

const tokenMatches = (provided: string | undefined, expected: string | undefined): boolean => {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided), expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
};

export function createAskTheScoreHandler(model: BedrockTextModel, expectedToken = process.env.ORCHESTRA_LENS_DEMO_TOKEN): (event: HttpEvent) => Promise<HttpResponse> {
  return async event => {
    if (!tokenMatches(tokenFrom(event), expectedToken)) return response(401, {error: 'Unauthorized.'});
    const request = asRequest(event);
    if (!request) return response(400, {error: 'Only the fixed measure-62 Ask the Score request is accepted.'});
    try {
      const answer = limitAnswer(await model.answer(request.context));
      if (!answer) return response(502, {error: 'The model returned no usable explanation.'});
      return response(200, {answer} satisfies AskTheScoreResponse);
    } catch {
      return response(502, {error: 'Ask the Score is temporarily unavailable.'});
    }
  };
}

export function createBedrockModel(options: {region?: string; modelId?: string} = {}): BedrockTextModel {
  const client = new BedrockRuntimeClient({region: options.region ?? process.env.BEDROCK_REGION ?? process.env.AWS_REGION});
  const modelId = options.modelId ?? process.env.BEDROCK_MODEL_ID ?? defaultModelId;
  return {
    async answer(context) {
      const result = await client.send(new ConverseCommand({
        modelId,
        system: [{text: groundingInstruction}],
        messages: [{role: 'user', content: [{text: JSON.stringify({question: askTheScoreQuestion, context})}]}],
        inferenceConfig: {maxTokens: maxOutputTokens, temperature: 0.2},
      }));
      const text = result.output?.message?.content?.find(content => 'text' in content)?.text;
      if (!text) throw new Error('Bedrock response had no text content.');
      return text;
    },
  };
}

/** Lambda entry point. No network call is made until an HTTP request reaches this handler. */
export const handler = createAskTheScoreHandler(createBedrockModel());
