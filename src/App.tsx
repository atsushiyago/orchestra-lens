import React, {useEffect, useState} from 'react';
import {BackHandler, View, Text, StyleSheet, useTVEventHandler} from 'react-native';
import {VideoPlayer} from './components/VideoPlayer';
import {MusicalContextOverlay} from './components/MusicalContextOverlay';
import {ScorePeek} from './components/ScorePeek';
import {TVButton} from './components/TVButton';
import {ExperienceEntry} from './components/ExperienceEntry';
import {HighlightReviewPanel} from './components/HighlightReviewPanel';
import {HighlightsTourPanel} from './components/HighlightsTourPanel';
import {scoreEvents, work} from './data/brahms1Movement4';
import {mediaSource} from './data/media';
import {showDevelopmentControls} from './data/listeningExperiences';
import {usePlayback} from './hooks/usePlayback';
import {useScoreSynchronization} from './hooks/useScoreSynchronization';
import {developmentCueTarget} from './playback/developmentCueNavigation';
import {leaveFullMovementForMenu} from './playback/listeningNavigation';
import {developmentValidationScoreEvents} from './playback/developmentScoreEvents';
import {highlightReviewCandidates, highlightReviewDecision, highlightReviewTarget, isHighlightReviewAvailable, setHighlightReviewDecision, type HighlightReviewCandidate, type HighlightReviewDecisions} from './playback/highlightReview';
import {highlightsTourCandidates, useHighlightsTour} from './hooks/useHighlightsTour';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
type Experience = 'entry' | 'full-movement';

export default function App() {
  const playback = usePlayback(mediaSource.uri, mediaSource.diagnosticUri, false);
  const event = useScoreSynchronization(__DEV__ ? developmentValidationScoreEvents : scoreEvents, playback.time);
  const [experience, setExperience] = useState<Experience>('entry');
  const [peekOpen, setPeekOpen] = useState(false);
  const [debugCue, setDebugCue] = useState<{measure: number; timeSeconds: number; automatic: boolean} | undefined>();
  const [highlightReviewOpen, setHighlightReviewOpen] = useState(false);
  const [reviewCandidate, setReviewCandidate] = useState<HighlightReviewCandidate | undefined>();
  const [reviewDecisions, setReviewDecisions] = useState<HighlightReviewDecisions>({});
  const tour = useHighlightsTour({player: playback.player, ready: playback.ready, paused: playback.paused, seek: playback.seek, reportError: playback.reportError, debugLog: playback.debugLog});
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
    tour.start();
  };
  const exitTour = () => {
    tour.exit();
    playback.pause();
    close();
    setExperience('entry');
  };
  const enterHighlightReview = () => {
    const first = highlightReviewCandidates[0];
    if (!first) return;
    setExperience('full-movement');
    setHighlightReviewOpen(true);
    setReviewCandidate(first);
    if (first.timeSeconds !== null) playback.seek(first.timeSeconds);
  };
  const moveHighlightReview = (direction: 'next' | 'previous') => {
    if (!reviewCandidate) return;
    const target = highlightReviewTarget(reviewCandidate.rank, direction);
    if (!target) return;
    setReviewCandidate(target);
    if (target.timeSeconds !== null) playback.seek(target.timeSeconds);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (peekOpen) { close(); return true; }
      if (tour.active) { exitTour(); return true; }
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
      <ExperienceEntry highlightCount={highlightsTourCandidates.length} ready={playback.ready} onFullMovement={playFullMovement} onHighlightsTour={startTour}/>
    )}
    {!peekOpen && experience === 'full-movement' && <View style={styles.chrome}>
      <View style={styles.top}><Text style={styles.brand}>ORCHESTRA LENS</Text><Text style={styles.demo}>{work.timingStatus}</Text></View>
      {showDevelopmentControls(__DEV__) && <View style={styles.debugArea}>
        <Text style={styles.debugCue}>DEBUG TIME: {playback.time.toFixed(3)}s</Text>
        {debugCue && <Text style={styles.debugCue}>{debugCue.automatic ? 'AUTO ALIGNMENT' : 'CONFIRMED ALIGNMENT'} · m.{debugCue.measure} · predicted {debugCue.timeSeconds.toFixed(3)}s</Text>}
        {isHighlightReviewAvailable(__DEV__) && !highlightReviewOpen && !tour.active && (
          <TVButton label="HIGHLIGHT REVIEW" onPress={enterHighlightReview}/>
        )}
      </View>}
      {tour.active && tour.candidate && (
        <HighlightsTourPanel candidate={tour.candidate} total={highlightsTourCandidates.length} nextMeasure={highlightsTourCandidates[tour.index + 1]?.measure} onNext={tour.next} onPrevious={tour.previous} onScore={open} onToggle={playback.toggle} paused={playback.paused} onExit={exitTour}/>
      )}
      {__DEV__ && highlightReviewOpen && reviewCandidate && (
        <HighlightReviewPanel candidate={reviewCandidate} decision={highlightReviewDecision(reviewDecisions, reviewCandidate.measure)} onDecision={decision => setReviewDecisions(decisions => setHighlightReviewDecision(decisions, reviewCandidate.measure, decision))} onScore={open} onExit={() => setHighlightReviewOpen(false)}/>
      )}
      {!tour.active && <View style={styles.bottom}>
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

const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: '#080e16'}, chrome: {flex: 1, paddingHorizontal: '5%', paddingVertical: 24, justifyContent: 'space-between'}, top: {flexDirection: 'row', justifyContent: 'space-between'}, brand: {fontSize: 24, color: '#f3dfb7', letterSpacing: 4}, demo: {fontSize: 18, color: '#ccd3dd', backgroundColor: '#101720df', padding: 7}, debugArea: {alignSelf: 'flex-start', marginTop: 8}, debugCue: {paddingHorizontal: 10, paddingVertical: 3, color: '#c7d6e7', backgroundColor: '#101720df', fontSize: 16}, bottom: {width: '100%'}, progress: {height: 4, backgroundColor: '#535c69', marginTop: 14, marginBottom: 12}, fill: {height: 4, backgroundColor: '#f1cd87'}, transport: {flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap'}, time: {fontSize: 20, color: '#e0e5ec', marginLeft: 10}, error: {padding: 18, backgroundColor: '#351c21'}, message: {fontSize: 28, color: '#fff'}, detail: {fontSize: 20, color: '#f4c6c6', marginTop: 8}});
