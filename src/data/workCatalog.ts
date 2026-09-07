import brahmsAlignment from './generated/brahms-op68-movement4-performance-alignment.json';
import beethovenAlignment from './generated/beethoven-op67-movement1-performance-alignment.json';
import brahmsHighlights from './generated/brahms-op68-movement4-highlights.json';
import beethovenHighlights from './generated/beethoven-op67-movement1-highlights.json';
import brahmsTourSelection from './generated/brahms-op68-movement4-tour-selection.json';
import beethovenTourSelection from './generated/beethoven-op67-movement1-tour-selection.json';
import {mediaSource} from './media';
import {scoreEvents} from './brahms1Movement4';
import type {ScoreEvent} from '../types/score';
import {releaseTourCandidatesFrom, type ReleaseTourCandidate} from './tourCandidates';
import {brahmsGuidedListeningCues} from './guidedListening';

export type WorkId = 'brahms-op68-4' | 'beethoven-op67-1';
export type WorkCapabilities = {
  fullMovement: boolean;
  highlightsTour: boolean;
  smartScore: boolean;
  orchestraXRay: boolean;
  askTheScore: boolean;
  themeLens: boolean;
  guidedListening: boolean;
};

export type OrchestraLensWork = {
  id: WorkId;
  composer: string;
  workTitle: string;
  movementTitle: string;
  movementNumber: string;
  media: {uri: string; durationSeconds: number; recordingId: string};
  generated: {
    alignment: unknown;
    highlights: unknown;
    tourSelector: unknown;
    runtimeScoreFactsPath?: string;
    hauptstimmeEvidencePath: string;
  };
  capabilities: WorkCapabilities;
  scoreEvents: readonly ScoreEvent[];
  tourCandidates: readonly ReleaseTourCandidate[];
  /** Pre-generated, read-only cards; omitted for works without this capability. */
  guidedListeningCues?: readonly import('../../tools/generateGuidedListeningRuntime').GuidedListeningRuntimeCue[];
};

const brahms: OrchestraLensWork = {
  id: 'brahms-op68-4', composer: 'BRAHMS', workTitle: 'Symphony No. 1 in C minor, Op. 68', movementTitle: 'IV. Adagio – Allegro non troppo', movementNumber: 'IV',
  media: {uri: mediaSource.uri, durationSeconds: 1016.928, recordingId: mediaSource.recordingId},
  generated: {
    alignment: brahmsAlignment, highlights: brahmsHighlights, tourSelector: brahmsTourSelection,
    runtimeScoreFactsPath: 'src/data/generated/runtimeScoreFacts.json', hauptstimmeEvidencePath: 'src/data/generated/hauptstimmeEvidence.json',
  },
  capabilities: {fullMovement: true, highlightsTour: true, smartScore: true, orchestraXRay: true, askTheScore: true, themeLens: true, guidedListening: true},
  scoreEvents,
  tourCandidates: releaseTourCandidatesFrom(brahmsTourSelection),
  guidedListeningCues: brahmsGuidedListeningCues,
};

const beethoven: OrchestraLensWork = {
  id: 'beethoven-op67-1', composer: 'BEETHOVEN', workTitle: 'Symphony No. 5 in C minor, Op. 67', movementTitle: 'I. Allegro con brio', movementNumber: 'I',
  media: {uri: 'https://d25q8u9cz8hosu.cloudfront.net/media/beethoven-op67-movement1-musopen-pd.m4a', durationSeconds: 500.088, recordingId: 'musopen-beethoven-op67-i-pd'},
  generated: {
    alignment: beethovenAlignment, highlights: beethovenHighlights, tourSelector: beethovenTourSelection,
    hauptstimmeEvidencePath: 'src/data/generated/beethoven-op67-movement1-hauptstimme-evidence.json',
  },
  capabilities: {fullMovement: true, highlightsTour: true, smartScore: false, orchestraXRay: false, askTheScore: false, themeLens: false, guidedListening: false},
  scoreEvents: [],
  tourCandidates: releaseTourCandidatesFrom(beethovenTourSelection),
};

/** Release catalog: capabilities describe what is actually implemented for each work. */
export const workCatalog: readonly OrchestraLensWork[] = [brahms, beethoven];
export const workById = (id: WorkId): OrchestraLensWork => {
  const work = workCatalog.find(candidate => candidate.id === id);
  if (!work) throw new Error(`Unknown Orchestra Lens work: ${id}`);
  return work;
};
export const defaultWork = brahms;
/** A work switch reloads the mounted player only when its media URI differs. */
export const workSwitchNeedsSourceReload = (from: OrchestraLensWork, to: OrchestraLensWork): boolean => from.media.uri !== to.media.uri;
