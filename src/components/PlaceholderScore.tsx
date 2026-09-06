import React from 'react';
import {Text, View, StyleSheet} from 'react-native';
import type {ScoreEvent} from '../types/score';
// Phase 2 replacement boundary: this component receives the exact selected cue.
// The decorative marks below are not Brahms notation.
export function PlaceholderScore({event}: {event?: ScoreEvent}) {
  return <View style={styles.score}>
    {['Horn', 'Violins', 'Cellos', 'Brass'].map((name, index) => <View key={name} style={styles.row}>
      <Text style={[styles.name, event?.primaryInstruments?.includes(name) && styles.active]}>{name}</Text>
      <View style={styles.staff}>{[0, 1, 2, 3, 4].map(line => <View key={line} style={styles.line}/>)}
        <Text style={styles.notes}>{index === 1 ? '♪     ♪     ♪     ♪' : index === 2 ? '—' : '       ♪'}</Text>
      </View>
    </View>)}
    <Text style={styles.caption}>Illustrative notation only</Text>
  </View>;
}
const styles = StyleSheet.create({score: {marginVertical: 22}, row: {flexDirection: 'row', alignItems: 'center', marginBottom: 20}, name: {color: '#b9c2cd', fontSize: 28, width: 160}, active: {color: '#f1cd87', fontWeight: '700'}, staff: {height: 52, flex: 1, justifyContent: 'space-between'}, line: {height: 1, backgroundColor: '#667180'}, notes: {position: 'absolute', left: 24, top: -6, fontSize: 42, color: '#f5f1e8'}, caption: {color: '#a9b3c1', fontSize: 22}});
