/**
 * MCP-BUILD2d — Family D (evidence_source_chain) +3 booleans + mapping rows +
 * the first batched family (22 keys → 2 batches).
 *
 * Build 2d of the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 Build-2
 * manifest (§3, Family D). Adds 3 evidence-DYNAMIC booleans to Family D + their
 * adopted mapping rows, taking the mcp-server Subset 19 → 22. D is the FIRST
 * live consumer of MCP-BOOLEAN-BATCHING-INFRA-001: 22 > the 20-key per-response
 * cap, so the Edge chunker splits the family's rawKey set into 2 batches
 * (16 + 6) and merges the responses into one 22-key result. This Jest suite
 * mirrors the Family-A/C/E (Build 2b/2c/2e) suites for the THR-4 forecast
 * (spawn card §4), PLUS adds the batching proof for the REAL Family D set:
 *
 *   1. Client ≡ Edge parity for the 3 new definitions (byte-equal logic via
 *      the Deno bridge helper); unique rawKeys.
 *   2. The 3 new defs are deployed A-G rawKeys (reconciliation) + Family D is
 *      still productionEnabled (no familyRegistry flip).
 *   3. The new registry rules FIRE on the new positive rawKeys via
 *      evaluateObservationMapping; composite-supersedes respected.
 *   4. Verdict-free + describes-the-MOVE-not-the-author ban-list over the 3
 *      new defs + their mapping rows, with WORD-BOUNDARY matching.
 *   5. EVIDENCE-DOCTRINE FENCE: a high-confidence D-positive grants NO factual
 *      standing (the anti-amplification module is untouched); the 3 new defs'
 *      guards/doctrineNotes carry the never-grant/deny-standing fence.
 *   6. The batching proof — D's REAL 22-key set → 2 batches (16 + 6) → merged
 *      22-key classification (end-to-end, mirroring the infra's synthetic test
 *      but for the REAL D family) — and adding D's keys requires NO infra
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
  'names_method_difference',
  'separates_observation_from_inference',
  'flags_context_limit',
] as const;

const NEW_OBSERVATION_CODES = [
  'evidence_source_chain.single_true.names_method_difference',
  'evidence_source_chain.single_false.names_method_difference',
  'evidence_source_chain.single_true.separates_observation_from_inference',
  'evidence_source_chain.single_false.separates_observation_from_inference',
  'evidence_source_chain.single_true.flags_context_limit',
  'evidence_source_chain.single_false.flags_context_limit',
];

// cdiscourse-doctrine §1 + §10a verdict / author-label ban-lists.
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
];

const AUTHOR_LABEL_PATTERNS = [
  'this person',
  'this user',
  'the author is',
  'the author was',
  'you are a',
  'they are a',
];

// The 22-key full Family D Subset (19 baseline + 3 MCP-BUILD2d), derived from
// the registry so the test stays in sync. This is the set the Edge chunker
// splits for the batching proof.
function familyDSubsetRawKeys(): string[] {
  // mcp-server Subset = the ai_classifier-source Family D keys (the 8
  // deterministic auto_metadata + lifecycle keys are excluded from the Subset).
  return getDefinitionsForFamily('evidence_source_chain')
    .filter((d) => d.source === 'ai_classifier')
    .map((d) => d.rawKey);
}

describe('MCP-BUILD2d — the 3 new Family D definitions exist + are well-formed', () => {
  it('Family D now contains exactly 30 definitions (27 baseline + 3 Build-2d)', () => {
    expect(getDefinitionsForFamily('evidence_source_chain')).toHaveLength(30);
  });

  it('Family D ai_classifier Subset is exactly 22 keys (19 baseline + 3 Build-2d; the batched set)', () => {
    expect(familyDSubsetRawKeys()).toHaveLength(22);
  });

  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" exists with family evidence_source_chain + source ai_classifier`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      expect(def).not.toBeNull();
      expect(def?.family).toBe('evidence_source_chain');
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

  it('the 3 new rawKeys are unique (no duplicate within Family D)', () => {
    const familyD = getDefinitionsForFamily('evidence_source_chain');
    const keys = familyD.map((d) => d.rawKey);
    for (const rawKey of NEW_RAW_KEYS) {
      expect(keys.filter((k) => k === rawKey)).toHaveLength(1);
    }
  });
});

describe('MCP-BUILD2d — client ≡ Edge mirror parity for the 3 new definitions', () => {
  it('Edge mirror Family D also has 30 definitions', () => {
    expect(edgeGetDefinitionsForFamily('evidence_source_chain')).toHaveLength(30);
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

describe('MCP-BUILD2d — NO schema-version bump (byte-equal regression)', () => {
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

describe('MCP-BUILD2d — reconciliation (new rawKeys are deployed A-G rawKeys)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" is in the deployed A-G rawKey set`, () => {
      expect(DEPLOYED_AG_RAW_KEYS.has(rawKey)).toBe(true);
    });
  }
});

describe('MCP-BUILD2d — verdict-free + describes-the-MOVE-not-the-author (definitions)', () => {
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

  it('no Family D Build-2d mapping-row user-facing string contains a verdict token (word-boundary)', () => {
    const d2dRows = OBSERVATION_MAPPING_REGISTRY.filter(
      (r) =>
        r.familyKey === 'evidence_source_chain' &&
        [...r.requiredTrueFlags, ...r.requiredFalseFlags].some((f) =>
          (NEW_RAW_KEYS as readonly string[]).includes(f),
        ),
    );
    expect(d2dRows.length).toBe(15);
    for (const row of d2dRows) {
      for (const field of [row.labelShort, row.labelNeutral, row.diagnosticSentence]) {
        for (const banned of VERDICT_BAN_LIST) {
          const re = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          expect(re.test(field)).toBe(false);
        }
      }
    }
  });
});

describe('MCP-BUILD2d — EVIDENCE-DOCTRINE FENCE (labels surface dynamics, never grant/deny standing)', () => {
  for (const rawKey of NEW_RAW_KEYS) {
    it(`"${rawKey}" guards + doctrineNotes carry the never-grant/deny-factual-standing fence`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const all = [
        ...(def?.falsePositiveGuards ?? []),
        ...(def?.doctrineNotes ?? []),
      ]
        .join(' ')
        .toLowerCase();
      // The fence must explicitly disclaim granting/denying factual standing.
      expect(all).toContain('factual standing');
      expect(all).toMatch(/never grant|does not grant|not grant or deny/);
    });

    it(`"${rawKey}" doctrineNotes anchor §10a structural framing (not a verdict)`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const notes = (def?.doctrineNotes ?? []).join(' ').toLowerCase();
      expect(notes).toContain('§10a');
    });

    it(`"${rawKey}" guards reference the anti-amplification module being untouched`, () => {
      const def = lookupMachineObservationDefinition(rawKey);
      const all = [
        ...(def?.falsePositiveGuards ?? []),
        ...(def?.doctrineNotes ?? []),
      ]
        .join(' ')
        .toLowerCase();
      expect(all).toContain('anti-amplification');
    });
  }

  it('a high-confidence D-positive does NOT change any factual-standing field (display-only, advisory)', () => {
    // The evaluator emits machine_observation marks only — no standing field,
    // no gate, no score. A positive on all 3 new D flags yields display marks
    // with NO standing/score/gate mutation (the anti-amplification module that
    // owns factual-standing is never invoked by the mapping evaluator).
    const out = evaluateObservationMapping(
      ['names_method_difference', 'separates_observation_from_inference', 'flags_context_limit'],
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

describe('MCP-BUILD2d — new mapping rows fire via evaluateObservationMapping', () => {
  it('names_method_difference single_true rule (MBOM-00095) fires in isolation', () => {
    const single = OBSERVATION_MAPPING_REGISTRY.find((r) => r.mappingId === 'MBOM-00095');
    expect(single).toBeDefined();
    const out = evaluateObservationMapping(
      ['names_method_difference'],
      [single!],
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00095')).toBe(true);
  });

  it('lone names_method_difference positive → its asymmetric pairs supersede the bare single', () => {
    const out = evaluateObservationMapping(
      ['names_method_difference'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01128'); // method-diff present, obs/inference absent
    expect(ids).toContain('MBOM-01131'); // method-diff present, context-limit absent
    expect(ids).not.toContain('MBOM-00095'); // bare single superseded by the pairs
  });

  it('names_method_difference absent → its single_false rule fires', () => {
    const out = evaluateObservationMapping(
      ['provides_evidence'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    expect(out.some((m) => m.mappingId === 'MBOM-00096')).toBe(true);
  });

  it('all 3 evidence-dynamic booleans positive → the pair rules fire and supersede consumed singles', () => {
    const out = evaluateObservationMapping(
      ['names_method_difference', 'separates_observation_from_inference', 'flags_context_limit'],
      OBSERVATION_MAPPING_REGISTRY,
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('MBOM-01127'); // method-diff × obs/inference
    expect(ids).toContain('MBOM-01130'); // method-diff × context-limit
    expect(ids).toContain('MBOM-01133'); // obs/inference × context-limit
    expect(ids).not.toContain('MBOM-00095'); // consumed
    expect(ids).not.toContain('MBOM-00097'); // consumed
    expect(ids).not.toContain('MBOM-00099'); // consumed
  });

  it('every emitted mark for the new rules is machine_observation + carries no gate field', () => {
    const out = evaluateObservationMapping(
      ['names_method_difference', 'flags_context_limit'],
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

describe('MCP-BUILD2d — mapping rows manifest + plain-language routing', () => {
  it('the manifest records exactly 15 adopted Build-2d Family D rules', () => {
    expect(OBSERVATION_MAPPING_ADOPTION_MANIFEST.build2dFamilyDAdoptedRules).toBe(15);
  });

  it('15 registry rules reference at least one of the 3 new rawKeys; all scoped to evidence_source_chain', () => {
    const newKeySet = new Set<string>(NEW_RAW_KEYS);
    const build2dRules = OBSERVATION_MAPPING_REGISTRY.filter((r) => {
      const flags = [...r.requiredTrueFlags, ...r.requiredFalseFlags];
      return flags.some((f) => newKeySet.has(f));
    });
    expect(build2dRules).toHaveLength(15);
    for (const rule of build2dRules) {
      for (const flag of [...rule.requiredTrueFlags, ...rule.requiredFalseFlags]) {
        expect(newKeySet.has(flag)).toBe(true);
      }
      expect(rule.familyKey).toBe('evidence_source_chain');
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
// §0.5 BATCHING PROOF — D is the FIRST family past the 20-key cap. Its REAL
// 22-key Subset must split into 2 batches (16 + 6), each a valid ≤20-key
// request, and merge back into one 22-key classification. Adding D's keys
// must NOT require any batching-infra change (BATCH_SIZE / threshold fixed).
// ─────────────────────────────────────────────────────────────────────────

function makeFullDRequest(rawKeys: string[]): McpBooleanObservationRequest {
  const definitions: Record<string, never> = {};
  for (const k of rawKeys) {
    // The batching helper only reads base.definitions[rawKey]; a lightweight
    // stub is sufficient for the request-narrowing assertions.
    (definitions as Record<string, unknown>)[k] = { rawKey: k };
  }
  return {
    schemaVersion: EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION as McpBooleanObservationRequest['schemaVersion'],
    nodeId: 'arg-d-1',
    parentNodeId: 'arg-d-0',
    currentText: 'method difference + observation/inference separation move',
    parentText: 'parent evidence claim',
    threadContextExcerpt: 'ancestor excerpt',
    requestedFamilies: ['evidence_source_chain'],
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
    nodeId: 'arg-d-1',
    checkedRawKeys: [...rawKeys],
    observations,
    confidence,
    evidenceSpan,
    modelInfo: { provider: 'mcp', serverName: 'cdiscourse-mcp', classifierSetVersion: 'family-d-v1' },
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

describe('MCP-BUILD2d — §0.5 batching proof (REAL Family D 22-key set → 2 batches → merged 22)', () => {
  const subset = familyDSubsetRawKeys();

  it('the REAL Family D Subset is 22 keys and EXCEEDS the per-response cap (20)', () => {
    expect(subset).toHaveLength(22);
    expect(subset.length).toBeGreaterThan(EDGE_BATCH_SPLIT_THRESHOLD);
  });

  it('chunkRawKeys splits the REAL D set into exactly 2 batches of 16 + 6', () => {
    const batches = edgeChunkRawKeys(subset);
    expect(batches).toHaveLength(2);
    expect(batches[0].rawKeys).toHaveLength(16);
    expect(batches[1].rawKeys).toHaveLength(6);
    expect(batches.every((b) => b.batchTotal === 2)).toBe(true);
  });

  it('batching infra is UNCHANGED by D (BATCH_SIZE=16, threshold=20)', () => {
    // Adding D must NOT require any batching-infra change. The constants the
    // chunker uses are byte-fixed; D consumes them as-is.
    expect(EDGE_BATCH_SIZE).toBe(16);
    expect(EDGE_BATCH_SPLIT_THRESHOLD).toBe(20);
  });

  it('each D batch is a valid <= 20-key request (passes the unchanged validator size)', () => {
    const batches = edgeChunkRawKeys(subset);
    for (const batch of batches) {
      expect(batch.rawKeys.length).toBeLessThanOrEqual(EDGE_BATCH_SPLIT_THRESHOLD);
    }
  });

  it('the 2 D batches are disjoint and their union is the full 22-key Subset', () => {
    const batches = edgeChunkRawKeys(subset);
    const flat = batches.flatMap((b) => [...b.rawKeys]);
    expect(new Set(flat).size).toBe(flat.length); // no dupes (disjoint)
    expect(new Set(flat)).toEqual(new Set(subset)); // union = full set
  });

  it('per-batch requests narrow requestedRawKeys + carry NO batch metadata on the wire', () => {
    const base = makeFullDRequest(subset);
    const batches = edgeChunkRawKeys(subset);
    const req0 = edgeBuildBatchRequestFromFull(base, batches[0]);
    const req1 = edgeBuildBatchRequestFromFull(base, batches[1]);
    expect(req0.requestedRawKeys.length).toBe(16);
    expect(req1.requestedRawKeys.length).toBe(6);
    for (const req of [req0, req1]) {
      const serialized = JSON.stringify(req);
      expect(serialized).not.toContain('batchIndex');
      expect(serialized).not.toContain('batchTotal');
      // schema version + family preserved on each batch.
      expect(req.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
      expect(req.requestedFamilies).toEqual(['evidence_source_chain']);
    }
  });

  it('2 D batch responses merge into ONE 22-key family result (the merge proof)', () => {
    const batches = edgeChunkRawKeys(subset);
    // Pick one positive in each batch so the merge unions positives across batches.
    const p0 = batches[0].rawKeys[3];
    const p1 = batches[1].rawKeys[2];
    const outcomes: EdgeBatchClassifyOutcome[] = [
      successOutcome(batches[0], [p0]),
      successOutcome(batches[1], [p1]),
    ];
    const { merged, collisions, successfulBatchCount } = edgeMergeBatchResponses(outcomes, 'arg-d-1');
    expect(successfulBatchCount).toBe(2);
    expect(collisions).toEqual([]);
    expect(merged.checkedRawKeys).toHaveLength(22);
    expect(new Set(merged.checkedRawKeys)).toEqual(new Set(subset));
    expect(Object.keys(merged.observations)).toHaveLength(22);
    // Positives from BOTH batches survive the merge.
    const positives = Object.entries(merged.observations)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .sort();
    expect(positives).toEqual([p0, p1].sort());
    // Merged schema version pinned (no bump via batching).
    expect(merged.schemaVersion).toBe(EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
  });

  it('the 3 new D booleans each land in exactly one batch (no key lost or duplicated)', () => {
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
