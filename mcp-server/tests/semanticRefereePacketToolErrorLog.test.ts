/**
 * COV-009 — `classify_semantic_move` tool error-log audit.
 *
 * Closes the per-surface gap in `docs/audits/COVERAGE-AUDIT-2026-06-30.md`
 * #9 (issue #813): the boolean-observation tool has the comprehensive
 * `classifyArgumentBooleanObservationsToolErrorLog` audit ensuring secrets and
 * payloads never leak; the semantic-move tool had no equivalent. Without this
 * file a regression in `errorResult` or a ban-list miss in `reasonCode` /
 * adjacent string fields would slip a verdict token or a fragment of the
 * request body into Deno logs.
 *
 * This is the semantic-move equivalent of
 * `tests/classifyArgumentBooleanObservationsToolErrorLog.test.ts`. It clones
 * the same capture-and-scan discipline: every Deno log line emitted during
 * each handler invocation is captured via the test-only log sink, then
 * (1) scanned for forbidden field keys, (2) scanned for secret-shaped
 * substrings (Anthropic key, Bearer, Supabase service key, JWT-ish), and
 * (3) scanned for any verbatim fragment of the request body. The structured
 * `failure_detail` envelope shape returned by `errorResult` is also asserted
 * to match the audit contract (typed `reason`, plain text `content[].text`,
 * `isError: true`, structural-only `extra` fields).
 *
 * The semantic-move tool currently emits a single typed log event,
 * `semantic_referee_packet_invalid`, on the packet-validation failure
 * branch. The other error branches (invalid_params, key_missing) reach
 * `errorResult` without emitting a typed log line — that is intentional: the
 * caller (toolDispatch / `/mcp` / `/mcp/adapter-compat`) carries the
 * per-request log envelope. This test pins BOTH posture choices so a future
 * refactor that adds a new emission site is forced to assert the same
 * leak-free invariants the boolean-observation suite already enforces.
 *
 * Scope: log side-effect + error envelope shape. Tool happy path and the
 * Anthropic provider call are NOT in scope (already covered by
 * `classifySemanticMove.test.ts` and `anthropicNoLogging.test.ts`).
 *
 * Reference patterns:
 *   - `tests/classifyArgumentBooleanObservationsToolErrorLog.test.ts` —
 *     the boolean-observation twin this file mirrors.
 *   - `tools/classifySemanticMove.ts:148-225` — the source range the audit
 *     anchors on (errorResult + packet-validation branch).
 *   - `lib/logging.ts` — defense-in-depth scrubFields + secret-shape
 *     substring regex set; this test re-asserts the contract on top.
 *   - `lib/semanticRefereePacketSchema.ts:402-420` — the inline doctrine
 *     ban-list scan that we exercise directly with verdict / liar / winner
 *     injected into reasonCode and the adjacent string fields. `scoreHints`
 *     keys are integer-typed by the schema, so an injected verdict token
 *     can only physically land in a string-typed field on the same packet
 *     — we inject across the full string-field set the validator scans
 *     (reasonCode, evidenceSpan, parentSpan, routeSuggestion,
 *     frictionSuggestion, modelVersion) to make sure no string siblings of
 *     scoreHints can slip a banned token past the validator.
 */
import { assert, assertEquals } from 'std/assert/mod.ts';
import { handleClassifySemanticMove } from '../tools/classifySemanticMove.ts';
import {
  _resetLogSinkForTesting,
  _setLogSinkForTesting,
} from '../lib/logging.ts';
import {
  DOCTRINE_BAN_PATTERNS,
} from '../lib/doctrineBanList.ts';
import {
  validateSemanticRefereePacket,
} from '../lib/semanticRefereePacketSchema.ts';

const PACKET_INVALID_EVENT = 'semantic_referee_packet_invalid';

// Allowlist of keys the existing `semantic_referee_packet_invalid` log line
// is permitted to carry (mirrors lib/logging.ts framing + the structural
// metadata classifySemanticMove.ts:215-220 attaches). A future emission site
// that adds a key outside this set must update the allowlist deliberately.
const ALLOWED_FIELD_KEYS_PACKET_INVALID: ReadonlySet<string> = new Set([
  // logger framing
  'ts',
  'level',
  'event',
  // structural metadata
  'tool',
  'reason',
  'requestId',
  'status',
]);

// Keys that must NEVER appear on ANY captured log line emitted during this
// tool's error paths. Mirrors the boolean-observation suite + the doctrine §6
// secrets policy. Adding a new entry tightens the contract.
const FORBIDDEN_FIELD_KEYS: readonly string[] = [
  // body / payload
  'moveBody',
  'moveBodyRedacted',
  'parentBody',
  'parentBodyRedacted',
  'argumentBody',
  'roomBody',
  'currentText',
  'parentText',
  'threadContextExcerpt',
  'rawPrompt',
  'prompt',
  'promptText',
  'rawResponse',
  'responseText',
  // packet internals
  'evidenceSpan',
  'parentSpan',
  'binaries',
  'scoreHints',
  'reasonCode',
  // auth / keys
  'authorization',
  'authorizationHeader',
  'auth',
  'bearer',
  'bearerToken',
  'apiKey',
  'anthropicApiKey',
  'anthropicKey',
  'token',
];

// Substring patterns that signal a secret leak in the RAW serialized line.
// Mirrors lib/logging.ts SECRET_SUBSTRING_PATTERNS plus the
// boolean-observation suite's extended set (Supabase service-key shapes).
const SECRET_SHAPE_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/i, // Anthropic API key
  /\bsbp_[A-Za-z0-9_-]+/i, // Supabase project token
  /\bsb_secret_[A-Za-z0-9_-]+/i, // Supabase service key
  /\bBearer\s+[A-Za-z0-9._-]+/i, // Bearer prefix + token
  /\beyJ[A-Za-z0-9._-]{20,}/, // JWT-ish
];

interface CapturedLine {
  raw: string;
  parsed: Record<string, unknown>;
}

function captureLogsAround<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; lines: CapturedLine[] }> {
  const captured: CapturedLine[] = [];
  _setLogSinkForTesting((line) => {
    let parsed: Record<string, unknown> = {};
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        parsed = obj as Record<string, unknown>;
      }
    } catch {
      // unparseable lines still pass through the raw-scan paths
    }
    captured.push({ raw: line, parsed });
  });
  return fn()
    .then((result) => ({ result, lines: captured }))
    .finally(() => {
      _resetLogSinkForTesting();
    });
}

function packetInvalidLines(lines: CapturedLine[]): CapturedLine[] {
  return lines.filter((l) => l.parsed.event === PACKET_INVALID_EVENT);
}

function assertNoForbiddenFields(line: CapturedLine): void {
  for (const forbidden of FORBIDDEN_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(line.parsed, forbidden)) {
      throw new Error(
        `semantic-move log line carries forbidden key '${forbidden}': ${line.raw}`,
      );
    }
  }
}

function assertNoSecretShape(line: CapturedLine): void {
  for (const re of SECRET_SHAPE_PATTERNS) {
    if (re.test(line.raw)) {
      throw new Error(
        `semantic-move log line carries secret-shaped substring matching ${re}: ${line.raw}`,
      );
    }
  }
}

/**
 * Assert no fragment of the request body verbatim leaked into the serialized
 * log line. We deliberately use distinct, low-entropy marker strings in the
 * fixture request so a substring match here is a true positive (and not, for
 * example, a coincidental word in a framing field like `status`).
 */
function assertNoBodyLeak(line: CapturedLine, markers: readonly string[]): void {
  for (const marker of markers) {
    if (line.raw.includes(marker)) {
      throw new Error(
        `semantic-move log line leaked request-body marker '${marker}': ${line.raw}`,
      );
    }
  }
}

function withFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  });
}

function withoutFixtureOrKey<T>(fn: () => Promise<T>): Promise<T> {
  const prevFlag = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  const prevKey = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.delete('ANTHROPIC_API_KEY');
  return fn().finally(() => {
    if (prevFlag !== undefined) Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prevFlag);
    if (prevKey !== undefined) Deno.env.set('ANTHROPIC_API_KEY', prevKey);
  });
}

// Markers that uniquely identify the request body in our fixture inputs.
// These tokens are deliberately not words that appear in the structural
// framing of the log line (`status`, `tool`, etc.).
const BODY_MARKER_MOVE = 'zzqwxbody-move-marker-001';
const BODY_MARKER_PARENT = 'zzqwxbody-parent-marker-002';
const ROOM_MARKER = 'zzqwxroom-marker-003';
const CONTENT_HASH_MARKER = 'zzqwxhash-marker-004';

function buildBodyMarkedArgs(): Record<string, unknown> {
  return {
    moveBodyRedacted: `${BODY_MARKER_MOVE} this is the redacted move body text`,
    parentBodyRedacted: `${BODY_MARKER_PARENT} this is the parent move body text`,
    roomContext: {
      debateMode: 'structured_dispute',
      side: 'affirmative',
      actorRole: 'primary_opponent',
    },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: CONTENT_HASH_MARKER,
    roomId: ROOM_MARKER,
  };
}

const BODY_MARKERS: readonly string[] = [
  BODY_MARKER_MOVE,
  BODY_MARKER_PARENT,
  ROOM_MARKER,
  CONTENT_HASH_MARKER,
];

// ── invalid_params: args not a JSON object ────────────────────────────
//
// The handler returns errorResult('invalid_params', ...) BEFORE any typed
// log emission. We assert (a) the envelope shape, (b) no log line emitted
// here mentions Authorization / key shapes / verbatim body fragments, and
// (c) the structured `failure_detail` extras stay empty (no `path` / no
// `detail` leak when there's nothing to validate yet).

Deno.test('classifySemanticMove invalid_params on non-object args: error envelope sanitized and no body leak', async () => {
  // The "input" itself is a string that could plausibly carry a key shape —
  // verify the error path does not echo it into the log stream.
  const dangerousInput =
    'sk-ant-AAAAA000000000000000-this-is-a-fake-key-shape-zzqwxbody';
  const { result, lines } = await captureLogsAround(() =>
    handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: dangerousInput as unknown as Record<string, unknown>,
      requestId: 'r-cov009-not-object',
      envelope: 'jsonRpc',
    })
  );
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string };
  assertEquals(sc.reason, 'invalid_params');
  // The error message is hand-written and structural — never the input itself.
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, 'text');
  const text = result.content[0].text;
  assert(typeof text === 'string' && text.length > 0, 'content text non-empty');
  assert(
    !text.includes('sk-ant-'),
    'error message must not echo the dangerous input verbatim',
  );
  assert(
    !text.includes('zzqwxbody'),
    'error message must not echo the dangerous input verbatim',
  );
  // The handler does NOT emit a typed log line on this branch today; if a
  // future refactor adds one, every line must respect the leak-free contract.
  for (const line of lines) {
    assertNoForbiddenFields(line);
    assertNoSecretShape(line);
    assertNoBodyLeak(line, ['sk-ant-', 'zzqwxbody']);
  }
});

// ── invalid_params: schema validation failure ─────────────────────────
//
// validateClassifyMoveInput returns ok:false → errorResult with structural
// `path` + `detail` extras. The extras MUST be structural identifiers
// (`'moveBodyRedacted'`, `'must be a string'`) — never a fragment of the
// rejected input. We inject body markers across every field so a leak from
// any of them would surface here.

Deno.test('classifySemanticMove invalid_params on schema failure: extras are structural; no input leak in envelope or logs', async () => {
  const badArgs = {
    moveBodyRedacted: 12345, // wrong type — triggers checkStringBound failure
    parentBodyRedacted: BODY_MARKER_PARENT,
    roomContext: {
      debateMode: 'structured_dispute',
      side: 'affirmative',
      actorRole: 'primary_opponent',
    },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: CONTENT_HASH_MARKER,
    roomId: ROOM_MARKER,
    // adjacent leak vector: an apiKey-shaped sibling that the dispatcher
    // (or a misconfigured caller) might attach. The validator rejects the
    // whole object on the first failure; the test pins that no key-shaped
    // string survives into the log stream.
    apiKey: 'sk-ant-AAAAA000000000000000-fake-zzqwxbody',
  };
  const { result, lines } = await captureLogsAround(() =>
    handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: badArgs as unknown as Record<string, unknown>,
      requestId: 'r-cov009-schema',
      envelope: 'jsonRpc',
    })
  );
  assertEquals(result.isError, true);
  const sc = result.structuredContent as {
    reason: string;
    path?: string;
    detail?: string;
  };
  assertEquals(sc.reason, 'invalid_params');
  // Structural failure_detail shape: path is a field identifier, detail is
  // a short structural description — never a verbatim copy of the input.
  assertEquals(typeof sc.path, 'string');
  assertEquals(typeof sc.detail, 'string');
  assert((sc.path ?? '').length > 0, 'path present');
  assert((sc.detail ?? '').length > 0, 'detail present');
  for (const marker of BODY_MARKERS) {
    assert(
      !(sc.path ?? '').includes(marker),
      `path must not echo body marker '${marker}'`,
    );
    assert(
      !(sc.detail ?? '').includes(marker),
      `detail must not echo body marker '${marker}'`,
    );
  }
  // Envelope text is structural.
  const text = result.content[0].text;
  for (const marker of BODY_MARKERS) {
    assert(!text.includes(marker), `envelope text must not echo '${marker}'`);
  }
  // Every captured log line: leak-free.
  for (const line of lines) {
    assertNoForbiddenFields(line);
    assertNoSecretShape(line);
    assertNoBodyLeak(line, [...BODY_MARKERS, 'sk-ant-']);
  }
});

// ── key_missing: provider unavailable (no fixture, no Anthropic key) ─
//
// The handler reaches errorResult with `reason: 'key_missing'` (per the
// existing classifySemanticMove.test.ts coverage). We pin that the body
// supplied in the request does not leak into the envelope or logs even
// though the request was structurally valid (it carried verbatim content).

Deno.test('classifySemanticMove key_missing: provider error envelope sanitized; no request body leak', async () => {
  const { result, lines } = await withoutFixtureOrKey(() =>
    captureLogsAround(() =>
      handleClassifySemanticMove({
        toolName: 'classify_semantic_move',
        rawArgs: buildBodyMarkedArgs(),
        requestId: 'r-cov009-keymissing',
        envelope: 'jsonRpc',
      })
    )
  );
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string; detail?: string };
  assertEquals(sc.reason, 'key_missing');
  const text = result.content[0].text;
  // The error text is generated from the provider reason — assert it
  // mentions 'key_missing' (the structural reason code) and NOT any body
  // marker.
  assert(text.includes('key_missing'), 'envelope text names the structural reason');
  for (const marker of BODY_MARKERS) {
    assert(
      !text.includes(marker),
      `envelope text must not echo body marker '${marker}'`,
    );
    if (typeof sc.detail === 'string') {
      assert(
        !sc.detail.includes(marker),
        `structuredContent.detail must not echo body marker '${marker}'`,
      );
    }
  }
  for (const line of lines) {
    assertNoForbiddenFields(line);
    assertNoSecretShape(line);
    assertNoBodyLeak(line, BODY_MARKERS);
  }
});

// ── success path: no packet-invalid event fires (negative control) ────
//
// Mirrors the boolean-observation suite's `…does NOT fire on success` test.
// We run the fixture-backed happy path and assert zero
// `semantic_referee_packet_invalid` lines (and zero forbidden / secret /
// body leaks on any line emitted along the way).

Deno.test('classifySemanticMove success path emits NO semantic_referee_packet_invalid', async () => {
  const { result, lines } = await withFixtureEnv(() =>
    captureLogsAround(() =>
      handleClassifySemanticMove({
        toolName: 'classify_semantic_move',
        rawArgs: buildBodyMarkedArgs(),
        requestId: 'r-cov009-happy',
        envelope: 'jsonRpc',
      })
    )
  );
  assertEquals(result.isError, false);
  assertEquals(
    packetInvalidLines(lines).length,
    0,
    'success path must NOT emit semantic_referee_packet_invalid',
  );
  for (const line of lines) {
    assertNoSecretShape(line);
    assertNoBodyLeak(line, BODY_MARKERS);
  }
});

// ── doctrine ban-list catches verdict tokens in every scanned string field
//
// The audit explicitly asks: "inject 'verdict', 'liar', 'winner' into
// reasonCode and scoreHints. Assert no payload text, no Authorization, no
// key shapes, and structured failure_detail shape matches the audit
// contract."
//
// scoreHints fields are integer-typed by the structural subset (see
// validateScoreHints in lib/semanticRefereePacketSchema.ts), so a verdict
// TOKEN cannot land on `continuityCredit` / `evidencePressure` / etc.
// without first failing the integer check. The validator runs the doctrine
// ban-list scan over the full string-field set on the packet (reasonCode,
// evidenceSpan, parentSpan, routeSuggestion, frictionSuggestion,
// modelVersion). We inject into each of those slots and verify each
// rejection comes back with the structured failure_detail shape:
//   { ok: false, path: '<structural-identifier>', detail: 'doctrine_ban_list' }

function validBinariesEntry(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    classifierId: 'responds_to_parent',
    value: 1,
    confidence: 'medium',
    reasonCode: 'parent_continuation_observed',
    ...overrides,
  };
}

function validBasePacket(): Record<string, unknown> {
  return {
    binaries: [validBinariesEntry()],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 1,
      evidencePressure: 0,
      branchHygiene: 1,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

interface BanCase {
  label: string;
  packet: Record<string, unknown>;
  expectedPathPrefix: string;
}

const BAN_CASES: readonly BanCase[] = [
  {
    label: "verdict in binaries[0].reasonCode",
    packet: (() => {
      const p = validBasePacket();
      (p.binaries as Array<Record<string, unknown>>)[0] = validBinariesEntry({
        reasonCode: 'verdict_decided_for_parent',
      });
      return p;
    })(),
    expectedPathPrefix: 'binaries[0]',
  },
  {
    label: "liar in binaries[0].evidenceSpan",
    packet: (() => {
      const p = validBasePacket();
      (p.binaries as Array<Record<string, unknown>>)[0] = validBinariesEntry({
        evidenceSpan: 'the parent called the responder a liar in this passage',
      });
      return p;
    })(),
    expectedPathPrefix: 'binaries[0]',
  },
  {
    label: "winner in binaries[0].parentSpan",
    packet: (() => {
      const p = validBasePacket();
      (p.binaries as Array<Record<string, unknown>>)[0] = validBinariesEntry({
        parentSpan: 'the parent move claims to be the winner of the round',
      });
      return p;
    })(),
    expectedPathPrefix: 'binaries[0]',
  },
  {
    label: "loser in modelVersion",
    packet: (() => {
      const p = validBasePacket();
      p.modelVersion = 'fixture-loser-build';
      return p;
    })(),
    expectedPathPrefix: 'modelVersion',
  },
];

Deno.test('validateSemanticRefereePacket rejects every verdict-token slot with structural failure_detail', () => {
  for (const c of BAN_CASES) {
    const result = validateSemanticRefereePacket(c.packet);
    assertEquals(result.ok, false, `${c.label}: must be rejected`);
    if (result.ok) continue; // narrow for the type checker; unreachable
    // Structural failure_detail shape: path is a field identifier, detail
    // is the literal 'doctrine_ban_list' marker (per
    // lib/semanticRefereePacketSchema.ts:417).
    assert(
      result.path.startsWith(c.expectedPathPrefix),
      `${c.label}: path '${result.path}' must start with '${c.expectedPathPrefix}'`,
    );
    assertEquals(
      result.detail,
      'doctrine_ban_list',
      `${c.label}: detail must be the structural marker`,
    );
    // The path is a structural identifier — never a verbatim quote of the
    // banned content.
    assert(
      !/verdict|liar|winner|loser/i.test(result.path),
      `${c.label}: path must not echo the banned token`,
    );
  }
});

// Defense-in-depth: routeSuggestion + frictionSuggestion are enum-gated,
// so a verdict TOKEN there fails the enum check first (the validator's
// route/friction check runs BEFORE the doctrine scan). We pin that posture
// so a future widening of the enums does not silently bypass the scan.

Deno.test('validateSemanticRefereePacket: routeSuggestion / frictionSuggestion enum-gated before ban scan', () => {
  const badRoute = validBasePacket();
  badRoute.routeSuggestion = 'verdict_route';
  const rResult = validateSemanticRefereePacket(badRoute);
  assertEquals(rResult.ok, false);
  if (!rResult.ok) {
    assertEquals(rResult.path, 'routeSuggestion');
    // The enum gate fires before the doctrine scan, so the detail is the
    // enum-failure marker (NOT 'doctrine_ban_list').
    assert(
      rResult.detail.includes('known route value'),
      `route enum gate must fire first; got detail='${rResult.detail}'`,
    );
  }
  const badFriction = validBasePacket();
  badFriction.frictionSuggestion = 'liar_chip';
  const fResult = validateSemanticRefereePacket(badFriction);
  assertEquals(fResult.ok, false);
  if (!fResult.ok) {
    assertEquals(fResult.path, 'frictionSuggestion');
    assert(
      fResult.detail.includes('known friction value'),
      `friction enum gate must fire first; got detail='${fResult.detail}'`,
    );
  }
});

// Defense-in-depth: scoreHints integer slots cannot carry a verdict TOKEN
// because the integer check fires first. We pin that posture so a future
// schema relaxation that allowed strings in scoreHints would not silently
// bypass the doctrine scan without a deliberate test update.

Deno.test('validateSemanticRefereePacket: scoreHints field rejects strings before doctrine scan', () => {
  const bad = validBasePacket();
  (bad.scoreHints as Record<string, unknown>).continuityCredit = 'verdict' as unknown as number;
  const result = validateSemanticRefereePacket(bad);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'scoreHints.continuityCredit');
    // Integer-gate failure runs before the doctrine scan, so the detail is
    // the structural integer-check marker.
    assert(
      result.detail.includes('integer'),
      `integer gate must fire first; got detail='${result.detail}'`,
    );
  }
});

// Sanity: the audit-named verdict tokens really are in the ban-list
// pattern set (regression guard against a future shrink of
// doctrineBanList.ts). If this fails, the rest of the suite is testing
// the wrong contract.

Deno.test('doctrine ban-list set still covers the audit-named verdict tokens', () => {
  const auditTokens: readonly string[] = ['verdict', 'liar', 'winner', 'loser'];
  for (const token of auditTokens) {
    const probe = `the move contains the ${token} word as a hostile label`;
    let matched = false;
    for (const re of DOCTRINE_BAN_PATTERNS) {
      if (re.test(probe)) {
        matched = true;
        break;
      }
    }
    assert(
      matched,
      `DOCTRINE_BAN_PATTERNS must still catch the audit-named token '${token}'`,
    );
  }
});

// Cross-cutting leak guard: aggregate every captured line from the error
// reason matrix and apply the FULL forbidden-key + secret-shape + body-leak
// scan in one pass. Mirrors the final `…across the error reason matrix`
// test in the boolean-observation suite.

Deno.test('classifySemanticMove emitted log lines never carry forbidden keys, secret shapes, or body markers across the error reason matrix', async () => {
  const aggregated: CapturedLine[] = [];

  // 1) invalid_params on non-object args
  {
    const { lines } = await captureLogsAround(() =>
      handleClassifySemanticMove({
        toolName: 'classify_semantic_move',
        rawArgs: ('sk-ant-AAAAA000000000000000-fake-zzqwxbody' as unknown) as
          Record<string, unknown>,
        requestId: 'r-cov009-scan-1',
        envelope: 'jsonRpc',
      })
    );
    aggregated.push(...lines);
  }
  // 2) invalid_params on schema failure
  {
    const { lines } = await captureLogsAround(() =>
      handleClassifySemanticMove({
        toolName: 'classify_semantic_move',
        rawArgs: {
          moveBodyRedacted: 12345,
          contentHash: CONTENT_HASH_MARKER,
          roomId: ROOM_MARKER,
          roomContext: {},
          requestedClassifiers: ['responds_to_parent'],
        } as unknown as Record<string, unknown>,
        requestId: 'r-cov009-scan-2',
        envelope: 'jsonRpc',
      })
    );
    aggregated.push(...lines);
  }
  // 3) key_missing (no fixture, no key)
  {
    const { lines } = await withoutFixtureOrKey(() =>
      captureLogsAround(() =>
        handleClassifySemanticMove({
          toolName: 'classify_semantic_move',
          rawArgs: buildBodyMarkedArgs(),
          requestId: 'r-cov009-scan-3',
          envelope: 'jsonRpc',
        })
      )
    );
    aggregated.push(...lines);
  }
  // 4) success path
  {
    const { lines } = await withFixtureEnv(() =>
      captureLogsAround(() =>
        handleClassifySemanticMove({
          toolName: 'classify_semantic_move',
          rawArgs: buildBodyMarkedArgs(),
          requestId: 'r-cov009-scan-4',
          envelope: 'jsonRpc',
        })
      )
    );
    aggregated.push(...lines);
  }

  // Every line: leak-free across all three axes.
  for (const line of aggregated) {
    assertNoForbiddenFields(line);
    assertNoSecretShape(line);
    assertNoBodyLeak(line, [...BODY_MARKERS, 'sk-ant-', 'zzqwxbody']);
  }

  // Bonus: if ANY semantic_referee_packet_invalid lines surfaced (none are
  // expected from the matrix above, but a future emission might), each one
  // must additionally respect the allowlisted-keys discipline.
  for (const line of packetInvalidLines(aggregated)) {
    for (const k of Object.keys(line.parsed)) {
      if (!ALLOWED_FIELD_KEYS_PACKET_INVALID.has(k)) {
        throw new Error(
          `semantic_referee_packet_invalid carries non-allowlisted key '${k}': ${line.raw}`,
        );
      }
    }
  }
});
