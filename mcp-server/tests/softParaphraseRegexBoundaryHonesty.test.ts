/**
 * OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — File 3 of 4.
 *
 * Pin the CURRENT regex-boundary behavior of the byte-unchanged ban-scan around
 * the edges the parent design names: case-insensitivity (a real positive
 * control), and the honestly-UNCLOSED evasion gaps (homoglyph / diacritic /
 * leet) plus the strict word-boundary asymmetry. These tests CHARACTERIZE the
 * boundary; they do NOT fix it.
 *
 * Every NOT-caught pin below documents: CURRENT BEHAVIOR, OUT OF SCOPE TO CHANGE
 * HERE. Closing the Unicode / boundary gaps is a pattern-engine card with its
 * own §10a + production review — not this test-only honesty corpus. If a future
 * card closes one of these gaps, the corresponding NOT-caught pin flips to
 * caught and must be updated deliberately as part of that card.
 *
 * The homoglyph / diacritic spans are built with String.fromCharCode so the
 * source stays fully ASCII and the exact non-ASCII code point is unambiguous to
 * a reviewer (a homoglyph test that embeds a literal look-alike char is itself
 * hard to review).
 *
 * Doctrine (cdiscourse-doctrine §1): hard tokens appear ONLY as scan-detection
 * inputs; no real slurs; no app copy.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  banPatternsForKeyLevelFamily,
  findUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';

// Doctrine-only stack (A) — exercises the shared DOCTRINE_BAN_PATTERNS.
const DOCTRINE_STACK = banPatternsForKeyLevelFamily('parent_relation')!;
// J stack (DOCTRINE + FAMILY_J) — exercises the `troll` / `astroturf*` tokens.
const J_STACK = banPatternsForKeyLevelFamily('sensitive_composer')!;

/** True iff the span trips at least one pattern in the supplied stack. */
function isCaught(span: string, stack: readonly RegExp[]): boolean {
  return findUncleanEvidenceSpanKeys({ k: span }, stack).length > 0;
}

const CYRILLIC_SMALL_O = String.fromCharCode(0x043e); // homoglyph of ASCII 'o'
const LATIN_I_WITH_ACUTE = String.fromCharCode(0x00ed); // diacritic variant of 'i'

// ─────────────────────────────────────────────────────────────────────────
// EDGE-case-insensitive — POSITIVE CONTROL. The `i` flag means case is NOT an
// evasion: an upper/mixed-case hard token is still caught.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-case-insensitive — an upper/mixed-case DOCTRINE token is still caught (the i flag; case is not an evasion)', () => {
  assertEquals(isCaught('this names the WINNER of the debate', DOCTRINE_STACK), true);
  assertEquals(isCaught('they declare the LoSeR here', DOCTRINE_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-homoglyph — a Cyrillic-homoglyph variant of a hard token is NOT caught.
// The ASCII `[^a-z0-9]` boundary + literal ASCII token have no homoglyph reach.
// CURRENT BEHAVIOR, OUT OF SCOPE TO CHANGE HERE; closing it is a pattern-engine
// card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-homoglyph — a Cyrillic-o variant of `troll` is NOT caught (honest unclosed gap)', () => {
  // 'tr' + U+043E (Cyrillic small letter o) + 'll' — not the ASCII token.
  const homoglyph = `such a tr${CYRILLIC_SMALL_O}ll move here`;
  assertEquals(isCaught(homoglyph, J_STACK), false);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-diacritic — a diacritic variant of a hard token is NOT caught.
// CURRENT BEHAVIOR, OUT OF SCOPE TO CHANGE HERE; closing it is a pattern-engine
// card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-diacritic — a diacritic variant of `winner` is NOT caught (honest unclosed gap)', () => {
  // 'w' + U+00ED (Latin small letter i with acute) + 'nner' — not the ASCII token.
  const diacritic = `the w${LATIN_I_WITH_ACUTE}nner is decided`;
  assertEquals(isCaught(diacritic, DOCTRINE_STACK), false);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-leet — a leetspeak variant of a hard token is NOT caught.
// CURRENT BEHAVIOR, OUT OF SCOPE TO CHANGE HERE; closing it is a pattern-engine
// card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-leet — a leetspeak variant of `troll` (zero-for-o) is NOT caught (honest unclosed gap)', () => {
  assertEquals(isCaught('what a tr0ll move', J_STACK), false);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-strict-boundary-asymmetry — pin BOTH sides honestly. A non-`\w*` single
// token (`troll`) does NOT match an alpha-continuing inflection (`trolling`);
// a `\w*` token (`astroturf\w*`) DOES match `astroturfing`. CURRENT BEHAVIOR,
// OUT OF SCOPE TO CHANGE HERE; closing the asymmetry is a pattern-engine card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-strict-boundary-asymmetry — non-\\w* `troll` does NOT match `trolling` (alpha-continuing inflection survives)', () => {
  assertEquals(isCaught('they keep trolling the thread', J_STACK), false);
});

Deno.test('EDGE-strict-boundary-asymmetry — `astroturf\\w*` DOES match `astroturfing` (the \\w* form catches inflections)', () => {
  assertEquals(isCaught('this is a classic astroturfing campaign', J_STACK), true);
});
