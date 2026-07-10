/**
 * FEEDBACK-002 (#899) — derivedObservationSignals: zero-spend cross-family
 * composition (pure TypeScript).
 *
 * Machine observations (families A-J) are consumed ONE family at a time by the
 * friendly-flag layer. This module composes ACROSS families, across nodes, and
 * across the human move_marks + evidence-debt + heat + structure layers into the
 * seven higher-order ADVISORY signals ratified in pivot-plan doc 10 section 5
 * (5.1 proof_moment ... 5.7 dodge_chain). It reads ONLY already-persisted /
 * already-derived rows the room render tree holds; it fetches nothing, calls no
 * classifier, and touches no standing.
 *
 * Doctrine spine (cdiscourse-doctrine sections 1/3/4; point-standing-economy
 * anti-amplification interlock):
 *  - Every signal is `advisory:true`, `authoritative:false`,
 *    `neverAffectsStanding:true` as LITERAL types, so a non-advisory signal
 *    cannot typecheck.
 *  - The `DerivedSignalConsumer` enum is a CLOSED set with no score/standing/
 *    credit/band member: a signal cannot declare a consumer that feeds standing.
 *  - Heat reaches exactly one signal (hot_but_proof_light) and is the only
 *    activity input; `provenance.heatBand` is non-null on that signal alone.
 *
 * Composition currency: the shipped, tested `friendlyFlagsFor` routing
 * (FriendlyFlagKey), NOT raw keys. This reuses doc 10 section 5s own predicate
 * language verbatim and pins composition behavior to one place.
 *
 * PURE: no React, no Supabase, no fetch, no Date.now, no Math.random, no
 * mutation. It imports NOTHING from pointStanding and NEVER imports
 * deriveMediatorBoardState / buildPointLifecycleMap / deriveEvidenceDebts (the
 * single-derivation pin; the room passes those already-derived). Comments are
 * apostrophe-free for scanner safety.
 */
import {
  friendlyFlagsFor,
  type FriendlyFlagKey,
} from './friendlyFlagMap';
import { deriveMoveMarkAggregate } from '../feedback/moveMarkAggregateModel';
import type { MoveMarkRow } from '../feedback/moveMarksModel';
import { OPEN_EVIDENCE_DEBT_STATUSES } from '../evidence/evidenceDebtModel';
import type { EvidenceDebt, EvidenceDebtKind } from '../evidence/evidenceDebtModel';

// ── The seven composition codes (doc 10 section 5.1-5.7) ─────────────

/** snake_case, NEVER user-facing. Routed through DERIVED_SIGNAL_LINE_COPY. */
export type DerivedSignalCode =
  | 'proof_moment' // 5.1
  | 'hot_but_proof_light' // 5.2
  | 'talking_past' // 5.3
  | 'resolution_window' // 5.4
  | 'callback_worthy' // 5.5
  | 'own_tension_hint' // 5.6
  | 'dodge_chain'; // 5.7

/** Every code, frozen — for test enumeration. */
export const ALL_DERIVED_SIGNAL_CODES: readonly DerivedSignalCode[] = Object.freeze([
  'proof_moment',
  'hot_but_proof_light',
  'talking_past',
  'resolution_window',
  'callback_worthy',
  'own_tension_hint',
  'dodge_chain',
]);

/**
 * The CLOSED set of surfaces a signal may reach. This enum IS the
 * "no new pills / signals move furniture" guardrail (doc 10 section 4/5),
 * enforced by the type system. There is deliberately NO score / standing /
 * credit / band / verdict consumer in the set.
 */
export type DerivedSignalConsumer =
  | 'inspect_advisory_line' // wired THIS card (Inspect active-node disclosure)
  | 'mediator_rail_line' // wired THIS card (DisagreementPointsRail overlay)
  | 'proof_button_pulse' // dormant — PROOF/proof_drawer card owns wiring
  | 'state_rail_line' // dormant — ROOM-001 StateRail card owns wiring
  | 'your_turn_ranking' // dormant — HOME card owns wiring
  | 'gallery_bucket' // dormant — conversationGalleryModel card owns wiring
  | 'linked_prior_ordering' // dormant — QUOTE-FORGE card owns wiring
  | 'composer_whisper'; // dormant — composer card owns wiring (5.6 only)

/** What the signal is anchored to. */
export type DerivedSignalScope =
  | { readonly kind: 'node'; readonly argumentId: string }
  | {
      readonly kind: 'thread';
      readonly anchorArgumentId: string;
      readonly pointId: string;
      readonly memberArgumentIds: readonly string[];
    }
  | { readonly kind: 'room'; readonly debateId: string };

/** Composition provenance — audit + tests only, NEVER user-facing. */
export interface DerivedSignalProvenance {
  readonly contributingFlagKeys: readonly string[];
  readonly contributingMarkCodes: readonly string[];
  readonly contributingDebtKinds: readonly string[];
  /** Set ONLY for hot_but_proof_light — the anti-amplification pin. */
  readonly heatBand: 'quiet' | 'active' | 'hot' | null;
  readonly note: string;
}

/**
 * A single derived advisory signal. The three literal-typed booleans are the
 * doctrine spine: a signal that is not advisory / is authoritative / affects
 * standing literally cannot typecheck.
 */
export interface DerivedSignal {
  readonly code: DerivedSignalCode;
  /** ALWAYS true — there is no non-advisory signal (cdiscourse-doctrine section 1). */
  readonly advisory: true;
  /** ALWAYS false — mirrors the AI-flag rule (cdiscourse-doctrine section 4). */
  readonly authoritative: false;
  /** ALWAYS true — a structural assertion this signal touches no standing. */
  readonly neverAffectsStanding: true;
  readonly scope: DerivedSignalScope;
  readonly consumers: readonly DerivedSignalConsumer[];
  /** true ONLY for own_tension_hint — never on a public / opponent surface. */
  readonly composerOnly: boolean;
  readonly provenance: DerivedSignalProvenance;
}

// ── Inputs ───────────────────────────────────────────────────────────

/** Per-node structural facts the derivation needs (all resident in-room). */
export interface DerivedSignalNodeInput {
  readonly argumentId: string;
  readonly parentId: string | null;
  /** = timelineMap node.branchRootMessageId (the point/cluster anchor). */
  readonly branchRootId: string;
  readonly authorId: string | null;
  /** 'affirmative' | 'negative' | 'moderator' | null. */
  readonly side: string | null;
  /** Chronological order in room. */
  readonly ordinal: number;
  /** Viewer-relative (own-node scoping for 5.1/5.6). */
  readonly actor: 'self' | 'other' | 'unknown';
}

/** For 5.6 own_tension_hint — present only while a composer is open. */
export interface DerivedSignalDraftContext {
  readonly draftAuthorId: string;
  readonly targetArgumentId: string;
  readonly relationToTarget: 'builds_on' | 'disagrees' | 'other';
  readonly priorOwnNodeIds: readonly string[];
}

export interface DeriveDerivedSignalsInput {
  readonly debateId: string;
  readonly nodes: readonly DerivedSignalNodeInput[];
  /** SAME rows the room already fetched, keyed by argumentId (family, rawKey). */
  readonly observationsByArgumentId: Readonly<
    Record<string, readonly { family: string; rawKey: string }[]>
  >;
  readonly evidenceDebts: readonly EvidenceDebt[];
  /** Active move-mark rows (empty when move_marks flag OFF). */
  readonly moveMarks: readonly MoveMarkRow[];
  readonly heatBand: 'quiet' | 'active' | 'hot' | null;
  readonly draftContext: DerivedSignalDraftContext | null;
  /** Window size N for dodge_chain / talking_past / hot_but_proof_light. */
  readonly windowSize?: number;
}

/** "last N moves" window for 5.2/5.3/5.7. */
export const DERIVED_SIGNAL_WINDOW = 6;

// ── Consumer sets (frozen per code) ──────────────────────────────────

const CONSUMERS_PROOF_MOMENT: readonly DerivedSignalConsumer[] = Object.freeze([
  'inspect_advisory_line',
  'proof_button_pulse',
  'your_turn_ranking',
]);
const CONSUMERS_HOT_BUT_PROOF_LIGHT: readonly DerivedSignalConsumer[] = Object.freeze([
  'gallery_bucket',
]);
const CONSUMERS_TALKING_PAST: readonly DerivedSignalConsumer[] = Object.freeze([
  'inspect_advisory_line',
  'mediator_rail_line',
]);
const CONSUMERS_RESOLUTION_WINDOW: readonly DerivedSignalConsumer[] = Object.freeze([
  'inspect_advisory_line',
  'state_rail_line',
  'your_turn_ranking',
  'gallery_bucket',
]);
const CONSUMERS_CALLBACK_WORTHY: readonly DerivedSignalConsumer[] = Object.freeze([
  'inspect_advisory_line',
  'linked_prior_ordering',
]);
const CONSUMERS_OWN_TENSION_HINT: readonly DerivedSignalConsumer[] = Object.freeze([
  'composer_whisper',
]);
const CONSUMERS_DODGE_CHAIN: readonly DerivedSignalConsumer[] = Object.freeze([
  'inspect_advisory_line',
  'mediator_rail_line',
]);

// ── Internal derivation context ──────────────────────────────────────

interface DerivationContext {
  readonly debateId: string;
  readonly nodesSorted: readonly DerivedSignalNodeInput[];
  readonly nodesById: ReadonlyMap<string, DerivedSignalNodeInput>;
  readonly childrenByParent: ReadonlyMap<string, readonly DerivedSignalNodeInput[]>;
  readonly flagsByNode: ReadonlyMap<string, ReadonlySet<FriendlyFlagKey>>;
  readonly unaddressedSet: ReadonlySet<string>;
  readonly receiptsRequestedSet: ReadonlySet<string>;
  readonly openSourceQuoteDebtsByNode: ReadonlyMap<string, readonly EvidenceDebt[]>;
  readonly openDebtCountRoom: number;
  readonly heatBand: 'quiet' | 'active' | 'hot' | null;
  readonly draftContext: DerivedSignalDraftContext | null;
  readonly windowSize: number;
}

const OPEN_STATUS_SET: ReadonlySet<string> = new Set(OPEN_EVIDENCE_DEBT_STATUSES);
const SOURCE_QUOTE_KINDS: ReadonlySet<EvidenceDebtKind> = new Set<EvidenceDebtKind>([
  'source',
  'quote',
]);

function hasFlag(ctx: DerivationContext, argumentId: string, key: FriendlyFlagKey): boolean {
  return ctx.flagsByNode.get(argumentId)?.has(key) === true;
}

function hasAnyFlag(
  ctx: DerivationContext,
  argumentId: string,
  keys: readonly FriendlyFlagKey[],
): boolean {
  const set = ctx.flagsByNode.get(argumentId);
  if (!set) return false;
  for (const k of keys) if (set.has(k)) return true;
  return false;
}

function freezeSignal(signal: DerivedSignal): DerivedSignal {
  Object.freeze(signal.provenance);
  return Object.freeze(signal);
}

// ── 5.1 proof_moment (B x D x F x marks; own move only) ──────────────

function deriveProofMoment(ctx: DerivationContext): DerivedSignal[] {
  const out: DerivedSignal[] = [];
  for (const m of ctx.nodesSorted) {
    // Doc 5.1: "invitation on your OWN move only."
    if (m.actor !== 'self') continue;
    const children = ctx.childrenByParent.get(m.argumentId) ?? [];
    const factChallengeChild = children.find((c) =>
      hasFlag(ctx, c.argumentId, 'disagrees_on_facts'),
    );
    if (!factChallengeChild) continue;

    const hasDFlag = hasAnyFlag(ctx, m.argumentId, ['needs_a_receipt', 'open_receipt']);
    const openDebts = ctx.openSourceQuoteDebtsByNode.get(m.argumentId) ?? [];
    const hasOpenDebt = openDebts.length > 0;
    const hasReceiptMark = ctx.receiptsRequestedSet.has(m.argumentId);
    if (!hasDFlag && !hasOpenDebt && !hasReceiptMark) continue;

    const hasUnansweredQ = hasFlag(ctx, m.argumentId, 'unanswered_question');
    const contributingFlagKeys: string[] = ['disagrees_on_facts'];
    if (hasFlag(ctx, m.argumentId, 'needs_a_receipt')) contributingFlagKeys.push('needs_a_receipt');
    if (hasFlag(ctx, m.argumentId, 'open_receipt')) contributingFlagKeys.push('open_receipt');
    if (hasUnansweredQ) contributingFlagKeys.push('unanswered_question');

    out.push(
      freezeSignal({
        code: 'proof_moment',
        advisory: true,
        authoritative: false,
        neverAffectsStanding: true,
        scope: { kind: 'node', argumentId: m.argumentId },
        consumers: CONSUMERS_PROOF_MOMENT,
        composerOnly: false,
        provenance: {
          contributingFlagKeys: Object.freeze(contributingFlagKeys),
          contributingMarkCodes: Object.freeze(hasReceiptMark ? ['receipts_requested'] : []),
          contributingDebtKinds: Object.freeze(
            [...new Set(openDebts.map((d) => d.debtKind))].sort(),
          ),
          heatBand: null,
          note: 'A source request is open on your own move; a receipt would carry it further.',
        },
      }),
    );
  }
  return out;
}

// ── 5.2 hot_but_proof_light (heat x D x debts; room) ─────────────────

function deriveHotButProofLight(ctx: DerivationContext): DerivedSignal[] {
  if (ctx.heatBand !== 'hot') return [];
  const windowNodes = ctx.nodesSorted.slice(-ctx.windowSize);
  const anyReceiptsBrought = windowNodes.some((n) =>
    hasFlag(ctx, n.argumentId, 'brought_receipts'),
  );
  if (anyReceiptsBrought) return [];
  if (ctx.openDebtCountRoom < 1) return [];

  return [
    freezeSignal({
      code: 'hot_but_proof_light',
      advisory: true,
      authoritative: false,
      neverAffectsStanding: true,
      scope: { kind: 'room', debateId: ctx.debateId },
      consumers: CONSUMERS_HOT_BUT_PROOF_LIGHT,
      composerOnly: false,
      provenance: {
        contributingFlagKeys: Object.freeze([]),
        contributingMarkCodes: Object.freeze([]),
        contributingDebtKinds: Object.freeze(['source']),
        heatBand: 'hot',
        note: 'Room activity is high while at least one source request is still open.',
      },
    }),
  ];
}

// ── Thread clustering helper (by branchRootId) ───────────────────────

function clustersWithin(
  ctx: DerivationContext,
  restrictToWindow: boolean,
): Map<string, DerivedSignalNodeInput[]> {
  const source = restrictToWindow ? ctx.nodesSorted.slice(-ctx.windowSize) : ctx.nodesSorted;
  const clusters = new Map<string, DerivedSignalNodeInput[]>();
  for (const n of source) {
    const arr = clusters.get(n.branchRootId);
    if (arr) arr.push(n);
    else clusters.set(n.branchRootId, [n]);
  }
  return clusters;
}

// ── 5.3 talking_past (C x B x H, both sides; thread) ─────────────────

function deriveTalkingPast(ctx: DerivationContext): DerivedSignal[] {
  const out: DerivedSignal[] = [];
  const clusters = clustersWithin(ctx, true);
  const orderedKeys = [...clusters.keys()].sort(compareStrings);
  for (const branchRootId of orderedKeys) {
    const members = clusters.get(branchRootId)!;
    let hasC = false;
    let hasB = false;
    let hasH = false;
    const sidesWithSignal = new Set<string>();
    for (const n of members) {
      const relevant =
        hasFlag(ctx, n.argumentId, 'asks_for_clarification') ||
        hasFlag(ctx, n.argumentId, 'disagrees_on_scope') ||
        hasAnyFlag(ctx, n.argumentId, ['could_be_more_specific', 'reads_as_hedged']);
      if (hasFlag(ctx, n.argumentId, 'asks_for_clarification')) hasC = true;
      if (hasFlag(ctx, n.argumentId, 'disagrees_on_scope')) hasB = true;
      if (hasAnyFlag(ctx, n.argumentId, ['could_be_more_specific', 'reads_as_hedged'])) hasH = true;
      if (relevant && n.side) sidesWithSignal.add(n.side);
    }
    if (!(hasC && hasB && hasH)) continue;
    if (sidesWithSignal.size < 2) continue;
    out.push(
      freezeSignal({
        code: 'talking_past',
        advisory: true,
        authoritative: false,
        neverAffectsStanding: true,
        scope: {
          kind: 'thread',
          anchorArgumentId: branchRootId,
          pointId: branchRootId,
          memberArgumentIds: Object.freeze(members.map((n) => n.argumentId).sort(compareStrings)),
        },
        consumers: CONSUMERS_TALKING_PAST,
        composerOnly: false,
        provenance: {
          contributingFlagKeys: Object.freeze([
            'asks_for_clarification',
            'disagrees_on_scope',
          ]),
          contributingMarkCodes: Object.freeze([]),
          contributingDebtKinds: Object.freeze([]),
          heatBand: null,
          note: 'Both sides show clarification / scope / specificity signals on one point.',
        },
      }),
    );
  }
  return out;
}

// ── 5.4 resolution_window (G x F x debts; node-anchored) ─────────────

const G_KEYS: readonly FriendlyFlagKey[] = [
  'narrowed_the_claim',
  'found_common_ground',
  'synthesis_on_the_table',
];

function deriveResolutionWindow(ctx: DerivationContext): DerivedSignal[] {
  // Room-level gates first.
  const roomHasOpenQuestion = ctx.nodesSorted.some((n) =>
    hasFlag(ctx, n.argumentId, 'unanswered_question'),
  );
  if (roomHasOpenQuestion) return [];
  if (ctx.openDebtCountRoom > 1) return [];

  const out: DerivedSignal[] = [];
  for (const n of ctx.nodesSorted) {
    if (!hasAnyFlag(ctx, n.argumentId, G_KEYS)) continue;
    const keys = G_KEYS.filter((k) => hasFlag(ctx, n.argumentId, k));
    out.push(
      freezeSignal({
        code: 'resolution_window',
        advisory: true,
        authoritative: false,
        neverAffectsStanding: true,
        scope: { kind: 'node', argumentId: n.argumentId },
        consumers: CONSUMERS_RESOLUTION_WINDOW,
        composerOnly: false,
        provenance: {
          contributingFlagKeys: Object.freeze(keys),
          contributingMarkCodes: Object.freeze([]),
          contributingDebtKinds: Object.freeze([]),
          heatBand: null,
          note: 'Resolution progress with no open question and at most one open debt.',
        },
      }),
    );
  }
  return out;
}

// ── 5.5 callback_worthy (E x G x A; node-anchored) ───────────────────

const E_CALLBACK_KEYS: readonly FriendlyFlagKey[] = ['names_the_pattern', 'strong_comparison'];
const G_CONCESSION_KEYS: readonly FriendlyFlagKey[] = ['clean_concession', 'found_common_ground'];

function deriveCallbackWorthy(ctx: DerivationContext): DerivedSignal[] {
  const out: DerivedSignal[] = [];
  for (const x of ctx.nodesSorted) {
    if (!hasFlag(ctx, x.argumentId, 'callback_material')) continue;
    if (!hasAnyFlag(ctx, x.argumentId, E_CALLBACK_KEYS)) continue;
    const hasLaterConcession = ctx.nodesSorted.some(
      (y) => y.ordinal > x.ordinal && hasAnyFlag(ctx, y.argumentId, G_CONCESSION_KEYS),
    );
    if (!hasLaterConcession) continue;
    const eKeys = E_CALLBACK_KEYS.filter((k) => hasFlag(ctx, x.argumentId, k));
    out.push(
      freezeSignal({
        code: 'callback_worthy',
        advisory: true,
        authoritative: false,
        neverAffectsStanding: true,
        scope: { kind: 'node', argumentId: x.argumentId },
        consumers: CONSUMERS_CALLBACK_WORTHY,
        composerOnly: false,
        provenance: {
          contributingFlagKeys: Object.freeze(['callback_material', ...eKeys]),
          contributingMarkCodes: Object.freeze([]),
          contributingDebtKinds: Object.freeze([]),
          heatBand: null,
          note: 'A quotable move preceded a later concession or common-ground move.',
        },
      }),
    );
  }
  return out;
}

// ── 5.6 own_tension_hint (A x B, self-scoped, composer-only) ─────────

function deriveOwnTensionHint(ctx: DerivationContext): DerivedSignal[] {
  const draft = ctx.draftContext;
  if (!draft) return [];
  if (draft.relationToTarget !== 'builds_on') return [];
  if (!ctx.nodesById.has(draft.targetArgumentId)) return [];
  const tensionNode = draft.priorOwnNodeIds.find((id) =>
    hasAnyFlag(ctx, id, ['disagrees_on_facts', 'disagrees_on_scope']),
  );
  if (!tensionNode) return [];
  return [
    freezeSignal({
      code: 'own_tension_hint',
      advisory: true,
      authoritative: false,
      neverAffectsStanding: true,
      scope: { kind: 'node', argumentId: draft.targetArgumentId },
      consumers: CONSUMERS_OWN_TENSION_HINT,
      composerOnly: true,
      provenance: {
        contributingFlagKeys: Object.freeze(['builds_on_point', 'disagrees_on_facts']),
        contributingMarkCodes: Object.freeze([]),
        contributingDebtKinds: Object.freeze([]),
        heatBand: null,
        note: 'This draft builds on a point you earlier disagreed with; reconcile or branch.',
      },
    }),
  ];
}

// ── 5.7 dodge_chain (marks x A, thread-weighted) ─────────────────────

const A_ATTACH_KEYS: readonly FriendlyFlagKey[] = ['direct_challenge', 'builds_on_point'];

function deriveDodgeChain(ctx: DerivationContext): DerivedSignal[] {
  const out: DerivedSignal[] = [];
  const clusters = clustersWithin(ctx, false);
  const orderedKeys = [...clusters.keys()].sort(compareStrings);
  for (const branchRootId of orderedKeys) {
    const members = clusters.get(branchRootId)!;
    const unaddressed = members
      .filter((n) => ctx.unaddressedSet.has(n.argumentId))
      .sort((a, b) => a.ordinal - b.ordinal || compareStrings(a.argumentId, b.argumentId));
    if (unaddressed.length < 2) continue;
    // Doc 5.7 edge: A-family shows "replies attach elsewhere".
    const attachesElsewhere = unaddressed.some((n) => hasAnyFlag(ctx, n.argumentId, A_ATTACH_KEYS));
    if (!attachesElsewhere) continue;
    out.push(
      freezeSignal({
        code: 'dodge_chain',
        advisory: true,
        authoritative: false,
        neverAffectsStanding: true,
        scope: {
          kind: 'thread',
          anchorArgumentId: branchRootId,
          pointId: branchRootId,
          memberArgumentIds: Object.freeze(unaddressed.map((n) => n.argumentId)),
        },
        consumers: CONSUMERS_DODGE_CHAIN,
        composerOnly: false,
        provenance: {
          contributingFlagKeys: Object.freeze(['direct_challenge']),
          contributingMarkCodes: Object.freeze(['did_not_address']),
          contributingDebtKinds: Object.freeze([]),
          heatBand: null,
          note: 'Two or more moves on this point are marked unanswered while replies attach elsewhere.',
        },
      }),
    );
  }
  return out;
}

// ── Orchestrator ─────────────────────────────────────────────────────

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function scopeSortKey(signal: DerivedSignal): string {
  const s = signal.scope;
  if (s.kind === 'node') return s.argumentId;
  if (s.kind === 'thread') return s.pointId;
  return s.debateId;
}

/**
 * The pure fold. Builds the shared friendly-flag / marks / debt maps once, runs
 * the seven independent predicate derivers, concatenates, freezes, and sorts by
 * (code, scope-id). Deterministic regardless of input order.
 */
export function deriveDerivedObservationSignals(
  input: DeriveDerivedSignalsInput,
): readonly DerivedSignal[] {
  const windowSize =
    typeof input.windowSize === 'number' && input.windowSize > 0
      ? Math.floor(input.windowSize)
      : DERIVED_SIGNAL_WINDOW;

  const nodesSorted = [...(input.nodes ?? [])].sort(
    (a, b) => a.ordinal - b.ordinal || compareStrings(a.argumentId, b.argumentId),
  );
  const nodesById = new Map<string, DerivedSignalNodeInput>();
  const childrenByParent = new Map<string, DerivedSignalNodeInput[]>();
  for (const n of nodesSorted) {
    nodesById.set(n.argumentId, n);
  }
  for (const n of nodesSorted) {
    if (n.parentId && nodesById.has(n.parentId)) {
      const arr = childrenByParent.get(n.parentId);
      if (arr) arr.push(n);
      else childrenByParent.set(n.parentId, [n]);
    }
  }

  // Friendly-flag set per node (the composition currency).
  const flagsByNode = new Map<string, Set<FriendlyFlagKey>>();
  const obsByArg = input.observationsByArgumentId ?? {};
  for (const n of nodesSorted) {
    const rows = obsByArg[n.argumentId] ?? [];
    if (rows.length === 0) continue;
    const flags = friendlyFlagsFor(rows);
    if (flags.length === 0) continue;
    flagsByNode.set(n.argumentId, new Set(flags.map((f) => f.key)));
  }

  // Marks aggregate (defensive on the flag-off empty path).
  const marksAgg = deriveMoveMarkAggregate(input.moveMarks ?? []);
  const unaddressedSet = new Set(marksAgg.unaddressedMoveIds);
  const receiptsRequestedSet = new Set(Object.keys(marksAgg.receiptsRequestedByArgumentId));

  // Open source|quote debts per node + total open debt count (all kinds).
  const openSourceQuoteDebtsByNode = new Map<string, EvidenceDebt[]>();
  let openDebtCountRoom = 0;
  for (const debt of input.evidenceDebts ?? []) {
    if (!OPEN_STATUS_SET.has(debt.status)) continue;
    openDebtCountRoom += 1;
    if (!SOURCE_QUOTE_KINDS.has(debt.debtKind)) continue;
    const arr = openSourceQuoteDebtsByNode.get(debt.nodeId);
    if (arr) arr.push(debt);
    else openSourceQuoteDebtsByNode.set(debt.nodeId, [debt]);
  }

  const ctx: DerivationContext = {
    debateId: input.debateId,
    nodesSorted,
    nodesById,
    childrenByParent,
    flagsByNode,
    unaddressedSet,
    receiptsRequestedSet,
    openSourceQuoteDebtsByNode,
    openDebtCountRoom,
    heatBand: input.heatBand ?? null,
    draftContext: input.draftContext ?? null,
    windowSize,
  };

  const all: DerivedSignal[] = [
    ...deriveProofMoment(ctx),
    ...deriveHotButProofLight(ctx),
    ...deriveTalkingPast(ctx),
    ...deriveResolutionWindow(ctx),
    ...deriveCallbackWorthy(ctx),
    ...deriveOwnTensionHint(ctx),
    ...deriveDodgeChain(ctx),
  ];

  all.sort((a, b) => {
    if (a.code !== b.code) return compareStrings(a.code, b.code);
    return compareStrings(scopeSortKey(a), scopeSortKey(b));
  });

  return Object.freeze(all);
}
