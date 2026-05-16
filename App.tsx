import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type Screen = 'auth' | 'debates' | 'arguments';

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />

      {/* Nav tabs — placeholder until Expo Router is wired in Stage 3 */}
      <View style={styles.tabBar}>
        {(['auth', 'debates', 'arguments'] as Screen[]).map((s) => (
          <Pressable
            key={s}
            style={[styles.tab, screen === s && styles.tabActive]}
            onPress={() => setScreen(s)}
            accessibilityRole="tab"
            accessibilityLabel={s}
          >
            <Text style={[styles.tabText, screen === s && styles.tabTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {screen === 'auth' && <AuthPlaceholder />}
        {screen === 'debates' && <DebatesPlaceholder />}
        {screen === 'arguments' && <ArgumentsPlaceholder />}
      </View>
    </SafeAreaView>
  );
}

function AuthPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Auth</Text>
      <Text style={styles.placeholderBody}>
        Sign in / Sign up — implemented in Stage 2 (Supabase Auth).
      </Text>
    </View>
  );
}

function DebatesPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Debate Rooms</Text>
      <Text style={styles.placeholderBody}>
        Room list and room creation — implemented in Stage 3.
      </Text>
    </View>
  );
}

function ArgumentsPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Argument Tree</Text>
      <Text style={styles.placeholderBody}>
        Recursive argument tree (CLM → RBT → CRB …) — implemented in Stage 4.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#6366f1' },
  body: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  placeholderTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  placeholderBody: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
});
