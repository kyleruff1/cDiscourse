import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
});
