import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

export type ScoreManifestPart = {
  name: string;
  active: boolean;
  noteCount: number;
  lowestPitch: string | null;
  highestPitch: string | null;
  dynamics: string[];
  articulations: string[];
};

export type ScoreManifestMeasure = {
  parts: ScoreManifestPart[];
  activeInstruments: string[];
  textureDensity: number;
};

export type ScoreManifest = {
  work: {title: string | null; composer: string | null};
  measures: Record<string, ScoreManifestMeasure>;
};

type Pitch = {label: string; midi: number};

const textOf = (xml: string, tag: string): string | undefined => {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || undefined;
};

const attribute = (xml: string, name: string): string | undefined =>
  xml.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`))?.[1];

const pitchOf = (note: string): Pitch | undefined => {
  const pitch = note.match(/<pitch\b[^>]*>([\s\S]*?)<\/pitch>/)?.[1];
  const step = pitch && textOf(pitch, 'step');
  const octave = pitch && textOf(pitch, 'octave');
  if (!step || !octave || !/^[A-G]$/.test(step) || !/^[-]?\d+$/.test(octave)) return undefined;
  const alter = Number(textOf(pitch, 'alter') ?? '0');
  const semitones: Record<string, number> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
  const accidental = alter > 0 ? '#'.repeat(alter) : 'b'.repeat(Math.abs(alter));
  return {label: `${step}${accidental}${octave}`, midi: (Number(octave) + 1) * 12 + semitones[step] + alter};
};

const childTagNames = (xml: string, container: string): string[] => {
  const names = new Set<string>();
  for (const match of xml.matchAll(new RegExp(`<${container}\\b[^>]*>([\\s\\S]*?)</${container}>`, 'g'))) {
    for (const tag of match[1].matchAll(/<([A-Za-z][A-Za-z0-9-]*)\b[^>]*\/?>/g)) names.add(tag[1]);
  }
  return [...names];
};

const parseMeasure = (partName: string, measureXml: string): ScoreManifestPart => {
  const pitches: Pitch[] = [];
  let noteCount = 0;
  for (const noteMatch of measureXml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
    const note = noteMatch[1];
    if (/<rest\b/.test(note)) continue;
    noteCount += 1;
    const pitch = pitchOf(note);
    if (pitch) pitches.push(pitch);
  }
  const orderedPitches = [...pitches].sort((left, right) => left.midi - right.midi);
  return {
    name: partName,
    active: noteCount > 0,
    noteCount,
    lowestPitch: orderedPitches[0]?.label ?? null,
    highestPitch: orderedPitches.at(-1)?.label ?? null,
    dynamics: childTagNames(measureXml, 'dynamics'),
    articulations: childTagNames(measureXml, 'articulations'),
  };
};

export function parseMusicXml(xml: string): ScoreManifest {
  const partNames = new Map<string, string>();
  for (const scorePart of xml.matchAll(/<score-part\b([^>]*)>([\s\S]*?)<\/score-part>/g)) {
    const id = attribute(scorePart[1], 'id');
    const name = textOf(scorePart[2], 'part-name');
    if (id) partNames.set(id, name || id);
  }

  const measures = new Map<string, ScoreManifestPart[]>();
  for (const part of xml.matchAll(/<part\s+([^>]*)>([\s\S]*?)<\/part>/g)) {
    const id = attribute(part[1], 'id') ?? 'Unknown part';
    const name = partNames.get(id) ?? id;
    for (const measure of part[2].matchAll(/<measure\b([^>]*)>([\s\S]*?)<\/measure>/g)) {
      const number = attribute(measure[1], 'number');
      if (!number) continue;
      const parts = measures.get(number) ?? [];
      parts.push(parseMeasure(name, measure[2]));
      measures.set(number, parts);
    }
  }

  const sortedMeasures = [...measures.entries()].sort(([left], [right]) => Number(left) - Number(right));
  return {
    work: {
      title: textOf(xml, 'work-title') ?? textOf(xml, 'movement-title') ?? null,
      composer: [...xml.matchAll(/<creator\b([^>]*)>([\s\S]*?)<\/creator>/g)]
        .find(match => attribute(match[1], 'type') === 'composer')?.[2].replace(/<[^>]+>/g, '').trim() ?? null,
    },
    measures: Object.fromEntries(sortedMeasures.map(([number, parts]) => [number, {
      parts,
      activeInstruments: parts.filter(part => part.active).map(part => part.name),
      textureDensity: parts.reduce((total, part) => total + part.noteCount, 0),
    }])),
  };
}

export function generateScoreManifest(inputPath: string, outputPath = 'src/data/generated/scoreManifest.json'): ScoreManifest {
  const manifest = parseMusicXml(readFileSync(inputPath, 'utf8'));
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), {recursive: true});
  writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function main(): void {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath) throw new Error('Usage: npm run generate:score-manifest -- <input.musicxml> [output.json]');
  const manifest = generateScoreManifest(inputPath, outputPath);
  process.stdout.write(`Generated ${Object.keys(manifest.measures).length} measures at ${resolve(outputPath ?? 'src/data/generated/scoreManifest.json')}\n`);
}

if (process.argv[1]?.endsWith('generateScoreManifest.ts')) main();
