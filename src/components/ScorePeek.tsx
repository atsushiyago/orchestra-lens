import React, {useEffect, useState} from 'react';
import {Image, View, Text, StyleSheet} from 'react-native';
import type {ScoreEvent} from '../types/score';
import {getRuntimeCue} from '../data/runtimeCue';
import type {SmartScoreAsset} from '../data/smartScore';
import {useAskTheScore} from '../hooks/useAskTheScore';
import {TVButton} from './TVButton';
import type {HighlightReviewCandidate} from '../playback/highlightReview';

const scoreAssets: Record<SmartScoreAsset, number> = {
  'm30-horn': require('../assets/brahms-op68-iv-m30-horn.png'),
  'm30-flute': require('../assets/brahms-op68-iv-m30-flute.png'),
  'm30-strings': require('../assets/brahms-op68-iv-m30-strings.png'),
  'm62-violins': require('../assets/brahms-op68-iv-m62-violins.png'),
  'm62-lower-strings': require('../assets/brahms-op68-iv-m62-lower-strings.png'),
  'm62-horn': require('../assets/brahms-op68-iv-m62-horn.png'),
  'm290-horn': require('../assets/brahms-op68-iv-m290-horn.png'),
  'm47-chorale': require('../assets/brahms-op68-iv-m47-chorale.png'),
  'm407-chorale': require('../assets/brahms-op68-iv-m407-chorale.png'),
};

export function ScorePeek({event, onClose, scoreInsight, contextual = false, allowAskTheScore = true}: {event?: ScoreEvent; onClose: () => void; scoreInsight?: HighlightReviewCandidate; contextual?: boolean; allowAskTheScore?: boolean}) {
  const [comparisonOpen, setComparisonOpen] = useState(false);
  useEffect(() => setComparisonOpen(false), [event?.measure]);
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
  const canAsk = allowAskTheScore && runtimeCue?.measure === 62;
  const header = event?.measure ? `SCORE PEEK · BRAHMS 1 · IV · m.${event.measure}` : 'SCORE PEEK';
  return <View style={styles.screen} accessibilityViewIsModal={!contextual}>
      <View style={styles.panel}>
      <Text style={styles.header}>{header}</Text>
      {askStatus.kind !== 'idle' ? <View style={styles.askPanel}>
        <Text style={styles.askHeading}>WHAT AM I HEARING?</Text>
        {askStatus.kind === 'loading' ? <Text style={styles.askText}>Thinking…</Text> : askStatus.kind === 'success' ? <Text style={styles.askText}>{askStatus.answer}</Text> : <Text style={styles.askError}>{askStatus.message}</Text>}
      </View> : comparisonOpen && themeLens && firstHeardAsset ? <View style={styles.comparison}>
        <Text style={styles.comparisonTitle}>COMPARE · THEME RETURN</Text>
        <View style={styles.comparisonCards}>
          <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>FIRST HEARD · m.{themeLens.firstHeard.measure}</Text><Text style={styles.comparisonRole}>{firstHeardDescription}</Text><View style={styles.comparisonImageFrame}><Image source={firstHeardAsset} resizeMode="contain" style={styles.comparisonImage}/></View></View>
          <View style={styles.comparisonCard}><Text style={styles.comparisonLabel}>NOW · m.{themeLens.now.measure}</Text><Text style={styles.comparisonRole}>{themeLens.now.label}</Text><View style={styles.comparisonImageFrame}><Image source={themeAsset} resizeMode="contain" style={styles.comparisonImage}/></View></View>
        </View>
      </View> : contextual && hasThemeLensBody && themeLens ? <View style={styles.contextualThemeLens}>
        <Text style={styles.themeHeadline}>{themeLens.headline}</Text>
        <Text style={styles.themeText}>Earlier: m.{themeLens.firstHeard.measure} · {firstHeardDescription}</Text>
        <Text style={styles.themeText}>Now: m.{themeLens.now.measure} · {themeLens.now.label}</Text>
        <TVButton compact label="COMPARE" onPress={() => setComparisonOpen(true)}/>
      </View> : hasThemeLensBody && themeLens ? <View style={styles.themeLens}>
        <Text style={styles.themeHeadline}>{themeLens.headline}</Text>
        <Text style={styles.themeText}>First heard: m.{themeLens.firstHeard.measure} · {firstHeardDescription}</Text>
        <Text style={styles.themeText}>Now: m.{themeLens.now.measure} · {themeLens.now.label}</Text>
        <View style={styles.themeImageFrame}><Image source={themeAsset} resizeMode="contain" style={styles.themeImage}/></View>
        <TVButton compact label="COMPARE" onPress={() => setComparisonOpen(true)}/>
      </View> : scoreRows.length > 0 && <View style={styles.smartScore}>
        {scoreRows.map(({instrument, role, emphasis, asset}) => <View key={instrument} style={[styles.scoreRow, styles[emphasis]]}>
          <View style={styles.roleLabel}>
            <Text style={styles.instrument}>{instrument}</Text>
            <Text style={styles.role}>{role}</Text>
          </View>
          <Image source={scoreAssets[asset]} resizeMode="contain" style={styles.scoreImage}/>
        </View>)}
      </View>}
      {!comparisonOpen && !hasBody && scoreInsight && <View style={styles.debugFacts}>
        <Text style={styles.debugFactsHeading}>SCORE INSIGHT</Text>
        <Text style={styles.debugFactsText}>No dedicated notation excerpt is available for m.{scoreInsight.measure}.</Text>
        <Text style={styles.debugFactsText}>Active instruments ({scoreInsight.activeInstruments.length}): {scoreInsight.activeInstruments.join(', ')}</Text>
        <Text style={styles.debugFactsText}>Texture density: {scoreInsight.features.textureDensity}</Text>
        {scoreInsight.hauptstimme.length > 0 && <Text style={styles.debugFactsText}>Main voice evidence: {scoreInsight.hauptstimme.map(span => `${span.part} (${span.label})`).join(', ')}</Text>}
        {scoreInsight.reasons.slice(0, 3).map(reason => <Text key={reason} style={styles.debugFactsText}>• {reason}</Text>)}
      </View>}
      {!comparisonOpen && !hasBody && !scoreInsight && event && <View style={styles.diagnostic}><Text style={styles.diagnosticText}>Score Peek content is unavailable for m.{event.measure}. Check cue assets and relationship metadata.</Text></View>}
      <View style={styles.footer}>
        {canAsk && askStatus.kind === 'idle' && runtimeCue && (
          <TVButton compact label="ASK THE SCORE" onPress={() => void ask(runtimeCue)}/>
        )}
        {canAsk && askStatus.kind === 'error' && runtimeCue && (
          <TVButton compact label="TRY AGAIN" onPress={() => void ask(runtimeCue)}/>
        )}
        {(comparisonOpen || !contextual) && <TVButton compact label={comparisonOpen ? 'BACK TO CUE' : 'BACK'} preferred onPress={comparisonOpen ? () => setComparisonOpen(false) : onClose}/>}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({screen: {...StyleSheet.absoluteFillObject, backgroundColor: '#0b111bf5', alignItems: 'center', paddingVertical: 12, overflow: 'hidden'}, panel: {width: '92%', maxWidth: 1180, flex: 1}, header: {fontSize: 22, lineHeight: 28, color: '#f1cd87', letterSpacing: 2}, smartScore: {marginTop: 5, backgroundColor: '#f7f4ed', paddingVertical: 1}, scoreRow: {height: 132, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, borderLeftColor: '#687482', paddingRight: 8}, primary: {borderLeftColor: '#f1cd87'}, secondary: {borderLeftColor: '#aeb8c5'}, upcoming: {borderLeftColor: '#78b9d8'}, supporting: {borderLeftColor: '#91a6bd'}, roleLabel: {width: 240, paddingLeft: 16}, instrument: {fontSize: 25, color: '#1b2734', fontWeight: '700'}, role: {fontSize: 18, lineHeight: 23, color: '#354454', marginTop: 3}, scoreImage: {flex: 1, height: 118}, themeLens: {marginTop: 6, padding: 14, backgroundColor: '#f7f4ed', alignItems: 'stretch'}, contextualThemeLens: {marginTop: 10, padding: 16, backgroundColor: '#f7f4ed', alignItems: 'flex-start'}, themeHeadline: {fontSize: 24, lineHeight: 29, color: '#1b2734', fontWeight: '700'}, themeText: {fontSize: 18, lineHeight: 24, color: '#354454', marginTop: 3}, themeImageFrame: {width: '100%', height: 118, marginVertical: 5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}, themeImage: {width: '100%', height: '100%'}, comparison: {marginTop: 6, padding: 12, backgroundColor: '#f7f4ed'}, comparisonTitle: {fontSize: 22, color: '#1b2734', fontWeight: '700'}, comparisonCards: {flexDirection: 'row', gap: 16, marginTop: 6}, comparisonCard: {flex: 1}, comparisonLabel: {fontSize: 17, color: '#354454', fontWeight: '700'}, comparisonRole: {fontSize: 17, color: '#354454', marginTop: 2}, comparisonImageFrame: {width: '100%', height: 92, marginTop: 5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden'}, comparisonImage: {width: '100%', height: '100%'}, askPanel: {marginTop: 10, padding: 18, backgroundColor: '#f7f4ed'}, askHeading: {fontSize: 24, color: '#1b2734', fontWeight: '700'}, askText: {fontSize: 22, lineHeight: 30, color: '#354454', marginTop: 10}, askError: {fontSize: 22, lineHeight: 30, color: '#7d2832', marginTop: 10}, diagnostic: {marginTop: 10, padding: 16, backgroundColor: '#351c21'}, diagnosticText: {fontSize: 20, color: '#f4c6c6'}, debugFacts: {marginTop: 10, padding: 16, backgroundColor: '#f7f4ed'}, debugFactsHeading: {fontSize: 22, fontWeight: '700', color: '#1b2734'}, debugFactsText: {fontSize: 18, lineHeight: 24, color: '#354454', marginTop: 3}, footer: {height: 76, marginTop: 'auto', paddingBottom: 10, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end'}});
