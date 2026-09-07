import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {HighlightReviewCandidate, HighlightReviewDecision, HighlightReviewWork} from '../playback/highlightReview';
import {nearbyCuratedCues} from '../playback/highlightReview';
import {TVButton} from './TVButton';

const clock = (seconds: number | null) => seconds === null ? 'Timestamp unavailable' :
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

export function HighlightReviewPanel({candidate, work, decision, onDecision, onPrevious, onNext, onScore, onExit}: {
  candidate: HighlightReviewCandidate;
  work: HighlightReviewWork;
  decision: HighlightReviewDecision;
  onDecision: (decision: HighlightReviewDecision) => void;
  onPrevious: () => void;
  onNext: () => void;
  onScore: () => void;
  onExit: () => void;
}) {
  const nearby = nearbyCuratedCues(candidate.measure);
  return <View style={styles.panel}>
    <Text style={styles.eyebrow}>HIGHLIGHT REVIEW · DEBUG ONLY</Text>
    <View style={styles.summary}>
      <Text style={styles.title}>{work === 'beethoven-op67-1' ? 'BEETHOVEN 5 · I' : 'BRAHMS 1 · IV'} · #{candidate.rank} · m.{candidate.measure}{(candidate.occurrence ?? 1) > 1 ? ` · occurrence ${candidate.occurrence}` : ''}</Text>
      <Text style={styles.clock}>{clock(candidate.timeSeconds)}</Text>
      <Text style={styles.score}>Score: {candidate.score} · {candidate.activeInstruments.length} active instruments · density {candidate.features.textureDensity}</Text>
      {candidate.hauptstimme.length > 0 && <Text style={styles.evidence}>Hauptstimme: {candidate.hauptstimme.map(span => `${span.part} (${span.label})${span.startsHere ? ' starts' : ''}`).join(' · ')}</Text>}
      {nearby.length > 0 && <Text style={styles.nearby}>Near curated cue: {nearby.map(measure => `m.${measure}`).join(' · ')}</Text>}
    </View>
    <Text style={styles.reasonHeading}>REASONS</Text>
    {candidate.reasons.slice(0, 4).map(reason => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
    {candidate.reasons.length > 4 && <Text style={styles.more}>+{candidate.reasons.length - 4} additional measured changes</Text>}
    <Text style={styles.status}>REVIEW: {decision}</Text>
    <View style={styles.decisionActions}>
      <TVButton compact label="KEEP" onPress={() => onDecision('KEEP')}/>
      <TVButton compact label="SKIP" onPress={() => onDecision('SKIP')}/>
      <TVButton compact label="UNREVIEWED" onPress={() => onDecision('UNREVIEWED')}/>
    </View>
    <View style={styles.navigationActions}>
      <TVButton compact label="PREVIOUS" onPress={onPrevious}/>
      <TVButton compact label="NEXT" onPress={onNext}/>
      <TVButton compact label="SCORE" onPress={onScore}/>
      <TVButton compact label="EXIT REVIEW" preferred onPress={onExit}/>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: {alignSelf: 'flex-start', maxWidth: 1080, padding: 16, backgroundColor: '#101720ed', borderLeftWidth: 5, borderLeftColor: '#78b9d8'},
  eyebrow: {fontSize: 16, letterSpacing: 2, color: '#78b9d8'}, summary: {marginTop: 5}, title: {fontSize: 30, color: '#f3dfb7', fontWeight: '700'},
  clock: {fontSize: 22, color: '#e0e5ec', marginTop: 2}, score: {fontSize: 18, color: '#c7d6e7', marginTop: 3}, evidence: {fontSize: 18, color: '#dce9c9', marginTop: 3},
  nearby: {fontSize: 17, color: '#f1cd87', marginTop: 3}, reasonHeading: {fontSize: 17, letterSpacing: 1, color: '#78b9d8', marginTop: 9},
  reason: {fontSize: 17, lineHeight: 22, color: '#e0e5ec'}, more: {fontSize: 16, color: '#c7d6e7', marginTop: 2}, status: {fontSize: 17, color: '#f1cd87', marginTop: 7},
  decisionActions: {flexDirection: 'row', marginTop: 6, gap: 8, alignItems: 'center'},
  navigationActions: {flexDirection: 'row', marginTop: 6, gap: 8, alignItems: 'center'},
});
