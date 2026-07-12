import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS } from '../lib/designTokens';

interface LoadingNoticeProps {
  message?: string;
}

export function LoadingNotice({ message = 'Loading…' }: LoadingNoticeProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={SURFACE_TOKENS.focusRing} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { marginTop: 14, fontSize: 15, color: SURFACE_TOKENS.textSecondary },
});
