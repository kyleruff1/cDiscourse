/**
 * QOL-030 — One-box composer state machine (pure TypeScript).
 *
 * The "box" is ONE component that re-types itself. Its identity at any
 * moment is `(type, target, view, stageContext, lifecycle, draftBuffers)`
 * (design §6.1). This module owns that state machine and the per-type
 * schema renderer (`renderSchema`, design §6.5).
 *
 * Doctrine anchor — read this before changing anything:
 *
 *   1. **The box composes; it never judges.** No box type, schema kind, or
 *      label claims a move is right, wrong, popular, or strong. The box
 *      previews a node's *type and stage*, never its correctness
 *      (QOL-030 design §10). Heat is never an input.
 *   2. **Type-switching is non-destructive.** Each `BoxType` owns its own
 *      `Draft` buffer. Switching type or target PARKS the current buffer
 *      and restores the destination's — it never destroys a draft
 *      (design §6.6, decision D3).
 *   3. **The box is composition, not a write path.** This module never
 *      imports `supabase`, `fetch`, any router, React, or any network
 *      primitive. It produces a render schema; the room shell threads the
 *      post through the existing `submit-argument` Edge Function
 *      (design §10).
 *   4. **Deterministic + pure.** No `Date.now()`, no AI, no async, no
 *      mutation of any input. Idempotent.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { PointLifecycleState } from '../../lifecycle';

// ── Box type vocabulary (design §6.2) ──────────────────────────

/**
 * The final, narrative-derived set of box types (QOL-030 design §6.2).
 *
 * `reply` / `challenge` / `concede` are deliberately NOT separate types —
 * they are flash-menu entry points into the `respond` box, each focusing
 * one section (design §6.2 / §4.1 finding F2).
 */
export type BoxType =
  | 'root_claim'
  | 'respond'
  | 'respond_to_concession'
  | 'respond_to_evidence'
  | 'add_evidence'
  | 'ask_source'
  | 'ask_quote'
  | 'clarify'
  | 'narrow'
  | 'confirm'
  | 'synthesize'
  | 'branch_tangent';

/** Frozen array of every box type. Tests + the chassis iterate this. */
export const ALL_BOX_TYPES: ReadonlyArray<BoxType> = Object.freeze([
  'root_claim',
  'respond',
  'respond_to_concession',
  'respond_to_evidence',
  'add_evidence',
  'ask_source',
  'ask_quote',
  'clarify',
  'narrow',
  'confirm',
  'synthesize',
  'branch_tangent',
]);

// ── Box target vocabulary (design §6.1) ────────────────────────

/**
 * What the box acts on (QOL-030 design §6.1). The type picks the schema
 * *kind*; the target populates the *instance*.
 *
 *  - `none`            — a root claim (no parent).
 *  - `room`            — make-private / room-level config (finding F7).
 *  - `node`            — a message node.
 *  - `concessionSet`   — a concession set (finding F3).
 *  - `evidenceObject`  — an evidence object (finding F3, Scenario 2).
 *  - `branch`          — a branch off a node (finding F5, chime-in).
 */
export type BoxTargetKind =
  | 'none'
  | 'room'
  | 'node'
  | 'concessionSet'
  | 'evidenceObject'
  | 'branch';

/** Frozen array of every target kind. */
export const ALL_BOX_TARGET_KINDS: ReadonlyArray<BoxTargetKind> = Object.freeze([
  'none',
  'room',
  'node',
  'concessionSet',
  'evidenceObject',
  'branch',
]);

/**
 * A box target. The `kind` discriminates; the optional id fields carry the
 * instance the box renders against. A `none` target has no id (root claim);
 * a `room` target carries `roomId`; everything else carries `referenceId`.
 */
export interface BoxTarget {
  kind: BoxTargetKind;
  /** Room id — present for `kind: 'room'` and `kind: 'none'` (the room a
   *  root claim is created in, when known). */
  roomId?: string | null;
  /** The id of the node / concession set / evidence object / branch root
   *  this box acts on. Present for every kind except `none` / `room`. */
  referenceId?: string | null;
}

/** The empty (root-claim) target — frozen so callers can share one. */
export const NO_TARGET: BoxTarget = Object.freeze({ kind: 'none', roomId: null, referenceId: null });

// ── Box view + lifecycle (design §6.1 / §7 of the model doc) ───

/** Timeline or Cards. Changes presentation only, never type or contents. */
export type BoxView = 'timeline' | 'cards';

/** Frozen array of both views. */
export const ALL_BOX_VIEWS: ReadonlyArray<BoxView> = Object.freeze(['timeline', 'cards']);

/**
 * The box lifecycle (one-box-interface-model.md §7 / QOL-030 §6.1):
 * `empty → typed → drafting → review → posted | parked`.
 */
export type BoxLifecycle = 'empty' | 'typed' | 'drafting' | 'review' | 'posted' | 'parked';

/** Frozen array of every lifecycle value. */
export const ALL_BOX_LIFECYCLES: ReadonlyArray<BoxLifecycle> = Object.freeze([
  'empty',
  'typed',
  'drafting',
  'review',
  'posted',
  'parked',
]);

// ── Schema kinds (design §6.5) ─────────────────────────────────

/**
 * The four schema kinds the box can render (QOL-030 design §6.5):
 *  - `free_body`       — one body field (+ optional reasoning + tags).
 *  - `forced_list`     — item fields only; NO single body. Itemization is
 *    structural — no AI parsing (one-box model decision D6).
 *  - `structured_form` — typed fields (e.g. the evidence form).
 *  - `composite`       — `respond` only: a forced-list concession section
 *    + a free-body refutation section.
 */
export type SchemaKind = 'free_body' | 'forced_list' | 'structured_form' | 'composite';

/** Frozen array of every schema kind. */
export const ALL_SCHEMA_KINDS: ReadonlyArray<SchemaKind> = Object.freeze([
  'free_body',
  'forced_list',
  'structured_form',
  'composite',
]);

/**
 * Which sections a rendered schema exposes. Every section name is
 * structural — none of them is a verdict.
 *
 *  - `body`             — a free-text body field.
 *  - `concession_list`  — a forced list of concession items.
 *  - `room_setup`       — title / visibility / invite (root_claim only).
 *  - `structured_fields`— typed evidence / response fields.
 *  - `short_prompt`     — a single short targeted prompt (ask_source/quote).
 *  - `side_branch`      — the side-branch affordance (branch_tangent).
 */
export type SchemaSection =
  | 'body'
  | 'concession_list'
  | 'room_setup'
  | 'structured_fields'
  | 'short_prompt'
  | 'side_branch';

/**
 * The render schema for a `(type, target)` pair — the box's render
 * contract. The component renders exactly the sections listed, in order.
 */
export interface RenderSchema {
  /** The box type this schema describes. */
  type: BoxType;
  /** The schema kind — picks the structural family. */
  kind: SchemaKind;
  /** The ordered sections the component renders. */
  sections: ReadonlyArray<SchemaSection>;
  /**
   * True when the schema has NO single free-text body — a forced list is
   * structural (decision D6). The component must not render a body field.
   */
  hasFreeBody: boolean;
  /**
   * True when the box also configures the room (root_claim only — the
   * root box is the only box that configures the room, finding F1).
   */
  configuresRoom: boolean;
}

// ── Draft buffers (design §6.6) ────────────────────────────────

/**
 * A per-type draft buffer. One buffer per `BoxType`; switching type or
 * target parks the current buffer and restores the destination's — never
 * destructive (design §6.6, decision D3).
 *
 * The buffer is intentionally schema-agnostic: it holds an optional body,
 * an ordered list of item strings (for forced-list schemas), and a typed
 * field bag (for structured forms). The room shell maps it onto the
 * concrete composer fields when posting through `submit-argument`.
 */
export interface Draft {
  /** Free-text body, for free-body / composite schemas. Empty when unused. */
  body: string;
  /** Ordered item strings, for forced-list / composite schemas. */
  listItems: ReadonlyArray<string>;
  /** Typed field values, for structured-form schemas. */
  fields: Readonly<Record<string, string>>;
}

/** A frozen empty draft. New `BoxType` buffers start from this shape. */
export const EMPTY_DRAFT: Draft = Object.freeze({
  body: '',
  listItems: Object.freeze([]),
  fields: Object.freeze({}),
});

/** Per-type draft buffers — one `Draft` per `BoxType`. */
export type DraftBuffers = Readonly<Record<BoxType, Draft>>;

/**
 * Builds a fresh, complete `DraftBuffers` map — every `BoxType` keyed to a
 * frozen `EMPTY_DRAFT`. Pure; returns a new object each call.
 */
export function createEmptyDraftBuffers(): DraftBuffers {
  const buffers = {} as Record<BoxType, Draft>;
  for (const type of ALL_BOX_TYPES) {
    buffers[type] = EMPTY_DRAFT;
  }
  return Object.freeze(buffers);
}

/**
 * Returns true when a draft holds nothing the user typed — used to decide
 * whether a park is meaningful and whether the lifecycle returns to
 * `empty`. Pure.
 */
export function isDraftEmpty(draft: Draft): boolean {
  if (draft.body.trim().length > 0) return false;
  if (draft.listItems.some((i) => i.trim().length > 0)) return false;
  for (const key of Object.keys(draft.fields)) {
    if (String(draft.fields[key] ?? '').trim().length > 0) return false;
  }
  return true;
}

// ── The box state (design §6.1) ────────────────────────────────

/**
 * The full box state — `What's in the box = type × target` (design §6.1).
 *
 * `draftBuffers` is per-type and never destroyed on a switch; the active
 * type's buffer is `draftBuffers[type]`.
 */
export interface BoxState {
  /** The current box type — set by the flash menu. */
  type: BoxType;
  /** What the box acts on. */
  target: BoxTarget;
  /** Timeline or Cards — presentation only. */
  view: BoxView;
  /** The target node's LIFE-001 stage, when the target is a node. `null`
   *  for non-node targets (root claim, room, …). */
  stageContext: PointLifecycleState | null;
  /** Where the box is in its lifecycle. */
  lifecycle: BoxLifecycle;
  /** Per-type draft buffers — never destroyed on a type switch. */
  draftBuffers: DraftBuffers;
}

/**
 * Creates a fresh box state. Defaults to a `root_claim` box with no target
 * — the at-rest minimized dock composes a root claim until the flash menu
 * re-types it.
 */
export function createBoxState(init?: {
  type?: BoxType;
  target?: BoxTarget;
  view?: BoxView;
  stageContext?: PointLifecycleState | null;
}): BoxState {
  return {
    type: init?.type ?? 'root_claim',
    target: init?.target ?? NO_TARGET,
    view: init?.view ?? 'timeline',
    stageContext: init?.stageContext ?? null,
    lifecycle: 'empty',
    draftBuffers: createEmptyDraftBuffers(),
  };
}

// ── renderSchema (design §6.5) ─────────────────────────────────

/**
 * The per-type schema definition table. `renderSchema` looks the type up
 * and returns a schema; the `target` only affects the instance, not the
 * kind, so the table is keyed on type alone (design §6.1: "type picks the
 * schema kind; the target populates the instance").
 */
const SCHEMA_BY_TYPE: Readonly<Record<BoxType, Omit<RenderSchema, 'type'>>> = Object.freeze({
  // F1 both scenarios — free body + room setup. The only box that also
  // configures the room.
  root_claim: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['room_setup', 'body']),
    hasFreeBody: true,
    configuresRoom: true,
  }),
  // F2 Scenario 1 — the composite: an optional concession forced-list
  // section + a refutation free-body section.
  respond: Object.freeze({
    kind: 'composite',
    sections: Object.freeze<SchemaSection[]>(['concession_list', 'body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  // F3 Scenario 1 — a forced list mirroring a concession set, row-for-row.
  // No single body — itemization is structural.
  respond_to_concession: Object.freeze({
    kind: 'forced_list',
    sections: Object.freeze<SchemaSection[]>(['concession_list']),
    hasFreeBody: false,
    configuresRoom: false,
  }),
  // F3 Scenario 2 — a structured choice set + required clarification.
  respond_to_evidence: Object.freeze({
    kind: 'structured_form',
    sections: Object.freeze<SchemaSection[]>(['structured_fields', 'body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  // F2 Scenario 2 — a structured form (the payment / evidence fields).
  add_evidence: Object.freeze({
    kind: 'structured_form',
    sections: Object.freeze<SchemaSection[]>(['structured_fields']),
    hasFreeBody: false,
    configuresRoom: false,
  }),
  // F5 Scenario 2 — a short targeted prompt.
  ask_source: Object.freeze({
    kind: 'structured_form',
    sections: Object.freeze<SchemaSection[]>(['short_prompt']),
    hasFreeBody: false,
    configuresRoom: false,
  }),
  ask_quote: Object.freeze({
    kind: 'structured_form',
    sections: Object.freeze<SchemaSection[]>(['short_prompt']),
    hasFreeBody: false,
    configuresRoom: false,
  }),
  // §3.4 — a free body, question-shaped.
  clarify: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  // §3.4 / quickActionPresets — preset free body.
  narrow: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  confirm: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  synthesize: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
  // F10 Scenario 1 — free body + side-branch affordance.
  branch_tangent: Object.freeze({
    kind: 'free_body',
    sections: Object.freeze<SchemaSection[]>(['side_branch', 'body']),
    hasFreeBody: true,
    configuresRoom: false,
  }),
});

/**
 * Returns the render schema for a `(type, target)` pair (QOL-030 §6.5).
 *
 * The kind is a pure function of the type. The `target` is accepted so the
 * signature matches the design and so a future card can vary the schema
 * *instance* by target without a signature change; v1 routes purely on
 * type. Throws on an unknown type — the union makes that unreachable from
 * typed callers; the throw guards untyped boundaries.
 *
 * Pure. Deterministic. O(1).
 */
export function renderSchema(type: BoxType, target: BoxTarget): RenderSchema {
  // The target is reserved for future per-target instance variation
  // (design §6.1). v1 routes the schema *kind* purely on type.
  void target;
  const def = SCHEMA_BY_TYPE[type];
  if (!def) {
    throw new Error(`renderSchema: unknown box type "${String(type)}"`);
  }
  return { type, ...def };
}

// ── State transitions (design §6.1 / §6.6 / §8) ────────────────

/**
 * Switches the box type. The current type's buffer is PARKED in place
 * (draft buffers are per-type and persist), and the destination type's
 * buffer is restored — the active draft is `draftBuffers[nextType]`. The
 * switch is non-destructive (design §6.6, decision D3; §8 edge case
 * "type-switch mid-draft — parks; never destroys").
 *
 * Lifecycle after a switch:
 *  - `posted` is sticky-cleared — a switch starts a new compose intent.
 *  - if the destination buffer is empty → `typed` (a type is set, nothing
 *    drafted yet).
 *  - if the destination buffer has content → `drafting` (restoring a
 *    parked draft resumes drafting).
 *
 * Switching to the SAME type is a no-op that returns the input state
 * (referential identity preserved) so callers can switch freely.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function switchBoxType(state: BoxState, nextType: BoxType): BoxState {
  if (!SCHEMA_BY_TYPE[nextType]) {
    throw new Error(`switchBoxType: unknown box type "${String(nextType)}"`);
  }
  if (nextType === state.type) return state;
  const destinationDraft = state.draftBuffers[nextType] ?? EMPTY_DRAFT;
  const lifecycle: BoxLifecycle = isDraftEmpty(destinationDraft) ? 'typed' : 'drafting';
  return {
    ...state,
    type: nextType,
    lifecycle,
  };
}

/**
 * Changes the box target. The current type's buffer is PARKED against the
 * *original* target (the buffer stays per-type — a target change does not
 * move drafts between types); the box re-points at the new target. The
 * stage context is supplied by the caller (the room shell reads the new
 * target node's LIFE-001 stage) — a non-node target clears it to `null`.
 *
 * Per design §8 ("target change mid-draft — parks against the original
 * target; explicit"), a target change never destroys a draft.
 *
 * Lifecycle after a target change:
 *  - `posted` is cleared.
 *  - the current type's buffer is re-evaluated: empty → `typed`,
 *    non-empty → `drafting`.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function changeBoxTarget(
  state: BoxState,
  nextTarget: BoxTarget,
  nextStageContext: PointLifecycleState | null,
): BoxState {
  const currentDraft = state.draftBuffers[state.type] ?? EMPTY_DRAFT;
  const lifecycle: BoxLifecycle = isDraftEmpty(currentDraft) ? 'typed' : 'drafting';
  return {
    ...state,
    target: nextTarget,
    // A non-node target has no lifecycle stage.
    stageContext: nextTarget.kind === 'node' ? nextStageContext : null,
    lifecycle,
  };
}

/**
 * Switches the box view (Timeline ↔ Cards). Per design §6.1 / decision D4
 * the view changes presentation ONLY — type, target, stage, lifecycle and
 * every draft buffer are preserved exactly. Toggling mid-compose keeps
 * everything.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function switchBoxView(state: BoxState, nextView: BoxView): BoxState {
  if (nextView === state.view) return state;
  return { ...state, view: nextView };
}

/**
 * Writes a draft into the ACTIVE type's buffer. Only the active type's
 * buffer changes; every other type's parked buffer is preserved
 * byte-for-byte. The lifecycle advances to `drafting` when the new draft
 * has content, or back to `typed` when it is emptied.
 *
 * `posted` and `review` are NOT overwritten here — once a box is posted or
 * under review, editing must go through `resetAfterPost` / an explicit
 * lifecycle move first. When the box is already `posted` or in `review`,
 * this returns the input state unchanged so a stray keystroke cannot
 * silently re-open a committed box.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function updateActiveDraft(state: BoxState, draft: Draft): BoxState {
  if (state.lifecycle === 'posted' || state.lifecycle === 'review') {
    return state;
  }
  const nextBuffers: Record<BoxType, Draft> = { ...state.draftBuffers };
  nextBuffers[state.type] = draft;
  const lifecycle: BoxLifecycle = isDraftEmpty(draft) ? 'typed' : 'drafting';
  return {
    ...state,
    draftBuffers: Object.freeze(nextBuffers),
    lifecycle,
  };
}

/**
 * Moves the box into `review` — the RULE-004 pre-send review fires on the
 * Post intent for ANY type (one-box model §7). A box can only enter review
 * from `drafting` (there must be a draft to review); from any other
 * lifecycle this returns the input state unchanged.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function enterReview(state: BoxState): BoxState {
  if (state.lifecycle !== 'drafting') return state;
  return { ...state, lifecycle: 'review' };
}

/**
 * Returns the box from `review` back to `drafting` ("Back to editing").
 * The draft is untouched. From any non-`review` lifecycle this returns the
 * input state unchanged.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function leaveReview(state: BoxState): BoxState {
  if (state.lifecycle !== 'review') return state;
  return { ...state, lifecycle: 'drafting' };
}

/**
 * Marks the box `posted` after the move commits via `submit-argument`. The
 * just-posted type's draft buffer is cleared to `EMPTY_DRAFT` (the move is
 * committed; its draft is spent) — every OTHER type's parked buffer is
 * preserved. A box can be marked posted from `drafting` or `review`; from
 * any other lifecycle this returns the input state unchanged.
 *
 * This module never performs the post itself — the room shell threads the
 * commit through the existing `submit-argument` Edge Function and then
 * calls this to record the outcome (design §10).
 *
 * Pure — returns a new state; never mutates the input.
 */
export function markPosted(state: BoxState): BoxState {
  if (state.lifecycle !== 'drafting' && state.lifecycle !== 'review') {
    return state;
  }
  const nextBuffers: Record<BoxType, Draft> = { ...state.draftBuffers };
  nextBuffers[state.type] = EMPTY_DRAFT;
  return {
    ...state,
    draftBuffers: Object.freeze(nextBuffers),
    lifecycle: 'posted',
  };
}

/**
 * Resets a `posted` box back to a composable lifecycle so the same box can
 * compose the next move. The just-posted type's buffer is already empty
 * (`markPosted` cleared it); this only moves the lifecycle: `posted →
 * empty`. From any non-`posted` lifecycle this returns the input state
 * unchanged.
 *
 * Pure — returns a new state; never mutates the input.
 */
export function resetAfterPost(state: BoxState): BoxState {
  if (state.lifecycle !== 'posted') return state;
  return { ...state, lifecycle: 'empty' };
}

// ── Ban-list support ───────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/oneBoxCopyBanList.test.ts`. NOT a
 * content filter. Mirrors `_forbiddenChannelTokens` / `_forbiddenDockTokens`
 * so QOL-030 copy is held to the same bar (cdiscourse-doctrine §1 / §9).
 */
export function _forbiddenBoxTokens(): string[] {
  return [
    // Verdict tokens.
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'disproven',
    'validated',
    'lost',
    'defeated',
    'won',
    'right',
    'wrong',
    'stupid',
    'idiot',
    // Amplification tokens.
    'likes',
    'retweets',
    'shares',
    'followers',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'viral',
    // Discouraged terminology (terminology-and-copy-rules.md).
    'tap to join',
  ];
}
