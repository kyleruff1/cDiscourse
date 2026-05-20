/**
 * PR-001 — Reusable preference-row primitives.
 *
 * `PreferenceSegmentedControl` — a labelled radiogroup of options.
 * `PreferenceToggleRow` — a labelled switch row.
 *
 * Both are pure presentational components built from React Native
 * core primitives (`Pressable`, `Switch`, `Text`, `View`) — no new
 * dependency. Every interactive element carries `accessibilityRole`,
 * `accessibilityLabel`, `accessibilityState`, and a ≥ 44×44 hit target.
 */

import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

// ── Segmented control ───────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  /** Field label rendered above the control. */
  label: string;
  /** Optional helper line under the label. */
  helper?: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Stable prefix for per-option testIDs: `${testIDPrefix}-option-<value>`. */
  testIDPrefix: string;
  /** Container testID. */
  testID?: string;
  /** High-contrast preference — thickens borders for legibility. */
  highContrast?: boolean;
}

export function PreferenceSegmentedControl<T extends string>({
  label,
  helper,
  options,
  value,
  onChange,
  testIDPrefix,
  testID,
  highContrast,
}: SegmentedProps<T>) {
  return (
    <View style={styles.field} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <View
        style={styles.segmentRow}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              testID={`${testIDPrefix}-option-${opt.value}`}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              style={[
                styles.segment,
                highContrast && styles.segmentHighContrast,
                selected && styles.segmentSelected,
                selected && highContrast && styles.segmentSelectedHighContrast,
              ]}
            >
              <Text
                style={[styles.segmentText, selected && styles.segmentTextSelected]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Toggle row ──────────────────────────────────────────────────

interface ToggleProps {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Accessible label for the switch itself. */
  switchAccessibilityLabel: string;
  switchTestID: string;
  testID?: string;
}

export function PreferenceToggleRow({
  label,
  helper,
  value,
  onChange,
  switchAccessibilityLabel,
  switchTestID,
  testID,
}: ToggleProps) {
  return (
    <View style={styles.field} testID={testID}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextCol}>
          <Text style={styles.label}>{label}</Text>
          {helper ? <Text style={styles.helper}>{helper}</Text> : null}
        </View>
        <Switch
          testID={switchTestID}
          value={value}
          onValueChange={onChange}
          accessibilityRole="switch"
          accessibilityLabel={switchAccessibilityLabel}
          accessibilityState={{ checked: value }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 18,
  },
  label: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  helper: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  segment: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  segmentHighContrast: {
    borderWidth: 2,
    borderColor: '#475569',
  },
  segmentSelected: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  segmentSelectedHighContrast: {
    borderColor: '#a5b4fc',
    borderWidth: 2,
  },
  segmentText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextCol: {
    flex: 1,
  },
});
