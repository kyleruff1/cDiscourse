/**
 * OPS-MCP-BAN-SCAN-NORMALIZATION — unit suite for the evasion-resistant
 * ban-scan normalizer + the shared raw-OR-normalized matcher.
 *
 * Covers: zero-width strip, NFKD/diacritic fold, fullwidth fold, Cyrillic/Greek
 * homoglyph map, adjacency-gated leet map, the tighten-only / monotonicity
 * property, idempotence, null/empty safety, false-positive guards, and the
 * disguised-token collector⇔scan agreement (the no-divergence proof: the family
 * scans and the key-level collector make the IDENTICAL normalization decision
 * because both route through `banScanMatches`).
 *
 * Non-ASCII inputs are built with String.fromCharCode so the source stays fully
 * ASCII and the exact code point is unambiguous to a reviewer (a homoglyph test
 * that embeds a literal look-alike is itself hard to review). This mirrors the
 * #578 honesty-corpus convention.
 *
 * Doctrine (cdiscourse-doctrine §1): hard tokens appear ONLY as scan-detection
 * inputs (established #578 precedent); never as app copy / labels / persisted
 * spans. The false-positive corpus contains zero banned tokens.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { banScanMatches, normalizeForBanScan } from '../lib/banScanNormalize.ts';
import {
  banPatternsForKeyLevelFamily,
  findUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { scanFamilyHBooleanResponseForBanList } from '../lib/familyHBanListScan.ts';
import { scanFamilyJBooleanResponseForBanList } from '../lib/familyJBanListScan.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  type McpBooleanObservationValidatedResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

// ─────────────────────────────────────────────────────────────────────────
// Code points (explicit; ASCII source).
// ─────────────────────────────────────────────────────────────────────────
const ZWSP = String.fromCharCode(0x200b);
const ZWNJ = String.fromCharCode(0x200c);
const ZWJ = String.fromCharCode(0x200d);
const WORD_JOINER = String.fromCharCode(0x2060);
const BOM = String.fromCharCode(0xfeff);
const ALL_ZERO_WIDTH = [ZWSP, ZWNJ, ZWJ, WORD_JOINER, BOM];

const CYRILLIC_O = String.fromCharCode(0x043e); // homoglyph of 'o'
const CYRILLIC_E = String.fromCharCode(0x0435); // homoglyph of 'e'
const GREEK_O = String.fromCharCode(0x03bf); // homoglyph of 'o'
const LATIN_I_ACUTE = String.fromCharCode(0x00ed); // precomposed í
const COMBINING_ACUTE = String.fromCharCode(0x0301); // combining accent
const LIGATURE_FI = String.fromCharCode(0xfb01); // ﬁ ligature
// Fullwidth 'troll' — U+FF54 U+FF52 U+FF4F U+FF4C U+FF4C.
const FULLWIDTH_TROLL = String.fromCharCode(0xff54, 0xff52, 0xff4f, 0xff4c, 0xff4c);
// Legit Cyrillic word "москва" (no banned token in any form).
const CYRILLIC_WORD = String.fromCharCode(0x043c, 0x043e, 0x0441, 0x043a, 0x0432, 0x0430);

// ─────────────────────────────────────────────────────────────────────────
// Stacks under test.
// ─────────────────────────────────────────────────────────────────────────
const DOCTRINE_STACK = banPatternsForKeyLevelFamily('parent_relation')!; // A (doctrine-only)
const H_STACK = banPatternsForKeyLevelFamily('claim_clarity')!; // DOCTRINE + FAMILY_H
const J_STACK = banPatternsForKeyLevelFamily('sensitive_composer')!; // DOCTRINE + FAMILY_J

/** Build a coordinated validator-shaped response from a span map. */
function responseFromSpans(
  spans: Record<string, string | null>,
): McpBooleanObservationValidatedResponse {
  const keys = Object.keys(spans);
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  for (const k of keys) {
    observations[k] = true;
    confidence[k] = 'medium';
  }
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'ban-scan-normalize-node',
    checkedRawKeys: keys,
    observations,
    confidence,
    evidenceSpan: spans,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'ban-scan-normalize-v1',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Zero-width / invisible strip (step 2)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('ZW — each of the 5 explicit zero-width chars is stripped (glues t<ZW>roll → troll)', () => {
  for (const zw of ALL_ZERO_WIDTH) {
    assertEquals(normalizeForBanScan(`t${zw}roll`), 'troll');
  }
});

Deno.test('ZW — an in-token U+200B insertion in `troll` is caught vs the J stack', () => {
  assertEquals(banScanMatches(`such a t${ZWSP}roll move`, J_STACK), true);
});

Deno.test('ZW — WORD JOINER and BOM in-token insertions are caught vs the J stack', () => {
  assertEquals(banScanMatches(`a tr${WORD_JOINER}oll here`, J_STACK), true);
  assertEquals(banScanMatches(`a tro${BOM}ll here`, J_STACK), true);
});

Deno.test('ZW — leading / trailing / repeated zero-width chars are all stripped', () => {
  assertEquals(normalizeForBanScan(`${ZWSP}${BOM}tr${ZWNJ}${ZWJ}oll${WORD_JOINER}`), 'troll');
});

Deno.test('ZW — idempotence on a zero-width-laden string', () => {
  const messy = `t${ZWSP}r${ZWNJ}o${ZWJ}l${WORD_JOINER}l${BOM}`;
  assertEquals(normalizeForBanScan(normalizeForBanScan(messy)), normalizeForBanScan(messy));
  assertEquals(normalizeForBanScan(messy), 'troll');
});

// ═══════════════════════════════════════════════════════════════════════════
// Diacritic / NFKD fold (step 3)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('NFKD — a precomposed diacritic `wínner` (U+00ED) is caught vs the DOCTRINE stack', () => {
  assertEquals(banScanMatches(`the w${LATIN_I_ACUTE}nner is decided`, DOCTRINE_STACK), true);
});

Deno.test('NFKD — a combining-mark form (w + i + U+0301 + nner) is caught vs the DOCTRINE stack', () => {
  assertEquals(banScanMatches(`the wi${COMBINING_ACUTE}nner is decided`, DOCTRINE_STACK), true);
});

Deno.test('NFKD — a fullwidth `ｔｒｏｌｌ` folds to ASCII and is caught vs the J stack', () => {
  assertEquals(normalizeForBanScan(FULLWIDTH_TROLL), 'troll');
  assertEquals(banScanMatches(`what a ${FULLWIDTH_TROLL} move`, J_STACK), true);
});

Deno.test('NFKD — a ligature (ﬁ, U+FB01) folds to its ASCII expansion', () => {
  assertEquals(normalizeForBanScan(LIGATURE_FI), 'fi');
});

// ═══════════════════════════════════════════════════════════════════════════
// Homoglyph map (step 4)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('HG — a Cyrillic-o variant of `troll` is caught vs the J stack', () => {
  assertEquals(banScanMatches(`such a tr${CYRILLIC_O}ll move`, J_STACK), true);
});

Deno.test('HG — a Cyrillic-e variant of `winner` is caught vs the DOCTRINE stack', () => {
  assertEquals(banScanMatches(`the winn${CYRILLIC_E}r is named`, DOCTRINE_STACK), true);
});

Deno.test('HG — a Greek-o variant of `troll` is caught vs the J stack', () => {
  assertEquals(banScanMatches(`a tr${GREEK_O}ll move`, J_STACK), true);
});

Deno.test('HG — an uppercase homoglyph attack folds (lowercase-first) and is caught vs the J stack', () => {
  // 'TR' + uppercase-context Cyrillic small o still folds because step 1 lowercases.
  assertEquals(banScanMatches(`SUCH A TR${CYRILLIC_O}LL`, J_STACK), true);
});

Deno.test('HG — a legit Cyrillic word is NOT caught vs the DOCTRINE or J stacks', () => {
  assertEquals(banScanMatches(CYRILLIC_WORD, DOCTRINE_STACK), false);
  assertEquals(banScanMatches(CYRILLIC_WORD, J_STACK), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// Leet map — adjacency-gated (step 5)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('LEET — `tr0ll` (letter-adjacent 0) maps to troll and is caught vs the J stack', () => {
  assertEquals(normalizeForBanScan('tr0ll'), 'troll');
  assertEquals(banScanMatches('what a tr0ll move', J_STACK), true);
});

Deno.test('LEET — `l0ser` is caught vs the DOCTRINE stack', () => {
  assertEquals(banScanMatches('calling them a l0ser', DOCTRINE_STACK), true);
});

Deno.test('LEET — `w0n` maps to won and is caught vs the G stack', () => {
  const gStack = banPatternsForKeyLevelFamily('resolution_progress')!;
  assertEquals(normalizeForBanScan('w0n'), 'won');
  assertEquals(banScanMatches('the pro side w0n', gStack), true);
});

Deno.test('LEET — `@stroturf` (@ adjacent to letter) maps and is caught vs the J stack', () => {
  assertEquals(normalizeForBanScan('@stroturf'), 'astroturf');
  assertEquals(banScanMatches('classic @stroturf campaign', J_STACK), true);
});

Deno.test('LEET adjacency-gating — `Model 3` leaves the digit untouched (no letter neighbor) and is not caught', () => {
  assertEquals(normalizeForBanScan('Model 3'), 'model 3');
  assertEquals(banScanMatches('Model 3', DOCTRINE_STACK), false);
  assertEquals(banScanMatches('Model 3', J_STACK), false);
});

Deno.test('LEET adjacency-gating — standalone numerals (`the 2019 report`, `Section 230`) are untouched and not caught', () => {
  assertEquals(normalizeForBanScan('the 2019 report'), 'the 2019 report');
  assertEquals(normalizeForBanScan('Section 230'), 'section 230');
  assertEquals(banScanMatches('the 2019 report', DOCTRINE_STACK), false);
  assertEquals(banScanMatches('Section 230', J_STACK), false);
});

Deno.test('LEET adjacency-gating — a price `$5` and `co2` are untouched (no letter-adjacent mapped char forms a token)', () => {
  assertEquals(normalizeForBanScan('costs $5'), 'costs $5');
  // `2` is not a leet key at all, so `co2` is unchanged.
  assertEquals(normalizeForBanScan('co2 emissions'), 'co2 emissions');
  assertEquals(banScanMatches('costs $5', DOCTRINE_STACK), false);
  assertEquals(banScanMatches('co2 emissions', J_STACK), false);
});

Deno.test('LEET adjacency-gating — leet chars with NO letter neighbor are not mapped', () => {
  assertEquals(normalizeForBanScan('0 1 3 4 5 7'), '0 1 3 4 5 7');
  assertEquals(normalizeForBanScan('5 + 5 = 10'), '5 + 5 = 10');
});

// ═══════════════════════════════════════════════════════════════════════════
// Tighten-only / monotonicity property (D2)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('PROP — normalize is identity on pure-lowercase-ASCII-letter text', () => {
  const ascii = [
    'this is a calm structural observation',
    'the parent introduces a new scope',
    'a clean civil reply about evidence',
    'troll', // even a bare lowercase ASCII token is identity under normalize
    'winner',
  ];
  for (const s of ascii) {
    assertEquals(normalizeForBanScan(s), s);
  }
});

Deno.test('PROP — monotonicity: every raw-matching input stays caught after normalization (incl. boundary-faking ZWSP)', () => {
  // The boundary-faking case: `ro`+ZWSP+`bot` matches `bot` RAW (ZWSP is a
  // non-alphanumeric boundary). The normalized form is `robot` which does NOT
  // match — but the raw scan is always run, so it stays caught.
  const rawMatchers: Array<[string, readonly RegExp[]]> = [
    ['names the winner', DOCTRINE_STACK],
    ['the loser of the debate', DOCTRINE_STACK],
    ['acting like a troll', J_STACK],
    ['a classic astroturfing campaign', J_STACK],
    ['the claim is sloppy', H_STACK],
    [`ro${ZWSP}bot`, J_STACK],
  ];
  for (const [span, stack] of rawMatchers) {
    assertEquals(banScanMatches(span, stack), true);
  }
});

Deno.test('PROP — raw positive controls: plain banned tokens are still caught through the matcher', () => {
  assertEquals(banScanMatches('the winner here', DOCTRINE_STACK), true);
  assertEquals(banScanMatches('such a loser', DOCTRINE_STACK), true);
  assertEquals(banScanMatches('acting like a troll', J_STACK), true);
  assertEquals(banScanMatches('the claim is sloppy', H_STACK), true);
});

Deno.test('PROP — banScanMatches equals (raw OR normalized) for a representative sample', () => {
  const sample = [
    'plain clean text',
    'tr0ll',
    `t${ZWSP}roll`,
    `tr${CYRILLIC_O}ll`,
    'Model 3 costs $5',
    'names the winner',
  ];
  for (const s of sample) {
    const expected = DOCTRINE_STACK.some((p) => p.test(s)) ||
      J_STACK.some((p) => p.test(s)) ||
      DOCTRINE_STACK.some((p) => p.test(normalizeForBanScan(s))) ||
      J_STACK.some((p) => p.test(normalizeForBanScan(s)));
    const actual = banScanMatches(s, DOCTRINE_STACK) || banScanMatches(s, J_STACK);
    assertEquals(actual, expected);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Idempotence
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('IDEM — normalizeForBanScan(normalizeForBanScan(x)) === normalizeForBanScan(x)', () => {
  const corpus = [
    'plain clean text',
    'tr0ll',
    `t${ZWSP}roll`,
    `tr${CYRILLIC_O}ll`,
    FULLWIDTH_TROLL,
    `w${LATIN_I_ACUTE}nner`,
    'Model 3 costs $5',
    CYRILLIC_WORD,
    `SUCH A TR${CYRILLIC_O}LL`,
  ];
  for (const x of corpus) {
    const once = normalizeForBanScan(x);
    assertEquals(normalizeForBanScan(once), once);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Null / empty safety
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('NULL — banScanMatches(null | undefined | "") is false', () => {
  assertEquals(banScanMatches(null, J_STACK), false);
  assertEquals(banScanMatches(undefined, J_STACK), false);
  assertEquals(banScanMatches('', J_STACK), false);
});

Deno.test('NULL — normalizeForBanScan("") is ""', () => {
  assertEquals(normalizeForBanScan(''), '');
});

// ═══════════════════════════════════════════════════════════════════════════
// False-positive guards (legit non-ASCII words, numbers, prices)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('FP — `Model 3 costs $5` is clean vs the DOCTRINE and J stacks', () => {
  assertEquals(banScanMatches('Model 3 costs $5', DOCTRINE_STACK), false);
  assertEquals(banScanMatches('Model 3 costs $5', J_STACK), false);
});

Deno.test('FP — accented loanwords (café, naïve, résumé) fold to clean ASCII and are not caught', () => {
  for (const word of ['café', 'naïve', 'résumé']) {
    assertEquals(banScanMatches(word, DOCTRINE_STACK), false);
    assertEquals(banScanMatches(word, J_STACK), false);
  }
  assertEquals(normalizeForBanScan('café'), 'cafe');
  assertEquals(normalizeForBanScan('naïve'), 'naive');
  assertEquals(normalizeForBanScan('résumé'), 'resume');
});

Deno.test('FP — a diacritic-leading word (Ünternehmen) folds clean and is not caught', () => {
  assertEquals(normalizeForBanScan('Ünternehmen'), 'unternehmen');
  assertEquals(banScanMatches('Ünternehmen', DOCTRINE_STACK), false);
  assertEquals(banScanMatches('Ünternehmen', J_STACK), false);
});

Deno.test('FP — `co2 emissions`, `the 2019 report`, and a legit Cyrillic word are all clean', () => {
  for (const span of ['co2 emissions', 'the 2019 report', CYRILLIC_WORD]) {
    assertEquals(banScanMatches(span, DOCTRINE_STACK), false);
    assertEquals(banScanMatches(span, J_STACK), false);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Disguised-token collector⇔scan agreement (the no-divergence proof)
//
// For each sampled family, a disguised dirty span is caught by BOTH the
// key-level collector (findUncleanEvidenceSpanKeys) AND the family's whole-packet
// scan, on the exact same key — proving the normalization decision is identical
// on both paths because both route through banScanMatches.
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('AGREE [A doctrine-only] — disguised `winn3r` caught by collector AND scan on the same key', () => {
  const patterns = banPatternsForKeyLevelFamily('parent_relation')!;
  const resp = responseFromSpans({ keyClean: 'a calm structural note', keyDirty: 'the winn3r is named' });
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
  const scan = scanFamilyABooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
});

Deno.test('AGREE [H family-array] — disguised `sl0ppy` caught by collector AND scan on the same key', () => {
  const patterns = banPatternsForKeyLevelFamily('claim_clarity')!;
  const resp = responseFromSpans({ keyClean: 'a calm structural note', keyDirty: 'the claim is sl0ppy' });
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
  const scan = scanFamilyHBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
});

Deno.test('AGREE [J leet] — disguised `tr0ll` caught by collector AND scan on the same key', () => {
  const patterns = banPatternsForKeyLevelFamily('sensitive_composer')!;
  const resp = responseFromSpans({ keyClean: 'a calm structural note', keyDirty: 'acting like a tr0ll' });
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
  const scan = scanFamilyJBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
});

Deno.test('AGREE [J homoglyph] — disguised Cyrillic-o `troll` caught by collector AND scan on the same key', () => {
  const patterns = banPatternsForKeyLevelFamily('sensitive_composer')!;
  const resp = responseFromSpans({
    keyClean: 'a calm structural note',
    keyDirty: `acting like a tr${CYRILLIC_O}ll`,
  });
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
  const scan = scanFamilyJBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
});

Deno.test('AGREE [J astroturf\\w*] — disguised `astr0turf` caught by collector AND scan on the same key', () => {
  const patterns = banPatternsForKeyLevelFamily('sensitive_composer')!;
  const resp = responseFromSpans({
    keyClean: 'a calm structural note',
    keyDirty: 'a classic astr0turf campaign',
  });
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
  const scan = scanFamilyJBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
});

// ═══════════════════════════════════════════════════════════════════════════
// Persisted-content-verbatim property — the normalizer decides cleanliness; it
// never rewrites the span. After a scan flags a disguised span, the span string
// in the response is byte-identical to the disguised input (NOT the normalized
// form).
// ═══════════════════════════════════════════════════════════════════════════

Deno.test('VERBATIM — scanning a disguised dirty span never rewrites the span content', () => {
  const disguised = 'acting like a tr0ll';
  const resp = responseFromSpans({ keyDirty: disguised });
  const scan = scanFamilyJBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false); // flagged
  // The span is verbatim — the leet form, not the normalized `troll`.
  assertEquals(resp.evidenceSpan.keyDirty, disguised);
  assertEquals(resp.evidenceSpan.keyDirty === 'acting like a troll', false);
});
