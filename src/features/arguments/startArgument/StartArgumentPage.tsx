/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument page.
 *
 * Replaces the old `CreateDebateForm` ("New Argument") surface. Declaration-
 * first: a single required claim/question/position is the visual focus. A
 * Timeline / Card surface selector chooses the LANDING VIEW after creation
 * (same underlying record either way). Three OPTIONAL taxonomy selectors
 * (argument type, disagreement strategy, disagreement cause) sit secondary
 * to the declaration.
 *
 * Doctrine boundary:
 *   - The taxonomy selections are SELF-DECLARED FRAMING METADATA the author
 *     chooses about their OWN move. They are not a machine classification,
 *     not a validity / verdict judgment, and never gate submission.
 *   - Submit uses the EXISTING creation path (`onCreate` → the same
 *     `useDebates().create` → `createDebate` the old New Argument used).
 *   - NO classifier / AI / MCP call sits anywhere in the submit/acceptance
 *     path. The Constitution rules engine remains the sole submission gate.
 *
 * Styling: dark surfaces only (`SURFACE_TOKENS`), no reuse of the old New
 * Argument bright-white container/classes. The declaration is the focus;
 * taxonomy is visually secondary. >= 44px tap targets; visible focus +
 * selection states that do not rely on color alone (a ● / ○ glyph + bolder
 * label carry the selection).
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../../lib/designTokens';
import { pickDisplayTitle } from '../../debates/debateTitleHelpers';
import type { CreateDebateInput, CreatedRoom, Debate, RoomVisibility } from '../../debates/types';
import {
  deriveArgumentRoomCreation,
  plainLanguageForCreationReason,
} from '../../debates/argumentRoomCreationMatrix';
import {
  ARGUMENT_ROOM_CREATE_COPY,
  ROOM_VISIBILITY_COPY,
  fillArgumentRoomCapacityCopy,
} from '../gameCopy';
// ARG-ROOM-008 — REUSE the shipped copy-link affordance copy (QOL-038). The
// create-time success box renders the SAME "Copy invite link" / "Copied" labels
// the in-room InvitePanel uses, so there is one copy-link vocabulary. This is a
// type-erased copy-constant import — no supabase client, no Edge helper.
import { INVITE_PANEL_COPY } from '../../invites/inviteCopy';
import {
  ARGUMENT_SCHEME_OPTIONS,
  DISAGREEMENT_CAUSE_OPTIONS,
  groupDisagreementStrategiesByCluster,
  isStartArgumentDraftSubmittable,
  type ArgumentSchemeId,
  type DisagreementCauseId,
  type DisagreementStrategyId,
  type StartArgumentSurface,
} from './startArgumentTaxonomy';

// ── Copy ──────────────────────────────────────────────────────────
// All user-facing copy lives here so the ban-list test can scan one
// place. Neutral, non-verdict. States the taxonomy is self-declared
// framing, not a machine classification or a validity judgment.

const COPY = {
  screenTitle: 'Start an argument',
  declarationLabel: 'Your point',
  // UX-SIMPLIFY-001 — a clear, question-framed first-point prompt. People
  // respond to a specific point, so name the point/claim others will answer.
  declarationHelper: 'State the point or claim others will respond to. People respond to specific points.',
  declarationPlaceholder: 'What point are you starting with?',
  surfaceSectionLabel: 'Open into',
  surfaceSectionHelper: 'Choose the view you land in. It is the same argument either way.',
  surfaceTimelineLabel: 'Timeline',
  surfaceTimelineHelper: 'Timeline — follow the sequence of replies and turns.',
  surfaceCardLabel: 'Card',
  surfaceCardHelper: 'Card — open a focused argument card with details readily visible.',
  taxonomySectionLabel: 'Optional framing',
  taxonomyDisclaimer:
    'Optional. These are your own framing notes about how you mean this argument — not a classification of it and not a judgment of whether it is right.',
  schemeLabel: 'Argument type',
  schemeHelper: 'Optional — how you mean to reason here.',
  strategyLabel: 'Disagreement strategy',
  strategyHelper: 'Optional — the discussion style you expect to use.',
  causeLabel: 'Why might people disagree here?',
  causeHelper: 'Optional — where you think the disagreement comes from.',
  submitLabel: 'Start argument',
  cancelLabel: 'Cancel',
  submitError: 'Could not start the argument. Please try again.',
} as const;

// ── Props ─────────────────────────────────────────────────────────

interface StartArgumentPageProps {
  /**
   * The EXISTING creation path — the same `useDebates().create` →
   * `createDebate` the old New Argument surface used. The page does NOT
   * invent a new creation channel.
   *
   * ARG-ROOM-008 — it now resolves to a `CreatedRoom` (the new `Debate` plus
   * the one-time create-time `inviteLink`). When the link is present the page
   * shows it once, inviter-only, before handing off to `onCreated`.
   */
  onCreate: (input: CreateDebateInput) => Promise<CreatedRoom | null>;
  /**
   * Landing-route hand-off. Called after a successful create with the
   * created debate and the chosen surface, so the caller can open the room
   * into the matching view (timeline → Timeline view; card → Cards view).
   * Optional — callers that only need the room created can omit it.
   */
  onCreated?: (debate: Debate, surface: StartArgumentSurface) => void;
  /** Dismiss without creating. */
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function StartArgumentPage({ onCreate, onCreated, onCancel }: StartArgumentPageProps) {
  const [declaration, setDeclaration] = useState('');
  // ARG-ROOM-003 — visibility defaults to Private per the binding creation
  // matrix ("YES (default)" row). A fresh page therefore starts with submit
  // DISABLED until the author adds one invite email (private 1v1) or switches
  // to Public. The form always passes an EXPLICIT visibility to createDebate.
  const [visibility, setVisibility] = useState<RoomVisibility>('private');
  const [inviteEmail, setInviteEmail] = useState('');
  const [surface, setSurface] = useState<StartArgumentSurface>('timeline');
  const [argumentScheme, setArgumentScheme] = useState<ArgumentSchemeId>('unspecified');
  const [disagreementStrategy, setDisagreementStrategy] =
    useState<DisagreementStrategyId>('unspecified');
  const [disagreementCause, setDisagreementCause] =
    useState<DisagreementCauseId>('unspecified');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ARG-ROOM-008 — the one-time create-time invite-link success state. Set ONLY
  // when a create returned a raw `inviteLink` (private always; public-with-
  // invite). It holds the link, the created room, and the chosen surface so the
  // landing hand-off can fire on "Continue". The raw link lives only in this
  // in-memory state (mirrors InvitePanel's `lastInviteLink`) — it is never
  // logged and never written to storage. Clearing it on Continue/dismiss means
  // it is NOT re-exposed.
  const [createdInvite, setCreatedInvite] = useState<{
    debate: Debate;
    surface: StartArgumentSurface;
    inviteLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ARG-ROOM-001 owns the rule; the UI only renders its output. A multi-
  // address paste in the SINGLE field is split + counted INSIDE the validator
  // (→ `too_many_direct_invites`, never a generic invalid-email), so the
  // field's raw value is handed over as a one-element array.
  const creation = deriveArgumentRoomCreation({
    visibility,
    directInviteEmails: inviteEmail.trim().length > 0 ? [inviteEmail] : [],
  });
  // Capacity preview: when the current input is valid the validator's seat
  // fields are authoritative; when it is not yet valid (e.g. a half-typed
  // email) preview the SAME visibility with no invite so the explainer never
  // shows the zeroed reject counts. Either way the cap comes from the
  // validator — never a second hard-coded number.
  const capacityPreview = creation.valid
    ? creation
    : deriveArgumentRoomCreation({ visibility, directInviteEmails: [] });
  const capacityText =
    visibility === 'private'
      ? ARGUMENT_ROOM_CREATE_COPY.capacity_private
      : fillArgumentRoomCapacityCopy(
          capacityPreview.reservedInviteSeats === 1
            ? ARGUMENT_ROOM_CREATE_COPY.capacity_public_reserved
            : ARGUMENT_ROOM_CREATE_COPY.capacity_public_open,
          { capacity: capacityPreview.capacity, open: capacityPreview.openSlots },
        );
  const inviteHelper =
    visibility === 'private'
      ? ARGUMENT_ROOM_CREATE_COPY.invite_helper_private
      : ARGUMENT_ROOM_CREATE_COPY.invite_helper_public;
  // The single disabled-reason line, mapped from the validator's stable reason
  // code through the shipped plain-language mapper (raw codes never echoed).
  const creationReasonCopy = creation.valid
    ? null
    : plainLanguageForCreationReason(creation.reason);

  const canSubmit =
    isStartArgumentDraftSubmittable({ declaration }) && creation.valid && !submitting;

  const handleSubmit = async () => {
    // Disabled unless the declaration is present AND the creation matrix
    // validates (visibility + the optional one invite). Guard again here so a
    // programmatic press can never bypass the matrix.
    if (!isStartArgumentDraftSubmittable({ declaration }) || !creation.valid || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    // The declaration is the proposition (resolution); a short title is
    // derived from it via the shared display-title helper (no body
    // mutation). `description` is left empty — the old form had it
    // optional and `createDebate` trims it safely.
    const trimmed = declaration.trim();
    const input: CreateDebateInput = {
      title: pickDisplayTitle({ rootBody: trimmed }),
      resolution: trimmed,
      description: '',
      // ARG-ROOM-003 — always pass an EXPLICIT visibility (never rely on the
      // API's public default), and thread the one optional invite atomically
      // when the validator accepted a normalised address. ARG-ROOM-002 writes
      // room + creator + the one invite in a single transaction, so there is
      // no "room exists but invite failed" state to recover from.
      visibility,
      ...(creation.normalisedDirectInviteEmail
        ? { invite: { email: creation.normalisedDirectInviteEmail } }
        : {}),
    };
    try {
      // NAV-START-ARGUMENT-001: the EXISTING creation path. No classifier,
      // no AI, no MCP, no semantic referee invoked here — the rules engine
      // (server-side, via the existing path) is the sole submission gate.
      const created = await onCreate(input);
      if (created) {
        // ARG-ROOM-008 — when the create returned a one-time invite link
        // (private always; public-with-invite), show the copy-link box FIRST
        // and defer the landing hand-off until "Continue". The link is the only
        // client-side moment that token exists, so navigating straight into the
        // room would strand the invitee (the in-room InvitePanel cannot mint a
        // second link). With no link (public, no invite) navigate immediately.
        if (created.inviteLink) {
          setCreatedInvite({
            debate: created.debate,
            surface,
            inviteLink: created.inviteLink,
          });
        } else {
          onCreated?.(created.debate, surface);
        }
      } else {
        setError(COPY.submitError);
      }
    } catch {
      setError(COPY.submitError);
    }
    setSubmitting(false);
  };

  // ARG-ROOM-008 — copy feedback only. No clipboard import: the link renders as
  // selectable <Text> the user long-presses to copy (mirrors InvitePanel's
  // handleCopyLink). The raw token is NEVER passed to console / a logger.
  const handleCopyInviteLink = () => {
    setLinkCopied(true);
  };

  // ARG-ROOM-008 — one-time: clearing `createdInvite` removes the link from
  // state so it is not re-exposed, then hands off to the landing route.
  const handleContinueAfterInvite = () => {
    const handoff = createdInvite;
    setCreatedInvite(null);
    setLinkCopied(false);
    if (handoff) onCreated?.(handoff.debate, handoff.surface);
  };

  const strategyGroups = groupDisagreementStrategiesByCluster();

  // ARG-ROOM-008 — one-time create-time invite-link success state. Replaces the
  // whole form (the room is already created) and is reachable ONLY by the
  // creator who just submitted, so the link is inviter-only by construction.
  // The raw link renders as selectable <Text>; "Continue" clears it (not
  // re-exposed) and hands off to the room. No console, no storage.
  if (createdInvite) {
    return (
      <View style={styles.screen} testID="start-argument-invite-success">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {ARGUMENT_ROOM_CREATE_COPY.invite_link_box_title}
          </Text>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inviteLinkBox} testID="start-argument-invite-link-box">
            <Text style={styles.helper}>
              {ARGUMENT_ROOM_CREATE_COPY.invite_link_box_helper}
            </Text>
            <Text
              style={styles.inviteLinkText}
              selectable
              testID="start-argument-invite-link-text"
            >
              {createdInvite.inviteLink}
            </Text>
            <Pressable
              onPress={handleCopyInviteLink}
              accessibilityRole="button"
              accessibilityLabel={INVITE_PANEL_COPY.copyLinkButton}
              hitSlop={TOUCH_TARGET.hitSlopCompact}
              style={({ pressed }) => [styles.inviteLinkCopyBtn, pressed && styles.pressed]}
              testID="start-argument-invite-link-copy"
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
            testID="start-argument-invite-link-continue"
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
    <View style={styles.screen} testID="start-argument-page">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{COPY.screenTitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Declaration (the focus) ─────────────────────────── */}
        <View style={styles.declarationBlock}>
          <Text style={styles.declarationLabel}>{COPY.declarationLabel}</Text>
          <Text style={styles.helper}>{COPY.declarationHelper}</Text>
          <TextInput
            value={declaration}
            onChangeText={(v) => {
              setDeclaration(v);
              if (error) setError(null);
            }}
            placeholder={COPY.declarationPlaceholder}
            placeholderTextColor={SURFACE_TOKENS.placeholder}
            multiline
            textAlignVertical="top"
            style={styles.declarationInput}
            accessibilityLabel={COPY.declarationLabel}
            accessibilityHint={COPY.declarationHelper}
            testID="start-argument-declaration"
          />
        </View>

        {/* ── Who can join (visibility + one invite + capacity) ── */}
        <View style={styles.section} testID="start-argument-who-can-join">
          <Text style={styles.sectionLabel}>{ARGUMENT_ROOM_CREATE_COPY.who_can_join_label}</Text>
          <Text style={styles.helper}>{ARGUMENT_ROOM_CREATE_COPY.who_can_join_helper}</Text>

          {/* Visibility radiogroup. The ANNOUNCED label is join-framed (not the
              reused "Who can see this argument" read-access phrase) so it stays
              coherent inside the "Who can join" section for a screen reader. */}
          <View
            style={styles.surfaceRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={ARGUMENT_ROOM_CREATE_COPY.visibility_group_a11y}
            testID="start-argument-visibility-group"
          >
            <VisibilityOption
              value="public"
              label={ROOM_VISIBILITY_COPY.option_public_label}
              helper={ROOM_VISIBILITY_COPY.option_public_helper}
              selected={visibility === 'public'}
              onSelect={setVisibility}
              testID="start-argument-visibility-public"
            />
            <VisibilityOption
              value="private"
              label={ROOM_VISIBILITY_COPY.option_private_label}
              helper={ROOM_VISIBILITY_COPY.option_private_helper}
              selected={visibility === 'private'}
              onSelect={setVisibility}
              testID="start-argument-visibility-private"
            />
          </View>

          {/* One direct-invite email field — no "add another". */}
          <View style={styles.inviteBlock} testID="start-argument-invite">
            <Text style={styles.inviteLabel}>{ARGUMENT_ROOM_CREATE_COPY.invite_field_label}</Text>
            <Text style={styles.helper}>{inviteHelper}</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={(v) => {
                setInviteEmail(v);
                if (error) setError(null);
              }}
              placeholder={ARGUMENT_ROOM_CREATE_COPY.invite_field_placeholder}
              placeholderTextColor={SURFACE_TOKENS.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.inviteInput}
              accessibilityLabel={ARGUMENT_ROOM_CREATE_COPY.invite_field_label}
              testID="start-argument-invite-email"
            />
            {/* The single disabled-reason line, shown as VISIBLE text (color is
                never the only signal) with a polite live region. For a 2+
                paste this carries the specific too_many_direct_invites copy,
                not the generic invalid-email string. */}
            {creationReasonCopy ? (
              <Text
                style={styles.inviteReason}
                accessibilityLiveRegion="polite"
                testID="start-argument-create-reason"
              >
                {creationReasonCopy}
              </Text>
            ) : null}
          </View>

          {/* Capacity explainer — the cap + open-seat numbers come from the
              validator output, not a literal in the copy. */}
          <Text style={styles.capacity} testID="start-argument-capacity">
            {capacityText}
          </Text>
        </View>

        {/* ── Surface selector (drives landing route) ─────────── */}
        <View style={styles.section} testID="start-argument-surface">
          <Text style={styles.sectionLabel}>{COPY.surfaceSectionLabel}</Text>
          <Text style={styles.helper}>{COPY.surfaceSectionHelper}</Text>
          <View
            style={styles.surfaceRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={COPY.surfaceSectionLabel}
          >
            <SurfaceOption
              value="timeline"
              label={COPY.surfaceTimelineLabel}
              helper={COPY.surfaceTimelineHelper}
              selected={surface === 'timeline'}
              onSelect={setSurface}
              testID="start-argument-surface-timeline"
            />
            <SurfaceOption
              value="card"
              label={COPY.surfaceCardLabel}
              helper={COPY.surfaceCardHelper}
              selected={surface === 'card'}
              onSelect={setSurface}
              testID="start-argument-surface-card"
            />
          </View>
        </View>

        {/* ── Optional framing taxonomy (secondary) ───────────── */}
        <View style={styles.section} testID="start-argument-taxonomy">
          <Text style={styles.sectionLabel}>{COPY.taxonomySectionLabel}</Text>
          <Text style={styles.disclaimer}>{COPY.taxonomyDisclaimer}</Text>

          {/* Argument type */}
          <View style={styles.taxonomyGroup} testID="start-argument-scheme">
            <Text style={styles.taxonomyGroupLabel}>{COPY.schemeLabel}</Text>
            <Text style={styles.helper}>{COPY.schemeHelper}</Text>
            <View style={styles.optionWrap}>
              {ARGUMENT_SCHEME_OPTIONS.map((o) => (
                <TaxonomyChip
                  key={`scheme-${o.id}`}
                  label={o.label}
                  helper={o.description}
                  selected={argumentScheme === o.id}
                  onPress={() => setArgumentScheme(o.id)}
                  testID={`start-argument-scheme-${o.id}`}
                />
              ))}
            </View>
          </View>

          {/* Disagreement strategy — grouped by cluster */}
          <View style={styles.taxonomyGroup} testID="start-argument-strategy">
            <Text style={styles.taxonomyGroupLabel}>{COPY.strategyLabel}</Text>
            <Text style={styles.helper}>{COPY.strategyHelper}</Text>
            {strategyGroups.map((group) => (
              <View key={`cluster-${group.cluster}`} style={styles.clusterBlock}>
                <Text style={styles.clusterLabel}>{group.clusterLabel}</Text>
                <View style={styles.optionWrap}>
                  {group.options.map((o) => (
                    <TaxonomyChip
                      key={`strategy-${o.id}`}
                      label={o.label}
                      helper={o.description}
                      selected={disagreementStrategy === o.id}
                      onPress={() => setDisagreementStrategy(o.id)}
                      testID={`start-argument-strategy-${o.id}`}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Disagreement cause */}
          <View style={styles.taxonomyGroup} testID="start-argument-cause">
            <Text style={styles.taxonomyGroupLabel}>{COPY.causeLabel}</Text>
            <Text style={styles.helper}>{COPY.causeHelper}</Text>
            <View style={styles.optionWrap}>
              {DISAGREEMENT_CAUSE_OPTIONS.map((o) => (
                <TaxonomyChip
                  key={`cause-${o.id}`}
                  label={o.label}
                  helper={o.description}
                  selected={disagreementCause === o.id}
                  onPress={() => setDisagreementCause(o.id)}
                  testID={`start-argument-cause-${o.id}`}
                />
              ))}
            </View>
          </View>
        </View>

        {error ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="polite"
            testID="start-argument-error"
          >
            {error}
          </Text>
        ) : null}

        {/* ── Actions ─────────────────────────────────────────── */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={COPY.submitLabel}
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          testID="start-argument-submit"
        >
          <Text style={styles.submitLabel}>{COPY.submitLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={COPY.cancelLabel}
          accessibilityState={{ disabled: submitting }}
          style={({ pressed }) => [
            styles.cancel,
            pressed && !submitting && styles.pressed,
          ]}
          testID="start-argument-cancel"
        >
          <Text style={styles.cancelLabel}>{COPY.cancelLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Surface option (radio) ────────────────────────────────────────

function SurfaceOption({
  value,
  label,
  helper,
  selected,
  onSelect,
  testID,
}: {
  value: StartArgumentSurface;
  label: string;
  helper: string;
  selected: boolean;
  onSelect: (v: StartArgumentSurface) => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.surfaceOption, selected && styles.surfaceOptionSelected]}
      testID={testID}
    >
      <View style={styles.surfaceOptionHeader}>
        {/* Shape glyph (●/○) + bolder label carry selection — not color alone. */}
        <Text style={[styles.surfaceCheck, selected && styles.surfaceCheckOn]}>
          {selected ? '●' : '○'}
        </Text>
        <Text style={[styles.surfaceLabel, selected && styles.surfaceLabelSelected]}>
          {label}
        </Text>
      </View>
      <Text style={styles.surfaceHelper}>{helper}</Text>
    </Pressable>
  );
}

// ── Visibility option (radio) ─────────────────────────────────────
// ARG-ROOM-003 — lifts the structure/semantics of the shipped QOL-039
// visibility radio onto the live dark surface (reusing the in-file
// `surface*` styles rather than the orphaned light-theme StyleSheet). Role
// `radio`, `accessibilityState.selected`, a >= 44px hit target, and a
// ● / ○ glyph + bolder label carry the selection — color is never the only
// signal.

function VisibilityOption({
  value,
  label,
  helper,
  selected,
  onSelect,
  testID,
}: {
  value: RoomVisibility;
  label: string;
  helper: string;
  selected: boolean;
  onSelect: (v: RoomVisibility) => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.surfaceOption, selected && styles.surfaceOptionSelected]}
      testID={testID}
    >
      <View style={styles.surfaceOptionHeader}>
        {/* Shape glyph (●/○) + bolder label carry selection — not color alone. */}
        <Text style={[styles.surfaceCheck, selected && styles.surfaceCheckOn]}>
          {selected ? '●' : '○'}
        </Text>
        <Text style={[styles.surfaceLabel, selected && styles.surfaceLabelSelected]}>
          {label}
        </Text>
      </View>
      <Text style={styles.surfaceHelper}>{helper}</Text>
    </Pressable>
  );
}

// ── Taxonomy chip (single-select within a group) ──────────────────

function TaxonomyChip({
  label,
  helper,
  selected,
  onPress,
  testID,
}: {
  label: string;
  helper: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      {/* Shape glyph carries selection state in addition to color. */}
      <Text style={[styles.chipCheck, selected && styles.chipCheckOn]}>
        {selected ? '●' : '○'}
      </Text>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles (dark surfaces only) ───────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  header: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.l, paddingBottom: SPACING.xl * 2, gap: SPACING.l },

  // Declaration — the visual focus. Larger, elevated, generous.
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

  // Secondary sections.
  section: { gap: SPACING.xs },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  helper: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16 },
  disclaimer: { fontSize: 12, color: SURFACE_TOKENS.textMuted, lineHeight: 16, fontStyle: 'italic' },

  // Surface selector.
  surfaceRow: { flexDirection: 'row', gap: SPACING.s, marginTop: SPACING.s },
  surfaceOption: {
    flex: 1,
    minHeight: 44,
    padding: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
    gap: SPACING.xs,
  },
  surfaceOptionSelected: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing },
  surfaceOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  surfaceCheck: { fontSize: 15, color: SURFACE_TOKENS.textMuted },
  surfaceCheckOn: { color: SURFACE_TOKENS.textPrimary },
  surfaceLabel: { fontSize: 14, fontWeight: '600', color: SURFACE_TOKENS.textSecondary },
  surfaceLabelSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  surfaceHelper: { fontSize: 11, color: SURFACE_TOKENS.textMuted, lineHeight: 15 },

  // Who-can-join: one direct-invite field + capacity explainer.
  inviteBlock: { marginTop: SPACING.m, gap: SPACING.xs },
  inviteLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  inviteInput: {
    marginTop: SPACING.xs,
    minHeight: 44,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    fontSize: 15,
    color: SURFACE_TOKENS.textPrimary,
  },
  // Disabled-reason / inline-validation text. Amber (not error-red) — it is a
  // "you can't start yet, here's why" explainer as often as an email error.
  inviteReason: { fontSize: 12, color: '#fcd34d', lineHeight: 16, marginTop: SPACING.xs },
  capacity: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16, marginTop: SPACING.s },

  // ARG-ROOM-008 — one-time create-time invite-link box (mirrors the dark
  // InvitePanel link-box styling). The link is monospace + selectable so it can
  // be long-pressed/copied; the copy control meets the 44px target via hitSlop
  // plus minHeight.
  inviteLinkBox: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  inviteLinkText: {
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
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

  // Taxonomy.
  taxonomyGroup: { marginTop: SPACING.m, gap: SPACING.xs },
  taxonomyGroupLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  clusterBlock: { marginTop: SPACING.s, gap: SPACING.xs },
  clusterLabel: { fontSize: 12, fontWeight: '700', color: SURFACE_TOKENS.textSecondary },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  chipSelected: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing, backgroundColor: SURFACE_TOKENS.overlay },
  chipCheck: { fontSize: 13, color: SURFACE_TOKENS.textMuted },
  chipCheckOn: { color: SURFACE_TOKENS.textPrimary },
  chipText: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textSecondary },
  chipTextSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },

  // Error.
  error: { fontSize: 13, color: '#fca5a5', marginTop: SPACING.xs },

  // Actions.
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
