import React, {useState} from 'react';
import {Pressable, Text, StyleSheet} from 'react-native';
export function TVButton({label, onPress, preferred = false, compact = false}: {label: string; onPress: () => void; preferred?: boolean; compact?: boolean}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    focusable hasTVPreferredFocus={preferred} onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)} onPress={onPress}
    style={[styles.button, compact && styles.compactButton, focused && styles.focused]}>
    <Text style={[styles.label, compact && styles.compactLabel, focused && styles.focusedLabel]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: {borderWidth: 3, borderColor: '#737d89', borderRadius: 8, paddingHorizontal: 26, paddingVertical: 16, backgroundColor: '#18212d', marginRight: 14},
  compactButton: {paddingHorizontal: 16, paddingVertical: 10, marginRight: 0},
  focused: {borderColor: '#f1cd87', backgroundColor: '#f1cd87'},
  label: {fontSize: 26, color: '#f7f5f0', fontWeight: '600'}, compactLabel: {fontSize: 20}, focusedLabel: {color: '#121923'},
});
