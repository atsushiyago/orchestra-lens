/** Backend-local copy of the explicit public request contract. */
export const askTheScoreQuestion = 'What am I hearing here?';

export type AskTheScoreContext = {
  work: {composer: string; title: string; movement: string};
  measure: number;
  objectiveFacts: {
    activeInstruments: string[];
    textureDensity: number;
    parts: {name: string; active: boolean; noteCount: number; lowestPitch: string | null; highestPitch: string | null; dynamics: string[]; articulations: string[]}[];
  };
  hauptstimmeEvidence: {part: string; instrument: string; label: string; startMeasure: number}[];
  curatedRoles: {instrument: string; role: string; emphasis: string}[];
};

export type AskTheScoreRequest = {question: typeof askTheScoreQuestion; context: AskTheScoreContext};
export type AskTheScoreResponse = {answer: string};
