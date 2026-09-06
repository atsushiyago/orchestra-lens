import React, {useState} from 'react';
import {Image, View, Text, StyleSheet} from 'react-native';
import type {ScoreEvent} from '../types/score';
import {getRuntimeCue} from '../data/runtimeCue';
import type {SmartScoreAsset} from '../data/smartScore';
import {useAskTheScore} from '../hooks/useAskTheScore';
import {TVButton} from './TVButton';

const scoreAssets: Record<SmartScoreAsset, number> = {
  'm30-horn': require('../assets/brahms-op68-iv-m30-horn.png'),
  'm30-flute': require('../assets/brahms-op68-iv-m30-flute.png'),
  'm30-strings': require('../assets/brahms-op68-iv-m30-strings.png'),
  'm62-violins': require('../assets/brahms-op68-iv-m62-violins.png'),
  'm62-lower-strings': require('../assets/brahms-op68-iv-m62-lower-strings.png'),
  'm62-horn': require('../assets/brahms-op68-iv-m62-horn.png'),
  'm285-horn': require('../assets/brahms-op68-iv-m285-horn.png'),
  'm47-chorale': require('../assets/brahms-op68-iv-m47-chorale.png'),
  'm407-chorale': require('../assets/brahms-op68-iv-m407-chorale.png'),
};

export function ScorePeek({event, onClose}: {event?: ScoreEvent; onClose: () => void}) {
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const {status: askStatus, ask} = useAskTheScore();
  const runtimeCue = getRuntimeCue(event?.measure);
  const scoreParts = runtimeCue?.smartScoreParts ?? [];
  const scoreRows = scoreParts.flatMap(part => part.curatedRole ? [{...part, ...part.curatedRole}] : []);
  const themeLens = runtimeCue?.themeLens;
  const themeAsset = scoreParts[0] && scoreAssets[scoreParts[0].asset];
  const firstHeardParts = getRuntimeCue(themeLens?.firstHeard.measure)?.smartScoreParts ?? [];
  const firstHeardAsset = firstHeardParts[0] && scoreAssets[firstHeardParts[0].asset];
  const firstHeardDescription = themeLens?.firstHeard.instrument ? `${themeLens.firstHeard.instrument} · ${themeLens.firstHeard.label}` : themeLens?.firstHeard.label;
  const hasThemeLensBody = Boolean(themeLens && themeAsset && firstHeardAsset);
  const hasBody = scoreRows.length > 0 || hasThemeLensBody;
  const canAsk = runtimeCue?.measure === 62;
  const header = event?.measure ? `SCORE PEEK · BRAHMS 1 · IV · m.${event.measure}` : 'SCORE PEEK';
  return <View style={styles.screen} accessibilityViewIsModal>
      <View style={styles.panel}>
      <Text style={styles.header}>{header}</Text>
      {askStatus.kind !== 'idle' ? <View style={styles.askPanel}>
        <Text style={styles.askHeading}>WHAT AM I HEARING?</Text>
        {askStatus.kind === 'loading' ? <Text style={styles.askText}>Thinking…</Text> : askStatus.kind === 'success' ? <Text style={styles.askText}>{askStatus.answer}</Text> : <Text style={styles.askError}>{askStatus.message}</Text>}
      </View> : comparisonOpen && themeLens && firstHeardAsset ? <View style={styles.comparison}>
        <Text style={styles.comparisonTitle}>COMPARE · THEME RETURN</Text>
        <View style={styles.comparisonCards}>
          <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>FIRST HEARD · m.{themeLens.firstHeard.measure}</Text><Text style={styles.comparisonRole}>{firstHeardDescription}</Text><Image source={firstHeardAsset} resizeMode="contain" style={styles.comparisonImage}/></View>
          <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>NOW · m.{themeLens.now.measure}</Text><Text style={styles.comparisonRole}>{themeLens.now.label}</Text><Image source={themeAsset} resizeMode="contain" style={styles.comparisonImage}/></View>
        </View>
      </View> : hasThemeLensBody && themeLens ? <View style={styles.themeLens}>
        <Text style={styles.themeHeadline}>{themeLens.headline}</Text>
        <Text style={styles.themeText}>First heard: m.{themeLens.firstHeard.measure} · {firstHeardDescription}</Text>
        <Text style={styles.themeText}>Now: m.{themeLens.now.measure} · {themeLens.now.label}</Text>
        <Image source={themeAsset} resizeMode="contain" style={styles.themeImage}/>
        <TVButton label="COMPARE" onPress={() => setComparisonOpen(true)}/>
      </View> : scoreRows.length > 0 && <View style={styles.smartScore}>
        {scoreRows.map(({instrument, role, emphasis, asset}) => <View key={instrument} style={[styles.scoreRow, styles[emphasis]]}>
          <View style={styles.roleLabel}>
            <Text style={styles.instrument}>{instrument}</Text>
            <Text style={styles.role}>{role}</Text>
          </View>
          <Image source={scoreAssets[asset]} resizeMode="contain" style={styles.scoreImage}/>
        </View>)}
      </View>}
      {!comparisonOpen && !hasBody && event && <View style={styles.diagnostic}><Text style={styles.diagnosticText}>Score Peek content is unavailable for m.{event.measure}. Check cue assets and relationship metadata.</Text></View>}
      <View style={styles.footer}>
        {canAsk && askStatus.kind === 'idle' && runtimeCue && <TVButton label="ASK THE SCORE" onPress={() => void ask(runtimeCue)}/>} 
        {canAsk && askStatus.kind === 'error' && runtimeCue && <TVButton label="TRY AGAIN" onPress={() => void ask(runtimeCue)}/>} 
        <TVButton label="BACK" preferred onPress={comparisonOpen ? () => setComparisonOpen(false) : onClose}/>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({screen: {...StyleSheet.absoluteFillObject, backgroundColor: '#0b111bf5', alignItems: 'center', paddingVertical: 16, overflow: 'hidden'}, panel: {width: '92%', maxWidth: 1180, flex: 1}, header: {fontSize: 22, lineHeight: 28, color: '#f1cd87', letterSpacing: 2}, smartScore: {marginTop: 6, backgroundColor: '#f7f4ed', paddingVertical: 2}, scoreRow: {height: 132, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, borderLeftColor: '#687482', paddingRight: 8}, primary: {borderLeftColor: '#f1cd87'}, secondary: {borderLeftColor: '#aeb8c5'}, upcoming: {borderLeftColor: '#78b9d8'}, supporting: {borderLeftColor: '#91a6bd'}, roleLabel: {width: 240, paddingLeft: 16}, instrument: {fontSize: 25, color: '#1b2734', fontWeight: '700'}, role: {fontSize: 18, lineHeight: 23, color: '#354454', marginTop: 3}, scoreImage: {flex: 1, height: 118}, themeLens: {marginTop: 8, padding: 18, backgroundColor: '#f7f4ed', alignItems: 'flex-start'}, themeHeadline: {fontSize: 24, lineHeight: 29, color: '#1b2734', fontWeight: '700'}, themeText: {fontSize: 18, lineHeight: 25, color: '#354454', marginTop: 4}, themeImage: {alignSelf: 'stretch', height: 118, marginVertical: 6}, comparison: {marginTop: 8, padding: 16, backgroundColor: '#f7f4ed'}, comparisonTitle: {fontSize: 22, color: '#1b2734', fontWeight: '700'}, comparisonCards: {flexDirection: 'row', gap: 16, marginTop: 8}, comparisonCard: {flex: 1}, comparisonLabel: {fontSize: 17, color: '#354454', fontWeight: '700'}, comparisonRole: {fontSize: 17, color: '#354454', marginTop: 2}, comparisonImage: {width: '100%', height: 92, marginTop: 5}, askPanel: {marginTop: 16, padding: 24, backgroundColor: '#f7f4ed'}, askHeading: {fontSize: 24, color: '#1b2734', fontWeight: '700'}, askText: {fontSize: 22, lineHeight: 31, color: '#354454', marginTop: 14}, askError: {fontSize: 22, lineHeight: 31, color: '#7d2832', marginTop: 14}, diagnostic: {marginTop: 16, padding: 20, backgroundColor: '#351c21'}, diagnosticText: {fontSize: 20, color: '#f4c6c6'}, footer: {height: 110, marginTop: 'auto', paddingBottom: 28, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end'}});
