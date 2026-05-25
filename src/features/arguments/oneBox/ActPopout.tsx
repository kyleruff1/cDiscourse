/**
 * QOL-031 — ActPopout: the Act popout (the "flash menu").
 *
 * The universal contextual action menu — "what can I do here." It is the
 * RENDER LAYER for QOL-030's `buildActPopout` 3-gate pure function: the Act
 * popout is that function's output rendered through the shipped QOL-030
 * chassis (`Popout` / `PopoutGroup` / `PopoutEntry`), beside Inspect
 * (QOL-032) and Go (QOL-033).
 *
 * QOL-031 is the RENDERING of `buildActPopout` — NOT the model. The 3-gate
 * content model (engine ∩ role ∩ stage), the entry catalogue, the
 * convergence of SC-001 / SC-004 / RULE-005, and the §3.4 promotion table
 * all already ship in `actPopoutModel.ts`. This component consumes that
 * output unchanged and asserts the RENDER contract (QOL-031 design §9):
 *
 *  - The group order is fixed — `Respond · Evidence · Resolve · Structure ·
 *    Direct · Participation` — exactly as `buildActPopout` emits it.
 *  - The §3.4 stage-promoted entry is visually EMPHASIZED (the chassis
 *    `isPromoted` styling — a raised surface + heavier text + a ★ marker).
 *  - A contextually-unavailable entry is rendered DISABLED WITH A ONE-LINE
 *    REASON — never silently omitted (design §3.3 / §7 / §8). The engine +
 *    role gates REMOVE invalid / forbidden entries inside the model; this
 *    render layer additionally shows a model-surviving-but-host-blocked
 *    entry disabled, with the reason the host supplies (the §7 wireframe's
 *    "Flag — disabled: can't flag your own" is the canonical case).
 *
 * Anchoring (QOL-031 design §3.1): the Act popout anchors to its target —
 * a node, an evidence object, a concession set, a branch stub, the room
 * title strip, or the minimized box dock for a new room. The chassis
 * `Popout` is the anchored container; this component supplies the content.
 * It opens fast (the chassis' 140 ms flash, inside the design's 120-160 ms
 * band; reduce-motion instant) and dismisses on `Esc`, scrim tap, or entry
 * selection — all provided by the chassis.
 *
 * Three entry kinds (QOL-031 design §3.2 / §4):
 *  - `box_opening`  — sets the box `(type, target)` and opens the OneBox.
 *  - `direct`       — acts immediately; no box opens (Flag, Make-private,
 *    governance — they go through EXISTING Edge Functions / RLS; this
 *    component never writes).
 *  - `role_change`  — changes the viewer's seat, then re-opens the Act
 *    popout (Watch / Join For / Join Against / Chime in).
 *
 * Doctrine / accessibility (QOL-031 design §10, cdiscourse-doctrine,
 * timeline-grammar, accessibility-targets):
 *  - The stage gate ONLY orders — it never removes a valid entry. That is
 *    the model's job (`applyStageGate`); this component renders the result
 *    and emphasizes the promoted entry, nothing more.
 *  - A disabled entry ALWAYS shows why — no silent omission.
 *  - Deterministic pure projection — this component performs NO write, NO
 *    network, NO AI call. The direct entries that mutate (Flag,
 *    Make-private, governance) fire host callbacks that route through the
 *    shipped Edge Functions / RLS; this component imports no Supabase, no
 *    `fetch`, no router.
 *  - No verdict / winner / loser / true / false copy — every label comes
 *    from `actPopoutModel`, which is ban-list scanned.
 *  - The chassis enforces the focus trap, the ≥ 44×44 tap targets, and the
 *    `Esc` dismiss; this component does not weaken any of them.
 *
 * Presentational only — the pure logic is `actPopoutModel.ts`.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SURFACE_TOKENS, SPACING } from '../../../lib/designTokens';
import type { BoxType } from './boxModel';
import { Popout } from './Popout';
import { PopoutGroup, type PopoutGroupEntry } from './PopoutGroup';
import {
  buildActPopout,
  type ActEntryId,
  type ActEntryKind,
  type ActPopoutGroup,
  type ActTargetKind,
  type ActViewerRole,
} from './actPopoutModel';
import type { ArgumentType, ConstitutionRule } from '../../../domain/constitution/types';
import type { PointLifecycleState } from '../../lifecycle';

// ── Entry-kind → chassis kind ──────────────────────────────────

/**
 * Map an `ActEntryKind` onto the chassis `PopoutEntryKind`. The three Act
 * entry kinds map 1:1 onto three chassis kinds — `box_opening` opens the
 * OneBox, `direct` fires an immediate action, `role_change` changes the
 * viewer's seat. The chassis kind drives the leading glyph (a compose
 * pencil / a bullet / a swap glyph) so the kind reads without color.
 */
export function actEntryKindToChassisKind(kind: ActEntryKind): PopoutGroupEntry['kind'] {
  switch (kind) {
    case 'box_opening':
      return 'box-opening';
    case 'role_change':
      return 'role-change';
    case 'direct':
      return 'direct';
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = kind;
      return never;
    }
  }
}

// ── Disabled-entry contract ────────────────────────────────────

/**
 * A host-supplied map of entries to render DISABLED, with the one-line
 * reason to show under each. The engine + role gates inside `buildActPopout`
 * already REMOVE invalid / forbidden entries; this map is for the narrower
 * case the design §3.3 / §7 / §8 calls out — an entry the model produced
 * but the live context makes unavailable (e.g. Flag on a move you can act
 * on but should not flag, governance with the primary seat open). A
 * disabled entry stays VISIBLE with its reason — never a silent omission.
 */
export type ActDisabledEntries = Partial<Record<ActEntryId, string>>;

// ── Render projection (pure — unit-testable without a renderer) ─

/**
 * A render group ready for the chassis — a `PopoutGroup`'s data shape with
 * a stable group `id` + `label`. The render-time `PopoutGroupEntry` rows
 * keep `isPromoted` / `isDisabled` / `disabledReason` resolved.
 */
export interface ActRenderGroup {
  /** Stable group id — the `ActGroupId` from the model. */
  id: ActPopoutGroup['id'];
  /** Plain-language group heading. */
  label: string;
  /** The chassis-ready rows. `onPress` is set by the component, not here. */
  entries: ReadonlyArray<Omit<PopoutGroupEntry, 'onPress'>>;
}

/**
 * Projects the 3-gate `buildActPopout` groups onto the chassis render
 * shape — the load-bearing QOL-031 render decision, extracted as a PURE
 * function so the repo's `.tsx` UI-test discipline can exercise it without
 * a renderer (mirrors the chassis' `buildPopoutEntryAccessibilityLabel`).
 *
 * Three render rules (QOL-031 design §3.3 / §9):
 *  1. **Group order is fixed** — the groups are returned in the exact order
 *     `buildActPopout` emits them (`ACT_GROUP_ORDER`); this function never
 *     reorders.
 *  2. **The promoted entry is emphasized** — the model's single §3.4
 *     stage-promoted entry keeps `isPromoted: true` so the chassis renders
 *     the raised surface + heavier text + ★ marker. A promoted entry that
 *     is ALSO host-disabled drops the promotion (a disabled row cannot be
 *     a suggested move).
 *  3. **A disabled entry stays visible with a reason** — an entry whose id
 *     is a key in `disabledEntries` renders with `isDisabled: true` and the
 *     supplied one-line `disabledReason`; it is NEVER omitted.
 *
 * Pure. Deterministic. No React, no side effects.
 */
export function buildActRenderGroups(
  groups: ReadonlyArray<ActPopoutGroup>,
  disabledEntries?: ActDisabledEntries,
): ActRenderGroup[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    entries: group.entries.map((entry) => {
      const disabledReason = disabledEntries?.[entry.id];
      const isDisabled = typeof disabledReason === 'string';
      return {
        key: entry.id,
        label: entry.label,
        accessibilityLabel: entry.accessibilityLabel,
        kind: actEntryKindToChassisKind(entry.kind),
        // A disabled entry is never also promoted — a promoted entry is a
        // suggested move; a disabled one cannot be invoked (§9).
        isPromoted: entry.isPromoted && !isDisabled,
        isDisabled,
        disabledReason: disabledReason ?? null,
      };
    }),
  }));
}

// ── Props ──────────────────────────────────────────────────────

export interface ActPopoutProps {
  /** Drives mount + the flash animation (the chassis owns the animation). */
  visible: boolean;
  /** Close the Act popout — bound to the close control, scrim, Esc, back. */
  onClose: () => void;
  /**
   * The kind of target the flash menu is computed for (QOL-031 design §3.1
   * anchoring table) — a node, the room, a concession set, an evidence
   * object, or a branch stub.
   */
  targetKind: ActTargetKind;
  /**
   * The viewer's role relative to the target — the hard role gate. Drives
   * which entries `buildActPopout` keeps (observer → participation only;
   * own-bubble → qualifiers + request-deletion only).
   */
  role: ActViewerRole;
  /**
   * The target node's LIFE-001 stage — the soft stage gate. `null` for a
   * non-node target, or when LIFE-001 is unavailable (the design §8
   * degraded fallback). Drives which entry is promoted.
   */
  stage: PointLifecycleState | null;
  /**
   * The parent argument's Constitution type — the hard engine gate. `null`
   * for a root-claim context (no parent).
   */
  parentType: ArgumentType | null;
  /** The active Constitution rules — the engine gate's transition table. */
  rules: ReadonlyArray<ConstitutionRule>;
  /**
   * Entries to render disabled-with-reason (design §3.3 / §7 / §8). A
   * model-surviving entry whose id is a key here renders disabled; the
   * value is the one-line plain-language reason shown under the row.
   * Optional — omit it and every produced entry renders enabled.
   */
  disabledEntries?: ActDisabledEntries;
  /**
   * Fired for a `box_opening` entry — the host re-types the OneBox to
   * `opensBoxType` and seeds the composer. Never fired for a disabled row.
   */
  onSelectBoxType: (entryId: ActEntryId, boxType: BoxType) => void;
  /**
   * Fired for a `direct` entry — the host performs the action (Flag,
   * Make-private, …) through the SHIPPED Edge Functions / RLS. This
   * component never writes. Never fired for a disabled row.
   */
  onDirectAction: (entryId: ActEntryId) => void;
  /**
   * Fired for a `role_change` entry — the host changes the viewer's seat,
   * then re-opens the Act popout (QOL-031 design §3.2 "changes the viewer's
   * seat, then re-opens the Act popout"). Never fired for a disabled row.
   */
  onRoleChange: (entryId: ActEntryId) => void;
  /** PR-001 effective reduce-motion — threaded into the chassis. */
  reduceMotionOverride?: boolean;
  /**
   * UX-001.4 — the "Acting on:" header line shown above the first
   * group. Plain English, derived by the host from
   * `composerActingOnModel.deriveComposerActingOnLabel`. When `null` /
   * absent (e.g. `targetKind === 'room'`, no node selected) no header
   * row renders — preserves the existing behavior for callers that do
   * not supply the prop. The header is `<Text>` (not interactive).
   */
  actingOnLabel?: string | null;
  /**
   * UX-001.4 — chassis-level maxHeight override (logical px). Threaded
   * straight to the `Popout` chassis. Optional; when omitted, the
   * chassis default ('72%') applies.
   */
  maxHeightOverride?: number;
  /**
   * UX-001.4 — chassis-level fixed-width override (logical px). For
   * tablet landscape / wide variants where the menu is `panel_anchored`
   * or `panel_side`. Threaded straight to the `Popout` chassis.
   */
  panelWidthOverride?: number | null;
  /** testID passthrough for the popout root. */
  testID?: string;
}

// ── Component ──────────────────────────────────────────────────

/**
 * The Act popout — the flash menu. The 3-gate `buildActPopout` groups
 * rendered through the QOL-030 chassis. Group order is fixed by the model;
 * the stage-promoted entry is emphasized; a host-disabled entry shows its
 * reason and is never omitted.
 */
export function ActPopout({
  visible,
  onClose,
  targetKind,
  role,
  stage,
  parentType,
  rules,
  disabledEntries,
  onSelectBoxType,
  onDirectAction,
  onRoleChange,
  reduceMotionOverride,
  actingOnLabel,
  maxHeightOverride,
  panelWidthOverride,
  testID,
}: ActPopoutProps) {
  // The 3-gate flash-menu content. QOL-031 CONSUMES `buildActPopout` — it
  // re-derives nothing. The engine + role gates filter; the stage gate
  // orders + promotes. The component renders exactly this output.
  const actGroups: ActPopoutGroup[] = useMemo(
    () => buildActPopout({ targetKind, role, stage, parentType, rules }),
    [targetKind, role, stage, parentType, rules],
  );

  /**
   * Dispatch a flash-menu entry selection to the right host callback by
   * entry kind, then dismiss the popout (QOL-031 design §3.1 "dismisses on
   * … entry selection"). A disabled entry never reaches here — the chassis
   * `PopoutEntry` blocks a disabled row's press.
   *
   * A `role_change` entry does NOT close the popout here — the design §3.2
   * is explicit that a seat change "re-opens the Act popout". The host
   * performs the seat change and re-opens; closing-then-reopening is the
   * host's call, so this dispatch leaves the popout to the host for role
   * changes and closes it for box-opening + direct entries.
   */
  const handleEntry = useCallback(
    (entryId: ActEntryId, kind: ActEntryKind, opensBoxType: BoxType | null) => {
      switch (kind) {
        case 'box_opening': {
          // A box-opening entry always carries a BoxType in the model.
          if (opensBoxType !== null) {
            onSelectBoxType(entryId, opensBoxType);
          }
          onClose();
          return;
        }
        case 'direct': {
          onDirectAction(entryId);
          onClose();
          return;
        }
        case 'role_change': {
          // The host changes the seat and re-opens the Act popout (§3.2).
          onRoleChange(entryId);
          return;
        }
        default: {
          // Exhaustiveness guard — unreachable for the typed union.
          const never: never = kind;
          return never;
        }
      }
    },
    [onClose, onDirectAction, onRoleChange, onSelectBoxType],
  );

  // Project the 3-gate model groups onto the chassis render shape via the
  // pure `buildActRenderGroups` helper — fixed group order, the §3.4
  // promoted entry emphasized, host-disabled entries kept visible with a
  // reason. The `onPress` handler (which closes over `entry.kind` +
  // `entry.opensBoxType`) is attached here from the model entry, keyed by
  // id so the render row and the model entry stay aligned.
  const renderGroups = useMemo(
    () => buildActRenderGroups(actGroups, disabledEntries),
    [actGroups, disabledEntries],
  );

  // The model entry for each id — the `onPress` dispatch needs the entry's
  // `kind` + `opensBoxType`, which the render projection deliberately drops.
  const entryById = useMemo(() => {
    const map = new Map<ActEntryId, { kind: ActEntryKind; opensBoxType: BoxType | null }>();
    for (const group of actGroups) {
      for (const entry of group.entries) {
        map.set(entry.id, { kind: entry.kind, opensBoxType: entry.opensBoxType });
      }
    }
    return map;
  }, [actGroups]);

  const popoutGroups = useMemo(
    () =>
      renderGroups.map((group) => ({
        id: group.id,
        label: group.label,
        entries: group.entries.map<PopoutGroupEntry>((entry) => {
          const entryId = entry.key as ActEntryId;
          const model = entryById.get(entryId);
          return {
            ...entry,
            onPress: () => {
              if (model) handleEntry(entryId, model.kind, model.opensBoxType);
            },
          };
        }),
      })),
    [renderGroups, entryById, handleEntry],
  );

  // A single group reads as a flat list (no header); two or more groups
  // get section headers — mirrors `OneBox`'s prior inline behaviour and
  // the `PopoutGroup` `showHeader` contract.
  const showGroupHeaders = popoutGroups.length >= 2;

  return (
    <Popout
      visible={visible}
      title="Act"
      onClose={onClose}
      reduceMotionOverride={reduceMotionOverride}
      maxHeightOverride={maxHeightOverride}
      panelWidthOverride={panelWidthOverride}
      testID={testID ?? 'one-box-act-popout'}
    >
      {/* UX-001.4 — "Acting on:" header line. Renders only when the
          host supplies the label. Plain English, derived from
          composerActingOnModel.deriveComposerActingOnLabel so the Act
          menu and the composer's compact target strip never drift. */}
      {actingOnLabel ? (
        <Text style={styles.actingOnHeader} testID="act-popout-acting-on">
          Acting on: {actingOnLabel}
        </Text>
      ) : null}
      {popoutGroups.length === 0 ? (
        // The design §8 edge case — the engine + role gates left zero
        // entries (a locked / archived node, an observer with no rights).
        // The popout stays a coherent surface with a one-line note; the
        // box never opens.
        <Text style={styles.emptyNote} testID="one-box-act-popout-empty">
          No actions are available here yet.
        </Text>
      ) : (
        popoutGroups.map((group) => (
          <PopoutGroup
            key={group.id}
            label={group.label}
            entries={group.entries}
            showHeader={showGroupHeaders}
            testID={`act-popout-group-${group.id}`}
          />
        ))
      )}
    </Popout>
  );
}

const styles = StyleSheet.create({
  emptyNote: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    padding: SPACING.l,
  },
  // UX-001.4 — "Acting on:" header line above the first entry group.
  // Plain text, non-interactive, hidden from the entry list's focus
  // traversal. Subtle visual treatment (small caps, secondary color) so
  // it doesn't compete with the entry rows.
  actingOnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.xs,
    letterSpacing: 0.4,
  },
});
