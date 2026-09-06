import React from 'react';
import {Text, View, StyleSheet} from 'react-native';
import {work} from '../data/brahms1Movement4';
import type {ScoreEvent} from '../types/score';
export function MusicalContextOverlay({event}: {event?: ScoreEvent}) {
  return <View pointerEvents="none" style={styles.context}>
    <Text style={styles.work}>{work.composer} — {work.title}</Text>
    <Text style={styles.movement}>{work.movement}</Text>
    <Text style={styles.title}>{event ? `Measure ${event.measure} · ${event.title.toUpperCase()}` : 'No score cue at this position'}</Text>
    <Text style={styles.instrument}>{event?.primaryInstruments?.join(' · ') || ' '}</Text>
  </View>;
}
const styles = StyleSheet.create({context: {maxWidth: 1000, padding: 24, backgroundColor: '#101720df', borderRadius: 8}, work: {fontSize: 26, color: '#e5dfd3', letterSpacing: 2}, movement: {fontSize: 24, color: '#b8c1ca', marginTop: 8}, title: {fontSize: 36, color: '#fff', marginTop: 22, fontWeight: '600'}, instrument: {fontSize: 28, color: '#f1cd87', marginTop: 10}});
