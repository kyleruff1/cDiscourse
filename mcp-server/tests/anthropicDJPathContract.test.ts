/**
 * COV-005 — End-to-end Anthropic prompt-and-validate contract tests for
 * Families D, E, F, G, H, I, J.
 *
 * Addresses gap #5 (HIGH/M) of the 2026-06-30 coverage audit
 * (docs/audits/COVERAGE-AUDIT-2026-06-30.md, commit 00554af). Closes #809.
 *
 * Why this test is necessary:
 *   Per-family `familyXAnthropic.test.ts` covers `runAnthropicFamilyX*` in
 *   isolation. The end-to-end orchestration in
 *   `tools/classifyArgumentBooleanObservations.ts` (provider selection branch
 *   ~line 613 → `validateMcpBooleanObservationResponse` → ban-list scan →
 *   key-level fail-closed → response envelope) was previously only exercised
 *   for the FIXTURE provider. The real Anthropic prompt-and-validate path
 *   has never been exercised in tests for Families D–J. Edge
 *   `productionEnabled:false` is the ONLY thing currently preventing
 *   production exposure; the moment an operator flips a family on (admin
 *   validation already routes it), drift between fixture expectations and
 *   real Anthropic output ships uncaught.
 *
 * Strategy:
 *   - For each family D–J, set MCP_SERVER_USE_FIXTURE_PROVIDER=false (so the
 *     handler takes the Anthropic branch) and override `globalThis.fetch`
 *     with a deno-local mock. We NEVER make a real Anthropic network call.
 *   - We assert three contract invariants per family:
 *       (a) REQUEST-BODY SHAPE STABILITY — the outgoing POST body contains
 *           the expected model name, the family-specific system prompt
 *           fragment (a distinguishing token, NOT the entire byte-equal
 *           prompt), the family-specific max_tokens budget, deterministic
 *           temperature=0, and a user prompt that enumerates the
 *           family-specific rawKeys we requested.
 *       (b) RESPONSE ACCEPTANCE — a canned packet that satisfies the wire
 *           schema for that family (correct classifierSetVersion, valid
 *           observations / confidence / evidenceSpan shape, no banned
 *           tokens) round-trips through validateMcpBooleanObservationResponse
 *           and emerges as `isError:false` with structuredContent matching
 *           the canned shape — the handler accepts a real-shaped response.
 *       (c) KEY-LEVEL FAIL-CLOSED — two regression paths:
 *           (c.1) A canned response with a doctrine-banned token (`winner`)
 *                 in ONE rawKey's evidenceSpan, while the sibling rawKey's
 *                 evidenceSpan is clean, triggers the per-key drop posture:
 *                 the unclean key is omitted, the clean sibling survives,
 *                 the kept packet is returned `isError:false` with
 *                 `keysDroppedForUncleanSpan` listing the dropped key NAME
 *                 (never the unclean span content).
 *           (c.2) A canned response that violates the wire-schema shape
 *                 (missing required field) is rejected at Step 4 with
 *                 `isError:true` and reason='validation_failed' — fail-closed
 *                 at the envelope level when the model returns garbage.
 *
 * Boundaries (cdiscourse-doctrine §6, §7):
 *   - NEVER makes a real Anthropic API call. Every test installs a local
 *     fetch override; no test is permitted to reach the real network.
 *   - NEVER asserts on the full byte-equal system prompt — those are
 *     covered by `familyXPrompt.test.ts`. This test asserts STRUCTURAL
 *     invariants (model + family-distinguishing token + budget + rawKeys
 *     echoed in user prompt).
 *   - NEVER logs the fake API key (validated by a per-test log capture).
 *   - NEVER changes productionEnabled / Edge family routing flags. The
 *     test sets `MCP_SERVER_USE_FIXTURE_PROVIDER=false` and
 *     `ANTHROPIC_API_KEY=<fake>` in-process only.
 *   - NEVER touches mcp-server source files — test-only.
 *
 * The seven Family D–J families covered are the ones the audit's gap #5
 * names: Family D (evidence_source_chain), E (argument_scheme), F
 * (critical_question), G (resolution_progress), H (claim_clarity), I
 * (thread_topology), J (sensitive_composer).
 */
import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifyArgumentBooleanObservations } from '../tools/classifyArgumentBooleanObservations.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_D_MAX_TOKENS } from '../lib/familyDPrompt.ts';
import { FAMILY_E_MAX_TOKENS } from '../lib/familyEPrompt.ts';
import { FAMILY_F_MAX_TOKENS } from '../lib/familyFPrompt.ts';
import { FAMILY_G_MAX_TOKENS } from '../lib/familyGPrompt.ts';
import { FAMILY_H_MAX_TOKENS } from '../lib/familyHPrompt.ts';
import { FAMILY_I_MAX_TOKENS } from '../lib/familyIPrompt.ts';
import { FAMILY_J_MAX_TOKENS } from '../lib/familyJPrompt.ts';
import {
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
} from '../lib/logging.ts';

const SCHEMA_VERSION = MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
const FAKE_KEY = 'sk-ant-fake-key-for-cov-005-test-only-1234567890abcdef';
const SAMPLE_NODE_ID = 'node-cov-005-anthropic-path';

interface FamilyCase {
  readonly letter: 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  readonly familyName: string;
  readonly classifierSetVersion: string;
  readonly maxTokens: number;
  /** A distinguishing token expected in the system prompt sent to Anthropic. */
  readonly systemPromptToken: string;
  /** Two rawKeys from this family used to verify rawKey echo + key-level fail-closed. */
  readonly rawKeyDirty: string;
  readonly rawKeyClean: string;
}

const FAMILIES: readonly FamilyCase[] = [
  {
    letter: 'D',
    familyName: 'evidence_source_chain',
    classifierSetVersion: 'family-d-v1',
    maxTokens: FAMILY_D_MAX_TOKENS,
    systemPromptToken: 'EVIDENCE-SOURCE-CHAIN',
    rawKeyDirty: 'asks_for_evidence',
    rawKeyClean: 'provides_evidence',
  },
  {
    letter: 'E',
    familyName: 'argument_scheme',
    classifierSetVersion: 'family-e-v1',
    maxTokens: FAMILY_E_MAX_TOKENS,
    systemPromptToken: 'SCHEME',
    rawKeyDirty: 'causal_reasoning_present',
    rawKeyClean: 'analogy_reasoning_present',
  },
  {
    letter: 'F',
    familyName: 'critical_question',
    classifierSetVersion: 'family-f-v1',
    maxTokens: FAMILY_F_MAX_TOKENS,
    systemPromptToken: 'CRITICAL',
    rawKeyDirty: 'missing_warrant',
    rawKeyClean: 'unstated_assumption',
  },
  {
    letter: 'G',
    familyName: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    maxTokens: FAMILY_G_MAX_TOKENS,
    systemPromptToken: 'RESOLUTION-PROGRESS',
    rawKeyDirty: 'narrows_claim',
    rawKeyClean: 'concedes_narrow_point',
  },
  {
    letter: 'H',
    familyName: 'claim_clarity',
    classifierSetVersion: 'family-h-v1',
    maxTokens: FAMILY_H_MAX_TOKENS,
    systemPromptToken: 'CLAIM-CLARITY',
    rawKeyDirty: 'claim_present',
    rawKeyClean: 'reason_present',
  },
  {
    letter: 'I',
    familyName: 'thread_topology',
    classifierSetVersion: 'family-i-v1',
    maxTokens: FAMILY_I_MAX_TOKENS,
    systemPromptToken: 'THREAD-TOPOLOGY',
    rawKeyDirty: 'introduces_new_issue',
    rawKeyClean: 'references_prior_agreement',
  },
  {
    letter: 'J',
    familyName: 'sensitive_composer',
    classifierSetVersion: 'family-j-v1',
    maxTokens: FAMILY_J_MAX_TOKENS,
    systemPromptToken: 'SENSITIVE-COMPOSER',
    rawKeyDirty: 'shifts_to_person_or_intent',
    rawKeyClean: 'needs_pre_send_pause',
  },
];

function buildRequest(familyName: string, rawKeys: readonly string[]): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: SAMPLE_NODE_ID,
    parentNodeId: null,
    currentText: 'Per the 2024 EPA report Table 3.1, urban EV emissions dropped 40%.',
    parentText: null,
    threadContextExcerpt: 'sample thread context for cov-005',
    requestedFamilies: [familyName],
    requestedRawKeys: [...rawKeys],
    definitions: {},
    timeoutMs: 12000,
  };
}

interface BuildPacketArgs {
  readonly classifierSetVersion: string;
  readonly rawKeys: readonly string[];
  /** Optional per-rawKey evidenceSpan override (defaults to a clean short quote). */
  readonly evidenceSpan?: Readonly<Record<string, string | null>>;
}

function buildValidPacket(args: BuildPacketArgs): Record<string, unknown> {
  const observations: Record<string, boolean> = {};
  const confidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const evidenceSpan: Record<string, string | null> = {};
  for (const key of args.rawKeys) {
    observations[key] = true;
    confidence[key] = 'medium';
    evidenceSpan[key] =
      args.evidenceSpan && key in args.evidenceSpan
        ? args.evidenceSpan[key]
        : 'short structural anchor';
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: SAMPLE_NODE_ID,
    checkedRawKeys: [...args.rawKeys],
    observations,
    confidence,
    evidenceSpan,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: args.classifierSetVersion,
    },
  };
}

interface CapturedRequest {
  readonly url: string;
  readonly body: Record<string, unknown>;
  readonly headers: Record<string, string>;
}

interface FetchHarness {
  install: () => void;
  restore: () => void;
  captured: () => CapturedRequest | null;
}

function makeFetchHarness(packet: Record<string, unknown>): FetchHarness {
  const originalFetch = globalThis.fetch;
  let captured: CapturedRequest | null = null;
  const mockFetch: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL | Request).toString();
    const initAny = init as { body?: unknown; headers?: Record<string, string> } | undefined;
    let parsedBody: Record<string, unknown> = {};
    if (initAny && typeof initAny.body === 'string') {
      try {
        parsedBody = JSON.parse(initAny.body) as Record<string, unknown>;
      } catch {
        parsedBody = {};
      }
    }
    captured = {
      url,
      body: parsedBody,
      headers: (initAny?.headers ?? {}) as Record<string, string>,
    };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          model: 'claude-haiku-4-5',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify(packet) }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  };
  return {
    install: () => {
      globalThis.fetch = mockFetch;
    },
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    captured: () => captured,
  };
}

function withAnthropicEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevFixture = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  const prevKey = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'false');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_KEY);
  return fn().finally(() => {
    if (prevFixture === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prevFixture);
    if (prevKey === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prevKey);
  });
}

// ─── (a) REQUEST-BODY SHAPE STABILITY ─────────────────────────────────────
for (const fc of FAMILIES) {
  Deno.test(
    `cov-005 family ${fc.letter} (${fc.familyName}): outgoing Anthropic request body has stable structural shape`,
    async () => {
      await withAnthropicEnv(async () => {
        const packet = buildValidPacket({
          classifierSetVersion: fc.classifierSetVersion,
          rawKeys: [fc.rawKeyDirty, fc.rawKeyClean],
        });
        const harness = makeFetchHarness(packet);
        harness.install();
        try {
          const result = await handleClassifyArgumentBooleanObservations({
            toolName: 'classify_argument_boolean_observations',
            rawArgs: buildRequest(fc.familyName, [fc.rawKeyDirty, fc.rawKeyClean]),
            requestId: `cov-005-${fc.letter}-shape-1`,
            envelope: 'jsonRpc',
          });
          assertEquals(result.isError, false, `family ${fc.letter} happy-path should be accepted`);
          const cap = harness.captured();
          if (cap === null) {
            throw new Error(`family ${fc.letter}: no outgoing request captured`);
          }
          // URL must be the Anthropic Messages endpoint — proves we took the
          // Anthropic branch, not fixture.
          assertEquals(
            cap.url,
            'https://api.anthropic.com/v1/messages',
            `family ${fc.letter}: should POST to Anthropic Messages endpoint`,
          );
          // model field present (a real string).
          const model = cap.body.model;
          if (typeof model !== 'string' || model.length === 0) {
            throw new Error(`family ${fc.letter}: model field missing or empty (was ${String(model)})`);
          }
          // max_tokens matches the family's declared budget.
          assertEquals(
            cap.body.max_tokens,
            fc.maxTokens,
            `family ${fc.letter}: max_tokens must match FAMILY_${fc.letter}_MAX_TOKENS`,
          );
          // Deterministic decoding (temperature=0).
          assertEquals(
            cap.body.temperature,
            0,
            `family ${fc.letter}: temperature must be 0 (deterministic decoding)`,
          );
          // system prompt is a string and carries the family-distinguishing
          // token. We deliberately DO NOT byte-equal-snapshot the whole
          // prompt — that's covered by familyXPrompt.test.ts. We assert
          // STRUCTURAL drift detection: if the family's system prompt no
          // longer mentions its distinguishing topic, the test fails.
          const system = cap.body.system;
          if (typeof system !== 'string') {
            throw new Error(`family ${fc.letter}: system must be a string`);
          }
          if (!system.includes(fc.systemPromptToken)) {
            throw new Error(
              `family ${fc.letter}: system prompt missing distinguishing token "${fc.systemPromptToken}"`,
            );
          }
          // messages[0].content (user prompt) echoes the requested rawKeys —
          // proves the per-batch rawKey filtering reached the model.
          const messages = cap.body.messages;
          if (!Array.isArray(messages) || messages.length !== 1) {
            throw new Error(`family ${fc.letter}: messages must be a single-element array`);
          }
          const message0 = messages[0] as { role?: string; content?: string };
          assertEquals(message0.role, 'user', `family ${fc.letter}: message role`);
          if (typeof message0.content !== 'string') {
            throw new Error(`family ${fc.letter}: user-prompt content must be a string`);
          }
          if (!message0.content.includes(fc.rawKeyDirty)) {
            throw new Error(
              `family ${fc.letter}: user prompt did not include requested rawKey "${fc.rawKeyDirty}"`,
            );
          }
          if (!message0.content.includes(fc.rawKeyClean)) {
            throw new Error(
              `family ${fc.letter}: user prompt did not include requested rawKey "${fc.rawKeyClean}"`,
            );
          }
        } finally {
          harness.restore();
        }
      });
    },
  );
}

// ─── (b) RESPONSE ACCEPTANCE ──────────────────────────────────────────────
for (const fc of FAMILIES) {
  Deno.test(
    `cov-005 family ${fc.letter} (${fc.familyName}): valid canned packet is accepted end-to-end`,
    async () => {
      await withAnthropicEnv(async () => {
        const packet = buildValidPacket({
          classifierSetVersion: fc.classifierSetVersion,
          rawKeys: [fc.rawKeyDirty, fc.rawKeyClean],
        });
        const harness = makeFetchHarness(packet);
        harness.install();
        try {
          const result = await handleClassifyArgumentBooleanObservations({
            toolName: 'classify_argument_boolean_observations',
            rawArgs: buildRequest(fc.familyName, [fc.rawKeyDirty, fc.rawKeyClean]),
            requestId: `cov-005-${fc.letter}-accept-1`,
            envelope: 'jsonRpc',
          });
          assertEquals(result.isError, false, `family ${fc.letter}: valid canned packet must be accepted`);
          const sc = result.structuredContent as Record<string, unknown>;
          assertEquals(sc.schemaVersion, SCHEMA_VERSION);
          assertEquals(sc.nodeId, SAMPLE_NODE_ID);
          const modelInfo = sc.modelInfo as Record<string, unknown>;
          assertEquals(
            modelInfo.classifierSetVersion,
            fc.classifierSetVersion,
            `family ${fc.letter}: classifierSetVersion round-trip`,
          );
          assertEquals(modelInfo.provider, 'mcp');
          const observations = sc.observations as Record<string, unknown>;
          if (typeof observations[fc.rawKeyDirty] !== 'boolean') {
            throw new Error(`family ${fc.letter}: dirty rawKey observation lost in round-trip`);
          }
          if (typeof observations[fc.rawKeyClean] !== 'boolean') {
            throw new Error(`family ${fc.letter}: clean rawKey observation lost in round-trip`);
          }
        } finally {
          harness.restore();
        }
      });
    },
  );
}

// ─── (c.1) KEY-LEVEL FAIL-CLOSED — DOCTRINE BANNED SPAN ───────────────────
for (const fc of FAMILIES) {
  Deno.test(
    `cov-005 family ${fc.letter} (${fc.familyName}): key-level fail-closed drops the unclean evidenceSpan key`,
    async () => {
      await withAnthropicEnv(async () => {
        // The dirty rawKey's evidenceSpan carries a doctrine-banned token
        // ("winner"). The clean rawKey's evidenceSpan is doctrine-clean.
        // Per OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING, ALL ten families
        // (incl. D–J) are in KEY_LEVEL_FAIL_CLOSED_FAMILIES, so the
        // handler must drop the dirty key by omission and return the kept
        // packet successfully — the clean sibling survives.
        const packet = buildValidPacket({
          classifierSetVersion: fc.classifierSetVersion,
          rawKeys: [fc.rawKeyDirty, fc.rawKeyClean],
          evidenceSpan: {
            [fc.rawKeyDirty]: 'this side is the clear winner of the debate',
            [fc.rawKeyClean]: 'short clean anchor',
          },
        });
        const harness = makeFetchHarness(packet);
        harness.install();
        try {
          const result = await handleClassifyArgumentBooleanObservations({
            toolName: 'classify_argument_boolean_observations',
            rawArgs: buildRequest(fc.familyName, [fc.rawKeyDirty, fc.rawKeyClean]),
            requestId: `cov-005-${fc.letter}-drop-1`,
            envelope: 'jsonRpc',
          });
          assertEquals(
            result.isError,
            false,
            `family ${fc.letter}: unclean key must be dropped, packet kept`,
          );
          const sc = result.structuredContent as Record<string, unknown>;
          const observations = sc.observations as Record<string, unknown>;
          const evidenceSpan = sc.evidenceSpan as Record<string, unknown>;
          const checkedRawKeys = sc.checkedRawKeys as readonly string[];
          // Anti-resurrection: the dirty key is GONE from every key set.
          if (fc.rawKeyDirty in observations) {
            throw new Error(
              `family ${fc.letter}: dirty rawKey survived in observations`,
            );
          }
          if (fc.rawKeyDirty in evidenceSpan) {
            throw new Error(
              `family ${fc.letter}: dirty rawKey survived in evidenceSpan`,
            );
          }
          if (checkedRawKeys.includes(fc.rawKeyDirty)) {
            throw new Error(
              `family ${fc.letter}: dirty rawKey survived in checkedRawKeys`,
            );
          }
          // Clean sibling survives.
          assertEquals(
            observations[fc.rawKeyClean],
            true,
            `family ${fc.letter}: clean sibling must survive the drop`,
          );
          // keysDroppedForUncleanSpan carries the dropped name — NAME only,
          // never the unclean span content.
          const dropped = sc.keysDroppedForUncleanSpan as readonly string[] | undefined;
          if (dropped === undefined || !dropped.includes(fc.rawKeyDirty)) {
            throw new Error(
              `family ${fc.letter}: keysDroppedForUncleanSpan must list dropped rawKey "${fc.rawKeyDirty}"`,
            );
          }
          // Leak-safe: the unclean span content must NOT appear anywhere in
          // the returned structuredContent.
          const serialized = JSON.stringify(sc);
          if (serialized.toLowerCase().includes('winner')) {
            throw new Error(
              `family ${fc.letter}: banned token "winner" leaked into returned structuredContent`,
            );
          }
        } finally {
          harness.restore();
        }
      });
    },
  );
}

// ─── (c.2) FAIL-CLOSED ON WIRE-SCHEMA VIOLATION ───────────────────────────
for (const fc of FAMILIES) {
  Deno.test(
    `cov-005 family ${fc.letter} (${fc.familyName}): schema-shape violation returns validation_failed envelope`,
    async () => {
      await withAnthropicEnv(async () => {
        // The canned packet is missing the required `modelInfo` field —
        // validateMcpBooleanObservationResponse must reject it at Step 4
        // and the handler must return the typed validation_failed
        // envelope. This proves the schema gate fires when the model
        // returns garbage, BEFORE any key-level drop logic runs.
        const malformedPacket = {
          schemaVersion: SCHEMA_VERSION,
          nodeId: SAMPLE_NODE_ID,
          checkedRawKeys: [fc.rawKeyDirty, fc.rawKeyClean],
          observations: { [fc.rawKeyDirty]: true, [fc.rawKeyClean]: false },
          confidence: { [fc.rawKeyDirty]: 'medium', [fc.rawKeyClean]: 'high' },
          evidenceSpan: { [fc.rawKeyDirty]: null, [fc.rawKeyClean]: null },
          // modelInfo intentionally omitted — required field
        };
        const harness = makeFetchHarness(malformedPacket);
        harness.install();
        try {
          const result = await handleClassifyArgumentBooleanObservations({
            toolName: 'classify_argument_boolean_observations',
            rawArgs: buildRequest(fc.familyName, [fc.rawKeyDirty, fc.rawKeyClean]),
            requestId: `cov-005-${fc.letter}-failclose-1`,
            envelope: 'jsonRpc',
          });
          assertEquals(
            result.isError,
            true,
            `family ${fc.letter}: malformed packet must fail closed`,
          );
          const sc = result.structuredContent as { reason?: string; path?: string };
          assertEquals(
            sc.reason,
            'validation_failed',
            `family ${fc.letter}: reason must be validation_failed`,
          );
          // The validator returns path='modelInfo' for the omitted required
          // field, per validateMcpBooleanObservationResponse.
          assertEquals(
            sc.path,
            'modelInfo',
            `family ${fc.letter}: missing-required-field path should be 'modelInfo'`,
          );
        } finally {
          harness.restore();
        }
      });
    },
  );
}

// ─── DOCTRINE SAFETY — fake API key must never appear in any log line ────
Deno.test('cov-005 doctrine safety: fake ANTHROPIC_API_KEY never appears in any log line across families', async () => {
  await withAnthropicEnv(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      for (const fc of FAMILIES) {
        const packet = buildValidPacket({
          classifierSetVersion: fc.classifierSetVersion,
          rawKeys: [fc.rawKeyDirty, fc.rawKeyClean],
        });
        const harness = makeFetchHarness(packet);
        harness.install();
        try {
          await handleClassifyArgumentBooleanObservations({
            toolName: 'classify_argument_boolean_observations',
            rawArgs: buildRequest(fc.familyName, [fc.rawKeyDirty, fc.rawKeyClean]),
            requestId: `cov-005-${fc.letter}-log-1`,
            envelope: 'jsonRpc',
          });
        } finally {
          harness.restore();
        }
      }
      for (const line of lines) {
        if (line.includes(FAKE_KEY)) {
          throw new Error(`fake API key leaked into log: ${line}`);
        }
      }
    } finally {
      _resetLogSinkForTesting();
    }
  });
});
