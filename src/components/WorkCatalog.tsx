import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {OrchestraLensWork} from '../data/workCatalog';
import {TVButton} from './TVButton';

export function WorkCatalog({works, onSelect}: {works: readonly OrchestraLensWork[]; onSelect: (work: OrchestraLensWork) => void}) {
  return <View style={styles.screen}>
    <View style={styles.content}>
      <Text style={styles.brand}>ORCHESTRA LENS</Text>
      <Text style={styles.invitation}>See what you’re hearing.</Text>
      <Text style={styles.heading}>CHOOSE A WORK</Text>
      {works.map((work, index) => <TVButton key={work.id} preferred={index === 0} label={`${work.composer}\n${work.workTitle}\nMovement ${work.movementNumber}`} onPress={() => onSelect(work)}/>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, backgroundColor: '#080e16e8'},
  content: {width: '84%', maxWidth: 980, alignItems: 'center'}, brand: {fontSize: 27, letterSpacing: 5, color: '#f1cd87'},
  invitation: {fontSize: 24, color: '#e0e5ec', marginTop: 20}, heading: {fontSize: 20, letterSpacing: 3, color: '#c7d6e7', marginTop: 28, marginBottom: 10},
});
