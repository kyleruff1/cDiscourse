/**
 * QOL-030 — Act popout content model (the flash menu, pure TypeScript).
 *
 * `buildActPopout(input)` is THE 3-gate pure function (QOL-030 design
 * §3.3 / §6.3). For a selected target it produces the grouped flash-menu
 * entries by applying three gates IN ORDER:
 *
 *   1. **Engine gate (hard)** — `engine.ts` transition table: entries
 *      whose argument type is an INVALID child of the parent are REMOVED.
 *   2. **Role gate (hard)** — observer / participant / own-bubble:
 *      disallowed entries are REMOVED. Own-bubble keeps ONLY qualifiers +
 *      request-deletion.
 *   3. **Stage gate (soft)** — the LIFE-001 stage: the §3.4 fitting action
 *      is PROMOTED to the top and emphasized; every other valid entry is
 *      KEPT, ordered lower. **The stage gate NEVER removes a valid move.**
 *
 * This split is doctrine-critical (design §3.3 / §10): engine + role
 * *filter*; stage only *suggests*. The system never blocks a move because
 * of a stage. A named test (`actPopoutModel.test.ts` "stage only
 * re-orders, never removes") proves this.
 *
 * Doctrine anchor:
 *   - The flash menu can only ever offer engine-valid + role-permitted
 *     moves. No AI. No network. No `Date.now()`.
 *   - No entry labels a person or claims a verdict; the menu describes a
 *     *move*, never its correctness (cdiscourse-doctrine §1 / §4).
 *   - Heat / popularity / strength bands are NEVER read.
 *   - This module never imports `supabase`, `fetch`, any router, or React.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { ArgumentType, ConstitutionRule } from '../../../domain/constitution/types';
import { getAllowedReplies } from '../../../domain/constitution/allowedTransitions';
import type { PointLifecycleState } from '../../lifecycle';
import type { BoxType } from './boxModel';

// ── Entry vocabulary ───────────────────────────────────────────

/**
 * The kind of a flash-menu entry (QOL-030 design §6.3). Direct and
 * role-change entries are first-class entry kinds beside box-opening
 * entries (design §4 findings F6 / F7).
 *
 *  - `box_opening` — selecting it sets a `BoxType` and opens the box.
 *  - `direct`      — a direct action; NO box opens (governance reactions,
 *    make-private, Touché, fist-bump — findings F6 / F7 / F10 / F12).
 *  - `role_change` — a participation change (Watch / Join / Chime in —
 *    finding F5).
 */
export type ActEntryKind = 'box_opening' | 'direct' | 'role_change';

/**
 * The group an entry belongs to (QOL-030 design §6.3 step 5):
 * `Respond · Evidence · Resolve · Structure · Direct · Role`.
 */
export type ActGroupId = 'respond' | 'evidence' | 'resolve' | 'structure' | 'direct' | 'role';

/** Frozen, ordered list of every group. The popout renders in this order. */
export const ACT_GROUP_ORDER: ReadonlyArray<ActGroupId> = Object.freeze([
  'respond',
  'evidence',
  'resolve',
  'structure',
  'direct',
  'role',
]);

/** Plain-language group headings. No verdict vocabulary. */
export const ACT_GROUP_LABEL: Readonly<Record<ActGroupId, string>> = Object.freeze({
  respond: 'Respond',
  evidence: 'Evidence',
  resolve: 'Resolve',
  structure: 'Structure',
  direct: 'Direct',
  role: 'Participation',
});

/**
 * The viewer's role relative to the selected target (QOL-030 design §3.3
 * step 2). `observer` and `own_bubble` are the two hard-gated roles;
 * `participant_other` is the full participant set on someone else's move.
 */
export type ActViewerRole = 'observer' | 'participant_other' | 'own_bubble';

/** Frozen array of every viewer role. */
export const ALL_ACT_VIEWER_ROLES: ReadonlyArray<ActViewerRole> = Object.freeze([
  'observer',
  'participant_other',
  'own_bubble',
]);

/** The target kind a flash menu is computed for (QOL-030 design §6.3). */
export type ActTargetKind = 'node' | 'room' | 'concessionSet' | 'evidenceObject' | 'branch';

// ── Entry definitions ──────────────────────────────────────────

/**
 * A stable identifier for every candidate flash-menu entry. Box-opening
 * ids map 1:1 onto a `BoxType`; direct / role ids are their own actions.
 */
export type ActEntryId =
  // Respond group (box-opening entry points into the `respond` box +
  // dedicated types).
  | 'reply'
  | 'challenge'
  | 'clarify'
  // Evidence group.
  | 'add_evidence'
  | 'ask_source'
  | 'ask_quote'
  | 'respond_to_evidence'
  // Resolve group.
  | 'narrow'
  | 'concede'
  | 'confirm'
  | 'synthesize'
  | 'respond_to_concession'
  // UX-001.3 — Author-side standalone Concession list entry (the brief's
  // 13th canonical mode). Routes to the new `offer_concession` box.
  | 'offer_concession'
  // Structure group.
  | 'branch_tangent'
  // Direct group (no box).
  | 'make_private'
  | 'flag'
  | 'request_deletion'
  | 'view_qualifiers'
  // Role group.
  | 'watch'
  | 'join_for'
  | 'join_against'
  | 'chime_in';

/**
 * A static candidate-entry definition. The `argumentType` is the
 * Constitution argument type the entry's resulting move produces — the
 * ENGINE GATE keys off this. `null` means the entry produces no
 * Constitution argument type (direct / role entries, plus structural
 * entries like `branch_tangent`) and is therefore NEVER engine-filtered.
 */
interface ActEntryDefinition {
  id: ActEntryId;
  kind: ActEntryKind;
  group: ActGroupId;
  /** Plain-language label. ≤ 24 chars. READ here — no snake_case leak. */
  label: string;
  /** Verbose accessibility label. ≤ 80 chars. */
  accessibilityLabel: string;
  /** The `BoxType` this entry opens. Present only for `box_opening` kinds. */
  opensBoxType: BoxType | null;
  /**
   * The Constitution argument type the resulting move produces. The
   * engine gate filters on this. `null` = exempt from the engine gate.
   */
  argumentType: ArgumentType | null;
}

/**
 * The full candidate-entry table. `buildActPopout` enumerates the subset
 * relevant to the target kind, then runs the three gates over it.
 *
 * Doctrine: every label / accessibilityLabel is plain English, carries no
 * verdict / amplification / person-attribution token, and is scanned by
 * `__tests__/oneBoxCopyBanList.test.ts`.
 */
const ACT_ENTRY_DEFINITIONS: Readonly<Record<ActEntryId, ActEntryDefinition>> = Object.freeze({
  // ── Respond group ──
  reply: Object.freeze({
    id: 'reply',
    kind: 'box_opening',
    group: 'respond',
    label: 'Reply',
    accessibilityLabel: 'Reply to this move',
    opensBoxType: 'respond',
    // A reply is a claim child.
    argumentType: 'claim',
  }),
  challenge: Object.freeze({
    id: 'challenge',
    kind: 'box_opening',
    group: 'respond',
    label: 'Challenge',
    accessibilityLabel: 'Challenge this move',
    opensBoxType: 'respond',
    // Base type — a challenge is a rebuttal child. counter_rebuttal-vs-
    // rebuttal is resolved by the room shell when the box posts; the
    // engine gate accepts the entry if EITHER is a valid child.
    argumentType: 'rebuttal',
  }),
  clarify: Object.freeze({
    id: 'clarify',
    kind: 'box_opening',
    group: 'respond',
    label: 'Clarify',
    accessibilityLabel: 'Ask for a clarification',
    opensBoxType: 'clarify',
    argumentType: 'clarification_request',
  }),
  // ── Evidence group ──
  add_evidence: Object.freeze({
    id: 'add_evidence',
    kind: 'box_opening',
    group: 'evidence',
    label: 'Add evidence',
    accessibilityLabel: 'Attach a piece of evidence',
    opensBoxType: 'add_evidence',
    argumentType: 'evidence',
  }),
  ask_source: Object.freeze({
    id: 'ask_source',
    kind: 'box_opening',
    group: 'evidence',
    label: 'Ask for a source',
    accessibilityLabel: 'Ask the speaker for a primary source',
    opensBoxType: 'ask_source',
    argumentType: 'clarification_request',
  }),
  ask_quote: Object.freeze({
    id: 'ask_quote',
    kind: 'box_opening',
    group: 'evidence',
    label: 'Ask for a quote',
    accessibilityLabel: 'Ask the speaker to quote the exact passage',
    opensBoxType: 'ask_quote',
    argumentType: 'clarification_request',
  }),
  respond_to_evidence: Object.freeze({
    id: 'respond_to_evidence',
    kind: 'box_opening',
    group: 'evidence',
    label: 'Respond to evidence',
    accessibilityLabel: 'Respond to this piece of evidence',
    opensBoxType: 'respond_to_evidence',
    // Responding to an evidence object produces a rebuttal-shaped move.
    argumentType: 'rebuttal',
  }),
  // ── Resolve group ──
  narrow: Object.freeze({
    id: 'narrow',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Narrow the claim',
    accessibilityLabel: 'Narrow the scope of this point',
    opensBoxType: 'narrow',
    argumentType: 'concession',
  }),
  concede: Object.freeze({
    id: 'concede',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Concede a point',
    accessibilityLabel: 'Concede a point on this move',
    opensBoxType: 'respond',
    argumentType: 'concession',
  }),
  confirm: Object.freeze({
    id: 'confirm',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Confirm',
    accessibilityLabel: 'Confirm the repaired claim',
    opensBoxType: 'confirm',
    // `confirm` keeps the user's current type — no forced Constitution
    // type, so it is exempt from the engine gate.
    argumentType: null,
  }),
  synthesize: Object.freeze({
    id: 'synthesize',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Synthesize',
    accessibilityLabel: 'Summarise where this cluster landed',
    opensBoxType: 'synthesize',
    argumentType: 'synthesis',
  }),
  respond_to_concession: Object.freeze({
    id: 'respond_to_concession',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Respond to concession',
    accessibilityLabel: 'Respond to this concession set',
    opensBoxType: 'respond_to_concession',
    // Targets a concession set, not a node — exempt from the engine gate
    // (the engine gate is node-parent scoped).
    argumentType: null,
  }),
  // UX-001.3 — Author-side standalone Concession list entry. Routes to
  // the new `offer_concession` box. Produces a `concession` typed move
  // when the box submits — the engine gate accepts `concession` as a
  // valid child for the parent types the existing `concede` ActEntry
  // already covers.
  offer_concession: Object.freeze({
    id: 'offer_concession',
    kind: 'box_opening',
    group: 'resolve',
    label: 'Offer concessions',
    accessibilityLabel: 'Offer a list of concessions to this point',
    opensBoxType: 'offer_concession',
    argumentType: 'concession',
  }),
  // ── Structure group ──
  branch_tangent: Object.freeze({
    id: 'branch_tangent',
    kind: 'box_opening',
    group: 'structure',
    label: 'Open a side issue',
    accessibilityLabel: 'Open a side issue from this point',
    opensBoxType: 'branch_tangent',
    // A branch is a topology operation, not a Constitution argument type
    // — exempt from the engine gate (design §6.2).
    argumentType: null,
  }),
  // ── Direct group (no box) ──
  make_private: Object.freeze({
    id: 'make_private',
    kind: 'direct',
    group: 'direct',
    label: 'Make private',
    accessibilityLabel: 'Make this room private',
    opensBoxType: null,
    argumentType: null,
  }),
  flag: Object.freeze({
    id: 'flag',
    kind: 'direct',
    group: 'direct',
    label: 'Request review',
    accessibilityLabel: 'Open a structured concern about this move',
    opensBoxType: null,
    argumentType: null,
  }),
  request_deletion: Object.freeze({
    id: 'request_deletion',
    kind: 'direct',
    group: 'direct',
    label: 'Request deletion',
    accessibilityLabel: 'Request deletion of your own move',
    opensBoxType: null,
    argumentType: null,
  }),
  view_qualifiers: Object.freeze({
    id: 'view_qualifiers',
    kind: 'direct',
    group: 'direct',
    label: 'Qualifiers',
    accessibilityLabel: 'View the qualifiers on this move',
    opensBoxType: null,
    argumentType: null,
  }),
  // ── Role group ──
  watch: Object.freeze({
    id: 'watch',
    kind: 'role_change',
    group: 'role',
    label: 'Watch',
    accessibilityLabel: 'Watch this conversation as an observer',
    opensBoxType: null,
    argumentType: null,
  }),
  join_for: Object.freeze({
    id: 'join_for',
    kind: 'role_change',
    group: 'role',
    label: 'Join for',
    accessibilityLabel: 'Join this conversation on the affirmative side',
    opensBoxType: null,
    argumentType: null,
  }),
  join_against: Object.freeze({
    id: 'join_against',
    kind: 'role_change',
    group: 'role',
    label: 'Join against',
    accessibilityLabel: 'Join this conversation on the negative side',
    opensBoxType: null,
    argumentType: null,
  }),
  chime_in: Object.freeze({
    id: 'chime_in',
    kind: 'role_change',
    group: 'role',
    label: 'Chime in',
    accessibilityLabel: 'Add a one-off chime-in branch off this point',
    opensBoxType: null,
    argumentType: null,
  }),
});

/** Frozen array of every entry id. Tests iterate this. */
export const ALL_ACT_ENTRY_IDS: ReadonlyArray<ActEntryId> = Object.freeze(
  Object.keys(ACT_ENTRY_DEFINITIONS) as ActEntryId[],
);

// ── Candidate enumeration (gate 0) ─────────────────────────────

/**
 * The candidate entries for each target kind (QOL-030 design §6.3 step 1
 * "enumerate candidate entries for the target kind"). This is the
 * pre-gate enumeration — the three gates then filter / order it.
 */
const CANDIDATES_BY_TARGET_KIND: Readonly<Record<ActTargetKind, ReadonlyArray<ActEntryId>>> =
  Object.freeze({
    // A message node — the full move set.
    node: Object.freeze<ActEntryId[]>([
      'reply',
      'challenge',
      'clarify',
      'add_evidence',
      'ask_source',
      'ask_quote',
      'narrow',
      'concede',
      'offer_concession',
      'confirm',
      'synthesize',
      'branch_tangent',
      'flag',
      'request_deletion',
      'view_qualifiers',
      'watch',
      'join_for',
      'join_against',
      'chime_in',
    ]),
    // The room itself — make-private is room-scoped (finding F7).
    room: Object.freeze<ActEntryId[]>(['make_private']),
    // A concession set (finding F3).
    concessionSet: Object.freeze<ActEntryId[]>([
      'respond_to_concession',
      'synthesize',
      'view_qualifiers',
    ]),
    // An evidence object (finding F3, Scenario 2).
    evidenceObject: Object.freeze<ActEntryId[]>([
      'respond_to_evidence',
      'add_evidence',
      'challenge',
      'view_qualifiers',
    ]),
    // A branch off a node (finding F5).
    branch: Object.freeze<ActEntryId[]>([
      'reply',
      'challenge',
      'clarify',
      'branch_tangent',
      'view_qualifiers',
    ]),
  });

// ── Gate 2 — role gate (hard) ──────────────────────────────────

/**
 * Entry ids an OBSERVER may keep. Per design §8 ("observer with no compose
 * rights — flash menu = Watch / Join / Chime-in only") plus the Stage 6.4
 * rail honouring observer `ask_source` + `flag` + read-only `view_qualifiers`.
 */
const OBSERVER_ALLOWED: ReadonlySet<ActEntryId> = new Set<ActEntryId>([
  'watch',
  'join_for',
  'join_against',
  'chime_in',
  'view_qualifiers',
]);

/**
 * Entry ids an OWN-BUBBLE viewer may keep. Per design §3.3 step 2 + §6.3
 * step 3 ("own-bubble keeps ONLY qualifiers + request-deletion") — and the
 * Stage 6.1.8 own-bubble safety rule (no edit, no disagree, no flag, no
 * score on your own move).
 */
const OWN_BUBBLE_ALLOWED: ReadonlySet<ActEntryId> = new Set<ActEntryId>([
  'view_qualifiers',
  'request_deletion',
]);

/**
 * The role gate. Returns the subset of `ids` the role is permitted to use.
 *
 *  - `observer` — keeps only `OBSERVER_ALLOWED`.
 *  - `own_bubble` — keeps only `OWN_BUBBLE_ALLOWED`.
 *  - `participant_other` — keeps everything EXCEPT `request_deletion`
 *    (deletion is an own-move action) and `make_private` is left for the
 *    room-target enumeration to surface; on a node target a participant
 *    keeps the full participant move set.
 *
 * HARD gate — disallowed entries are REMOVED (design §3.3).
 */
function applyRoleGate(
  ids: ReadonlyArray<ActEntryId>,
  role: ActViewerRole,
): ActEntryId[] {
  if (role === 'observer') {
    return ids.filter((id) => OBSERVER_ALLOWED.has(id));
  }
  if (role === 'own_bubble') {
    return ids.filter((id) => OWN_BUBBLE_ALLOWED.has(id));
  }
  // participant_other — full set minus own-move-only `request_deletion`.
  return ids.filter((id) => id !== 'request_deletion');
}

// ── Gate 1 — engine gate (hard) ────────────────────────────────

/**
 * The engine gate. Removes entries whose `argumentType` is an INVALID
 * child of the parent (QOL-030 design §3.3 step 1). Entries with a `null`
 * `argumentType` (direct / role / structural) are exempt — they produce no
 * Constitution argument type, so the transition table does not apply.
 *
 * `challenge` is a special case: it can post EITHER a `rebuttal` or a
 * `counter_rebuttal` depending on the parent (the room shell resolves
 * which). The entry is kept if EITHER is a valid child.
 *
 * When `parentType` is `null` (a root claim — no parent), there is no
 * transition table to apply: only `null`-`argumentType` entries survive
 * (you cannot reply to a non-existent parent). When `rules` is empty, the
 * transition table is unavailable and `getAllowedReplies` returns `[]` —
 * the engine gate then removes every typed entry, the documented degraded
 * fallback (design §8 "engine says zero valid types").
 *
 * HARD gate — invalid entries are REMOVED (design §3.3 / §10).
 */
function applyEngineGate(
  ids: ReadonlyArray<ActEntryId>,
  parentType: ArgumentType | null,
  rules: ReadonlyArray<ConstitutionRule>,
): ActEntryId[] {
  // No parent → no transition table applies. Only entries that produce no
  // Constitution type survive.
  if (parentType === null) {
    return ids.filter((id) => ACT_ENTRY_DEFINITIONS[id].argumentType === null);
  }
  const allowed = new Set<ArgumentType>(
    getAllowedReplies(parentType, rules as ConstitutionRule[]),
  );
  return ids.filter((id) => {
    const def = ACT_ENTRY_DEFINITIONS[id];
    // Exempt — no Constitution type → the engine gate does not apply.
    if (def.argumentType === null) return true;
    // `challenge` survives if rebuttal OR counter_rebuttal is valid.
    if (id === 'challenge') {
      return allowed.has('rebuttal') || allowed.has('counter_rebuttal');
    }
    return allowed.has(def.argumentType);
  });
}

// ── Gate 3 — stage gate (soft) ─────────────────────────────────

/**
 * The §3.4 soft-gate table — for a node's LIFE-001 stage, which entry is
 * PROMOTED to the top of the flash menu. The stage gate ONLY orders; it
 * never removes (design §3.3 / §3.4 / §10).
 *
 * Keys are the LIFE-001 `PointLifecycleState` union. The value is the
 * entry id to promote. If the promoted entry was removed by the engine or
 * role gate, no promotion happens — order falls back to enumeration order
 * (the stage gate cannot resurrect a filtered move).
 */
const STAGE_PROMOTED_ENTRY: Readonly<Partial<Record<PointLifecycleState, ActEntryId>>> =
  Object.freeze({
    open: 'reply',
    answered: 'reply',
    rebutted: 'reply',
    clarified: 'reply',
    source_requested: 'add_evidence',
    quote_requested: 'add_evidence',
    sourced: 'reply',
    narrowed: 'confirm',
    conceded: 'synthesize',
    confirmed: 'synthesize',
    synthesis_ready: 'synthesize',
    moved_on_by_affirmative: 'branch_tangent',
    moved_on_by_negative: 'branch_tangent',
    ignored_by_affirmative: 'branch_tangent',
    ignored_by_negative: 'branch_tangent',
    ignored_by_both: 'branch_tangent',
    exhausted: 'branch_tangent',
    branch_recommended: 'branch_tangent',
    // `archived_or_resolved` promotes nothing — a resolved node is
    // read-only (design §3.4: "Share · Reference — read-only, no box").
  });

/**
 * Applies the soft stage gate: moves the §3.4 promoted entry (if it
 * survived the hard gates) to slot 0 of its group; every other entry keeps
 * its relative order. Returns a NEW ordered array. NEVER removes an entry
 * (design §3.3).
 *
 * `stage` of `null` (a non-node target, or a node with no lifecycle
 * stage) leaves the order untouched.
 */
function applyStageGate(
  ids: ReadonlyArray<ActEntryId>,
  stage: PointLifecycleState | null,
): { ordered: ActEntryId[]; promoted: ActEntryId | null } {
  if (stage === null) {
    return { ordered: ids.slice(), promoted: null };
  }
  const promoted = STAGE_PROMOTED_ENTRY[stage] ?? null;
  // The promoted entry must have survived the hard gates to be promoted.
  if (promoted === null || !ids.includes(promoted)) {
    return { ordered: ids.slice(), promoted: null };
  }
  // Move the promoted entry to the front; keep every other entry's order.
  const rest = ids.filter((id) => id !== promoted);
  return { ordered: [promoted, ...rest], promoted };
}

// ── Public types — the popout output ───────────────────────────

/** A single rendered flash-menu entry (the chassis `PopoutEntry` consumes this). */
export interface ActPopoutEntry {
  /** Stable entry id. */
  id: ActEntryId;
  /** Entry kind — box-opening / direct / role-change. */
  kind: ActEntryKind;
  /** Plain-language label. */
  label: string;
  /** Verbose accessibility label. */
  accessibilityLabel: string;
  /** The `BoxType` this entry opens — null for direct / role entries. */
  opensBoxType: BoxType | null;
  /** True for the single §3.4 stage-promoted entry. Emphasized in the UI. */
  isPromoted: boolean;
}

/** A labelled group of entries (the chassis `PopoutGroup` consumes this). */
export interface ActPopoutGroup {
  id: ActGroupId;
  /** Plain-language group heading. */
  label: string;
  entries: ReadonlyArray<ActPopoutEntry>;
}

/** Inputs to `buildActPopout` (QOL-030 design §6.3). */
export interface BuildActPopoutInput {
  /** The kind of target the flash menu is computed for. */
  targetKind: ActTargetKind;
  /** The viewer's role relative to the target — the hard role gate. */
  role: ActViewerRole;
  /**
   * The selected node's LIFE-001 stage — the soft stage gate. `null` for a
   * non-node target, or when LIFE-001 is unavailable (design §8 degraded
   * fallback: pass the coarse 3-stage derivation, or `null`).
   */
  stage: PointLifecycleState | null;
  /**
   * The parent argument's Constitution type — the hard engine gate. `null`
   * for a root-claim context (no parent). Only meaningful for `node` /
   * `branch` targets; ignored for `room` (no transition table applies).
   */
  parentType: ArgumentType | null;
  /**
   * The active Constitution rules — the engine gate's transition table
   * source. Pass `useConstitution().activeRules`.
   */
  rules: ReadonlyArray<ConstitutionRule>;
}

// ── buildActPopout — THE 3-gate pure function ──────────────────

/**
 * Builds the Act popout (flash-menu) content for a selected target.
 *
 * The pipeline (QOL-030 design §6.3) — exactly three gates, in order:
 *   0. Enumerate candidate entries for the target kind.
 *   1. ENGINE GATE (hard) — drop entries whose argument type is an invalid
 *      child of the parent.
 *   2. ROLE GATE (hard) — drop entries the role forbids; own-bubble keeps
 *      only qualifiers + request-deletion.
 *   3. STAGE GATE (soft) — promote the §3.4 fitting entry to the top;
 *      keep every other entry, ordered lower. NEVER removes.
 *   4. Group into `Respond · Evidence · Resolve · Structure · Direct ·
 *      Role`, preserving the post-gate order within each group.
 *
 * Pure. Deterministic. Idempotent. No AI, no network, no `Date.now()`.
 *
 * Doctrine: gates 1 + 2 FILTER; gate 3 only SUGGESTS. The stage can never
 * block a move (design §3.3 / §10). When the engine + role gates leave
 * zero entries, the result groups are empty — the box does not open
 * (design §8 "engine says zero valid types").
 */
export function buildActPopout(input: BuildActPopoutInput): ActPopoutGroup[] {
  // Gate 0 — enumerate candidates for the target kind.
  const candidates = CANDIDATES_BY_TARGET_KIND[input.targetKind] ?? [];

  // Gate 1 — engine gate (hard). The transition table applies only to a
  // node / branch parent; a `room` / `concessionSet` / `evidenceObject`
  // target has no parent-child transition, so the engine gate is skipped
  // for those (their candidates carry `null` argument types anyway).
  const afterEngine =
    input.targetKind === 'node' || input.targetKind === 'branch'
      ? applyEngineGate(candidates, input.parentType, input.rules)
      : candidates.slice();

  // Gate 2 — role gate (hard).
  const afterRole = applyRoleGate(afterEngine, input.role);

  // Gate 3 — stage gate (soft) — order only, never remove.
  const { ordered, promoted } = applyStageGate(afterRole, input.stage);

  // Gate 4 — group, preserving the post-gate order within each group.
  const groups: ActPopoutGroup[] = [];
  for (const groupId of ACT_GROUP_ORDER) {
    const groupEntries: ActPopoutEntry[] = [];
    for (const id of ordered) {
      const def = ACT_ENTRY_DEFINITIONS[id];
      if (def.group !== groupId) continue;
      groupEntries.push({
        id: def.id,
        kind: def.kind,
        label: def.label,
        accessibilityLabel: def.accessibilityLabel,
        opensBoxType: def.opensBoxType,
        isPromoted: id === promoted,
      });
    }
    if (groupEntries.length > 0) {
      groups.push({
        id: groupId,
        label: ACT_GROUP_LABEL[groupId],
        entries: groupEntries,
      });
    }
  }
  return groups;
}

/**
 * Convenience: the flat ordered entry list (every group concatenated in
 * `ACT_GROUP_ORDER`). Useful for tests + keyboard traversal.
 */
export function flattenActPopout(groups: ReadonlyArray<ActPopoutGroup>): ActPopoutEntry[] {
  const flat: ActPopoutEntry[] = [];
  for (const g of groups) {
    for (const e of g.entries) flat.push(e);
  }
  return flat;
}

/**
 * Returns the single stage-promoted entry across all groups, or `null`
 * when nothing was promoted (no stage / promoted entry was filtered out /
 * a non-node target). Pure.
 */
export function getPromotedEntry(
  groups: ReadonlyArray<ActPopoutGroup>,
): ActPopoutEntry | null {
  for (const g of groups) {
    for (const e of g.entries) {
      if (e.isPromoted) return e;
    }
  }
  return null;
}

// ── Entry → composer-preset bridge ─────────────────────────────

/**
 * Maps a box-opening `ActEntryId` to the existing `quickActionPresets`
 * `QuickActionLabel`, so the OneBox can derive the composer's seeded
 * `MoveDraftPatch` for the chosen flash-menu entry through the SHIPPED
 * `quickActionToPreset` machinery — no preset bodies are re-authored
 * here (mirrors `timelineNodeActionDockModel.actionDockToComposerPreset`).
 *
 * Returns `null` for:
 *  - direct / role-change entries (no box opens — `flag` / `make_private`
 *    / `watch` / …), and
 *  - box-opening entries that produce no forced type (`reply` opens the
 *    composer with no forced argument type).
 *
 * The two structured / forced-list entry points whose schemas are owned
 * by later cards — `add_evidence` (QOL-036), `respond_to_evidence`
 * (QOL-037), `respond_to_concession` (QOL-041) — map to the closest
 * shipped quick action so the box is never blank; the structured-form
 * internals arrive with their own card.
 *
 * The string literal is the `QuickActionLabel` union from
 * `quickActionPresets.ts`; kept as a plain `string` return so this pure
 * model does not import the composer module (it stays React/Supabase-free
 * and the OneBox does the typed `quickActionToPreset` call).
 */
export function actEntryToQuickAction(entryId: ActEntryId): string | null {
  switch (entryId) {
    // Box-opening entries with a meaningful preset.
    case 'challenge':
      return 'challenge';
    case 'clarify':
      return 'clarify';
    case 'add_evidence':
      return 'evidence';
    case 'ask_source':
      return 'source';
    case 'ask_quote':
      return 'quote';
    case 'narrow':
      return 'narrow';
    case 'concede':
      return 'concede';
    case 'confirm':
      return 'confirm';
    case 'synthesize':
      return 'synthesize';
    case 'respond_to_evidence':
      // QOL-037 owns the structured response schema; the closest shipped
      // quick action is `challenge` (a response to evidence is a rebuttal-
      // shaped move) so the box is never blank.
      return 'challenge';
    case 'branch_tangent':
      return 'branch';
    // `reply` opens the composer with NO forced type.
    case 'reply':
    // `respond_to_concession` — QOL-041 owns the forced-list schema; the
    // box opens with no forced type until that card lands.
    case 'respond_to_concession':
    // UX-001.3 — `offer_concession` opens the new author-side forced-list
    // schema. The OneBox host wires the row list into the composer; no
    // shipped quick-action preset is needed.
    case 'offer_concession':
    // Direct / role-change entries — no box opens.
    case 'make_private':
    case 'flag':
    case 'request_deletion':
    case 'view_qualifiers':
    case 'watch':
    case 'join_for':
    case 'join_against':
    case 'chime_in':
      return null;
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = entryId;
      return never;
    }
  }
}

// ── _debug namespace — internal table access for tests ─────────

/**
 * Internal table access for tests. NOT part of the public API. The
 * leading underscore signals "test-only".
 */
export const _debug = Object.freeze({
  ACT_ENTRY_DEFINITIONS,
  CANDIDATES_BY_TARGET_KIND,
  STAGE_PROMOTED_ENTRY,
  OBSERVER_ALLOWED,
  OWN_BUBBLE_ALLOWED,
  applyEngineGate,
  applyRoleGate,
  applyStageGate,
});
