/**
 * UX-001.5A — User Allegation registry.
 *
 * 10 entries — one per `ManualTagCode` from `ALL_MANUAL_TAG_CODES`
 * (`src/features/metadata/moveMetadataLedger.ts:91-115`). Each entry is
 * frozen at module load. Plain labels are sourced verbatim from
 * `getManualTagPlainLabel` which already passes the META-001 ban-list
 * doctrine scan.
 *
 * Per design §5: every entry has `kind: 'user_allegation'`,
 * `source: 'manual_tag'`, `defaultSurface: 'timeline_node'`,
 * `disposition: 'rendered_now'`, and `visibleByDefault: true`. User
 * Allegations represent participant-applied tags — provenance is always
 * preserved (rendered as `source: 'user'` on the descriptor, prefixed
 * `User allegation:` in the ariaLabel).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — Allegations are user-applied; never
 *     collapsed into Observations.
 *   - META-001 — labels routed through `PLAIN_LANGUAGE_COPY`.
 *   - No verdict / amplification / person tokens (test file 9 enforces).
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import {
  ALL_MANUAL_TAG_CODES,
  getManualTagPlainLabel,
  type ManualTagCode,
} from '../metadata/moveMetadataLedger';
import type { NodeLabelMark } from './nodeLabelTypes';

interface UserAllegationEntryBuilder {
  rawKey: ManualTagCode;
  shortLabel: string;
  description: string;
  priority: number;
}

function toMark(b: UserAllegationEntryBuilder): NodeLabelMark {
  return Object.freeze({
    id: `registry:user_allegation:manual_tag:${b.rawKey}`,
    rawKey: b.rawKey,
    kind: 'user_allegation' as const,
    source: 'manual_tag' as const,
    label: getManualTagPlainLabel(b.rawKey),
    shortLabel: b.shortLabel,
    description: b.description,
    defaultSurface: 'timeline_node' as const,
    disposition: 'rendered_now' as const,
    priority: b.priority,
    visibleByDefault: true,
  });
}

// ── 10 manual tag entries (source: 'manual_tag') ──────────────────

const USER_ALLEGATION_ENTRIES: ReadonlyArray<UserAllegationEntryBuilder> = [
  {
    rawKey: 'needs_source',
    shortLabel: 'Needs src',
    description: 'A participant has flagged this move as needing a source.',
    priority: 10,
  },
  {
    rawKey: 'needs_quote',
    shortLabel: 'Needs quote',
    description: 'A participant has flagged this move as needing a direct quote.',
    priority: 11,
  },
  {
    rawKey: 'definition_issue',
    shortLabel: 'Defn fight',
    description: 'A participant has flagged a definition dispute on this move.',
    priority: 12,
  },
  {
    rawKey: 'scope_issue',
    shortLabel: 'Scope',
    description: 'A participant has flagged a scope challenge on this move.',
    priority: 13,
  },
  {
    rawKey: 'causal_mechanism',
    shortLabel: 'Mechanism',
    description: 'A participant has flagged a mechanism challenge on this move.',
    priority: 14,
  },
  {
    rawKey: 'evidence_debt',
    shortLabel: 'Debt',
    description: 'A participant has flagged this move as carrying evidence debt.',
    priority: 15,
  },
  {
    rawKey: 'concession_offered',
    shortLabel: 'Conceded',
    description: 'A participant has marked this move as a concession.',
    priority: 16,
  },
  {
    rawKey: 'narrowed_claim',
    shortLabel: 'Narrowed',
    description: 'A participant has marked this move as narrowing the claim.',
    priority: 17,
  },
  {
    rawKey: 'tangent',
    shortLabel: 'Tangent',
    description: 'A participant has flagged this move as a tangent or side issue.',
    priority: 18,
  },
  {
    rawKey: 'ready_for_synthesis',
    shortLabel: 'Synthesis',
    description: 'A participant has marked this move as ready for synthesis.',
    priority: 19,
  },
];

// ── Compose the frozen registry ───────────────────────────────────

function buildRegistry(): Readonly<Record<ManualTagCode, NodeLabelMark>> {
  // Start with a typed accumulator; cast happens at the freeze boundary.
  const map: Partial<Record<ManualTagCode, NodeLabelMark>> = {};
  for (const e of USER_ALLEGATION_ENTRIES) {
    map[e.rawKey] = toMark(e);
  }
  return Object.freeze(map as Record<ManualTagCode, NodeLabelMark>);
}

/**
 * UX-001.5A — Frozen registry of 10 User Allegation entries (one per
 * `ManualTagCode`). Adapters look up via this registry to convert a
 * `ManualTagEntry` into a `NodeLabelMark`.
 *
 * Pure TS. JSON-serializable. Frozen.
 */
export const USER_ALLEGATION_REGISTRY: Readonly<Record<ManualTagCode, NodeLabelMark>> =
  buildRegistry();

/** Frozen list of every `ManualTagCode` in the registry. */
export const ALL_USER_ALLEGATION_RAW_KEYS: ReadonlyArray<ManualTagCode> = Object.freeze(
  ALL_MANUAL_TAG_CODES.slice(),
);

/** Lookup a User Allegation entry by `ManualTagCode`. Returns null when absent. */
export function getUserAllegationByRawKey(code: string): NodeLabelMark | null {
  if (typeof code !== 'string' || code.length === 0) return null;
  // Bounded cast — registry keys are exactly `ManualTagCode`. Foreign codes
  // produce undefined → null.
  return USER_ALLEGATION_REGISTRY[code as ManualTagCode] ?? null;
}

/** Type guard — true when the code is a known `ManualTagCode`. */
export function isKnownUserAllegationRawKey(code: string): boolean {
  if (typeof code !== 'string' || code.length === 0) return false;
  return Object.prototype.hasOwnProperty.call(USER_ALLEGATION_REGISTRY, code);
}
