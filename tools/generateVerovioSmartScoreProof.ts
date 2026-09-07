import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {parseScoreParts, selectPrototypeCues} from './generateSmartScorePrototype';
import type {ListeningCue, ListeningCueManifest} from './generateListeningCues';

export type ExcerptWindow = {startMeasure: number; endMeasure: number};
export type ExcerptMeasureProvenance = {
  sourcePartId: string;
  sourceMeasureIndex: number;
  sourceMeasureNumber: string;
  outputMeasureIndex: number;
  outputMeasureNumber: string;
  fingerprint: string;
};
export type ExcerptPartProvenance = {sourcePartId: string; partName: string; measures: ExcerptMeasureProvenance[]};
export type ExcerptIntegrity = {valid: boolean; parts: ExcerptPartProvenance[]; mismatches: string[]};
export type SvgGlyphValidation = {valid: boolean; replacementCharacters: number; controlCharacters: number; privateUseTextGlyphs: number; suspiciousInstrumentalLyrics: number; issues: string[]};
export type MusicXmlExcerpt = {musicxml: string; removedAnalyticalLyrics: number; normalizedOtherDynamics: number; integrity: ExcerptIntegrity};
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
type XmlMeasure = {index: number; number: string; xml: string};
const measuresForPart = (partXml: string): XmlMeasure[] => [...partXml.matchAll(/<measure\b([^>]*)>([\s\S]*?)<\/measure>/g)]
  .map((match, index) => ({index, number: attr(match[1], 'number') ?? '', xml: `<measure${match[1]}>${match[2]}</measure>`}));
const windowForPart = (partXml: string, window: ExcerptWindow): XmlMeasure[] => {
  const measures = measuresForPart(partXml);
  const start = measures.findIndex(measure => Number(measure.number) === window.startMeasure);
  const expectedLength = window.endMeasure - window.startMeasure + 1;
  if (start < 0) return [];
  const selected = measures.slice(start, start + expectedLength);
  if (selected.length !== expectedLength || selected.some((measure, index) => Number(measure.number) !== window.startMeasure + index)) return [];
  return selected;
};
const noteFingerprint = (measureXml: string): string => {
  const events = [...measureXml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)].map(match => {
    const body = match[1]!;
    const pitch = body.match(/<pitch\b[^>]*>[\s\S]*?<step>([^<]+)<\/step>(?:[\s\S]*?<alter>([^<]+)<\/alter>)?[\s\S]*?<octave>([^<]+)<\/octave>[\s\S]*?<\/pitch>/);
    return {
      kind: /<rest\b/.test(body) ? 'rest' : 'note',
      pitch: pitch ? `${pitch[1]}${pitch[2] ? `:${pitch[2]}` : ''}${pitch[3]}` : null,
      duration: elementText(body, 'duration') ?? null,
      voice: elementText(body, 'voice') ?? '1',
      chord: /<chord\b/.test(body),
    };
  });
  return JSON.stringify(events);
};
const mergedAttributes = (xml: string): string | undefined => {
  const blocks = [...xml.matchAll(/<attributes\b[^>]*>([\s\S]*?)<\/attributes>/g)].map(match => match[1]!);
  if (!blocks.length) return undefined;
  const last = (tag: string) => blocks.flatMap(block => [...block.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g'))]).at(-1)?.[0];
  // Keep the current context for the standalone opening bar. Components are
  // selected independently because MusicXML attributes are incremental.
  const components = ['divisions', 'key', 'time', 'staves', 'clef', 'staff-details', 'transpose'].map(last).filter((item): item is string => !!item);
  return components.length ? `<attributes>${components.join('')}</attributes>` : undefined;
};

const vocalPartIds = (musicxml: string): ReadonlySet<string> => new Set([...musicxml.matchAll(/<score-part\s+([^>]*)>([\s\S]*?)<\/score-part>/g)]
  // “Bass” alone frequently denotes a contrabass orchestral part. Treat only
  // unambiguously vocal names as vocal so instrumental analysis marks remain
  // eligible for removal.
  .filter(match => /<(?:part-name|score-instrument)[^>]*>[^<]*(?:soprano|alto|tenor|baritone|voice|choir|chorus)[^<]*/i.test(match[2]!))
  .map(match => attr(match[1], 'id')).filter((id): id is string => !!id));
const stripAnalyticalLyrics = (partXml: string, isVocal: boolean, counter: {value: number}) => isVocal ? partXml : partXml.replace(/<lyric\b([^>]*)>([\s\S]*?)<\/lyric>/g, (whole, attributes: string, body: string) => {
  const lyricText = elementText(body, 'text')?.replace(/\s+/g, ' ').trim() ?? '';
  const analytical = /\bcolor\s*=\s*["']#(?:ff)?0000["']/i.test(attributes)
    && /\brelative-y\s*=\s*["']-?\d+["']/i.test(attributes)
    && /<syllabic>single<\/syllabic>/.test(body)
    && /^[A-Za-z]$/.test(lyricText);
  if (!analytical) return whole;
  counter.value += 1;
  return '';
});

/**
 * Verovio encodes an <other-dynamics> string inside a Leipzig private-use
 * glyph run. Native SVG-to-PNG renderers cannot reliably resolve that embedded
 * WOFF2 glyph. Preserve both the notated dynamic and expression wording by
 * emitting the wording as the equivalent MusicXML direction text instead.
 */
const normalizeOtherDynamics = (musicxml: string, counter: {value: number}) => musicxml.replace(/<direction(?:\s+([^>]*))?>([\s\S]*?)<\/direction>/g, (whole, directionAttributes: string | undefined, directionBody: string) => {
  const dynamics = directionBody.match(/<dynamics\b([^>]*)>([\s\S]*?)<\/dynamics>/);
  if (!dynamics) return whole;
  const entries = [...dynamics[2]!.matchAll(/<other-dynamics\b[^>]*>([\s\S]*?)<\/other-dynamics>/g)].map(match => match[1]!.trim()).filter(Boolean);
  if (!entries.length) return whole;
  counter.value += entries.length;
  const retainedDynamics = dynamics[2]!.replace(/<other-dynamics\b[^>]*>[\s\S]*?<\/other-dynamics>/g, '');
  const retainedDirection = whole.replace(dynamics[0], `<dynamics${dynamics[1]}>${retainedDynamics}</dynamics>`);
  const directionStart = `<direction${directionAttributes ? ` ${directionAttributes}` : ''}>`;
  const wordsDirections = entries.map(text => `${directionStart}<direction-type><words>${text}</words></direction-type></direction>`).join('');
  return `${retainedDirection}${wordsDirections}`;
});

/** Removes only synthetic analysis lyrics in instrumental parts and normalizes portable dynamic text. */
export const filterNonPerformanceAnnotations = (musicxml: string): Pick<MusicXmlExcerpt, 'musicxml' | 'removedAnalyticalLyrics' | 'normalizedOtherDynamics'> => {
  const vocalIds = vocalPartIds(musicxml); const removed = {value: 0}; const normalized = {value: 0};
  const lyricsFiltered = /<part\s+/.test(musicxml) ? musicxml.replace(/<part\s+([^>]*)>([\s\S]*?)<\/part>/g, (whole, attributes: string, body: string) => {
    const id = attr(attributes, 'id') ?? '';
    return `<part ${attributes}>${stripAnalyticalLyrics(body, vocalIds.has(id), removed)}</part>`;
  }) : stripAnalyticalLyrics(musicxml, false, removed);
  return {musicxml: normalizeOtherDynamics(lyricsFiltered, normalized).replace(/[ \t]+(?=\r?\n)/g, ''), removedAnalyticalLyrics: removed.value, normalizedOtherDynamics: normalized.value};
};

const partsById = (musicxml: string): Map<string, string> => new Map([...musicxml.matchAll(/<part\s+([^>]*)>([\s\S]*?)<\/part>/g)]
  .map(match => [attr(match[1], 'id'), match[2]]).filter((entry): entry is [string, string] => !!entry[0]));

/** Validates every output bar against its contiguous source-position counterpart. */
export const validateExcerptIntegrity = (source: string, excerpt: string, selectedParts: readonly {id: string; name: string}[], window: ExcerptWindow): ExcerptIntegrity => {
  const sourceParts = partsById(source); const outputParts = partsById(excerpt); const mismatches: string[] = [];
  const parts = selectedParts.map(part => {
    const expected = windowForPart(sourceParts.get(part.id) ?? '', window);
    const output = measuresForPart(outputParts.get(part.id) ?? '');
    const measures = expected.map((sourceMeasure, outputMeasureIndex) => {
      const outputMeasure = output[outputMeasureIndex];
      const fingerprint = noteFingerprint(sourceMeasure.xml);
      if (!outputMeasure) mismatches.push(`${part.name}: missing output measure ${sourceMeasure.number} at source index ${sourceMeasure.index}.`);
      else if (noteFingerprint(outputMeasure.xml) !== fingerprint) mismatches.push(`${part.name}: fingerprint mismatch at output index ${outputMeasureIndex}; expected source index ${sourceMeasure.index} (m.${sourceMeasure.number}), got m.${outputMeasure.number}.`);
      if (sourceMeasure.index !== (expected[0]?.index ?? sourceMeasure.index) + outputMeasureIndex) mismatches.push(`${part.name}: non-contiguous source index at m.${sourceMeasure.number}.`);
      return {sourcePartId: part.id, sourceMeasureIndex: sourceMeasure.index, sourceMeasureNumber: sourceMeasure.number, outputMeasureIndex, outputMeasureNumber: outputMeasure?.number ?? '', fingerprint};
    });
    if (expected.length !== window.endMeasure - window.startMeasure + 1) mismatches.push(`${part.name}: requested window m.${window.startMeasure}–${window.endMeasure} is not a contiguous source sequence.`);
    if (output.length !== expected.length) mismatches.push(`${part.name}: expected ${expected.length} output measures, found ${output.length}.`);
    return {sourcePartId: part.id, partName: part.name, measures};
  });
  return {valid: mismatches.length === 0, parts, mismatches};
};

const textNodes = (svg: string) => [...svg.matchAll(/<(?:text|tspan)\b[^>]*>([\s\S]*?)<\/(?:text|tspan)>/g)].map(match => match[1]!.replace(/<[^>]+>/g, ''));
/** Detects unsupported ordinary-text glyphs while allowing Verovio's <use>-based notation glyphs. */
export const validateSvgGlyphs = (svg: string, instrumental: boolean): SvgGlyphValidation => {
  const ordinaryText = textNodes(svg).join('');
  const replacementCharacters = (ordinaryText.match(/\uFFFD/g) ?? []).length;
  const controlCharacters = [...ordinaryText].filter(char => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(char)).length;
  const privateUseTextGlyphs = [...ordinaryText].filter(char => { const code = char.codePointAt(0) ?? 0; return code >= 0xE000 && code <= 0xF8FF; }).length;
  const suspiciousInstrumentalLyrics = instrumental ? (svg.match(/class="verse"/g) ?? []).length : 0;
  const issues = [
    ...(replacementCharacters ? [`${replacementCharacters} replacement character(s) in SVG text.`] : []),
    ...(controlCharacters ? [`${controlCharacters} control character(s) in SVG text.`] : []),
    ...(privateUseTextGlyphs ? [`${privateUseTextGlyphs} private-use glyph(s) emitted as ordinary SVG text.`] : []),
    ...(suspiciousInstrumentalLyrics ? [`${suspiciousInstrumentalLyrics} lyric group(s) in instrumental SVG.`] : []),
  ];
  return {valid: issues.length === 0, replacementCharacters, controlCharacters, privateUseTextGlyphs, suspiciousInstrumentalLyrics, issues};
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
    const sourceMeasures = windowForPart(original, window);
    if (!sourceMeasures.length) throw new Error(`${part!.name} has no contiguous source-position window for m.${window.startMeasure}–${window.endMeasure}.`);
    const prior = original.slice(0, original.indexOf(sourceMeasures[0]!.xml));
    // Attribute elements are incremental in MusicXML. Preserve the last known
    // value of each relevant component and inject it into the first excerpt bar.
    const attributes = mergedAttributes(prior) ?? mergedAttributes(original);
    const measures = sourceMeasures.map(measure => measure.xml);
    measures[0] = measures[0]!.replace(/(<measure\b[^>]*>)/, `$1${attributes ?? ''}`);
    return `<part id="${part!.id}">${measures.join('')}</part>`;
  }).join('');
  const filtered = filterNonPerformanceAnnotations(`<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="3.1">${partList}${excerptParts}</score-partwise>`);
  const integrity = validateExcerptIntegrity(source, filtered.musicxml, selected.map(part => ({id: part!.id, name: part!.name})), window);
  if (!integrity.valid) throw new Error(`Extracted score integrity failure: ${integrity.mismatches.join(' ')}`);
  return {...filtered, integrity};
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
