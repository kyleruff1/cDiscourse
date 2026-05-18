import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../lib/designTokens';

interface ScreenProps {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
}

export function Screen({ title, children, scroll = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// BRAND-001 — `Screen` was the last shared wrapper still painting a
// light-mode backdrop. It now sits on `surface.app` with cream text so
// AuthScreen / AccountScreen / AdminScreen render against the global
// dark theme.
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1c2c',
    backgroundColor: BRAND.surface.appElevated.bg,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: BRAND.text.primary },
  content: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  scrollContent: { padding: 20, paddingBottom: 40 },
});
