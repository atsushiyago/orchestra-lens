import React, {useEffect, useRef, useState} from 'react';
import {BackHandler, View, Text, StyleSheet, useTVEventHandler} from 'react-native';
import {VideoPlayer} from './components/VideoPlayer';
import {MusicalContextOverlay} from './components/MusicalContextOverlay';
import {GuidedListeningCardOverlay} from './components/GuidedListeningCardOverlay';
import {ScorePeek} from './components/ScorePeek';
import {TVButton} from './components/TVButton';
import {ExperienceEntry} from './components/ExperienceEntry';
import {HighlightReviewPanel} from './components/HighlightReviewPanel';
import {HighlightsTourPanel} from './components/HighlightsTourPanel';
import {TourSelectorReviewPanel} from './components/TourSelectorReviewPanel';
import {WorkCatalog} from './components/WorkCatalog';
import {defaultWork, workCatalog, workSwitchNeedsSourceReload, type OrchestraLensWork} from './data/workCatalog';
import {developmentReviewMediaFor} from './data/developmentReviewWorks';
import {selectorTourCandidatesFor, selectorTourCountFor} from './data/developmentTourSelectorWorks';
import {ReviewTransitionCoordinator, reviewTransitionReady} from './playback/reviewTransitionCoordinator';
import {showDevelopmentControls} from './data/listeningExperiences';
import {usePlayback} from './hooks/usePlayback';
import {useScoreSynchronization} from './hooks/useScoreSynchronization';
import {developmentCueTarget} from './playback/developmentCueNavigation';
import {developmentValidationScoreEvents} from './playback/developmentScoreEvents';
import {leaveFullMovementForMenu} from './playback/listeningNavigation';
import {contextualCueJumpTargets} from './playback/contextualCueJump';
import {activeGuidedListeningCue, guidedListeningCuesFor} from './data/guidedListening';
import {getRuntimeCue} from './data/runtimeCue';
import {clearHighlightReviewDecision, highlightReviewCandidates, highlightReviewCandidatesFor, highlightReviewDecision, highlightReviewTarget, highlightReviewWorkLabels, isHighlightReviewAvailable, setHighlightReviewDecision, type HighlightReviewCandidate, type HighlightReviewDecisions, type HighlightReviewWork} from './playback/highlightReview';
import {highlightsTourCandidates, useHighlightsTour} from './hooks/useHighlightsTour';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
type Experience = 'catalog' | 'work-entry' | 'full-movement' | 'review-selector' | 'tour-selector-review-selector';

export default function App() {
  const [selectedWork, setSelectedWork] = useState<OrchestraLensWork>(defaultWork);
  const [activeMediaUri, setActiveMediaUri] = useState<string>(defaultWork.media.uri);
  const playback = usePlayback(activeMediaUri, undefined, false);
  // Debug alignment validation intentionally substitutes generated times for
  // m.290/m.407. Both synchronization and cue-jump controls must consume this
  // same timeline; Release continues to use the work's approved events.
  const synchronizationEvents = selectedWork.capabilities.smartScore
    ? (__DEV__ ? developmentValidationScoreEvents : selectedWork.scoreEvents)
    : [];
  const event = useScoreSynchronization(synchronizationEvents, playback.time);
  const [experience, setExperience] = useState<Experience>('catalog');
  const [peekOpen, setPeekOpen] = useState(false);
  const [debugCue, setDebugCue] = useState<{measure: number; timeSeconds: number; automatic: boolean} | undefined>();
  const [highlightReviewOpen, setHighlightReviewOpen] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<HighlightReviewCandidate | undefined>();
  const [reviewWork, setReviewWork] = useState<HighlightReviewWork>('brahms-op68-4');
  const reviewCoordinator = useRef(new ReviewTransitionCoordinator());
  const [reviewTransition, setReviewTransition] = useState(0);
  const [pendingTourStart, setPendingTourStart] = useState(false);
  const [pendingFullMovementStart, setPendingFullMovementStart] = useState(false);
  const [selectorTourWork, setSelectorTourWork] = useState<HighlightReviewWork>('brahms-op68-4');
  const [pendingSelectorTourStart, setPendingSelectorTourStart] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState<HighlightReviewDecisions>({});
  const tour = useHighlightsTour({player: playback.player, ready: playback.ready, paused: playback.paused, seek: playback.seek, reportError: playback.reportError, debugLog: playback.debugLog}, selectedWork.tourCandidates);
  const selectorTourCandidates = selectorTourCandidatesFor(selectorTourWork);
  const selectorTour = useHighlightsTour({player: playback.player, ready: playback.ready, paused: playback.paused, seek: playback.seek, reportError: playback.reportError, debugLog: playback.debugLog}, selectorTourCandidates);
  const close = () => {
    setPeekOpen(false);
    if (playback.player) void playback.peek.leave(playback.player).catch(playback.reportError);
  };
  const open = () => {
    if (!selectedWork.capabilities.smartScore || !playback.player || !playback.ready || playback.error) return;
    playback.peek.enter(playback.player);
    setPeekOpen(true);
  };
  const selectWork = (work: OrchestraLensWork) => {
    tour.exit(); selectorTour.exit(); reviewCoordinator.current.cancel(); playback.pause(); setPendingTourStart(false); setPendingSelectorTourStart(false); setSelectedWork(work); setExperience('work-entry');
    if (workSwitchNeedsSourceReload(selectedWork, work)) setActiveMediaUri(work.media.uri);
  };
  const playFullMovement = () => {
    setExperience('full-movement');
    // DEV review can leave a different work mounted. Full Movement always
    // reclaims the selected work's URI before it issues a play or cue seek.
    if (activeMediaUri !== selectedWork.media.uri) {
      playback.debugLog(`full-movement reclaiming selected work URI=${selectedWork.media.uri}`);
      playback.pause();
      setPendingFullMovementStart(true);
      setActiveMediaUri(selectedWork.media.uri);
      return;
    }
    playback.play();
  };
  const backToWorkEntry = () => { const action = leaveFullMovementForMenu(); if (action.pause) playback.pause(); setExperience(action.destination); };
  const backToCatalog = () => { playback.pause(); setExperience('catalog'); };
  const startTour = () => {
    if (!selectedWork.capabilities.highlightsTour || playback.error) return;
    setExperience('full-movement');
    setPendingTourStart(true);
    if (activeMediaUri !== selectedWork.media.uri) { playback.pause(); setActiveMediaUri(selectedWork.media.uri); }
  };
  const openReviewSelector = () => { playback.pause(); setExperience('review-selector'); };
  const openTourSelectorReview = () => { playback.pause(); setExperience('tour-selector-review-selector'); };
  const exitTour = () => {
    tour.exit();
    setPendingTourStart(false);
    playback.pause();
    close();
    setExperience('work-entry');
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
    setPendingSelectorTourStart(false);
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
    if (!pendingFullMovementStart || !playback.sourceReady || playback.readyUri !== selectedWork.media.uri) return;
    setPendingFullMovementStart(false);
    playback.debugLog(`full-movement selected work source ready uri=${selectedWork.media.uri}; starting playback`);
    playback.play();
  }, [pendingFullMovementStart, playback.readyUri, playback.sourceReady, selectedWork.media.uri]);
  useEffect(() => {
    if (!pendingTourStart || !playback.sourceReady || playback.readyUri !== selectedWork.media.uri) return;
    setPendingTourStart(false);
    playback.debugLog(`tour source ready uri=${selectedWork.media.uri}; starting validated coordinator`);
    tour.start();
  }, [pendingTourStart, playback.readyUri, playback.sourceReady, selectedWork.media.uri, tour]);
  useEffect(() => {
    const uri = developmentReviewMediaFor(selectorTourWork);
    if (!pendingSelectorTourStart || !playback.sourceReady || playback.readyUri !== uri) return;
    setPendingSelectorTourStart(false);
    playback.debugLog(`selector-tour source ready uri=${uri}; starting validated coordinator`);
    selectorTour.start();
  }, [pendingSelectorTourStart, playback.readyUri, playback.sourceReady, selectorTour, selectorTourWork]);
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
      if (experience === 'review-selector' || experience === 'tour-selector-review-selector') { setExperience('catalog'); return true; }
      if (experience === 'full-movement') { backToWorkEntry(); return true; }
      if (experience === 'work-entry') { backToCatalog(); return true; }
      return true;
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
    if (__DEV__ && selectedWork.id === 'brahms-op68-4' && experience === 'full-movement' && (remote.eventType === 'right' || remote.eventType === 'left')) {
      const target = developmentCueTarget(playback.time, remote.eventType === 'right' ? 'next' : 'previous');
      if (target) { playback.seek(target.timeSeconds); setDebugCue(target); }
      return;
    }
    if (experience === 'full-movement' && remote.eventType === 'playpause') playback.toggle();
    if (experience === 'full-movement' && remote.eventType === 'rewind') playback.seek(playback.time - 10);
    if (experience === 'full-movement' && remote.eventType === 'forward') playback.seek(playback.time + 10);
  });
  const insight = selectedWork.capabilities.smartScore ? (tour.active ? tour.candidate : highlightReviewOpen ? reviewCandidate : undefined) : undefined;
  const peekEvent = insight ? {startTime: insight.timeSeconds ?? playback.time, measure: insight.measure, title: 'Highlight'} : event;
  // Guided Listening is a read-only view of the media clock. No player action
  // is attached to entering or leaving one of these generated cue regions.
  const guidedCue = experience === 'full-movement' && !peekOpen && !tour.active && !selectorTour.active && !highlightReviewOpen
    ? activeGuidedListeningCue(guidedListeningCuesFor(selectedWork), playback.time) : undefined;
  const guidedThemeLens = guidedCue && event ? getRuntimeCue(event.measure)?.themeLens : undefined;
  const guidedCanAsk = Boolean(guidedCue && selectedWork.capabilities.askTheScore && event?.measure === guidedCue.measure && event.measure === 62);
  const openGuidedComparison = () => {
    if (!guidedThemeLens || !playback.player || !playback.ready || playback.error) return;
    playback.peek.enter(playback.player);
    setPeekOpen(true);
  };
  const contextualJumpTargets = __DEV__ ? contextualCueJumpTargets(synchronizationEvents, selectedWork.capabilities) : [];
  return <View style={styles.screen}>
    <VideoPlayer player={playback.player}/>
    {!peekOpen && experience === 'catalog' && (
      <WorkCatalog works={workCatalog} onSelect={selectWork}/>
    )}
    {!peekOpen && experience === 'work-entry' && (
      <ExperienceEntry work={selectedWork} highlightCount={selectedWork.tourCandidates.length} ready={playback.ready} onFullMovement={playFullMovement} onHighlightsTour={startTour} onBackToCatalog={backToCatalog} showHighlightReview={__DEV__} onHighlightReview={openReviewSelector} showTourSelectorReview={__DEV__} onTourSelectorReview={openTourSelectorReview}/>
    )}
    {!peekOpen && __DEV__ && experience === 'review-selector' && <View style={styles.reviewScreen}>
      <Text style={styles.brand}>HIGHLIGHT REVIEW</Text>
      <Text style={styles.selectorHint}>Choose a generated score-analysis work</Text>
      <TVButton label={highlightReviewWorkLabels['brahms-op68-4']} preferred onPress={() => enterHighlightReview('brahms-op68-4')}/>
      <TVButton label={highlightReviewWorkLabels['beethoven-op67-1']} onPress={() => enterHighlightReview('beethoven-op67-1')}/>
      <TVButton label="BACK" onPress={() => setExperience('catalog')}/>
    </View>}
    {!peekOpen && __DEV__ && experience === 'tour-selector-review-selector' && <View style={styles.reviewScreen}>
      <Text style={styles.brand}>TOUR SELECTOR REVIEW</Text>
      <Text style={styles.selectorHint}>AUTOMATIC SELECTOR TOUR · CURRENT RELEASE TOUR remains unchanged</Text>
      <TVButton label={`${highlightReviewWorkLabels['brahms-op68-4']} — ${selectorTourCountFor('brahms-op68-4')} MOMENTS`} preferred onPress={() => startSelectorTour('brahms-op68-4')}/>
      <TVButton label={`${highlightReviewWorkLabels['beethoven-op67-1']} — ${selectorTourCountFor('beethoven-op67-1')} MOMENTS`} onPress={() => startSelectorTour('beethoven-op67-1')}/>
      <TVButton label="BACK" onPress={() => setExperience('catalog')}/>
    </View>}
    {!peekOpen && experience === 'full-movement' && <View style={styles.chrome}>
      {!guidedCue && <View style={styles.top}><Text style={styles.brand}>ORCHESTRA LENS</Text><Text style={styles.demo}>{selectedWork.composer} · {selectedWork.movementNumber}</Text></View>}
      {showDevelopmentControls(__DEV__) && <View style={styles.debugArea}>
        <Text style={styles.debugCue}>DEBUG TIME: {playback.time.toFixed(3)}s</Text>
        {debugCue && <Text style={styles.debugCue}>{debugCue.automatic ? 'AUTO ALIGNMENT' : 'CONFIRMED ALIGNMENT'} · m.{debugCue.measure} · predicted {debugCue.timeSeconds.toFixed(3)}s</Text>}
        {isHighlightReviewAvailable(__DEV__) && !highlightReviewOpen && !tour.active && !selectorTour.active && (
          <View style={styles.reviewSelector}><Text style={styles.debugCue}>HIGHLIGHT REVIEW</Text><TVButton compact label={highlightReviewWorkLabels['brahms-op68-4']} onPress={() => enterHighlightReview('brahms-op68-4')}/><TVButton compact label={highlightReviewWorkLabels['beethoven-op67-1']} onPress={() => enterHighlightReview('beethoven-op67-1')}/></View>
        )}
        {contextualJumpTargets.length > 0 && !tour.active && !selectorTour.active && !highlightReviewOpen && <View style={styles.reviewSelector}>
          <Text style={styles.debugCue}>JUMP TO CUE</Text>
          {contextualJumpTargets.map(target => <TVButton key={target.measure} compact label={`m.${target.measure} · ${target.label}`} onPress={() => { playback.debugLog(`Debug cue jump m.${target.measure} target=${target.timeSeconds.toFixed(3)} currentTime=${playback.player.currentTime.toFixed(3)} duration=${playback.player.duration.toFixed(3)} readyState=${playback.player.readyState} paused=${playback.player.paused} ended=${playback.player.ended}`); playback.seek(target.timeSeconds); setDebugCue({measure: target.measure, timeSeconds: target.timeSeconds, automatic: false}); }}/>) }
        </View>}
      </View>}
      {tour.active && tour.candidate && (
        <HighlightsTourPanel work={selectedWork} candidate={tour.candidate} total={selectedWork.tourCandidates.length} nextMeasure={selectedWork.tourCandidates[tour.index + 1]?.measure} onNext={tour.next} onPrevious={tour.previous} onScore={open} onToggle={playback.toggle} paused={playback.paused} onExit={exitTour} showScore={selectedWork.capabilities.smartScore}/>
      )}
      {__DEV__ && selectorTour.active && selectorTour.candidate && (
        <TourSelectorReviewPanel work={selectorTourWork} candidate={selectorTour.candidate} total={selectorTourCandidates.length} paused={playback.paused} onPrevious={selectorTour.previous} onNext={selectorTour.next} onToggle={playback.toggle} onExit={exitSelectorTour}/>
      )}
      {__DEV__ && highlightReviewOpen && reviewCandidate && (
        <HighlightReviewPanel work={reviewWork} candidate={reviewCandidate} decision={highlightReviewDecision(reviewDecisions, reviewCandidate.measure)} onDecision={decideHighlightReview} onPrevious={() => moveHighlightReview('previous')} onNext={() => moveHighlightReview('next')} onScore={open} onExit={() => { reviewCoordinator.current.cancel(); playback.pause(); setHighlightReviewOpen(false); setExperience('review-selector'); }}/>
      )}
      {!tour.active && !selectorTour.active && !highlightReviewOpen && <View style={styles.fullMovementBody}>
        {guidedCue ? <GuidedListeningCardOverlay cue={guidedCue} themeLens={guidedThemeLens} canAskTheScore={guidedCanAsk} onCompare={openGuidedComparison}/> : selectedWork.capabilities.guidedListening ? <View pointerEvents="none" style={styles.guidedBase}><Text style={styles.baseWork}>{selectedWork.composer} · {selectedWork.workTitle}</Text><Text style={styles.baseMovement}>{selectedWork.movementTitle}</Text><Text style={styles.baseHeading}>GUIDED LISTENING</Text><Text style={styles.baseHint}>Follow the orchestra as the music unfolds.</Text></View> : <MusicalContextOverlay event={event} composer={selectedWork.composer} workTitle={selectedWork.workTitle} movementTitle={selectedWork.movementTitle}/>} 
      </View>}
      {!tour.active && !selectorTour.active && <View style={styles.transportZone}>
        {playback.error && <View style={styles.error}><Text style={styles.message}>VIDEO UNAVAILABLE</Text><Text style={styles.detail}>{playback.error}</Text></View>}
        <View style={styles.progress}><View style={[styles.fill, {width: `${playback.duration ? Math.min(100, playback.time / playback.duration * 100) : 0}%`}]}/></View>
        <View style={styles.transport}>
          {playback.error ? <TVButton label="RETRY" preferred onPress={playback.retry}/> : <>
            <TVButton compact label={playback.paused ? 'PLAY' : 'PAUSE'} onPress={playback.toggle}/><TVButton compact label="BACK TO WORK" onPress={backToWorkEntry}/>
            {showDevelopmentControls(__DEV__) && <><TVButton compact label="−10 SEC" onPress={() => playback.seek(playback.time - 10)}/><TVButton compact label="+10 SEC" onPress={() => playback.seek(playback.time + 10)}/><TVButton compact label="−1 SEC" onPress={() => playback.seek(playback.time - 1)}/><TVButton compact label="+1 SEC" onPress={() => playback.seek(playback.time + 1)}/></>}
          </>}
          <Text style={styles.time}>{clock(playback.time)} / {clock(playback.duration)}{playback.buffering ? ' · Loading' : ''}</Text>
        </View>
      </View>}
    </View>}
    {peekOpen && (
      <ScorePeek event={peekEvent} scoreInsight={insight} onClose={close} allowAskTheScore={selectedWork.capabilities.askTheScore}/>
    )}
  </View>;
}

const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: '#080e16'}, chrome: {flex: 1, paddingHorizontal: '5%', paddingVertical: 16}, reviewScreen: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14}, selectorHint: {fontSize: 20, color: '#c7d6e7', marginBottom: 8}, top: {flexDirection: 'row', justifyContent: 'space-between'}, brand: {fontSize: 24, color: '#f3dfb7', letterSpacing: 4}, demo: {fontSize: 18, color: '#ccd3dd', backgroundColor: '#101720df', padding: 7}, debugArea: {alignSelf: 'flex-start', marginTop: 8}, reviewSelector: {flexDirection: 'row', gap: 8, alignItems: 'center'}, debugCue: {paddingHorizontal: 10, paddingVertical: 3, color: '#c7d6e7', backgroundColor: '#101720df', fontSize: 16}, fullMovementBody: {flex: 1, minHeight: 0, marginTop: 6, paddingBottom: 10}, guidedBase: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101720df', borderRadius: 8}, baseWork: {fontSize: 25, color: '#e5dfd3', letterSpacing: 2}, baseMovement: {fontSize: 21, color: '#b8c1ca', marginTop: 8}, baseHeading: {fontSize: 32, color: '#f1cd87', fontWeight: '700', letterSpacing: 3, marginTop: 28}, baseHint: {fontSize: 22, color: '#d6e2ef', marginTop: 10}, transportZone: {width: '100%', flexShrink: 0, minHeight: 76}, progress: {height: 4, backgroundColor: '#535c69', marginTop: 8, marginBottom: 8}, fill: {height: 4, backgroundColor: '#f1cd87'}, transport: {flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap'}, time: {fontSize: 20, color: '#e0e5ec', marginLeft: 10}, error: {padding: 18, backgroundColor: '#351c21'}, message: {fontSize: 28, color: '#fff'}, detail: {fontSize: 20, color: '#f4c6c6', marginTop: 8}});
