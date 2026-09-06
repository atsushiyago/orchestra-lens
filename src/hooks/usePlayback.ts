import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import {LogUtil} from '@amazon-devices/react-native-w3cmedia/dist/LogUtils';
import {PeekSession, seekTo} from '../playback/controller';

type PlaybackState = {time: number; duration: number; paused: boolean; ready: boolean; buffering: boolean; error: string};
const initialState: PlaybackState = {time: 0, duration: 0, paused: true, ready: false, buffering: true, error: ''};

function mediaError(player: VideoPlayer): string {
  const error = player.error;
  return error ? `MediaError ${error.code}: ${error.message || 'No diagnostic message'}` : 'Unknown media error';
}

/** Keeps native player creation, surface attachment, source loading and clock reads separate. */
export function usePlayback(uri: string, diagnosticUri?: string) {
  const playerRef = useRef<VideoPlayer | null>(null);
  if (playerRef.current === null) playerRef.current = new VideoPlayer();
  const player = playerRef.current;
  const [peek] = useState(() => new PeekSession());
  const [state, setState] = useState<PlaybackState>(initialState);
  const [attempt, setAttempt] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const loadedAttemptRef = useRef(-1);
  const lastLoggedSecond = useRef(-1);
  const log = useCallback((message: string) => {
    LogUtil.info(`[OrchestraLens Playback] ${message}`);
    // The VVD's release log stream omits JavaScript console output. Mirror the
    // diagnostics to the local test server so playback verification has the
    // exact native event order and clock values.
    if (diagnosticUri) void fetch(`${diagnosticUri}?message=${encodeURIComponent(message)}`, {method: 'POST'}).catch(() => {});
  }, [diagnosticUri]);

  // Required Vega ordering step 1: create the W3C media element before using it.
  useLayoutEffect(() => {
    let disposed = false;
    let listenersAttached = false;
    const update = () => {
      if (disposed) return;
      const time = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      const duration = Number.isFinite(player.duration) ? player.duration : 0;
      const second = Math.floor(time);
      if (second !== lastLoggedSecond.current) {
        lastLoggedSecond.current = second;
        log(`currentTime=${time.toFixed(2)} duration=${duration.toFixed(2)} paused=${player.paused}`);
      }
      setState(previous => previous.time === time && previous.duration === duration && previous.paused === player.paused
        ? previous : {...previous, time, duration, paused: player.paused});
    };
    const mark = (name: string) => () => {log(`${name} readyState=${player.readyState} currentTime=${player.currentTime.toFixed(2)}`); update();};
    const onError = () => {
      const diagnostic = mediaError(player);
      log(`error ${diagnostic}`);
      if (!disposed) setState(previous => ({...previous, buffering: false, error: diagnostic}));
    };
    const onCanPlay = () => {
      log(`canplay duration=${player.duration.toFixed(2)}`);
      if (!disposed) setState(previous => ({...previous, buffering: false, ready: true}));
    };
    const onPlaying = () => {
      log('playing');
      if (!disposed) setState(previous => ({...previous, buffering: false, ready: true, paused: false}));
    };
    const onWaiting = () => {
      log('waiting');
      if (!disposed) setState(previous => ({...previous, buffering: true}));
    };
    const listeners: ReadonlyArray<readonly [string, () => void]> = [
      ['loadstart', mark('loadstart')], ['loadedmetadata', mark('loadedmetadata')], ['loadeddata', mark('loadeddata')],
      ['canplay', onCanPlay], ['playing', onPlaying], ['stalled', mark('stalled')], ['timeupdate', update],
      ['seeked', mark('seeked')], ['durationchange', mark('durationchange')], ['play', mark('play')],
      ['pause', mark('pause')], ['ended', mark('ended')], ['waiting', onWaiting], ['error', onError],
    ];
    loadedAttemptRef.current = -1;
    lastLoggedSecond.current = -1;
    setInitialized(false);
    setState(initialState);
    log(`initialize requested attempt=${attempt}`);
    const initialization = player.initialize().then(() => {
      if (disposed) return;
      log('initialize succeeded');
      player.autoplay = false;
      listeners.forEach(([name, listener]) => player.addEventListener(name, listener));
      listenersAttached = true;
      log('event listeners attached');
      setInitialized(true);
    }).catch(error => {
      const diagnostic = `initialize failed: ${String(error)}`;
      log(diagnostic);
      if (!disposed) setState(previous => ({...previous, buffering: false, error: diagnostic}));
    });
    const appState = AppState.addEventListener('change', next => {
      if (next !== 'active') {log(`app state ${next}; pausing`); peek.cancelResume(); player.pause();}
    });
    return () => {
      disposed = true;
      appState.remove();
      if (listenersAttached) listeners.forEach(([name, listener]) => player.removeEventListener(name, listener));
      player.pause();
      void initialization.then(() => player.deinitialize()).catch(() => {});
    };
  }, [attempt, log, peek, player]);

  // KeplerVideoView owns the render-surface lifecycle for one direct URL player.
  // Assigning src starts Vega's resource-selection algorithm, so do it once after
  // initialize() and do not call load() a second time.
  useLayoutEffect(() => {
    if (!initialized || loadedAttemptRef.current === attempt) return;
    loadedAttemptRef.current = attempt;
    try {
      player.preload = 'auto';
      player.src = uri;
      log(`src assigned uri=${player.src}`);
      // Vega's URL-mode reference implementation starts playback immediately
      // after source selection; it must not depend on canplay being dispatched.
      void player.play().then(() => log('initial play() resolved')).catch(error => {
        log(`initial play() rejected ${String(error)}`);
        reportError(error);
      });
    } catch (error) {
      const diagnostic = `source setup failed: ${String(error)}`;
      LogUtil.error(`[OrchestraLens Playback] ${diagnostic}`);
      setState(previous => ({...previous, buffering: false, error: diagnostic}));
    }
  }, [attempt, initialized, log, player, uri]);
  const reportError = useCallback((error: unknown) => {
    const diagnostic = String(error);
    LogUtil.error(`[OrchestraLens Playback] action failed ${diagnostic}`);
    setState(previous => ({...previous, error: diagnostic, buffering: false}));
  }, []);

  return {
    player, peek, ...state,
    retry: () => setAttempt(value => value + 1),
    seek: (seconds: number) => {if (state.ready) try {seekTo(player, seconds);} catch (error) {reportError(error);}},
    toggle: () => {
      if (!state.ready) return;
      if (player.paused) {if (player.ended) player.currentTime = 0; void player.play().catch(reportError);}
      else player.pause();
    },
    reportError,
  };
}
