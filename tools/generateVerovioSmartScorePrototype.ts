import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {parseMeasure, parseScoreParts, selectPrototypeCues} from './generateSmartScorePrototype';
import {createVerovioToolkit, extractMusicXmlExcerpt, type ExcerptWindow} from './generateVerovioSmartScoreProof';
import type {ListeningCue, ListeningCueManifest} from './generateListeningCues';

type Complexity = {multipleVoices: boolean; tuplets: boolean; ties: boolean; beams: boolean; dynamics: boolean; articulations: boolean; transpose: boolean; warnings: string[]};
type LayoutCheck = {systemCount: number; viewBox: string | null; structurallyFitsTvOverlay: boolean; status: 'STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED' | 'NEEDS GENERIC LAYOUT TUNING'};
export type VerovioBatchManifest = {
  generator: {version: 1; renderer: {name: 'Verovio'; version: string; package: 'verovio'; license: 'LGPL-3.0-or-later'}; options: Record<string, unknown>; pipeline: string};
  cues: Array<{cueId: string; measure: number; timestampSec: number; label: string; recommendedStaves: string[]; renderWindow: ExcerptWindow; musicxml: string; svg: string; extractionWarnings: string[]; complexity: Complexity; layout: LayoutCheck}>;
};

// One layout profile deliberately applies to every generated cue. These values
// target a score card inside a 1280 × 720 TV surface without cue-specific edits.
export const tvVerovioOptions = {pageWidth: 1200, pageHeight: 500, pageMarginLeft: 14, pageMarginRight: 14, pageMarginTop: 12, pageMarginBottom: 12, scale: 55, breaks: 'none', adjustPageHeight: true, footer: 'none', header: 'none', svgViewBox: true};
const windowFor = (cue: ListeningCue): ExcerptWindow => ({startMeasure: Math.max(1, cue.measure - 1), endMeasure: cue.measure + 2});
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const complexityFor = (source: string, excerpt: string, staves: readonly string[], window: ExcerptWindow): Complexity => {
  const parts = parseScoreParts(source); const target = new Set(staves.map(name => name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const selected = parts.filter(part => target.has(part.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const measures = selected.flatMap(part => [...part.measures.entries()].filter(([number]) => number >= window.startMeasure && number <= window.endMeasure).map(([number, xml]) => ({part: part.name, number, xml, parsed: parseMeasure(xml)})));
  const warnings = measures.flatMap(item => item.parsed.unsupported.map(warning => `${item.part}, m.${item.number}: ${warning}`));
  const raw = measures.map(item => item.xml).join('\n');
  return {multipleVoices: warnings.some(warning => warning.includes('Multiple voices')), tuplets: warnings.some(warning => warning.includes('Tuplets')), ties: /<tie\b|<tied\b/.test(raw), beams: /<beam\b/.test(raw), dynamics: /<dynamics\b/.test(raw), articulations: /<(staccato|accent)\b/.test(raw), transpose: /<transpose\b/.test(excerpt), warnings: [...new Set(warnings)]};
};
const boundaryWarnings = (musicxml: string): string[] => {
  const count = (pattern: RegExp) => (musicxml.match(pattern) ?? []).length;
  const warnings: string[] = ['Part groups and non-selected parts are omitted; selected MusicXML note and direction payloads are retained verbatim.'];
  if (count(/<tie\b[^>]*type="start"/g) !== count(/<tie\b[^>]*type="stop"/g)) warnings.push('Excerpt boundary intersects one or more MusicXML ties; Verovio retains the in-window notation and may warn about the open boundary.');
  if (count(/<slur\b[^>]*type="start"/g) !== count(/<slur\b[^>]*type="stop"/g)) warnings.push('Excerpt boundary intersects one or more MusicXML slurs; Verovio retains the in-window notation and may warn about the open boundary.');
  return warnings;
};
const layoutFor = (svg: string): LayoutCheck => {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1] ?? null; const numbers = viewBox?.trim().split(/\s+/).map(Number); const systemCount = (svg.match(/class="system(?:\s|\")/g) ?? []).length;
  const structurallyFitsTvOverlay = systemCount === 1 && !!numbers && numbers.length === 4 && numbers[2]! <= 1200 && numbers[3]! <= 600;
  return {systemCount, viewBox, structurallyFitsTvOverlay, status: structurallyFitsTvOverlay ? 'STRUCTURAL PASS — USER VISUAL REVIEW REQUIRED' : 'NEEDS GENERIC LAYOUT TUNING'};
};

/** Generates the same generic representative subset used by the custom SVG prototype. */
export async function generateVerovioSmartScorePrototype(scorePath: string, cuePath: string, outputDirectory: string): Promise<VerovioBatchManifest> {
  const source = readFileSync(scorePath, 'utf8'); const cueManifest = JSON.parse(readFileSync(cuePath, 'utf8')) as ListeningCueManifest; const cues = selectPrototypeCues(cueManifest.cues); if (cues.length !== 6) throw new Error(`Expected six generic prototype cues, received ${cues.length}.`);
  const output = resolve(outputDirectory); rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true}); const toolkit = await createVerovioToolkit(); toolkit.setOptions(tvVerovioOptions);
  const entries = cues.map(cue => {
    const renderWindow = windowFor(cue); const musicxml = extractMusicXmlExcerpt(source, cue.recommendedStaves, renderWindow); const xmlAsset = `cue-${cue.id}.musicxml`; const svgAsset = `cue-${cue.id}.svg`; writeFileSync(join(output, xmlAsset), `${musicxml}\n`);
    const status = toolkit.loadData(musicxml); if (status !== 1) throw new Error(`Verovio failed to load m.${cue.measure} (status ${status}).`); const svg = toolkit.renderToSVG(1, {}); writeFileSync(join(output, svgAsset), svg);
    const complexity = complexityFor(source, musicxml, cue.recommendedStaves, renderWindow); return {cueId: cue.id, measure: cue.measure, timestampSec: cue.timestampSec, label: cue.label, recommendedStaves: [...cue.recommendedStaves], renderWindow, musicxml: xmlAsset, svg: svgAsset, extractionWarnings: boundaryWarnings(musicxml), complexity, layout: layoutFor(svg)};
  });
  const manifest: VerovioBatchManifest = {generator: {version: 1, renderer: {name: 'Verovio', version: toolkit.getVersion(), package: 'verovio', license: 'LGPL-3.0-or-later'}, options: tvVerovioOptions, pipeline: 'Listening Cue → recommended staves → standalone MusicXML excerpt → local Verovio WASM → SVG'}, cues: entries};
  writeFileSync(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const report = [`# Verovio Smart Score production prototype`, '', `Renderer: Verovio ${manifest.generator.renderer.version} (${manifest.generator.renderer.license}), invoked locally through the official npm WASM toolkit.`, '', '## Generic TV layout', '', `\`${JSON.stringify(tvVerovioOptions)}\``, '', 'Tradeoff: `breaks: none` favors one compact system per cue and uses the full 1200px page width. Dense passages remain structurally within the overlay target, but final distance-readability is a human visual decision.', '', '## Cue results', ''];
  for (const cue of entries) { report.push(`### m.${cue.measure} — ${cue.label}`, '', `Timestamp: ${cue.timestampSec.toFixed(3)}s`, '', `Staves: ${cue.recommendedStaves.join(', ')}`, '', `Window: m.${cue.renderWindow.startMeasure}–${cue.renderWindow.endMeasure}`, '', `Layout: ${cue.layout.status}; ${cue.layout.systemCount} system(s), viewBox ${cue.layout.viewBox ?? 'unavailable'}.`, '', `Extraction: ${cue.extractionWarnings.join(' ')}`, '', `Complexity: ${cue.complexity.warnings.length ? cue.complexity.warnings.join(' ') : 'No multiple-voice or tuplet warning; ties/beams/dynamics remain in the MusicXML when present.'}`, ''); }
  writeFileSync(join(output, 'report.md'), `${report.join('\n')}\n`);
  const cards = entries.map(cue => `<article><h2>${escapeHtml(cue.label)} · m.${cue.measure}</h2><p>${cue.timestampSec.toFixed(3)}s · ${escapeHtml(cue.recommendedStaves.join(', '))} · m.${cue.renderWindow.startMeasure}–${cue.renderWindow.endMeasure}</p><p><strong>${escapeHtml(cue.layout.status)}</strong> · ${cue.layout.systemCount} system(s)</p><p>Warnings: ${escapeHtml(cue.complexity.warnings.join(' ') || 'None')}</p><img src="${escapeHtml(cue.svg)}" alt="Verovio-rendered score for measure ${cue.measure}"/></article>`).join('\n');
  writeFileSync(join(output, 'review.html'), `<!doctype html><meta charset="utf-8"><title>Verovio Smart Score production prototype</title><style>body{margin:30px;background:#101720;color:#edf4fc;font:18px system-ui}h1,h2{color:#f1cd87}p{color:#c7d6e7}article{background:#1c2632;padding:18px;margin:22px 0;border-radius:10px}img{display:block;width:100%;background:#fffdf8}</style><h1>Verovio Smart Score production prototype · Brahms 1 / IV</h1><p>Six generated Listening Cues, all rendered with one generic TV layout profile. No SVG was manually edited.</p>${cards}`);
  return manifest;
}

async function main(): Promise<void> { const [score, cues, output] = process.argv.slice(2); if (!score || !cues || !output) throw new Error('Usage: npm run generate:verovio-smart-score-prototype -- <score.musicxml> <listening-cues.json> <output-dir>'); const result = await generateVerovioSmartScorePrototype(score, cues, output); process.stdout.write(`Generated ${result.cues.length} Verovio prototype score excerpts.\n`); }
if (process.argv[1]?.endsWith('generateVerovioSmartScorePrototype.ts')) void main();
