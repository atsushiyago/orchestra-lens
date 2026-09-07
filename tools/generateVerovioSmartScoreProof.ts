import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {parseScoreParts, selectPrototypeCues} from './generateSmartScorePrototype';
import type {ListeningCue, ListeningCueManifest} from './generateListeningCues';

export type ExcerptWindow = {startMeasure: number; endMeasure: number};
export type MusicXmlExcerpt = {musicxml: string; removedAnalyticalLyrics: number};
export type VerovioToolkit = {setOptions(options: Record<string, unknown>): void; loadData(data: string): number; renderToSVG(page: number, options?: Record<string, unknown>): string; getVersion(): string; getLog(): string};
type VerovioModule = {module: {onRuntimeInitialized?: () => void}; toolkit: new () => VerovioToolkit; enableLogToBuffer?: (value: boolean, module: unknown) => void};
let sharedToolkit: VerovioToolkit | undefined;

export type VerovioProofManifest = {
  cue: {id: string; measure: number; timestampSec: number; label: string; recommendedStaves: string[]; window: ExcerptWindow};
  renderer: {name: 'Verovio'; version: string; package: 'verovio'; license: 'LGPL-3.0-or-later'; method: string; options: Record<string, unknown>};
  assets: {musicxml: string; customSvg: string; verovioSvg: string; reviewHtml: string};
  extraction: {preserved: string[]; lost: string[]};
};

const attr = (xml: string, name: string) => xml.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`))?.[1];
const elementText = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`))?.[1].replace(/<[^>]+>/g, '').trim();
const compact = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const matchingPart = (parts: ReturnType<typeof parseScoreParts>, staff: string) => {
  const target = compact(staff); const exact = parts.find(part => compact(part.name) === target);
  if (exact) return exact;
  const matches = parts.filter(part => compact(part.name).includes(target) || target.includes(compact(part.name)));
  return matches.length === 1 ? matches[0] : undefined;
};
const betweenMeasures = (partXml: string, window: ExcerptWindow) => [...partXml.matchAll(/<measure\b([^>]*)>([\s\S]*?)<\/measure>/g)]
  .filter(match => { const measure = Number(attr(match[1], 'number')); return measure >= window.startMeasure && measure <= window.endMeasure; })
  .map(match => `<measure${match[1]}>${match[2]}</measure>`);
const mergedAttributes = (xml: string): string | undefined => {
  const blocks = [...xml.matchAll(/<attributes\b[^>]*>([\s\S]*?)<\/attributes>/g)].map(match => match[1]!);
  if (!blocks.length) return undefined;
  const last = (tag: string) => blocks.flatMap(block => [...block.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g'))]).at(-1)?.[0];
  // Keep the current context for the standalone opening bar. Components are
  // selected independently because MusicXML attributes are incremental.
  const components = ['divisions', 'key', 'time', 'staves', 'clef', 'staff-details', 'transpose'].map(last).filter((item): item is string => !!item);
  return components.length ? `<attributes>${components.join('')}</attributes>` : undefined;
};

/**
 * Removes source-analysis codes encoded as red, single-character MusicXML
 * lyrics with a synthetic relative offset. It deliberately leaves ordinary
 * lyrics, directions, dynamics, tempo/expression text, and rehearsal marks.
 */
export const filterNonPerformanceAnnotations = (musicxml: string): MusicXmlExcerpt => {
  let removedAnalyticalLyrics = 0;
  const filtered = musicxml.replace(/<lyric\b([^>]*)>([\s\S]*?)<\/lyric>/g, (whole, attributes: string, body: string) => {
    const lyricText = elementText(body, 'text')?.replace(/\s+/g, ' ').trim() ?? '';
    const analytical = /\bcolor\s*=\s*["']#(?:ff)?0000["']/i.test(attributes)
      && /\brelative-y\s*=\s*["']-?\d+["']/i.test(attributes)
      && /<syllabic>single<\/syllabic>/.test(body)
      && /^[A-Za-z]$/.test(lyricText);
    if (!analytical) return whole;
    removedAnalyticalLyrics += 1;
    return '';
  });
  return {musicxml: filtered, removedAnalyticalLyrics};
};

/** Creates a valid, standalone MusicXML score while retaining source MusicXML payloads verbatim. */
export function extractMusicXmlExcerptWithReport(source: string, staves: readonly string[], window: ExcerptWindow): MusicXmlExcerpt {
  const parts = parseScoreParts(source); const selected = staves.map(staff => matchingPart(parts, staff));
  if (selected.some(part => !part)) throw new Error(`Could not map selected staves: ${staves.join(', ')}`);
  const sourcePartXml = new Map<string, string>();
  for (const match of source.matchAll(/<part\s+([^>]*)>([\s\S]*?)<\/part>/g)) { const id = attr(match[1], 'id'); if (id) sourcePartXml.set(id, match[2]); }
  const ids = new Set(selected.map(part => part!.id));
  const scoreParts = [...source.matchAll(/<score-part\b([^>]*)>([\s\S]*?)<\/score-part>/g)]
    .filter(match => ids.has(attr(match[1], 'id') ?? ''))
    .map(match => `<score-part${match[1]}>${match[2]}</score-part>`).join('');
  const partList = `<part-list>${scoreParts}</part-list>`;
  const excerptParts = selected.map(part => {
    const original = sourcePartXml.get(part!.id)!;
    const prior = original.slice(0, original.indexOf(`<measure number="${window.startMeasure}"`));
    // Attribute elements are incremental in MusicXML. Preserve the last known
    // value of each relevant component and inject it into the first excerpt bar.
    const attributes = mergedAttributes(prior) ?? mergedAttributes(original);
    const measures = betweenMeasures(original, window);
    if (!measures.length) throw new Error(`${part!.name} has no measures in requested window.`);
    const first = measures[0]!;
    measures[0] = first.replace(/(<measure\b[^>]*>)/, `$1${attributes ?? ''}`);
    return `<part id="${part!.id}">${measures.join('')}</part>`;
  }).join('');
  return filterNonPerformanceAnnotations(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1">${partList}${excerptParts}</score-partwise>`);
}
export function extractMusicXmlExcerpt(source: string, staves: readonly string[], window: ExcerptWindow): string { return extractMusicXmlExcerptWithReport(source, staves, window).musicxml; }

export const createVerovioToolkit = async (): Promise<VerovioToolkit> => {
  if (sharedToolkit) return sharedToolkit;
  // The official package is CommonJS-compatible; the WASM runtime signals ready
  // through onRuntimeInitialized. This remains fully local and deterministic.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const verovio = require('verovio') as VerovioModule;
  return new Promise(resolveToolkit => { verovio.module.onRuntimeInitialized = () => { verovio.enableLogToBuffer?.(true, verovio.module); sharedToolkit = new verovio.toolkit(); resolveToolkit(sharedToolkit); }; });
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cueWindow = (cue: ListeningCue): ExcerptWindow => ({startMeasure: Math.max(1, cue.measure - 1), endMeasure: cue.measure + 2});
const proofCue = (cues: readonly ListeningCue[]): ListeningCue => {
  const cue = selectPrototypeCues(cues).find(item => item.measure === 97);
  if (!cue) throw new Error('The generic prototype selector did not produce the expected difficult cue.');
  return cue;
};

export async function generateVerovioSmartScoreProof(scorePath: string, cuePath: string, customAssetDirectory: string, outputDirectory: string): Promise<VerovioProofManifest> {
  const source = readFileSync(scorePath, 'utf8'); const cueManifest = JSON.parse(readFileSync(cuePath, 'utf8')) as ListeningCueManifest; const cue = proofCue(cueManifest.cues); const window = cueWindow(cue); const output = resolve(outputDirectory);
  rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true});
  const musicxml = extractMusicXmlExcerpt(source, cue.recommendedStaves, window); writeFileSync(join(output, 'excerpt.musicxml'), `${musicxml}\n`);
  const customSvg = `cue-${cue.id}.svg`; cpSync(join(resolve(customAssetDirectory), customSvg), join(output, 'custom-renderer.svg'));
  const options = {pageWidth: 1200, pageHeight: 460, pageMarginLeft: 14, pageMarginRight: 14, pageMarginTop: 12, pageMarginBottom: 12, scale: 55, breaks: 'none', adjustPageHeight: true, footer: 'none', header: 'none', svgViewBox: true};
  const toolkit = await createVerovioToolkit(); toolkit.setOptions(options); const loadStatus = toolkit.loadData(musicxml); if (loadStatus !== 1) throw new Error(`Verovio failed to load the extracted MusicXML (status ${loadStatus}).`); const svg = toolkit.renderToSVG(1, {}); writeFileSync(join(output, 'verovio.svg'), svg);
  const manifest: VerovioProofManifest = {cue: {id: cue.id, measure: cue.measure, timestampSec: cue.timestampSec, label: cue.label, recommendedStaves: [...cue.recommendedStaves], window}, renderer: {name: 'Verovio', version: toolkit.getVersion(), package: 'verovio', license: 'LGPL-3.0-or-later', method: 'Official local npm WASM toolkit: setOptions → loadData(standalone MusicXML) → renderToSVG(1).', options}, assets: {musicxml: 'excerpt.musicxml', customSvg: 'custom-renderer.svg', verovioSvg: 'verovio.svg', reviewHtml: 'review.html'}, extraction: {preserved: ['Selected MusicXML parts', 'Measure payloads 96–99', 'Clefs, key/time signatures, beams, ties, tuplets, multiple voices, directions/dynamics, articulations, and transpose metadata carried in selected source XML.'], lost: ['Part groups and all non-selected parts are omitted. No note-level payload is flattened or rewritten.']}};
  writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const facts = `Cue m.${cue.measure} · ${cue.timestampSec.toFixed(3)}s · ${cue.recommendedStaves.join(', ')} · measures ${window.startMeasure}–${window.endMeasure}`;
  writeFileSync(join(output, 'review.html'), `<!doctype html><meta charset="utf-8"><title>Verovio Smart Score proof · m.${cue.measure}</title><style>body{margin:28px;background:#101720;color:#edf4fc;font:18px system-ui}h1,h2{color:#f1cd87}.meta{color:#c7d6e7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.card{background:#1c2632;padding:16px;border-radius:10px}.score{width:100%;background:#fffdf8}@media(max-width:900px){.grid{grid-template-columns:1fr}}</style><h1>Smart Score engraving comparison</h1><p class="meta">${escapeHtml(facts)}</p><p class="meta">Same Listening Cue → same recommended staves → same MusicXML window. Only the engraving engine differs.</p><div class="grid"><section class="card"><h2>CUSTOM RENDERER</h2><img class="score" src="custom-renderer.svg" alt="Custom renderer output"/></section><section class="card"><h2>VEROVIO</h2><img class="score" src="verovio.svg" alt="Verovio output"/></section></div><p class="meta">Verovio ${escapeHtml(manifest.renderer.version)} · LGPL-3.0-or-later · local offline WASM render. No notation SVG was edited after rendering.</p>`);
  return manifest;
}

async function main(): Promise<void> { const [score, cues, customAssets, output] = process.argv.slice(2); if (!score || !cues || !customAssets || !output) throw new Error('Usage: npm run generate:verovio-smart-score-proof -- <score.musicxml> <listening-cues.json> <custom-assets-dir> <output-dir>'); const result = await generateVerovioSmartScoreProof(score, cues, customAssets, output); process.stdout.write(`Generated Verovio proof for m.${result.cue.measure} with Verovio ${result.renderer.version}.\n`); }
if (process.argv[1]?.endsWith('generateVerovioSmartScoreProof.ts')) void main();
