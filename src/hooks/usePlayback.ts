import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import {LogUtil} from '@amazon-devices/react-native-w3cmedia/dist/LogUtils';
import {PeekSession, PendingSeekQueue, seekTo} from '../playback/controller';
import {SourceTransitionCoordinator, maySeekActiveSource, sourceIsReady} from '../playback/mediaSourceLifecycle';
import {PlayerLifecycle} from '../playback/playerLifecycle';

type PlaybackState = {time: number; duration: number; paused: boolean; ready: boolean; buffering: boolean; error: string};
const initialState: PlaybackState = {time: 0, duration: 0, paused: true, ready: false, buffering: true, error: ''};

function mediaError(player: VideoPlayer): string {
  const error = player.error;
  return error ? `MediaError ${error.code}: ${error.message || 'No diagnostic message'}` : 'Unknown media error';
}

/** Keeps native player creation, surface attachment, source loading and clock reads separate. */
export function usePlayback(uri: string, diagnosticUri?: string, autoPlay = true) {
  const playerRef = useRef<VideoPlayer | null>(null);
  if (playerRef.current === null) playerRef.current = new VideoPlayer();
  const player = playerRef.current;
  const [peek] = useState(() => new PeekSession());
  const [state, setState] = useState<PlaybackState>(initialState);
  const [reload, setReload] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [readyUri, setReadyUri] = useState<string | undefined>();
  const loadedReloadRef = useRef(-1);
  const loadedUriRef = useRef<string | undefined>(undefined);
  const requestedUriRef = useRef(uri); requestedUriRef.current = uri;
  const sourceTransitions = useRef(new SourceTransitionCoordinator());
  const lifecycle = useRef(new PlayerLifecycle());
  const activeSession = useRef(0);
  const backgroundSnapshot = useRef<{uri: string; time: number; shouldPlay: boolean} | undefined>(undefined);
  const activeSourceGeneration = useRef(0);
  const lastLoggedSecond = useRef(-1);
  const pendingSeek = useRef(new PendingSeekQueue());
  const shouldPlayWhenReady = useRef(autoPlay);
  const log = useCallback((message: string) => {
    LogUtil.info(`[OrchestraLens Playback] ${message}`);
    // The VVD's release log stream omits JavaScript console output. Mirror the
    // diagnostics to the local test server so playback verification has the
    // exact native event order and clock values.
    if (diagnosticUri) void fetch(`${diagnosticUri}?message=${encodeURIComponent(message)}`, {method: 'POST'}).catch(() => {});
  }, [diagnosticUri]);
  const reportError = useCallback((error: unknown) => {
    const diagnostic = String(error);
    LogUtil.error(`[OrchestraLens Playback] action failed ${diagnostic}`);
    setState(previous => ({...previous, error: diagnostic, buffering: false}));
  }, []);

  // Required Vega ordering step 1: create the W3C media element before using it.
  // The native player is held for the app lifetime, but decoder sessions are
  // explicitly released in the background and serialized before reactivation.
  useLayoutEffect(() => {
    let disposed = false;
    let listenersAttached = false;
    const isActiveSession = () => activeSession.current !== 0 && lifecycle.current.isCurrent(activeSession.current);
    const update = () => {
      if (disposed || !isActiveSession()) return;
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
    const mark = (name: string) => () => {if (!isActiveSession()) return; log(`${name} session=${activeSession.current} readyState=${player.readyState} currentTime=${player.currentTime.toFixed(2)} duration=${player.duration.toFixed(2)} paused=${player.paused} ended=${player.ended}`); update();};
    const onError = () => {
      if (!isActiveSession()) return;
      const diagnostic = mediaError(player);
      log(`error ${diagnostic}`);
      if (!disposed) setState(previous => ({...previous, buffering: false, error: diagnostic}));
    };
    const executeSeek = (seconds: number) => {
      try {
        log(`seek executing target=${seconds.toFixed(3)} currentTime=${player.currentTime.toFixed(3)} duration=${player.duration.toFixed(3)} readyState=${player.readyState} paused=${player.paused} ended=${player.ended}`);
        seekTo(player, seconds);
        log(`seek assigned target=${seconds.toFixed(3)} currentTime=${player.currentTime.toFixed(3)} duration=${player.duration.toFixed(3)} paused=${player.paused} ended=${player.ended}`);
      } catch (error) { reportError(error); }
    };
    const onLoadedMetadata = () => {
      if (!isActiveSession()) return;
      log(`loadedmetadata duration=${player.duration.toFixed(3)} readyState=${player.readyState}`);
      update();
    };
    const onCanPlay = () => {
      if (!isActiveSession()) return;
      const requestedUri = requestedUriRef.current;
      // A late canplay from a replaced source is not allowed to make a new URI
      // look ready. Vega retains the prior event briefly during URL switches.
      if (player.src !== requestedUri || loadedUriRef.current !== requestedUri) {
        log(`canplay ignored stale source playerUri=${player.src} requestedUri=${requestedUri} loadedUri=${loadedUriRef.current ?? 'none'} generation=${activeSourceGeneration.current}`);
        return;
      }
      log(`canplay duration=${player.duration.toFixed(2)} uri=${requestedUri} generation=${activeSourceGeneration.current}`);
      if (!disposed) { setReadyUri(requestedUri); setState(previous => ({...previous, buffering: false, ready: true})); }
      const target = pendingSeek.current.flush(true, executeSeek);
      if (target !== undefined) log(`pending seek executed target=${target.toFixed(3)}`);
      if (backgroundSnapshot.current?.uri === requestedUri) backgroundSnapshot.current = undefined;
      if (player.paused && shouldPlayWhenReady.current) {
        log('play requested after canplay');
        void player.play().then(() => log('play resolved after canplay')).catch(error => {
          log(`play rejected after canplay ${String(error)}`);
          reportError(error);
        });
      }
    };
    const onPlaying = () => {
      if (!isActiveSession()) return;
      log(`playing currentTime=${player.currentTime.toFixed(3)} duration=${player.duration.toFixed(3)} paused=${player.paused} ended=${player.ended}`);
      if (!disposed) setState(previous => ({...previous, buffering: false, ready: true, paused: false}));
    };
    const onWaiting = () => {
      if (!isActiveSession()) return;
      log('waiting');
      if (!disposed) setState(previous => ({...previous, buffering: true}));
    };
    const listeners: ReadonlyArray<readonly [string, () => void]> = [
      ['loadstart', mark('loadstart')], ['loadedmetadata', onLoadedMetadata], ['loadeddata', mark('loadeddata')],
      ['canplay', onCanPlay], ['playing', onPlaying], ['seeking', mark('seeking')], ['stalled', mark('stalled')], ['timeupdate', update],
      ['seeked', mark('seeked')], ['durationchange', mark('durationchange')], ['play', mark('play')],
      ['pause', mark('pause')], ['ended', mark('ended')], ['waiting', onWaiting], ['error', onError],
    ];
    loadedReloadRef.current = -1;
    lastLoggedSecond.current = -1;
    pendingSeek.current.clear();
    const initializeSession = async (reason: 'mount' | 'foreground') => {
      log(`initialize requested reason=${reason}`);
      try {
        const session = await lifecycle.current.initialize(player);
        if (disposed || !lifecycle.current.isCurrent(session)) return;
        activeSession.current = session;
        log(`initialize succeeded session=${session}`);
        player.autoplay = false;
        if (reason === 'foreground') {
          loadedReloadRef.current = -1;
          loadedUriRef.current = undefined;
        }
        setState(initialState);
        setInitialized(true);
      } catch (error) {
        if (disposed) return;
        const diagnostic = `initialize failed: ${String(error)}`;
        log(diagnostic);
        setState(previous => ({...previous, buffering: false, error: diagnostic}));
      }
    };
    listeners.forEach(([name, listener]) => player.addEventListener(name, listener));
    listenersAttached = true;
    log('event listeners attached');
    void initializeSession('mount');
    const appState = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        const snapshot = {uri: requestedUriRef.current, time: Number.isFinite(player.currentTime) ? player.currentTime : 0, shouldPlay: !player.paused};
        backgroundSnapshot.current = snapshot;
        shouldPlayWhenReady.current = snapshot.shouldPlay;
        activeSession.current = 0;
        peek.cancelResume();
        pendingSeek.current.clear();
        setInitialized(false);
        setReadyUri(undefined);
        setState(previous => ({...previous, ready: false, buffering: false, paused: true}));
        player.pause();
        log(`app state ${next}; releasing session uri=${snapshot.uri} time=${snapshot.time.toFixed(3)} shouldPlay=${snapshot.shouldPlay}`);
        void lifecycle.current.deinitialize(player).then(() => log('background deinitialize succeeded')).catch(error => log(`background deinitialize failed ${String(error)}`));
        return;
      }
      const snapshot = backgroundSnapshot.current;
      if (!snapshot) return;
      log(`app active; restoring session uri=${snapshot.uri} time=${snapshot.time.toFixed(3)} shouldPlay=${snapshot.shouldPlay}`);
      shouldPlayWhenReady.current = snapshot.shouldPlay;
      void initializeSession('foreground');
    });
    return () => {
      disposed = true;
      appState.remove();
      if (listenersAttached) listeners.forEach(([name, listener]) => player.removeEventListener(name, listener));
      activeSession.current = 0;
      player.pause();
      void lifecycle.current.deinitialize(player).catch(() => {});
    };
  }, [log, peek, player, reportError]);

  // KeplerVideoView stays mounted for the whole application lifecycle. For URL
  // mode, initialize first, attach listeners, assign src, then explicitly load.
  useLayoutEffect(() => {
    if (!initialized || !lifecycle.current.isCurrent(activeSession.current) || (loadedReloadRef.current === reload && loadedUriRef.current === uri)) return;
    loadedReloadRef.current = reload;
    loadedUriRef.current = uri;
    const generation = sourceTransitions.current.begin();
    activeSourceGeneration.current = generation;
    try {
      shouldPlayWhenReady.current = false;
      pendingSeek.current.clear();
      setReadyUri(undefined);
      setState(initialState);
      player.preload = 'auto';
      const restore = backgroundSnapshot.current;
      if (restore?.uri === uri) pendingSeek.current.request(restore.time, false, execute => execute);
      log(`source transition generation=${generation} session=${activeSession.current} requestedUri=${uri} previousUri=${player.src || 'none'} reload=${reload}`);
      player.src = uri;
      log(`src assigned uri=${player.src} generation=${generation}`);
      player.load();
      log(`load called after src assignment generation=${generation}`);
    } catch (error) {
      const diagnostic = `source setup failed: ${String(error)}`;
      LogUtil.error(`[OrchestraLens Playback] ${diagnostic}`);
      setState(previous => ({...previous, buffering: false, error: diagnostic}));
    }
  }, [initialized, log, player, reload, reportError, uri]);

  return {
    player, peek, readyUri, sourceReady: sourceIsReady(requestedUriRef.current, readyUri, state.ready), sourceGeneration: activeSourceGeneration.current, ...state, debugLog: log,
    retry: () => {
      // Same-source recovery intentionally reloads the existing initialized
      // native player. It never uses effect cleanup to race teardown/init.
      shouldPlayWhenReady.current = !player.paused;
      log(`retry reload requested uri=${requestedUriRef.current} currentUri=${player.src || 'none'} readyUri=${readyUri ?? 'none'} generation=${activeSourceGeneration.current}`);
      setReload(value => value + 1);
    },
    seek: (seconds: number) => {
      const canSeek = maySeekActiveSource({requestedUri: requestedUriRef.current, readyUri, ready: state.ready, duration: player.duration});
      const disposition = pendingSeek.current.request(seconds, canSeek, target => {
        try {
          log(`seek executing target=${target.toFixed(3)} currentTime=${player.currentTime.toFixed(3)} duration=${player.duration.toFixed(3)} readyState=${player.readyState} paused=${player.paused} ended=${player.ended}`);
          seekTo(player, target);
          log(`seek assigned target=${target.toFixed(3)} currentTime=${player.currentTime.toFixed(3)} duration=${player.duration.toFixed(3)} paused=${player.paused} ended=${player.ended}`);
        } catch (error) { reportError(error); }
      });
      if (disposition === 'queued') log(`pending seek target=${seconds.toFixed(3)}; waiting for current URI canplay requestedUri=${requestedUriRef.current} readyUri=${readyUri ?? 'none'} duration=${player.duration.toFixed(3)} generation=${activeSourceGeneration.current}`);
    },
    play: () => {
      shouldPlayWhenReady.current = true;
      if (!state.ready) { log('play queued until canplay'); return; }
      if (player.ended) player.currentTime = 0;
      log('play requested by user'); void player.play().catch(reportError);
    },
    pause: () => { shouldPlayWhenReady.current = false; player.pause(); },
    toggle: () => {
      if (player.paused) { shouldPlayWhenReady.current = true; if (!state.ready) {log('play queued until canplay'); return;} if (player.ended) player.currentTime = 0; log('play requested by user'); void player.play().catch(reportError); }
      else { shouldPlayWhenReady.current = false; player.pause(); }
    },
    reportError,
  };
}
