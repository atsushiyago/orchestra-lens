import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {HighlightsTourPhase} from '../hooks/useHighlightsTour';
import type {HighlightReviewCandidate} from '../playback/highlightReview';
import {TVButton} from './TVButton';

const clock = (seconds: number | null) => seconds === null ? 'Timestamp unavailable' :
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

export function HighlightsTourPanel({candidate, phase, nextMeasure, onNext, onPrevious, onScore, onToggle, paused, onExit}: {
  candidate: HighlightReviewCandidate;
  phase: HighlightsTourPhase;
  nextMeasure?: number;
  onNext: () => void;
  onPrevious: () => void;
  onScore: () => void;
  onToggle: () => void;
  paused: boolean;
  onExit: () => void;
}) {
  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>HIGHLIGHTS TOUR · DEBUG ONLY</Text>
    <Text style={styles.title}>#{candidate.rank} · m.{candidate.measure}</Text>
    <Text style={styles.clock}>{clock(candidate.timeSeconds)} · Score {candidate.score}</Text>
    <Text style={styles.phase}>{phase.replace('-', ' ').toUpperCase()}</Text>
    <Text style={styles.heading}>WHY THIS MOMENT?</Text>
    {candidate.reasons.slice(0, 3).map(reason => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
    {nextMeasure !== undefined && <Text style={styles.next}>NEXT: m.{nextMeasure}</Text>}
    <View style={styles.actions}>
      <TVButton label={paused ? 'PLAY' : 'PAUSE'} onPress={onToggle}/>
      <TVButton label="PREVIOUS HIGHLIGHT" onPress={onPrevious}/>
      <TVButton label="NEXT HIGHLIGHT" onPress={onNext}/>
      <TVButton label="SCORE" onPress={onScore}/>
      <TVButton label="EXIT TOUR" preferred onPress={onExit}/>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: {alignSelf: 'flex-start', maxWidth: 1120, padding: 16, backgroundColor: '#101720ed', borderLeftWidth: 5, borderLeftColor: '#f1cd87'},
  eyebrow: {fontSize: 16, letterSpacing: 2, color: '#f1cd87'}, title: {fontSize: 30, color: '#f3dfb7', fontWeight: '700', marginTop: 3},
  clock: {fontSize: 21, color: '#e0e5ec', marginTop: 2}, phase: {fontSize: 16, color: '#78b9d8', marginTop: 3}, heading: {fontSize: 17, letterSpacing: 1, color: '#f1cd87', marginTop: 7},
  reason: {fontSize: 17, lineHeight: 22, color: '#e0e5ec'}, next: {fontSize: 18, color: '#dce9c9', marginTop: 5},
  actions: {flexDirection: 'row', gap: 8, marginTop: 7, alignItems: 'center'},
});
