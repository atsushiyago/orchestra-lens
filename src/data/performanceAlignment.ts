/**
 * Timing for one specific recording, deliberately separate from score measure
 * facts and curated interpretation. Values were aligned against the recording
 * with chroma-based score/audio matching and retained as reviewed cue anchors.
 */
export const brahmsMovement4Recording = {
  id: 'musopen-symphony-orchestra-brahms-op68-iv-cc0',
  title: 'Brahms: Symphony No. 1 in C minor, Op. 68 — IV',
  performer: 'Musopen Symphony Orchestra', // Commons Summary author/source attribution
  embeddedMetadataAuthor: 'Czech National Symphony Orchestra',
  sourcePage: 'https://commons.wikimedia.org/wiki/File:Brahms,_Symphony_No._1_in_C_Minor,_Op._68_-_IV._Adagio_-_Pi%C3%B9_andante_-_Allegro_non_troppo,_ma_con_brio.ogg',
  originalFormat: 'Ogg Vorbis, stereo 48 kHz',
  durationSeconds: 1016.928,
  license: 'CC0-1.0',
  preparedFormat: 'AAC-LC in M4A/MP4 container, stereo 48 kHz, 192 kbps',
} as const;

export const brahmsMovement4PerformanceAlignment = {
  recordingId: brahmsMovement4Recording.id,
  // Half-open cue windows are intentionally short spotlight ranges. They do
  // not imply that the music between them lacks score meaning.
  cues: {
    30: {timeSeconds: 126.36},
    47: {timeSeconds: 168.36},
    62: {timeSeconds: 271.0},
    290: {timeSeconds: generatedAlignment.measures['290'].timeSeconds},
    407: {timeSeconds: 965.28},
  },
} as const;

export const alignedCueTime = (measure: keyof typeof brahmsMovement4PerformanceAlignment.cues): number =>
  brahmsMovement4PerformanceAlignment.cues[measure].timeSeconds;
import generatedAlignment from './generated/brahms-op68-movement4-performance-alignment.json';
