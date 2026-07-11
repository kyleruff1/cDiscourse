/**
 * ROOM-003 (#829) — ArgumentEntryComposer: the one-bar reply composer.
 *
 * A thin bottom bar that WRAPS the shipped draft model. It reuses
 * useArgumentComposer (the same session activeDraft the More popout edits),
 * the shipped evaluate pipeline as the sole gate, and useEntryComposerSubmit
 * (which posts the SAME buildSubmitArgumentPayload the dock uses), so the
 * wire payload is byte-shape-identical to today composer by construction.
 *
 * Fast path: Send posts directly (NO pre-send review sheet). More opens the
 * shipped dock unchanged, where the pre-send review still lives. Type + side
 * default from the transition matrix + seat and are adjustable via More,
 * never required.
 *
 * Comments here are apostrophe-free (doctrine-scanner quote-parity gotcha).
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useArgumentComposer } from '../useArgumentComposer';
import { useConstitution } from '../useConstitution';
import { useAppSession } from '../../session/useAppSession';
import { SUPABASE_CONFIGURED } from '../../../lib/supabase';
import { buildEvaluationInput } from '../composerValidation';
import { evaluateArgumentDraft } from '../../../domain/constitution';
import { toPlainLanguage } from '../gameCopy';
import {
  ARGUMENT_ENTRY_COMPOSER_COPY as COPY,
  deriveEntryComposerBarLayout,
  deriveEntryComposerBlockingFlag,
  deriveEntryComposerDefaults,
  deriveEntryComposerTarget,
  deriveFastPathCivilitySignal,
} from './argumentEntryComposerModel';
import { useEntryComposerSubmit } from './useEntryComposerSubmit';
// MARK-002 (#894) — the composer_scope placement of the ONE TimestampMarker
// component + the pending-scope type. Rendered only when a marker is scoped;
// absent => the bar is byte-identical to the pre-MARK-002 render.
import { TimestampMarker } from '../markers/TimestampMarker';
import type { PendingMarkerScope, TimestampMarkerViewModel } from '../markers/timestampMarkerModel';
// UX-COMPOSER-005 (#831) — the inline draft echo + the Callback-slot copy. The
// echo renders only when a callback is woven; absent => the bar is byte-identical
// to the pre-#831 render.
import { CallbackDraftEcho } from '../crossRoom/CallbackDraftEcho';
import { CALLBACK_COMPOSER_COPY } from '../crossRoom/callbackComposerCopy';
import type { CrossRoomCallback } from '../crossRoom/crossRoomCallbackRef';
import type { ArgumentRow } from '../types';
import type { Debate, ParticipantSide } from '../../debates/types';
import { RADIUS, SPACING, SURFACE_TOKENS, CONTROL, TOUCH_TARGET, BRAND } from '../../../lib/designTokens';

export interface ArgumentEntryComposerProps {
  debate: Debate;
  /** Reply target parent id (null = root-claim context). */
  selectedParentId: string | null;
  /** Reply target parent row (null = root-claim context). */
  parentArgument: ArgumentRow | null;
  /** Read-only Timeline active id (reserved; the target comes from replyTarget). */
  activeMessageId?: string | null;
  /** The viewer established seat; drives side defaulting + read-only observer state. */
  participantSide?: ParticipantSide | null;
  /** Effective reduce-motion (OS composed with preference). */
  reduceMotionOverride?: boolean;
  /** Open the full OneBox (the shipped dock). */
  onOpenMore: () => void;
  /**
   * PROOF-002 — open the source drawer. When present the Source slot opens the
   * drawer instead of More; when absent the Source slot routes to More
   * (byte-identical to the pre-PROOF-002 bar). App threads this (the flag lives
   * there); the composer never reads the flag registry itself.
   */
  onOpenProof?: () => void;
  /**
   * PROOF-002 — true when a source is owed on the scoped own move (J7). Renders
   * the gold owed treatment on the Source slot. Additive optional; absent =>
   * the plain Source slot (byte-identical).
   */
  proofOwed?: boolean;
  /**
   * Post succeeded — refreshes the room. MARK-002 (#894): widened to receive the
   * new reply id so the room shell can link a scoped marker to it. Existing
   * callers that ignore the argument are unaffected.
   */
  onSubmitSuccess: (newArgumentId?: string) => void;
  /** Clear the reply target (context chip clear). Optional. */
  onClearParent?: () => void;
  /**
   * MARK-002 (#894) — the active scoped marker (a picked phrase of the target).
   * When present the bar renders the composer_scope chip; the reply mints a
   * marker linked to it on submit. Absent / null => the bar is byte-identical to
   * the pre-MARK-002 render (the flag-off + no-pick path).
   */
  scopedMarker?: PendingMarkerScope | null;
  /** MARK-002 — clear the scoped marker (the composer_scope chip clear). */
  onClearScopedMarker?: () => void;
  /**
   * UX-COMPOSER-005 (#831) — quote_forge only. Opens the room-picker -> capture
   * flow. Absent => no Callback slot and no draft echo (byte-identical bar). The
   * composer never reads the flag registry; App threads this handler.
   */
  onInsertCallback?: () => void;
  /**
   * UX-COMPOSER-005 (#831) — fires AFTER a successful post that carried a woven
   * callback, so the shell can create the QOL-042 room link (ruling R6).
   * Additive-optional; absent => no-op.
   */
  onCallbackPosted?: (callback: CrossRoomCallback, newArgumentId?: string) => void;
  /** Q10 advisory-only instrumentation sink. Default no-op. */
  onFastPathCivilitySignal?: (s: { hadCivilityAdvisory: boolean; flagCodes: ReadonlyArray<string> }) => void;
}

/** Seats that may post. Observer / no-seat renders the read-only join prompt. */
function seatCanPost(side: ParticipantSide | null | undefined): boolean {
  return side === 'affirmative' || side === 'negative' || side === 'moderator';
}

export function ArgumentEntryComposer({
  debate,
  selectedParentId,
  parentArgument,
  participantSide,
  reduceMotionOverride,
  onOpenMore,
  onOpenProof,
  proofOwed,
  onSubmitSuccess,
  onClearParent,
  scopedMarker,
  onClearScopedMarker,
  onInsertCallback,
  onCallbackPosted,
  onFastPathCivilitySignal,
}: ArgumentEntryComposerProps) {
  const { draft, updateField } = useArgumentComposer(debate.id, selectedParentId);
  const constitution = useConstitution();
  const { state } = useAppSession();
  const userId = state.snapshot.userId;
  const { submit, isSubmitting, serverErrors } = useEntryComposerSubmit(
    onSubmitSuccess,
    onCallbackPosted,
  );

  // #831 — the woven callback attached to the active draft (if any). Read from
  // the shared draft so the echo always mirrors the submit-path source. The
  // Callback slot + echo render only when onInsertCallback is threaded (flag on).
  const pendingCallback = draft?.pendingCallback ?? null;
  const callbackEnabled = !!onInsertCallback;

  const reduceMotion = reduceMotionOverride === true;
  const canPost = seatCanPost(participantSide);

  // ── Type + side defaulting (from the transition matrix + seat) ──
  const replyingToOwnMove = !!parentArgument && parentArgument.authorId === userId;
  const defaults = useMemo(
    () =>
      deriveEntryComposerDefaults({
        parentType: parentArgument?.argumentType ?? null,
        participantSide: participantSide ?? null,
        replyingToOwnMove,
        rules: constitution.activeRules,
      }),
    [parentArgument, participantSide, replyingToOwnMove, constitution.activeRules],
  );

  // Apply defaults ONLY to still-null fields (never overriding a More choice).
  useEffect(() => {
    if (!draft) return;
    const patch: { argumentType?: typeof defaults.argumentType; side?: typeof defaults.side } = {};
    if (draft.argumentType == null) patch.argumentType = defaults.argumentType;
    if (draft.side == null) patch.side = defaults.side;
    if (patch.argumentType !== undefined || patch.side !== undefined) {
      updateField(patch);
    }
  }, [draft, defaults, updateField]);

  // Keep the draft parentId in sync when the reply target changes.
  const prevParentRef = useRef(selectedParentId);
  useEffect(() => {
    if (prevParentRef.current !== selectedParentId) {
      prevParentRef.current = selectedParentId;
      updateField({ parentId: selectedParentId });
    }
  }, [selectedParentId, updateField]);

  // ── Engine gate (the sole gate) ────────────────────────────────
  const evaluation = useMemo(() => {
    if (!draft) return null;
    const input = buildEvaluationInput(draft, debate, parentArgument, {
      activeConstitution: constitution.activeConstitution,
      activeRules: constitution.activeRules,
      tagDefinitions: constitution.tagDefinitions,
      flagDefinitions: constitution.flagDefinitions,
    });
    if (!input) return null;
    return evaluateArgumentDraft(input);
  }, [draft, debate, parentArgument, constitution]);

  const bodyLength = draft?.body.trim().length ?? 0;
  const layout = deriveEntryComposerBarLayout({
    bodyLength,
    evaluation,
    hasParent: !!parentArgument,
  });
  const effectiveCanSend = !!draft && SUPABASE_CONFIGURED && layout.canSend;

  const target = deriveEntryComposerTarget({
    parentId: selectedParentId,
    parentType: parentArgument?.argumentType ?? null,
    parentBody: parentArgument?.body ?? null,
    scopedMarker: scopedMarker ?? null,
  });

  // MARK-002 — the composer_scope chip view-model, built from the pending scope.
  // No row exists yet (the marker mints post-submit); this is client-only state.
  const scopedMarkerViewModel: TimestampMarkerViewModel | null = scopedMarker
    ? {
        id: 'pending-scope',
        targetArgumentId: scopedMarker.targetArgumentId,
        replyArgumentId: null,
        kind: 'rebuttal_anchor',
        spanStart: scopedMarker.spanStart,
        spanEnd: scopedMarker.spanEnd,
        quotedText: scopedMarker.quote,
        state: 'live',
      }
    : null;

  const blockingFlag = deriveEntryComposerBlockingFlag(evaluation);
  const blockedReason = blockingFlag
    ? toPlainLanguage(blockingFlag.flagCode) ?? blockingFlag.message
    : null;
  const showBlocked = !!draft && bodyLength > 0 && !!blockedReason;

  const handleSend = useCallback(() => {
    if (!draft || !effectiveCanSend) return;
    // Q10 advisory-only: count whether this fast-path post carried a civility
    // advisory the pre-send review would have surfaced. Never blocks.
    onFastPathCivilitySignal?.(deriveFastPathCivilitySignal(evaluation));
    void submit(draft);
  }, [draft, effectiveCanSend, evaluation, onFastPathCivilitySignal, submit]);

  const containerBehavior = Platform.select<'padding' | undefined>({ ios: 'padding', default: undefined });

  return (
    <KeyboardAvoidingView behavior={containerBehavior} style={styles.keyboardWrap}>
      <View style={styles.bar} testID="argument-entry-composer">
        {!canPost ? (
          <View style={styles.observerRow} testID="argument-entry-composer-observer">
            <Text style={styles.observerPrompt}>{COPY.observerPrompt}</Text>
            <Text style={styles.observerHint} accessibilityLabel={COPY.observerA11yHint}>
              {COPY.observerA11yHint}
            </Text>
          </View>
        ) : (
          <>
            {/* MARK-002 — composer_scope chip: the picked phrase this reply
                quotes. Renders only when a marker is scoped; absent => this whole
                block is skipped and the bar is byte-identical. */}
            {scopedMarkerViewModel ? (
              <View style={styles.scopeRow} testID="argument-entry-composer-marker-scope">
                {target.scopedQuoteLabel ? (
                  <Text style={styles.scopeLabel} numberOfLines={1}>
                    {target.scopedQuoteLabel}
                  </Text>
                ) : null}
                <TimestampMarker
                  placement="composer_scope"
                  marker={scopedMarkerViewModel}
                  onClear={onClearScopedMarker}
                  reduceMotion={reduceMotion}
                />
              </View>
            ) : null}

            {/* Context chip — names the target; never lost. */}
            <View style={styles.chipRow}>
              <Text
                style={styles.chipText}
                numberOfLines={1}
                testID="argument-entry-composer-chip"
              >
                {target.chipLabel}
              </Text>
              {target.clearable ? (
                <Pressable
                  onPress={onClearParent}
                  accessibilityRole="button"
                  accessibilityLabel={COPY.chipClearA11yLabel}
                  hitSlop={TOUCH_TARGET.hitSlopAll}
                  style={styles.chipClear}
                  testID="argument-entry-composer-chip-clear"
                >
                  <Text style={styles.chipClearGlyph}>{'✕'}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* #831 — the inline woven-callback draft echo. Renders only when a
                callback is attached AND the Callback affordance is threaded
                (quote_forge on); absent => this whole block is skipped and the
                bar is byte-identical. */}
            {callbackEnabled && pendingCallback ? (
              <CallbackDraftEcho
                callback={pendingCallback}
                onRemove={() => updateField({ pendingCallback: null })}
              />
            ) : null}

            {/* Text field — the primary action. */}
            <TextInput
              value={draft?.body ?? ''}
              onChangeText={(body) => updateField({ body })}
              placeholder={COPY.inputPlaceholder}
              placeholderTextColor={SURFACE_TOKENS.placeholder}
              accessibilityLabel={COPY.inputA11yLabel}
              multiline
              editable={!!draft && !isSubmitting}
              style={styles.input}
              autoCapitalize="sentences"
              testID="argument-entry-composer-input"
            />

            {/* Controls: Source (drawer when wired, else More) - Voice (disabled) - More - Send. */}
            <View style={styles.controlsRow}>
              <Pressable
                onPress={onOpenProof ?? onOpenMore}
                accessibilityRole="button"
                accessibilityLabel={proofOwed ? COPY.proofOwedA11yLabel : COPY.proofA11yLabel}
                accessibilityHint={onOpenProof ? COPY.proofDrawerA11yHint : COPY.proofA11yHint}
                hitSlop={TOUCH_TARGET.hitSlopAll}
                style={[styles.slotButton, proofOwed && styles.slotButtonOwed]}
                testID="argument-entry-composer-proof"
              >
                {proofOwed ? (
                  <Text style={styles.slotOwedMarker} testID="argument-entry-composer-proof-owed">
                    {'◆ '}
                    {COPY.proofOwedLabel}
                  </Text>
                ) : (
                  <Text style={styles.slotLabel}>{COPY.proofLabel}</Text>
                )}
              </Pressable>

              {/* #831 — Callback slot. Present only when quote_forge is on
                  (onInsertCallback threaded); opens the room picker -> capture
                  flow. Absent => the controls row is byte-identical. */}
              {callbackEnabled ? (
                <Pressable
                  onPress={onInsertCallback}
                  accessibilityRole="button"
                  accessibilityLabel={CALLBACK_COMPOSER_COPY.insertAffordanceA11y}
                  hitSlop={TOUCH_TARGET.hitSlopAll}
                  style={[styles.slotButton, pendingCallback != null && styles.slotButtonActive]}
                  testID="argument-entry-composer-callback"
                >
                  <Text style={styles.slotLabel}>
                    {'⤴ '}
                    {CALLBACK_COMPOSER_COPY.insertAffordanceLabel}
                  </Text>
                </Pressable>
              ) : null}

              {/* Reserved voice slot — disabled until VOICE-UI-001. No audio code. */}
              <Pressable
                disabled
                accessibilityRole="button"
                accessibilityLabel={COPY.micA11yLabel}
                accessibilityState={{ disabled: true }}
                style={[styles.micSlot, styles.micDisabled]}
                testID="argument-entry-composer-mic"
              >
                <Text style={styles.micLabel}>{COPY.micLabel}</Text>
              </Pressable>

              <Pressable
                onPress={onOpenMore}
                accessibilityRole="button"
                accessibilityLabel={COPY.moreA11yLabel}
                accessibilityHint={COPY.moreA11yHint}
                hitSlop={TOUCH_TARGET.hitSlopAll}
                style={styles.slotButton}
                testID="argument-entry-composer-more"
              >
                <Text style={styles.slotLabel}>{COPY.moreLabel}</Text>
              </Pressable>

              <Pressable
                onPress={handleSend}
                disabled={!effectiveCanSend}
                accessibilityRole="button"
                accessibilityLabel={COPY.sendA11yLabel}
                accessibilityState={{ disabled: !effectiveCanSend, busy: isSubmitting }}
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && !reduceMotion && styles.sendButtonPressed,
                  !effectiveCanSend && styles.sendButtonDisabled,
                ]}
                testID="argument-entry-composer-send"
              >
                <Text style={styles.sendLabel}>{isSubmitting ? COPY.sendingLabel : COPY.sendLabel}</Text>
              </Pressable>
            </View>

            {/* Blocked state (hard rule only) — plain-language, engine-sourced. */}
            {showBlocked ? (
              <View
                style={styles.blockedRow}
                accessibilityLiveRegion="polite"
                testID="argument-entry-composer-blocked"
              >
                <Text style={styles.blockedText}>
                  {COPY.blockedReasonPrefix}
                  {blockedReason}
                </Text>
              </View>
            ) : null}

            {/* Server-side rejection (422) — same inline surface. */}
            {serverErrors && serverErrors.length > 0 ? (
              <View
                style={styles.blockedRow}
                accessibilityLiveRegion="polite"
                testID="argument-entry-composer-server-error"
              >
                {serverErrors.map((msg, i) => (
                  <Text key={i} style={styles.blockedText}>
                    {msg}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    width: '100%',
  },
  bar: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    gap: SPACING.s,
  },
  observerRow: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  observerPrompt: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  observerHint: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  // MARK-002 — the composer_scope row (context label + the TimestampMarker chip).
  scopeRow: {
    gap: SPACING.xs,
  },
  scopeLabel: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipText: {
    flex: 1,
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
  },
  chipClear: {
    minWidth: TOUCH_TARGET.minSizePx,
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipClearGlyph: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 15,
  },
  input: {
    minHeight: TOUCH_TARGET.minSizePx,
    maxHeight: 120,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 15,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  slotButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    paddingHorizontal: SPACING.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
  },
  slotLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  // PROOF-002 owed treatment: the ROOM-001 private_gold triple (goldSoft bg /
  // goldBorder hairline / gold text). Static ring (reduce-motion-safe by
  // construction — the bar has no animation) and paired with a glyph + text so
  // it reads in monochrome.
  slotButtonOwed: {
    backgroundColor: BRAND.accent.goldSoft,
    borderColor: BRAND.accent.goldBorder,
  },
  // #831 — the Callback slot carries a woven callback: a hairline accent so the
  // active state reads without relying on color alone (the glyph + label carry
  // the identity).
  slotButtonActive: {
    borderColor: SURFACE_TOKENS.textSecondary,
  },
  slotOwedMarker: {
    color: BRAND.accent.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  micSlot: {
    minHeight: 56,
    paddingHorizontal: SPACING.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: SURFACE_TOKENS.border,
  },
  micDisabled: {
    opacity: 0.6,
  },
  micLabel: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: 12,
  },
  sendButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: 72,
    marginLeft: 'auto',
    paddingHorizontal: SPACING.l,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
  },
  sendButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  sendButtonDisabled: {
    backgroundColor: CONTROL.primary.disabledBg,
    opacity: 0.6,
  },
  sendLabel: {
    color: CONTROL.primary.fg,
    fontSize: 15,
    fontWeight: '700',
  },
  blockedRow: {
    paddingVertical: SPACING.xs,
  },
  blockedText: {
    color: CONTROL.danger.fg,
    fontSize: 13,
  },
});
