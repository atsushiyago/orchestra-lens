import generatedRuntimeScoreFacts from './generated/runtimeScoreFacts.json';
import {getOrchestraXRay, type OrchestraXRayRole} from './orchestraXRay';
import {getSmartScoreParts, type SmartScorePart} from './smartScore';
import {getThemeLens, type ThemeLensRelationship} from './themeLens';
import type {ObjectiveScorePartFact, RuntimeScoreFactsManifest} from '../types/scoreFacts';

export type RuntimeSmartScorePart = SmartScorePart & {
  /** Hand-authored role; never derived from MusicXML activity. */
  curatedRole?: OrchestraXRayRole;
  /** Objective source facts for the displayed instrument group. */
  objectiveParts: readonly ObjectiveScorePartFact[];
};

export type OrchestraLensRuntimeCue = {
  measure: number;
  /** Generated MusicXML facts for this measure, absent only outside the compact set. */
  objectiveFacts?: ObjectiveScoreFacts;
  /** Curated score selection and interpretation, augmented with source facts. */
  smartScoreParts: readonly RuntimeSmartScorePart[];
  /** Curated relationship metadata; no theme relationship is automatically inferred. */
  themeLens?: ThemeLensRelationship;
};

type ObjectiveScoreFacts = RuntimeScoreFactsManifest['measures'][string];

const allStrings = new Set(['Violin 1', 'Violin 2', 'Viola', 'Violoncello', 'Contrabass']);
const lowerStrings = new Set(['Violoncello', 'Contrabass']);

const sourcePartsFor = (instrument: string, facts?: ObjectiveScoreFacts): readonly ObjectiveScorePartFact[] => {
  if (!facts) return [];
  return facts.parts.filter(part => {
    if (instrument === 'Strings') return allStrings.has(part.name);
    if (instrument === 'Violins') return part.name.startsWith('Violin');
    if (instrument === 'Lower Strings') return lowerStrings.has(part.name);
    if (instrument === 'Horn') return /Horn/.test(part.name);
    if (instrument === 'Brass') return /Horn|Trumpet|Trombone/.test(part.name);
    if (instrument === 'Trombones') return part.name.startsWith('Trombone');
    return part.name.startsWith(instrument);
  });
};

export function buildRuntimeCue(
  measure?: number,
  generatedFacts: RuntimeScoreFactsManifest = generatedRuntimeScoreFacts as RuntimeScoreFactsManifest,
): OrchestraLensRuntimeCue | undefined {
  if (measure === undefined) return undefined;
  const objectiveFacts = generatedFacts.measures[String(measure)];
  const roles = getOrchestraXRay(measure);
  const smartScoreParts = getSmartScoreParts(measure).map(part => ({
    ...part,
    curatedRole: roles.find(role => role.instrument === part.instrument),
    objectiveParts: sourcePartsFor(part.instrument, objectiveFacts),
  }));
  const themeLens = getThemeLens(measure);
  if (!objectiveFacts && smartScoreParts.length === 0 && !themeLens) return undefined;
  return {measure, objectiveFacts, smartScoreParts, themeLens};
}

export const getRuntimeCue = (measure?: number): OrchestraLensRuntimeCue | undefined => buildRuntimeCue(measure);
