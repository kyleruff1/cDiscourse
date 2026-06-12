/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — key-level fail-closed with span-omission
 * semantics (Family J, admin-validation-only on first ship).
 *
 * Two layers:
 *   1. UNIT — the shared dispatcher helper (`findUncleanEvidenceSpanKeys`,
 *      `dropUncleanEvidenceSpanKeys`, `banPatternsForKeyLevelFamily`,
 *      `KEY_LEVEL_FAIL_CLOSED_FAMILIES`) + a NO-DIVERGENCE consistency pin
 *      against `scanFamilyJBooleanResponseForBanList` (the helper's pattern set
 *      and the whole-packet scan are built from the identical exported
 *      constants, so they can never disagree).
 *   2. DISPATCHER — the full `handleClassifyArgumentBooleanObservations` Step-5
 *      branch, driven through the fixture provider (with the test-only
 *      `MCP_SERVER_FAMILY_J_FIXTURE_NAME` override): one dirty key dropped +
 *      siblings intact; all-dirty empty-success; modelInfo-dirty packet-fail;
 *      clean packet no-op; the canonical adversarial existential.
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§10a): omission asserts nothing; no
 * unclean span ever returns; the ban-scan patterns are byte-unchanged; the
 * audit field carries rawKey NAMES only; J stays admin-validation-only.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  handleClassifyArgumentBooleanObservations,
} from '../tools/classifyArgumentBooleanObservations.ts';
import {
  KEY_LEVEL_FAIL_CLOSED_FAMILIES,
  banPatternsForKeyLevelFamily,
  findUncleanEvidenceSpanKeys,
  dropUncleanEvidenceSpanKeys,
} from '../lib/keyLevelFailClosed.ts';
import {
  scanFamilyJBooleanResponseForBanList,
  FAMILY_J_BAN_PATTERNS,
} from '../lib/familyJBanListScan.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  validateMcpBooleanObservationResponse,
  type McpBooleanObservationValidatedResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';
const J_PATTERNS = banPatternsForKeyLevelFamily('sensitive_composer')!;

function fiveKeyResponse(
  overrides: { spans?: Partial<Record<string, string | null>> } = {},
): McpBooleanObservationValidatedResponse {
  const spans: Record<string, string | null> = {
    shifts_to_person_or_intent: 'because you work for an EV company',
    contains_unplayable_insult_only: null,
    needs_pre_send_pause: null,
    uses_popularity_as_evidence: 'Everyone knows this is the case',
    uses_satire_as_evidence: null,
    ...(overrides.spans ?? {}),
  };
  const keys = Object.keys(spans);
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  for (const k of keys) {
    observations[k] = true;
    confidence[k] = 'medium';
  }
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'unit-node-j',
    checkedRawKeys: keys,
    observations,
    confidence,
    evidenceSpan: spans,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-j-v1',
    },
  };
}

const DIRTY_PAUSE_SPAN =
  "You're such a troll and honestly toxic — NO you are WRONG WRONG WRONG!!!";

// ─────────────────────────────────────────────────────────────────────────
// UNIT — KEY_LEVEL_FAIL_CLOSED_FAMILIES + banPatternsForKeyLevelFamily
// ─────────────────────────────────────────────────────────────────────────

// OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING — RETARGETED. This test previously
// pinned the J-ONLY membership ("Family J ONLY; A–I return false;
// banPatternsForKeyLevelFamily('parent_relation') === null"). The widening
// intentionally lifts that bound to all ten families (a designed behavior
// change, not a weakening — the ban patterns + re-scan are unchanged). J stays
// a member (its key-drop behavior, proven below, is byte-unchanged); A–I are
// now members too. The full per-family no-divergence proof lives in
// keyLevelFailClosedWidening.test.ts.
Deno.test('KEY_LEVEL_FAIL_CLOSED_FAMILIES enables ALL TEN families (widening); J unchanged', () => {
  assertEquals(KEY_LEVEL_FAIL_CLOSED_FAMILIES.has('sensitive_composer'), true);
  for (
    const fam of [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
    ]
  ) {
    assertEquals(KEY_LEVEL_FAIL_CLOSED_FAMILIES.has(fam), true);
    // A widened family now resolves a non-null pattern stack (no longer null).
    assertEquals(banPatternsForKeyLevelFamily(fam) !== null, true);
  }
  // A string outside the ten registered families still resolves null.
  assertEquals(banPatternsForKeyLevelFamily('not_a_family'), null);
});

Deno.test('banPatternsForKeyLevelFamily(J) is the SAME stack the scan uses (no divergence by construction)', () => {
  const expected = [...DOCTRINE_BAN_PATTERNS, ...FAMILY_J_BAN_PATTERNS];
  assertEquals(J_PATTERNS.length, expected.length);
  // The patterns are the identical RegExp object references in order.
  for (let i = 0; i < expected.length; i += 1) {
    assertEquals(J_PATTERNS[i].source, expected[i].source);
    assertEquals(J_PATTERNS[i].flags, expected[i].flags);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// UNIT — findUncleanEvidenceSpanKeys
// ─────────────────────────────────────────────────────────────────────────

Deno.test('findUncleanEvidenceSpanKeys collects ONLY the dirty key; clean siblings + null spans are not collected', () => {
  const resp = fiveKeyResponse({ spans: { needs_pre_send_pause: DIRTY_PAUSE_SPAN } });
  const dirty = findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS);
  assertEquals(dirty, ['needs_pre_send_pause']);
});

Deno.test('findUncleanEvidenceSpanKeys collects MULTIPLE dirty keys, sorted', () => {
  const resp = fiveKeyResponse({
    spans: {
      needs_pre_send_pause: DIRTY_PAUSE_SPAN,
      uses_satire_as_evidence: 'this is just fake news anyway',
    },
  });
  const dirty = findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS);
  assertEquals(dirty, ['needs_pre_send_pause', 'uses_satire_as_evidence']);
});

Deno.test('findUncleanEvidenceSpanKeys is value-agnostic — a dirty span on a FALSE observation is still collected (defensive)', () => {
  // The collector is span-content-based: it does not read the observation value.
  const falseObsResponse: McpBooleanObservationValidatedResponse = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'unit-node-j-false-obs',
    checkedRawKeys: ['needs_pre_send_pause'],
    observations: { needs_pre_send_pause: false },
    confidence: { needs_pre_send_pause: 'medium' },
    evidenceSpan: { needs_pre_send_pause: DIRTY_PAUSE_SPAN },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-j-v1',
    },
  };
  const dirty = findUncleanEvidenceSpanKeys(falseObsResponse.evidenceSpan, J_PATTERNS);
  assertEquals(dirty, ['needs_pre_send_pause']);
});

Deno.test('findUncleanEvidenceSpanKeys returns [] for a fully clean packet', () => {
  const resp = fiveKeyResponse();
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS), []);
});

// ─────────────────────────────────────────────────────────────────────────
// UNIT — NO-DIVERGENCE: collector ⇔ scan (the binding consistency property)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('NO-DIVERGENCE: a key the collector returns is the EXACT evidenceSpan path the whole-packet scan reports', () => {
  const resp = fiveKeyResponse({ spans: { needs_pre_send_pause: DIRTY_PAUSE_SPAN } });
  const dirty = findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS);
  const scan = scanFamilyJBooleanResponseForBanList(resp);
  assertEquals(scan.ok, false);
  if (!scan.ok) {
    assertEquals(scan.path, `evidenceSpan.${dirty[0]}`);
  }
});

Deno.test('NO-DIVERGENCE: a clean packet — collector returns [] AND the scan returns ok', () => {
  const resp = fiveKeyResponse();
  assertEquals(findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS), []);
  assertEquals(scanFamilyJBooleanResponseForBanList(resp).ok, true);
});

// ─────────────────────────────────────────────────────────────────────────
// UNIT — dropUncleanEvidenceSpanKeys
// ─────────────────────────────────────────────────────────────────────────

Deno.test('dropUncleanEvidenceSpanKeys removes the key from ALL four maps; siblings intact; names sorted; re-validates clean', () => {
  const resp = fiveKeyResponse({ spans: { needs_pre_send_pause: DIRTY_PAUSE_SPAN } });
  const kept = dropUncleanEvidenceSpanKeys(resp, ['needs_pre_send_pause']);

  // Dropped key absent from every map + checkedRawKeys.
  assertEquals('needs_pre_send_pause' in kept.observations, false);
  assertEquals('needs_pre_send_pause' in kept.confidence, false);
  assertEquals('needs_pre_send_pause' in kept.evidenceSpan, false);
  assertEquals(kept.checkedRawKeys.includes('needs_pre_send_pause'), false);

  // Siblings intact.
  assertEquals(kept.observations.shifts_to_person_or_intent, true);
  assertEquals(kept.evidenceSpan.uses_popularity_as_evidence, 'Everyone knows this is the case');
  assertEquals(kept.checkedRawKeys.length, 4);

  // Audit field names ONLY, sorted.
  assertEquals(kept.keysDroppedForUncleanSpan, ['needs_pre_send_pause']);

  // The anti-resurrection invariant + key-set coordination hold (validator passes).
  const v = validateMcpBooleanObservationResponse(kept);
  assertEquals(v.ok, true);

  // The kept packet is now ban-clean.
  assertEquals(scanFamilyJBooleanResponseForBanList(kept).ok, true);

  // Input not mutated.
  assertEquals('needs_pre_send_pause' in resp.observations, true);
});

Deno.test('dropUncleanEvidenceSpanKeys ALL keys → empty maps + every name listed (sorted)', () => {
  const resp = fiveKeyResponse({
    spans: {
      shifts_to_person_or_intent: "you're a troll",
      contains_unplayable_insult_only: 'toxic',
      needs_pre_send_pause: DIRTY_PAUSE_SPAN,
      uses_popularity_as_evidence: 'bad actor everyone',
      uses_satire_as_evidence: 'fake news',
    },
  });
  const dirty = findUncleanEvidenceSpanKeys(resp.evidenceSpan, J_PATTERNS);
  const kept = dropUncleanEvidenceSpanKeys(resp, dirty);
  assertEquals(kept.checkedRawKeys, []);
  assertEquals(Object.keys(kept.observations), []);
  assertEquals(Object.keys(kept.confidence), []);
  assertEquals(Object.keys(kept.evidenceSpan), []);
  assertEquals(kept.keysDroppedForUncleanSpan.length, 5);
  assertEquals([...kept.keysDroppedForUncleanSpan], [...dirty].sort());
  assertEquals(validateMcpBooleanObservationResponse(kept).ok, true);
});

// ─────────────────────────────────────────────────────────────────────────
// DISPATCHER — full handler via fixture provider (key-level drop branch)
// ─────────────────────────────────────────────────────────────────────────

function withFamilyJFixture<T>(fixtureName: string, fn: () => Promise<T>): Promise<T> {
  const prevFlag = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  const prevName = Deno.env.get('MCP_SERVER_FAMILY_J_FIXTURE_NAME');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  Deno.env.set('MCP_SERVER_FAMILY_J_FIXTURE_NAME', fixtureName);
  return fn().finally(() => {
    if (prevFlag === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prevFlag);
    if (prevName === undefined) Deno.env.delete('MCP_SERVER_FAMILY_J_FIXTURE_NAME');
    else Deno.env.set('MCP_SERVER_FAMILY_J_FIXTURE_NAME', prevName);
  });
}

function jRequest(): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-j-key-drop',
    parentNodeId: null,
    currentText: 'fixture body text',
    parentText: null,
    threadContextExcerpt: 'fixture thread context',
    requestedFamilies: ['sensitive_composer'],
    requestedRawKeys: ['shifts_to_person_or_intent', 'needs_pre_send_pause'],
    definitions: {},
    timeoutMs: 12000,
  };
}

const BANNED_PROBE_TOKENS = [
  'troll',
  'toxic',
  'bot',
  'hostile',
  'ad hominem',
  'bad actor',
  'fake news',
  'winner',
  'loser',
  'liar',
];

Deno.test('DISPATCHER: one dirty key + clean siblings → key DROPPED by omission; isError:false; siblings persist', async () => {
  await withFamilyJFixture(
    'classify-argument-boolean-observations.family-j-key-drop-response.json',
    async () => {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: jRequest(),
        requestId: 'r-key-drop-1',
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, false);
      const sc = result.structuredContent as Record<string, unknown>;

      // Dropped key named (NAMES only).
      assertEquals(sc.keysDroppedForUncleanSpan, ['needs_pre_send_pause']);

      // Dropped key gone from every map + checkedRawKeys.
      const checked = sc.checkedRawKeys as string[];
      assertEquals(checked.includes('needs_pre_send_pause'), false);
      const obs = sc.observations as Record<string, unknown>;
      const conf = sc.confidence as Record<string, unknown>;
      const span = sc.evidenceSpan as Record<string, string | null>;
      assertEquals('needs_pre_send_pause' in obs, false);
      assertEquals('needs_pre_send_pause' in conf, false);
      assertEquals('needs_pre_send_pause' in span, false);

      // Clean siblings survive.
      assertEquals('shifts_to_person_or_intent' in obs, true);
      assertEquals('uses_popularity_as_evidence' in obs, true);

      // No banned token anywhere in the returned packet (the unclean span never
      // reaches the wire).
      const serialized = JSON.stringify(sc).toLowerCase();
      for (const token of BANNED_PROBE_TOKENS) {
        assertEquals(serialized.includes(token), false);
      }
    },
  );
});

Deno.test('DISPATCHER: ALL keys dirty → EMPTY-SUCCESS (checkedRawKeys=[], maps empty, all keys named), isError:false', async () => {
  await withFamilyJFixture(
    'classify-argument-boolean-observations.family-j-all-dirty-response.json',
    async () => {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: jRequest(),
        requestId: 'r-all-dirty-1',
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, false);
      const sc = result.structuredContent as Record<string, unknown>;
      assertEquals(sc.checkedRawKeys, []);
      assertEquals(Object.keys(sc.observations as Record<string, unknown>), []);
      assertEquals(Object.keys(sc.confidence as Record<string, unknown>), []);
      assertEquals(Object.keys(sc.evidenceSpan as Record<string, unknown>), []);
      const dropped = sc.keysDroppedForUncleanSpan as string[];
      assertEquals(dropped, ['needs_pre_send_pause', 'shifts_to_person_or_intent']);
      const serialized = JSON.stringify(sc).toLowerCase();
      for (const token of BANNED_PROBE_TOKENS) {
        assertEquals(serialized.includes(token), false);
      }
    },
  );
});

Deno.test('DISPATCHER: modelInfo-dirty (clean spans) → packet still FAILS validation_failed/doctrine_ban_list — NOT a key drop', async () => {
  await withFamilyJFixture(
    'classify-argument-boolean-observations.family-j-modelinfo-dirty-response.json',
    async () => {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: jRequest(),
        requestId: 'r-modelinfo-dirty-1',
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, true);
      const sc = result.structuredContent as Record<string, unknown>;
      assertEquals(sc.reason, 'validation_failed');
      assertEquals(sc.detail, 'doctrine_ban_list');
      assertEquals(sc.path, 'modelInfo.serverName');
      // No partial / dropped-key field leaks onto a failure envelope.
      assertEquals('keysDroppedForUncleanSpan' in sc, false);
    },
  );
});

Deno.test('DISPATCHER: clean canonical packet → no-op (no keysDroppedForUncleanSpan field), isError:false', async () => {
  await withFamilyJFixture(
    'classify-argument-boolean-observations.family-j-canonical-response.json',
    async () => {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: jRequest(),
        requestId: 'r-clean-noop-1',
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, false);
      const sc = result.structuredContent as Record<string, unknown>;
      assertEquals('keysDroppedForUncleanSpan' in sc, false);
      // Byte-identical checkedRawKeys to the fixture (no drop).
      assertEquals((sc.checkedRawKeys as string[]).length, 5);
    },
  );
});
