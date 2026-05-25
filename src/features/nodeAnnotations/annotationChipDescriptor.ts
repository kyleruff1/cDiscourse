/**
 * UX-001.5 — Source-neutral annotation chip descriptor (pure TS).
 *
 * The primitive layer's contract for one chip. Source-neutral on purpose:
 * UX-001.5A adds `source` + `category` for the Observations / Allegations
 * presentation. UX-001.5 primitives MUST accept `source` and `category`
 * without rendering changes (forward-compatible).
 *
 * Doctrine:
 *   - Plain language only — labels are user-facing prose, NEVER raw
 *     internal codes (`snake_case` strings are stripped by the
 *     normalizer).
 *   - No verdict / winner / loser / truth copy — primitive layer carries
 *     descriptive information, not judgments.
 *   - No popularity / engagement signal — chips describe the move, not
 *     the audience.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

/**
 * Kind family — drives token color via `annotationKindTokens`. The set
 * is intentionally small (six structural categories) so the chip palette
 * stays predictable. Adding a new kind requires a new entry in
 * `KIND_TOKEN_TABLE` (`annotationKindTokens.ts`).
 */
export type AnnotationChipKind =
  | 'state' // an object's resting state ("active", "settled")
  | 'context' // background / framing info
  | 'lifecycle' // LIFE-001 stage transitions (e.g. "narrowed")
  | 'evidence' // EV-001 attached artifact
  | 'flag' // RULE-001 / RULE-003 advisory note
  | 'semantic'; // MCP-014 semantic referee output

/**
 * Icon hint — drives the optional leading glyph + a secondary border
 * shade in the chip rendering. Non-color carrier of meaning per
 * accessibility-targets §"Color contrast targets". The glyph map lives
 * in `AnnotationChip.tsx`; the border map lives in
 * `annotationKindTokens.ts`.
 */
export type AnnotationChipIconHint =
  | 'info'
  | 'warn'
  | 'check'
  | 'time'
  | 'evidence'
  | 'flag'
  | 'cluster';

/**
 * UX-001.5A forward-compatibility — `source: 'machine' | 'user'` carries
 * the top-level taxonomy ("Observation" vs "Allegation"). UX-001.5A's
 * `NodeLabelKind` uses the suffixed `'machine_observation' |
 * 'user_allegation'`; UX-001.5A's adapter maps `kind → source` with the
 * one-liner `source = kind === 'machine_observation' ? 'machine' : 'user'`.
 * Accepted but not rendered differently by UX-001.5 primitives.
 */
export type AnnotationChipSource = 'machine' | 'user';

/**
 * UX-001.5 — Source-neutral annotation chip descriptor.
 *
 * @see docs/designs/UX-001.5.md §3 — descriptor specification.
 */
export interface AnnotationChipDescriptor {
  /** Stable key for React diffing. Required, non-empty. */
  id: string;

  /**
   * Plain-language label. NO raw internal codes. Routed through
   * `gameCopy.toPlainLanguage` by emitters when sourced from internal
   * classifier IDs / lifecycle codes / manual-tag codes. Required,
   * non-empty after trimming.
   */
  label: string;

  /** Kind family — drives token color via `annotationKindTokens`. */
  kind?: AnnotationChipKind;

  /**
   * Icon hint glyph + tone — drives the optional leading glyph + a
   * secondary border shade. Non-color carrier of meaning.
   */
  iconHint?: AnnotationChipIconHint;

  /**
   * Plain-language explanation; surfaced on tap (composer) or appended
   * to the screen-reader label. NO raw internal codes. Optional.
   */
  tooltip?: string;

  /**
   * Explicit screen-reader label override. When absent the builder
   * `buildAnnotationAriaLabel` composes one from kind + label + tooltip.
   */
  ariaLabel?: string;

  // ── UX-001.5A forward-compatibility slots ─────────────────────────
  //
  // UX-001.5A's roadmap declares two top-level taxonomy values and a
  // source-provenance enum. UX-001.5 primitives accept these fields
  // without altering rendering; UX-001.5A's renderer reads them to
  // group / decorate chips.

  /**
   * UX-001.5A — top-level taxonomy. `'machine'` = Observation;
   * `'user'` = Allegation. Accepted but not rendered differently by
   * UX-001.5 primitives.
   */
  source?: AnnotationChipSource;

  /**
   * UX-001.5A — source provenance. The full taxonomy
   * (`MachineObservationSource | UserAllegationSource`) is defined in
   * UX-001.5A; UX-001.5 accepts any string for forward compatibility.
   */
  category?: string;
}

const ALLOWED_KINDS: ReadonlyArray<AnnotationChipKind> = Object.freeze([
  'state',
  'context',
  'lifecycle',
  'evidence',
  'flag',
  'semantic',
]);

const ALLOWED_ICON_HINTS: ReadonlyArray<AnnotationChipIconHint> = Object.freeze([
  'info',
  'warn',
  'check',
  'time',
  'evidence',
  'flag',
  'cluster',
]);

const ALLOWED_SOURCES: ReadonlyArray<AnnotationChipSource> = Object.freeze([
  'machine',
  'user',
]);

/**
 * Pattern that matches plausible raw internal codes (`snake_case`).
 * The normalizer rejects any label that matches — labels MUST be
 * plain-language prose. This is the doctrine §9 backstop at the
 * descriptor boundary.
 *
 * Matches: `topic_satisfaction_lexical`, `source_chain`,
 * `anti_amplification`, `evidence_debt`, etc.
 */
const SNAKE_CASE_LEAK = /(?:^|\W)[a-z][a-z0-9]*_[a-z0-9_]+(?:$|\W)/;

/**
 * Type guard — true when the value is a valid descriptor.
 *
 * Pure. Returns `false` for `null`, `undefined`, primitives, arrays,
 * and objects missing required fields. Does NOT verify that `label`
 * is plain-language — use `normalizeAnnotationChipDescriptor` for that.
 */
export function isAnnotationChipDescriptor(v: unknown): v is AnnotationChipDescriptor {
  if (v === null || v === undefined) return false;
  if (typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0) return false;
  if (typeof o.label !== 'string' || o.label.length === 0) return false;
  if (o.kind !== undefined && !ALLOWED_KINDS.includes(o.kind as AnnotationChipKind)) {
    return false;
  }
  if (
    o.iconHint !== undefined &&
    !ALLOWED_ICON_HINTS.includes(o.iconHint as AnnotationChipIconHint)
  ) {
    return false;
  }
  if (o.tooltip !== undefined && typeof o.tooltip !== 'string') return false;
  if (o.ariaLabel !== undefined && typeof o.ariaLabel !== 'string') return false;
  if (
    o.source !== undefined &&
    !ALLOWED_SOURCES.includes(o.source as AnnotationChipSource)
  ) {
    return false;
  }
  if (o.category !== undefined && typeof o.category !== 'string') return false;
  return true;
}

/**
 * Defensive normalizer — trims label, suppresses unknown kind / iconHint
 * values, strips snake_case-leak labels (no internal-code leak — doctrine
 * §9). Returns null when:
 *   - input is null / undefined / not an object,
 *   - id is missing or empty after trimming,
 *   - label is missing or empty after trimming,
 *   - label contains a snake_case-leak token.
 *
 * Pure. Does not throw. Frees the caller from having to write defensive
 * checks at every emit site.
 */
export function normalizeAnnotationChipDescriptor(
  d: Partial<AnnotationChipDescriptor> | null | undefined,
): AnnotationChipDescriptor | null {
  if (d === null || d === undefined) return null;
  if (typeof d !== 'object') return null;

  const id = typeof d.id === 'string' ? d.id.trim() : '';
  if (id.length === 0) return null;

  const label = typeof d.label === 'string' ? d.label.trim() : '';
  if (label.length === 0) return null;
  // Doctrine §9 — reject any label that leaks an internal snake_case code.
  if (SNAKE_CASE_LEAK.test(label)) return null;

  const out: AnnotationChipDescriptor = { id, label };

  if (d.kind !== undefined && ALLOWED_KINDS.includes(d.kind)) {
    out.kind = d.kind;
  }
  if (d.iconHint !== undefined && ALLOWED_ICON_HINTS.includes(d.iconHint)) {
    out.iconHint = d.iconHint;
  }
  if (typeof d.tooltip === 'string' && d.tooltip.trim().length > 0) {
    out.tooltip = d.tooltip.trim();
  }
  if (typeof d.ariaLabel === 'string' && d.ariaLabel.trim().length > 0) {
    out.ariaLabel = d.ariaLabel.trim();
  }
  if (d.source !== undefined && ALLOWED_SOURCES.includes(d.source)) {
    out.source = d.source;
  }
  if (typeof d.category === 'string' && d.category.trim().length > 0) {
    out.category = d.category.trim();
  }

  return out;
}

/**
 * The full kind vocabulary — exported for tests + UX-001.5A's adapter.
 * Frozen tuple type for compile-time exhaustiveness.
 */
export const ANNOTATION_CHIP_KINDS = ALLOWED_KINDS;

/**
 * The full iconHint vocabulary — exported for tests + UX-001.5A.
 */
export const ANNOTATION_CHIP_ICON_HINTS = ALLOWED_ICON_HINTS;

/**
 * The full source vocabulary — exported for tests + UX-001.5A.
 */
export const ANNOTATION_CHIP_SOURCES = ALLOWED_SOURCES;
