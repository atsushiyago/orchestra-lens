import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {highlightsTourSummary} from '../data/listeningExperiences';
import type {OrchestraLensWork} from '../data/workCatalog';
import {TVButton} from './TVButton';

export function ExperienceEntry({work, highlightCount, ready, onFullMovement, onHighlightsTour, onBackToCatalog, showHighlightReview = false, onHighlightReview, showTourSelectorReview = false, onTourSelectorReview}: {
  work: OrchestraLensWork;
  highlightCount: number;
  ready: boolean;
  onFullMovement: () => void;
  onHighlightsTour: () => void;
  onBackToCatalog: () => void;
  showHighlightReview?: boolean;
  onHighlightReview?: () => void;
  showTourSelectorReview?: boolean;
  onTourSelectorReview?: () => void;
}) {
  return <View style={styles.screen}>
    <View style={styles.content}>
      <Text style={styles.brand}>ORCHESTRA LENS</Text>
      <Text style={styles.composer}>{work.composer}</Text>
      <Text style={styles.title}>{work.workTitle}</Text>
      <Text style={styles.movement}>Movement {work.movementNumber}</Text>
      <Text style={styles.invitation}>See what you’re hearing.</Text>
      <View style={styles.actions}>
        {showHighlightReview && onHighlightReview && <TVButton label="HIGHLIGHT REVIEW" onPress={onHighlightReview}/>} 
        {showTourSelectorReview && onTourSelectorReview && <TVButton label="TOUR SELECTOR REVIEW" onPress={onTourSelectorReview}/>} 
        {work.capabilities.fullMovement && <View style={styles.listeningAction}><TVButton label={work.capabilities.guidedListening ? 'GUIDED LISTENING' : 'PLAY FULL MOVEMENT'} preferred onPress={onFullMovement}/>{work.capabilities.guidedListening && <Text style={styles.listeningHint}>Follow the orchestra as the music unfolds.</Text>}</View>}
        {work.capabilities.highlightsTour && <TVButton label="HIGHLIGHTS TOUR" onPress={onHighlightsTour}/>} 
        <TVButton label="BACK TO CATALOG" onPress={onBackToCatalog}/>
      </View>
      <Text style={styles.summary}>{ready ? highlightsTourSummary(highlightCount) : 'Preparing recording…'}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28, backgroundColor: '#080e16e8'},
  content: {width: '82%', maxWidth: 960, alignItems: 'center'},
  brand: {fontSize: 27, letterSpacing: 5, color: '#f1cd87'},
  composer: {fontSize: 22, letterSpacing: 3, color: '#c7d6e7', marginTop: 24},
  title: {fontSize: 34, lineHeight: 42, color: '#f7f5f0', fontWeight: '700', textAlign: 'center', marginTop: 6},
  movement: {fontSize: 25, color: '#dce9c9', marginTop: 8},
  invitation: {fontSize: 25, color: '#e0e5ec', marginTop: 24},
  actions: {alignItems: 'center', marginTop: 18, gap: 12}, listeningAction: {alignItems: 'center', gap: 5}, listeningHint: {fontSize: 17, color: '#c7d6e7'},
  summary: {fontSize: 19, color: '#c7d6e7', marginTop: 10},
});
