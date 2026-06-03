/**
 * META-1E — `MetadataDiffInspector` — Cards-detail metadata diff inspector.
 *
 * A strictly READ-ONLY Inspect-popout sibling overlay. Renders the
 * `MetadataEvent` change timeline for ONE selected move as a
 * "from → to + signal description" list, with four filter chips
 * ("Added tag" / "Removed tag" / "Resolved request" / "Triggered
 * transition") to narrow the list. No write path — the only interactivity
 * is toggling local filter chips (pure view-state).
 *
 * Doctrine:
 *   - §10a — every row is a machine Observation about the move's
 *     structure / lifecycle, never an allegation about a person. No person
 *     id reaches this component (it consumes the derived rows, never an
 *     `appliedByUserId`).
 *   - §9 — every label is plain-language (mapped + suppressed-if-unknown in
 *     the pure model); this component renders only what the model emits.
 *   - §1–§3 — no verdict / heat / popularity framing. Authored copy is
 *     sourced from `METADATA_DIFF_INSPECTOR_COPY` (ban-list-tested).
 *   - All colors token-derived (no hex literals). Chips meet the 44×44
 *     touch-target via `TOUCH_TARGET.hitSlopAll`.
 *
 * No Supabase. No fetch. No router. No AI. No new visual / copy primitive
 * (reuses `InspectGroupHeader` + `designTokens` + `formatDateTime`).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { AnnotationBand } from '../nodeAnnotations';
import { InspectGroupHeader } from '../nodeAnnotations/InspectGroupHeader';
import { RADIUS, SPACING, SURFACE_TOKENS, TOUCH_TARGET } from '../../lib/designTokens';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import { METADATA_DIFF_INSPECTOR_COPY } from '../arguments/gameCopy';
import type { MetadataEvent } from './moveMetadataLedger';
import {
  buildMetadataDiffInspectorModel,
  type MetadataDiffFilterId,
  type MetadataDiffRow,
} from './metadataDiffInspectorModel';

export interface MetadataDiffInspectorProps {
  /** The selected move's id — the host's `activeMessageId`. */
  messageId: string;
  /**
   * The full in-session event stream, READ-ONLY, from the host's
   * `metadataLedger.metadataEvents`. The component filters to `messageId`
   * via the model; it never reads any other ledger field.
   */
  events: ReadonlyArray<MetadataEvent>;
  /**
   * Resolved band for layout parity with the Inspect overlay siblings;
   * defaults to 'tablet'. (Same prop convention as NodeLabelInspectGroups.)
   */
  band?: AnnotationBand;
  /** Container style override. */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough; default 'metadata-diff-inspector'. */
  testID?: string;
}

/** Leading kind marker — TEXT glyph, never color-only (§color independence). */
function kindMarker(kind: MetadataDiffRow['kind']): string {
  if (kind === 'add') return '+';
  if (kind === 'remove') return '−'; // minus sign
  return '→'; // right arrow (transition)
}

/**
 * The read-only metadata diff inspector. Holds only the active-filter set as
 * local UI state; the set starts empty (all rows shown).
 */
export function MetadataDiffInspector(
  props: MetadataDiffInspectorProps,
): React.ReactElement {
  const { messageId, events } = props;
  const baseTestID = props.testID ?? 'metadata-diff-inspector';

  const [activeFilters, setActiveFilters] = useState<
    ReadonlyArray<MetadataDiffFilterId>
  >([]);

  const model = useMemo(
    () =>
      buildMetadataDiffInspectorModel({ events, messageId, activeFilters }),
    [events, messageId, activeFilters],
  );

  const toggleFilter = useCallback((id: MetadataDiffFilterId) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }, []);

  return (
    <View style={[styles.container, props.style]} testID={baseTestID}>
      <InspectGroupHeader
        label={METADATA_DIFF_INSPECTOR_COPY.panelTitle}
        count={model.allRows.length}
        testID={`${baseTestID}-header`}
      />

      {/* Filter chip strip — one Pressable per chip; unavailable chips
          render disabled (not removed) so the set is stable across moves. */}
      <View style={styles.chipStrip} testID={`${baseTestID}-chips`}>
        {model.filters.map((f) => {
          const disabled = !f.available;
          return (
            <Pressable
              key={f.id}
              testID={`${baseTestID}-chip-${f.id}`}
              accessibilityRole="button"
              accessibilityLabel={f.accessibilityLabel}
              accessibilityState={{ selected: f.active, disabled }}
              disabled={disabled}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              onPress={() => toggleFilter(f.id)}
              style={[
                styles.chip,
                f.active && styles.chipActive,
                disabled && styles.chipDisabled,
              ]}
            >
              <Text
                style={[styles.chipLabel, disabled && styles.chipLabelDisabled]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
              <Text
                style={[styles.chipCount, disabled && styles.chipLabelDisabled]}
                numberOfLines={1}
              >
                {`· ${f.count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Row list OR empty state. */}
      {model.isEmpty ? (
        <Text style={styles.emptyState} testID={`${baseTestID}-empty`}>
          {METADATA_DIFF_INSPECTOR_COPY.emptyState}
        </Text>
      ) : (
        <View testID={`${baseTestID}-rows`}>
          {model.visibleRows.map((row) => (
            <View
              key={row.rowId}
              style={styles.row}
              testID={`${baseTestID}-row-${row.rowId}`}
            >
              <Text
                style={styles.rowMarker}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {kindMarker(row.kind)}
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowSignal}>{row.signalDescription}</Text>
                {/* Timestamp — absolute + relative as separate stacked Text
                    (no prose concatenation), same convention as Stage
                    6.1.6b tables. */}
                <Text style={styles.rowTimeAbsolute} numberOfLines={1}>
                  {formatDateTime(row.at)}
                </Text>
                <Text style={styles.rowTimeRelative} numberOfLines={1}>
                  {formatRelativeShort(row.at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.s,
    padding: SPACING.s,
    borderRadius: RADIUS.md,
    backgroundColor: SURFACE_TOKENS.overlay,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
  },
  chipStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.s,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  chipActive: {
    borderColor: SURFACE_TOKENS.focusRing,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  chipLabelDisabled: {
    color: SURFACE_TOKENS.textMuted,
  },
  chipCount: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
  },
  emptyState: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    paddingVertical: SPACING.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.s,
    paddingVertical: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.divider,
  },
  rowMarker: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    width: SPACING.l,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowSignal: {
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
  },
  rowTimeAbsolute: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
  },
  rowTimeRelative: {
    fontSize: 11,
    color: SURFACE_TOKENS.textMuted,
  },
});
