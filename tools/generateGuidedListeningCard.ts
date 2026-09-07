import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import type {ListeningCue, ListeningCueManifest} from './generateListeningCues';
import type {ScoreManifest, ScoreManifestPart} from './generateScoreManifest';

export type GuidedListeningCard = {
  cueId: string;
  label: string;
  listenerHint: string;
  mainVoice?: {instrument: string; evidence: 'hauptstimme'; basis: string};
  activeInstruments: string[];
  scoreAsset: string;
  work: {composer: string; title: string; movement: string};
  provenance: {generated: string[]; derived: string[]; curated: string[]};
};

const normalize = (value: string) => value.toLowerCase().replace(/flute/g, 'fl').replace(/clarinet/g, 'cl').replace(/bassoon/g, 'bsn').replace(/[^a-z0-9]/g, '');
const displayInstrument = (name: string) => name.replace(/^Bb /, 'B♭ ').replace(/\b(\d+)\b/g, (_, value) => ['I', 'II', 'III', 'IV'][Number(value) - 1] ?? value);
const matchesEvidence = (part: ScoreManifestPart, cue: ListeningCue) => cue.hauptstimme.some(item => normalize(part.name).includes(normalize(item.part)) || normalize(item.part).includes(normalize(part.name)) || normalize(part.name).includes(normalize(item.instrument)));
const objectiveHint = (cue: ListeningCue): string => {
  const reason = (kind: string) => cue.reasons.some(item => item.kind === kind);
  if (reason('instrument-entry')) return 'Listen as new instruments enter.';
  if (reason('instrument-dropout')) return 'Notice instruments dropping out.';
  if (reason('texture-change')) return cue.reasons.some(item => /decreases/.test(item.text)) ? 'Notice the texture thinning.' : 'Notice the texture building.';
  if (reason('orchestration-change')) return cue.reasons.some(item => /contracts/.test(item.text)) ? 'Notice the orchestra contracting.' : 'Notice the orchestra expanding.';
  if (reason('dynamic-change')) return 'Notice the dynamic change.';
  if (reason('pitch-range-change')) return 'Notice the written range changing.';
  if (/^STRINGS\b/.test(cue.label)) return 'Listen to the selected string voices.';
  if (/^WOODWINDS\b/.test(cue.label)) return 'Listen to the selected woodwind voices.';
  if (/^BRASS\b/.test(cue.label)) return 'Listen to the selected brass voices.';
  return 'Notice the selected active voices.';
};

/** Builds a future-ready card from generated cue facts plus a rendered Verovio asset. */
export function buildGuidedListeningCard(cue: ListeningCue, score: ScoreManifest, scoreAsset: string, work: GuidedListeningCard['work']): GuidedListeningCard {
  const measure = score.measures[String(cue.measure)]; if (!measure) throw new Error(`No generated score facts for m.${cue.measure}.`);
  const selected = cue.recommendedStaves.map(name => measure.parts.find(part => part.name === name)).filter((part): part is ScoreManifestPart => !!part);
  if (selected.length !== cue.recommendedStaves.length) throw new Error(`Generated score facts do not resolve every recommended staff for ${cue.id}.`);
  const main = selected.find(part => matchesEvidence(part, cue));
  const mainVoice = main ? {instrument: displayInstrument(main.name), evidence: 'hauptstimme' as const, basis: 'Hauptstimme marks this part as the main voice at this cue.'} : undefined;
  const activeInstruments = selected.filter(part => part !== main).map(part => displayInstrument(part.name));
  const listenerHint = mainVoice ? `Follow ${mainVoice.instrument} — the annotated main voice.` : objectiveHint(cue);
  return {cueId: cue.id, label: cue.label, listenerHint, mainVoice, activeInstruments, scoreAsset, work, provenance: {generated: ['Listening Cue label and recommended staves', 'Hauptstimme evidence', 'MusicXML selected active parts', 'Verovio SVG asset'], derived: ['Main-voice display only when Hauptstimme evidence is present', 'Listener-facing hint'], curated: []}};
}

export const guidedListeningCardHtml = (card: GuidedListeningCard) => {
  const mainVoice = card.mainVoice ? `<div class="main-voice"><span class="dot">●</span><div><span class="main-instrument">${card.mainVoice.instrument}</span><span class="main-role">MAIN VOICE</span></div></div>` : '';
  const sounding = card.activeInstruments.map(instrument => `<span>${instrument}</span>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Orchestra Lens · Guided Listening</title><style>*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#0a1018;font-family:Inter,system-ui,sans-serif;color:#f8f3e9}.card{width:1280px;height:720px;padding:36px 46px 28px;background:radial-gradient(ellipse at 78% 20%,#293a4a 0%,#111b27 39%,#0a1018 78%);display:flex;flex-direction:column}.context{color:#c1cbd4;font-size:18px;letter-spacing:.04em}.context b{color:#f1c46d;font-weight:700}.body{display:grid;grid-template-columns:34% 66%;gap:28px;align-items:center;flex:1;min-height:0}.eyebrow{color:#f1c46d;font-size:18px;font-weight:800;letter-spacing:.18em;margin:0 0 10px}.label{font:800 47px/1.02 Georgia,serif;letter-spacing:-.035em;margin:0 0 17px}.hint{font:25px/1.22 Georgia,serif;color:#edf0f1;margin:0 0 27px}.xray-title{font-size:16px;font-weight:800;letter-spacing:.16em;color:#a8bbc7;margin:0 0 12px}.main-voice{display:flex;gap:13px;align-items:center;color:#f5cf7a;padding:5px 0 16px}.dot{font-size:26px}.main-instrument{display:block;font-size:29px;font-weight:800;letter-spacing:.02em}.main-role{display:block;font-size:15px;font-weight:800;letter-spacing:.14em;margin-top:2px}.sounding-title{font-size:14px;font-weight:800;letter-spacing:.15em;color:#9bb0be;margin:3px 0 8px}.sounding{display:grid;gap:5px;color:#e4ebef;font-size:19px;font-weight:650}.score-panel{background:#fdfaf3;border-radius:12px;padding:13px 17px 12px;box-shadow:0 14px 42px rgba(0,0,0,.22)}.score-caption{margin:0 0 6px;color:#263541;font-size:14px;font-weight:800;letter-spacing:.14em}.score{display:block;width:100%;height:auto;max-height:500px;object-fit:contain;object-position:center}.footer{margin-top:10px;color:#9aabb8;font-size:14px;font-weight:700;letter-spacing:.12em}@media(max-width:1280px){body,.card{transform-origin:top left}}</style><main class="card"><header class="context"><b>ORCHESTRA LENS</b> &nbsp;·&nbsp; ${card.work.composer} &nbsp;·&nbsp; ${card.work.title} &nbsp;·&nbsp; ${card.work.movement}</header><section class="body"><section><p class="eyebrow">WHAT TO HEAR</p><h1 class="label">${card.label}</h1><p class="hint">${card.listenerHint}</p><p class="xray-title">ORCHESTRA X-RAY</p>${mainVoice}<p class="sounding-title">ALSO SOUNDING</p><div class="sounding">${sounding}</div></section><section class="score-panel"><p class="score-caption">SMART SCORE</p><img class="score" src="${card.scoreAsset}" alt="Verovio Smart Score for ${card.label}"/></section></section><footer class="footer">GUIDED LISTENING</footer></main>`;
};

export function generateGuidedListeningCard(scorePath: string, cuePath: string, verovioManifestPath: string, verovioAssetDirectory: string, outputDirectory: string, cueId: string, work: GuidedListeningCard['work']): GuidedListeningCard {
  const score = JSON.parse(readFileSync(scorePath, 'utf8')) as ScoreManifest; const cues = JSON.parse(readFileSync(cuePath, 'utf8')) as ListeningCueManifest; const verovio = JSON.parse(readFileSync(verovioManifestPath, 'utf8')) as {cues: Array<{cueId: string; svg: string}>}; const cue = cues.cues.find(item => item.id === cueId); if (!cue) throw new Error(`Unknown generated Listening Cue ${cueId}.`); const rendered = verovio.cues.find(item => item.cueId === cue.id); if (!rendered) throw new Error(`No Verovio asset for ${cue.id}.`);
  const card = buildGuidedListeningCard(cue, score, 'score.svg', work); const output = resolve(outputDirectory); rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true}); cpSync(join(resolve(verovioAssetDirectory), rendered.svg), join(output, 'score.svg')); writeFileSync(join(output, 'card.json'), `${JSON.stringify(card, null, 2)}\n`); writeFileSync(join(output, 'review.html'), guidedListeningCardHtml(card));
  writeFileSync(join(output, 'summary.md'), `# Guided Listening Card template refinement\n\n## Before → after\n\n- Removed inferred \`LEAD\`, \`SUPPORT\`, and \`FOUNDATION\` roles.\n- \`mainVoice\` is now emitted only when Hauptstimme evidence identifies a selected part.\n- Other selected parts are displayed as \`ALSO SOUNDING\`, an objective active-part statement.\n- The listener hint is reduced to one TV-readable grounded sentence.\n- The duplicated footer tagline was removed; \`GUIDED LISTENING\` remains as the sole subtle mode indicator.\n\n## Layout\n\nThe review page is exactly 1280 × 720. It uses a 34% insight column and 66% Smart Score column; the Verovio SVG is allowed up to 500px tall, approximately 10–15% larger than the prior 455px treatment.\n\n## Score emphasis\n\nNo score-staff highlight is applied. The score remains an external, unedited Verovio SVG; this template does not assume stable staff-label element IDs or SVG coordinates. The warm Main Voice treatment in Orchestra X-Ray provides the visual connection without a brittle SVG hack.\n\n## Evidence\n\nGenerated/objective: Listening Cue label and selected staves, Hauptstimme evidence, active MusicXML parts, and Verovio SVG.\n\nDerived: the Main Voice presentation and concise listener hint, only when Hauptstimme evidence is available.\n\nCurated: none.\n`); return card;
}

function main(): void { const [score, cues, verovioManifest, verovioAssets, output, cueId] = process.argv.slice(2); if (!score || !cues || !verovioManifest || !verovioAssets || !output || !cueId) throw new Error('Usage: npm run generate:guided-listening-card -- <score-manifest.json> <listening-cues.json> <verovio-manifest.json> <verovio-assets-dir> <output-dir> <cue-id>'); const card = generateGuidedListeningCard(score, cues, verovioManifest, verovioAssets, output, cueId, {composer: 'Brahms', title: 'Symphony No. 1', movement: 'Movement IV'}); process.stdout.write(`Generated Guided Listening Card for ${card.cueId}.\n`); }
if (process.argv[1]?.endsWith('generateGuidedListeningCard.ts')) main();
