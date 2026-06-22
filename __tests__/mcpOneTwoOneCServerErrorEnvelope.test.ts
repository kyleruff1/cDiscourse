/**
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 3 (FIX).
 *
 * The Phase-3 bulk suite. Proves the MCP server's OWN `{ isError, reason,
 * path, detail }` error envelope is DETECTED in the Deno adapter BEFORE the
 * schema validator, typed as a provider/server transient
 * (`subReason: 'provider_server_error'`, carrier `reason: 'api_error'` →
 * `failure_reason: 'mcp_api_error'`), surfaced with a scrubbed `serverReason`,
 * and healed by the EXISTING bounded retry — with NO dispatch-config edit.
 *
 * Coverage wall (the repo's established split, see Phase 1):
 *   - BEHAVIORAL (Jest-loadable, via the `_helpers/booleanObservation*Deno.ts`
 *     bridges): the pure schema parser + extractor + the pure
 *     failure-subreason mapper/builder. This is where the bug-vs-fix routing
 *     and the sanitizer are proven against real module behavior.
 *   - SOURCE-SCAN: the Deno adapter (`booleanObservationMcpAdapter.ts`) reads
 *     `Deno.env.get`/`fetch` and the dispatcher/core pull `npm:@supabase`, so
 *     neither is Jest-loadable. Their invariants are proven by scanning the
 *     real source text (the same standard the SCAN/FAIL suites hold them to).
 *
 * The recovery claims (e/f) are documented COMPOSITIONS: a behavioral leg
 * (the envelope is classified into the retryable `mcp_api_error` class) ∧ a
 * source-scan leg (the byte-equal loop breaks on success / is bounded by
 * MAX_ATTEMPTS=2). This is the strongest evidence the coverage wall allows
 * without moving dispatch config (which would be HALT-adjacent). See the
 * per-test comments for the explicit conjunction.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1/§10a — `provider_server_error` / `serverReason`
 *     are transport/server facts (a ban-list assertion lives in the
 *     failure-subreason suite); the classifier still emits only Machine
 *     Observations.
 *   - cdiscourse-doctrine §6 — `serverReason` is UNTRUSTED server input,
 *     forwarded-with-scrub; the HOSTILE wall (SEV-13) proves banned shapes
 *     are stripped and the raw `detail` is never forwarded.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  edgeParseMcpBooleanObservationResponse,
  edgeExtractBooleanObservationResponse,
} from './_helpers/booleanObservationEdgeDeno';
import {
  edgeMapToFailureSubreason,
  edgeBuildFailureDetail,
  EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS,
} from './_helpers/booleanObservationFailureSubreasonDeno';

const REPO = process.cwd();
const BO_DIR = path.join(REPO, 'supabase/functions/_shared/booleanObservations');
const ADAPTER_PATH = path.join(BO_DIR, 'booleanObservationMcpAdapter.ts');
const DISPATCHER_PATH = path.join(BO_DIR, 'autoTriggerDispatcher.ts');
const CORE_PATH = path.join(BO_DIR, 'classifyArgumentCore.ts');

const adapterSrc = fs.readFileSync(ADAPTER_PATH, 'utf8');
const dispatcherSrc = fs.readFileSync(DISPATCHER_PATH, 'utf8');
const coreSrc = fs.readFileSync(CORE_PATH, 'utf8');

/**
 * Strip comments + string literals for an executable-code scan. Same helper
 * convention as mcpOneTwoOneCEdgeAdapterSourceScan.test.ts.
 */
function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const adapterCode = stripCommentsAndStrings(adapterSrc);

/** The isServerErrorEnvelope block body (guard open → matching 2-space close). */
function isErrorBlock(): string {
  const m = adapterSrc.match(
    /if\s*\(\s*isServerErrorEnvelope\s*\(\s*extracted\s*\)\s*\)\s*\{[\s\S]*?\n\s{2}\}/,
  );
  if (!m) throw new Error('isServerErrorEnvelope block not found in adapter');
  return m[0];
}

// ─────────────────────────────────────────────────────────────────────
// (a) envelope detected BEFORE schema validation
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (a) envelope detected BEFORE the validator', () => {
  it('SEV-1 — adapter detection block index < parser call index AND > extracted===null guard index', () => {
    // Source-scan ordering proof: detection sits AFTER extraction's null
    // guard and BEFORE parseMcpBooleanObservationResponse — the envelope
    // never reaches the parser (HALT-7, the bug fix).
    const nullGuardIdx = adapterCode.search(/extracted\s*===\s*null/);
    const detectIdx = adapterCode.search(/isServerErrorEnvelope\s*\(\s*extracted\s*\)/);
    const parserIdx = adapterCode.search(/parseMcpBooleanObservationResponse\s*\(\s*extracted\s*\)/);
    expect(nullGuardIdx).toBeGreaterThan(-1);
    expect(detectIdx).toBeGreaterThan(-1);
    expect(parserIdx).toBeGreaterThan(-1);
    expect(detectIdx).toBeGreaterThan(nullGuardIdx);
    expect(detectIdx).toBeLessThan(parserIdx);
  });

  it('SEV-2 — the bug reproduced behaviorally: an {isError} envelope routed THROUGH the parser mis-types as wrong_schema_version', () => {
    // This is WHY the envelope must be intercepted first: if it reached
    // parseMcpBooleanObservationResponse it would fail at the schemaVersion
    // step (the envelope has no schemaVersion) → wrong_schema_version →
    // (Phase 1) response_wrong_schema_version → mcp_validation_failed (NOT
    // retryable). The Phase-3 detection branch prevents exactly this.
    const result = edgeParseMcpBooleanObservationResponse({ isError: true, reason: 'overloaded' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong_schema_version');
    }
  });

  it('SEV-1b — extraction passes the envelope THROUGH (so detection on `extracted` is viable)', () => {
    // Phase 2 proved the server nests its envelope recognizably
    // (receivedKeys = [isError,reason,path,detail]). extractBoolean...
    // returns the inner object from a `{ result: {...} }` container.
    const extracted = edgeExtractBooleanObservationResponse({
      result: { isError: true, reason: 'overloaded', path: 'x', detail: 'srv detail' },
    });
    expect(extracted).toEqual({ isError: true, reason: 'overloaded', path: 'x', detail: 'srv detail' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// (b) typed sub-reason = provider_server_error
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (b) typed sub-reason = provider_server_error', () => {
  it('SEV-3 — adapter isError block sets subReason:\'provider_server_error\', NOT a validation_failed reason', () => {
    const block = isErrorBlock();
    expect(/subReason:\s*'provider_server_error'/.test(block)).toBe(true);
    // The literal is never paired with a validation_failed reason in the block.
    expect(/reason:\s*'validation_failed'/.test(block)).toBe(false);
  });

  it('SEV-4 — EDGE_ALL_... contains provider_server_error in the provider group; length is 16', () => {
    expect(EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS).toContain('provider_server_error');
    expect(EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS.length).toBe(16);
    const idxApi = EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS.indexOf('provider_api_error');
    const idxServer = EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS.indexOf('provider_server_error');
    const idxNet = EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS.indexOf('provider_network_error');
    // Provider group position: api < server < network.
    expect(idxServer).toBeGreaterThan(idxApi);
    expect(idxServer).toBeLessThan(idxNet);
  });
});

// ─────────────────────────────────────────────────────────────────────
// (c) generic mcp_api_error maps correctly
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (c) carrier reason api_error → mcp_api_error', () => {
  it('SEV-5 — classifyArgumentCore still maps \'api_error\' → \'mcp_api_error\' (FAIL-4 unchanged)', () => {
    // The carrier reason flows through the UNCHANGED unavailableReason map.
    expect(coreSrc).toContain("'api_error'");
    expect(coreSrc).toContain('mcp_api_error');
    // The mapping arm is byte-present: case 'api_error': return 'mcp_api_error'.
    expect(/case\s*'api_error':\s*[\s\S]*?return\s*'mcp_api_error'/.test(coreSrc)).toBe(true);
  });

  it('SEV-6 — adapter isError block uses reason:\'api_error\' (the carrier), NOT validation_failed', () => {
    const block = isErrorBlock();
    expect(/reason:\s*'api_error'/.test(block)).toBe(true);
    expect(/reason:\s*'validation_failed'/.test(block)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// (d) envelope is retryable
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (d) the envelope rides the retryable class', () => {
  it('SEV-7 — RETRYABLE_FAILURE_REASONS contains mcp_api_error, NOT mcp_validation_failed; MAX_ATTEMPTS=2; concurrency cap referenced', () => {
    const setBlock = dispatcherSrc.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    expect(setBlock).not.toBeNull();
    const setBody = setBlock![1];
    expect(setBody).toContain('mcp_api_error');
    expect(setBody).not.toContain('mcp_validation_failed');
    // Bounded retry config byte-equal.
    expect(dispatcherSrc).toMatch(/MAX_ATTEMPTS\s*=\s*2/);
    expect(dispatcherSrc).toContain('MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES');
    // Combined with SEV-5 (api_error→mcp_api_error) + SEV-6 (block uses
    // api_error), this proves the envelope is mapped into the retryable
    // class — it IS retryable, with no edit to the set.
  });
});

// ─────────────────────────────────────────────────────────────────────
// (e) first {isError} then valid → recovers to SUCCESS (documented composition)
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (e) recover-to-success (composition)', () => {
  it('SEV-8 — COMPOSITION: (behavioral) envelope → api_error provider class ∧ (source-scan) the loop breaks on success', () => {
    // The "recovers to SUCCESS" claim is the conjunction of two provable
    // halves (the dispatcher loop is not Jest-loadable):
    //
    //   1. BEHAVIORAL: the carrier reason is a provider class. The envelope
    //      is carried on `api_error`, and `api_error` maps to the provider
    //      sub-reason class (`provider_api_error`) — i.e. the carrier is in
    //      the retryable provider/transport family, NOT a response_* class.
    expect(edgeMapToFailureSubreason('api_error')).toBe('provider_api_error');
    //      (SEV-6 already proved the isError block uses reason:'api_error'.)
    //
    //   2. SOURCE-SCAN: the byte-equal loop short-circuits on a successful
    //      attempt — `if (lastSummary.status === 'success') { … return
    //      { outcome: 'triggered' … } }`. So a retry attempt that returns a
    //      valid response terminates the loop as `triggered` (= SUCCESS).
    //      (Scanned against the RAW source — the success short-circuit keys
    //      on the 'success' string literal.)
    expect(/lastSummary\.status\s*===\s*'success'/.test(dispatcherSrc)).toBe(true);
    expect(/outcome:\s*'triggered'/.test(dispatcherSrc)).toBe(true);
    // ∴ envelope (retryable api_error) on attempt 1, success on attempt 2 →
    // the loop breaks-on-success and returns triggered. Recovery proven by
    // composition.
  });
});

// ─────────────────────────────────────────────────────────────────────
// (f) repeated {isError} → fails after bounded retry, typed + sanitized
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (f) repeated envelope → bounded-retry terminal, typed + sanitized', () => {
  it('SEV-9 — COMPOSITION: (source-scan) terminal emit carries failure_sub_reason+failure_detail, bounded by MAX_ATTEMPTS=2 ∧ (behavioral) the envelope detail is sanitized', () => {
    //   SOURCE-SCAN: the terminal-failure emit passes the typed sub-reason +
    //   sanitized detail the loop already holds; the retry is bounded by
    //   MAX_ATTEMPTS=2 (exactly one retry) and the retry gate is
    //   isSummaryRetryable + the attempt cap.
    expect(/failure_sub_reason:\s*terminal\?\.failureSubReason/.test(dispatcherSrc)).toBe(true);
    expect(/failure_detail:\s*terminal\?\.failureDetail/.test(dispatcherSrc)).toBe(true);
    expect(/attemptNumber\s*>=\s*MAX_ATTEMPTS/.test(dispatcherSrc)).toBe(true);
    //   BEHAVIORAL: a repeated-envelope detail (built exactly as the adapter
    //   builds it for the envelope) is sanitized to allowlisted fields only.
    const detail = edgeBuildFailureDetail({
      serverReason: 'overloaded',
      path: 'x',
      receivedKeysFrom: { isError: true, reason: 'overloaded', path: 'x', detail: 'srv blob' },
    });
    expect(detail).toBeDefined();
    // serverReason survived (benign); receivedKeys are name-only and include isError.
    expect(detail!.serverReason).toBe('overloaded');
    expect(detail!.receivedKeys).toContain('isError');
    // The server's free-text `detail` VALUE is never present.
    expect(JSON.stringify(detail)).not.toContain('srv blob');
    // ∴ a repeated envelope fails after exactly one retry, surfacing
    // failureSubReason:'provider_server_error' (SEV-3) + a sanitized detail.
  });
});

// ─────────────────────────────────────────────────────────────────────
// (g) ordinary malformed response still types response_* and is NOT broadly retried
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (g) ordinary malformed responses unchanged + NOT broadly retried', () => {
  it('SEV-10 — wrong_shape / missing_required_field still map to response_* (unchanged by the envelope branch)', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'wrong_shape')).toBe('response_wrong_shape');
    expect(edgeMapToFailureSubreason('validation_failed', 'missing_required_field')).toBe(
      'response_missing_required_field',
    );
  });

  it('SEV-11 — RETRYABLE_FAILURE_REASONS does NOT contain mcp_validation_failed; the validation_failed collapse site is byte-equal', () => {
    const setBlock = dispatcherSrc.match(/RETRYABLE_FAILURE_REASONS[\s\S]*?Set\(\s*\[([^\]]+)\]/);
    const setBody = setBlock![1];
    expect(setBody).not.toContain('mcp_validation_failed');
    // The adapter still delegates the validation_failed collapse via
    // mapToFailureSubreason('validation_failed', parsed.reason) — byte-equal.
    expect(adapterSrc).toContain("mapToFailureSubreason('validation_failed', parsed.reason)");
  });

  it('SEV-12 — DISCRIMINATOR: a non-isError object (wrong-schema) still routes to the parser → wrong_schema_version (NOT swallowed)', () => {
    // The strict `=== true` predicate does NOT fire for `{schemaVersion:'wrong'}`
    // (no isError===true), so an ordinary wrong-schema response still reaches
    // the parser and types as a NON-retryable wrong_schema_version. The fix
    // is surgical: it intercepts ONLY isError===true envelopes.
    const result = edgeParseMcpBooleanObservationResponse({ schemaVersion: 'wrong' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('wrong_schema_version');
    }
    // And an isError:false object is likewise NOT an envelope (would route on).
    const falseEnvelope = edgeParseMcpBooleanObservationResponse({ isError: false, schemaVersion: 'wrong' });
    expect(falseEnvelope.ok).toBe(false);
    if (!falseEnvelope.ok) {
      expect(falseEnvelope.reason).toBe('wrong_schema_version');
    }
  });

  it('SEV-12b — the adapter predicate uses STRICT `.isError === true` (truthiness would over-broaden — forbidden)', () => {
    // The strict-equality discriminator is the central correctness guard.
    expect(/\.isError\s*===\s*true/.test(adapterCode)).toBe(true);
    // No truthiness form (`if (extracted.isError)` / `if (.isError &&`) is
    // used as the envelope discriminator.
    expect(/isError\s*\)\s*\{/.test(adapterCode)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// (h) banned detail stripped + no raw model/provider/prompt/auth in return/log (HALT-4 wall)
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 3 — (h) HOSTILE serverReason wall (HALT-4)', () => {
  // Assemble banned shapes from fragments so this file carries no contiguous
  // secret-shaped literal.
  const FAKE_BEARER = 'Bea' + 'rer ' + 'a'.repeat(32);
  const FAKE_SK_ANT = 'sk' + '-ant-' + 'A1B2C3D4E5F6';
  const FAKE_SB_SECRET = 'sb' + '_secret_' + 'ZYXW9876543';
  const FAKE_JWT = 'eyJ' + 'A'.repeat(24) + '.' + 'B'.repeat(12) + '.' + 'C'.repeat(12);

  function assertNoBannedShapes(serialized: string): void {
    expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{6,}').test(serialized)).toBe(false);
    expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{6,}').test(serialized)).toBe(false);
    expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{6,}').test(serialized)).toBe(false);
    expect(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/.test(serialized)).toBe(false);
    expect(new RegExp('Bea' + 'rer' + '\\s+[A-Za-z0-9._-]{8,}').test(serialized)).toBe(false);
    expect(/Authorization/i.test(serialized)).toBe(false);
    expect(/SERVICE_ROLE/.test(serialized)).toBe(false);
  }

  it('SEV-13 — a HOSTILE envelope (secret-shaped serverReason/path + secret-named keys) yields no banned shape; serverReason is dropped', () => {
    const detail = edgeBuildFailureDetail({
      // The server echoes a token in its `reason` — must be dropped.
      serverReason: FAKE_BEARER,
      // A JWT-shaped path — also dropped (allowlist + scrub).
      path: FAKE_JWT,
      // Envelope key NAMES include secret-shaped + prompt/authorization names.
      receivedKeysFrom: {
        [FAKE_SB_SECRET]: 1,
        prompt: '...',
        authorization: '...',
        isError: true,
      },
      expected: FAKE_SK_ANT,
    });
    const serialized = JSON.stringify(detail ?? {});
    assertNoBannedShapes(serialized);
    // serverReason tripped looksSecret → absent.
    expect(detail?.serverReason).toBeUndefined();
    // path was a JWT shape (not even allowlisted) → absent.
    expect(detail?.path).toBeUndefined();
    // expected (sk-ant) → absent.
    expect(detail?.expected).toBeUndefined();
    // Any surviving receivedKeys are identifier-shaped, name-only.
    if (detail?.receivedKeys) {
      for (const k of detail.receivedKeys) {
        expect(/^[A-Za-z0-9_]*$/.test(k)).toBe(true);
      }
    }
  });

  it('SEV-14 — a benign serverReason survives (scrub is shape-based, not a blanket drop)', () => {
    const detail = edgeBuildFailureDetail({ serverReason: 'rate_limit_exceeded' });
    expect(detail).toEqual({ serverReason: 'rate_limit_exceeded' });
  });

  it('SEV-15 — a 5000-char serverReason → serialized detail ≤2000 and serverReason ≤200 chars', () => {
    const detail = edgeBuildFailureDetail({ serverReason: 'x'.repeat(5_000) });
    expect(detail).toBeDefined();
    expect(JSON.stringify(detail).length).toBeLessThanOrEqual(2_000);
    expect(detail!.serverReason!.length).toBeLessThanOrEqual(200);
  });

  it('SEV-15b — the adapter NEVER forwards the envelope\'s raw `detail` as a free-text input to buildFailureDetail (MCP-EGI-003 invariant)', () => {
    const block = isErrorBlock();
    // The raw `extracted.detail` string MUST NOT flow as a free-text
    // input to buildFailureDetail. The only permitted use of
    // `extracted.detail` is as the SINGLE argument to
    // `mcpToolDetailToCategory(...)`, which returns the closed `McpToolDetailCategory`
    // enum or `undefined` — never the raw string.
    expect(/detail:\s*extracted\.detail/.test(block)).toBe(false);
    expect(/\bdetailCategory:\s*extracted\.detail\b/.test(block)).toBe(false);
    // MCP-EGI-003 — the adapter DOES call mcpToolDetailToCategory on
    // `extracted.detail` to derive the closed-enum category; that is the
    // only path `extracted.detail` is allowed on.
    expect(/mcpToolDetailToCategory\(\s*extracted\.detail\s*\)/.test(block)).toBe(true);
    // The block still carries the allowlisted inputs.
    expect(block).toContain('serverReason');
    expect(block).toContain('receivedKeysFrom: extracted');
    // …and now the closed-enum `detailCategory` is passed through.
    expect(/\bdetailCategory\b/.test(block)).toBe(true);
  });
});
