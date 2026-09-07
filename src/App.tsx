import React, {useEffect, useState} from 'react';
import {BackHandler, View, Text, StyleSheet, useTVEventHandler} from 'react-native';
import {VideoPlayer} from './components/VideoPlayer';
import {MusicalContextOverlay} from './components/MusicalContextOverlay';
import {ScorePeek} from './components/ScorePeek';
import {TVButton} from './components/TVButton';
import {HighlightReviewPanel} from './components/HighlightReviewPanel';
import {HighlightsTourPanel} from './components/HighlightsTourPanel';
import {scoreEvents, work} from './data/brahms1Movement4';
import {mediaSource} from './data/media';
import {usePlayback} from './hooks/usePlayback';
import {useScoreSynchronization} from './hooks/useScoreSynchronization';
import {debugCueClock, developmentCueTarget} from './playback/developmentCueNavigation';
import {developmentValidationScoreEvents} from './playback/developmentScoreEvents';
import {highlightReviewCandidates, highlightReviewDecision, highlightReviewTarget, isHighlightReviewAvailable, setHighlightReviewDecision, type HighlightReviewCandidate, type HighlightReviewDecisions} from './playback/highlightReview';
import {highlightsTourCandidates, useHighlightsTour} from './hooks/useHighlightsTour';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function App() {
  const playback = usePlayback(mediaSource.uri, mediaSource.diagnosticUri);
  const event = useScoreSynchronization(__DEV__ ? developmentValidationScoreEvents : scoreEvents, playback.time);
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
  const enterHighlightReview = () => {
    const first = highlightReviewCandidates[0];
    if (!first) return;
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
      if (!peekOpen) return false;
      close(); return true;
    });
    return () => subscription.remove();
  });
  useTVEventHandler(remote => {
    if (remote.eventKeyAction === 1) return;
    if (peekOpen) {
      if (remote.eventType === 'back' || remote.eventType === 'menu') close();
      return;
    }
    if (__DEV__ && tour.active && (remote.eventType === 'right' || remote.eventType === 'left')) {
      remote.eventType === 'right' ? tour.next() : tour.previous();
      return;
    }
    if (__DEV__ && highlightReviewOpen && (remote.eventType === 'right' || remote.eventType === 'left')) {
      moveHighlightReview(remote.eventType === 'right' ? 'next' : 'previous');
      return;
    }
    if (__DEV__ && (remote.eventType === 'right' || remote.eventType === 'left')) {
      const target = developmentCueTarget(playback.time, remote.eventType === 'right' ? 'next' : 'previous');
      if (target) {
        playback.seek(target.timeSeconds);
        setDebugCue(target);
      }
      return;
    }
    if (remote.eventType === 'playpause') playback.toggle();
    if (remote.eventType === 'rewind') playback.seek(playback.time - 10);
    if (remote.eventType === 'forward') playback.seek(playback.time + 10);
  });
  return <View style={styles.screen}>
    <VideoPlayer player={playback.player}/>
    {!peekOpen && <View style={styles.chrome}>
      <View style={styles.top}><Text style={styles.brand}>ORCHESTRA LENS</Text><Text style={styles.demo}>{work.timingStatus}</Text></View>
      {__DEV__ && <View style={styles.debugArea}>
        <Text style={styles.debugCue}>DEBUG TIME: {playback.time.toFixed(3)}s</Text>
        {debugCue && <Text style={styles.debugCue}>{debugCue.automatic ? 'AUTO ALIGNMENT' : 'CONFIRMED ALIGNMENT'} · m.{debugCue.measure} · predicted {debugCue.timeSeconds.toFixed(3)}s</Text>}
        {isHighlightReviewAvailable(__DEV__) && !highlightReviewOpen && <TVButton label="HIGHLIGHT REVIEW" onPress={enterHighlightReview}/>} 
        {isHighlightReviewAvailable(__DEV__) && !tour.active && !highlightReviewOpen && <TVButton label="AUTO HIGHLIGHTS TOUR" onPress={tour.start}/>} 
      </View>}
      {__DEV__ && tour.active && tour.candidate && <HighlightsTourPanel
        candidate={tour.candidate}
        phase={tour.phase}
        nextMeasure={highlightsTourCandidates[tour.index + 1]?.measure}
        onNext={tour.next}
        onPrevious={tour.previous}
        onScore={open}
        onToggle={playback.toggle}
        paused={playback.paused}
        onExit={tour.exit}
      />}
      {__DEV__ && highlightReviewOpen && reviewCandidate && <HighlightReviewPanel
        candidate={reviewCandidate}
        decision={highlightReviewDecision(reviewDecisions, reviewCandidate.measure)}
        onDecision={decision => setReviewDecisions(decisions => setHighlightReviewDecision(decisions, reviewCandidate.measure, decision))}
        onScore={open}
        onExit={() => setHighlightReviewOpen(false)}
      />}
      <View style={styles.bottom}>
        {playback.error ? <View style={styles.error}><Text style={styles.message}>VIDEO UNAVAILABLE</Text><Text style={styles.detail}>{playback.error}</Text></View> :
          <MusicalContextOverlay event={event}/>}
        <View style={styles.progress}><View style={[styles.fill, {width: `${playback.duration ? Math.min(100, playback.time / playback.duration * 100) : 0}%`}]}/></View>
        <View style={styles.transport}>
          {playback.error ? <TVButton label="RETRY" preferred onPress={playback.retry}/> : <>
            <TVButton label="SCORE" preferred onPress={open}/>
            <TVButton label={playback.paused ? 'PLAY' : 'PAUSE'} onPress={playback.toggle}/>
            <TVButton label="−10 SEC" onPress={() => playback.seek(playback.time - 10)}/>
            <TVButton label="+10 SEC" onPress={() => playback.seek(playback.time + 10)}/>
            {__DEV__ && <><TVButton label="−1 SEC" onPress={() => playback.seek(playback.time - 1)}/><TVButton label="+1 SEC" onPress={() => playback.seek(playback.time + 1)}/></>}
          </>}
          <Text style={styles.time}>{clock(playback.time)} / {clock(playback.duration)}{playback.buffering ? ' · Loading' : ''}</Text>
        </View>
      </View>
    </View>}
    {peekOpen && <ScorePeek event={(tour.active && tour.candidate) || (highlightReviewOpen && reviewCandidate) ? {startTime: (tour.candidate ?? reviewCandidate)!.timeSeconds ?? playback.time, measure: (tour.candidate ?? reviewCandidate)!.measure, title: 'Highlight Review'} : event} debugHighlight={tour.active ? tour.candidate : highlightReviewOpen ? reviewCandidate : undefined} onClose={close}/>} 
  </View>;
}
const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: '#080e16'}, chrome: {flex: 1, paddingHorizontal: '5%', paddingVertical: '4%', justifyContent: 'space-between'}, top: {flexDirection: 'row', justifyContent: 'space-between'}, brand: {fontSize: 24, color: '#f3dfb7', letterSpacing: 4}, demo: {fontSize: 22, color: '#ccd3dd', backgroundColor: '#101720df', padding: 8}, debugArea: {alignSelf: 'flex-start', marginTop: 8}, debugCue: {paddingHorizontal: 10, paddingVertical: 3, color: '#c7d6e7', backgroundColor: '#101720df', fontSize: 16}, bottom: {width: '100%'}, progress: {height: 4, backgroundColor: '#535c69', marginTop: 24, marginBottom: 22}, fill: {height: 4, backgroundColor: '#f1cd87'}, transport: {flexDirection: 'row', alignItems: 'center'}, time: {fontSize: 24, color: '#e0e5ec', marginLeft: 12}, error: {padding: 24, backgroundColor: '#351c21'}, message: {fontSize: 32, color: '#fff'}, detail: {fontSize: 24, color: '#f4c6c6', marginTop: 12}});
