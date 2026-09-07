import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {HighlightCandidate, HighlightManifest} from './generateHighlights';

export type TourSelectorConfig = {
  candidatePoolSize: number;
  maxHighlights: number;
  minimumTimeSeparationSeconds: number;
  closeTimeDistinctnessThreshold: number;
  weights: {quality: number; coverage: number; novelty: number};
};

/**
 * This is deliberately separate from Highlight Detector scoring. It ranks only
 * an already-bounded detector pool and asks whether each moment adds coverage
 * and a measurably distinct score profile to a short listening tour.
 */
export const defaultTourSelectorConfig: TourSelectorConfig = {
  candidatePoolSize: 15,
  maxHighlights: 9,
  minimumTimeSeparationSeconds: 38,
  closeTimeDistinctnessThreshold: .3,
  weights: {quality: 42, coverage: 28, novelty: 30},
};

export type TourSelectionReason = string;
export type TourMoment = {
  detectorRank: number;
  measure: number;
  occurrence: number;
  timeSeconds: number;
  detectorScore: number;
  selectorScore: number;
  selectorReasons: TourSelectionReason[];
  detectorReasons: string[];
  activeInstruments: string[];
  hauptstimme: HighlightCandidate['hauptstimme'];
};

export type RejectedTourCandidate = {
  detectorRank: number;
  measure: number;
  occurrence: number;
  timeSeconds: number | null;
  reason: string;
  comparedWithDetectorRank?: number;
  comparedWithMeasure?: number;
  similarity?: number;
  timeDistanceSeconds?: number;
};

export type TourSelectionManifest = {
  work: HighlightManifest['work'];
  selector: {version: 1; description: string; config: TourSelectorConfig; candidatePoolSize: number};
  selected: TourMoment[];
  rejected: RejectedTourCandidate[];
};

const overlap = (left: readonly string[], right: readonly string[]): number => {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  const rightSet = new Set(right);
  return left.filter(item => rightSet.has(item)).length / union.size;
};

const densitySimilarity = (left: number, right: number): number =>
  1 - Math.min(1, Math.abs(left - right) / Math.max(1, left, right));

const annotationProfile = (candidate: HighlightCandidate): string[] =>
  candidate.hauptstimme.map(item => `${item.instrument}:${item.label}`).sort();

/** A compact, objective local score fingerprint assembled from detector facts. */
export function candidateSimilarity(left: HighlightCandidate, right: HighlightCandidate): number {
  const leftFeature = left.features;
  const rightFeature = right.features;
  const dynamicOverlap = overlap(leftFeature.dynamicChanges, rightFeature.dynamicChanges);
  const annotationOverlap = overlap(annotationProfile(left), annotationProfile(right));
  return (
    overlap(left.activeInstruments, right.activeInstruments) * .38 +
    overlap(leftFeature.enteringInstruments, rightFeature.enteringInstruments) * .16 +
    overlap(leftFeature.droppingInstruments, rightFeature.droppingInstruments) * .10 +
    densitySimilarity(leftFeature.textureDensity, rightFeature.textureDensity) * .16 +
    dynamicOverlap * .08 +
    annotationOverlap * .12
  );
}

const timestamp = (candidate: HighlightCandidate): number | undefined =>
  typeof candidate.timeSeconds === 'number' && Number.isFinite(candidate.timeSeconds) ? candidate.timeSeconds : undefined;

const formatTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const makeMoment = (candidate: HighlightCandidate, selectorScore: number, reasons: string[]): TourMoment => ({
  detectorRank: candidate.rank,
  measure: candidate.measure,
  occurrence: candidate.occurrence ?? 1,
  timeSeconds: timestamp(candidate)!,
  detectorScore: candidate.score,
  selectorScore: Number(selectorScore.toFixed(2)),
  selectorReasons: reasons,
  detectorReasons: [...candidate.reasons],
  activeInstruments: [...candidate.activeInstruments],
  hauptstimme: candidate.hauptstimme.map(item => ({...item})),
});

export function selectTour(
  detector: HighlightManifest,
  partialConfig: Partial<TourSelectorConfig> = {},
): TourSelectionManifest {
  const config: TourSelectorConfig = {
    ...defaultTourSelectorConfig,
    ...partialConfig,
    weights: {...defaultTourSelectorConfig.weights, ...partialConfig.weights},
  };
  const pool = detector.candidates
    .slice()
    .sort((left, right) => left.rank - right.rank)
    .slice(0, config.candidatePoolSize);
  const candidates = pool.filter(candidate => timestamp(candidate) !== undefined);
  const rejected: RejectedTourCandidate[] = pool
    .filter(candidate => timestamp(candidate) === undefined)
    .map(candidate => ({detectorRank: candidate.rank, measure: candidate.measure, occurrence: candidate.occurrence, timeSeconds: candidate.timeSeconds, reason: 'Excluded because no generated performance timestamp is available.'}));
  const selected: TourMoment[] = [];
  const unselected = new Set(candidates);
  const highestDetectorScore = Math.max(1, ...candidates.map(candidate => candidate.score));
  const performanceEnd = Math.max(1, ...candidates.map(candidate => timestamp(candidate)!));

  while (selected.length < config.maxHighlights && unselected.size) {
    const choices = [...unselected].map(candidate => {
      const time = timestamp(candidate)!;
      const comparisons = selected.map(moment => {
        const selectedCandidate = candidates.find(item => item.rank === moment.detectorRank)!;
        return {moment, similarity: candidateSimilarity(candidate, selectedCandidate), distance: Math.abs(time - moment.timeSeconds)};
      });
      const nearest = comparisons.slice().sort((left, right) => left.distance - right.distance)[0];
      const mostSimilar = comparisons.slice().sort((left, right) => right.similarity - left.similarity)[0];
      // A short time window may contain two selections only when their
      // generated score fingerprints are demonstrably distinct. This is a
      // coverage rule, not a detector-score adjustment.
      const tooCloseAndSimilar = comparisons.find(comparison => comparison.distance < config.minimumTimeSeparationSeconds && comparison.similarity >= config.closeTimeDistinctnessThreshold);
      if (tooCloseAndSimilar) return {candidate, excluded: tooCloseAndSimilar};
      const quality = candidate.score / highestDetectorScore;
      const coverage = selected.length === 0 ? 1 : Math.min(1, (nearest?.distance ?? performanceEnd) / (performanceEnd / config.maxHighlights));
      const novelty = selected.length === 0 ? 1 : 1 - (mostSimilar?.similarity ?? 0);
      const selectorScore = quality * config.weights.quality + coverage * config.weights.coverage + novelty * config.weights.novelty;
      const reasons = [
        `High detector score (${candidate.score})`,
        selected.length === 0 ? 'Establishes the first tour reference point' : `Extends performance coverage; nearest selected moment is ${formatTime(nearest!.distance)} away`,
        selected.length === 0 ? 'Establishes an objective instrumentation profile' : `Adds a distinct score profile (similarity ${(mostSimilar!.similarity * 100).toFixed(0)}%)`,
      ];
      if (candidate.hauptstimme.length) reasons.push(`Hauptstimme profile: ${annotationProfile(candidate).join(', ')}`);
      return {candidate, selectorScore, reasons};
    });
    for (const choice of choices) {
      if (!('excluded' in choice)) continue;
      const exclusion = choice.excluded;
      if (!exclusion) continue;
      unselected.delete(choice.candidate);
      rejected.push({
        detectorRank: choice.candidate.rank,
        measure: choice.candidate.measure,
        occurrence: choice.candidate.occurrence ?? 1,
        timeSeconds: timestamp(choice.candidate) ?? null,
        reason: 'Excluded as a nearby similar candidate.',
        comparedWithDetectorRank: exclusion.moment.detectorRank,
        comparedWithMeasure: exclusion.moment.measure,
        similarity: Number(exclusion.similarity.toFixed(3)),
        timeDistanceSeconds: Number(exclusion.distance.toFixed(3)),
      });
    }
    const eligible = choices.filter((choice): choice is Extract<typeof choice, {selectorScore: number}> => !('excluded' in choice));
    if (!eligible.length) break;
    eligible.sort((left, right) => right.selectorScore - left.selectorScore || left.candidate.rank - right.candidate.rank);
    const chosen = eligible[0]!;
    selected.push(makeMoment(chosen.candidate, chosen.selectorScore, chosen.reasons));
    unselected.delete(chosen.candidate);
  }

  const selectedRanks = new Set(selected.map(moment => moment.detectorRank));
  for (const candidate of candidates) {
    if (selectedRanks.has(candidate.rank) || rejected.some(item => item.detectorRank === candidate.rank)) continue;
    const closest = selected.map(moment => {
      const selectedCandidate = candidates.find(item => item.rank === moment.detectorRank)!;
      return {moment, similarity: candidateSimilarity(candidate, selectedCandidate), distance: Math.abs(timestamp(candidate)! - moment.timeSeconds)};
    }).sort((left, right) => right.similarity - left.similarity || left.distance - right.distance)[0];
    rejected.push({
      detectorRank: candidate.rank,
      measure: candidate.measure,
      occurrence: candidate.occurrence ?? 1,
      timeSeconds: timestamp(candidate)!,
      reason: closest ? 'Lower-scoring member of a similar tour profile.' : 'Not selected within the maximum tour size.',
      comparedWithDetectorRank: closest?.moment.detectorRank,
      comparedWithMeasure: closest?.moment.measure,
      similarity: closest ? Number(closest.similarity.toFixed(3)) : undefined,
      timeDistanceSeconds: closest ? Number(closest.distance.toFixed(3)) : undefined,
    });
  }

  return {
    work: {...detector.work},
    selector: {
      version: 1,
      description: 'Deterministic selection of a diverse, representative tour from the Highlight Detector candidate pool.',
      config,
      candidatePoolSize: pool.length,
    },
    selected: selected.sort((left, right) => left.timeSeconds - right.timeSeconds),
    rejected: rejected.sort((left, right) => left.detectorRank - right.detectorRank),
  };
}

export const markdownReport = (selection: TourSelectionManifest): string => {
  const lines = [
    `# ${selection.work.composer ?? 'Unknown composer'}, ${selection.work.title ?? 'Untitled work'} — Automatic Tour Selection`,
    '',
    'The Tour Selector is an offline, deterministic diversity layer. It consumes only the Highlight Detector candidate artifact and its objective feature data; it does not change detector scores or use curated musical cues.',
    '',
    `Candidate pool: detector Top ${selection.selector.candidatePoolSize}. Maximum selected highlights: ${selection.selector.config.maxHighlights}.`,
    '',
    '## Selected tour (performance order)',
    '',
  ];
  for (const moment of selection.selected) {
    lines.push(`### Detector #${moment.detectorRank} — m.${moment.measure} (occurrence ${moment.occurrence}) — ${moment.timeSeconds.toFixed(3)}s — detector ${moment.detectorScore}, selector ${moment.selectorScore}`);
    for (const reason of moment.selectorReasons) lines.push(`- ${reason}`);
    lines.push('');
  }
  lines.push('## Excluded detector candidates', '');
  for (const item of selection.rejected) {
    const comparison = item.comparedWithDetectorRank === undefined ? '' : ` Compared with detector #${item.comparedWithDetectorRank} (m.${item.comparedWithMeasure}; similarity ${((item.similarity ?? 0) * 100).toFixed(0)}%; ${item.timeDistanceSeconds?.toFixed(3)}s apart).`;
    lines.push(`- Detector #${item.detectorRank} · m.${item.measure} (occurrence ${item.occurrence}): ${item.reason}${comparison}`);
  }
  return `${lines.join('\n')}\n`;
};

export function generateTourSelection(detectorPath: string, outputPath: string, reportPath: string): TourSelectionManifest {
  const detector = JSON.parse(readFileSync(detectorPath, 'utf8')) as HighlightManifest;
  const selection = selectTour(detector);
  const destination = resolve(outputPath);
  const reportDestination = resolve(reportPath);
  mkdirSync(dirname(destination), {recursive: true});
  mkdirSync(dirname(reportDestination), {recursive: true});
  writeFileSync(destination, `${JSON.stringify(selection, null, 2)}\n`);
  writeFileSync(reportDestination, markdownReport(selection));
  return selection;
}

function main(): void {
  const [detectorPath, outputPath, reportPath] = process.argv.slice(2);
  if (!detectorPath || !outputPath || !reportPath) throw new Error('Usage: npm run generate:tour-selection -- <highlights.json> <output.json> <report.md>');
  const selection = generateTourSelection(detectorPath, outputPath, reportPath);
  process.stdout.write(`Selected ${selection.selected.length} tour moments from ${selection.selector.candidatePoolSize} detector candidates.\n`);
}

if (process.argv[1]?.endsWith('generateTourSelection.ts')) main();
