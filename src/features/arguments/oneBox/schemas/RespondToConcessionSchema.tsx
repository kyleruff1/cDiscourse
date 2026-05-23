/**
 * QOL-041 — RespondToConcessionSchema.
 *
 * The `respond_to_concession` box body: the forced list mirroring an
 * incoming concession set ROW-FOR-ROW (QOL-041 design §1, §7.2). Each
 * row carries an `AcceptanceGradientControl` + a conditional-required
 * clarification field; Post is disabled (with a visible reason) until
 * every row has a level AND every non-`agree` row has a clarification.
 *
 * Doctrine (QOL-041 §7.2, §11):
 *
 *   1. **Mirror every incoming item.** N items in → N rows rendered.
 *      Partial grading cannot be posted (the box requires a level on
 *      EVERY row).
 *   2. **A non-`agree` level REQUIRES a clarification.** The
 *      clarification field appears + Post is blocked (with reason)
 *      until ≥ 1 non-whitespace char. This block is the structural
 *      validation gate, not a score (cdiscourse-doctrine §1: "Score
 *      never blocks posting. Validation can block, score cannot.").
 *   3. **Never a silent disabled Post.** When the receiver tries to
 *      post too early, the visible reason explains what's missing.
 *   4. **No verdict copy.** Labels are STATED STANCES via
 *      `ACCEPTANCE_LEVEL_COPY`, never truth rulings.
 *   5. **Color independence + 44px + reduce-motion.** Inherited from
 *      `AcceptanceGradientControl`.
 *
 * Pure presentation. The parent owns the `RespondToConcessionDraft`
 * + the receiver's submission flow; the schema renders the form and
 * calls back on Post.
 */
import React, { useCallback, useMemo, type ReactElement } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  isPostable,
  setRowClarification,
  setRowLevel,
  buildConcessionAcceptancesPayload,
  MAX_CLARIFICATION_LENGTH,
  type RespondToConcessionDraft,
  type IncomingConcessionItem,
  type ConcessionAcceptancePayload,
} from '../../../concessions/respondToConcessionModel';
import {
  ACCEPTANCE_LEVEL_COPY,
  acceptanceRequiresClarification,
  type AcceptanceLevel,
} from '../../../concessions/acceptanceGradient';
import { AcceptanceGradientControl } from './AcceptanceGradientControl';
import { SURFACE_TOKENS, RADIUS, SPACING, CONTROL } from '../../../../lib/designTokens';

// ── Plain-language copy ───────────────────────────────────────

export const RESPOND_TO_CONCESSION_SCHEMA_COPY = Object.freeze({
  /** Sentence above the mirrored list, with the count substituted. */
  introTemplate: (count: number): string =>
    count === 1
      ? 'One conceded point. Respond to it:'
      : `${count} conceded points. Respond to each:`,
  pickLevelPrompt: 'Pick how you see this point.',
  clarificationAgreeNotice: 'Agree — no clarification needed.',
  clarificationFieldLabel: 'Explain',
  clarificationPlaceholder: 'Why do you see this point this way?',
  postButtonLabel: 'Post',
  postingButtonLabel: 'Posting…',
});

// ── Props ─────────────────────────────────────────────────────

export interface RespondToConcessionSchemaProps {
  /** The incoming concession items being graded — drives the row order
   *  via `buildRespondToConcessionDraft` upstream. */
  incomingItems: ReadonlyArray<IncomingConcessionItem>;
  /** The current draft (mirrored-list state). Owned by the parent. */
  draft: RespondToConcessionDraft;
  /** Updates the parent's draft. */
  onChange: (draft: RespondToConcessionDraft) => void;
  /** Called on a valid Post. The parent attaches the payload to the
   *  submit-argument call. */
  onPost: (acceptances: ReadonlyArray<ConcessionAcceptancePayload>) => void;
  /** True while the host's submit-argument call is in flight. */
  isSubmitting?: boolean;
  /** Test id prefix to disambiguate multiple instances. */
  testIDPrefix?: string;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

// ── Component ─────────────────────────────────────────────────

export function RespondToConcessionSchema({
  incomingItems,
  draft,
  onChange,
  onPost,
  isSubmitting = false,
  testIDPrefix = 'respond-to-concession-schema',
}: RespondToConcessionSchemaProps): ReactElement {
  const postability = useMemo(() => isPostable(draft), [draft]);
  const postDisabled = isSubmitting || !postability.postable;
  const disabledReason = postability.firstDisabledReason;

  const handleSetLevel = useCallback(
    (concessionItemId: string, level: AcceptanceLevel) => {
      onChange(setRowLevel(draft, concessionItemId, level));
    },
    [draft, onChange],
  );

  const handleSetClarification = useCallback(
    (concessionItemId: string, text: string) => {
      onChange(setRowClarification(draft, concessionItemId, text));
    },
    [draft, onChange],
  );

  const handlePost = useCallback(() => {
    if (postDisabled) return;
    try {
      const payload = buildConcessionAcceptancesPayload(draft);
      onPost(payload);
    } catch {
      // The postability check above prevents this path; if it does
      // somehow fire, ignore — the visible disabled reason will appear
      // on the next render.
    }
  }, [postDisabled, draft, onPost]);

  // Build an itemText lookup so the renderer can show the row's
  // incoming excerpt as a read-only label above its gradient.
  const itemTextById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of incomingItems) m.set(it.id, it.itemText);
    return m;
  }, [incomingItems]);

  return (
    <View style={styles.box} testID={testIDPrefix}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro} testID={`${testIDPrefix}-intro`}>
          {RESPOND_TO_CONCESSION_SCHEMA_COPY.introTemplate(draft.rows.length)}
        </Text>

        {draft.rows.map((row, idx) => {
          const itemText = itemTextById.get(row.concessionItemId) ?? '';
          return (
            <RespondRow
              key={row.concessionItemId}
              ordinal={idx + 1}
              itemText={itemText}
              selectedLevel={row.level}
              clarificationText={row.clarification}
              disabled={isSubmitting}
              onSelectLevel={(lvl) => handleSetLevel(row.concessionItemId, lvl)}
              onChangeClarification={(t) =>
                handleSetClarification(row.concessionItemId, t)
              }
              testIDPrefix={`${testIDPrefix}-row-${idx}`}
            />
          );
        })}
      </ScrollView>

      <View style={styles.footer} testID={`${testIDPrefix}-footer`}>
        <Pressable
          onPress={handlePost}
          disabled={postDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            postDisabled && disabledReason
              ? `${RESPOND_TO_CONCESSION_SCHEMA_COPY.postButtonLabel}. Disabled. ${disabledReason}`
              : RESPOND_TO_CONCESSION_SCHEMA_COPY.postButtonLabel
          }
          accessibilityState={{ disabled: postDisabled }}
          hitSlop={HIT_SLOP}
          style={[
            styles.postButton,
            postDisabled && styles.postButtonDisabled,
          ]}
          testID={`${testIDPrefix}-post`}
        >
          <Text style={styles.postButtonLabel}>
            {isSubmitting
              ? RESPOND_TO_CONCESSION_SCHEMA_COPY.postingButtonLabel
              : RESPOND_TO_CONCESSION_SCHEMA_COPY.postButtonLabel}
          </Text>
        </Pressable>
        {postDisabled && disabledReason && (
          <Text
            style={styles.disabledReason}
            accessibilityLiveRegion="polite"
            testID={`${testIDPrefix}-disabled-reason`}
          >
            {disabledReason}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── One row ───────────────────────────────────────────────────

interface RespondRowProps {
  ordinal: number;
  itemText: string;
  selectedLevel: AcceptanceLevel | null;
  clarificationText: string;
  disabled: boolean;
  onSelectLevel: (level: AcceptanceLevel) => void;
  onChangeClarification: (text: string) => void;
  testIDPrefix: string;
}

function RespondRow({
  ordinal,
  itemText,
  selectedLevel,
  clarificationText,
  disabled,
  onSelectLevel,
  onChangeClarification,
  testIDPrefix,
}: RespondRowProps): ReactElement {
  const needsClarification =
    selectedLevel !== null && acceptanceRequiresClarification(selectedLevel);
  const helperLine = selectedLevel
    ? ACCEPTANCE_LEVEL_COPY[selectedLevel].helper
    : RESPOND_TO_CONCESSION_SCHEMA_COPY.pickLevelPrompt;

  return (
    <View style={styles.row} testID={testIDPrefix}>
      <View style={styles.rowHeader}>
        <Text
          style={styles.rowOrdinal}
          accessibilityLabel={`Point ${ordinal}`}
        >
          {ordinal}
        </Text>
        <Text style={styles.rowExcerpt} numberOfLines={3}>
          {itemText}
        </Text>
      </View>

      <AcceptanceGradientControl
        selectedLevel={selectedLevel}
        onSelectLevel={onSelectLevel}
        disabled={disabled}
        testIDPrefix={`${testIDPrefix}-gradient`}
      />

      <Text
        style={styles.rowHelper}
        testID={`${testIDPrefix}-helper`}
      >
        {selectedLevel === 'agree'
          ? RESPOND_TO_CONCESSION_SCHEMA_COPY.clarificationAgreeNotice
          : helperLine}
      </Text>

      {needsClarification && (
        <View
          style={styles.clarificationWrapper}
          testID={`${testIDPrefix}-clarification`}
        >
          <Text style={styles.clarificationLabel}>
            {RESPOND_TO_CONCESSION_SCHEMA_COPY.clarificationFieldLabel}
          </Text>
          <TextInput
            value={clarificationText}
            onChangeText={onChangeClarification}
            placeholder={RESPOND_TO_CONCESSION_SCHEMA_COPY.clarificationPlaceholder}
            placeholderTextColor={SURFACE_TOKENS.placeholder}
            editable={!disabled}
            multiline
            maxLength={MAX_CLARIFICATION_LENGTH}
            accessibilityLabel={`Clarification for point ${ordinal}`}
            style={styles.clarificationInput}
            testID={`${testIDPrefix}-clarification-input`}
          />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  box: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.s,
    gap: SPACING.l,
  },
  intro: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  row: {
    gap: SPACING.s,
    paddingVertical: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.divider,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.s,
  },
  rowOrdinal: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    minWidth: 22,
    paddingTop: 2,
    textAlign: 'right',
  },
  rowExcerpt: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    color: SURFACE_TOKENS.textPrimary,
  },
  rowHelper: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
  },
  clarificationWrapper: {
    gap: SPACING.xs,
  },
  clarificationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  clarificationInput: {
    minHeight: 64,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.inputBg,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.divider,
  },
  postButton: {
    minHeight: 44,
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: CONTROL.primary.disabledBg,
    opacity: 0.75,
  },
  postButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: CONTROL.primary.fg,
  },
  disabledReason: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    textAlign: 'right',
  },
});
