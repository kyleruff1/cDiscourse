/**
 * AN-001 — Deterministic board diagnostics (pure TypeScript).
 *
 * Dev / debug readout of a debate board's shape. Used for UI tests, a
 * future operator-only debug panel, and any tooling that needs a stable
 * snapshot of the board without round-tripping through a renderer.
 *
 * NEVER:
 *   - calls AI (Anthropic, xAI, OpenAI, X)
 *   - calls Supabase / network
 *   - writes to the DB
 *   - labels users (no winner / loser / liar / dishonest / extremist tokens)
 *
 * The model is deterministic given identical input: same arguments + flags
 * + tags + `nowMs` always produce the same `BoardDiagnostics`. Tests rely
 * on this — never replace any branch with a random / time-of-day signal.
 *
 * Counts and zones are advisory. They are NOT a score and NOT a truth
 * value; they exist so an operator can answer "what does the board look
 * like right now?" without scrubbing the UI.
 */

import { inferStandingBand, type TimelineStandingBand } from '../arguments/argumentGameSurfaceModel';

// ── Input shape ────────────────────────────────────────────────

/**
 * Lightweight argument projection. Matches the subset that the gallery
 * model already accepts so callers can feed either source straight in.
 */
export interface BoardDiagnosticsArgumentInput {
  id: string;
  debateId: string;
  parentId: string | null;
  authorId: string | null;
  argumentType: string | null;
  body: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface BoardDiagnosticsInput {
  arguments: BoardDiagnosticsArgumentInput[];
  /** Per-argument flag codes (e.g., from `argument_flags`). */
  flagsByArgumentId?: Record<string, string[]>;
  /** Per-argument tag codes (e.g., from `argument_tags`). */
  tagsByArgumentId?: Record<string, string[]>;
  /** Optional per-argument lexical topic score in [0, 1]. */
  topicScoreByArgumentId?: Record<string, number>;
  /** Injected `now` in ms for deterministic tests. Defaults to `Date.now()`. */
  nowMs?: number;
  /** Minimum chain depth (root = 0) for a leaf to qualify as a hot zone. Default 3. */
  hotZoneMinDepth?: number;
  /** Maximum age (ms) of the latest message in a chain for the chain to count as hot. Default 1 hour. */
  hotZoneRecencyMs?: number;
  /** Maximum unresolved axes to return in `unresolvedAxes`. Default 10. */
  maxUnresolvedAxes?: number;
  /** Maximum hot zones to return in `hotZones`. Default 10. */
  maxHotZones?: number;
}

// ── Output shape ───────────────────────────────────────────────

export interface BoardDiagnosticsHotZone {
  /** Leaf message id of the chain. */
  leafArgumentId: string;
  /** Root message id of the chain. */
  rootArgumentId: string;
  /** Depth from the root, where root has depth 0. */
  depth: number;
  /** Number of messages in the chain (root + descendants on the path to leaf). */
  chainLength: number;
  /** Latest activity timestamp (ms since epoch) for any message in the chain. */
  latestActivityMs: number;
  /** Age of the latest activity from `nowMs`, in ms. */
  ageMs: number;
}

export interface BoardDiagnosticsUnresolvedAxis {
  /** Argument id that opened the axis (a challenge / ask_source / disagree / question). */
  challengeArgumentId: string;
  /** The challenge's argument type, lowercased. */
  argumentType: string;
  /** Number of descendant messages under the challenge. */
  descendantCount: number;
  /** True if the descendants include a concession or synthesis. */
  hasConcession: boolean;
  /** True if the descendants include an evidence post (sourced). */
  hasEvidenceReply: boolean;
  /** Age of the challenge (ms) from `nowMs`. */
  ageMs: number;
}

export interface BoardDiagnostics {
  totalMessages: number;
  rootCount: number;
  rebuttalCount: number;
  noRebuttalRootCount: number;

  evidenceCount: number;
  branchCount: number;
  synthesisReadyCount: number;
  concessionCount: number;
  clarificationCount: number;

  evidenceDebtCount: number;

  strongCount: number;
  weakCount: number;
  neutralCount: number;
  notEnoughSignalCount: number;
  standingBandCounts: Record<TimelineStandingBand, number>;

  hotZones: BoardDiagnosticsHotZone[];
  hotZoneCount: number;

  unresolvedAxes: BoardDiagnosticsUnresolvedAxis[];
  unresolvedAxisCount: number;

  /** Pure-model fingerprint of the input shape (count-based, no PII). Useful for change-detection. */
  fingerprint: string;
}

// ── Constants ──────────────────────────────────────────────────

const DEFAULT_HOT_ZONE_MIN_DEPTH = 3;
const DEFAULT_HOT_ZONE_RECENCY_MS = 60 * 60 * 1000;
const DEFAULT_MAX_UNRESOLVED_AXES = 10;
const DEFAULT_MAX_HOT_ZONES = 10;

const STRONG_BANDS: ReadonlyArray<TimelineStandingBand> = ['pretty_right', 'completely_right'];
const WEAK_BANDS: ReadonlyArray<TimelineStandingBand> = ['pretty_wrong', 'slightly_wrong'];

const EVIDENCE_ARG_TYPES = new Set(['evidence', 'source', 'receipt']);
const BRANCH_ARG_TYPES = new Set(['branch', 'split_branch', 'tangent']);
const CONCESSION_ARG_TYPES = new Set(['concession', 'synthesis', 'narrow']);
const CLARIFICATION_ARG_TYPES = new Set(['clarification_request', 'question', 'clarify', 'ask_source', 'ask_quote']);
const CHALLENGE_ARG_TYPES = new Set([
  'rebuttal',
  'counter_rebuttal',
  'disagree',
  'challenge',
  'clarification_request',
  'question',
  'ask_source',
  'ask_quote',
]);

const EVIDENCE_DEBT_FLAG_CODES = new Set([
  'evidence_required',
  'evidence_debt',
  'platform_support_warning',
  'amplification_observed',
  'source_chain',
]);

const SYNTHESIS_READY_TAG_CODES = new Set(['synthesis_ready', 'near_resolution']);

// ── Helpers ────────────────────────────────────────────────────

function lc(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase();
}

function safeMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function hasAnyCode(codes: string[] | undefined, set: Set<string>): boolean {
  if (!codes || codes.length === 0) return false;
  for (const c of codes) {
    if (set.has(lc(c))) return true;
  }
  return false;
}

function emptyStandingCounts(): Record<TimelineStandingBand, number> {
  return {
    pretty_wrong: 0,
    slightly_wrong: 0,
    neutral: 0,
    slightly_right: 0,
    maybe_right_misguided: 0,
    pretty_right: 0,
    completely_right: 0,
    unscored: 0,
    not_enough_signal: 0,
  };
}

// FNV-1a 32-bit. Stable across runs; small enough to embed in a fingerprint string.
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── Main entry point ─────────────────────────────────────────────

export function computeBoardDiagnostics(input: BoardDiagnosticsInput): BoardDiagnostics {
  const args = input.arguments || [];
  const flags = input.flagsByArgumentId || {};
  const tags = input.tagsByArgumentId || {};
  const topicScores = input.topicScoreByArgumentId || {};
  const now = typeof input.nowMs === 'number' ? input.nowMs : Date.now();
  const hotMinDepth = input.hotZoneMinDepth ?? DEFAULT_HOT_ZONE_MIN_DEPTH;
  const hotRecencyMs = input.hotZoneRecencyMs ?? DEFAULT_HOT_ZONE_RECENCY_MS;
  const maxAxes = input.maxUnresolvedAxes ?? DEFAULT_MAX_UNRESOLVED_AXES;
  const maxHot = input.maxHotZones ?? DEFAULT_MAX_HOT_ZONES;

  const byId = new Map<string, BoardDiagnosticsArgumentInput>();
  const childrenByParentId = new Map<string, string[]>();
  for (const a of args) {
    byId.set(a.id, a);
    const p = a.parentId;
    if (p) {
      const list = childrenByParentId.get(p);
      if (list) list.push(a.id);
      else childrenByParentId.set(p, [a.id]);
    }
  }

  // ── Counts ───────────────────────────────────────────────────
  let rootCount = 0;
  let rebuttalCount = 0;
  let evidenceCount = 0;
  let branchCount = 0;
  let synthesisReadyCount = 0;
  let concessionCount = 0;
  let clarificationCount = 0;
  let evidenceDebtCount = 0;
  let strongCount = 0;
  let weakCount = 0;
  let neutralCount = 0;
  let notEnoughSignalCount = 0;
  const standingBandCounts = emptyStandingCounts();

  for (const a of args) {
    const t = lc(a.argumentType);
    if (a.parentId == null) rootCount++;
    else rebuttalCount++;

    if (EVIDENCE_ARG_TYPES.has(t)) evidenceCount++;
    if (BRANCH_ARG_TYPES.has(t)) branchCount++;
    if (CONCESSION_ARG_TYPES.has(t)) concessionCount++;
    if (CLARIFICATION_ARG_TYPES.has(t)) clarificationCount++;

    const tagCodes = tags[a.id] || [];
    if (t === 'synthesis' || hasAnyCode(tagCodes, SYNTHESIS_READY_TAG_CODES)) synthesisReadyCount++;

    const flagCodes = flags[a.id] || [];
    if (hasAnyCode(flagCodes, EVIDENCE_DEBT_FLAG_CODES)) evidenceDebtCount++;

    const band = inferStandingBand({
      flagCodes,
      hasEvidence: EVIDENCE_ARG_TYPES.has(t),
      bodyLength: (a.body || '').length,
      topicScore: typeof topicScores[a.id] === 'number' ? topicScores[a.id] : null,
      tagCodes,
      argumentType: t,
    });
    standingBandCounts[band]++;
    if ((STRONG_BANDS as ReadonlyArray<string>).includes(band)) strongCount++;
    if ((WEAK_BANDS as ReadonlyArray<string>).includes(band)) weakCount++;
    if (band === 'neutral') neutralCount++;
    if (band === 'not_enough_signal') notEnoughSignalCount++;
  }

  // ── No-rebuttal roots ─────────────────────────────────────────
  let noRebuttalRootCount = 0;
  for (const a of args) {
    if (a.parentId != null) continue;
    const kids = childrenByParentId.get(a.id);
    if (!kids || kids.length === 0) noRebuttalRootCount++;
  }

  // ── Hot zones ────────────────────────────────────────────────
  const hotZones: BoardDiagnosticsHotZone[] = [];
  const leafIds: string[] = [];
  for (const a of args) {
    const kids = childrenByParentId.get(a.id);
    if (!kids || kids.length === 0) leafIds.push(a.id);
  }

  for (const leafId of leafIds) {
    let cursor: BoardDiagnosticsArgumentInput | undefined = byId.get(leafId);
    if (!cursor) continue;
    let depth = 0;
    let latestActivityMs = Math.max(safeMs(cursor.updatedAt), safeMs(cursor.createdAt));
    const visited = new Set<string>();
    while (cursor && cursor.parentId != null) {
      if (visited.has(cursor.id)) break;
      visited.add(cursor.id);
      const parent = byId.get(cursor.parentId);
      if (!parent) break;
      depth++;
      const tmp = Math.max(safeMs(parent.updatedAt), safeMs(parent.createdAt));
      if (tmp > latestActivityMs) latestActivityMs = tmp;
      cursor = parent;
    }
    if (!cursor) continue;
    const rootId = cursor.id;
    const ageMs = Math.max(0, now - latestActivityMs);
    if (depth >= hotMinDepth && ageMs <= hotRecencyMs) {
      hotZones.push({
        leafArgumentId: leafId,
        rootArgumentId: rootId,
        depth,
        chainLength: depth + 1,
        latestActivityMs,
        ageMs,
      });
    }
  }
  hotZones.sort((a, b) => {
    if (a.ageMs !== b.ageMs) return a.ageMs - b.ageMs;
    if (a.depth !== b.depth) return b.depth - a.depth;
    return a.leafArgumentId < b.leafArgumentId ? -1 : 1;
  });
  const trimmedHotZones = hotZones.slice(0, Math.max(0, maxHot));

  // ── Unresolved axes ───────────────────────────────────────────
  const unresolvedAxes: BoardDiagnosticsUnresolvedAxis[] = [];
  for (const a of args) {
    const t = lc(a.argumentType);
    if (!CHALLENGE_ARG_TYPES.has(t)) continue;
    let descendantCount = 0;
    let hasConcession = false;
    let hasEvidenceReply = false;
    const stack = [...(childrenByParentId.get(a.id) || [])];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const child = byId.get(id);
      if (!child) continue;
      descendantCount++;
      const ct = lc(child.argumentType);
      if (CONCESSION_ARG_TYPES.has(ct)) hasConcession = true;
      if (EVIDENCE_ARG_TYPES.has(ct)) hasEvidenceReply = true;
      const grand = childrenByParentId.get(id);
      if (grand) for (const g of grand) stack.push(g);
    }
    if (hasConcession) continue;
    unresolvedAxes.push({
      challengeArgumentId: a.id,
      argumentType: t || 'challenge',
      descendantCount,
      hasConcession,
      hasEvidenceReply,
      ageMs: Math.max(0, now - Math.max(safeMs(a.updatedAt), safeMs(a.createdAt))),
    });
  }
  unresolvedAxes.sort((a, b) => {
    if (a.descendantCount !== b.descendantCount) return b.descendantCount - a.descendantCount;
    if (a.ageMs !== b.ageMs) return b.ageMs - a.ageMs;
    return a.challengeArgumentId < b.challengeArgumentId ? -1 : 1;
  });
  const trimmedAxes = unresolvedAxes.slice(0, Math.max(0, maxAxes));

  // ── Fingerprint ──────────────────────────────────────────────
  const fingerprintInput = [
    args.length,
    rootCount,
    rebuttalCount,
    evidenceCount,
    branchCount,
    synthesisReadyCount,
    concessionCount,
    clarificationCount,
    evidenceDebtCount,
    strongCount,
    weakCount,
    neutralCount,
    notEnoughSignalCount,
    trimmedHotZones.length,
    unresolvedAxes.length,
    hotMinDepth,
    hotRecencyMs,
  ].join(':');

  return {
    totalMessages: args.length,
    rootCount,
    rebuttalCount,
    noRebuttalRootCount,

    evidenceCount,
    branchCount,
    synthesisReadyCount,
    concessionCount,
    clarificationCount,

    evidenceDebtCount,

    strongCount,
    weakCount,
    neutralCount,
    notEnoughSignalCount,
    standingBandCounts,

    hotZones: trimmedHotZones,
    hotZoneCount: hotZones.length,

    unresolvedAxes: trimmedAxes,
    unresolvedAxisCount: unresolvedAxes.length,

    fingerprint: fnv1a(fingerprintInput),
  };
}

// Exported for tests that want to assert on the helper directly.
export const __internal = {
  STRONG_BANDS,
  WEAK_BANDS,
  EVIDENCE_ARG_TYPES,
  BRANCH_ARG_TYPES,
  CONCESSION_ARG_TYPES,
  CLARIFICATION_ARG_TYPES,
  CHALLENGE_ARG_TYPES,
  EVIDENCE_DEBT_FLAG_CODES,
  SYNTHESIS_READY_TAG_CODES,
  fnv1a,
};
