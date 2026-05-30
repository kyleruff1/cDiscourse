/**
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 (TYPE).
 *
 * Behavioral tests for the pure module
 * `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts`:
 *   - `mapToFailureSubreason` — the validator + adapter reason → vocab map.
 *   - `buildFailureDetail` — the allowlist sanitizer (the HALT-4 wall).
 *   - `ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS` — the frozen vocabulary.
 *
 * The module is pure TS (only type-only imports + a registry value import),
 * so it loads under Jest's babel transform via the bridge in
 * `_helpers/booleanObservationFailureSubreasonDeno.ts`.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1 / §10a — a ban-list assertion proves the
 *     vocabulary is verdict-free (no winner / loser / true / false / etc.).
 *   - cdiscourse-doctrine §6 — the HOSTILE fixture proves every banned
 *     class (prompt body, Bearer token, sk-ant / sb_secret / xai key, JWT,
 *     Authorization header) is stripped or rejected, the 2000-char cap
 *     holds with graceful degradation, receivedKeys are capped +
 *     identifier-shaped, and receivedType never carries a value.
 */
import {
  edgeMapToFailureSubreason,
  edgeBuildFailureDetail,
  EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS,
  edgeAnyRegistryRawKey,
} from './_helpers/booleanObservationFailureSubreasonDeno';
import type {
  BooleanObservationFailureSubreason,
} from './_helpers/booleanObservationFailureSubreasonDeno';

// ─────────────────────────────────────────────────────────────────────
// mapToFailureSubreason — validator reasons
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — mapToFailureSubreason (validator)', () => {
  it('MAP-1 — not_json → response_not_json', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'not_json')).toBe('response_not_json');
  });

  it('MAP-2 — wrong_schema_version → response_wrong_schema_version', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'wrong_schema_version')).toBe(
      'response_wrong_schema_version',
    );
  });

  it('MAP-3 — wrong_shape → response_wrong_shape', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'wrong_shape')).toBe('response_wrong_shape');
  });

  it('MAP-4 — missing_required_field → response_missing_required_field', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'missing_required_field')).toBe(
      'response_missing_required_field',
    );
  });

  it('MAP-5 — flag_count_too_high → response_flag_count_too_high', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'flag_count_too_high')).toBe(
      'response_flag_count_too_high',
    );
  });

  it('MAP-6 — duplicate_node_id (declared, not emitted) → unknown (defensive default)', () => {
    expect(edgeMapToFailureSubreason('validation_failed', 'duplicate_node_id')).toBe('unknown');
  });
});

// ─────────────────────────────────────────────────────────────────────
// mapToFailureSubreason — adapter reasons
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — mapToFailureSubreason (adapter)', () => {
  it('MAP-7 — parse_failure → response_not_json', () => {
    expect(edgeMapToFailureSubreason('parse_failure')).toBe('response_not_json');
  });

  it('MAP-8 — network_error → provider_network_error', () => {
    expect(edgeMapToFailureSubreason('network_error')).toBe('provider_network_error');
  });

  it('MAP-9 — rate_limited → provider_rate_limited', () => {
    expect(edgeMapToFailureSubreason('rate_limited')).toBe('provider_rate_limited');
  });

  it('MAP-10 — api_error → provider_api_error', () => {
    expect(edgeMapToFailureSubreason('api_error')).toBe('provider_api_error');
  });

  it('MAP-11 — validation_failed WITHOUT a validatorReason → unknown', () => {
    expect(edgeMapToFailureSubreason('validation_failed')).toBe('unknown');
  });

  it('MAP-12 — url_missing → undefined (operator-config; sub-reason adds nothing)', () => {
    expect(edgeMapToFailureSubreason('url_missing')).toBeUndefined();
  });

  it('MAP-13 — token_missing → undefined (operator-config; sub-reason adds nothing)', () => {
    expect(edgeMapToFailureSubreason('token_missing')).toBeUndefined();
  });

  it('MAP-14 — every BooleanObservationUnavailableReason maps without throwing (total)', () => {
    const reasons = [
      'url_missing',
      'token_missing',
      'api_error',
      'rate_limited',
      'network_error',
      'parse_failure',
      'validation_failed',
    ] as const;
    for (const reason of reasons) {
      // Must not throw; the result is a valid vocab value or undefined.
      const result = edgeMapToFailureSubreason(reason);
      if (result !== undefined) {
        expect(EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS).toContain(result);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS — vocabulary integrity
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — vocabulary', () => {
  it('VOCAB-1 — contains exactly the 15 declared values in order', () => {
    expect(EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS).toEqual([
      'request_unsupported_family',
      'request_unsupported_raw_key',
      'request_invalid_source_subset',
      'response_not_json',
      'response_wrong_schema_version',
      'response_wrong_shape',
      'response_missing_required_field',
      'response_flag_count_too_high',
      'response_evidence_span_invalid',
      'response_ban_list_violation',
      'provider_timeout',
      'provider_rate_limited',
      'provider_api_error',
      'provider_network_error',
      'unknown',
    ]);
  });

  it('VOCAB-2 — every value is verdict-free (cdiscourse-doctrine §1 ban-list)', () => {
    const banned = [
      'winner',
      'loser',
      'true',
      'false',
      'correct',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'stupid',
      'idiot',
    ];
    for (const value of EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS) {
      const lower = value.toLowerCase();
      for (const term of banned) {
        expect(lower).not.toContain(term);
      }
    }
  });

  it('VOCAB-3 — request_/response_/provider_ split covers the non-unknown values', () => {
    for (const value of EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS) {
      if (value === 'unknown') continue;
      expect(
        value.startsWith('request_') ||
          value.startsWith('response_') ||
          value.startsWith('provider_'),
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildFailureDetail — happy path
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — buildFailureDetail (happy path)', () => {
  it('DET-1 — empty input → undefined (absent, not {})', () => {
    expect(edgeBuildFailureDetail({})).toBeUndefined();
  });

  it('DET-2 — validatorReason + schemaVersion round-trip', () => {
    const detail = edgeBuildFailureDetail({
      validatorReason: 'wrong_shape',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
    });
    expect(detail).toEqual({
      validatorReason: 'wrong_shape',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
    });
  });

  it('DET-3 — allowlisted path is kept', () => {
    const detail = edgeBuildFailureDetail({ path: 'modelInfo.provider' });
    expect(detail).toEqual({ path: 'modelInfo.provider' });
  });

  it('DET-4 — a path NOT in the allowlist is dropped', () => {
    const detail = edgeBuildFailureDetail({ path: 'some.attacker.controlled.path' });
    expect(detail).toBeUndefined();
  });

  it('DET-5 — expected literal is kept', () => {
    const detail = edgeBuildFailureDetail({ expected: 'mcp' });
    expect(detail).toEqual({ expected: 'mcp' });
  });

  it('DET-6 — family enum value is kept', () => {
    const detail = edgeBuildFailureDetail({ family: 'evidence_source_chain' });
    expect(detail).toEqual({ family: 'evidence_source_chain' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildFailureDetail — receivedType / receivedKeys / checkedRawKey
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — buildFailureDetail (structural derivation)', () => {
  it('DET-7 — receivedType stores typeof, NEVER the value', () => {
    const secretValue = { token: 'super-secret-value', body: 'a long prompt body' };
    const detail = edgeBuildFailureDetail({ received: secretValue });
    expect(detail).toEqual({ receivedType: 'object' });
    // The actual value must be nowhere in the serialized detail.
    expect(JSON.stringify(detail)).not.toContain('super-secret-value');
    expect(JSON.stringify(detail)).not.toContain('a long prompt body');
  });

  it('DET-8 — receivedType for a string value is "string", not the string', () => {
    const detail = edgeBuildFailureDetail({ received: 'the entire model response text' });
    expect(detail).toEqual({ receivedType: 'string' });
    expect(JSON.stringify(detail)).not.toContain('the entire model response');
  });

  it('DET-9 — receivedKeys records key NAMES only, never values', () => {
    const detail = edgeBuildFailureDetail({
      receivedKeysFrom: { schemaVersion: 'X', nodeId: 'secret-node', observations: {} },
    });
    expect(detail?.receivedKeys).toEqual(['schemaVersion', 'nodeId', 'observations']);
    expect(JSON.stringify(detail)).not.toContain('secret-node');
  });

  it('DET-10 — receivedKeysFrom for a non-object yields no receivedKeys', () => {
    expect(edgeBuildFailureDetail({ receivedKeysFrom: 'not-an-object' })).toBeUndefined();
    expect(edgeBuildFailureDetail({ receivedKeysFrom: 42 })).toBeUndefined();
    expect(edgeBuildFailureDetail({ receivedKeysFrom: null })).toBeUndefined();
  });

  it('DET-11 — receivedKeys capped to 32 keys, each ≤64 chars, identifier-shaped only', () => {
    const hostile: Record<string, unknown> = {};
    for (let i = 0; i < 100; i += 1) {
      // 200-char names with punctuation that must be stripped.
      const longName = `key_${i}_` + '$/<>;"\\'.repeat(40);
      hostile[longName] = i;
    }
    const detail = edgeBuildFailureDetail({ receivedKeysFrom: hostile });
    expect(detail?.receivedKeys).toBeDefined();
    const keys = detail!.receivedKeys!;
    expect(keys.length).toBeLessThanOrEqual(32);
    for (const k of keys) {
      expect(k.length).toBeLessThanOrEqual(64);
      // identifier-shaped only
      expect(/^[A-Za-z0-9_]*$/.test(k)).toBe(true);
    }
  });

  it('DET-12 — checkedRawKey kept only when a known registry key', () => {
    const known = edgeAnyRegistryRawKey();
    const detail = edgeBuildFailureDetail({ checkedRawKey: known });
    expect(detail).toEqual({ checkedRawKey: known });
  });

  it('DET-13 — an unknown checkedRawKey is dropped', () => {
    const detail = edgeBuildFailureDetail({ checkedRawKey: 'definitely_not_a_registry_key_xyz' });
    expect(detail).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildFailureDetail — HOSTILE fixture (the HALT-4 wall)
// ─────────────────────────────────────────────────────────────────────

describe('OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — buildFailureDetail HOSTILE fixture (HALT-4)', () => {
  // Assemble each banned shape from fragments so this test file itself
  // carries no contiguous secret-shaped literal.
  const FAKE_BEARER = 'Bea' + 'rer ' + 'a'.repeat(32);
  const FAKE_SK_ANT = 'sk' + '-ant-' + 'A1B2C3D4E5F6';
  const FAKE_SB_SECRET = 'sb' + '_secret_' + 'ZYXW9876543';
  const FAKE_XAI = 'xai' + '-' + 'abcdef123456';
  const FAKE_JWT = 'eyJ' + 'A'.repeat(24) + '.' + 'B'.repeat(12) + '.' + 'C'.repeat(12);
  const FAKE_AUTH_HEADER = 'Authorization: ' + FAKE_BEARER;
  const FAKE_PROMPT = 'You are a debate moderator. The user said: ' + 'x'.repeat(80);
  const HUGE_BODY = 'B'.repeat(5_000);

  function assertNoBannedShapes(serialized: string): void {
    expect(new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{6,}').test(serialized)).toBe(false);
    expect(new RegExp('xai' + '-' + '[A-Za-z0-9]{6,}').test(serialized)).toBe(false);
    expect(new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{6,}').test(serialized)).toBe(false);
    expect(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/.test(serialized)).toBe(false);
    expect(new RegExp('Bea' + 'rer' + '\\s+[A-Za-z0-9._-]{8,}').test(serialized)).toBe(false);
    expect(/Authorization/i.test(serialized)).toBe(false);
    expect(/SERVICE_ROLE/.test(serialized)).toBe(false);
  }

  it('DET-14 — EVERY banned secret shape smuggled via a string field (expected / schemaVersion) is dropped', () => {
    // Each shape, fed through each string entry point, must be rejected
    // (the field is dropped → the whole detail is undefined when it was
    // the only field).
    const bannedValues = [
      FAKE_BEARER,
      FAKE_SK_ANT,
      FAKE_SB_SECRET,
      FAKE_XAI,
      FAKE_JWT,
      FAKE_AUTH_HEADER,
    ];
    for (const value of bannedValues) {
      // Via `expected`.
      expect(edgeBuildFailureDetail({ expected: value })).toBeUndefined();
      // Via `schemaVersion`.
      expect(edgeBuildFailureDetail({ schemaVersion: value })).toBeUndefined();
    }
  });

  it('DET-20 — a full hostile input is reduced to ONLY safe structural fields, no banned shape survives', () => {
    const known = edgeAnyRegistryRawKey();
    const detail = edgeBuildFailureDetail({
      validatorReason: 'wrong_shape',
      // Safe structural fields.
      path: 'modelInfo.provider',
      checkedRawKey: known,
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      family: 'argument_scheme',
      // Hostile smuggling attempts via every string entry point.
      expected: FAKE_BEARER,
      // The received VALUE carries every secret; only its typeof may survive.
      received: {
        prompt: FAKE_PROMPT,
        token: FAKE_BEARER,
        key1: FAKE_SK_ANT,
        key2: FAKE_SB_SECRET,
        jwt: FAKE_JWT,
        auth: FAKE_AUTH_HEADER,
        body: HUGE_BODY,
      },
      // The KEY NAMES are recorded; they must be identifier-shaped + carry
      // no secret.
      receivedKeysFrom: {
        [FAKE_BEARER]: 1,
        [FAKE_SK_ANT]: 2,
        prompt: 3,
      },
    });
    expect(detail).toBeDefined();
    const serialized = JSON.stringify(detail);
    assertNoBannedShapes(serialized);
    // The huge body / prompt text must be nowhere.
    expect(serialized).not.toContain(HUGE_BODY);
    expect(serialized).not.toContain('You are a debate moderator');
    // The expected field (a Bearer token) was dropped, but the safe fields survived.
    expect(detail?.validatorReason).toBe('wrong_shape');
    expect(detail?.path).toBe('modelInfo.provider');
    expect(detail?.checkedRawKey).toBe(known);
    expect(detail?.family).toBe('argument_scheme');
    expect(detail?.receivedType).toBe('object');
    expect(detail?.expected).toBeUndefined();
  });

  it('DET-21 — serialized detail is capped at ≤2000 chars (graceful degradation)', () => {
    const hostile: Record<string, unknown> = {};
    for (let i = 0; i < 100; i += 1) {
      hostile[`field_name_number_${i}_padded_to_be_long_enough_aaaaaaaaaaaaaaaaaaaa`] = i;
    }
    const detail = edgeBuildFailureDetail({
      validatorReason: 'wrong_shape',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      receivedKeysFrom: hostile,
    });
    expect(detail).toBeDefined();
    expect(JSON.stringify(detail).length).toBeLessThanOrEqual(2_000);
    // validatorReason + schemaVersion always survive the degradation.
    expect(detail?.validatorReason).toBe('wrong_shape');
    expect(detail?.schemaVersion).toBe('mcp-021.machine-observations.boolean.v1');
  });

  it('DET-22 — receivedKeys is the FIRST field dropped under the size cap', () => {
    // Build an input whose receivedKeys alone push it over budget but
    // whose other fields fit. After degradation receivedKeys is gone but
    // the small fields remain. Each key NAME must be DISTINCT (duplicate
    // object literal keys collapse) and long enough that 32 of them
    // exceed the 2000-char serialized budget.
    const hostile: Record<string, unknown> = {};
    for (let i = 0; i < 32; i += 1) {
      // Distinct 64-char identifier names: 32 × ~66 serialized chars
      // (quotes + comma) ≈ 2100+ chars, over the 2000 budget.
      const name = ('key' + String(i).padStart(2, '0') + '_').padEnd(64, 'a');
      hostile[name] = i;
    }
    const detail = edgeBuildFailureDetail({
      validatorReason: 'missing_required_field',
      path: 'observations',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      receivedKeysFrom: hostile,
    });
    expect(detail).toBeDefined();
    expect(JSON.stringify(detail).length).toBeLessThanOrEqual(2_000);
    expect(detail?.receivedKeys).toBeUndefined();
    expect(detail?.validatorReason).toBe('missing_required_field');
  });
});

// Type-only assertion: the imported union is the expected shape.
const _typecheck: BooleanObservationFailureSubreason = 'response_wrong_shape';
void _typecheck;
