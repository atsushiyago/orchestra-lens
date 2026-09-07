import runtimeManifest from './generated/brahms-op68-movement4-guided-listening-runtime.json';
import type {GuidedListeningRuntimeManifest, GuidedListeningRuntimeCue} from '../../tools/generateGuidedListeningRuntime';
export type {GuidedListeningRuntimeCue} from '../../tools/generateGuidedListeningRuntime';

export type GuidedListeningCapableWork = {capabilities: {guidedListening: boolean}; guidedListeningCues?: readonly GuidedListeningRuntimeCue[]};
const brahmsRuntime = runtimeManifest as GuidedListeningRuntimeManifest;

/** Compact, generated data only: current media time determines the visible card. */
export const brahmsGuidedListeningCues: readonly GuidedListeningRuntimeCue[] = brahmsRuntime.cues;

export const activeGuidedListeningCue = (cues: readonly GuidedListeningRuntimeCue[], currentTime: number): GuidedListeningRuntimeCue | undefined =>
  cues.find(cue => currentTime >= cue.startTime && currentTime < cue.endTime);

export const guidedListeningCuesFor = (work: GuidedListeningCapableWork): readonly GuidedListeningRuntimeCue[] =>
  work.capabilities.guidedListening ? work.guidedListeningCues ?? [] : [];
