/**
 * OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — File 1 of 4 (THE HEART).
 *
 * Characterize-and-pin the soft-paraphrase SURVIVOR boundary for all ten
 * key-level-fail-closed families (A–J). Key-level fail-closed (PR #576 J-only,
 * PR #577 widened to A–J) replaced the packet-level death penalty with
 * key-level omission: an unclean evidenceSpan key dies ALONE and its clean
 * siblings survive and persist. That surfaced a residual the parent design
 * (docs/designs/OPS-MCP-KEY-LEVEL-FAIL-CLOSED.md) recorded plainly: a sibling
 * span that is regex-CLEAN but SOFT-PARAPHRASE — a person/intent
 * characterization the byte-unchanged ban-scan does not catch (e.g. "the author
 * seems biased", "they clearly have an agenda") — now survives on a clean
 * sibling. No regex closes this residual and the validator/ban-scan must never
 * be relaxed. This file delivers honesty-as-tests: it PINS a named taxonomy of
 * soft survivors as a tripwire, and re-proves the hard-control "caught" side per
 * family.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRIPWIRE CONVENTION (read before "fixing" any SURV-1 failure):
 *
 *   A SURV-1 failure means a pattern now catches a pinned soft survivor — that
 *   is a BOUNDARY-MOVED signal requiring deliberate re-assessment, NOT a
 *   regression to fix by editing or deleting the exemplar. If a pattern change
 *   legitimately catches one, MOVE it to the hard-control set with a documented
 *   boundary-moved note. Do NOT silently edit or delete the exemplar to make the
 *   test green — that would re-hide exactly the boundary shift this file exists
 *   to surface.
 *
 *   This file does NOT add or change a single ban pattern. Catching the soft
 *   class is a deliberate doctrine decision with its own production review
 *   surface; this file only CHARACTERIZES and PINS. The soft-paraphrase residual
 *   remains open by design (see the design doc §5 "What remains UNCOVERED").
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§10a): the corpus pins behavior only; it
 * asserts nothing about any real person. The hard-control banned tokens appear
 * ONLY as scan-detection inputs in this test file (established precedent —
 * keyLevelFailClosedWidening.test.ts / familyJKeyLevelFailClosed.test.ts use
 * fallacy/won/sloppy/troll the same way); never as app copy / labels / persisted
 * spans. The soft exemplars are pinned precisely because the system must NOT
 * treat them as findings. No real slurs anywhere.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  banPatternsForKeyLevelFamily,
  findUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';
import { scanFamilyDBooleanResponseForBanList } from '../lib/familyDBanListScan.ts';
import { scanFamilyEBooleanResponseForBanList } from '../lib/familyEBanListScan.ts';
import { scanFamilyFBooleanResponseForBanList } from '../lib/familyFBanListScan.ts';
import { scanFamilyGBooleanResponseForBanList } from '../lib/familyGBanListScan.ts';
import { scanFamilyHBooleanResponseForBanList } from '../lib/familyHBanListScan.ts';
import { scanFamilyIBooleanResponseForBanList } from '../lib/familyIBanListScan.ts';
import { scanFamilyJBooleanResponseForBanList } from '../lib/familyJBanListScan.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  type McpBooleanObservationValidatedResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

// ─────────────────────────────────────────────────────────────────────────
// Local test helpers (deliberate test-locality — NOT a shared util; the
// design's helper-duplication risk note keeps copies local so the survivor
// pins never depend on a file other tests import).
// ─────────────────────────────────────────────────────────────────────────

type ScanFn = (
  r: McpBooleanObservationValidatedResponse,
) => { ok: true } | { ok: false; path: string };

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
    nodeId: 'soft-survivor-node',
    checkedRawKeys: keys,
    observations,
    confidence,
    evidenceSpan: spans,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'soft-survivor-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §3.1 — the soft-paraphrase survivor taxonomy (the TRIPWIRE corpus).
//
// Five principled classes, 4 exemplars each (20 total). Every exemplar was
// checked against the UNION of all ten stacks (DOCTRINE ∪ FAMILY_E..J) and
// contains NO banned token; therefore each must survive EVERY family's pattern
// stack. The rationale per class is the kind of person/intent characterization
// that reads as an accusation yet evades a word-boundary token scan.
// ─────────────────────────────────────────────────────────────────────────

const SOFT_SURVIVOR_CORPUS: Record<string, readonly string[]> = {
  // 1. person-trait paraphrase — ascribes a disposition/character to the author
  //    without a banned token.
  person_trait_paraphrase: [
    'the author seems biased', // the parent design's canonical example
    'the writer comes across as closed-minded',
    'this person sounds defensive',
    'they appear emotionally invested', // J bans `unhinged`/`losing it`, not this
  ],
  // 2. intent attribution — ascribes a purpose.
  intent_attribution: [
    'this reads like it was written to mislead', // `mislead` not banned; `liar`/`dishonest`/`untrue` are
    'they clearly have an agenda', // parent design example
    'this seems designed to provoke',
    'the aim here appears to be distraction', // I bans `changing the subject`/`derail*`, not `distraction`
  ],
  // 3. competence insinuation — insinuates a lack of grasp/skill, avoiding H's
  //    quality verdicts.
  competence_insinuation: [
    "the author doesn't really understand the topic", // avoids `confused`/`incoherent`/`unsound`
    'they seem out of their depth',
    'this betrays a shallow grasp of the issue', // avoids `weak`/`sloppy`/`flawed`
    'the writer is in over their head',
  ],
  // 4. motive insinuation — insinuates an ulterior motive.
  motive_insinuation: [
    "they're just trying to score points", // bare `point(s)` not banned; G bans only `lost the point`
    'this looks like motivated reasoning', // `motivated reasoning` clean; E/H ban `bad reasoning`/`flawed reasoning`
    'the real aim seems to be self-promotion',
    'they have something to gain from this framing',
  ],
  // 5. group-affiliation insinuation — insinuates side/camp/shill membership,
  //    avoiding J's `astroturf*`/`bot`/`troll` and DOCTRINE's
  //    `propagandist`/`extremist`.
  group_affiliation_insinuation: [
    'this is exactly what someone on that side would say',
    'sounds like a talking point from their camp',
    'the author is clearly carrying water for one party',
    'reads like industry messaging',
  ],
};

const EXPECTED_CLASS_COUNT = 5;
const EXPECTED_TOTAL_SOFT_EXEMPLARS = 20;

const ALL_SOFT_EXEMPLARS: readonly string[] = Object.values(SOFT_SURVIVOR_CORPUS).flat();

// ─────────────────────────────────────────────────────────────────────────
// §3.2 — hard-control exemplars (one per family — the "caught" side).
//
// Each contains a banned token chosen to exercise that family's stack. For E–J
// the token lives ONLY in FAMILY_<X>_BAN_PATTERNS (not DOCTRINE), proving the
// family extension is wired into the collector (mirrors widening WIDEN-6).
// `familyExtensionToken` is null for A–D (shared doctrine stack only).
// ─────────────────────────────────────────────────────────────────────────

interface FamilyEntry {
  slug: string;
  letter: string;
  scan: ScanFn;
  /** §3.2 hard-control span (must be CAUGHT by this family's stack). */
  hardSpan: string;
  /**
   * A token that lives ONLY in this family's family-specific array (NOT in the
   * shared DOCTRINE list); SURV-2 asserts DOCTRINE alone does NOT catch it,
   * proving the family extension fired. NULL for A–D.
   */
  familyExtensionToken: string | null;
}

const FAMILIES: readonly FamilyEntry[] = [
  {
    slug: 'parent_relation',
    letter: 'A',
    scan: scanFamilyABooleanResponseForBanList,
    hardSpan: 'this names the loser of the debate', // `loser` (DOCTRINE)
    familyExtensionToken: null,
  },
  {
    slug: 'disagreement_axis',
    letter: 'B',
    scan: scanFamilyBBooleanResponseForBanList,
    hardSpan: "the parent's claim is the gospel truth", // `truth` (DOCTRINE)
    familyExtensionToken: null,
  },
  {
    slug: 'misunderstanding_repair',
    letter: 'C',
    scan: scanFamilyCBooleanResponseForBanList,
    hardSpan: 'the author is being dishonest here', // `dishonest` (DOCTRINE)
    familyExtensionToken: null,
  },
  {
    slug: 'evidence_source_chain',
    letter: 'D',
    scan: scanFamilyDBooleanResponseForBanList,
    hardSpan: 'they call this proof of the conclusion', // `proof of` (DOCTRINE)
    familyExtensionToken: null,
  },
  {
    slug: 'argument_scheme',
    letter: 'E',
    scan: scanFamilyEBooleanResponseForBanList,
    hardSpan: 'this is a textbook fallacy', // `fallacy` (FAMILY_E only)
    familyExtensionToken: 'fallacy',
  },
  {
    slug: 'critical_question',
    letter: 'F',
    scan: scanFamilyFBooleanResponseForBanList,
    hardSpan: 'the question refutes the parent', // `refutes` (FAMILY_F only)
    familyExtensionToken: 'refutes',
  },
  {
    slug: 'resolution_progress',
    letter: 'G',
    scan: scanFamilyGBooleanResponseForBanList,
    hardSpan: 'the pro side won the argument', // `won the argument` (FAMILY_G only)
    familyExtensionToken: 'won the argument',
  },
  {
    slug: 'claim_clarity',
    letter: 'H',
    scan: scanFamilyHBooleanResponseForBanList,
    hardSpan: 'the claim is sloppy and underspecified', // `sloppy` (FAMILY_H only)
    familyExtensionToken: 'sloppy',
  },
  {
    slug: 'thread_topology',
    letter: 'I',
    scan: scanFamilyIBooleanResponseForBanList,
    hardSpan: 'this is just rehashing the same point', // `rehashing` (FAMILY_I only)
    familyExtensionToken: 'rehashing',
  },
  {
    slug: 'sensitive_composer',
    letter: 'J',
    scan: scanFamilyJBooleanResponseForBanList,
    hardSpan: 'the author is acting like a troll', // `troll` (FAMILY_J only)
    familyExtensionToken: 'troll',
  },
];

// A clean sibling span used in SURV-2 — proves the collector picks ONLY the
// dirty key (verified clean against every stack by the widening precedent).
const CLEAN_SIBLING_SPAN = 'a calm and civil observation';

// ─────────────────────────────────────────────────────────────────────────
// SURV-shape — corpus shape invariants (exact-count friction lives here).
// ─────────────────────────────────────────────────────────────────────────

Deno.test('SURV-shape — corpus has exactly 5 classes, each non-empty', () => {
  const classes = Object.keys(SOFT_SURVIVOR_CORPUS);
  assertEquals(classes.length, EXPECTED_CLASS_COUNT);
  for (const c of classes) {
    assertEquals(SOFT_SURVIVOR_CORPUS[c].length > 0, true);
  }
});

Deno.test('SURV-shape — total soft exemplar count matches the pinned constant; every exemplar is a non-empty string', () => {
  assertEquals(ALL_SOFT_EXEMPLARS.length, EXPECTED_TOTAL_SOFT_EXEMPLARS);
  for (const ex of ALL_SOFT_EXEMPLARS) {
    assertEquals(typeof ex, 'string');
    assertEquals(ex.trim().length > 0, true);
  }
});

Deno.test('SURV-shape — no duplicate soft exemplar across the corpus', () => {
  assertEquals(new Set(ALL_SOFT_EXEMPLARS).size, ALL_SOFT_EXEMPLARS.length);
});

// ─────────────────────────────────────────────────────────────────────────
// SURV-1 [per family ×10] — THE TRIPWIRE. Every pinned soft survivor stays
// CLEAN under this family's stack (collector ⇔ scan agree on the CLEAN side).
//
// A failure here = a pattern now catches a pinned soft survivor = the doctrine
// boundary MOVED. Re-assess the boundary; do NOT edit the exemplar (see the
// TRIPWIRE CONVENTION in the header).
// ─────────────────────────────────────────────────────────────────────────

for (const fam of FAMILIES) {
  Deno.test(`SURV-1 [${fam.letter} ${fam.slug}] — every pinned soft survivor stays clean (collector ⇔ scan)`, () => {
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    for (const exemplar of ALL_SOFT_EXEMPLARS) {
      const resp = responseFromSpans({ soft: exemplar });
      assertEquals(
        findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns),
        [],
        `TRIPWIRE: a pattern now catches the pinned soft survivor ${
          JSON.stringify(exemplar)
        } for family ${fam.letter}. The doctrine boundary moved — re-assess and move the exemplar to the hard-control set with a boundary-moved note; do NOT edit or delete it to make this green.`,
      );
      assertEquals(
        fam.scan(resp).ok,
        true,
        `TRIPWIRE: family ${fam.letter} scan now rejects the pinned soft survivor ${
          JSON.stringify(exemplar)
        }. The doctrine boundary moved — re-assess; do NOT edit the exemplar.`,
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SURV-2 [per family ×10] — the hard-control span IS caught (collector ⇔ scan
// agree on the DIRTY side). For E–J, also prove DOCTRINE alone does NOT catch
// the family-extension token (so the family-specific array is what fired).
// ─────────────────────────────────────────────────────────────────────────

for (const fam of FAMILIES) {
  Deno.test(`SURV-2 [${fam.letter} ${fam.slug}] — the hard-control span is caught (collector ⇔ scan, dirty side)`, () => {
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    const resp = responseFromSpans({ keyClean: CLEAN_SIBLING_SPAN, keyDirty: fam.hardSpan });

    // The collector picks ONLY the dirty key.
    assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, patterns), ['keyDirty']);

    // The scan agrees on the exact failing path.
    const scan = fam.scan(resp);
    assertEquals(scan.ok, false);
    if (!scan.ok) {
      assertEquals(scan.path, 'evidenceSpan.keyDirty');
    }

    // E–J: the family extension (not the shared doctrine list) is what fired.
    if (fam.familyExtensionToken !== null) {
      assertEquals(
        DOCTRINE_BAN_PATTERNS.some((p) => p.test(fam.familyExtensionToken as string)),
        false,
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SURV-union — every soft survivor is clean against EVERY family stack in one
// aggregate pass (the cross-family survivor guarantee, single assertion). This
// is the backstop that an exemplar is clean across ALL ten stacks, not just the
// family under test.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('SURV-union — every soft survivor is clean against every family stack', () => {
  for (const fam of FAMILIES) {
    const patterns = banPatternsForKeyLevelFamily(fam.slug)!;
    for (const exemplar of ALL_SOFT_EXEMPLARS) {
      assertEquals(
        findUncleanEvidenceSpanKeys({ s: exemplar }, patterns),
        [],
        `TRIPWIRE: soft survivor ${
          JSON.stringify(exemplar)
        } is caught by family ${fam.letter} — the cross-family survivor guarantee broke; re-assess the boundary, do NOT edit the exemplar.`,
      );
    }
  }
});
