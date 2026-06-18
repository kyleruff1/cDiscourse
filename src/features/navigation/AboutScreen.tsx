/**
 * NAV-START-ARGUMENT-001 Slice B — public "About CivilDiscourse" screen.
 *
 * Reached from the upper-right About item in the global header. PUBLIC /
 * user-facing — available to every authenticated user. Dark-styled to
 * match the global app backdrop. Contains brand + a short, doctrine-safe
 * description + the canonical site mark + a single "Back" control.
 *
 * It contains NO admin / debug / classifier / routing / production content
 * and makes NO verdict / popularity claim. State-only: the Back control
 * calls `onBack` (no router).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BRAND, SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import { APP_HEADER_TAGLINE_TEXT } from '../../components/AppHeaderTagline';
import { APP_COPYRIGHT_TEXT } from './AppPrimaryNav';

/**
 * About copy. Plain language; describes the product's purpose without
 * claiming any post is true/false or any person is right/wrong, and
 * without invoking popularity / engagement as evidence.
 */
const ABOUT_COPY = {
  title: 'About CivilDiscourse',
  tagline: APP_HEADER_TAGLINE_TEXT,
  paragraphs: [
    'CivilDiscourse is a place to take a disagreement seriously. Start an argument around a claim, question, or position, then build a structured thread of replies, challenges, evidence, and clarifications.',
    'The app maps how an argument develops. It does not rank people or rule on who is right; a point earns standing through sources and reasoning, not through how many times it is repeated or how widely it is shared.',
    'A lightweight assistant can suggest moves, but it never deletes, hides, or passes judgment on anyone’s content. The conversation stays yours.',
  ],
  backLabel: 'Back',
} as const;

interface AboutScreenProps {
  /** Return to the previous surface (the gallery). State-only — no router. */
  onBack: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  return (
    <View style={styles.screen} testID="about-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand} testID="about-screen-brand">
          CivilDiscourse
        </Text>
        <Text style={styles.tagline} accessibilityRole="text">
          {ABOUT_COPY.tagline}
        </Text>

        <Text style={styles.title} accessibilityRole="header">
          {ABOUT_COPY.title}
        </Text>

        {ABOUT_COPY.paragraphs.map((p, i) => (
          <Text key={`about-p-${i}`} style={styles.paragraph} testID={`about-screen-paragraph-${i}`}>
            {p}
          </Text>
        ))}

        <Text style={styles.siteMark} testID="about-screen-site-mark" accessibilityRole="text">
          {APP_COPYRIGHT_TEXT}
        </Text>

        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={ABOUT_COPY.backLabel}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
          testID="about-screen-back"
        >
          <Text style={styles.backLabel}>{ABOUT_COPY.backLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  content: { padding: SPACING.xl, gap: SPACING.m },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: BRAND.text.primary,
  },
  tagline: {
    fontSize: 13,
    fontStyle: 'italic',
    color: BRAND.text.taglineFg,
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.text.primary,
    marginTop: SPACING.s,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: SURFACE_TOKENS.textPrimary,
  },
  siteMark: {
    fontSize: 12,
    color: BRAND.text.muted,
    marginTop: SPACING.l,
  },
  back: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.l,
  },
  backPressed: { opacity: 0.8 },
  backLabel: { fontSize: 15, fontWeight: '600', color: CONTROL.secondary.fg },
});
