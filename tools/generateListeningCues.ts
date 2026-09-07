import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {ScoreManifest, ScoreManifestMeasure, ScoreManifestPart} from './generateScoreManifest';
import type {PerformanceAlignment, HighlightManifest} from './generateHighlights';
import type {HauptstimmeAnnotationSpan, HauptstimmeEvidenceManifest} from '../src/types/hauptstimme';

export type ListeningCueConfig = {
  maxCues: number;
  minimumTimeSeparationSeconds: number;
  regionSeconds: number;
  minimumStrength: number;
};

/** Shared, work-agnostic settings for full-movement score-awareness. */
export const defaultListeningCueConfig: ListeningCueConfig = {
  maxCues: 26,
  minimumTimeSeparationSeconds: 24,
  regionSeconds: 14,
  minimumStrength: 3,
};

export type ListeningCueReason = {kind: string; text: string; strength: number};
export type InstrumentFamily = 'STRINGS' | 'WOODWINDS' | 'BRASS' | 'PERCUSSION' | 'OTHER';
export type CueStaffConsistency = {
  valid: boolean;
  labelFamily: InstrumentFamily | null;
  selectedFamilyCounts: Partial<Record<InstrumentFamily, number>>;
  message: string;
};
export type ListeningCue = {
  id: string;
  measure: number;
  occurrence: number;
  timestampSec: number;
  region: {startSec: number; endSec: number};
  label: string;
  strength: number;
  reasons: ListeningCueReason[];
  activeInstruments: string[];
  hauptstimme: Array<{part: string; instrument: string; label: string; startsHere: boolean}>;
  recommendedStaves: string[];
  staffConsistency: CueStaffConsistency;
};

export type ListeningCueManifest = {
  work: ScoreManifest['work'];
  generator: {version: 1; description: string; config: ListeningCueConfig; sourceMeasures: number};
  cues: ListeningCue[];
};

type Timing = {timeSeconds: number; occurrence: number};

const timingFor = (alignment: PerformanceAlignment, measure: number): Timing | undefined => {
  const occurrence = alignment.occurrences?.find(item => item.measure === measure && item.occurrence === 1);
  if (occurrence) return {timeSeconds: occurrence.timeSeconds, occurrence: occurrence.occurrence};
  const timeSeconds = alignment.measures?.[String(measure)]?.timeSeconds;
  return typeof timeSeconds === 'number' && Number.isFinite(timeSeconds) ? {timeSeconds, occurrence: 1} : undefined;
};

const active = (measure: ScoreManifestMeasure): ScoreManifestPart[] => measure.parts.filter(part => part.active);
const difference = (left: readonly string[], right: readonly string[]) => left.filter(item => !right.includes(item));
const unique = (items: readonly string[]) => [...new Set(items)];
const annotationsAt = (evidence: HauptstimmeEvidenceManifest, measure: number): HauptstimmeAnnotationSpan[] =>
  evidence.spans.filter(span => span.startMeasure <= measure && (span.endMeasureExclusive === null || measure < span.endMeasureExclusive));
const startsAt = (evidence: HauptstimmeEvidenceManifest, measure: number): HauptstimmeAnnotationSpan[] =>
  evidence.spans.filter(span => span.startMeasure === measure);

export const instrumentFamily = (name: string): InstrumentFamily => {
  // "bassoon" is a woodwind; match a bass string only as a distinct token.
  if (/violin|viola|cello|contrabass(?!oon)|\bbass\b|vln|vla|vc|cb/i.test(name)) return 'STRINGS';
  if (/flute|oboe|clarinet|bassoon|piccolo|\bfl\b|\bob\b|\bcl\b|bsn/i.test(name)) return 'WOODWINDS';
  if (/horn|trumpet|trombone|tuba|\bhn\b|tpt|tbn/i.test(name)) return 'BRASS';
  if (/timpani|percussion/i.test(name)) return 'PERCUSSION';
  return 'OTHER';
};
const labelFamily = (label: string): InstrumentFamily | null => {
  if (/^STRINGS\b/.test(label)) return 'STRINGS';
  if (/^WOODWINDS\b/.test(label)) return 'WOODWINDS';
  if (/^BRASS\b/.test(label)) return 'BRASS';
  if (/^PERCUSSION\b/.test(label)) return 'PERCUSSION';
  return null;
};
const displayName = (name: string): string => name.replace(/\bBb\b/g, 'B♭').toUpperCase();

const pitchToMidi = (pitch: string | null): number | undefined => {
  const match = pitch?.match(/^([A-G])([#b]*)(-?\d+)$/);
  if (!match) return undefined;
  const step: Record<string, number> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
  return (Number(match[3]) + 1) * 12 + step[match[1]] + [...match[2]].reduce((sum, accidental) => sum + (accidental === '#' ? 1 : -1), 0);
};
const range = (measure: ScoreManifestMeasure): number => {
  const notes = measure.parts.flatMap(part => [pitchToMidi(part.lowestPitch), pitchToMidi(part.highestPitch)]).filter((item): item is number => item !== undefined);
  return notes.length ? Math.max(...notes) - Math.min(...notes) : 0;
};

const normalizedInstrument = (name: string): string => name.toLowerCase().replace(/violin/g, 'vln').replace(/viola/g, 'vla').replace(/violoncello|cello/g, 'vc').replace(/contrabass/g, 'cb').replace(/flute/g, 'fl').replace(/oboe/g, 'ob').replace(/clarinet/g, 'cl').replace(/bassoon/g, 'bsn').replace(/horn/g, 'hn').replace(/trumpet/g, 'tpt').replace(/trombone/g, 'tbn').replace(/[^a-z0-9]/g, '');
const matchingPart = (parts: readonly ScoreManifestPart[], annotation: HauptstimmeAnnotationSpan): ScoreManifestPart | undefined => {
  const annotationNames = [annotation.part, annotation.instrument].map(normalizedInstrument);
  return parts.find(part => annotationNames.some(name => name && (normalizedInstrument(part.name).includes(name) || name.includes(normalizedInstrument(part.name)))));
};

const recommendedStaves = (current: ScoreManifestMeasure, entering: readonly string[], annotations: readonly HauptstimmeAnnotationSpan[], preferredFamily: InstrumentFamily | null): string[] => {
  const currentActive = active(current);
  const chosen: string[] = [];
  const choose = (part: ScoreManifestPart | undefined) => { if (part?.active && !chosen.includes(part.name) && chosen.length < 4) chosen.push(part.name); };
  const ordered = (parts: readonly ScoreManifestPart[]) => [...parts].sort((left, right) => right.noteCount - left.noteCount || left.name.localeCompare(right.name));
  const chooseMatchingAnnotations = (parts: readonly ScoreManifestPart[]) => {
    for (const annotation of annotations) {
      const part = matchingPart(parts, annotation);
      if (part) choose(part);
    }
  };
  // A family-specific label is a promise to the listener. Fill its visible
  // score with that family before adding any optional foundation or contrast.
  if (preferredFamily) {
    const preferred = currentActive.filter(part => instrumentFamily(part.name) === preferredFamily);
    chooseMatchingAnnotations(preferred);
    for (const name of entering) choose(preferred.find(part => part.name === name));
    for (const part of ordered(preferred)) choose(part);
  } else {
    chooseMatchingAnnotations(currentActive);
    for (const name of entering) choose(currentActive.find(part => part.name === name));
  }
  // A compact score may use one low foundation only after the advertised voice
  // has been established. It can never displace the lead family.
  if (chosen.length < 3) choose(ordered(currentActive.filter(part => /cello|contrabass(?!oon)|\bbass\b/i.test(part.name)))[0]);
  for (const part of ordered(currentActive)) choose(part);
  return chosen.slice(0, 4);
};

export const validateCueStaffConsistency = (label: string, staves: readonly string[]): CueStaffConsistency => {
  const expected = labelFamily(label);
  const selectedFamilyCounts = staves.reduce<Partial<Record<InstrumentFamily, number>>>((counts, staff) => {
    const key = instrumentFamily(staff);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  if (!expected) return {valid: true, labelFamily: null, selectedFamilyCounts, message: 'Neutral label: no family claim to validate.'};
  const matching = selectedFamilyCounts[expected] ?? 0;
  const required = Math.min(staves.length, Math.max(1, Math.ceil(staves.length / 2)));
  const valid = matching >= required;
  return {
    valid,
    labelFamily: expected,
    selectedFamilyCounts,
    message: valid
      ? `${expected} provides ${matching}/${staves.length} displayed staves.`
      : `${expected} label conflicts with ${matching}/${staves.length} displayed staves.`,
  };
};

const labelFor = (starts: readonly HauptstimmeAnnotationSpan[], entering: readonly string[], densityChange: number, activeChange: number, dynamicsChanged: boolean, rangeChange: number): string => {
  if (starts.length) return `${instrumentFamily(starts[0]!.instrument)} TAKE THE LEAD`;
  if (entering.length) return `${instrumentFamily(entering[0]!)} ENTERS`;
  if (activeChange >= 4 || densityChange >= 10) return 'FULL ORCHESTRA BUILDS';
  if (activeChange <= -4 || densityChange <= -10) return 'TEXTURE THINS';
  if (dynamicsChanged) return 'DYNAMICS SHIFT';
  if (rangeChange >= 12) return 'RANGE EXPANDS';
  return 'ORCHESTRATION SHIFTS';
};

function candidateFor(
  measureNumber: number,
  previous: ScoreManifestMeasure | undefined,
  current: ScoreManifestMeasure,
  evidence: HauptstimmeEvidenceManifest,
  alignment: PerformanceAlignment,
  detectorMeasures: ReadonlySet<number>,
  config: ListeningCueConfig,
): ListeningCue | undefined {
  const timing = timingFor(alignment, measureNumber);
  if (!timing) return undefined;
  const currentActive = active(current);
  const previousActive = previous ? active(previous) : [];
  const entering = difference(currentActive.map(part => part.name), previousActive.map(part => part.name));
  const dropping = difference(previousActive.map(part => part.name), currentActive.map(part => part.name));
  const densityChange = current.textureDensity - (previous?.textureDensity ?? 0);
  const activeChange = currentActive.length - previousActive.length;
  const rangeChange = range(current) - (previous ? range(previous) : 0);
  const dynamics = unique(currentActive.flatMap(part => part.dynamics));
  const priorDynamics = unique(previousActive.flatMap(part => part.dynamics));
  const newDynamics = difference(dynamics, priorDynamics);
  const articulations = unique(currentActive.flatMap(part => part.articulations));
  const priorArticulations = unique(previousActive.flatMap(part => part.articulations));
  const newArticulations = difference(articulations, priorArticulations);
  const starts = startsAt(evidence, measureNumber);
  const annotations = annotationsAt(evidence, measureNumber);
  const reasons: ListeningCueReason[] = [];
  if (starts.length) reasons.push({kind: 'hauptstimme-start', text: `Hauptstimme begins in ${starts.map(span => span.part).join(', ')}`, strength: 8 + starts.length * 2});
  if (entering.length) reasons.push({kind: 'instrument-entry', text: `${entering.length} instrument${entering.length === 1 ? '' : 's'} enter: ${entering.slice(0, 4).map(displayName).join(', ')}`, strength: Math.min(6, entering.length)});
  if (dropping.length >= 2) reasons.push({kind: 'instrument-dropout', text: `${dropping.length} instruments drop out`, strength: Math.min(5, dropping.length)});
  if (Math.abs(densityChange) >= 8) reasons.push({kind: 'texture-change', text: `Note density ${densityChange > 0 ? 'increases' : 'decreases'} by ${Math.abs(densityChange)}`, strength: Math.min(5, Math.ceil(Math.abs(densityChange) / 4))});
  if (Math.abs(activeChange) >= 3) reasons.push({kind: 'orchestration-change', text: `Active instrumentation ${activeChange > 0 ? 'grows' : 'contracts'} by ${Math.abs(activeChange)} parts`, strength: Math.min(5, Math.abs(activeChange))});
  if (newDynamics.length) reasons.push({kind: 'dynamic-change', text: `New written dynamic: ${newDynamics.join(', ')}`, strength: 3});
  if (newArticulations.length) reasons.push({kind: 'articulation-change', text: `New articulation: ${newArticulations.join(', ')}`, strength: 2});
  if (Math.abs(rangeChange) >= 12) reasons.push({kind: 'pitch-range-change', text: `Written pitch range ${rangeChange > 0 ? 'expands' : 'contracts'} by ${Math.abs(rangeChange)} semitones`, strength: 2});
  if (detectorMeasures.has(measureNumber)) reasons.push({kind: 'highlight-region', text: 'Begins a Highlight Detector candidate region', strength: 3});
  const strength = reasons.reduce((sum, reason) => sum + reason.strength, 0);
  if (strength < config.minimumStrength) return undefined;
  let label = labelFor(starts, entering, densityChange, activeChange, newDynamics.length > 0, rangeChange);
  let recommended = recommendedStaves(current, entering, annotations, labelFamily(label));
  let staffConsistency = validateCueStaffConsistency(label, recommended);
  // When the score cannot substantiate a family claim with a visible majority,
  // retain the objective event but describe it neutrally rather than misleadingly.
  if (!staffConsistency.valid) {
    label = activeChange >= 3 || densityChange >= 8 ? 'ORCHESTRA EXPANDS' : densityChange <= -8 ? 'TEXTURE THINS' : 'NEW LAYER ENTERS';
    recommended = recommendedStaves(current, entering, annotations, null);
    staffConsistency = validateCueStaffConsistency(label, recommended);
  }
  return {
    id: `cue-m${measureNumber}-o${timing.occurrence}`,
    measure: measureNumber,
    occurrence: timing.occurrence,
    timestampSec: Number(timing.timeSeconds.toFixed(3)),
    region: {startSec: Number(timing.timeSeconds.toFixed(3)), endSec: Number((timing.timeSeconds + config.regionSeconds).toFixed(3))},
    label,
    strength,
    reasons,
    activeInstruments: currentActive.map(part => part.name),
    hauptstimme: annotations.map(span => ({part: span.part, instrument: span.instrument, label: span.label, startsHere: span.startMeasure === measureNumber})),
    recommendedStaves: recommended,
    staffConsistency,
  };
}

/** Offline, deterministic score-change selection. It does not use curated cues or UI data. */
export function generateListeningCues(
  source: ScoreManifest,
  evidence: HauptstimmeEvidenceManifest,
  alignment: PerformanceAlignment,
  highlights: HighlightManifest,
  partialConfig: Partial<ListeningCueConfig> = {},
): ListeningCueManifest {
  const config = {...defaultListeningCueConfig, ...partialConfig};
  const measures = Object.keys(source.measures).map(Number).sort((left, right) => left - right);
  const detectorMeasures = new Set(highlights.candidates.map(candidate => candidate.measure));
  const candidates = measures.flatMap((measure, index) => {
    const cue = candidateFor(measure, index ? source.measures[String(measures[index - 1])] : undefined, source.measures[String(measure)]!, evidence, alignment, detectorMeasures, config);
    return cue ? [cue] : [];
  });
  const strongestFirst = [...candidates].sort((left, right) => right.strength - left.strength || left.timestampSec - right.timestampSec || left.measure - right.measure);
  const selected: ListeningCue[] = [];
  for (const cue of strongestFirst) {
    const nearby = selected.find(other => Math.abs(other.timestampSec - cue.timestampSec) < config.minimumTimeSeparationSeconds);
    if (!nearby) selected.push(cue);
    if (selected.length >= config.maxCues) break;
  }
  return {
    work: {...source.work},
    generator: {version: 1, description: 'Deterministic, objective score-change cues for full-movement listening. Separate from Highlight Detector ranking and Tour Selector diversity.', config, sourceMeasures: measures.length},
    cues: selected.sort((left, right) => left.timestampSec - right.timestampSec || left.measure - right.measure),
  };
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export const listeningCueReport = (manifest: ListeningCueManifest): string => {
  const times = manifest.cues.map(cue => cue.timestampSec);
  const gaps = times.slice(1).map((time, index) => time - times[index]!);
  const average = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
  const longest = gaps.length ? Math.max(...gaps) : 0;
  const lines = [
    `# ${manifest.work.composer ?? 'Unknown composer'}, ${manifest.work.title ?? 'Untitled work'} — Automatic Listening Cues`,
    '',
    'Offline deterministic score-awareness for full listening. This is separate from Highlight Detector ranking and Tour Selector diversity selection; it uses only generated score facts, Hauptstimme evidence, generated alignment, and detector-region membership.',
    '',
    `Generated cues: ${manifest.cues.length}. Average spacing: ${average.toFixed(1)}s. Longest cue-free interval: ${longest.toFixed(1)}s. Each cue region is ${manifest.generator.config.regionSeconds}s.`,
    '',
    '## Cues in performance order',
    '',
  ];
  for (const cue of manifest.cues) {
    lines.push(`### ${clock(cue.timestampSec)} · m.${cue.measure} (occurrence ${cue.occurrence}) — ${cue.label} — strength ${cue.strength}`);
    lines.push(`Region: ${cue.region.startSec.toFixed(3)}–${cue.region.endSec.toFixed(3)}s`);
    lines.push(`Recommended staves: ${cue.recommendedStaves.join(', ') || 'none'}`);
    lines.push(`Staff consistency: ${cue.staffConsistency.valid ? 'PASS' : 'FAIL'} — ${cue.staffConsistency.message}`);
    lines.push(`Active instruments (${cue.activeInstruments.length}): ${cue.activeInstruments.join(', ') || 'none'}`);
    lines.push(`Hauptstimme: ${cue.hauptstimme.length ? cue.hauptstimme.map(span => `${span.part} (${span.label})${span.startsHere ? ', starts here' : ''}`).join('; ') : 'none'}`);
    for (const reason of cue.reasons) lines.push(`- ${reason.text}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
};

export function generateListeningCueFiles(manifestPath: string, evidencePath: string, alignmentPath: string, highlightsPath: string, outputPath: string, reportPath: string): ListeningCueManifest {
  const result = generateListeningCues(
    JSON.parse(readFileSync(manifestPath, 'utf8')) as ScoreManifest,
    JSON.parse(readFileSync(evidencePath, 'utf8')) as HauptstimmeEvidenceManifest,
    JSON.parse(readFileSync(alignmentPath, 'utf8')) as PerformanceAlignment,
    JSON.parse(readFileSync(highlightsPath, 'utf8')) as HighlightManifest,
  );
  const output = resolve(outputPath), report = resolve(reportPath);
  mkdirSync(dirname(output), {recursive: true}); mkdirSync(dirname(report), {recursive: true});
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(report, listeningCueReport(result));
  return result;
}

function main(): void {
  const [manifest, evidence, alignment, highlights, output, report] = process.argv.slice(2);
  if (!manifest || !evidence || !alignment || !highlights || !output || !report) throw new Error('Usage: npm run generate:listening-cues -- <manifest.json> <hauptstimme.json> <alignment.json> <highlights.json> <output.json> <report.md>');
  const result = generateListeningCueFiles(manifest, evidence, alignment, highlights, output, report);
  process.stdout.write(`Generated ${result.cues.length} listening cues.\n`);
}
if (process.argv[1]?.endsWith('generateListeningCues.ts')) main();
