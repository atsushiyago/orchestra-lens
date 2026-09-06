import React, {useEffect, useState} from 'react';
import {BackHandler, View, Text, StyleSheet, useTVEventHandler} from 'react-native';
import {VideoPlayer} from './components/VideoPlayer';
import {MusicalContextOverlay} from './components/MusicalContextOverlay';
import {ScorePeek} from './components/ScorePeek';
import {TVButton} from './components/TVButton';
import {scoreEvents, work} from './data/brahms1Movement4';
import {mediaSource} from './data/media';
import {usePlayback} from './hooks/usePlayback';
import {useScoreSynchronization} from './hooks/useScoreSynchronization';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function App() {
  const playback = usePlayback(mediaSource.uri, mediaSource.diagnosticUri);
  const event = useScoreSynchronization(scoreEvents, playback.time);
  const [peekOpen, setPeekOpen] = useState(false);
  const close = () => {
    setPeekOpen(false);
    if (playback.player) void playback.peek.leave(playback.player).catch(playback.reportError);
  };
  const open = () => {
    if (!playback.player || !playback.ready || playback.error) return;
    playback.peek.enter(playback.player);
    setPeekOpen(true);
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
    if (remote.eventType === 'playpause') playback.toggle();
    if (remote.eventType === 'rewind') playback.seek(playback.time - 10);
    if (remote.eventType === 'forward') playback.seek(playback.time + 10);
  });
  return <View style={styles.screen}>
    <VideoPlayer player={playback.player}/>
    {!peekOpen && <View style={styles.chrome}>
      <View style={styles.top}><Text style={styles.brand}>ORCHESTRA LENS</Text><Text style={styles.demo}>{work.timingStatus}</Text></View>
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
          </>}
          <Text style={styles.time}>{clock(playback.time)} / {clock(playback.duration)}{playback.buffering ? ' · Loading' : ''}</Text>
        </View>
      </View>
    </View>}
    {peekOpen && <ScorePeek event={event} onClose={close}/>}
  </View>;
}
const styles = StyleSheet.create({screen: {flex: 1, backgroundColor: '#080e16'}, chrome: {flex: 1, paddingHorizontal: '5%', paddingVertical: '4%', justifyContent: 'space-between'}, top: {flexDirection: 'row', justifyContent: 'space-between'}, brand: {fontSize: 24, color: '#f3dfb7', letterSpacing: 4}, demo: {fontSize: 22, color: '#ccd3dd', backgroundColor: '#101720df', padding: 8}, bottom: {width: '100%'}, progress: {height: 4, backgroundColor: '#535c69', marginTop: 24, marginBottom: 22}, fill: {height: 4, backgroundColor: '#f1cd87'}, transport: {flexDirection: 'row', alignItems: 'center'}, time: {fontSize: 24, color: '#e0e5ec', marginLeft: 12}, error: {padding: 24, backgroundColor: '#351c21'}, message: {fontSize: 32, color: '#fff'}, detail: {fontSize: 24, color: '#f4c6c6', marginTop: 12}});
