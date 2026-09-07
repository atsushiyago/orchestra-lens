import {useCallback, useEffect, useRef, useState} from 'react';
import type {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import {highlightReviewCandidates, type HighlightReviewCandidate} from '../playback/highlightReview';
import {TourTransitionCoordinator} from '../playback/tourTransitionCoordinator';

export const highlightsTourConfig = {candidateCount: 9, leadInSeconds: 3, excerptSeconds: 20, firstPlayStabilizationMilliseconds: 600, kickPauseMilliseconds: 150, secondPlayStabilizationMilliseconds: 1000, excerptWatchdogMilliseconds: 90000, seekReadyTimeoutMilliseconds: 3500} as const;
export const highlightsTourCandidates = highlightReviewCandidates.slice(0, highlightsTourConfig.candidateCount);
export type HighlightsTourPhase = 'idle' | 'seeking' | 'waiting-to-play' | 'stabilizing' | 'playing' | 'paused' | 'complete';
export const transitionSteps: readonly HighlightsTourPhase[] = ['seeking', 'waiting-to-play', 'stabilizing', 'playing'];
export const mayBeginExcerpt = (playbackAdvanced: boolean): boolean => playbackAdvanced;
export const hasPlayedExcerpt = (startTime: number, currentTime: number, duration: number): boolean => currentTime - startTime >= duration;
type PlayerAccess = {player: VideoPlayer; ready: boolean; paused: boolean; seek: (seconds: number) => void; reportError: (error: unknown) => void; debugLog: (message: string) => void};

function wait(milliseconds: number, coordinator: TourTransitionCoordinator, id: number): Promise<boolean> {
  return new Promise(resolve => { const watch = setInterval(() => { if (!coordinator.isCurrent(id)) { clearTimeout(timer); clearInterval(watch); resolve(false); } }, 25); const timer = setTimeout(() => { clearInterval(watch); resolve(coordinator.isCurrent(id)); }, milliseconds); });
}
function waitForEvent(player: VideoPlayer, events: readonly string[], milliseconds: number, coordinator: TourTransitionCoordinator, id: number, log: (message: string) => void): Promise<'event' | 'timeout' | 'cancelled'> {
  return new Promise(resolve => {
    let settled = false; const listeners: Record<string, () => void> = {};
    const finish = (result: 'event' | 'timeout' | 'cancelled') => { if (settled) return; settled = true; clearTimeout(timeout); clearInterval(watch); events.forEach(event => player.removeEventListener(event, listeners[event])); resolve(result); };
    events.forEach(event => { listeners[event] = () => { log(`transition ${id} ${event} event currentTime=${player.currentTime.toFixed(3)} paused=${player.paused}`); finish(coordinator.isCurrent(id) ? 'event' : 'cancelled'); }; player.addEventListener(event, listeners[event]); });
    const timeout = setTimeout(() => finish(coordinator.isCurrent(id) ? 'timeout' : 'cancelled'), milliseconds);
    const watch = setInterval(() => { if (!coordinator.isCurrent(id)) finish('cancelled'); }, 25);
  });
}
async function waitForAdvance(player: VideoPlayer, baseline: number, milliseconds: number, coordinator: TourTransitionCoordinator, id: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < milliseconds) {
    if (!coordinator.isCurrent(id)) return false;
    if (!player.paused && player.currentTime > baseline + .05) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return !player.paused && player.currentTime > baseline + .05;
}
/** Debug-only serial tour: no fades, one controlled pause/play recovery per seek. */
export function useHighlightsTour(access: PlayerAccess) {
  const accessRef = useRef(access); accessRef.current = access;
  const coordinator = useRef(new TourTransitionCoordinator());
  const [active, setActive] = useState(false), activeRef = useRef(false);
  const [index, setIndex] = useState(0), indexRef = useRef(0);
  const [phase, setPhase] = useState<HighlightsTourPhase>('idle'), phaseRef = useRef<HighlightsTourPhase>('idle');
  const [excerptStart, setExcerptStart] = useState<{id: number; time: number} | undefined>();
  const tourPause = useRef(false);
  const setTourPhase = (value: HighlightsTourPhase) => { phaseRef.current = value; setPhase(value); };
  const candidate = active ? highlightsTourCandidates[index] : undefined;

  const transitionTo = useCallback(async (nextIndex: number) => {
    const stop = highlightsTourCandidates[nextIndex];
    if (!stop || stop.timeSeconds === null || !accessRef.current.ready) return;
    const id = coordinator.current.begin(); indexRef.current = nextIndex; setIndex(nextIndex); setExcerptStart(undefined);
    const {player, seek, reportError, debugLog} = accessRef.current;
    const target = Math.max(0, stop.timeSeconds - highlightsTourConfig.leadInSeconds);
    debugLog(`transition ${id} rank=${stop.rank} start source=${player.currentTime.toFixed(3)} target=${target.toFixed(3)} paused=${player.paused} volume=${player.volume.toFixed(3)}`);
    // Diagnostic mode deliberately avoids fades; full volume is retained.
    tourPause.current = true; player.pause(); setTourPhase('seeking');
    const seekReady = waitForEvent(player, ['seeked', 'canplay'], highlightsTourConfig.seekReadyTimeoutMilliseconds, coordinator.current, id, debugLog);
    debugLog(`transition ${id} seek requested target=${target.toFixed(3)}`); seek(target);
    const readiness = await seekReady;
    if (readiness === 'cancelled' || !coordinator.current.isCurrent(id)) return;
    debugLog(`transition ${id} seek completed readiness=${readiness} currentTime=${player.currentTime.toFixed(3)}`);
    setTourPhase('waiting-to-play');
    const firstBaseline = player.currentTime;
    debugLog(`transition ${id} first play requested baseline=${firstBaseline.toFixed(3)}`);
    try { await player.play(); } catch (error) { reportError(error); }
    const firstAdvanced = await waitForAdvance(player, firstBaseline, highlightsTourConfig.firstPlayStabilizationMilliseconds, coordinator.current, id);
    if (!coordinator.current.isCurrent(id)) return;
    debugLog(`transition ${id} currentTime after first stabilization=${player.currentTime.toFixed(3)} advanced=${firstAdvanced}`);
    // This single controlled kick emulates the manual Pause → Play recovery observed in VVD.
    setTourPhase('stabilizing'); tourPause.current = true; player.pause();
    debugLog(`transition ${id} pause/play kick executed`);
    if (!await wait(highlightsTourConfig.kickPauseMilliseconds, coordinator.current, id)) return;
    const secondBaseline = player.currentTime;
    tourPause.current = false;
    try { await player.play(); } catch (error) { reportError(error); }
    const secondAdvanced = await waitForAdvance(player, secondBaseline, highlightsTourConfig.secondPlayStabilizationMilliseconds, coordinator.current, id);
    if (!coordinator.current.isCurrent(id)) return;
    debugLog(`transition ${id} currentTime after second play=${player.currentTime.toFixed(3)} advanced=${secondAdvanced} paused=${player.paused}`);
    if (!mayBeginExcerpt(secondAdvanced)) { debugLog(`transition ${id} playback not advancing; waiting for manual Play`); tourPause.current = false; setTourPhase('paused'); return; }
    const startTime = player.currentTime;
    debugLog(`transition ${id} EXCERPT START rank=${stop.rank} timestamp=${stop.timeSeconds.toFixed(3)} actualCurrentTime=${startTime.toFixed(3)}`);
    setExcerptStart({id, time: startTime}); setTourPhase('playing');
  }, []);
  const start = useCallback(() => { if (!accessRef.current.ready || !highlightsTourCandidates.length) return; tourPause.current = false; activeRef.current = true; setActive(true); void transitionTo(0); }, [transitionTo]);
  const exit = useCallback(() => { coordinator.current.cancel(); setExcerptStart(undefined); activeRef.current = false; setActive(false); setTourPhase('idle'); }, []);
  const next = useCallback(() => { if (!activeRef.current) return; const nextIndex = indexRef.current + 1; if (nextIndex < highlightsTourCandidates.length) void transitionTo(nextIndex); else setTourPhase('complete'); }, [transitionTo]);
  const previous = useCallback(() => { if (activeRef.current && indexRef.current > 0) void transitionTo(indexRef.current - 1); }, [transitionTo]);

  useEffect(() => {
    if (!active || tourPause.current) return;
    if (access.paused && phaseRef.current !== 'paused' && phaseRef.current !== 'idle') { coordinator.current.cancel(); setExcerptStart(undefined); setTourPhase('paused'); }
    else if (!access.paused && phaseRef.current === 'paused') { setTourPhase('playing'); setExcerptStart({id: coordinator.current.begin(), time: access.player.currentTime}); }
  }, [access]);
  useEffect(() => {
    if (!active || phase !== 'playing' || !excerptStart || access.paused) return;
    const {player, debugLog} = accessRef.current;
    const watchdogStarted = Date.now();
    const timer = setInterval(() => {
      if (!coordinator.current.isCurrent(excerptStart.id)) return;
      const played = player.currentTime - excerptStart.time;
      if (hasPlayedExcerpt(excerptStart.time, player.currentTime, highlightsTourConfig.excerptSeconds)) {
        clearInterval(timer); debugLog(`transition ${excerptStart.id} EXCERPT END currentTime=${player.currentTime.toFixed(3)} mediaSecondsPlayed=${played.toFixed(3)}`);
        if (indexRef.current + 1 < highlightsTourCandidates.length) void transitionTo(indexRef.current + 1); else setTourPhase('complete');
      } else if (Date.now() - watchdogStarted >= highlightsTourConfig.excerptWatchdogMilliseconds) {
        clearInterval(timer); debugLog(`transition ${excerptStart.id} excerpt watchdog expired mediaSecondsPlayed=${played.toFixed(3)}`); setTourPhase('paused');
      }
    }, 200);
    return () => clearInterval(timer);
  }, [access.paused, active, excerptStart, phase, transitionTo]);
  return {active, candidate, index, phase, start, exit, next, previous};
}
