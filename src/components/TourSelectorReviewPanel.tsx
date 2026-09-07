import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {HighlightReviewWork} from '../playback/highlightReview';
import type {SelectorReviewCandidate} from '../data/developmentTourSelectorWorks';
import {TVButton} from './TVButton';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

export function TourSelectorReviewPanel({work, candidate, total, paused, onPrevious, onNext, onToggle, onExit}: {
  work: HighlightReviewWork;
  candidate: SelectorReviewCandidate;
  total: number;
  paused: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToggle: () => void;
  onExit: () => void;
}) {
  const workLabel = work === 'beethoven-op67-1' ? 'BEETHOVEN 5 · I' : 'BRAHMS 1 · IV';
  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>AUTOMATIC SELECTOR TOUR · DEBUG ONLY</Text>
    <Text style={styles.work}>{workLabel} · {candidate.rank} / {total}</Text>
    <Text style={styles.title}>m.{candidate.measure}{candidate.occurrence > 1 ? ` · occurrence ${candidate.occurrence}` : ''} · {clock(candidate.timeSeconds)}</Text>
    <Text style={styles.score}>Detector score: {candidate.score} · Selector score: {candidate.selectorScore}</Text>
    <Text style={styles.heading}>WHY THIS MOMENT?</Text>
    {candidate.selectorReasons.slice(0, 4).map(reason => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
    <View style={styles.actions}>
      <TVButton compact label="PREVIOUS" onPress={onPrevious}/>
      <TVButton compact label="NEXT" onPress={onNext}/>
      <TVButton compact label={paused ? 'PLAY' : 'PAUSE'} onPress={onToggle}/>
      <TVButton compact label="EXIT REVIEW" preferred onPress={onExit}/>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: {alignSelf: 'flex-start', width: '100%', maxWidth: 1120, padding: 14, backgroundColor: '#101720ed', borderLeftWidth: 5, borderLeftColor: '#78b9d8'},
  eyebrow: {fontSize: 16, letterSpacing: 2, color: '#78b9d8'}, work: {fontSize: 18, letterSpacing: 1, color: '#c7d6e7', marginTop: 5},
  title: {fontSize: 28, color: '#f3dfb7', fontWeight: '700', marginTop: 3}, score: {fontSize: 17, color: '#dce9c9', marginTop: 4},
  heading: {fontSize: 17, letterSpacing: 1, color: '#78b9d8', marginTop: 6}, reason: {fontSize: 17, lineHeight: 21, color: '#e0e5ec'},
  actions: {flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center'},
});
