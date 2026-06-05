/**
 * ADMIN-ARGS-CANONICAL-001 — Canonical Argument-Artifact grouping view-model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO `fetch` import. This is the
 * argument-level analogue of the debate-level dedupe that the Stage 6.3
 * Conversation Gallery already ships in
 * `src/features/debates/conversationGalleryModel.ts`. That module is the
 * pattern we MIRROR here (its `cleanTitleForDedupe` / `SUFFIX_TAG_PATTERNS` /
 * `dedupeConversationCards` primary-by-latest-activity + collapsed-count
 * shape); we do NOT import from or edit it.
 *
 * Doctrine (design §7/§8, cdiscourse-doctrine §1/§3/§8/§9/§10a):
 *   - `isInactive` is DERIVED from `inactiveAt` ONLY (NULL/absent ⇒ active).
 *     It NEVER reads `inactiveReason`.
 *   - `inactiveReason` is NOT a field on `ArgumentRevision` or
 *     `ArgumentArtifact`. It is never read in this module and never reaches
 *     any rendered surface (§10a — composer-only admin free text).
 *   - No-resurrect invariant: each revision derives its `isInactive`
 *     independently; the artifact OR-folds for the badge only. An active
 *     sibling NEVER clears an inactive child's state.
 *   - Read path / presentation grouping only. No row hidden, hard-deleted,
 *     or rewritten. No truth/popularity/verdict field.
 *
 * This card touches the admin READ path only — it adds zero classifier, zero
 * submit-path, zero routing, zero MCP behavior. The deterministic rules
 * engine (`src/lib/constitution/engine.ts`) remains the sole submission
 * acceptance gate; classifiers run after an argument is stored.
 */

// ── Input shape ──────────────────────────────────────────────────────────
//
// Inputs are `AdminArgumentRow[]` (admin surfaces) and structurally-
// compatible `ArgumentRow[]` (user/gallery surfaces). We read ONLY the
// fields below — never `inactiveReason`, never a body-rewrite, never a
// truth/score field. The structural input type keeps the model decoupled
// from the admin/domain row types (no import cycle, no React/Supabase pull).

export interface ArtifactSourceRow {
  id: string;
  debateId: string;
  debateTitle?: string | null;
  authorId?: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** DERIVED-source ONLY. NULL/absent ⇒ active. Never `inactiveReason`. */
  inactiveAt?: string | null;
  /**
   * Existing user-applied tag codes carried by `AdminArgumentRow`. Structural,
   * no verdict tokens. Absent on the domain `ArgumentRow` shape (treated as
   * none). NEVER a truth/score field.
   */
  selectedTagCodes?: string[] | null;
  /**
   * Existing per-argument observation-coverage, IF available on the source
   * row. Sourced verbatim — never fabricated. When absent at build time the
   * artifact renders `{ covered: 0, total: 0 }` which the UI maps to `n/a`
   * (design §4-T green-on-absent guard / Open Q2).
   */
  observationCoverage?: { covered: number; total: number } | null;
}

// ── Output types (design §8 — EXACT). NO `inactiveReason` on either. ──────

export interface ArgumentRevision {
  /** The source row id. */
  revisionId: string;
  body: string;
  updatedAt: string;
  createdAt: string;
  /** DERIVED: (row.inactiveAt ?? null) !== null. NEVER reads inactiveReason. */
  isInactive: boolean;
}

export interface ArgumentArtifact {
  /** Chosen grouping key (option a precedence in design §6). */
  artifactId: string;
  /** Body of the revision with max(updatedAt). */
  latestBody: string;
  authorId: string | null;
  debateId: string;
  debateTitle: string | null;
  latestUpdatedAt: string;
  /** min(createdAt) across revisions. */
  createdAt: string;
  /** Structural; rendered "N updates". revisions.length - 1. */
  updateCount: number;
  /** Structural coverage count, rendered "5/7 observations" (or "n/a"). */
  observationCount: { covered: number; total: number };
  /** Structural; rendered "N duplicate runs collapsed". */
  duplicateRunCount: number;
  /** Existing derived qualifier labels (no verdict tokens). */
  qualifiers: string[];
  /** DERIVED: revisions.some(r => r.isInactive). Never reads inactiveReason. */
  isInactive: boolean;
  revisions: ArgumentRevision[];
}

export type ArtifactSortDirection = 'desc' | 'asc';

// ── inactive derivation (the single named helper; §10a load-bearing) ──────

/**
 * The ONLY path by which any `isInactive` value is produced. `isInactive` is
 * derived from `inactiveAt` ONLY — NULL/absent ⇒ active. It NEVER reads
 * `inactiveReason` (which is not even a field on the input we accept).
 */
export function deriveRevisionIsInactive(row: { inactiveAt?: string | null }): boolean {
  return (row.inactiveAt ?? null) !== null;
}

// ── Title-suffix dedupe (mirrors conversationGalleryModel, NOT imported) ──
//
// Mirror of conversationGalleryModel.ts:437-455 SUFFIX_TAG_PATTERNS +
// cleanTitleForDedupe. Kept local so this module stays decoupled; the
// gallery module is the pattern source, not a dependency.

const SUFFIX_TAG_PATTERNS = [
  /\s*\[(?:xai-adv|ai-corpus|stress|stage-\d+(?:\.\d+)*|run-\d+|scenario-\d+|seed-\d+)\b[^\]]*\]\s*$/i,
  /\s*\[(?:xai|ai|bot|corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*\]\s*$/i,
  /\s*\([\w\d\s\-_:.,#]*?(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*?\)\s*$/i,
  /\s*#(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d_-]+\s*$/i,
];

function normaliseWhitespace(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Strip the corpus-runner suffix tags from a debate title so cross-room
 * `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` siblings fold together.
 * Mirrors `conversationGalleryModel.cleanTitleForDedupe`.
 */
export function cleanArtifactTitleForDedupe(title: string | null | undefined): string {
  let t = normaliseWhitespace(title ?? '');
  for (let i = 0; i < 3 && t.length > 0; i++) {
    let changed = false;
    for (const re of SUFFIX_TAG_PATTERNS) {
      const next = t.replace(re, '');
      if (next !== t) {
        t = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return t;
}

function normaliseBodyExcerptForDedupe(body: string): string {
  return normaliseWhitespace(body).toLowerCase().slice(0, 220);
}

// ── Grouping-key precedence (design §6 option a) ──────────────────────────
//
//   (1) The row's own `id` is the artifact key when the surface's
//       "duplicate rows" are UPDATES of one logical argument
//       (updatedAt !== createdAt). The recommended primary key.
//   (2) Title-suffix-stripped lineage on the carried `debateTitle` folds
//       cross-room corpus siblings.
//   (3) Fallback derived key (`debateId` + normalized body excerpt) only
//       when neither above applies.

function deriveArtifactKey(row: ArtifactSourceRow): string {
  // (1) An updated row (updatedAt !== createdAt) is treated as a revision of
  //     one logical argument keyed by its own id. Routing is unchanged: the
  //     deep-link route key is `argument_id` and `artifactId` IS that id.
  const updated = Boolean(row.updatedAt) && row.updatedAt !== row.createdAt;
  if (updated) {
    return `id:${row.id}`;
  }
  // (2) Cross-room corpus siblings fold via the suffix-stripped title.
  const cleanedTitle = cleanArtifactTitleForDedupe(row.debateTitle ?? '');
  if (cleanedTitle.length > 0) {
    return `title:${cleanedTitle.toLowerCase()}::body:${normaliseBodyExcerptForDedupe(row.body)}`;
  }
  // (3) Fallback derived key: debateId + normalized body excerpt.
  return `room:${row.debateId}::body:${normaliseBodyExcerptForDedupe(row.body)}`;
}

function toRevision(row: ArtifactSourceRow): ArgumentRevision {
  return {
    revisionId: row.id,
    body: row.body,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
    isInactive: deriveRevisionIsInactive(row),
  };
}

function timeMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Group `ArtifactSourceRow[]` into one `ArgumentArtifact` per logical
 * argument. Deterministic: same input → JSON-equal output.
 *
 * Each revision derives its own `isInactive` from `inactiveAt`; the artifact
 * OR-folds `isInactive` for the badge only and never clears a child's state
 * (no-resurrect invariant, design §7/§99). `inactiveReason` is never read.
 */
export function groupArgumentsIntoArtifacts(rows: ArtifactSourceRow[]): ArgumentArtifact[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Stable first-seen ordering of keys so output is deterministic regardless
  // of Map iteration nuances; revisions accumulate per key.
  const order: string[] = [];
  const groups = new Map<string, ArtifactSourceRow[]>();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string') continue;
    const key = deriveArtifactKey(row);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
      order.push(key);
    }
    bucket.push(row);
  }

  const artifacts: ArgumentArtifact[] = [];
  for (const key of order) {
    const bucket = groups.get(key)!;
    // Deterministic revision ordering: by updatedAt asc, then createdAt asc,
    // then id asc. The "latest" revision is the last after this sort.
    const sorted = bucket.slice().sort((a, b) => {
      const u = timeMs(a.updatedAt) - timeMs(b.updatedAt);
      if (u !== 0) return u;
      const c = timeMs(a.createdAt) - timeMs(b.createdAt);
      if (c !== 0) return c;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const revisions = sorted.map(toRevision);
    const latest = sorted[sorted.length - 1];

    // min(createdAt) across revisions for the artifact's createdAt.
    let minCreated = sorted[0].createdAt;
    let minCreatedMs = timeMs(minCreated);
    for (const r of sorted) {
      const ms = timeMs(r.createdAt);
      if (ms < minCreatedMs) {
        minCreatedMs = ms;
        minCreated = r.createdAt;
      }
    }

    // Observation coverage is sourced verbatim from the latest revision's
    // source row IF present; otherwise {0,0} (UI maps to "n/a"). Never
    // fabricated (design §4-T / Open Q2).
    const cov = latest.observationCoverage;
    const observationCount = cov && typeof cov.covered === 'number' && typeof cov.total === 'number'
      ? { covered: cov.covered, total: cov.total }
      : { covered: 0, total: 0 };

    // Qualifiers: union of the existing user-applied tag codes across
    // revisions, de-duplicated, order-preserved. Structural — no verdict
    // tokens. Absent ⇒ empty.
    const qualifiers: string[] = [];
    const seenQualifiers = new Set<string>();
    for (const r of sorted) {
      for (const code of r.selectedTagCodes ?? []) {
        if (typeof code === 'string' && code.length > 0 && !seenQualifiers.has(code)) {
          seenQualifiers.add(code);
          qualifiers.push(code);
        }
      }
    }

    artifacts.push({
      artifactId: key,
      latestBody: latest.body,
      authorId: latest.authorId ?? null,
      debateId: latest.debateId,
      debateTitle: latest.debateTitle ?? null,
      latestUpdatedAt: latest.updatedAt,
      createdAt: minCreated,
      updateCount: Math.max(0, revisions.length - 1),
      observationCount,
      // "duplicate runs collapsed" = sibling source rows beyond the first.
      duplicateRunCount: Math.max(0, revisions.length - 1),
      qualifiers,
      // OR-fold for the badge ONLY. Never clears a child's inactive state.
      isInactive: revisions.some((r) => r.isInactive),
      revisions,
    });
  }

  return artifacts;
}

/**
 * Sort artifacts by latest activity. Stable, deterministic. `desc` (default)
 * puts the most recently active artifact first.
 */
export function sortArtifactsByLatestActivity(
  artifacts: ArgumentArtifact[],
  direction: ArtifactSortDirection = 'desc',
): ArgumentArtifact[] {
  const arr = artifacts.slice();
  arr.sort((a, b) => {
    const delta = timeMs(a.latestUpdatedAt) - timeMs(b.latestUpdatedAt);
    if (delta !== 0) return direction === 'asc' ? delta : -delta;
    // Tie-break on artifactId for determinism.
    if (a.artifactId < b.artifactId) return -1;
    if (a.artifactId > b.artifactId) return 1;
    return 0;
  });
  return arr;
}

/**
 * Filter artifacts by a free-text query over the latest body, debate title,
 * and qualifier codes. Empty / whitespace query returns the input unchanged.
 */
export function filterArtifactsByQuery(
  artifacts: ArgumentArtifact[],
  query: string,
): ArgumentArtifact[] {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return artifacts.slice();
  return artifacts.filter((a) => {
    if (a.latestBody.toLowerCase().includes(needle)) return true;
    if ((a.debateTitle ?? '').toLowerCase().includes(needle)) return true;
    for (const q of a.qualifiers) {
      if (q.toLowerCase().includes(needle)) return true;
    }
    return false;
  });
}
