import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {HighlightReviewCandidate} from '../playback/highlightReview';
import {TVButton} from './TVButton';

export function HighlightsTourPanel({candidate, total, nextMeasure, onNext, onPrevious, onScore, showScore = true, onToggle, paused, onExit}: {
  candidate: HighlightReviewCandidate;
  total: number;
  nextMeasure?: number;
  onNext: () => void;
  onPrevious: () => void;
  onScore: () => void;
  showScore?: boolean;
  onToggle: () => void;
  paused: boolean;
  onExit: () => void;
}) {
  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>HIGHLIGHT {candidate.rank} OF {total}</Text>
    <Text style={styles.work}>BRAHMS · SYMPHONY NO. 1 · IV</Text>
    <Text style={styles.title}>m.{candidate.measure}</Text>
    <Text style={styles.heading}>WHY THIS MOMENT?</Text>
    {candidate.reasons.slice(0, 3).map(reason => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
    {nextMeasure !== undefined && <Text style={styles.next}>NEXT: m.{nextMeasure}</Text>}
    <View style={styles.actions}>
      <TVButton compact label={paused ? 'PLAY' : 'PAUSE'} onPress={onToggle}/>
      <TVButton compact label="PREVIOUS" onPress={onPrevious}/>
      <TVButton compact label="NEXT" onPress={onNext}/>
      {showScore && <TVButton compact label="SCORE" onPress={onScore}/>} 
      <TVButton compact label="EXIT TOUR" preferred onPress={onExit}/>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: {alignSelf: 'flex-start', width: '100%', maxWidth: 1120, padding: 14, backgroundColor: '#101720ed', borderLeftWidth: 5, borderLeftColor: '#f1cd87'},
  eyebrow: {fontSize: 16, letterSpacing: 2, color: '#f1cd87'}, work: {fontSize: 17, letterSpacing: 1, color: '#c7d6e7', marginTop: 5}, title: {fontSize: 30, color: '#f3dfb7', fontWeight: '700', marginTop: 3},
  heading: {fontSize: 17, letterSpacing: 1, color: '#f1cd87', marginTop: 5},
  reason: {fontSize: 17, lineHeight: 21, color: '#e0e5ec'}, next: {fontSize: 18, color: '#dce9c9', marginTop: 4},
  actions: {flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center'},
});
