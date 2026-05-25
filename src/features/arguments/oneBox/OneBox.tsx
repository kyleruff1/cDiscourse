/**
 * QOL-030 — OneBox: the single switchable composer box.
 *
 * The "box" is ONE component that re-types itself — it is NEVER replaced
 * by a bespoke screen (QOL-030 design §1 / one-box-interface-model.md §1).
 * An interactive flash menu (the Act popout) switches the box *type*; the
 * type drives the box's *schema* and a seeded composer preset.
 *
 * Architecture (QOL-030 design §6 / §7):
 *  - The box's identity is the `boxModel` state machine — `(type, target,
 *    view, stageContext, lifecycle, draftBuffers)`.
 *  - The box HEADER carries the type chip + a `▾` that opens the Act
 *    popout (the QOL-030 chassis `Popout` + `PopoutGroup`, fed by the
 *    `buildActPopout` 3-gate pure model).
 *  - The box BODY hosts the existing `ArgumentComposer` — the SHIPPED
 *    `submit-argument` post path. QOL-030 is composition over existing
 *    data: it does NOT re-author the post flow, add a migration, or
 *    bypass `submit-argument`.
 *  - Choosing a flash-menu entry re-types the box (`switchBoxType`) and
 *    seeds the composer via the shipped `quickActionToPreset` machinery.
 *
 * Scope (QOL-030 design §12): the Act popout *contents* beyond the
 * chassis are QOL-031; the structured-form / forced-list schema internals
 * are QOL-036 / QOL-037 / QOL-041. QOL-030 proves the box can host them —
 * the v1 body is the free-body composer for every type; a per-type
 * `schemaNotice` previews which schema kind a later card will render.
 *
 * Doctrine (QOL-030 design §10):
 *  - The box previews a node's *type and stage*, never its correctness —
 *    no verdict / winner / loser / truth copy.
 *  - The flash menu is engine-gated + role-gated — `buildActPopout` can
 *    only ever offer valid, permitted moves. No AI.
 *  - The box posts only through `submit-argument`; no service-role, no
 *    direct insert.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArgumentComposer } from '../ArgumentComposer';
import type { MoveDraftPatch } from '../conversationMoves';
import { quickActionToPreset, type QuickActionLabel } from '../quickActionPresets';
import type { ArgumentRow } from '../types';
import type { Debate } from '../../debates/types';
import type { ConstitutionRule } from '../../../domain/constitution/types';
import type { PointLifecycleState } from '../../lifecycle';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../lib/designTokens';
import {
  createBoxState,
  switchBoxType,
  renderSchema,
  type BoxType,
  type BoxState,
  type SchemaKind,
} from './boxModel';
import { actEntryToQuickAction, type ActEntryId, type ActViewerRole } from './actPopoutModel';
import { ActPopout } from './ActPopout';
// UX-001.3 — per-target × per-mode draft persistence. OneBox is the
// host that wires draft parking + restoration on mode switch.
import { useComposerDraftRegistry } from '../composer/useComposerDraftRegistry';
import { deriveTargetKey } from '../composer/composerDraftRegistry';
import { useAppSession } from '../../session/useAppSession';
// UX-001.3 — the always-visible compact target display at the top of
// the dock body. Replaces the OneBox header's tiny `targetHint` and
// the legacy ArgumentComposer "Replying to" parent block (the legacy
// block stays for now; the strip subsumes its semantics).
import { ComposerContextStrip } from '../composer/ComposerContextStrip';

// ── Plain-language box-type vocabulary ─────────────────────────

/**
 * The plain-language label for each `BoxType` — shown on the box header
 * chip. Authored here (the box header is QOL-030's own surface). Every
 * label is plain English, carries zero verdict / amplification token, and
 * is scanned by `__tests__/oneBoxCopyBanList.test.ts`.
 */
export const BOX_TYPE_LABEL: Readonly<Record<BoxType, string>> = Object.freeze({
  root_claim: 'New argument',
  respond: 'Respond',
  respond_to_concession: 'Respond to concession',
  respond_to_evidence: 'Respond to evidence',
  add_evidence: 'Add evidence',
  ask_source: 'Ask for a source',
  ask_quote: 'Ask for a quote',
  clarify: 'Clarify',
  narrow: 'Narrow the claim',
  confirm: 'Confirm',
  synthesize: 'Synthesize',
  branch_tangent: 'Open a side issue',
  // UX-001.3 — the brief's "Concession list" canonical mode.
  offer_concession: 'Offer concessions',
});

/**
 * A one-line plain-language note describing the schema kind a box type
 * renders. The free-body composer is the v1 body for every type; this
 * note tells the user when a richer schema is on its way (QOL-036 /
 * QOL-037 / QOL-041) without leaking an internal code.
 */
const SCHEMA_KIND_NOTICE: Readonly<Record<SchemaKind, string>> = Object.freeze({
  free_body: 'Write your move below.',
  composite: 'Add the points you accept, then write your response below.',
  forced_list: 'Each point is its own item.',
  structured_form: 'Fill in the details below.',
});

// ── Component ──────────────────────────────────────────────────

export interface OneBoxProps {
  /** The room the box composes into. */
  debate: Debate;
  /** The reply target id (null → a root-claim context). */
  selectedParentId: string | null;
  /** The parent argument row (null → a root-claim context). */
  parentArgument: ArgumentRow | null;
  /** Clears the reply target (the composer's "Clear" affordance). */
  onClearParent: () => void;
  /** Post succeeded — bubbles to the room shell to refresh. */
  onSubmitSuccess: () => void;
  /** Close the box without posting. */
  onClose: () => void;
  /**
   * An initial composer patch from a caller (e.g. a quick action that
   * opened the dock). Merged under any flash-menu-derived patch.
   */
  initialPatch?: MoveDraftPatch | null;
  /**
   * The selected target node's LIFE-001 stage — the Act popout's soft
   * gate. Optional; `null` (or omitted) degrades the flash menu to no
   * stage promotion (design §8 fallback).
   */
  stageContext?: PointLifecycleState | null;
  /**
   * The viewer's role relative to the target — the Act popout's hard role
   * gate. Defaults to `participant_other` (the dock opens only when a
   * participant is composing on another move).
   */
  viewerRole?: ActViewerRole;
  /**
   * The active Constitution rules — the Act popout's engine gate. Passed
   * by the dock from `useConstitution().activeRules`.
   */
  rules: ReadonlyArray<ConstitutionRule>;
  /** PR-001 effective reduce-motion — threaded into the Act popout chassis. */
  reduceMotionOverride?: boolean;
  /**
   * RULE-004 — pause-before-send gate, threaded straight through to the
   * hosted `ArgumentComposer` (the dock owns the review sheet).
   */
  onBeforeSubmit?: () => boolean;
  /** RULE-004 — one-shot "Post anyway" trigger, threaded to the composer. */
  postSignal?: number;
  /**
   * UX-001.3 — read-only `activeMessageId` from `ArgumentGameSurface`.
   * Powers the `ComposerContextStrip`'s divergence cue when the
   * Timeline's selected node differs from the composer's bound
   * parent. Additive optional; omitted = no cue surface.
   */
  activeMessageId?: string | null;
  /**
   * UX-001.3 — one-shot "open the mode switcher" trigger. The dock
   * increments this counter when the user presses Cmd/Ctrl+K with
   * the composer focused; the OneBox opens the ActPopout in response.
   * Mirrors the postSignal pattern. Additive optional; `0` / omitted
   * means no programmatic open.
   */
  openModeSwitcherSignal?: number;
}

/**
 * The single switchable composer box. Hosts the existing
 * `ArgumentComposer` as the post engine and adds the box-type header +
 * the Act popout (flash menu) that re-types the box.
 */
export function OneBox({
  debate,
  selectedParentId,
  parentArgument,
  onClearParent,
  onSubmitSuccess,
  onClose,
  initialPatch,
  stageContext,
  viewerRole,
  rules,
  reduceMotionOverride,
  onBeforeSubmit,
  postSignal,
  activeMessageId,
  openModeSwitcherSignal,
}: OneBoxProps) {
  // The box state machine. The initial type is `respond` when there is a
  // reply target, `root_claim` otherwise — the box opens already typed
  // for the most common move (design §6.1).
  const initialType: BoxType = parentArgument ? 'respond' : 'root_claim';
  const [boxState, setBoxState] = useState<BoxState>(() =>
    createBoxState({
      type: initialType,
      target: parentArgument
        ? { kind: 'node', referenceId: parentArgument.id }
        : { kind: 'none' },
      stageContext: stageContext ?? null,
    }),
  );

  // The flash-menu-derived composer preset. Re-typing the box via the Act
  // popout sets this; it is merged onto the caller's `initialPatch`.
  const [typePatch, setTypePatch] = useState<MoveDraftPatch | null>(null);

  // Act popout visibility — local UI state.
  const [actPopoutVisible, setActPopoutVisible] = useState(false);

  // UX-001.3 — Per-target × per-mode draft registry. The OneBox parks
  // the active composer body into the registry before re-typing the box
  // so switching Reply → Add Evidence → Reply restores the Reply body.
  // The registry is reset whenever `debate.id` changes (cross-room
  // navigation zeroes drafts per the brief's intra-session rule).
  const draftRegistry = useComposerDraftRegistry(debate.id);
  const { state: appSession } = useAppSession();
  // The current target key — root-claim sentinel when no parent, else
  // the parent argument id.
  const currentTargetKey = useMemo(
    () => deriveTargetKey(parentArgument?.id ?? null),
    [parentArgument?.id],
  );

  // UX-001.3 — Compact target strip expanded state. Default collapsed.
  const [contextStripExpanded, setContextStripExpanded] = useState(false);

  const schema = useMemo(
    () => renderSchema(boxState.type, boxState.target),
    [boxState.type, boxState.target],
  );

  // Merge the flash-menu-derived patch onto the caller's initial patch.
  // A new object is produced exactly when either input changes, so the
  // composer (which applies an `initialPatch` only on reference change)
  // picks up a re-type without re-applying on every render.
  const composerInitialPatch = useMemo<MoveDraftPatch | null>(() => {
    if (typePatch === null) return initialPatch ?? null;
    return { ...(initialPatch ?? {}), ...typePatch };
  }, [initialPatch, typePatch]);

  /**
   * Handle a `box_opening` flash-menu entry — re-type the box and seed the
   * composer. QOL-031's `ActPopout` dispatches the entry by kind and only
   * calls this for a box-opening entry (it carries a non-null `BoxType`).
   *
   * UX-001.3 wiring: BEFORE re-typing the box, snapshot the CURRENT
   * (targetKey, oldBoxType) draft body from session into the registry
   * so it survives the switch. AFTER re-typing, read the destination
   * (targetKey, newBoxType) draft from the registry; when non-empty,
   * seed the composer via `initialPatch.body` so the parked body is
   * restored. Brief §"mode-switching contract": "switching from Reply
   * to Add Evidence preserves the Reply draft; switching back restores
   * it."
   */
  const handleSelectBoxType = useCallback(
    (entryId: ActEntryId, opensBoxType: BoxType) => {
      // 1. Park the active composer body under (currentTargetKey, prevBoxType).
      //    The session's activeDraft carries the body the user has typed.
      //    Park even an empty body — that keeps the buffer consistent.
      const prevBoxType = boxState.type;
      const session = appSession.snapshot.activeDraft;
      if (session && session.debateId === debate.id) {
        draftRegistry.writeDraft(currentTargetKey, prevBoxType, {
          body: session.body ?? '',
          listItems: Object.freeze([]),
          fields: Object.freeze({}),
        });
      }

      // 2. Re-type the box (non-destructive — boxModel parks the buffers).
      setBoxState((prev) => switchBoxType(prev, opensBoxType));

      // 3. Compute the destination's seeded patch. Start from the
      //    quickActionPresets-derived patch (existing path); if the
      //    registry has a parked body for the destination mode, OVERRIDE
      //    the patch body so the user's previous draft is restored.
      const quickAction = actEntryToQuickAction(entryId);
      const basePatch =
        quickAction === null
          ? null
          : quickActionToPreset(
              quickAction as QuickActionLabel,
              parentArgument?.argumentType ?? null,
            );
      const parked = draftRegistry.readDraft(currentTargetKey, opensBoxType);
      let nextPatch: MoveDraftPatch | null = basePatch;
      if (parked && parked.body && parked.body.length > 0) {
        nextPatch = { ...(basePatch ?? {}), body: parked.body };
      } else if (parked && parked.body === '' && basePatch?.body === undefined) {
        // The destination mode has been parked with an EMPTY body and
        // the preset does not seed a body either. We want the composer
        // to display an empty body (not retain whatever the previous
        // mode left in session). Send an explicit empty-body patch.
        nextPatch = { ...(basePatch ?? {}), body: '' };
      }
      setTypePatch(nextPatch);
    },
    [
      boxState.type,
      appSession.snapshot.activeDraft,
      debate.id,
      draftRegistry,
      currentTargetKey,
      parentArgument,
    ],
  );

  /**
   * Handle a `direct` flash-menu entry (Flag, Make-private, …). These
   * route through the SHIPPED Edge Functions / RLS — the OneBox is a
   * composer host and owns no moderation surface, so within this host the
   * direct entries close the popout without re-typing the box. The room
   * shell wires their full behaviour; QOL-031's `ActPopout` keeps the
   * dispatch surface so a later host can act on it without a chassis edit.
   */
  const handleDirectAction = useCallback((_entryId: ActEntryId) => {
    // No box re-type; `ActPopout` already closes the popout.
  }, []);

  /**
   * Handle a `role_change` flash-menu entry (Watch / Join For / Join
   * Against / Chime in). A seat change is a room-shell concern; within the
   * composer host there is no seat to change, so this is a no-op. QOL-031
   * keeps the dispatch surface for the room shell.
   */
  const handleRoleChange = useCallback((_entryId: ActEntryId) => {
    // No-op in the composer host — the room shell owns seat changes.
  }, []);

  const openActPopout = useCallback(() => setActPopoutVisible(true), []);
  const closeActPopout = useCallback(() => setActPopoutVisible(false), []);

  // UX-001.3 — One-shot "open the mode switcher" trigger. The dock
  // increments `openModeSwitcherSignal` when the user presses
  // Cmd/Ctrl+K with the composer focused. We open the ActPopout
  // exactly once per signal change.
  const lastOpenModeSwitcherSignalRef = useRef<number>(openModeSwitcherSignal ?? 0);
  useEffect(() => {
    const signal = openModeSwitcherSignal ?? 0;
    if (signal === 0 || signal === lastOpenModeSwitcherSignalRef.current) return;
    lastOpenModeSwitcherSignalRef.current = signal;
    setActPopoutVisible(true);
  }, [openModeSwitcherSignal]);

  return (
    <View style={styles.box} testID="one-box">
      {/* ── Box header — type chip (flash-menu trigger) + target ── */}
      <View style={styles.header}>
        <Pressable
          onPress={openActPopout}
          accessibilityRole="button"
          accessibilityLabel={`Move type: ${BOX_TYPE_LABEL[boxState.type]}. Change move type.`}
          accessibilityHint="Opens the action menu to switch what this box composes."
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.typeChip}
          testID="one-box-type-chip"
        >
          <Text style={styles.typeChipLabel}>{BOX_TYPE_LABEL[boxState.type]}</Text>
          {/* `▾` is a text affordance for "open the menu" — not color. */}
          <Text style={styles.typeChipCaret} accessibilityElementsHidden importantForAccessibility="no">
            {' ▾'}
          </Text>
        </Pressable>

        {parentArgument ? (
          <Text style={styles.targetHint} numberOfLines={1} testID="one-box-target-hint">
            on this move
          </Text>
        ) : (
          <Text style={styles.targetHint} numberOfLines={1} testID="one-box-target-hint">
            new room
          </Text>
        )}
      </View>

      {/* UX-001.3 — Always-visible compact target strip. Replaces the
          OneBox header's tiny `targetHint` semantically: this is the
          single source of "what is this composer acting on?" content. */}
      <ComposerContextStrip
        boxType={boxState.type}
        parentArgument={parentArgument}
        resolution={debate.resolution ?? null}
        activeMessageId={activeMessageId ?? null}
        expanded={contextStripExpanded}
        onToggleExpanded={() => setContextStripExpanded((v) => !v)}
      />

      {/* ── Schema-kind notice — previews which schema renders ──
          The v1 body is the free-body composer for every type; this line
          tells the user when a richer schema is coming (QOL-036/037/041). */}
      <Text style={styles.schemaNotice} testID="one-box-schema-notice">
        {SCHEMA_KIND_NOTICE[schema.kind]}
      </Text>

      {/* ── Box body — the SHIPPED composer (submit-argument path) ──
          QOL-030 does not re-author the post flow. The composer keeps its
          own draft, validation, and `submit-argument` call. */}
      <View style={styles.body}>
        <ArgumentComposer
          mode="dock"
          debate={debate}
          selectedParentId={selectedParentId}
          parentArgument={parentArgument}
          onClearParent={onClearParent}
          onSubmitSuccess={onSubmitSuccess}
          onClose={onClose}
          initialPatch={composerInitialPatch}
          onBeforeSubmit={onBeforeSubmit}
          postSignal={postSignal}
        />
      </View>

      {/* ── Act popout — the flash menu (QOL-031) on the QOL-030 chassis.
          `ActPopout` consumes the 3-gate `buildActPopout` model and renders
          it through the shipped Popout / PopoutGroup / PopoutEntry chassis.
          A node target uses the parent's type for the engine gate; a
          root-claim context (no parent) is a `room` target. */}
      <ActPopout
        visible={actPopoutVisible}
        onClose={closeActPopout}
        targetKind={parentArgument ? 'node' : 'room'}
        role={viewerRole ?? 'participant_other'}
        stage={stageContext ?? null}
        parentType={parentArgument?.argumentType ?? null}
        rules={rules}
        onSelectBoxType={handleSelectBoxType}
        onDirectAction={handleDirectAction}
        onRoleChange={handleRoleChange}
        reduceMotionOverride={reduceMotionOverride}
        testID="one-box-act-popout"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
    gap: SPACING.s,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  typeChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  typeChipCaret: {
    fontSize: 14,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  targetHint: {
    flex: 1,
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
  },
  schemaNotice: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xs,
  },
  body: {
    flex: 1,
  },
});
