/**
 * MCP-SERVER-008-FAMILY-G — Adversarial resolution_progress doctrine tests
 * (design §A.4 D4 BINDING).
 *
 * This file is dedicated to the design §A.4 binding requirement: 3
 * mandatory + 2 optional adversarial fixtures targeting the
 * resolution<->verdict boundary must exist, AND the runtime ban-list
 * scanner must reject every resolution-verdict token (won / lost /
 * defeated / prevailed / capitulated / ahead / behind / "settled in
 * favor" / "won the argument" / "conceded the loss" / "lost the
 * (point|argument|debate)" + the operator extensions proved / invalid /
 * wrong / "settled the truth") that the model might emit.
 *
 * Per intent §7 HALT triggers #17 + #18 + #21 + #22: a FAIL on any one
 * adversarial assertion is a doctrine violation requiring revert. The
 * existential is Fixture C — a broad concession wrapped in verdict words
 * ("won"/"lost"/"beat") in the INPUT, where the OUTPUT must stay clean.
 *
 * Fixture matrix (design §A.4):
 *   - A (mandatory): stronger-position exchange + narrowing — no
 *     who-is-winning framing.
 *   - B (mandatory): resolved/synthesis — doctrine-clean synthesis baseline.
 *   - C (mandatory; EXISTENTIAL): input contains verdict words TWICE.
 *     Output evidence_span must NOT echo them.
 *   - D (mandatory per intent A.4 stalemate case): stalemate/move-on — no
 *     verdict; move_on_requested vs issue_closed_by_participant discrimination.
 *   - E (optional): settlement verdict-baiting — input says "settled in your
 *     favor"; output anchors the accepted terms.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyGBooleanResponseForBanList,
  FAMILY_G_BAN_PATTERNS,
} from '../lib/familyGBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { validateMcpBooleanObservationResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_G_PROMPT_ENTRIES } from '../lib/familyGKeys.ts';
import { loadFixtureFamilyGPacket } from '../lib/familyGFixtureProvider.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-g-doctrine-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-g-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Design §A.4 D4 BINDING: 3 mandatory + 1 mandatory-stalemate + 1 optional
// adversarial fixtures
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4.A (mandatory): stronger-position fixture exists, parseable, targets narrowing keys', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-g-stronger-position-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('stronger-position fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('narrows_claim')) {
    throw new Error('stronger-position fixture should request narrows_claim');
  }
  const families = wrapper.input.requestedFamilies as string[];
  if (!families.includes('resolution_progress')) {
    throw new Error('stronger-position fixture should request resolution_progress family');
  }
});

Deno.test('design §A.4.A: stronger-position input narrows the claim (no who-is-winning framing required from output)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-stronger-position-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/narrow my claim/i.test(moveText)) {
    throw new Error('stronger-position fixture should contain narrowing text. Got: ' + moveText);
  }
});

Deno.test('design §A.4.B (mandatory): resolved-synthesis fixture exists, parseable, targets synthesis_proposed', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-resolved-synthesis-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('synthesis_proposed')) {
    throw new Error('resolved-synthesis fixture should request synthesis_proposed');
  }
});

Deno.test('design §A.4.B: resolved-synthesis input proposes a combined position (synthesis)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-resolved-synthesis-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/both are true/i.test(moveText) || !/which dominates/i.test(moveText)) {
    throw new Error('resolved-synthesis fixture should contain synthesis text. Got: ' + moveText);
  }
});

Deno.test('design §A.4.C BINDING (mandatory; EXISTENTIAL): concession-as-loss fixture INPUT contains verdict words TWICE', async () => {
  // The existential adversarial test. The input deliberately contains
  // verdict words ("won", "lost", "beat") multiple times. The classifier's
  // job is to detect concedes_broader_point without echoing the framing in
  // its OUTPUT evidence_span.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-concession-as-loss-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  // Count distinct verdict-word occurrences.
  const verdictMatches = moveText.match(/\b(won|lost|beat)\b/gi);
  if (!verdictMatches || verdictMatches.length < 2) {
    throw new Error(
      `design §A.4.C BINDING: concession-as-loss fixture MUST contain verdict words at least twice in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.C: concession-as-loss fixture is parseable and targets concedes_broader_point', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-concession-as-loss-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('concedes_broader_point')) {
    throw new Error('concession-as-loss fixture should request concedes_broader_point');
  }
});

Deno.test('design §A.4.D (mandatory stalemate): stalemate fixture exists, parseable, targets move_on_requested', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-stalemate-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('move_on_requested')) {
    throw new Error('stalemate fixture should request move_on_requested');
  }
  if (!rawKeys.includes('issue_closed_by_participant')) {
    throw new Error('stalemate fixture should also request issue_closed_by_participant (discrimination)');
  }
});

Deno.test('design §A.4.D: stalemate input is a set-aside (not a closure)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-stalemate-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/set it aside/i.test(moveText)) {
    throw new Error('stalemate fixture should contain set-aside text. Got: ' + moveText);
  }
});

Deno.test('design §A.4.E (optional): settlement-verdict-baiting fixture INPUT contains "settled in favor" bait', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-g-settlement-verdict-baiting-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const moveText = fixture.input.currentText as string;
  // Input should contain settlement-verdict bait words (the G ban-list
  // catches these in OUTPUT, not input — the fixture is bait).
  if (!/settled this in your favor|settled in favor/i.test(moveText)) {
    throw new Error(
      'settlement-verdict-baiting fixture INPUT should contain settlement-verdict bait. Got: ' +
        moveText,
    );
  }
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('accepts_settlement_terms')) {
    throw new Error('settlement-verdict-baiting fixture should request accepts_settlement_terms');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Canonical response fixture (smoke Checks 20+21) — valid + doctrine-clean
// ─────────────────────────────────────────────────────────────────────────

Deno.test('canonical-response fixture validates against the wire schema and is doctrine-clean', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-g-canonical-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    // The canonical response is positive-sparse and doctrine-clean.
    const scan = scanFamilyGBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, true);
    // Exactly 18 keys (the full ai_classifier subset).
    assertEquals(validated.value.checkedRawKeys.length, 18);
    assertEquals(validated.value.modelInfo.classifierSetVersion, 'family-g-v1');
  }
});

Deno.test('fixture provider loads the canonical Family G packet', async () => {
  const result = await loadFixtureFamilyGPacket();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(
      (result.value.modelInfo as Record<string, unknown>).classifierSetVersion,
      'family-g-v1',
    );
  }
});

Deno.test('ban-list-response fixture (dirty) is REJECTED by the scan', async () => {
  // Defensive: the ban-list fixture deliberately carries verdict tokens; the
  // scanner must reject it. Proves the scan is wired to the fixture shape.
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-g-ban-list-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyGBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, false);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: design §A.3.3 resolution-verdict tokens
// (HALT trigger #19)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.3 BINDING: ban-list rejects "won" in concedes_broader_point evidenceSpan', () => {
  const response = buildResponse('concedes_broader_point', 'the other side won this point');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.concedes_broader_point');
  }
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "lost" in evidenceSpan', () => {
  const response = buildResponse('concedes_broader_point', 'the author lost the broad claim');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "defeated" in evidenceSpan', () => {
  const response = buildResponse('concedes_narrow_point', 'the author is defeated here');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "prevailed" in evidenceSpan', () => {
  const response = buildResponse('synthesis_proposed', 'the pro side prevailed');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "capitulated" in evidenceSpan', () => {
  const response = buildResponse('accepts_settlement_terms', 'the author capitulated');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "ahead" in evidenceSpan', () => {
  const response = buildResponse('unresolved_point_isolated', 'the pro side is ahead');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "behind" in evidenceSpan', () => {
  const response = buildResponse('unresolved_point_isolated', 'the con side is behind');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "settled in favor" phrase in evidenceSpan', () => {
  const response = buildResponse(
    'accepts_settlement_terms',
    'the dispute was settled in favor of the pro side',
  );
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "won the argument" compound in evidenceSpan', () => {
  const response = buildResponse('synthesis_proposed', 'the pro side won the argument');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "conceded the loss" compound in evidenceSpan (existential)', () => {
  const response = buildResponse('concedes_broader_point', 'the author conceded the loss');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "lost the point" compound in evidenceSpan', () => {
  const response = buildResponse('concedes_narrow_point', 'the author lost the point');
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('operator extension BINDING: ban-list rejects "proved" / "invalid" / "wrong" / "settled the truth" in evidenceSpan', () => {
  for (const span of [
    'the synthesis proved the pro side right',
    'the broad claim is invalid',
    'the author was wrong',
    'this settled the truth of the matter',
  ]) {
    const response = buildResponse('concedes_broader_point', span);
    const result = scanFamilyGBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `expected ban-list to reject span: "${span}"`);
  }
});

Deno.test('design §A.3.3 BINDING: clean resolution-progress evidenceSpan (anchors relinquishment, no verdict) passes ban-list', () => {
  // The positive case: a doctrine-clean output that anchors the structural
  // relinquishment with a verbatim quote — no verdict framing.
  const response = buildResponse(
    'concedes_broader_point',
    'I withdraw the broad claim and stand on the narrow scope only',
  );
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.3.3 BINDING: FAMILY_G_BAN_PATTERNS contains all 11 design tokens + 4 operator-extension tokens (15)', () => {
  const targetTokens = [
    // design §A.3.3 (11)
    'won',
    'lost',
    'defeated',
    'prevailed',
    'capitulated',
    'ahead',
    'behind',
    'settled in favor',
    'won the argument',
    'conceded the loss',
    'lost the point',
    // operator extension (4)
    'settled the truth',
    'proved',
    'invalid',
    'wrong',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_G_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_G_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  assertEquals(FAMILY_G_BAN_PATTERNS.length, 15);
});

Deno.test('design §A.3.3 BINDING: near-miss words (wonderful/lostandfound/aheadofschedule/behindhand) are NOT flagged', () => {
  const nearMisses = [
    'this is a wonderful synthesis',
    'check the lostandfound registry',
    'we are aheadofschedule',
    'a behindhand reply is fine',
  ];
  for (const span of nearMisses) {
    const response = buildResponse('synthesis_proposed', span);
    const result = scanFamilyGBooleanResponseForBanList(response);
    assertEquals(result.ok, true, `near-miss should NOT be flagged: "${span}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Existential cross-checks (design §A.4 Fixture C + E): the OUTPUT stays
// clean regardless of verdict words in the INPUT.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4 Fixture C cross-check: simulated clean output (anchors relinquishment) passes', () => {
  // Fixture C input contains "won"/"lost"/"beat". The model's job: detect
  // concedes_broader_point but anchor the evidence_span on the STRUCTURAL
  // relinquishment, NOT on the verdict words from input.
  const response = buildResponse(
    'concedes_broader_point',
    'I withdraw the broad claim and stand on the narrow scope only',
  );
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture C cross-check: simulated dirty output (echoes "won"/"lost"/"beat") FAILS', () => {
  // The negative pole. If the model lifted the verdict words from input into
  // its evidence_span, the ban-list MUST catch it. This is the existential
  // adversarial proof (a FAIL here in live smoke is HALT + revert).
  for (const dirtySpan of [
    'you basically won this point',
    'I lost the broader argument',
    'you beat me, so I lost the point on durability',
  ]) {
    const response = buildResponse('concedes_broader_point', dirtySpan);
    const result = scanFamilyGBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §A.4 Fixture A cross-check: stronger-position clean output (narrowed scope) produces NO who-is-winning framing', () => {
  // The stronger-position exchange must produce a descriptive narrowing
  // evidence_span — never "ahead"/"stronger position"/"winning".
  const response = buildResponse(
    'narrows_claim',
    'they work where enforcement is stable, over 5+ year horizons',
  );
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
  // And a who-is-winning framing must be rejected.
  const dirty = buildResponse('narrows_claim', 'the other side is ahead and the author is behind');
  assertEquals(scanFamilyGBooleanResponseForBanList(dirty).ok, false);
});

Deno.test('design §A.4 Fixture D cross-check: stalemate clean output (set-aside) produces NO verdict', () => {
  const response = buildResponse(
    'move_on_requested',
    'can we set it aside and come back to the staffing question',
  );
  const result = scanFamilyGBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture E cross-check: settlement clean output (accepted terms) passes; echoed "settled in favor" FAILS', () => {
  // Fixture E input says "settled this in your favor". The clean output
  // anchors the accepted terms; the dirty output echoes the bait.
  const clean = buildResponse(
    'accepts_settlement_terms',
    'we use the 5-year delta criterion, exclude Australia',
  );
  assertEquals(scanFamilyGBooleanResponseForBanList(clean).ok, true);
  const dirty = buildResponse('accepts_settlement_terms', 'the point is settled in your favor');
  assertEquals(scanFamilyGBooleanResponseForBanList(dirty).ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Per-key prompt-entry guard sub-check (design §A.3.2 reviewer matrix)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.2 reviewer matrix sub-check: concedes_broader_point guard surfaces all forbidden resolution-verdict words', () => {
  // The per-key falsePositiveGuards for concedes_broader_point must
  // explicitly list the forbidden output words via "MUST NOT contain".
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'concedes_broader_point');
  if (!entry) throw new Error('concedes_broader_point prompt entry missing');
  const expectedForbiddenWords = [
    'won',
    'lost',
    'winner',
    'loser',
    'defeated',
    'prevailed',
    'capitulated',
    'ahead',
    'behind',
    'settled in favor',
  ];
  for (const word of expectedForbiddenWords) {
    if (!entry.falsePositiveGuards.includes(word)) {
      throw new Error(
        `concedes_broader_point falsePositiveGuards missing explicit mention of '${word}' as forbidden output`,
      );
    }
  }
});
