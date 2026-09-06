import React, {useState} from 'react';
import {Pressable, Text, StyleSheet} from 'react-native';
export function TVButton({label, onPress, preferred = false}: {label: string; onPress: () => void; preferred?: boolean}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    focusable hasTVPreferredFocus={preferred} onFocus={() => setFocused(true)}
    onBlur={() => setFocused(false)} onPress={onPress}
    style={[styles.button, focused && styles.focused]}>
    <Text style={[styles.label, focused && styles.focusedLabel]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: {borderWidth: 3, borderColor: '#737d89', borderRadius: 8, paddingHorizontal: 26, paddingVertical: 16, backgroundColor: '#18212d', marginRight: 14},
  focused: {borderColor: '#f1cd87', backgroundColor: '#f1cd87'},
  label: {fontSize: 26, color: '#f7f5f0', fontWeight: '600'}, focusedLabel: {color: '#121923'},
});
