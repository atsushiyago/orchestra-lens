import React from 'react';
import {Text, View, StyleSheet} from 'react-native';
import type {ScoreEvent} from '../types/score';
export function MusicalContextOverlay({event, composer, workTitle, movementTitle}: {event?: ScoreEvent; composer: string; workTitle: string; movementTitle: string}) {
  return <View pointerEvents="none" style={styles.context}>
    <Text style={styles.work}>{composer} — {workTitle}</Text>
    <Text style={styles.movement}>{movementTitle}</Text>
    {event && <Text style={styles.title}>Measure {event.measure} · {event.title.toUpperCase()}</Text>}
    <Text style={styles.instrument}>{event?.primaryInstruments?.join(' · ') || ' '}</Text>
  </View>;
}
const styles = StyleSheet.create({context: {maxWidth: 1000, padding: 24, backgroundColor: '#101720df', borderRadius: 8}, work: {fontSize: 26, color: '#e5dfd3', letterSpacing: 2}, movement: {fontSize: 24, color: '#b8c1ca', marginTop: 8}, title: {fontSize: 36, color: '#fff', marginTop: 22, fontWeight: '600'}, instrument: {fontSize: 28, color: '#f1cd87', marginTop: 10}});
