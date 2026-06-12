/**
 * OPS-MCP-BAN-SCAN-NORMALIZATION — evasion-resistant ban-scan normalizer.
 *
 * The ten `scanFamily<X>BooleanResponseForBanList` scanners and the key-level
 * collector `findUncleanEvidenceSpanKeys` match model-output spans against
 * ASCII-literal, case-insensitive, word/`snake_case`-boundary regexes
 * (`doctrineBanList.ts` + each `FAMILY_<X>_BAN_PATTERNS`). Those regexes cannot
 * see a verdict/person token disguised with Unicode homoglyphs (`tr`+U+043E+`ll`),
 * diacritics (`wínner`), leetspeak (`tr0ll`), or zero-width insertions
 * (`t`+U+200B+`roll`). This module closes those gaps by normalizing the SCANNED
 * TEXT ONLY (detection-time) before pattern-testing.
 *
 * Doctrine + invariants (see docs/designs/OPS-MCP-BAN-SCAN-NORMALIZATION.md):
 *   - This is evasion-closure of each family's OWN existing boundary, NOT
 *     cross-family widening. NO token is added to any list; the pattern arrays
 *     in `doctrineBanList.ts` and every `FAMILY_<X>_BAN_PATTERNS` are
 *     byte-unchanged. A disguised `tr0ll` was always within Family J's `troll`
 *     intent — the ASCII regex just could not see it.
 *   - TIGHTENING ONLY. `banScanMatches` tests the RAW text OR the normalized
 *     text, so no string caught before is ever lost (strictly stronger than the
 *     old raw-only scan); the normalized scan is purely additive (design D2).
 *   - PURE + DETECTION-ONLY. `normalizeForBanScan` never mutates persisted
 *     content. Persisted `evidenceSpan` text stays verbatim — normalization only
 *     decides cleanliness; it never rewrites a span.
 *   - cdiscourse-doctrine §1 / §10a — the server must never EMIT a verdict /
 *     person token, disguised or not; a disguised slur is not a person-neutral
 *     structural feature of the move's own text.
 *
 * Pure TypeScript. No imports, no dependencies, no I/O. Deno-clean.
 */

/**
 * Explicit zero-width / invisible code points stripped in step 2.
 *
 * An auditable, reviewable set — NOT a `\p{Cf}` category sweep (which also pulls
 * in soft hyphen, bidi controls, and language tags whose folding behavior is
 * harder to reason about). The raw-OR-normalized union (D2) keeps detection safe
 * even if this set is incomplete, so an explicit set costs nothing in safety and
 * buys auditability.
 *
 *   U+200B ZERO WIDTH SPACE
 *   U+200C ZERO WIDTH NON-JOINER
 *   U+200D ZERO WIDTH JOINER
 *   U+2060 WORD JOINER
 *   U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)
 *
 * Bidi controls (U+202A–U+202E, U+2066–U+2069) are a named, deliberate deferral
 * (also invisible insertions; candidate for a follow-up if a probe surfaces
 * them) — excluded here to keep v1 minimal and testable.
 */
const ZERO_WIDTH_RE = /[​‌‍⁠﻿]/g;

/**
 * Explicit, commented lowercase Cyrillic / Greek homoglyph → ASCII table
 * (step 4). Minimum set — the common look-alikes only; expand only with a
 * documented reason. Applied char-by-char after lowercase + NFKD, so only
 * lowercase entries are required. No library, no dependency — an explicit table
 * is reviewable and deterministic.
 */
const HOMOGLYPH_MAP: Readonly<Record<string, string>> = Object.freeze({
  // ── Cyrillic lowercase look-alikes ──
  'а': 'a', // CYRILLIC SMALL LETTER A
  'е': 'e', // CYRILLIC SMALL LETTER IE
  'о': 'o', // CYRILLIC SMALL LETTER O
  'р': 'p', // CYRILLIC SMALL LETTER ER
  'с': 'c', // CYRILLIC SMALL LETTER ES
  'х': 'x', // CYRILLIC SMALL LETTER HA
  'у': 'y', // CYRILLIC SMALL LETTER U
  'і': 'i', // CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I
  'ј': 'j', // CYRILLIC SMALL LETTER JE
  'ѕ': 's', // CYRILLIC SMALL LETTER DZE
  // ── Greek lowercase look-alikes (only unambiguous visual matches) ──
  'ο': 'o', // GREEK SMALL LETTER OMICRON
  'α': 'a', // GREEK SMALL LETTER ALPHA
  'ε': 'e', // GREEK SMALL LETTER EPSILON
  'ρ': 'p', // GREEK SMALL LETTER RHO
});

/**
 * Leetspeak digit/symbol → ASCII letter table (step 5). Mapped ONLY when a
 * leet char sits adjacent to an ASCII letter (see `mapLeetAdjacencyGated`),
 * which is exactly the evasion signature; standalone numerals (years, statute
 * numbers, prices, model numbers, counts) are never mapped. `2`, `6`, `8`, `9`
 * are deliberately NOT in the table (no clean letter look-alike worth the noise).
 */
const LEET_MAP: Readonly<Record<string, string>> = Object.freeze({
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
});

/** char-by-char Cyrillic/Greek homoglyph fold (step 4). */
function mapHomoglyphs(text: string): string {
  let out = '';
  for (const ch of text) {
    out += HOMOGLYPH_MAP[ch] ?? ch;
  }
  return out;
}

/**
 * Adjacency-gated leet fold (step 5). A leet char is mapped iff an immediate
 * neighbor (index ±1) is an ASCII letter `[a-z]`. Adjacency is computed against
 * the INPUT string (the post-step-4 string) — i.e. before any substitution — so
 * a just-substituted char can never change a later char's gating decision.
 */
function mapLeetAdjacencyGated(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const mapped = LEET_MAP[ch];
    if (mapped !== undefined) {
      const prev = i > 0 ? text[i - 1] : '';
      const next = i < text.length - 1 ? text[i + 1] : '';
      if (/[a-z]/.test(prev) || /[a-z]/.test(next)) {
        out += mapped;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/**
 * Normalize text for ban-scan DETECTION ONLY. Pure; never mutates persisted
 * content. Order is fixed and deterministic. Output is used additively (see
 * `banScanMatches`) — it never replaces the raw scan.
 *
 * Fixed step order:
 *   1. Lowercase — folds Latin/Cyrillic/Greek case in one call (so the
 *      homoglyph + leet tables need only lowercase entries, and uppercase
 *      homoglyph attacks fold before mapping). Patterns are `/i`, so lowercasing
 *      cannot lose a case-insensitive match (D1).
 *   2. Zero-width / invisible strip — the explicit `ZERO_WIDTH_RE` set.
 *   3. Unicode fold — NFKD decomposes precomposed diacritics + folds fullwidth
 *      forms (`ｔ`→`t`) and ligatures; the combining-mark strip drops the accents.
 *   4. Homoglyph map — explicit Cyrillic/Greek → ASCII table, char-by-char.
 *   5. Leet map — adjacency-gated digit/symbol → ASCII letter.
 */
export function normalizeForBanScan(text: string): string {
  // Step 1 — lowercase (Unicode-aware).
  let s = text.toLowerCase();
  // Step 2 — strip the explicit zero-width / invisible set.
  s = s.replace(ZERO_WIDTH_RE, '');
  // Step 3 — NFKD fold (diacritics + fullwidth + ligatures), then drop the
  // combining marks left behind by the decomposition.
  s = s.normalize('NFKD').replace(/\p{M}/gu, '');
  // Step 4 — homoglyph map (Cyrillic/Greek → ASCII).
  s = mapHomoglyphs(s);
  // Step 5 — adjacency-gated leet map.
  s = mapLeetAdjacencyGated(s);
  return s;
}

/**
 * The single shared ban-scan matcher and the one choke point through which both
 * the ten family scans and the key-level collector route, so the normalization
 * decision can never diverge between them.
 *
 * A span is "dirty" iff any pattern matches the RAW text OR the normalized text.
 * The raw scan is ALWAYS run, so no prior catch is ever lost (D2 monotonicity);
 * the normalized scan is purely additive. Null / undefined / non-string → false.
 *
 * Equivalent contract:
 *   patterns.some(p => p.test(text)) ||
 *   patterns.some(p => p.test(normalizeForBanScan(text)))
 * (the `normalized === text` short-circuit below is a pure optimization for the
 * bulk of real spans — clean lowercase ASCII normalizes to identity — and does
 * not change the result: if the raw scan missed and normalize is identity, the
 * normalized scan would miss too.)
 */
export function banScanMatches(
  text: string | null | undefined,
  patterns: readonly RegExp[],
): boolean {
  if (typeof text !== 'string') return false;
  // Raw scan first — always run, so no prior catch is ever lost.
  if (patterns.some((p) => p.test(text))) return true;
  // Additive normalized scan — catches the disguised forms.
  const normalized = normalizeForBanScan(text);
  if (normalized === text) return false;
  return patterns.some((p) => p.test(normalized));
}
