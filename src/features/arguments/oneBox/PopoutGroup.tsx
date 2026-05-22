/**
 * QOL-030 — Popout chassis: `PopoutGroup`.
 *
 * A labelled group of `PopoutEntry` rows — the shared section primitive
 * QOL-031 (Act), QOL-032 (Inspect) and QOL-033 (Go) all consume verbatim
 * (QOL-030 design §6.4).
 *
 * A group renders a small header label and its child entries. The header
 * is suppressed when the popout has a single group (a lone group reads as
 * a flat list — mirrors `ObserverActionDockLayout.showCategoryHeaders`).
 *
 * Doctrine / accessibility:
 *  - The header is a `<Text>` — plain language, no verdict vocabulary.
 *  - The group exposes `accessibilityRole="menu"` so assistive tech reads
 *    the section as a coherent action group; each child row is a `button`.
 *  - Presentational only. No Supabase, no network, no AI, no local state.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, SPACING } from '../../../lib/designTokens';
import { PopoutEntry, type PopoutEntryProps } from './PopoutEntry';

/** A single entry's render data — `PopoutEntryProps` plus a stable key. */
export interface PopoutGroupEntry extends PopoutEntryProps {
  /** Stable key for the list — the entry id from the content model. */
  key: string;
}

export interface PopoutGroupProps {
  /** Plain-language section heading (e.g. "Respond", "Evidence"). */
  label: string;
  /** The rows in this group. */
  entries: ReadonlyArray<PopoutGroupEntry>;
  /**
   * When false the header label is hidden and the group renders as a flat
   * list. The parent `Popout` passes `false` when it has a single group.
   */
  showHeader?: boolean;
  /** testID passthrough. */
  testID?: string;
}

/**
 * A labelled group of popout rows. Renders nothing when `entries` is
 * empty — an empty group must never leave a stray header behind.
 */
export function PopoutGroup({ label, entries, showHeader = true, testID }: PopoutGroupProps) {
  if (entries.length === 0) return null;

  return (
    <View
      style={styles.group}
      accessibilityRole="menu"
      accessibilityLabel={label}
      testID={testID}
    >
      {showHeader ? (
        <Text style={styles.header} accessibilityRole="header">
          {label}
        </Text>
      ) : null}
      {entries.map((entry) => {
        const { key, ...entryProps } = entry;
        return <PopoutEntry key={key} {...entryProps} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    paddingVertical: SPACING.xs,
  },
  header: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
  },
});
