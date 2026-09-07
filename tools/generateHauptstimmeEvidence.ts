import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {HauptstimmeAnnotationSpan, HauptstimmeEvidenceManifest} from '../src/types/hauptstimme';

export type ScorePosition = {qstamp: number; measure: number; beat: number};

const csvRows = (csv: string): Record<string, string>[] => {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  if (!header) return [];
  const columns = header.split(',');
  return lines.filter(Boolean).map(line => Object.fromEntries(columns.map((column, index) => [column, line.split(',')[index] ?? ''])));
};

export function parseScorePositions(csv: string): ScorePosition[] {
  return csvRows(csv).map(row => ({qstamp: Number(row.qstamp), measure: Number(row.measure), beat: Number(row.beat)}))
    .filter(position => Number.isFinite(position.qstamp) && Number.isInteger(position.measure) && Number.isFinite(position.beat))
    .sort((left, right) => left.qstamp - right.qstamp);
}

/** Maps an arbitrary qstamp to the most recent score position at or before it. */
export function measureAtQstamp(qstamp: number, positions: readonly ScorePosition[]): number | undefined {
  let measure: number | undefined;
  for (const position of positions) {
    if (position.qstamp > qstamp) break;
    measure = position.measure;
  }
  return measure;
}

export function parseHauptstimmeEvidence(
  annotationsCsv: string,
  positionsCsv: string,
): HauptstimmeEvidenceManifest {
  const positions = parseScorePositions(positionsCsv);
  const annotationRows = csvRows(annotationsCsv).map((row, index) => ({
    id: String(index + 1),
    qstamp: Number(row.qstamp),
    measure: Number(row.measure),
    beat: Number(row.beat),
    label: row.label,
    part: row.part,
    partNumber: Number(row.part_num),
    instrument: row.instrument,
  })).filter(row => Number.isFinite(row.qstamp) && Number.isInteger(row.measure) && Number.isFinite(row.beat));

  // Position CSVs describe the rendered score stream.  In scores with written
  // repeats they can reset their displayed `measure` column while qstamp keeps
  // advancing, and sparse rests can omit an exact barline altogether.  The
  // Hauptstimme CSV's own measure field is therefore the authoritative
  // *continuous score-measure* identifier for a measure-level application.
  // Keep the raw qstamps for traceability, but do not reject valid repeat-
  // expanded annotations by comparing them to the display-oriented CSV label.

  const spans: HauptstimmeAnnotationSpan[] = annotationRows.map((row, index) => {
    const next = annotationRows.slice(index + 1).find(candidate => candidate.qstamp > row.qstamp);
    return {
      id: row.id,
      startQstamp: row.qstamp,
      endQstamp: next?.qstamp ?? null,
      startMeasure: row.measure,
      endMeasureExclusive: next?.measure ?? null,
      startBeat: row.beat,
      label: row.label,
      part: row.part,
      partNumber: row.partNumber,
      instrument: row.instrument,
    };
  });

  const measureStartQstamps: Record<string, number> = {};
  for (const position of positions) {
    const key = String(position.measure);
    measureStartQstamps[key] = Math.min(measureStartQstamps[key] ?? Infinity, position.qstamp);
  }
  return {
    source: {
      project: 'Hauptstimme / OpenScore Orchestra',
      license: 'CC BY-SA (as stated by the upstream Hauptstimme repository)',
      coordinateMapping: 'Annotation qstamps are retained from the corpus. Annotation-declared continuous measures are canonical for measure-level lookup because score-position CSVs may be sparse at rests and reset displayed measure numbers through written repeats.',
    },
    measureStartQstamps,
    spans,
  };
}

export function generateHauptstimmeEvidence(
  annotationsPath: string,
  positionsPath: string,
  outputPath = 'src/data/generated/hauptstimmeEvidence.json',
): HauptstimmeEvidenceManifest {
  const evidence = parseHauptstimmeEvidence(readFileSync(annotationsPath, 'utf8'), readFileSync(positionsPath, 'utf8'));
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), {recursive: true});
  writeFileSync(destination, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

function main(): void {
  const [annotationsPath, positionsPath, outputPath] = process.argv.slice(2);
  if (!annotationsPath || !positionsPath) throw new Error('Usage: npm run generate:hauptstimme-evidence -- <annotations.csv> <score-positions.csv> [output.json]');
  const evidence = generateHauptstimmeEvidence(annotationsPath, positionsPath, outputPath);
  process.stdout.write(`Generated ${evidence.spans.length} Hauptstimme annotation spans at ${resolve(outputPath ?? 'src/data/generated/hauptstimmeEvidence.json')}\n`);
}

if (process.argv[1]?.endsWith('generateHauptstimmeEvidence.ts')) main();
