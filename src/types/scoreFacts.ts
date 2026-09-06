export type ObjectiveScorePartFact = {
  name: string;
  active: boolean;
  noteCount: number;
  lowestPitch: string | null;
  highestPitch: string | null;
  dynamics: string[];
  articulations: string[];
};

export type ObjectiveMeasureFacts = {
  parts: ObjectiveScorePartFact[];
  activeInstruments: string[];
  textureDensity: number;
};

/** Generated MusicXML facts selected for the Fire TV runtime. */
export type RuntimeScoreFactsManifest = {
  work: {title: string | null; composer: string | null};
  measures: Record<string, ObjectiveMeasureFacts>;
};
