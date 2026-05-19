/**
 * EV-004 — Evidence symmetry with game rules.
 *
 * Pure-TS visual-symmetry map that turns the nine issue-listed
 * validation / semantic codes into a typed visual descriptor:
 *
 *   {
 *     code:       <typed EvidenceSymmetryCode union member>,
 *     label:      <plain-language label, READ from PLAIN_LANGUAGE_COPY
 *                  via `toPlainLanguage(code)` — NEVER newly authored>,
 *     helperLine: <≤ 80-char single-line tooltip / a11y hint>,
 *     iconHint:   <semantic icon name from RULE-003's IconHint union>,
 *     chipKind:   <semantic chip class — never a verdict glyph>,
 *     edgeStyle:  <rail line treatment override, or null>,
 *     bandKind:   <lifecycle / structural band override, or null>,
 *   }
 *
 * EV-004 is the *visual* sibling of RULE-001 (which is the *tool*
 * sibling) and RULE-003 (which is the *lifecycle UX* sibling). All
 * three describe the same axis vocabulary from three angles; EV-004
 * commits to the chip + edge + band + icon angle.
 *
 * Doctrine constraints encoded here (from `cdiscourse-doctrine`,
 * `evidence-doctrine`, `accessibility-targets`, `timeline-grammar`):
 *
 *   - §1 no truth labels: every label / helperLine is scanned against
 *     the COPY-001 post-hardening verdict ban list (right / wrong /
 *     validated added).
 *   - §2 heat is activity: `hot` is forbidden in helperLines. The
 *     SW-002 carve-out for activity-density does NOT apply here.
 *   - §3 popularity is not evidence: the `anti_amplification`
 *     helperLine pins the doctrine phrase verbatim — "Popularity is
 *     not proof — show the source." The word `Popularity` is the
 *     doctrine vocabulary itself; the ban-list test exempts it for
 *     that one entry exclusively.
 *   - §9 no internal code leak to user surfaces: snake_case bans on
 *     every label + helperLine.
 *   - evidence-doctrine: engagement vs factual-standing separation;
 *     no UI signal conflates popularity / repetition / emotional
 *     intensity with evidence.
 *
 * Reconciliation note — `evidence` vs `evidence_debt`:
 *
 * The issue body uses the shorthand `evidence` ("evidence -> receipt
 * chip + hex shape"). The constitution engine + RULE-001 + META-001
 * + `PLAIN_LANGUAGE_COPY` all use the canonical identifier
 * `evidence_debt`. To preserve "identifiers reused verbatim from the
 * constitution engine", EV-004 commits to `evidence_debt`. The
 * issue's `evidence` shorthand is the same axis.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI, no
 * external dependency. The map is frozen at module load.
 */

import { toPlainLanguage } from '../arguments/gameCopy';
import type { IconHint } from '../rulesUx/lifecycleUxMap';
import { LIFECYCLE_UX_MAP } from '../rulesUx/lifecycleUxMap';

// ── EvidenceSymmetryCode union ────────────────────────────────

/**
 * The nine validation / semantic codes that share a visual axis.
 *
 * Eight of these are *axis-scope* (source_chain, evidence_debt, scope,
 * definition, logic, causal, anti_amplification, synthesis_ready); the
 * ninth (`max_depth_reached`) is a runner-status code that COPY-001 R4
 * routes through the `archived_or_resolved` lifecycle band on
 * normal-user surfaces.
 */
export type EvidenceSymmetryCode =
  | 'source_chain'
  | 'evidence_debt'
  | 'scope'
  | 'definition'
  | 'logic'
  | 'causal'
  | 'anti_amplification'
  | 'synthesis_ready'
  | 'max_depth_reached';

/** Frozen list — tests iterate this to assert coverage parity with the map. */
export const ALL_EVIDENCE_SYMMETRY_CODES: ReadonlyArray<EvidenceSymmetryCode> = Object.freeze([
  'source_chain',
  'evidence_debt',
  'scope',
  'definition',
  'logic',
  'causal',
  'anti_amplification',
  'synthesis_ready',
  'max_depth_reached',
]);

// ── ChipKind union ────────────────────────────────────────────

/**
 * Chip kinds. Each value names a SEMANTIC chip class; consumers
 * pick the actual icon, color, and shape. NEVER a verdict glyph;
 * NEVER an engagement / amplification name; NEVER a
 * person-attribution name.
 */
export type ChipKind =
  | 'source_trail'    // source_chain — issue-named "source trail chip"
  | 'receipt'         // evidence_debt — issue-named "receipt chip"
  | 'scope'           // scope axis chip
  | 'definition'      // definition axis chip
  | 'logic'           // logic axis chip
  | 'mechanism'       // causal axis chip
  | 'amplification'   // anti_amplification axis chip
  | 'synthesis'       // synthesis_ready axis chip
  | 'resolved';       // max_depth_reached — routed to lifecycle band on
                      // normal-user surfaces (R4); chip is admin-debug only.

/** Frozen list — useful for tests + docs. */
export const ALL_CHIP_KINDS: ReadonlyArray<ChipKind> = Object.freeze([
  'source_trail',
  'receipt',
  'scope',
  'definition',
  'logic',
  'mechanism',
  'amplification',
  'synthesis',
  'resolved',
]);

// ── EdgeStyle union ───────────────────────────────────────────

/**
 * Edge styles. Describes the timeline edge running into a node
 * carrying the axis chip. NEVER a verdict-flavored line treatment.
 * `null` (used at the entry level) is the default; most axes do not
 * modify the edge. `kinked` is reserved for future BR-002 / tangent
 * marker cards; EV-004 does not emit it.
 */
export type EdgeStyle =
  | 'dotted'    // source_chain — the issue's "dotted edge"
  | 'solid'     // explicit standard rail (reserved; v1 uses null instead)
  | 'kinked';   // tangent / branch kink — reserved for future cards

/** Frozen list — useful for tests + docs. */
export const ALL_EDGE_STYLES: ReadonlyArray<EdgeStyle> = Object.freeze([
  'dotted',
  'solid',
  'kinked',
]);

// ── BandKind union ────────────────────────────────────────────

/**
 * Band kinds. A "band" is a horizontal strip rendered behind a node
 * OR a cluster header to signal a lifecycle / structural state. NOT
 * a standing band (those live in `argumentScoreModel.StandingBand`).
 * NEVER verdict-flavored.
 */
export type BandKind =
  | 'resolved';   // archived_or_resolved lifecycle — used by R4 for
                  // max_depth_reached → lifecycle band routing.

/** Frozen list — useful for tests + docs. */
export const ALL_BAND_KINDS: ReadonlyArray<BandKind> = Object.freeze([
  'resolved',
]);

// ── EvidenceSymmetryEntry shape ───────────────────────────────

export interface EvidenceSymmetryEntry {
  /** Identical to the EvidenceSymmetryCode enum value — present for round-trip ergonomics. */
  code: EvidenceSymmetryCode;
  /** Read from `toPlainLanguage(code)` at module-load time. NEVER newly authored here. */
  label: string;
  /** ≤ 80 chars. Single-line tooltip / a11y helper. Plain English. */
  helperLine: string;
  /** Reused from RULE-003's `IconHint` union (EV-004 extended it additively with 4 values). */
  iconHint: IconHint;
  /** The chip class consumers render around the axis label. */
  chipKind: ChipKind;
  /** Edge override for the rail INTO the affected node. `null` when no override applies. */
  edgeStyle: EdgeStyle | null;
  /** Lifecycle / structural band rendered behind the node / cluster header. `null` when no band applies. */
  bandKind: BandKind | null;
}

// ── readLabel helper ──────────────────────────────────────────

/**
 * Resolves the plain-language label for an `EvidenceSymmetryCode`
 * through `toPlainLanguage`. Asserts the entry exists; throws a
 * descriptive error if `PLAIN_LANGUAGE_COPY` is missing it. The test
 * suite enforces the invariant at the type level too.
 */
function readLabel(code: EvidenceSymmetryCode): string {
  const label = toPlainLanguage(code);
  if (label === null || label === '') {
    throw new Error(`EV-004: missing PLAIN_LANGUAGE_COPY entry for ${code}`);
  }
  return label;
}

// ── EVIDENCE_SYMMETRY_MAP ─────────────────────────────────────

/**
 * 9 entries — every value in `ALL_EVIDENCE_SYMMETRY_CODES`.
 *
 * `label` is read at module-load time from `toPlainLanguage(code)`.
 * `synthesis_ready` and `max_depth_reached` additionally read their
 * `helperLine` + `iconHint` by-reference from `LIFECYCLE_UX_MAP` so
 * the two surfaces auto-track. The map is frozen, so consumers
 * cannot mutate entries at runtime.
 */
export const EVIDENCE_SYMMETRY_MAP: Readonly<Record<EvidenceSymmetryCode, EvidenceSymmetryEntry>> = Object.freeze({
  source_chain: Object.freeze({
    code: 'source_chain',
    label: readLabel('source_chain'),                        // 'Source trail'
    helperLine: 'Asks where the claim came from.',
    iconHint: 'dotted_hexagon',                              // existing RULE-003 value.
    chipKind: 'source_trail',
    edgeStyle: 'dotted',                                     // the issue-named "dotted edge".
    bandKind: null,
  }),
  evidence_debt: Object.freeze({
    code: 'evidence_debt',
    label: readLabel('evidence_debt'),                       // 'Evidence debt'
    helperLine: 'This line is carrying a claim without receipts yet.',
    iconHint: 'hexagon',                                     // existing — receipt / hex shape.
    chipKind: 'receipt',
    edgeStyle: null,
    bandKind: null,
  }),
  scope: Object.freeze({
    code: 'scope',
    label: readLabel('scope'),                               // 'Scope dispute'
    helperLine: 'The claim is broader than what the evidence covers.',
    iconHint: 'scope_brackets',                              // existing — issue-named "bracket icon".
    chipKind: 'scope',
    edgeStyle: null,
    bandKind: null,
  }),
  definition: Object.freeze({
    code: 'definition',
    label: readLabel('definition'),                          // 'Definition dispute'
    helperLine: 'A term in the claim has not been pinned down.',
    iconHint: 'key_term',                                    // NEW value — issue-named "key-term icon".
    chipKind: 'definition',
    edgeStyle: null,
    bandKind: null,
  }),
  logic: Object.freeze({
    code: 'logic',
    label: readLabel('logic'),                               // 'Logic challenge'
    helperLine: 'The step from premise to conclusion is in question.',
    iconHint: 'logic_chain',                                 // NEW value — issue-named "chain icon".
    chipKind: 'logic',
    edgeStyle: null,
    bandKind: null,
  }),
  causal: Object.freeze({
    code: 'causal',
    label: readLabel('causal'),                              // 'Mechanism challenge'
    helperLine: 'A cause-and-effect claim that needs a mechanism, not just correlation.',
    iconHint: 'causal_arrow',                                // NEW value — issue-named "arrow icon".
    chipKind: 'mechanism',
    edgeStyle: null,
    bandKind: null,
  }),
  anti_amplification: Object.freeze({
    code: 'anti_amplification',
    label: readLabel('anti_amplification'),                  // 'Popularity is not proof'
    // PINNED phrasing — doctrine §3. Any change here intentionally
    // breaks the test in __tests__/evidenceSymmetryMap.test.ts.
    helperLine: 'Popularity is not proof — show the source.',
    iconHint: 'crowd_slash',                                 // NEW value — issue-named "crowd-slash icon".
    chipKind: 'amplification',
    edgeStyle: null,
    bandKind: null,
  }),
  synthesis_ready: Object.freeze({
    code: 'synthesis_ready',
    label: readLabel('synthesis_ready'),                     // 'Ready for synthesis'
    // Parity with RULE-003 — read by-reference. If RULE-003 changes
    // the line, EV-004 follows automatically. Tests assert equality.
    helperLine: LIFECYCLE_UX_MAP.synthesis_ready.helperLine,
    iconHint: LIFECYCLE_UX_MAP.synthesis_ready.iconHint,     // 'eye' — RULE-003 choice.
    chipKind: 'synthesis',
    edgeStyle: null,
    bandKind: null,
  }),
  max_depth_reached: Object.freeze({
    code: 'max_depth_reached',
    label: readLabel('max_depth_reached'),                   // 'Deep unresolved chain'
    // R4 routing — surfaced as lifecycle `archived_or_resolved` on
    // normal-user UI. The helperLine + iconHint describe the
    // lifecycle, not the runner status, so even a non-R4-aware
    // consumer renders the right copy.
    helperLine: LIFECYCLE_UX_MAP.archived_or_resolved.helperLine,
    iconHint: LIFECYCLE_UX_MAP.archived_or_resolved.iconHint, // 'archive_box'
    chipKind: 'resolved',
    edgeStyle: null,
    bandKind: 'resolved',                                    // the issue's "stalemate band" — routed through R4.
  }),
});

// ── Readers ───────────────────────────────────────────────────

/**
 * Direct typed lookup. The type system guarantees `code` is a member
 * of `EvidenceSymmetryCode`; the map is keyed by
 * `Record<EvidenceSymmetryCode, EvidenceSymmetryEntry>` so the
 * lookup is total — NO fallback string, NO runtime branch for
 * unknown codes.
 */
export function getEvidenceSymmetry(code: EvidenceSymmetryCode): EvidenceSymmetryEntry {
  return EVIDENCE_SYMMETRY_MAP[code];
}

/**
 * Defensive variant for callers reading from an untyped source (e.g.
 * an Edge Function response). Normalises case / whitespace / hyphens
 * and returns `null` for unknown codes. No raw snake_case echo, no
 * error string.
 *
 * Mirrors the normalisation surface of `mapRuleToUiAffordanceOrSuppress`
 * in `ruleToUiMap.ts` for symmetry across RULE-001 / EV-004.
 */
export function getEvidenceSymmetryOrSuppress(
  code: string | null | undefined,
): EvidenceSymmetryEntry | null {
  if (code === null || code === undefined) return null;
  const trimmed = String(code).trim();
  if (trimmed === '') return null;
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, '_');
  if (Object.prototype.hasOwnProperty.call(EVIDENCE_SYMMETRY_MAP, key)) {
    return EVIDENCE_SYMMETRY_MAP[key as EvidenceSymmetryCode];
  }
  return null;
}
