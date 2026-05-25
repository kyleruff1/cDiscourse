/**
 * UX-001.3 — OfferConcessionSchema.
 *
 * The `offer_concession` box body: an author-side forced list of
 * concession items. Mirrors the receiver-side `RespondToConcessionSchema`
 * shape (one row per item, each row carries a label + optional
 * clarification) but the author drives the rows.
 *
 * The brief disallows schema changes, so v1 serializes the row list
 * into the existing `body` field as plain text (one item per line,
 * `:` separating the item text from its clarification). A future
 * card may introduce a dedicated `concession_items` column; this
 * file's serializer is the seam.
 *
 * Doctrine (UX-001.3 §2 row 13 + cdiscourse-doctrine §1 / §9):
 *   1. **Forced list — no single free body.** Itemization is
 *      structural (matches the receiver-side `respond_to_concession`
 *      schema). The user adds rows; row order is preserved.
 *   2. **Each row REQUIRES non-empty item text.** Empty rows are
 *      stripped before serialization. Post is blocked when no rows
 *      have content.
 *   3. **Clarification per row is optional.** Empty clarification
 *      strings are dropped from the serialized form.
 *   4. **Plain language only.** No verdict tokens. The author is
 *      offering a concession, not pronouncing judgment.
 *   5. **44×44 hit targets.** Every interactive control meets the
 *      accessibility floor.
 *
 * Pure presentation. The composer owns the draft + submit flow; this
 * schema renders the form and exposes the serialized body.
 */
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SURFACE_TOKENS, RADIUS, SPACING, CONTROL } from '../../../../lib/designTokens';

// ── Public copy ───────────────────────────────────────────────

export const OFFER_CONCESSION_SCHEMA_COPY = Object.freeze({
  intro:
    'List the points you are conceding. Each row is one point.',
  rowItemLabel: 'Point you are conceding',
  rowItemPlaceholder: 'Briefly state the point…',
  rowClarificationLabel: 'Why you are conceding (optional)',
  rowClarificationPlaceholder: 'Add a short explanation if it helps…',
  addRowButton: 'Add another point',
  removeRowButton: 'Remove this point',
  emptyHint: 'Add at least one concession point to continue.',
});

// Single max length for both item + clarification — kept short so a
// concession is a discrete point, not a paragraph.
export const OFFER_CONCESSION_ITEM_MAX = 240;
export const OFFER_CONCESSION_CLARIFICATION_MAX = 480;

// ── Row model ─────────────────────────────────────────────────

/**
 * One concession row. Plain data; the composer's draft.listItems
 * field carries a `JSON.stringify(rows)` snapshot OR a normalized
 * sentinel — UX-001.3 v1 stores the row text in `draft.body` after
 * serialization at submit time, so the in-component draft only
 * needs to be the row list.
 */
export interface OfferConcessionRow {
  /** Unique key for the row (stable across re-renders). */
  id: string;
  /** The concession item text. */
  itemText: string;
  /** Optional clarification (the "why" of the concession). */
  clarification: string;
}

/** Frozen empty row factory — UNIQUE id per call (test-stable + render-stable). */
let _rowIdCounter = 0;
export function createEmptyOfferConcessionRow(): OfferConcessionRow {
  _rowIdCounter += 1;
  return {
    id: `offer-concession-row-${_rowIdCounter}`,
    itemText: '',
    clarification: '',
  };
}

/**
 * Returns true iff at least one row has non-whitespace item text.
 * The Post gate uses this; the schema renders an empty hint when
 * false.
 */
export function isOfferConcessionPostable(
  rows: ReadonlyArray<OfferConcessionRow>,
): boolean {
  for (const r of rows) {
    if (r.itemText.trim().length > 0) return true;
  }
  return false;
}

/**
 * Serialize the row list into the plain-text form that v1 stores in
 * the existing `body` field. Empty rows are stripped. Each row reads:
 *   - `<item>` when no clarification is provided.
 *   - `<item>: <clarification>` when a clarification is provided.
 * Joined by `\n`. Returns an empty string when no row has content.
 *
 * Pure helper — exported for tests + the submit-time serializer.
 */
export function serializeOfferConcessionRows(
  rows: ReadonlyArray<OfferConcessionRow>,
): string {
  const parts: string[] = [];
  for (const r of rows) {
    const item = r.itemText.trim();
    if (item.length === 0) continue;
    const clarification = r.clarification.trim();
    if (clarification.length > 0) {
      parts.push(`${item}: ${clarification}`);
    } else {
      parts.push(item);
    }
  }
  return parts.join('\n');
}

// ── Props ─────────────────────────────────────────────────────

export interface OfferConcessionSchemaProps {
  /** The current row list. The composer owns it. */
  rows: ReadonlyArray<OfferConcessionRow>;
  /** Update the row list. */
  onChange: (rows: ReadonlyArray<OfferConcessionRow>) => void;
  /** True while the host's submit-argument call is in flight. */
  isSubmitting?: boolean;
  /** Optional test id prefix. */
  testIDPrefix?: string;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

// ── Component ─────────────────────────────────────────────────

export function OfferConcessionSchema({
  rows,
  onChange,
  isSubmitting = false,
  testIDPrefix = 'offer-concession-schema',
}: OfferConcessionSchemaProps) {
  const handleSetItem = useCallback(
    (id: string, text: string) => {
      onChange(
        rows.map((r) =>
          r.id === id ? { ...r, itemText: text.slice(0, OFFER_CONCESSION_ITEM_MAX) } : r,
        ),
      );
    },
    [rows, onChange],
  );

  const handleSetClarification = useCallback(
    (id: string, text: string) => {
      onChange(
        rows.map((r) =>
          r.id === id
            ? { ...r, clarification: text.slice(0, OFFER_CONCESSION_CLARIFICATION_MAX) }
            : r,
        ),
      );
    },
    [rows, onChange],
  );

  const handleAddRow = useCallback(() => {
    onChange([...rows, createEmptyOfferConcessionRow()]);
  }, [rows, onChange]);

  const handleRemoveRow = useCallback(
    (id: string) => {
      // Always keep at least one row visible.
      const next = rows.filter((r) => r.id !== id);
      onChange(next.length > 0 ? next : [createEmptyOfferConcessionRow()]);
    },
    [rows, onChange],
  );

  const isEmpty = useMemo(() => !isOfferConcessionPostable(rows), [rows]);
  const allowRemove = rows.length > 1;

  return (
    <View style={styles.box} testID={testIDPrefix}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro} testID={`${testIDPrefix}-intro`}>
          {OFFER_CONCESSION_SCHEMA_COPY.intro}
        </Text>

        {rows.map((row, idx) => (
          <View
            key={row.id}
            style={styles.row}
            testID={`${testIDPrefix}-row-${idx}`}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowOrdinal}>{idx + 1}</Text>
              {allowRemove ? (
                <Pressable
                  onPress={() => handleRemoveRow(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${OFFER_CONCESSION_SCHEMA_COPY.removeRowButton} (point ${idx + 1})`}
                  hitSlop={HIT_SLOP}
                  style={styles.removeButton}
                  testID={`${testIDPrefix}-row-${idx}-remove`}
                  disabled={isSubmitting}
                >
                  <Text style={styles.removeButtonLabel}>
                    {OFFER_CONCESSION_SCHEMA_COPY.removeRowButton}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>
              {OFFER_CONCESSION_SCHEMA_COPY.rowItemLabel}
            </Text>
            <TextInput
              value={row.itemText}
              onChangeText={(t) => handleSetItem(row.id, t)}
              placeholder={OFFER_CONCESSION_SCHEMA_COPY.rowItemPlaceholder}
              placeholderTextColor={SURFACE_TOKENS.placeholder}
              editable={!isSubmitting}
              accessibilityLabel={`Concession item ${idx + 1}`}
              maxLength={OFFER_CONCESSION_ITEM_MAX}
              style={styles.itemInput}
              testID={`${testIDPrefix}-row-${idx}-item-input`}
            />

            <Text style={styles.fieldLabel}>
              {OFFER_CONCESSION_SCHEMA_COPY.rowClarificationLabel}
            </Text>
            <TextInput
              value={row.clarification}
              onChangeText={(t) => handleSetClarification(row.id, t)}
              placeholder={OFFER_CONCESSION_SCHEMA_COPY.rowClarificationPlaceholder}
              placeholderTextColor={SURFACE_TOKENS.placeholder}
              editable={!isSubmitting}
              multiline
              accessibilityLabel={`Concession clarification ${idx + 1}`}
              maxLength={OFFER_CONCESSION_CLARIFICATION_MAX}
              style={styles.clarificationInput}
              testID={`${testIDPrefix}-row-${idx}-clarification-input`}
            />
          </View>
        ))}

        <Pressable
          onPress={handleAddRow}
          accessibilityRole="button"
          accessibilityLabel={OFFER_CONCESSION_SCHEMA_COPY.addRowButton}
          hitSlop={HIT_SLOP}
          style={styles.addButton}
          testID={`${testIDPrefix}-add-row`}
          disabled={isSubmitting}
        >
          <Text style={styles.addButtonLabel}>
            + {OFFER_CONCESSION_SCHEMA_COPY.addRowButton}
          </Text>
        </Pressable>

        {isEmpty ? (
          <Text
            style={styles.emptyHint}
            accessibilityLiveRegion="polite"
            testID={`${testIDPrefix}-empty-hint`}
          >
            {OFFER_CONCESSION_SCHEMA_COPY.emptyHint}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.l,
    gap: SPACING.m,
  },
  intro: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    marginBottom: SPACING.xs,
  },
  row: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowOrdinal: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
    minWidth: 24,
  },
  removeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.s,
  },
  removeButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: CONTROL.danger.fg,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  itemInput: {
    minHeight: 44,
    backgroundColor: SURFACE_TOKENS.base,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    padding: SPACING.s,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
  },
  clarificationInput: {
    minHeight: 72,
    backgroundColor: SURFACE_TOKENS.base,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    padding: SPACING.s,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  addButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
    paddingHorizontal: SPACING.m,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  emptyHint: {
    fontSize: 12,
    color: CONTROL.danger.fg,
    fontStyle: 'italic',
    marginTop: SPACING.s,
  },
});
