export type HauptstimmeAnnotationSpan = {
  id: string;
  startQstamp: number;
  endQstamp: number | null;
  startMeasure: number;
  endMeasureExclusive: number | null;
  startBeat: number;
  label: string;
  part: string;
  partNumber: number;
  instrument: string;
};

/** Human-authored main-voice evidence, generated from CC BY-SA Hauptstimme annotations. */
export type HauptstimmeEvidenceManifest = {
  source: {project: string; license: string; coordinateMapping: string};
  measureStartQstamps: Record<string, number>;
  spans: HauptstimmeAnnotationSpan[];
};
