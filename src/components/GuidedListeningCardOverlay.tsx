import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {GuidedListeningRuntimeCue} from '../data/guidedListening';
import {brahmsGuidedListeningScoreAssets} from '../data/generated/brahmsGuidedListeningAssets';
import type {ThemeLensRelationship} from '../data/themeLens';
import {TVButton} from './TVButton';
import {useAskTheScore} from '../hooks/useAskTheScore';
import {getRuntimeCue} from '../data/runtimeCue';

/**
 * Presentation-only overlay. It receives a cue selected from media currentTime
 * and intentionally has no player, transport, or source-lifecycle dependency.
 */
export function GuidedListeningCardOverlay({cue, themeLens, canAskTheScore, onCompare}: {cue: GuidedListeningRuntimeCue; themeLens?: ThemeLensRelationship; canAskTheScore: boolean; onCompare: () => void}) {
  const {status, ask} = useAskTheScore();
  const askCue = canAskTheScore ? getRuntimeCue(cue.measure) : undefined;
  const asset = brahmsGuidedListeningScoreAssets[cue.scoreAssetKey];
  return <View style={styles.card}>
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>WHAT TO HEAR</Text>
      <Text style={styles.label}>{cue.label}</Text>
      <Text style={styles.hint}>{cue.listenerHint}</Text>
      <Text style={styles.context}>{cue.work.composer} · {cue.work.title} · {cue.work.movement}</Text>
    </View>
    <View style={styles.body}>
      <View style={styles.xray}>
        <Text style={styles.section}>ORCHESTRA X-RAY</Text>
        {cue.mainVoice && <View style={styles.mainVoice}>
          <Text style={styles.role}>MAIN VOICE</Text>
          <Text style={styles.instrument}>{cue.mainVoice.instrument}</Text>
        </View>}
        {cue.activeInstruments.length > 0 && <View style={styles.alsoSounding}>
          <Text style={styles.role}>ALSO SOUNDING</Text>
          {cue.activeInstruments.map(instrument => <Text key={instrument} style={styles.supporting}>{instrument}</Text>)}
        </View>}
        {themeLens && <View style={styles.theme}>
          <Text style={styles.themeHeading}>{themeLens.headline}</Text>
          <Text style={styles.themeText}>Earlier: m.{themeLens.firstHeard.measure}</Text>
          <Text style={styles.themeText}>Now: m.{themeLens.now.measure}</Text>
          <TVButton compact label="COMPARE" onPress={onCompare}/>
        </View>}
        {canAskTheScore && askCue && <View style={styles.ask}>
          {status.kind === 'success' ? <><Text style={styles.askHeading}>WHAT AM I HEARING?</Text><Text style={styles.askText}>{status.answer}</Text></> : status.kind === 'loading' ? <Text style={styles.askText}>Thinking…</Text> : status.kind === 'error' ? <><Text style={styles.askError}>{status.message}</Text><TVButton compact label="TRY AGAIN" onPress={() => void ask(askCue)}/></> : <TVButton compact label="ASK THE SCORE" onPress={() => void ask(askCue)}/>} 
        </View>}
      </View>
      <View style={styles.scorePanel}>
        <Text style={[styles.section, styles.scoreSection]}>SMART SCORE</Text>
        {asset && <View style={styles.scoreFrame}><Image source={asset} resizeMode="contain" style={styles.score}/></View>}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: {flex: 1, minHeight: 0, paddingTop: 4},
  heading: {paddingBottom: 6}, eyebrow: {fontSize: 17, letterSpacing: 3, color: '#f1cd87', fontWeight: '700'}, label: {fontSize: 31, lineHeight: 36, color: '#fff8e9', fontWeight: '700', marginTop: 2}, hint: {fontSize: 21, lineHeight: 26, color: '#d6e2ef', marginTop: 3}, context: {fontSize: 15, color: '#aebdcd', marginTop: 3},
  body: {flex: 1, minHeight: 0, flexDirection: 'row', gap: 12}, xray: {width: '25%', minWidth: 250, padding: 14, backgroundColor: '#101720df', borderLeftWidth: 4, borderLeftColor: '#f1cd87'}, scorePanel: {flex: 1, minWidth: 0, padding: 8, backgroundColor: '#f7f4ed'}, section: {fontSize: 16, letterSpacing: 2, color: '#f1cd87', fontWeight: '700'}, scoreSection: {color: '#354454'}, mainVoice: {marginTop: 13}, role: {fontSize: 14, letterSpacing: 2, color: '#aebdcd', fontWeight: '700'}, instrument: {fontSize: 25, lineHeight: 30, color: '#fff5d8', fontWeight: '700', marginTop: 2}, alsoSounding: {marginTop: 14}, supporting: {fontSize: 18, lineHeight: 23, color: '#d4e0ec', marginTop: 2}, theme: {marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#566271'}, themeHeading: {fontSize: 16, color: '#f1cd87', fontWeight: '700'}, themeText: {fontSize: 15, lineHeight: 19, color: '#d4e0ec', marginTop: 1}, ask: {marginTop: 12}, askHeading: {fontSize: 16, color: '#f1cd87', fontWeight: '700'}, askText: {fontSize: 16, lineHeight: 22, color: '#e6edf5', marginTop: 5}, askError: {fontSize: 16, lineHeight: 22, color: '#ffb2b8', marginBottom: 6}, scoreFrame: {flex: 1, minHeight: 0, marginTop: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'}, score: {width: '100%', height: '100%'},
});
