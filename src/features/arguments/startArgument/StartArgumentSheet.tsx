/**
 * START-001 (#827) — StartArgumentSheet (person-first start surface).
 *
 * Inverts the start flow to who -> what -> advanced. Step one is the
 * PersonArgumentPicker (recents -> e-mail -> open-floor-last); step two is the
 * declaration ("Your point"); the collapsed Advanced section hosts the
 * START-003 public-visibility ceremony via a typed render slot.
 *
 * CREATION IS BYTE-IDENTICAL to StartArgumentPage.handleSubmit: the picker
 * produces one invite-email string; the sheet threads it through the SAME
 * `deriveArgumentRoomCreation({ visibility, directInviteEmails })` call and
 * builds `CreateDebateInput` from its outputs, then calls the SAME `onCreate`
 * path (useDebates().create -> create-argument-room). Zero forked validity /
 * capacity logic; `deriveArgumentRoomCreation` stays the single decision
 * function. The ARG-ROOM-008 one-time invite-link success box is reused verbatim
 * (same copy constants).
 *
 * VISIBILITY OWNERSHIP (START-003 A3 / A4): the sheet OWNS `visibility`
 * (default 'private'). It can only become 'public' via the toggle slot
 * `onChange('public')`, which START-003 emits ONLY on its second explicit
 * confirm. Selecting the open-floor row auto-expands Advanced but LEAVES
 * visibility at 'private' (public is OFF by default even there). Re-selecting a
 * picker target resets visibility to 'private', so a public create is
 * structurally unreachable in fewer than two deliberate taps.
 *
 * This component reads NO feature flag (App.tsx is the sole flag consumer) and
 * calls no AI / classifier path.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../../lib/designTokens';
import { pickDisplayTitle } from '../../debates/debateTitleHelpers';
import type { CreateDebateInput, CreatedRoom, Debate, RoomVisibility } from '../../debates/types';
import {
  deriveArgumentRoomCreation,
  plainLanguageForCreationReason,
} from '../../debates/argumentRoomCreationMatrix';
import { ARGUMENT_ROOM_CREATE_COPY, START_SHEET_COPY } from '../gameCopy';
import { INVITE_PANEL_COPY } from '../../invites/inviteCopy';
import { maskInviteeEmail } from '../../invites/inviteModel';
import { isStartArgumentDraftSubmittable, type StartArgumentSurface } from './startArgumentTaxonomy';
import { PersonArgumentPicker } from './PersonArgumentPicker';
import {
  personTargetToInviteEmail,
  type PersonTarget,
  type RecentOpponent,
  type CircleOption,
} from './personArgumentPickerModel';

/**
 * Props the sheet passes into the START-003 public-toggle slot. Merges
 * START-001's slot (visibility owner + capacity preview + expanded) with
 * START-003's `PublicArgumentToggleProps` (optional `disabled`). `onChange`
 * emits 'public' ONLY on the toggle confirm transition; 'private' reverts.
 */
export interface PublicToggleSlotProps {
  visibility: RoomVisibility;
  onChange: (visibility: RoomVisibility) => void;
  capacityPreview: { capacity: number; open: number; reservedInviteSeats?: 0 | 1 };
  expanded: boolean;
  disabled?: boolean;
}

export interface StartArgumentSheetProps {
  /** SAME existing creation path the page uses (useDebates().create). */
  onCreate: (input: CreateDebateInput) => Promise<CreatedRoom | null>;
  /** Landing hand-off after create (mirror onCreatedWithSurface). */
  onCreated?: (debate: Debate, surface: StartArgumentSurface) => void;
  onCancel: () => void;
  /** Recent-opponent data (from useRecentOpponents at the App.tsx mount). */
  recents: RecentOpponent[];
  /** Optional loading flag (accepted for the mount contract; recents are an
   *  accelerator, never a gate). */
  recentsLoading?: boolean;
  /** START-002 slot — [] in START-001. */
  circles?: CircleOption[];
  /** START-003 slot — the PublicArgumentToggle. Undefined => empty Advanced. */
  renderPublicToggle?: (props: PublicToggleSlotProps) => React.ReactNode;
}

export function StartArgumentSheet({
  onCreate,
  onCreated,
  onCancel,
  recents,
  circles = [],
  renderPublicToggle,
}: StartArgumentSheetProps) {
  const [declaration, setDeclaration] = useState('');
  const [target, setTarget] = useState<PersonTarget | null>(null);
  // START-003 A7 — default 'private'. Only the toggle slot onChange can set it
  // to 'public' (after the second explicit confirm). Owned here (A3).
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [surface] = useState<StartArgumentSurface>('timeline');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ARG-ROOM-008 — one-time create-time invite-link success state (reused
  // verbatim from StartArgumentPage). Raw link lives only in this in-memory
  // state; it is never logged and never written to storage.
  const [createdInvite, setCreatedInvite] = useState<{
    debate: Debate;
    surface: StartArgumentSurface;
    inviteLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const inviteEmail = personTargetToInviteEmail(target);
  const directInviteEmails = inviteEmail.trim().length > 0 ? [inviteEmail] : [];

  // START-002 (#839) — a circle audience forces the room private and carries NO
  // invite (the circle IS the audience). It never enters the START-003
  // previewing_public state: visibility stays 'private' and the public toggle is
  // disabled for a circle target.
  const isCircle = target?.kind === 'circle';
  const circleId = target?.kind === 'circle' ? target.circleId : null;
  const circleLabel = target?.kind === 'circle' ? target.label : '';

  // The SINGLE creation decision — same validator, same inputs the page feeds.
  // NOT the gate for a circle target: a circle create needs no invite, so the
  // matrix (which would report private_requires_invite for private+no-invite) is
  // bypassed via `isCircle` below, never forked.
  const creation = deriveArgumentRoomCreation({ visibility, directInviteEmails });

  // Public capacity preview for the toggle consequences copy (validator-derived
  // numbers, never literals). Uses the current invite so a person-going-public
  // shows the reserved-seat variant and open-floor shows the open variant.
  const publicPreview = deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails });
  const capacityPreview = {
    capacity: publicPreview.capacity,
    open: publicPreview.openSlots,
    reservedInviteSeats: publicPreview.reservedInviteSeats,
  };

  // Inline e-mail reason for the picker field: only an e-mail-shaped reject the
  // user can act on, routed through the shipped plain-language mapper.
  const emailReason =
    target?.kind === 'email' &&
    inviteEmail.trim().length > 0 &&
    !creation.valid &&
    (creation.reason === 'invalid_email' || creation.reason === 'too_many_direct_invites')
      ? plainLanguageForCreationReason(creation.reason)
      : null;

  // Non-email disabled reason (e.g. private_requires_invite) shown near submit.
  // Suppressed for a circle target — a circle needs no invite, so the matrix
  // private_requires_invite is not a real blocker there.
  const submitReasonCopy =
    !isCircle && !creation.valid && creation.reason === 'private_requires_invite'
      ? plainLanguageForCreationReason(creation.reason)
      : null;

  // Private summary line (J3). Not shown for open-floor / public / circle.
  const showPrivateSummary =
    visibility === 'private' && target?.kind !== 'open_floor' && !isCircle;
  const privateSummary = showPrivateSummary
    ? creation.valid && creation.normalisedDirectInviteEmail
      ? START_SHEET_COPY.privateWithPerson.replace(
          '{person}',
          maskInviteeEmail(creation.normalisedDirectInviteEmail),
        )
      : START_SHEET_COPY.privateNeedsPerson
    : null;

  // START-002 — circle summary line (analogous to the private summary). Neutral,
  // structural: names the circle audience without a ranking.
  const circleSummary = isCircle
    ? START_SHEET_COPY.circlePrivateSummary.replace('{circle}', circleLabel)
    : null;

  // A circle target is submittable on the draft alone (no invite required); a
  // non-circle target still needs the matrix to be valid.
  const canSubmit =
    isStartArgumentDraftSubmittable({ declaration }) && (isCircle || creation.valid) && !submitting;

  const handleTargetChange = (next: PersonTarget) => {
    setTarget(next);
    // Strengthen private-by-default: any target change resets visibility to
    // private so a prior public confirm never rides a new selection, and clears
    // a stale invite from a public create (edge cases in the design).
    setVisibility('private');
    if (next.kind === 'open_floor') {
      // Auto-expand Advanced but DO NOT flip the toggle (START-003 A2).
      setAdvancedExpanded(true);
    } else {
      setAdvancedExpanded(false);
    }
    if (error) setError(null);
  };

  const handleSubmit = async () => {
    if (!isStartArgumentDraftSubmittable({ declaration }) || (!isCircle && !creation.valid) || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    const trimmed = declaration.trim();
    // START-002 — a circle create is PRIVATE + circleId + NO invite. A
    // non-circle create is unchanged (byte-identical to the START-001 contract).
    const input: CreateDebateInput =
      isCircle && circleId
        ? {
            title: pickDisplayTitle({ rootBody: trimmed }),
            resolution: trimmed,
            description: '',
            visibility: 'private',
            circleId,
          }
        : {
            title: pickDisplayTitle({ rootBody: trimmed }),
            resolution: trimmed,
            description: '',
            visibility,
            ...(creation.normalisedDirectInviteEmail
              ? { invite: { email: creation.normalisedDirectInviteEmail } }
              : {}),
          };
    try {
      const created = await onCreate(input);
      if (created) {
        if (created.inviteLink) {
          setCreatedInvite({ debate: created.debate, surface, inviteLink: created.inviteLink });
        } else {
          onCreated?.(created.debate, surface);
        }
      } else {
        setError(START_SHEET_COPY.submitError);
      }
    } catch {
      setError(START_SHEET_COPY.submitError);
    }
    setSubmitting(false);
  };

  const handleCopyInviteLink = () => setLinkCopied(true);

  const handleContinueAfterInvite = () => {
    const handoff = createdInvite;
    setCreatedInvite(null);
    setLinkCopied(false);
    if (handoff) onCreated?.(handoff.debate, handoff.surface);
  };

  // ARG-ROOM-008 — one-time create-time invite-link success state (verbatim
  // reuse of the page's box + copy constants).
  if (createdInvite) {
    return (
      <View style={styles.screen} testID="start-sheet-invite-success">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{ARGUMENT_ROOM_CREATE_COPY.invite_link_box_title}</Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inviteLinkBox} testID="start-sheet-invite-link-box">
            <Text style={styles.helper}>{ARGUMENT_ROOM_CREATE_COPY.invite_link_box_helper}</Text>
            <Text style={styles.inviteLinkText} selectable testID="start-sheet-invite-link-text">
              {createdInvite.inviteLink}
            </Text>
            <Pressable
              onPress={handleCopyInviteLink}
              accessibilityRole="button"
              accessibilityLabel={INVITE_PANEL_COPY.copyLinkButton}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={({ pressed }) => [styles.inviteLinkCopyBtn, pressed && styles.pressed]}
              testID="start-sheet-invite-link-copy"
            >
              <Text style={styles.inviteLinkCopyBtnText}>
                {linkCopied ? INVITE_PANEL_COPY.copyLinkSuccess : INVITE_PANEL_COPY.copyLinkButton}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleContinueAfterInvite}
            accessibilityRole="button"
            accessibilityLabel={ARGUMENT_ROOM_CREATE_COPY.invite_link_continue_label}
            style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
            testID="start-sheet-invite-link-continue"
          >
            <Text style={styles.submitLabel}>
              {ARGUMENT_ROOM_CREATE_COPY.invite_link_continue_label}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="start-argument-sheet">
      <View style={styles.sheetHandle} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{START_SHEET_COPY.sheetTitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Who (person-first) ─────────────────────────────── */}
        <PersonArgumentPicker
          value={target}
          onChange={handleTargetChange}
          recents={recents}
          circles={circles}
          emailReason={emailReason}
        />

        {privateSummary ? (
          <Text style={styles.privateSummary} testID="start-sheet-private-summary">
            {privateSummary}
          </Text>
        ) : null}

        {circleSummary ? (
          <Text style={styles.privateSummary} testID="start-sheet-circle-summary">
            {circleSummary}
          </Text>
        ) : null}

        {/* ── What (the declaration) ─────────────────────────── */}
        <View style={styles.declarationBlock}>
          <Text style={styles.declarationLabel}>{START_SHEET_COPY.pointStepLabel}</Text>
          <Text style={styles.helper}>{START_SHEET_COPY.pointStepHelper}</Text>
          <TextInput
            value={declaration}
            onChangeText={(v) => {
              setDeclaration(v);
              if (error) setError(null);
            }}
            placeholder={START_SHEET_COPY.pointPlaceholder}
            placeholderTextColor={SURFACE_TOKENS.placeholder}
            multiline
            textAlignVertical="top"
            style={styles.declarationInput}
            accessibilityLabel={START_SHEET_COPY.pointStepLabel}
            accessibilityHint={START_SHEET_COPY.pointStepHelper}
            testID="start-sheet-declaration"
          />
        </View>

        {/* ── Advanced (collapsed) — hosts the START-003 toggle ── */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setAdvancedExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={START_SHEET_COPY.advancedLabel}
            accessibilityState={{ expanded: advancedExpanded }}
            hitSlop={TOUCH_TARGET.hitSlopCompact}
            style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}
            testID="start-sheet-advanced-toggle"
          >
            <Text style={styles.advancedGlyph}>{advancedExpanded ? '▾' : '▸'}</Text>
            <View style={styles.advancedTextCol}>
              <Text style={styles.advancedLabel}>{START_SHEET_COPY.advancedLabel}</Text>
              <Text style={styles.helper}>{START_SHEET_COPY.advancedHelper}</Text>
            </View>
          </Pressable>

          {advancedExpanded ? (
            <View style={styles.advancedBody} testID="start-sheet-advanced">
              {renderPublicToggle
                ? renderPublicToggle({
                    visibility,
                    onChange: setVisibility,
                    capacityPreview,
                    expanded: advancedExpanded,
                    // START-002 — public is LOCKED off for a circle target: a
                    // circle argument is always private (never previews public).
                    disabled: submitting || isCircle,
                  })
                : null}
              {isCircle ? (
                <Text style={styles.helper} testID="start-sheet-circle-forces-private">
                  {START_SHEET_COPY.circleForcesPrivate}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {submitReasonCopy ? (
          <Text
            style={styles.submitReason}
            accessibilityLiveRegion="polite"
            testID="start-sheet-submit-reason"
          >
            {submitReasonCopy}
          </Text>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite" testID="start-sheet-error">
            {error}
          </Text>
        ) : null}

        {/* ── Actions ────────────────────────────────────────── */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={START_SHEET_COPY.submitLabel}
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          testID="start-sheet-submit"
        >
          <Text style={styles.submitLabel}>{START_SHEET_COPY.submitLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={START_SHEET_COPY.cancelLabel}
          accessibilityState={{ disabled: submitting }}
          style={({ pressed }) => [styles.cancel, pressed && !submitting && styles.pressed]}
          testID="start-sheet-cancel"
        >
          <Text style={styles.cancelLabel}>{START_SHEET_COPY.cancelLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  // Sheet chrome — a rounded top handle so the surface reads as a sheet, not a
  // full page (the shell is state-flag nav with no router / modal dependency).
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: SURFACE_TOKENS.border,
    marginTop: SPACING.s,
    marginBottom: SPACING.xs,
  },
  header: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.l, paddingBottom: SPACING.xl * 2, gap: SPACING.l },

  helper: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16 },

  privateSummary: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },

  declarationBlock: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.l,
    gap: SPACING.xs,
  },
  declarationLabel: { fontSize: 16, fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  declarationInput: {
    marginTop: SPACING.s,
    minHeight: 120,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 16,
    lineHeight: 22,
    color: SURFACE_TOKENS.textPrimary,
  },

  section: { gap: SPACING.xs },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    minHeight: 44,
    paddingVertical: SPACING.s,
  },
  advancedGlyph: { fontSize: 14, color: SURFACE_TOKENS.textSecondary, width: 16, textAlign: 'center' },
  advancedTextCol: { flex: 1, gap: 2 },
  advancedLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  advancedBody: { marginTop: SPACING.s },

  submitReason: { fontSize: 12, color: '#fcd34d', lineHeight: 16 },
  error: { fontSize: 13, color: '#fca5a5' },

  inviteLinkBox: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  inviteLinkText: { fontSize: 13, color: SURFACE_TOKENS.textPrimary, fontFamily: 'monospace', lineHeight: 18 },
  inviteLinkCopyBtn: {
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.raised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
  },
  inviteLinkCopyBtnText: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },

  submit: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.m,
  },
  submitDisabled: { backgroundColor: CONTROL.primary.disabledBg, opacity: 0.6 },
  submitLabel: { fontSize: 15, fontWeight: '700', color: CONTROL.primary.fg },
  cancel: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.s,
  },
  cancelLabel: { fontSize: 15, fontWeight: '600', color: CONTROL.secondary.fg },
  pressed: { opacity: 0.8 },
});
