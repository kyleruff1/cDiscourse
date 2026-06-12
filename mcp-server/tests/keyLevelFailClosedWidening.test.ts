/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING — extend key-level fail-closed from
 * J-only to ALL TEN registered families (A–J).
 *
 * The J-only mechanism (PR #576) is proven by familyJKeyLevelFailClosed.test.ts
 * (its J behavior is byte-unchanged and stays green). THIS suite proves the
 * widening:
 *   1. MEMBERSHIP — all ten families are in KEY_LEVEL_FAIL_CLOSED_FAMILIES.
 *   2. NO-DIVERGENCE (the binding consistency property, per family) — for every
 *      family, banPatternsForKeyLevelFamily(slug) is the EXACT same pattern
 *      stack (by source + flags, in order) the family's
 *      scanFamily<X>BooleanResponseForBanList composes internally, so the
 *      per-key drop decision and the whole-packet scan can NEVER disagree.
 *   3. FAMILY-EXTENSION WIRING — for E–J, a token that lives ONLY in
 *      FAMILY_<X>_BAN_PATTERNS (not in DOCTRINE_BAN_PATTERNS) is caught by
 *      banPatternsForKeyLevelFamily(slug) AND by the scan — proving the
 *      family-specific extensions (not just the shared doctrine list) are wired
 *      into the collector. (A–D have no family-specific array; they use the
 *      shared doctrine list alone.)
 *   4. REPRESENTATIVE DROP — families A (uniform / shared), D (uniform /
 *      shared, the 22→16+6 batched family at the Edge), and H (family-specific
 *      stack) each: one dirty key dropped by omission, clean siblings survive,
 *      the kept packet re-scans clean AND re-validates (anti-resurrection
 *      invariant).
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§10a): the ban patterns are byte-unchanged
 * (this card only re-composes already-exported constants); omission asserts
 * nothing; no unclean span ever survives a drop; the audit field carries rawKey
 * NAMES only. The widening's production semantics are identical to J's — an
 * unclean key dies alone; the clean siblings persist.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  KEY_LEVEL_FAIL_CLOSED_FAMILIES,
  banPatternsForKeyLevelFamily,
  findUncleanEvidenceSpanKeys,
  dropUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';
import { scanFamilyDBooleanResponseForBanList } from '../lib/familyDBanListScan.ts';
import {
  scanFamilyEBooleanResponseForBanList,
  FAMILY_E_BAN_PATTERNS,
} from '../lib/familyEBanListScan.ts';
import {
  scanFamilyFBooleanResponseForBanList,
  FAMILY_F_BAN_PATTERNS,
} from '../lib/familyFBanListScan.ts';
import {
  scanFamilyGBooleanResponseForBanList,
  FAMILY_G_BAN_PATTERNS,
} from '../lib/familyGBanListScan.ts';
import {
  scanFamilyHBooleanResponseForBanList,
  FAMILY_H_BAN_PATTERNS,
} from '../lib/familyHBanListScan.ts';
import {
  scanFamilyIBooleanResponseForBanList,
  FAMILY_I_BAN_PATTERNS,
} from '../lib/familyIBanListScan.ts';
import {
  scanFamilyJBooleanResponseForBanList,
  FAMILY_J_BAN_PATTERNS,
} from '../lib/familyJBanListScan.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  validateMcpBooleanObservationResponse,
  type McpBooleanObservationValidatedResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

type ScanFn = (
  r: McpBooleanObservationValidatedResponse,
) => { ok: true } | { ok: false; path: string };

interface FamilyEntry {
  slug: string;
  letter: string;
  scan: ScanFn;
  /** The pattern stack banPatternsForKeyLevelFamily(slug) must reproduce. */
  expected: readonly RegExp[];
  /**
   * A token that lives ONLY in this family's family-specific array (NOT in the
   * shared DOCTRINE_BAN_PATTERNS), used to prove the extension is wired. NULL
   * for A–D (no family-specific array exists — shared doctrine list only).
   */
  familyOnlyToken: string | null;
}

const FAMILIES: readonly FamilyEntry[] = [
  {
    slug: 'parent_relation',
    letter: 'A',
    scan: scanFamilyABooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS],
    familyOnlyToken: null,
  },
  {
    slug: 'disagreement_axis',
    letter: 'B',
    scan: scanFamilyBBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS],
    familyOnlyToken: null,
  },
  {
    slug: 'misunderstanding_repair',
    letter: 'C',
    scan: scanFamilyCBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS],
    familyOnlyToken: null,
  },
  {
    slug: 'evidence_source_chain',
    letter: 'D',
    scan: scanFamilyDBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS],
    familyOnlyToken: null,
  },
  {
    slug: 'argument_scheme',
    letter: 'E',
    scan: scanFamilyEBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_E_BAN_PATTERNS],
    familyOnlyToken: 'this is a fallacy',
  },
  {
    slug: 'critical_question',
    letter: 'F',
    scan: scanFamilyFBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_F_BAN_PATTERNS],
    familyOnlyToken: 'this refutes the parent',
  },
  {
    slug: 'resolution_progress',
    letter: 'G',
    scan: scanFamilyGBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_G_BAN_PATTERNS],
    familyOnlyToken: 'the pro side won',
  },
  {
    slug: 'claim_clarity',
    letter: 'H',
    scan: scanFamilyHBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_H_BAN_PATTERNS],
    familyOnlyToken: 'this is sloppy',
  },
  {
    slug: 'thread_topology',
    letter: 'I',
    scan: scanFamilyIBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_I_BAN_PATTERNS],
    familyOnlyToken: 'this is repetitive',
  },
  {
    slug: 'sensitive_composer',
    letter: 'J',
    scan: scanFamilyJBooleanResponseForBanList,
    expected: [...DOCTRINE_BAN_PATTERNS, ...FAMILY_J_BAN_PATTERNS],
    familyOnlyToken: "you're a troll",
  },
];

/** Build a coordinated, validator-passing response from a span map. */
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
    nodeId: 'widen-node',
    checkedRawKeys: keys,
    observations,
    confidence,
    evidenceSpan: spans,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'widen-v1',
    },
  };
}

// A shared-doctrine token caught by EVERY family's stack.
const DOCTRINE_TOKEN_SPAN = 'this names the winner of the debate';

// ─────────────────────────────────────────────────────────────────────────
// 1. MEMBERSHIP — all ten families enabled.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('WIDEN-1 — KEY_LEVEL_FAIL_CLOSED_FAMILIES has exactly the ten registered families', () => {
  assertEquals(KEY_LEVEL_FAIL_CLOSED_FAMILIES.size, 10);
  for (const fam of FAMILIES) {
    assertEquals(KEY_LEVEL_FAIL_CLOSED_FAMILIES.has(fam.slug), true);
  }
});

Deno.test('WIDEN-2 — a string outside the ten families is NOT enabled (banPatterns null)', () => {
  assertEquals(KEY_LEVEL_FAIL_CLOSED_FAMILIES.has('not_a_family'), false);
  assertEquals(banPatternsForKeyLevelFamily('not_a_family'), null);
  assertEquals(banPatternsForKeyLevelFamily(''), null);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. NO-DIVERGENCE — per family, the helper stack === the scan's stack.
// ─────────────────────────────────────────────────────────────────────────

for (const fam of FAMILIES) {
  Deno.test(`WIDEN-3 [${fam.letter} ${fam.slug}] — banPatternsForKeyLevelFamily is the EXACT scan stack (source+flags, in order)`, () => {
    const got = banPatternsForKeyLevelFamily(fam.slug);
    assertEquals(got !== null, true);
    assertEquals(got!.length, fam.expected.length);
    for (let i = 0; i < fam.expected.length; i += 1) {
      assertEquals(got![i].source, fam.expected[i].source);
      assertEquals(got![i].flags, fam.expected[i].flags);
    }
  });

  Deno.test(`WIDEN-4 [${fam.letter} ${fam.slug}] — collector ⇔ scan agree on a shared-doctrine dirty span (no divergence)`, () => {
    const resp = responseFromSpans({ keyClean: 'on topic and civil', keyDirty: DOCTRINE_TOKEN_SPAN });
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    const dirty = findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns);
    assertEquals(dirty, ['keyDirty']);
    const scan = fam.scan(resp);
    assertEquals(scan.ok, false);
    if (!scan.ok) {
      // The collector's key is the EXACT evidenceSpan path the scan reports.
      assertEquals(scan.path, `evidenceSpan.${dirty[0]}`);
    }
  });

  Deno.test(`WIDEN-5 [${fam.letter} ${fam.slug}] — a fully clean packet: collector returns [] AND scan returns ok`, () => {
    const resp = responseFromSpans({ keyA: 'a calm on-topic point', keyB: null });
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), []);
    assertEquals(fam.scan(resp).ok, true);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3. FAMILY-EXTENSION WIRING — E–J: a family-only token is caught by BOTH the
//    helper stack and the scan (proves the family extension, not just DOCTRINE,
//    is wired into the collector).
// ─────────────────────────────────────────────────────────────────────────

for (const fam of FAMILIES.filter((f) => f.familyOnlyToken !== null)) {
  Deno.test(`WIDEN-6 [${fam.letter} ${fam.slug}] — family-ONLY token is in the helper stack AND scanned (extension wired)`, () => {
    const token = fam.familyOnlyToken!;
    // Sanity: the token is NOT caught by the shared doctrine list alone.
    const inDoctrine = DOCTRINE_BAN_PATTERNS.some((p) => p.test(token));
    assertEquals(inDoctrine, false);
    // But it IS caught by this family's full stack (DOCTRINE + FAMILY_X).
    const resp = responseFromSpans({ keyClean: 'civil and on point', keyDirty: token });
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);
    // And the scan agrees (no divergence on the family-specific token).
    const scan = fam.scan(resp);
    assertEquals(scan.ok, false);
    if (!scan.ok) assertEquals(scan.path, 'evidenceSpan.keyDirty');
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 4. REPRESENTATIVE DROP — A (shared/uniform), D (shared/uniform; the Edge
//    22→16+6 batched family), H (family-specific stack).
// ─────────────────────────────────────────────────────────────────────────

function representativeDrop(fam: FamilyEntry, dirtySpan: string): void {
  const resp = responseFromSpans({
    keyClean1: 'a calm, on-topic observation',
    keyDirty: dirtySpan,
    keyClean2: null,
  });
  const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
  const dropped = findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns);
  assertEquals(dropped, ['keyDirty']);

  const kept = dropUncleanEvidenceSpanKeys(resp, dropped);

  // Dropped key gone from every map + checkedRawKeys.
  assertEquals('keyDirty' in kept.observations, false);
  assertEquals('keyDirty' in kept.confidence, false);
  assertEquals('keyDirty' in kept.evidenceSpan, false);
  assertEquals(kept.checkedRawKeys.includes('keyDirty'), false);

  // Clean siblings survive.
  assertEquals(kept.observations.keyClean1, true);
  assertEquals(kept.checkedRawKeys.length, 2);

  // Audit field: NAMES only, sorted.
  assertEquals(kept.keysDroppedForUncleanSpan, ['keyDirty']);

  // The anti-resurrection invariant + key-set coordination hold (validator).
  assertEquals(validateMcpBooleanObservationResponse(kept).ok, true);

  // The kept packet is now ban-clean under THIS family's scan.
  assertEquals(fam.scan(kept).ok, true);

  // The input is not mutated.
  assertEquals('keyDirty' in resp.observations, true);
}

Deno.test('WIDEN-7 [A parent_relation] — dirty key dropped, clean siblings survive (shared/uniform)', () => {
  representativeDrop(FAMILIES[0], 'this declares the winner');
});

Deno.test('WIDEN-8 [D evidence_source_chain] — dirty key dropped, clean siblings survive (the 22→16+6 batched family)', () => {
  representativeDrop(FAMILIES[3], 'this is the gospel truth and proof of it');
});

Deno.test('WIDEN-9 [H claim_clarity] — dirty key dropped via the FAMILY-H stack (sloppy is H-only), siblings survive', () => {
  // 'sloppy' is in FAMILY_H_BAN_PATTERNS but NOT DOCTRINE — proves the H drop
  // is driven by the family-specific stack, not just the shared doctrine list.
  representativeDrop(FAMILIES[7], 'the claim is sloppy and underspecified');
});
