import generatedEvidence from './generated/hauptstimmeEvidence.json';
import type {HauptstimmeAnnotationSpan, HauptstimmeEvidenceManifest} from '../types/hauptstimme';

const evidence = generatedEvidence as HauptstimmeEvidenceManifest;

/**
 * Returns published human-annotation evidence active at the start of a score measure.
 * This does not select UI rows and does not alter curated Orchestra Lens roles.
 */
export function getHauptstimmeAnnotationsAtMeasure(measure?: number): readonly HauptstimmeAnnotationSpan[] {
  if (measure === undefined) return [];
  const qstamp = evidence.measureStartQstamps[String(measure)];
  if (qstamp === undefined) return [];
  return evidence.spans.filter(span => span.startQstamp <= qstamp && (span.endQstamp === null || qstamp < span.endQstamp));
}

export const hauptstimmeEvidence = evidence;
