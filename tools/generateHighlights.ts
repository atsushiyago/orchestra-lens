import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {ScoreManifest, ScoreManifestMeasure, ScoreManifestPart} from './generateScoreManifest';
import type {HauptstimmeAnnotationSpan, HauptstimmeEvidenceManifest} from '../src/types/hauptstimme';

export type PerformanceAlignment = {measures: Record<string, {timeSeconds: number}>};

export type HighlightFeature = {
  activeInstrumentCount: number;
  activeInstrumentChange: number;
  enteringInstruments: string[];
  droppingInstruments: string[];
  textureDensity: number;
  densityChange: number;
  dynamicChanges: string[];
  articulationChanges: string[];
  pitchRangeChange: number;
  hauptstimmeStarts: readonly HauptstimmeAnnotationSpan[];
  hauptstimmeInstrumentChanged: boolean;
  hauptstimmeLabelChanged: boolean;
  returningHauptstimmeLabels: string[];
  sparseTexture: boolean;
  suddenFullTexture: boolean;
};

export type HighlightCandidate = {
  rank: number;
  measure: number;
  timeSeconds: number | null;
  score: number;
  activeInstruments: string[];
  hauptstimme: Array<{part: string; instrument: string; label: string; startsHere: boolean}>;
  reasons: string[];
  features: HighlightFeature;
};

export type HighlightConfig = {
  /** Adjacent measures normally describe one transition; retain its strongest representative. */
  minimumSeparationMeasures: number;
  maxCandidates: number;
  weights: {
    activeInstrumentChange: number;
    enteringInstrument: number;
    droppingInstrument: number;
    densityChange: number;
    dynamicChange: number;
    articulationChange: number;
    pitchRangeExpansion: number;
    hauptstimmeStart: number;
    hauptstimmeInstrumentChange: number;
    hauptstimmeLabelChange: number;
    returningHauptstimmeLabel: number;
    sparseTextureContrast: number;
    suddenFullTexture: number;
  };
};

export const defaultHighlightConfig: HighlightConfig = {
  minimumSeparationMeasures: 12,
  maxCandidates: 15,
  weights: {
    activeInstrumentChange: 2,
    enteringInstrument: 2,
    droppingInstrument: 1,
    densityChange: 1,
    dynamicChange: 3,
    articulationChange: 1,
    pitchRangeExpansion: 1,
    hauptstimmeStart: 20,
    hauptstimmeInstrumentChange: 6,
    hauptstimmeLabelChange: 4,
    returningHauptstimmeLabel: 5,
    sparseTextureContrast: 8,
    suddenFullTexture: 10,
  },
};

export type HighlightManifest = {
  work: ScoreManifest['work'];
  detector: {
    version: 1;
    description: string;
    config: HighlightConfig;
    sourceMeasures: number;
  };
  candidates: HighlightCandidate[];
};

const difference = (left: readonly string[], right: readonly string[]) => left.filter(value => !right.includes(value));
const capped = (value: number, maximum: number) => Math.sign(value) * Math.min(Math.abs(value), maximum);

const pitchToMidi = (pitch: string | null): number | null => {
  if (!pitch) return null;
  const match = pitch.match(/^([A-G])([#b]*)(-?\d+)$/);
  if (!match) return null;
  const steps: Record<string, number> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
  const alteration = [...match[2]].reduce((sum, accidental) => sum + (accidental === '#' ? 1 : -1), 0);
  return (Number(match[3]) + 1) * 12 + steps[match[1]] + alteration;
};

const measurePitchRange = (measure: ScoreManifestMeasure): number => {
  const pitches = measure.parts.flatMap(part => [pitchToMidi(part.lowestPitch), pitchToMidi(part.highestPitch)])
    .filter((value): value is number => value !== null);
  return pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0;
};

const marks = (parts: readonly ScoreManifestPart[], property: 'dynamics' | 'articulations'): string[] =>
  [...new Set(parts.flatMap(part => part[property]))].sort();

const annotationsAtMeasure = (evidence: HauptstimmeEvidenceManifest, measure: number): HauptstimmeAnnotationSpan[] => {
  const qstamp = evidence.measureStartQstamps[String(measure)];
  if (qstamp === undefined) return [];
  return evidence.spans.filter(span => span.startQstamp <= qstamp && (span.endQstamp === null || qstamp < span.endQstamp));
};

const quantile = (values: readonly number[], proportion: number): number => {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * proportion)))] ?? 0;
};

function featureForMeasure(
  measureNumber: number,
  measures: readonly number[],
  source: ScoreManifest,
  evidence: HauptstimmeEvidenceManifest,
  seenLabels: ReadonlySet<string>,
  activeCountLowerQuartile: number,
  activeCountUpperQuartile: number,
): HighlightFeature {
  const index = measures.indexOf(measureNumber);
  const current = source.measures[String(measureNumber)]!;
  const previous = index > 0 ? source.measures[String(measures[index - 1])]! : undefined;
  const currentActive = current.activeInstruments;
  const previousActive = previous?.activeInstruments ?? [];
  const currentAnnotations = annotationsAtMeasure(evidence, measureNumber);
  const previousAnnotations = previous ? annotationsAtMeasure(evidence, measures[index - 1]) : [];
  const starts = evidence.spans.filter(span => span.startMeasure === measureNumber);
  const currentParts = new Set(currentAnnotations.map(span => span.part));
  const previousParts = new Set(previousAnnotations.map(span => span.part));
  const currentLabels = new Set(currentAnnotations.map(span => span.label));
  const previousLabels = new Set(previousAnnotations.map(span => span.label));
  const dynamicChanges = difference(marks(current.parts, 'dynamics'), previous ? marks(previous.parts, 'dynamics') : []);
  const articulationChanges = difference(marks(current.parts, 'articulations'), previous ? marks(previous.parts, 'articulations') : []);
  const returningHauptstimmeLabels = starts.map(span => span.label).filter(label => seenLabels.has(label));
  const activeInstrumentCount = currentActive.length;
  const previousActiveCount = previousActive.length;
  return {
    activeInstrumentCount,
    activeInstrumentChange: activeInstrumentCount - previousActiveCount,
    enteringInstruments: difference(currentActive, previousActive),
    droppingInstruments: difference(previousActive, currentActive),
    textureDensity: current.textureDensity,
    densityChange: current.textureDensity - (previous?.textureDensity ?? 0),
    dynamicChanges,
    articulationChanges,
    pitchRangeChange: measurePitchRange(current) - (previous ? measurePitchRange(previous) : 0),
    hauptstimmeStarts: starts,
    hauptstimmeInstrumentChanged: [...currentParts].some(part => !previousParts.has(part)),
    hauptstimmeLabelChanged: [...currentLabels].some(label => !previousLabels.has(label)),
    returningHauptstimmeLabels: [...new Set(returningHauptstimmeLabels)],
    sparseTexture: activeInstrumentCount <= activeCountLowerQuartile && previousActiveCount > activeInstrumentCount,
    suddenFullTexture: activeInstrumentCount >= activeCountUpperQuartile && previousActiveCount < activeCountUpperQuartile,
  };
}

function scoreFeature(feature: HighlightFeature, config: HighlightConfig): {score: number; reasons: string[]} {
  const w = config.weights;
  let score = 0;
  const reasons: string[] = [];
  const activeChange = capped(feature.activeInstrumentChange, 6);
  if (activeChange >= 2) {
    score += activeChange * w.activeInstrumentChange;
    reasons.push(`Active instrumentation changes by ${feature.activeInstrumentChange} parts`);
  } else if (activeChange <= -2) {
    score += activeChange * w.activeInstrumentChange;
    reasons.push(`Active instrumentation decreases by ${Math.abs(feature.activeInstrumentChange)} parts`);
  }
  if (feature.enteringInstruments.length) {
    score += Math.min(feature.enteringInstruments.length, 5) * w.enteringInstrument;
    reasons.push(`${feature.enteringInstruments.length} instrument${feature.enteringInstruments.length === 1 ? '' : 's'} enter`);
  }
  if (feature.droppingInstruments.length >= 2) {
    score += Math.min(feature.droppingInstruments.length, 5) * w.droppingInstrument;
    reasons.push(`${feature.droppingInstruments.length} instruments drop out`);
  }
  const densityChange = capped(feature.densityChange, 20);
  if (densityChange >= 8) {
    score += Math.ceil(densityChange / 4) * w.densityChange;
    reasons.push(`Note-event density increases by ${feature.densityChange}`);
  } else if (densityChange <= -8) {
    score += Math.ceil(Math.abs(densityChange) / 4) * w.densityChange;
    reasons.push(`Note-event density decreases by ${Math.abs(feature.densityChange)}`);
  }
  if (feature.dynamicChanges.length) {
    score += feature.dynamicChanges.length * w.dynamicChange;
    reasons.push(`New written dynamic marking${feature.dynamicChanges.length === 1 ? '' : 's'}: ${feature.dynamicChanges.join(', ')}`);
  }
  if (feature.articulationChanges.length) {
    score += feature.articulationChanges.length * w.articulationChange;
    reasons.push(`New articulation marking${feature.articulationChanges.length === 1 ? '' : 's'}: ${feature.articulationChanges.join(', ')}`);
  }
  if (feature.pitchRangeChange >= 12) {
    score += Math.min(Math.floor(feature.pitchRangeChange / 12), 3) * w.pitchRangeExpansion;
    reasons.push(`Written pitch range expands by ${feature.pitchRangeChange} semitones`);
  }
  for (const span of feature.hauptstimmeStarts) {
    score += w.hauptstimmeStart;
    reasons.push(`New Hauptstimme span begins in ${span.part} (label ${span.label})`);
  }
  if (feature.hauptstimmeInstrumentChanged) {
    score += w.hauptstimmeInstrumentChange;
    reasons.push('Hauptstimme instrument changes');
  }
  if (feature.hauptstimmeLabelChanged) {
    score += w.hauptstimmeLabelChange;
    reasons.push('Hauptstimme label changes');
  }
  if (feature.returningHauptstimmeLabels.length) {
    score += feature.returningHauptstimmeLabels.length * w.returningHauptstimmeLabel;
    reasons.push(`Previously seen Hauptstimme label returns: ${feature.returningHauptstimmeLabels.join(', ')}`);
  }
  if (feature.sparseTexture) {
    score += w.sparseTextureContrast;
    reasons.push('Texture becomes sparse relative to the preceding measure');
  }
  if (feature.suddenFullTexture) {
    score += w.suddenFullTexture;
    reasons.push('Texture reaches the score’s upper orchestration range');
  }
  return {score, reasons};
}

/**
 * Ranks measurable transitions for human review. It deliberately has no access
 * to Orchestra Lens curated cues, roles, or theme relationships.
 */
export function detectHighlights(
  source: ScoreManifest,
  evidence: HauptstimmeEvidenceManifest,
  alignment: PerformanceAlignment,
  partialConfig: Partial<HighlightConfig> = {},
): HighlightManifest {
  const config: HighlightConfig = {...defaultHighlightConfig, ...partialConfig, weights: {...defaultHighlightConfig.weights, ...partialConfig.weights}};
  const measures = Object.keys(source.measures).map(Number).sort((left, right) => left - right);
  const activeCounts = measures.map(measure => source.measures[String(measure)]!.activeInstruments.length);
  const lower = quantile(activeCounts, .25);
  const upper = quantile(activeCounts, .75);
  const seenLabels = new Set<string>();
  const raw: Omit<HighlightCandidate, 'rank'>[] = [];

  for (const measure of measures) {
    const feature = featureForMeasure(measure, measures, source, evidence, seenLabels, lower, upper);
    for (const span of feature.hauptstimmeStarts) seenLabels.add(span.label);
    const {score, reasons} = scoreFeature(feature, config);
    if (!score || !reasons.length) continue;
    const annotations = annotationsAtMeasure(evidence, measure);
    const annotationEvidence = [...annotations, ...feature.hauptstimmeStarts.filter(start => !annotations.some(active => active.id === start.id))];
    raw.push({
      measure,
      timeSeconds: alignment.measures[String(measure)]?.timeSeconds ?? null,
      score,
      activeInstruments: [...source.measures[String(measure)]!.activeInstruments],
      hauptstimme: annotationEvidence.map(span => ({part: span.part, instrument: span.instrument, label: span.label, startsHere: span.startMeasure === measure})),
      reasons,
      features: feature,
    });
  }

  const ordered = raw.sort((left, right) => right.score - left.score || left.measure - right.measure);
  const kept: Omit<HighlightCandidate, 'rank'>[] = [];
  for (const candidate of ordered) {
    const nearby = kept.find(other => Math.abs(other.measure - candidate.measure) < config.minimumSeparationMeasures);
    const distinctHauptstimmeStart = candidate.features.hauptstimmeStarts.length > 0 &&
      nearby?.features.hauptstimmeStarts.length &&
      candidate.features.hauptstimmeStarts.some(span => !nearby.features.hauptstimmeStarts.some(other => other.part === span.part && other.label === span.label));
    if (!nearby || distinctHauptstimmeStart) kept.push(candidate);
  }
  const candidates = kept.map((candidate, index) => ({...candidate, rank: index + 1}));
  return {
    work: source.work,
    detector: {version: 1, description: 'Deterministic, explainable ranking of measurable score transitions for human review.', config, sourceMeasures: measures.length},
    candidates,
  };
}

export const markdownReport = (manifest: HighlightManifest, topCount = manifest.detector.config.maxCandidates): string => {
  const top = manifest.candidates.slice(0, topCount);
  const curated = [30, 62, 285, 407].map(measure => ({measure, rank: manifest.candidates.find(candidate => candidate.measure === measure)?.rank ?? null}));
  const lines = [
    '# Brahms Op. 68, Movement IV — Highlight Detector',
    '',
    'This deterministic offline ranking identifies measurable score transitions for human review. It does not claim musicological importance and does not use Orchestra Lens curated cue points as inputs.',
    '',
    `Source: ${manifest.detector.sourceMeasures} MusicXML measures; Hauptstimme evidence; generated performance alignment timestamps.`,
    '',
    '## Top candidates',
    '',
  ];
  for (const candidate of top) {
    lines.push(`### ${candidate.rank}. m.${candidate.measure} — ${candidate.timeSeconds?.toFixed(3) ?? 'timestamp unavailable'}s — score ${candidate.score}`);
    lines.push(`Active instruments (${candidate.activeInstruments.length}): ${candidate.activeInstruments.join(', ') || 'none'}`);
    lines.push(`Hauptstimme: ${candidate.hauptstimme.length ? candidate.hauptstimme.map(span => `${span.part} (${span.label})${span.startsHere ? ', starts here' : ''}`).join('; ') : 'none'}`);
    for (const reason of candidate.reasons) lines.push(`- ${reason}`);
    lines.push('');
  }
  lines.push('## Existing curated measures (not detector inputs)', '');
  for (const entry of curated) lines.push(`- m.${entry.measure}: ${entry.rank === null ? 'not retained after event deduplication' : `rank ${entry.rank}`}`);
  lines.push('', '## Scoring weights', '');
  for (const [name, value] of Object.entries(manifest.detector.config.weights)) lines.push(`- ${name}: ${value}`);
  return `${lines.join('\n')}\n`;
};

export function generateHighlights(
  manifestPath: string,
  evidencePath: string,
  alignmentPath: string,
  outputPath = 'src/data/generated/brahms-op68-movement4-highlights.json',
  reportPath = 'reports/brahms-op68-movement4-highlights.md',
): HighlightManifest {
  const highlights = detectHighlights(
    JSON.parse(readFileSync(manifestPath, 'utf8')) as ScoreManifest,
    JSON.parse(readFileSync(evidencePath, 'utf8')) as HauptstimmeEvidenceManifest,
    JSON.parse(readFileSync(alignmentPath, 'utf8')) as PerformanceAlignment,
  );
  const destination = resolve(outputPath);
  const reportDestination = resolve(reportPath);
  mkdirSync(dirname(destination), {recursive: true});
  mkdirSync(dirname(reportDestination), {recursive: true});
  writeFileSync(destination, `${JSON.stringify(highlights, null, 2)}\n`);
  writeFileSync(reportDestination, markdownReport(highlights));
  return highlights;
}

function main(): void {
  const [manifestPath, evidencePath, alignmentPath, outputPath, reportPath] = process.argv.slice(2);
  if (!manifestPath || !evidencePath || !alignmentPath) throw new Error('Usage: npm run generate:highlights -- <score-manifest.json> <hauptstimme-evidence.json> <alignment.json> [output.json] [report.md]');
  const highlights = generateHighlights(manifestPath, evidencePath, alignmentPath, outputPath, reportPath);
  process.stdout.write(`Generated ${highlights.candidates.length} deduplicated candidates at ${resolve(outputPath ?? 'src/data/generated/brahms-op68-movement4-highlights.json')}\n`);
}

if (process.argv[1]?.endsWith('generateHighlights.ts')) main();
