import React, {useEffect, useRef, useState} from 'react';
import {BackHandler, View, Text, StyleSheet, useTVEventHandler} from 'react-native';
import {VideoPlayer} from './components/VideoPlayer';
import {MusicalContextOverlay} from './components/MusicalContextOverlay';
import {ScorePeek} from './components/ScorePeek';
import {TVButton} from './components/TVButton';
import {ExperienceEntry} from './components/ExperienceEntry';
import {HighlightReviewPanel} from './components/HighlightReviewPanel';
import {HighlightsTourPanel} from './components/HighlightsTourPanel';
import {TourSelectorReviewPanel} from './components/TourSelectorReviewPanel';
import {scoreEvents, work} from './data/brahms1Movement4';
import {mediaSource} from './data/media';
import {developmentReviewMediaFor} from './data/developmentReviewWorks';
import {selectorTourCandidatesFor, selectorTourCountFor} from './data/developmentTourSelectorWorks';
import {ReviewTransitionCoordinator, reviewTransitionReady} from './playback/reviewTransitionCoordinator';
import {showDevelopmentControls} from './data/listeningExperiences';
import {usePlayback} from './hooks/usePlayback';
import {useScoreSynchronization} from './hooks/useScoreSynchronization';
import {developmentCueTarget} from './playback/developmentCueNavigation';
import {leaveFullMovementForMenu} from './playback/listeningNavigation';
import {developmentValidationScoreEvents} from './playback/developmentScoreEvents';
import {clearHighlightReviewDecision, highlightReviewCandidates, highlightReviewCandidatesFor, highlightReviewDecision, highlightReviewTarget, highlightReviewWorkLabels, isHighlightReviewAvailable, setHighlightReviewDecision, type HighlightReviewCandidate, type HighlightReviewDecisions, type HighlightReviewWork} from './playback/highlightReview';
import {highlightsTourCandidates, useHighlightsTour} from './hooks/useHighlightsTour';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
type Experience = 'entry' | 'full-movement' | 'review-selector' | 'tour-selector-review-selector';

export default function App() {
  const [activeMediaUri, setActiveMediaUri] = useState<string>(mediaSource.uri);
  const playback = usePlayback(activeMediaUri, mediaSource.diagnosticUri, false);
  const event = useScoreSynchronization(__DEV__ ? developmentValidationScoreEvents : scoreEvents, playback.time);
  const [experience, setExperience] = useState<Experience>('entry');
  const [peekOpen, setPeekOpen] = useState(false);
  const [debugCue, setDebugCue] = useState<{measure: number; timeSeconds: number; automatic: boolean} | undefined>();
  const [highlightReviewOpen, setHighlightReviewOpen] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<HighlightReviewCandidate | undefined>();
  const [reviewWork, setReviewWork] = useState<HighlightReviewWork>('brahms-op68-4');
  const reviewCoordinator = useRef(new ReviewTransitionCoordinator());
  const [reviewTransition, setReviewTransition] = useState(0);
  const [pendingTourStart, setPendingTourStart] = useState(false);
  const [selectorTourWork, setSelectorTourWork] = useState<HighlightReviewWork>('brahms-op68-4');
  const [pendingSelectorTourStart, setPendingSelectorTourStart] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState<HighlightReviewDecisions>({});
  const tour = useHighlightsTour({player: playback.player, ready: playback.ready, paused: playback.paused, seek: playback.seek, reportError: playback.reportError, debugLog: playback.debugLog});
  const selectorTourCandidates = selectorTourCandidatesFor(selectorTourWork);
  const selectorTour = useHighlightsTour({player: playback.player, ready: playback.ready, paused: playback.paused, seek: playback.seek, reportError: playback.reportError, debugLog: playback.debugLog}, selectorTourCandidates);
  const close = () => {
    setPeekOpen(false);
    if (playback.player) void playback.peek.leave(playback.player).catch(playback.reportError);
  };
  const open = () => {
    if (!playback.player || !playback.ready || playback.error) return;
    playback.peek.enter(playback.player);
    setPeekOpen(true);
  };
  const playFullMovement = () => { setExperience('full-movement'); playback.play(); };
  const backToMenu = () => {
    const action = leaveFullMovementForMenu();
    if (action.pause) playback.pause();
    setExperience(action.destination);
  };
  const startTour = () => {
    if (!playback.ready || playback.error) return;
    setExperience('full-movement');
    if (activeMediaUri !== mediaSource.uri) { playback.pause(); setPendingTourStart(true); setActiveMediaUri(mediaSource.uri); return; }
    tour.start();
  };
  const openReviewSelector = () => { playback.pause(); setExperience('review-selector'); };
  const openTourSelectorReview = () => { playback.pause(); setExperience('tour-selector-review-selector'); };
  const exitTour = () => {
    tour.exit();
    playback.pause();
    close();
    setExperience('entry');
  };
  const startSelectorTour = (work: HighlightReviewWork) => {
    selectorTour.exit();
    playback.pause();
    setExperience('full-movement');
    setSelectorTourWork(work);
    setPendingSelectorTourStart(true);
    const uri = developmentReviewMediaFor(work);
    if (activeMediaUri !== uri) setActiveMediaUri(uri);
  };
  const exitSelectorTour = () => {
    selectorTour.exit();
    playback.pause();
    close();
    setExperience('tour-selector-review-selector');
  };
  const enterHighlightReview = (work: HighlightReviewWork) => {
    const first = highlightReviewCandidatesFor(work)[0];
    if (!first) return;
    setExperience('full-movement');
    playback.pause();
    setReviewTransition(reviewCoordinator.current.begin());
    setActiveMediaUri(developmentReviewMediaFor(work));
    setReviewWork(work);
    setHighlightReviewOpen(true);
    setReviewCandidate(first);
  };
  useEffect(() => {
    if (!__DEV__ || !highlightReviewOpen || !reviewCandidate || reviewCandidate.timeSeconds === null || !reviewTransition) return;
    if (activeMediaUri !== developmentReviewMediaFor(reviewWork) || !reviewTransitionReady(activeMediaUri, playback.readyUri)) return;
    const token = reviewTransition;
    const player = playback.player;
    const target = reviewCandidate.timeSeconds;
    const waitForAdvance = async (baseline: number, milliseconds: number): Promise<boolean> => {
      const started = Date.now();
      while (Date.now() - started < milliseconds) {
        if (!reviewCoordinator.current.isCurrent(token)) return false;
        if (!player.paused && player.currentTime > baseline + .05) return true;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return !player.paused && player.currentTime > baseline + .05;
    };
    const run = async () => {
      playback.debugLog(`review token=${token} work=${reviewWork} uri=${activeMediaUri} target=${target.toFixed(3)} ready=${playback.ready}`);
      player.pause();
      playback.seek(target);
      const baseline = player.currentTime;
      playback.play();
      const firstAdvanced = await waitForAdvance(baseline, 600);
      if (!reviewCoordinator.current.isCurrent(token)) return;
      playback.debugLog(`review token=${token} first advance=${firstAdvanced} currentTime=${player.currentTime.toFixed(3)}`);
      if (firstAdvanced) return;
      player.pause();
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!reviewCoordinator.current.isCurrent(token)) return;
      const kickBaseline = player.currentTime;
      playback.debugLog(`review token=${token} pause/play recovery kick`);
      playback.play();
      const secondAdvanced = await waitForAdvance(kickBaseline, 1000);
      playback.debugLog(`review token=${token} second advance=${secondAdvanced} currentTime=${player.currentTime.toFixed(3)}`);
    };
    void run();
  }, [activeMediaUri, highlightReviewOpen, playback.ready, playback.readyUri, reviewCandidate, reviewTransition, reviewWork]);
  useEffect(() => {
    if (!pendingTourStart || !playback.ready || playback.readyUri !== mediaSource.uri) return;
    setPendingTourStart(false);
    playback.debugLog(`tour source ready uri=${mediaSource.uri}; starting validated coordinator`);
    tour.start();
  }, [pendingTourStart, playback.ready, playback.readyUri, tour]);
  useEffect(() => {
    const uri = developmentReviewMediaFor(selectorTourWork);
    if (!pendingSelectorTourStart || !playback.ready || playback.readyUri !== uri) return;
    setPendingSelectorTourStart(false);
    playback.debugLog(`selector-tour source ready uri=${uri}; starting validated coordinator`);
    selectorTour.start();
  }, [pendingSelectorTourStart, playback.ready, playback.readyUri, selectorTour, selectorTourWork]);
  const moveHighlightReview = (direction: 'next' | 'previous') => {
    if (!reviewCandidate) return;
    const target = highlightReviewTarget(reviewWork, reviewCandidate.rank, direction);
    if (!target) return;
    setReviewCandidate(target);
    playback.pause();
    setReviewTransition(reviewCoordinator.current.begin());
  };
  const decideHighlightReview = (decision: 'KEEP' | 'SKIP' | 'UNREVIEWED') => {
    if (!reviewCandidate) return;
    setReviewDecisions(decisions => decision === 'UNREVIEWED'
      ? clearHighlightReviewDecision(decisions, reviewCandidate.measure)
      : setHighlightReviewDecision(decisions, reviewCandidate.measure, decision));
    if (decision !== 'UNREVIEWED') moveHighlightReview('next');
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (peekOpen) { close(); return true; }
      if (tour.active) { exitTour(); return true; }
      if (selectorTour.active) { exitSelectorTour(); return true; }
      if (__DEV__ && highlightReviewOpen) { reviewCoordinator.current.cancel(); playback.pause(); setHighlightReviewOpen(false); setExperience('review-selector'); return true; }
      if (experience === 'review-selector') { setExperience('entry'); return true; }
      if (experience === 'tour-selector-review-selector') { setExperience('entry'); return true; }
      if (experience === 'full-movement') { backToMenu(); return true; }
      return false;
    });
    return () => subscription.remove();
  });
  useTVEventHandler(remote => {
    if (remote.eventKeyAction === 1) return;
    if (peekOpen) {
      if (remote.eventType === 'back' || remote.eventType === 'menu') close();
      return;
    }
    if (tour.active && (remote.eventType === 'right' || remote.eventType === 'left')) {
      remote.eventType === 'right' ? tour.next() : tour.previous();
      return;
    }
    if (selectorTour.active && (remote.eventType === 'right' || remote.eventType === 'left')) {
      remote.eventType === 'right' ? selectorTour.next() : selectorTour.previous();
      return;
    }
    if (__DEV__ && highlightReviewOpen && (remote.eventType === 'right' || remote.eventType === 'left')) {
      moveHighlightReview(remote.eventType === 'right' ? 'next' : 'previous');
      return;
    }
    if (__DEV__ && experience === 'full-movement' && (remote.eventType === 'right' || remote.eventType === 'left')) {
      const target = developmentCueTarget(playback.time, remote.eventType === 'right' ? 'next' : 'previous');
      if (target) { playback.seek(target.timeSeconds); setDebugCue(target); }
      return;
    }
    if (experience === 'full-movement' && remote.eventType === 'playpause') playback.toggle();
    if (experience === 'full-movement' && remote.eventType === 'rewind') playback.seek(playback.time - 10);
    if (experience === 'full-movement' && remote.eventType === 'forward') playback.seek(playback.time + 10);
  });
  const insight = tour.active ? tour.candidate : highlightReviewOpen ? reviewCandidate : undefined;
  const peekEvent = insight ? {startTime: insight.timeSeconds ?? playback.time, measure: insight.measure, title: 'Highlight'} : event;
  return <View style={styles.screen}>
    <VideoPlayer player={playback.player}/>
    {!peekOpen && experience === 'entry' && (
      <ExperienceEntry highlightCount={highlightsTourCandidates.length} ready={playback.ready} onFullMovement={playFullMovement} onHighlightsTour={startTour} showHighlightReview={__DEV__} onHighlightReview={openReviewSelector} showTourSelectorReview={__DEV__} onTourSelectorReview={openTourSelectorReview}/>
    )}
    {!peekOpen && __DEV__ && experience === 'review-selector' && <View style={styles.reviewScreen}>
      <Text style={styles.brand}>HIGHLIGHT REVIEW</Text>
      <Text style={styles.selectorHint}>Choose a generated score-analysis work</Text>
      <TVButton label={highlightReviewWorkLabels['brahms-op68-4']} preferred onPress={() => enterHighlightReview('brahms-op68-4')}/>
      <TVButton label={highlightReviewWorkLabels['beethoven-op67-1']} onPress={() => enterHighlightReview('beethoven-op67-1')}/>
      <TVButton label="BACK" onPress={() => setExperience('entry')}/>
    </View>}
    {!peekOpen && __DEV__ && experience === 'tour-selector-review-selector' && <View style={styles.reviewScreen}>
      <Text style={styles.brand}>TOUR SELECTOR REVIEW</Text>
      <Text style={styles.selectorHint}>AUTOMATIC SELECTOR TOUR · CURRENT RELEASE TOUR remains unchanged</Text>
      <TVButton label={`${highlightReviewWorkLabels['brahms-op68-4']} — ${selectorTourCountFor('brahms-op68-4')} MOMENTS`} preferred onPress={() => startSelectorTour('brahms-op68-4')}/>
      <TVButton label={`${highlightReviewWorkLabels['beethoven-op67-1']} — ${selectorTourCountFor('beethoven-op67-1')} MOMENTS`} onPress={() => startSelectorTour('beethoven-op67-1')}/>
      <TVButton label="BACK" onPress={() => setExperience('entry')}/>
    </View>}
    {!peekOpen && experience === 'full-movement' && <View style={styles.chrome}>
      <View style={styles.top}><Text style={styles.brand}>ORCHESTRA LENS</Text><Text style={styles.demo}>{work.timingStatus}</Text></View>
      {showDevelopmentControls(__DEV__) && <View style={styles.debugArea}>
        <Text style={styles.debugCue}>DEBUG TIME: {playback.time.toFixed(3)}s</Text>
        {debugCue && <Text style={styles.debugCue}>{debugCue.automatic ? 'AUTO ALIGNMENT' : 'CONFIRMED ALIGNMENT'} · m.{debugCue.measure} · predicted {debugCue.timeSeconds.toFixed(3)}s</Text>}
        {isHighlightReviewAvailable(__DEV__) && !highlightReviewOpen && !tour.active && !selectorTour.active && (
          <View style={styles.reviewSelector}><Text style={styles.debugCue}>HIGHLIGHT REVIEW</Text><TVButton compact label={highlightReviewWorkLabels['brahms-op68-4']} onPress={() => enterHighlightReview('brahms-op68-4')}/><TVButton compact label={highlightReviewWorkLabels['beethoven-op67-1']} onPress={() => enterHighlightReview('beethoven-op67-1')}/></View>
        )}
      </View>}
      {tour.active && tour.candidate && (
        <HighlightsTourPanel candidate={tour.candidate} total={highlightsTourCandidates.length} nextMeasure={highlightsTourCandidates[tour.index + 1]?.measure} onNext={tour.next} onPrevious={tour.previous} onScore={open} onToggle={playback.toggle} paused={playback.paused} onExit={exitTour}/>
      )}
      {__DEV__ && selectorTour.active && selectorTour.candidate && (
        <TourSelectorReviewPanel work={selectorTourWork} candidate={selectorTour.candidate} total={selectorTourCandidates.length} paused={playback.paused} onPrevious={selectorTour.previous} onNext={selectorTour.next} onToggle={playback.toggle} onExit={exitSelectorTour}/>
      )}
      {__DEV__ && highlightReviewOpen && reviewCandidate && (
        <HighlightReviewPanel work={reviewWork} candidate={reviewCandidate} decision={highlightReviewDecision(reviewDecisions, reviewCandidate.measure)} onDecision={decideHighlightReview} onPrevious={() => moveHighlightReview('previous')} onNext={() => moveHighlightReview('next')} onScore={open} onExit={() => { reviewCoordinator.current.cancel(); playback.pause(); setHighlightReviewOpen(false); setExperience('review-selector'); }}/>
      )}
      {!tour.active && !selectorTour.active && <View style={styles.bottom}>
        {playback.error ? <View style={styles.error}><Text style={styles.message}>VIDEO UNAVAILABLE</Text><Text style={styles.detail}>{playback.error}</Text></View> : <MusicalContextOverlay event={event}/>}
        <View style={styles.progress}><View style={[styles.fill, {width: `${playback.duration ? Math.min(100, playback.time / playback.duration * 100) : 0}%`}]}/></View>
        <View style={styles.transport}>
          {playback.error ? <TVButton label="RETRY" preferred onPress={playback.retry}/> : <>
            <TVButton compact label="SCORE" preferred onPress={open}/><TVButton compact label={playback.paused ? 'PLAY' : 'PAUSE'} onPress={playback.toggle}/><TVButton compact label="−10 SEC" onPress={() => playback.seek(playback.time - 10)}/><TVButton compact label="+10 SEC" onPress={() => playback.seek(playback.time + 10)}/><TVButton compact label="BACK TO MENU" onPress={backToMenu}/>
            {showDevelopmentControls(__DEV__) && <><TVButton compact label="−1 SEC" onPress={() => playback.seek(playback.time - 1)}/><TVButton compact label="+1 SEC" onPress={() => playback.seek(playback.time + 1)}/></>}
          </>}
          <Text style={styles.time}>{clock(playback.time)} / {clock(playback.duration)}{playback.buffering ? ' · Loading' : ''}</Text>
        </View>
      </View>}
    </View>}
    {peekOpen && (
      <ScorePeek event={peekEvent} scoreInsight={insight} onClose={close}/>
    )}
  </View>;
}

const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: '#080e16'}, chrome: {flex: 1, paddingHorizontal: '5%', paddingVertical: 24, justifyContent: 'space-between'}, reviewScreen: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14}, selectorHint: {fontSize: 20, color: '#c7d6e7', marginBottom: 8}, top: {flexDirection: 'row', justifyContent: 'space-between'}, brand: {fontSize: 24, color: '#f3dfb7', letterSpacing: 4}, demo: {fontSize: 18, color: '#ccd3dd', backgroundColor: '#101720df', padding: 7}, debugArea: {alignSelf: 'flex-start', marginTop: 8}, reviewSelector: {flexDirection: 'row', gap: 8, alignItems: 'center'}, debugCue: {paddingHorizontal: 10, paddingVertical: 3, color: '#c7d6e7', backgroundColor: '#101720df', fontSize: 16}, bottom: {width: '100%'}, progress: {height: 4, backgroundColor: '#535c69', marginTop: 14, marginBottom: 12}, fill: {height: 4, backgroundColor: '#f1cd87'}, transport: {flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap'}, time: {fontSize: 20, color: '#e0e5ec', marginLeft: 10}, error: {padding: 18, backgroundColor: '#351c21'}, message: {fontSize: 28, color: '#fff'}, detail: {fontSize: 20, color: '#f4c6c6', marginTop: 8}});
