export const askTheScoreQuestion = 'What am I hearing here?';

export type AskTheScorePartFacts = {
  name: string;
  active: boolean;
  noteCount: number;
  lowestPitch: string | null;
  highestPitch: string | null;
  dynamics: string[];
  articulations: string[];
};

export type AskTheScoreContext = {
  work: {composer: string; title: string; movement: string};
  measure: number;
  objectiveFacts: {activeInstruments: string[]; textureDensity: number; parts: AskTheScorePartFacts[]};
  hauptstimmeEvidence: {part: string; instrument: string; label: string; startMeasure: number}[];
  curatedRoles: {instrument: string; role: string; emphasis: string}[];
};

export type AskTheScoreRequest = {question: typeof askTheScoreQuestion; context: AskTheScoreContext};
export type AskTheScoreResponse = {answer: string};
