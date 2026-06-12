/**
 * OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — File 2 of 4.
 *
 * Pin the MIXED-PACKET marginal-reachability property: when one packet carries
 * BOTH a hard-control span (a banned token → dropped by key-level fail-closed)
 * AND a soft-paraphrase survivor span on a sibling key, the hard key dies ALONE
 * and the soft sibling SURVIVES — present in the kept maps, re-validates, and
 * re-scans clean (isError:false at the lib level). This is the documented
 * marginal-reachability property: the survivor — not the banned content — is
 * what reaches the wire.
 *
 * Required families: A + D (doctrine-only stack), H + I (family-array stack),
 * and J — satisfying the design's "at least one A–D, one E–I, and J". The
 * dispatcher full-envelope J pin (and its JSON fixture) is OMITTED by operator
 * choice (strict literal test-only scope); the lib-level MIX-J pin below already
 * covers item (c) fully.
 *
 * Each packet includes a `keyNull: null` sibling, exercising the
 * findUncleanEvidenceSpanKeys null-skip path (design §5 edge case): a null-span
 * key is neither dirty nor a soft survivor; it survives the drop untouched.
 *
 * Doctrine (cdiscourse-doctrine §1/§10a): the hard token rides only as a
 * scan-detection INPUT in this test file (established precedent); after the drop
 * it never appears on the kept wire. The soft survivor is carried as the
 * ORIGINAL span verbatim, never re-characterized into a person/intent finding —
 * §10a is honored on the regex-detectable class; the soft class remains an open
 * residual (see design §5).
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  banPatternsForKeyLevelFamily,
  dropUncleanEvidenceSpanKeys,
  findUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { scanFamilyDBooleanResponseForBanList } from '../lib/familyDBanListScan.ts';
import { scanFamilyHBooleanResponseForBanList } from '../lib/familyHBanListScan.ts';
import { scanFamilyIBooleanResponseForBanList } from '../lib/familyIBanListScan.ts';
import { scanFamilyJBooleanResponseForBanList } from '../lib/familyJBanListScan.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  type McpBooleanObservationValidatedResponse,
  validateMcpBooleanObservationResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

type ScanFn = (
  r: McpBooleanObservationValidatedResponse,
) => { ok: true } | { ok: false; path: string };

/**
 * Build a coordinated, validator-passing response from a span map. Copied
 * verbatim from keyLevelFailClosedWidening.test.ts (deliberate test-locality —
 * NOT extracted to a shared util, per the design's helper-duplication note).
 */
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

interface MixEntry {
  letter: string;
  slug: string;
  scan: ScanFn;
  /** Hard-control span (carries the banned token → dropped). */
  hardSpan: string;
  /** The banned token substring; MIX-banned-token-probe proves it never rides the wire. */
  hardToken: string;
  /** Soft-paraphrase survivor span (regex-clean → survives). */
  softSpan: string;
}

const MIX: readonly MixEntry[] = [
  {
    letter: 'A',
    slug: 'parent_relation',
    scan: scanFamilyABooleanResponseForBanList,
    hardSpan: 'this names the loser of the debate', // `loser` (DOCTRINE)
    hardToken: 'loser',
    softSpan: 'the author seems biased',
  },
  {
    letter: 'D',
    slug: 'evidence_source_chain',
    scan: scanFamilyDBooleanResponseForBanList,
    hardSpan: 'they call this proof of the conclusion', // `proof of` (DOCTRINE)
    hardToken: 'proof of',
    softSpan: 'they clearly have an agenda',
  },
  {
    letter: 'H',
    slug: 'claim_clarity',
    scan: scanFamilyHBooleanResponseForBanList,
    hardSpan: 'the claim is sloppy and underspecified', // `sloppy` (FAMILY_H)
    hardToken: 'sloppy',
    softSpan: "the author doesn't really understand the topic",
  },
  {
    letter: 'I',
    slug: 'thread_topology',
    scan: scanFamilyIBooleanResponseForBanList,
    hardSpan: 'this is just rehashing the same point', // `rehashing` (FAMILY_I)
    hardToken: 'rehashing',
    softSpan: 'the aim here appears to be distraction',
  },
  {
    letter: 'J',
    slug: 'sensitive_composer',
    scan: scanFamilyJBooleanResponseForBanList,
    hardSpan: 'the author is acting like a troll', // `troll` (FAMILY_J)
    hardToken: 'troll',
    softSpan: 'the author seems biased',
  },
];

for (const m of MIX) {
  Deno.test(`MIX-${m.letter} [${m.slug}] — hard key dropped alone; soft sibling survives, re-validates, re-scans clean`, () => {
    const patterns = banPatternsForKeyLevelFamily(m.slug)!;
    const resp = responseFromSpans({
      keyHard: m.hardSpan,
      keySoft: m.softSpan,
      keyNull: null, // null-skip path: neither dirty nor a survivor; survives untouched
    });

    // The collector returns ONLY the hard key (soft sibling is not collected;
    // the null sibling is skipped).
    const dropped = findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns);
    assertEquals(dropped, ['keyHard']);

    const kept = dropUncleanEvidenceSpanKeys(resp, dropped);

    // Hard key gone from all four maps.
    assertEquals('keyHard' in kept.observations, false);
    assertEquals('keyHard' in kept.confidence, false);
    assertEquals('keyHard' in kept.evidenceSpan, false);
    assertEquals(kept.checkedRawKeys.includes('keyHard'), false);

    // Soft sibling survives in all four maps.
    assertEquals(kept.observations.keySoft, true);
    assertEquals('keySoft' in kept.confidence, true);
    assertEquals('keySoft' in kept.evidenceSpan, true);
    assertEquals(kept.checkedRawKeys.includes('keySoft'), true);

    // Null sibling survives untouched.
    assertEquals(kept.evidenceSpan.keyNull, null);
    assertEquals(kept.checkedRawKeys.includes('keyNull'), true);

    // Audit field: NAMES only — exactly the hard key.
    assertEquals(kept.keysDroppedForUncleanSpan, ['keyHard']);

    // Anti-resurrection invariant + key-set coordination hold (validator).
    assertEquals(validateMcpBooleanObservationResponse(kept).ok, true);

    // The kept packet — WITH the soft survivor — re-scans CLEAN. This is the
    // explicit pin that the survivor is not caught: the hard key dies alone,
    // the soft sibling survives.
    assertEquals(m.scan(kept).ok, true);

    // Explicit reachability: the soft survivor's exact text is still present.
    assertEquals(kept.evidenceSpan.keySoft, m.softSpan);

    // The input is not mutated.
    assertEquals('keyHard' in resp.observations, true);
  });
}

Deno.test('MIX-banned-token-probe — across A/D/H/I/J the kept wire carries the soft survivor words, never the hard banned token', () => {
  for (const m of MIX) {
    const patterns = banPatternsForKeyLevelFamily(m.slug)!;
    const resp = responseFromSpans({ keyHard: m.hardSpan, keySoft: m.softSpan, keyNull: null });
    const dropped = findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns);
    const kept = dropUncleanEvidenceSpanKeys(resp, dropped);
    const serialized = JSON.stringify(kept);

    // The hard banned token never rides the kept wire (the unclean span was
    // dropped; keysDroppedForUncleanSpan carries NAMES only).
    assertEquals(
      serialized.toLowerCase().includes(m.hardToken.toLowerCase()),
      false,
      `family ${m.letter}: hard token ${JSON.stringify(m.hardToken)} leaked onto the kept wire`,
    );

    // The soft survivor's words DO reach the kept wire — proving the survivor,
    // not the banned content, is what survives.
    assertEquals(serialized.includes(m.softSpan), true);
  }
});
