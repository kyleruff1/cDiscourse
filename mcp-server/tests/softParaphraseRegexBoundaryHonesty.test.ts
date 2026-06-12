/**
 * OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — File 3 of 4.
 *
 * Pin the regex-boundary behavior of the ban-scan around the edges the parent
 * design names: case-insensitivity (a real positive control), the Unicode/leet
 * evasion edges, and the strict word-boundary asymmetry.
 *
 * BOUNDARY MOVED — OPS-MCP-BAN-SCAN-NORMALIZATION (this card): the three
 * evasion gaps that #578 honestly pinned as NOT-caught (homoglyph / diacritic /
 * leet) are now CAUGHT. The pattern arrays are byte-unchanged; the scan now
 * tests the RAW text OR the `normalizeForBanScan`d text (a raw-OR-normalized
 * union — tighten-only), so each family's OWN boundary became evasion-resistant.
 * Per the #578 flip procedure, those three pins flip `false → true` deliberately
 * here, with boundary-moved notes naming this card. Two NEW edges are added
 * (zero-width insertion + NFKD fullwidth — also caught). The case-insensitive
 * positive control and the strict word-boundary asymmetry pins
 * (`troll`≠`trolling`; `astroturf\w*` matches `astroturfing`) STAY as-is — those
 * are inflection/word-boundary semantics, NOT an evasion, and remain out of
 * scope (a disguised token is closed; an inflected distinct word is not).
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
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b); // invisible in-token insertion
// Fullwidth (NFKD-folding) variant of 'troll' — U+FF54 U+FF52 U+FF4F U+FF4C U+FF4C.
const FULLWIDTH_TROLL = String.fromCharCode(0xff54, 0xff52, 0xff4f, 0xff4c, 0xff4c);

// ─────────────────────────────────────────────────────────────────────────
// EDGE-case-insensitive — POSITIVE CONTROL. The `i` flag means case is NOT an
// evasion: an upper/mixed-case hard token is still caught.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-case-insensitive — an upper/mixed-case DOCTRINE token is still caught (the i flag; case is not an evasion)', () => {
  assertEquals(isCaught('this names the WINNER of the debate', DOCTRINE_STACK), true);
  assertEquals(isCaught('they declare the LoSeR here', DOCTRINE_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-homoglyph — a Cyrillic-homoglyph variant of a hard token is now CAUGHT.
// BOUNDARY MOVED by OPS-MCP-BAN-SCAN-NORMALIZATION: step 4 of normalizeForBanScan
// folds the Cyrillic-o (U+043E) to ASCII 'o', so the normalized scan sees the
// real token. The pattern array is byte-unchanged; the matcher is raw-OR-
// normalized (tighten-only). Previously pinned NOT-caught at #578.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-homoglyph — a Cyrillic-o variant of `troll` IS caught (boundary moved by OPS-MCP-BAN-SCAN-NORMALIZATION)', () => {
  // 'tr' + U+043E (Cyrillic small letter o) + 'll' — normalizes to the ASCII token.
  const homoglyph = `such a tr${CYRILLIC_SMALL_O}ll move here`;
  assertEquals(isCaught(homoglyph, J_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-diacritic — a diacritic variant of a hard token is now CAUGHT.
// BOUNDARY MOVED by OPS-MCP-BAN-SCAN-NORMALIZATION: step 3 (NFKD + combining-mark
// strip) decomposes U+00ED to 'i' + combining acute and drops the accent, so the
// normalized scan sees the real token. Pattern array byte-unchanged; raw-OR-
// normalized (tighten-only). Previously pinned NOT-caught at #578.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-diacritic — a diacritic variant of `winner` IS caught (boundary moved by OPS-MCP-BAN-SCAN-NORMALIZATION)', () => {
  // 'w' + U+00ED (Latin small letter i with acute) + 'nner' — normalizes to the ASCII token.
  const diacritic = `the w${LATIN_I_WITH_ACUTE}nner is decided`;
  assertEquals(isCaught(diacritic, DOCTRINE_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-leet — a leetspeak variant of a hard token is now CAUGHT.
// BOUNDARY MOVED by OPS-MCP-BAN-SCAN-NORMALIZATION: step 5 (adjacency-gated leet
// map) maps the letter-adjacent '0' to 'o' ('tr0ll' → 'troll'), so the
// normalized scan sees the real token. Pattern array byte-unchanged; raw-OR-
// normalized (tighten-only). Previously pinned NOT-caught at #578.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-leet — a leetspeak variant of `troll` (zero-for-o) IS caught (boundary moved by OPS-MCP-BAN-SCAN-NORMALIZATION)', () => {
  assertEquals(isCaught('what a tr0ll move', J_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-zero-width — an in-token zero-width insertion is now CAUGHT.
// OPS-MCP-BAN-SCAN-NORMALIZATION step 2 strips the explicit zero-width set
// ('t' + U+200B + 'roll' → 'troll'). New edge pinned by this card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-zero-width — an in-token U+200B insertion in `troll` IS caught (OPS-MCP-BAN-SCAN-NORMALIZATION)', () => {
  const zeroWidth = `such a t${ZERO_WIDTH_SPACE}roll move`;
  assertEquals(isCaught(zeroWidth, J_STACK), true);
});

// ─────────────────────────────────────────────────────────────────────────
// EDGE-fullwidth — an NFKD fullwidth variant of a hard token is now CAUGHT.
// OPS-MCP-BAN-SCAN-NORMALIZATION step 3 (NFKD) folds fullwidth Latin forms to
// ASCII (ｔｒｏｌｌ → 'troll'). New edge pinned by this card.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('EDGE-fullwidth — an NFKD fullwidth variant of `troll` IS caught (OPS-MCP-BAN-SCAN-NORMALIZATION)', () => {
  const fullwidth = `what a ${FULLWIDTH_TROLL} move`;
  assertEquals(isCaught(fullwidth, J_STACK), true);
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
