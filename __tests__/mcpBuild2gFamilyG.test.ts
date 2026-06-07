/**
 * MCP-BUILD2g — Family G (resolution_progress) +3 booleans + mapping rows +
 * batched family (21 keys → 2 batches of 16 + 5).
 *
 * Build 2g of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§6, Family G) — the LAST Build-2 family. Adds 3 resolution-progress
 * bookkeeping booleans to Family G + their adopted mapping rows, taking the
 * mcp-server Subset 18 → 21. Like Family D, G exceeds the 20-key per-response
 * cap, so the Edge chunker splits the family's rawKey set into 2 batches
 * (16 + 5) and merges the responses into one 21-key result. This Jest suite
 * mirrors the Family-D (Build 2d) suite for the THR-4 forecast (spawn card §4),
 * INCLUDING the batching proof for the REAL Family G set:
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family G is
 *      still its production family (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows, with WORD-BOUNDARY matching.
 *   5. EVIDENCE-DOCTRINE FENCE: a high-confidence G2-positive
 *      (defines_next_evidence_needed) grants NO factual standing (the
 *      anti-amplification module is untouched); the G2 def's guards/doctrineNotes
 *      carry the never-grant/deny-standing fence.
 *   6. The batching proof — G's REAL 21-key set → 2 batches (16 + 5) → merged
 *      21-key classification (end-to-end, mirroring the infra's synthetic test
 *      but for the REAL G family) — and adding G's keys requires NO infra
 *      change (BATCH_SIZE / threshold unchanged).
 *   7. NO schema-version bump (byte-equal regression on the constant, client +
 *      Edge mirror).
 *   8. The 3 new observation codes route through gameCopy to verdict-free,
 *      snake-free plain language.
 *
 * Pure-model tests: no React, no Supabase, no network. The Edge mirror loads
 * via __tests__/_helpers/booleanObservationEdgeDeno.ts (babel-transformed
 * require of the Deno tree).
 */

import {
  getDefinitionsForFamily,
  lookupMachineObservationDefinition,
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
} from '../src/features/nodeLabels/machineObservationDefinitions';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import {
  OBSERVATION_MAPPING_REGISTRY,
  OBSERVATION_MAPPING_ADOPTION_MANIFEST,
} from '../src/features/nodeLabels/observationMapping/observationMappingRegistry';
import { evaluateObservationMapping } from '../src/features/nodeLabels/observationMapping/observationMappingEvaluator';
import { DEPLOYED_AG_RAW_KEYS } from '../src/features/nodeLabels/observationMapping/deployedAgRawKeys';
import {
  looksLikeInternalCode,
  toPlainLanguageOrSuppress,
} from '../src/features/arguments/gameCopy';
import {
  EDGE_INTERNAL_ALL_DEFINITIONS,
  edgeLookupMachineObservationDefinition,
  EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  edgeGetDefinitionsForFamily,
  EDGE_BATCH_SIZE,
  EDGE_BATCH_SPLIT_THRESHOLD,
  edgeChunkRawKeys,
  edgeBuildBatchRequestFromFull,
  edgeMergeBatchResponses,
  type EdgeBatchClassifyOutcome,
  type EdgeRawKeyBatch,
} from './_helpers/booleanObservationEdgeDeno';
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from '../src/features/nodeLabels/mcpBooleanObservationSchema';

const NEW_RAW_KEYS = [
  'records_remaining_disagreement',
  'defines_next_evidence_needed',
  'separates_normative_from_empirical',
] as const;

const NEW_OBSERVATION_CODES = [
  'resolution_progress.single_true.records_remaining_disagreement',
  'resolution_progress.single_false.records_remaining_disagreement',
  'resolution_progress.single_true.defines_next_evidence_needed',
  'resolution_progress.single_false.defines_next_evidence_needed',
  'resolution_progress.single_true.separates_normative_from_empirical',
  'resolution_progress.single_false.separates_normative_from_empirical',
];

// cdiscourse-doctrine §1 + §10a verdict / author-label ban-lists. Family G
// carries the G-extended resolution<->verdict tokens (won / lost / etc.).
const VERDICT_BAN_LIST = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'troll',
  'astroturfer',
  // evidence-doctrine standing/truth verdict tokens (word-boundary).
  'true',
  'false',
  'proven',
  'correct',
  'incorrect',
  // Family G resolution<->verdict extended tokens (word-boundary).
  'won',
  'lost',
  'defeated',
  'prevailed',
  'capitulated',
  'ahead',
  'behind',
];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
];

// The 21-key full Family G Subset (18 baseline + 3 MCP-BUILD2g), derived from
// the registry so the test stays in sync. This is the set the Edge chunker
// splits for the batching proof.
function familyGSubsetRawKeys(): string[] {
  // mcp-server Subset = the ai_classifier-source Family G keys (the 12
  // deterministic auto_metadata + lifecycle keys are excluded from the Subset).
  return getDefinitionsForFamily('resolution_progress')
    .filter((d) => d.source === 'ai_classifier')
    .map((d) => d.rawKey);
}

describe('MCP-BUILD2g — the 3 new Family G definitions exist + are well-formed', () => {
  it('Family G now contains exactly 33 definitions (30 baseline + 3 Build-2g)', () => {
    expect(getDefinitionsForFamily('resolution_progress')).toHaveLength(33);
  });

  it('Family G ai_classifier Subset is exactly 21 keys (18 baseline + 3 Build-2g; the batched set)', () => {
    expect(familyGSubsetRawKeys()).toHaveLength(21);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family resolution_progress + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('resolution_progress');
      expect(def?.source).toBe('ai_classifier');
      expect(def?.kind).toBe('machine_observation');
    });

    it(`"${rawKey}" is Inspect-only + never visibleByDefault (display-only posture)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.defaultSurface).toBe('inspect');
      expect(def?.visibleByDefault).toBe(false);
      // future_source disposition means the adapter returns [] in v1 —
      // post-storage display-only, never a gate (§10a / acceptance-gate).
      expect(def?.disposition).toBe('future_source');
    });

    it(`"${rawKey}" carries a non-empty booleanQuestion + positive/negative definitions + guards`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.booleanQuestion.length).toBeGreaterThan(20);
      expect(def?.positiveDefinition.length).toBeGreaterThan(0);
      expect(def?.negativeDefinition.length).toBeGreaterThan(0);
      expect(def?.positiveExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.negativeExamples.length).toBeGreaterThanOrEqual(2);
      expect(def?.falsePositiveGuards.length).toBeGreaterThanOrEqual(1);
      expect(def?.doctrineNotes.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('the 3 new rawKeys are unique (no duplicate within Family G)', () => {
    const familyG = getDefinitionsForFamily('resolution_progress');
    const keys = familyG.map((d) => d.rawKey);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2g — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family G also has 33 definitions', () => {
    expect(edgeGetDefinitionsForFamily('resolution_progress')).toHaveLength(33);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is byte-equal (deep-equal) between client and Edge mirror`, () => {
      const client = lookupMachineObservationDefinition(rawKey);
      const edge = edgeLookupMachineObservationDefinition(rawKey);
      expect(client).not.toBeNull();
      expect(edge).not.toBeNull();
      expect(JSON.parse(JSON.stringify(edge))).toEqual(
        JSON.parse(JSON.stringify(client)),
      );
    });
  }

  it('client + Edge both expose exactly the same set of new rawKeys', () => {
    const clientKeys = new Set(EDGE_INTERNAL_ALL_DEFINITIONS.map((d) => d.rawKey));
    for (const rawKey of NEW_RAW_KEYS) {
      expect(clientKeys.has(rawKey)).toBe(true);
      expect(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey]).toBeDefined();
    }
  });
});

describe('MCP-BUILD2g — NO schema-version bump (byte-equal regression)', () => {
  it('client schema version constant is unchanged (v1, byte-equal)', () => {
    expect(MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      'mcp-021.machine-observations.boolean.v1',
    );
  });

  it('Edge mirror schema version constant equals the client constant (no drift)', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION).toBe(
      MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    );
  });
});

describe('MCP-BUILD2g — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2g — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
  function userFacingFieldsOf(rawKey: string): string[] {
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) return [];
    return [def.label, def.shortLabel, def.description];
  }

  for (const rawKey of NEW_RAW_KEYS) {
    for (const banned of VERDICT_BAN_LIST) {
      it(`"${rawKey}" user-facing fields contain no verdict token "${banned}"`, () => {
        for (const field of userFacingFieldsOf(rawKey)) {
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      });
    }

    it(`"${rawKey}" user-facing fields never label the author`, () => {
      for (const field of userFacingFieldsOf(rawKey)) {
        for (const pattern of AUTHOR_LABEL_PATTERNS) {
          expect(field.toLowerCase()).not.toContain(pattern);
        }
      }
    });

    it(`"${rawKey}" label + shortLabel are snake-free (no rawKey leak)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def?.label.includes('_')).toBe(false);
      expect(def?.shortLabel.includes('_')).toBe(false);
    });
  }

  it('no Family G Build-2g mapping-row user-facing string contains a verdict token (word-boundary)', () => {
    const g2gRows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.familyKey === 'resolution_progress' &&
        [...r.requiredTrueFlags, ...r.requiredFalseFlags].some((f) =>
          (NEW_RAW_KEYS as readonly string[]).includes(f),
        ),
    );
    expect(g2gRows.length).toBe(15);
    for (const row of g2gRows) {
      for (const field of [row.labelShort, row.labelNeutral, row.diagnosticSentence]) {
        for (const banned of VERDICT_BAN_LIST) {
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      }
    }
  });
});

describe('MCP-BUILD2g — EVIDENCE-DOCTRINE FENCE (G2 names a next step, never grants/denies standing)', () => {
  it('"defines_next_evidence_needed" guards + doctrineNotes carry the never-grant/deny-factual-standing fence', () => {
    const def = lookupMachineObservationDefinition('defines_next_evidence_needed');
    const all = [
      ...(def?.falsePositiveGuards ?? []),
      ...(def?.doctrineNotes ?? []),
    ]
      .join(' ')
      .toLowerCase();
    // The fence must explicitly disclaim granting/denying factual standing.
    expect(all).toContain('factual standing');
    expect(all).toMatch(/never grant|does not grant|not grant or deny/);
    // The fence must name the anti-amplification module as untouched.
    expect(all).toContain('anti-amplification');
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" doctrineNotes anchor §10a structural framing (not a verdict)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
      expect(notes).toContain('§10a');
    });
  }

  it('a high-confidence G-positive does NOT change any factual-standing field (display-only, advisory)', () => {
    // The evaluator emits machine_observation marks only — no standing field,
    // no gate, no score. A positive on all 3 new G flags yields display marks
    // with NO standing/score/gate mutation (the anti-amplification module that
    // owns factual-standing is never invoked by the mapping evaluator).
    const out = evaluateObservationMapping(
      [
        'records_remaining_disagreement',
        'defines_next_evidence_needed',
        'separates_normative_from_empirical',
      ],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.length).toBeGreaterThan(0);
    for (const mark of out) {
      expect(mark.kind).toBe('machine_observation');
      const rec = mark as unknown as Record<string, unknown>;
      // No factual-standing / scoring / gating field appears on any mark.
      expect(rec.factualStanding).toBeUndefined();
      expect(rec.standing).toBeUndefined();
      expect(rec.score).toBeUndefined();
      expect(rec.scoreDelta).toBeUndefined();
      expect(rec.block).toBeUndefined();
      expect(rec.gate).toBeUndefined();
    }
  });
});

describe('MCP-BUILD2g — new mapping rows fire via evaluateObservationMapping', () => {
  it('records_remaining_disagreement single_true rule (MBOM-00101) fires in isolation', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00101');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['records_remaining_disagreement'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00101')).toBe(true);
  });

  it('lone records_remaining_disagreement positive → its asymmetric pairs supersede the bare single', () => {
    const out = evaluateObservationMapping(
      ['records_remaining_disagreement'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01137'); // remaining present, next-evidence absent
    expect(ids).toContain('MBOM-01140'); // remaining present, normative/empirical absent
    expect(ids).not.toContain('MBOM-00101'); // bare single superseded by the pairs
  });

  it('records_remaining_disagreement absent → its single_false rule fires', () => {
    const out = evaluateObservationMapping(
      ['narrows_claim'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00102')).toBe(true);
  });

  it('all 3 resolution-progress booleans positive → the pair rules fire and supersede consumed singles', () => {
    const out = evaluateObservationMapping(
      [
        'records_remaining_disagreement',
        'defines_next_evidence_needed',
        'separates_normative_from_empirical',
      ],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01136'); // remaining × next-evidence
    expect(ids).toContain('MBOM-01139'); // remaining × normative/empirical
    expect(ids).toContain('MBOM-01142'); // next-evidence × normative/empirical
    expect(ids).not.toContain('MBOM-00101'); // consumed
    expect(ids).not.toContain('MBOM-00103'); // consumed
    expect(ids).not.toContain('MBOM-00105'); // consumed
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['records_remaining_disagreement', 'separates_normative_from_empirical'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.length).toBeGreaterThan(0);
    for (const mark of out) {
      expect(mark.kind).toBe('machine_observation');
      const rec = mark as unknown as Record<string, unknown>;
      expect(rec.block).toBeUndefined();
      expect(rec.route).toBeUndefined();
      expect(rec.suppress).toBeUndefined();
      expect(rec.delay).toBeUndefined();
      expect(rec.gate).toBeUndefined();
    }
  });
});

describe('MCP-BUILD2g — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 15 adopted Build-2g Family G rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2gFamilyGAdoptedRules).toBe(15);
  });

  it('15 registry rules reference at least one of the 3 new rawKeys; all scoped to resolution_progress', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2gRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2gRules).toHaveLength(15);
    for (const rule of build2gRules) {
      for (const flag of [...rule.requiredTrueFlags, ...rule.requiredFalseFlags]) {
        expect(newKeySet.has(flag)).toBe(true);
      }
      expect(rule.familyKey).toBe('resolution_progress');
    }
  });

  for (const code of NEW_OBSERVATION_CODES) {
    it(`observationCode "${code}" routes to a verdict-free, snake-free plain-language string`, () => {
      const mapped = toPlainLanguageOrSuppress(code);
      expect(mapped).not.toBeNull();
      expect(mapped!.length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(mapped!)).toBe(false);
      expect(mapped!).not.toMatch(/_/);
      for (const banned of VERDICT_BAN_LIST) {
        const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(mapped!)).toBe(false);
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// §0.5 BATCHING PROOF — G is the LAST Build-2 family past the 20-key cap. Its
// REAL 21-key Subset must split into 2 batches (16 + 5), each a valid ≤20-key
// request, and merge back into one 21-key classification. Adding G's keys must
// NOT require any batching-infra change (BATCH_SIZE / threshold fixed).
// ─────────────────────────────────────────────────────────────────────────

function makeFullGRequest(rawKeys: string[]): McpBooleanObservationRequest {
  const definitions: Record<string, never> = {};
  for (const k of rawKeys) {
    // The batching helper only reads base.definitions[rawKey]; a lightweight
    // stub is sufficient for the request-narrowing assertions.
    (definitions as Record<string, unknown>)[k] = { rawKey: k };
  }
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationRequest['schemaVersion'],
    nodeId: 'arg-g-1',
    parentNodeId: 'arg-g-0',
    currentText: 'records remaining disagreement + defines next evidence + separates normative from empirical move',
    parentText: 'parent resolution-progress claim',
    threadContextExcerpt: 'ancestor excerpt',
    requestedFamilies: ['resolution_progress'],
    requestedRawKeys: Object.freeze([...rawKeys]),
    definitions: definitions as McpBooleanObservationRequest['definitions'],
    timeoutMs: 12_000,
  };
}

function makeBatchResponse(
  rawKeys: readonly string[],
  positives: ReadonlyArray<string> = [],
): McpBooleanObservationResponse {
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceSpan: Record<string, string | null> = {};
  for (const k of rawKeys) {
    const isPositive = positives.includes(k);
    observations[k] = isPositive;
    confidence[k] = isPositive ? 'high' : 'low';
    evidenceSpan[k] = isPositive ? `span for ${k}` : null;
  }
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationResponse['schemaVersion'],
    nodeId: 'arg-g-1',
    checkedRawKeys: [...rawKeys],
    observations,
    confidence,
    evidenceSpan,
    modelInfo: { provider: 'mcp', serverName: 'cdiscourse-mcp', classifierSetVersion: 'family-g-v1' },
  };
}

function successOutcome(batch: EdgeRawKeyBatch, positives: string[] = []): EdgeBatchClassifyOutcome {
  return {
    batchIndex: batch.batchIndex,
    batchTotal: batch.batchTotal,
    rawKeys: batch.rawKeys,
    result: { kind: 'success', response: makeBatchResponse(batch.rawKeys, positives) },
  };
}

describe('MCP-BUILD2g — §0.5 batching proof (REAL Family G 21-key set → 2 batches → merged 21)', () => {
  const subset = familyGSubsetRawKeys();

  it('the REAL Family G Subset is 21 keys and EXCEEDS the per-response cap (20)', () => {
    expect(subset).toHaveLength(21);
    expect(subset.length).toBeGreaterThan(EDGE_BATCH_SPLIT_THRESHOLD);
  });

  it('chunkRawKeys splits the REAL G set into exactly 2 batches of 16 + 5', () => {
    const batches = edgeChunkRawKeys(subset);
    expect(batches).toHaveLength(2);
    expect(batches[0].rawKeys).toHaveLength(16);
    expect(batches[1].rawKeys).toHaveLength(5);
    expect(batches.every((b) => b.batchTotal === 2)).toBe(true);
  });

  it('batching infra is UNCHANGED by G (BATCH_SIZE=16, threshold=20)', () => {
    // Adding G must NOT require any batching-infra change. The constants the
    // chunker uses are byte-fixed; G consumes them as-is.
    expect(EDGE_BATCH_SIZE).toBe(16);
    expect(EDGE_BATCH_SPLIT_THRESHOLD).toBe(20);
  });

  it('each G batch is a valid <= 20-key request (passes the unchanged validator size)', () => {
    const batches = edgeChunkRawKeys(subset);
    for (const batch of batches) {
      expect(batch.rawKeys.length).toBeLessThanOrEqual(EDGE_BATCH_SPLIT_THRESHOLD);
    }
  });

  it('the 2 G batches are disjoint and their union is the full 21-key Subset', () => {
    const batches = edgeChunkRawKeys(subset);
    const flat = batches.flatMap((b) => [...b.rawKeys]);
    expect(new Set(flat).size).toBe(flat.length); // no dupes (disjoint)
    expect(new Set(flat)).toEqual(new Set(subset)); // union = full set
  });

  it('per-batch requests narrow requestedRawKeys + carry NO batch metadata on the wire', () => {
    const base = makeFullGRequest(subset);
    const batches = edgeChunkRawKeys(subset);
    const req0 = edgeBuildBatchRequestFromFull(base, batches[0]);
    const req1 = edgeBuildBatchRequestFromFull(base, batches[1]);
    expect(req0.requestedRawKeys.length).toBe(16);
    expect(req1.requestedRawKeys.length).toBe(5);
    for (const req of [req0, req1]) {
      const serialized = JSON.stringify(req);
      expect(serialized).not.toContain('batchIndex');
      expect(serialized).not.toContain('batchTotal');
      // schema version + family preserved on each batch.
      expect(req.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
      expect(req.requestedFamilies).toEqual(['resolution_progress']);
    }
  });

  it('2 G batch responses merge into ONE 21-key family result (the merge proof)', () => {
    const batches = edgeChunkRawKeys(subset);
    // Pick one positive in each batch so the merge unions positives across batches.
    const p0 = batches[0].rawKeys[3];
    const p1 = batches[1].rawKeys[2];
    const outcomes: EdgeBatchClassifyOutcome[] = [
      successOutcome(batches[0], [p0]),
      successOutcome(batches[1], [p1]),
    ];
    const { merged, collisions, successfulBatchCount } = edgeMergeBatchResponses(outcomes, 'arg-g-1');
    expect(successfulBatchCount).toBe(2);
    expect(collisions).toEqual([]);
    expect(merged.checkedRawKeys).toHaveLength(21);
    expect(new Set(merged.checkedRawKeys)).toEqual(new Set(subset));
    expect(Object.keys(merged.observations)).toHaveLength(21);
    // Positives from BOTH batches survive the merge.
    const positives = Object.entries(merged.observations)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .sort();
    expect(positives).toEqual([p0, p1].sort());
    // Merged schema version pinned (no bump via batching).
    expect(merged.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
  });

  it('the 3 new G booleans each land in exactly one batch (no key lost or duplicated)', () => {
    const batches = edgeChunkRawKeys(subset);
    for (const rawKey of NEW_RAW_KEYS) {
      const hits = batches.filter((b) => b.rawKeys.includes(rawKey));
      expect(hits).toHaveLength(1);
    }
  });

  it('batch assignment is deterministic + lexicographically stable (idempotent re-runs)', () => {
    const a = edgeChunkRawKeys(subset);
    const b = edgeChunkRawKeys([...subset].reverse());
    const findBatch = (batches: EdgeRawKeyBatch[], key: string) =>
      batches.findIndex((batch) => batch.rawKeys.includes(key));
    for (const key of subset) {
      expect(findBatch(a, key)).toBe(findBatch(b, key));
    }
  });
});
