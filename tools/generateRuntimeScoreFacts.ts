import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {ScoreManifest} from './generateScoreManifest';
import type {RuntimeScoreFactsManifest} from '../src/types/scoreFacts';

/** Includes each current demo cue and m.47, needed by the m.407 comparison view. */
export const runtimeCueMeasures = [30, 47, 62, 285, 407] as const;

export function deriveRuntimeScoreFacts(
  source: ScoreManifest,
  measures: readonly number[] = runtimeCueMeasures,
): RuntimeScoreFactsManifest {
  const selected = Object.fromEntries(measures.map(measure => {
    const facts = source.measures[String(measure)];
    if (!facts) throw new Error(`Source score manifest does not contain measure ${measure}.`);
    return [String(measure), facts];
  }));
  return {work: source.work, measures: selected};
}

export function generateRuntimeScoreFacts(
  inputPath: string,
  outputPath = 'src/data/generated/runtimeScoreFacts.json',
): RuntimeScoreFactsManifest {
  const source = JSON.parse(readFileSync(inputPath, 'utf8')) as ScoreManifest;
  const runtimeFacts = deriveRuntimeScoreFacts(source);
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), {recursive: true});
  writeFileSync(destination, `${JSON.stringify(runtimeFacts, null, 2)}\n`);
  return runtimeFacts;
}

function main(): void {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error('Usage: npm run generate:runtime-score-facts -- <full-manifest.json> [output.json]');
  const runtimeFacts = generateRuntimeScoreFacts(inputPath, outputPath);
  process.stdout.write(`Generated runtime facts for ${Object.keys(runtimeFacts.measures).length} measures at ${resolve(outputPath ?? 'src/data/generated/runtimeScoreFacts.json')}\n`);
}

if (process.argv[1]?.endsWith('generateRuntimeScoreFacts.ts')) main();
