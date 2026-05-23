/**
 * QOL-041 — ConcessionListSection.
 *
 * The forced-list concession section rendered INSIDE the QOL-030
 * `respond` box (QOL-030 W4 / QOL-041 design §7.1). Each conceded point
 * is its own field with an ordinal badge, a remove `✕`, and an
 * `[+ Add a point]` affordance. There is NO single free-text body for
 * this section — itemization is structural (decision D6).
 *
 * Doctrine (QOL-041 §7.1, §11):
 *
 *   1. **Conceding is OPTIONAL** (§9). The section is collapsible —
 *      starts collapsed with a "Concede points (optional)" header. A
 *      pure refutation posts with zero items.
 *   2. **A concession is a REPAIR, not a defeat.** No copy here implies
 *      loss. The header copy is "Concede points" — the act of
 *      narrowing, not a defeat.
 *   3. **Item validation surfaces a SINGLE visible reason** (no silent
 *      rejection). The plain-language `firstReason` from
 *      `validateConcessionListDraft` is rendered inline.
 *   4. **No AI parsing.** Itemization is structural — the user types
 *      one point per field; the section never splits a paragraph.
 *   5. **44px targets.** Add / remove buttons clear 44dp.
 *
 * Pure presentation. The parent owns the `ConcessionListDraft`.
 */
import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  addConcessionItem,
  removeConcessionItem,
  updateConcessionItemText,
  validateConcessionListDraft,
  MAX_CONCESSION_ITEMS,
  MAX_CONCESSION_ITEM_LENGTH,
  type ConcessionListDraft,
} from '../../../concessions/concessionListModel';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../../lib/designTokens';

// ── Plain-language copy ───────────────────────────────────────

/**
 * The user-facing copy this component authors. Kept here so the
 * `__tests__/qol041-doctrine.test.ts` ban-list scan can read it via
 * the source-scan pattern (mirrors `BOX_TYPE_LABEL` in OneBox.tsx).
 *
 * Doctrine: no verdict tokens, no internal codes. Scanned by tests.
 */
export const CONCESSION_LIST_SECTION_COPY = Object.freeze({
  header: 'Concede points (optional)',
  headerHelper: 'Each point is its own item.',
  addButtonLabel: '+ Add a point',
  addDisabledHint: `You can include up to ${MAX_CONCESSION_ITEMS} conceded points in one response.`,
  removeButtonA11yLabel: 'Remove this point',
  itemPlaceholder: 'One specific point you accept.',
  collapseButtonA11yLabel: 'Hide the conceded-points section',
  expandButtonA11yLabel: 'Show the conceded-points section',
});

// ── Props ─────────────────────────────────────────────────────

export interface ConcessionListSectionProps {
  /** The current draft. Owned by the parent. */
  draft: ConcessionListDraft;
  /** Updates the parent's draft. */
  onChange: (draft: ConcessionListDraft) => void;
  /** Disabled in read-only / submitting states. */
  disabled?: boolean;
  /** Test id prefix to disambiguate multiple sections on one screen. */
  testIDPrefix?: string;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

// ── Component ─────────────────────────────────────────────────

let clientIdCounter = 0;

/**
 * Mint a stable per-component client id for a fresh item. Module-local
 * counter avoids importing a uuid library; the id is UI-only (the
 * Edge Function mints the real UUID).
 */
function mintClientId(): string {
  clientIdCounter += 1;
  return `concession-item-${clientIdCounter}`;
}

export function ConcessionListSection({
  draft,
  onChange,
  disabled = false,
  testIDPrefix = 'concession-list-section',
}: ConcessionListSectionProps): ReactElement {
  // Default-collapsed when the draft is empty (the optional section
  // starts hidden — a pure refutation never opens it). Once items
  // exist, the section is expanded.
  const [expanded, setExpanded] = useState<boolean>(draft.items.length > 0);

  const validation = useMemo(() => validateConcessionListDraft(draft), [draft]);

  const handleToggle = useCallback(() => {
    setExpanded((e) => !e);
  }, []);

  const handleAdd = useCallback(() => {
    if (disabled) return;
    if (draft.items.length >= MAX_CONCESSION_ITEMS) return;
    const next = addConcessionItem(draft, mintClientId());
    onChange(next);
    setExpanded(true);
  }, [disabled, draft, onChange]);

  const handleRemove = useCallback(
    (clientId: string) => {
      if (disabled) return;
      onChange(removeConcessionItem(draft, clientId));
    },
    [disabled, draft, onChange],
  );

  const handleChangeText = useCallback(
    (clientId: string, text: string) => {
      if (disabled) return;
      onChange(updateConcessionItemText(draft, clientId, text));
    },
    [disabled, draft, onChange],
  );

  const isOverCap = draft.items.length >= MAX_CONCESSION_ITEMS;

  return (
    <View style={styles.section} testID={testIDPrefix}>
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? CONCESSION_LIST_SECTION_COPY.collapseButtonA11yLabel
            : CONCESSION_LIST_SECTION_COPY.expandButtonA11yLabel
        }
        accessibilityState={{ expanded }}
        hitSlop={HIT_SLOP}
        style={styles.header}
        testID={`${testIDPrefix}-header`}
      >
        <Text
          style={styles.headerCaret}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {expanded ? '▾ ' : '▸ '}
        </Text>
        <Text style={styles.headerLabel}>
          {CONCESSION_LIST_SECTION_COPY.header}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.body} testID={`${testIDPrefix}-body`}>
          <Text style={styles.helper}>{CONCESSION_LIST_SECTION_COPY.headerHelper}</Text>

          {draft.items.map((item, idx) => (
            <View key={item.clientId} style={styles.itemRow} testID={`${testIDPrefix}-item-${idx}`}>
              <Text
                style={styles.ordinalBadge}
                accessibilityLabel={`Point ${idx + 1}`}
              >
                {idx + 1}
              </Text>
              <TextInput
                value={item.text}
                onChangeText={(t) => handleChangeText(item.clientId, t)}
                placeholder={CONCESSION_LIST_SECTION_COPY.itemPlaceholder}
                placeholderTextColor={SURFACE_TOKENS.placeholder}
                editable={!disabled}
                multiline
                maxLength={MAX_CONCESSION_ITEM_LENGTH}
                accessibilityLabel={`Conceded point ${idx + 1}`}
                style={styles.itemInput}
                testID={`${testIDPrefix}-item-${idx}-input`}
              />
              <Pressable
                onPress={() => handleRemove(item.clientId)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={CONCESSION_LIST_SECTION_COPY.removeButtonA11yLabel}
                hitSlop={HIT_SLOP}
                style={styles.removeButton}
                testID={`${testIDPrefix}-item-${idx}-remove`}
              >
                <Text style={styles.removeButtonLabel}>✕</Text>
              </Pressable>
            </View>
          ))}

          {validation.firstReason && (
            <Text
              style={styles.validationReason}
              accessibilityLiveRegion="polite"
              testID={`${testIDPrefix}-validation`}
            >
              {validation.firstReason}
            </Text>
          )}

          <Pressable
            onPress={handleAdd}
            disabled={disabled || isOverCap}
            accessibilityRole="button"
            accessibilityLabel={CONCESSION_LIST_SECTION_COPY.addButtonLabel}
            accessibilityState={{ disabled: disabled || isOverCap }}
            accessibilityHint={
              isOverCap ? CONCESSION_LIST_SECTION_COPY.addDisabledHint : undefined
            }
            hitSlop={HIT_SLOP}
            style={[
              styles.addButton,
              (disabled || isOverCap) && styles.addButtonDisabled,
            ]}
            testID={`${testIDPrefix}-add`}
          >
            <Text style={styles.addButtonLabel}>
              {CONCESSION_LIST_SECTION_COPY.addButtonLabel}
            </Text>
          </Pressable>
          {isOverCap && (
            <Text style={styles.addDisabledHint}>
              {CONCESSION_LIST_SECTION_COPY.addDisabledHint}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.s,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  headerCaret: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  body: {
    paddingTop: SPACING.xs,
    gap: SPACING.s,
  },
  helper: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.s,
  },
  ordinalBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    minWidth: 22,
    paddingTop: SPACING.s,
    textAlign: 'right',
  },
  itemInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.inputBg,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
  },
  removeButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: SPACING.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  addButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  addDisabledHint: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
  },
  validationReason: {
    fontSize: 12,
    color: '#fca5a5', // STATUS.danger fg — visible but not a flood
  },
});
