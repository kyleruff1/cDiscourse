/**
 * MCP-EGI-003 — Edge unmasking of hosted-MCP `validation_failed` into safe,
 * structural `failure_detail` fields.
 *
 * Behavioral tests for the additive surface the MCP-EGI-004 D3 canary FAIL
 * (2026-06-21) proved was missing:
 *   - `mcpToolDetailToCategory(detail)` — pure closed-enum mapper.
 *   - widened `isAllowedDetailPath` — accepts `evidenceSpan.<rawKey>` /
 *     `confidence.<rawKey>` / `observations.<rawKey>` plus the legacy top-level
 *     forms.
 *   - `buildFailureDetail({ detailCategory, ... })` — persists the closed-enum
 *     category and the widened path.
 *   - `buildRunRowFailureDetail({ mcpToolReason, mcpToolDetailCategory, ... })`
 *     — persists `mcp_tool_reason` + `mcp_tool_detail_category` jsonb fields,
 *     allowlisted via the closed enum / closed reason set.
 *
 * Leak-safety scans:
 *   - the raw validator `detail` string is NEVER persisted.
 *   - an unknown / model-emitted / malformed value falls through to
 *     `unknown_validation_failed` or is dropped — neither captures a value.
 *   - a maliciously crafted serverReason carrying a Bearer / JWT / sk-ant
 *     pattern is dropped by the existing `looksSecret` scrub.
 *   - the cross-file allowlist drift guard asserts the persisted snake_case
 *     allowlist (`classifierRunRowFailureDetail.ts`) matches the in-memory
 *     enum (`booleanObservationFailureSubreason.ts`).
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1 / §10a — categories carry no verdict tokens.
 *   - cdiscourse-doctrine §6 — secret-surface closed by closed-enum allowlist.
 */
import {
  EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES,
  EDGE_ALLOWED_MCP_TOOL_REASONS,
  edgeBuildFailureDetail,
  edgeMcpToolDetailToCategory,
} from './_helpers/booleanObservationFailureSubreasonDeno';
import { edgeBuildRunRowFailureDetail } from './_helpers/classifierRunRowFailureDetailDeno';

// ─────────────────────────────────────────────────────────────────────
// mcpToolDetailToCategory — pure detail-string → closed-enum mapper
// ─────────────────────────────────────────────────────────────────────

describe('MCP-EGI-003 — mcpToolDetailToCategory (closed-enum mapper)', () => {
  it('CAT-1 — "length 241 exceeds max 240" → evidence_span_length_exceeded', () => {
    expect(edgeMcpToolDetailToCategory('length 241 exceeds max 240')).toBe(
      'evidence_span_length_exceeded',
    );
  });

  it('CAT-1b — "length 9999 exceeds max 240" → evidence_span_length_exceeded (any digits)', () => {
    expect(edgeMcpToolDetailToCategory('length 9999 exceeds max 240')).toBe(
      'evidence_span_length_exceeded',
    );
  });

  it('CAT-2 — "value must be string or null" → evidence_span_invalid_type', () => {
    expect(edgeMcpToolDetailToCategory('value must be string or null')).toBe(
      'evidence_span_invalid_type',
    );
  });

  it('CAT-3 — "rawKey present in observations but missing from evidenceSpan" → evidence_span_key_set_missing', () => {
    expect(
      edgeMcpToolDetailToCategory(
        'rawKey present in observations but missing from evidenceSpan',
      ),
    ).toBe('evidence_span_key_set_missing');
  });

  it('CAT-4 — "rawKey present in evidenceSpan but missing from observations" → evidence_span_key_set_extra', () => {
    expect(
      edgeMcpToolDetailToCategory(
        'rawKey present in evidenceSpan but missing from observations',
      ),
    ).toBe('evidence_span_key_set_extra');
  });

  it('CAT-5 — confidence-side asymmetries map to confidence_key_set_*', () => {
    expect(
      edgeMcpToolDetailToCategory(
        'rawKey present in observations but missing from confidence',
      ),
    ).toBe('confidence_key_set_missing');
    expect(
      edgeMcpToolDetailToCategory(
        'rawKey present in confidence but missing from observations',
      ),
    ).toBe('confidence_key_set_extra');
  });

  it('CAT-6 — "value must be low|medium|high" → confidence_invalid_value', () => {
    expect(edgeMcpToolDetailToCategory('value must be low|medium|high')).toBe(
      'confidence_invalid_value',
    );
  });

  it('CAT-7 — "value must be boolean" → observation_invalid_value', () => {
    expect(edgeMcpToolDetailToCategory('value must be boolean')).toBe(
      'observation_invalid_value',
    );
  });

  it('CAT-8 — observations.key-missing-from-checked maps cleanly', () => {
    expect(
      edgeMcpToolDetailToCategory(
        'observations key "compares_options" missing from checkedRawKeys',
      ),
    ).toBe('observation_key_missing_from_checked');
  });

  it('CAT-9 — schemaVersion mismatch matches by PREFIX only (no value capture)', () => {
    expect(
      edgeMcpToolDetailToCategory(
        'expected mcp-021.machine-observations.boolean.v1; got bogus-v99',
      ),
    ).toBe('schema_version_mismatch');
    // The raw `got <X>` is not extracted — only the prefix matched.
  });

  it('CAT-10 — "missing required field ..." → missing_required_field', () => {
    expect(
      edgeMcpToolDetailToCategory('missing required field "observations"'),
    ).toBe('missing_required_field');
  });

  it('CAT-11 — "flag count N exceeds max 20" → flag_count_too_high', () => {
    expect(edgeMcpToolDetailToCategory('flag count 21 exceeds max 20')).toBe(
      'flag_count_too_high',
    );
  });

  it('CAT-12 — "doctrine_ban_list" literal → doctrine_ban_list', () => {
    expect(edgeMcpToolDetailToCategory('doctrine_ban_list')).toBe(
      'doctrine_ban_list',
    );
  });

  it('CAT-13 — any other non-empty string → unknown_validation_failed (fall-through)', () => {
    expect(edgeMcpToolDetailToCategory('something the validator never says')).toBe(
      'unknown_validation_failed',
    );
    expect(edgeMcpToolDetailToCategory('a-new-validator-string-from-future')).toBe(
      'unknown_validation_failed',
    );
  });

  it('CAT-14 — non-string / empty / null / undefined → undefined (no category)', () => {
    expect(edgeMcpToolDetailToCategory(undefined)).toBeUndefined();
    expect(edgeMcpToolDetailToCategory(null)).toBeUndefined();
    expect(edgeMcpToolDetailToCategory('')).toBeUndefined();
    expect(edgeMcpToolDetailToCategory(42)).toBeUndefined();
    expect(edgeMcpToolDetailToCategory({})).toBeUndefined();
    expect(edgeMcpToolDetailToCategory([])).toBeUndefined();
  });

  it('CAT-LEAK — categories carry no verdict tokens (doctrine §1/§10a)', () => {
    // Targets unambiguous DOCTRINE-VERDICT tokens (winner / loser / settled-in-favor
    // / liar / propagandist) — NOT generic validator words like "invalid" or
    // "wrong", which appear here as STRUCTURAL classifications of a packet shape,
    // not as verdicts on an argument. The doctrine ban-list test for verdict-
    // free output rides at the prompt + response layer; this scan guards only
    // that the categorization vocabulary itself does not borrow doctrine-loaded
    // verdict phrases.
    const bannedTokens = [
      'winner',
      'loser',
      'won_the',
      'lost_the',
      'defeated',
      'prevailed',
      'capitulated',
      'truth_value',
      'liar',
      'propagandist',
      'evil',
    ];
    for (const cat of EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES) {
      for (const t of bannedTokens) {
        expect(cat.includes(t)).toBe(false);
      }
    }
  });

  it('CAT-ENUM — enum has exactly 14 documented categories', () => {
    expect(EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES.length).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────
// isAllowedDetailPath — widening to dotted forms
// ─────────────────────────────────────────────────────────────────────

describe('MCP-EGI-003 — buildFailureDetail path widening (dotted forms)', () => {
  it('PATH-1 — accepts `evidenceSpan.compares_options` (was dropped pre-EGI-003)', () => {
    const result = edgeBuildFailureDetail({ path: 'evidenceSpan.compares_options' });
    expect(result?.path).toBe('evidenceSpan.compares_options');
  });

  it('PATH-2 — accepts `evidenceSpan.convergent_premise_structure`', () => {
    const result = edgeBuildFailureDetail({
      path: 'evidenceSpan.convergent_premise_structure',
    });
    expect(result?.path).toBe('evidenceSpan.convergent_premise_structure');
  });

  it('PATH-3 — accepts `confidence.<rawKey>` and `observations.<rawKey>`', () => {
    expect(
      edgeBuildFailureDetail({ path: 'confidence.synthesis_proposed' })?.path,
    ).toBe('confidence.synthesis_proposed');
    expect(
      edgeBuildFailureDetail({ path: 'observations.tradeoff_reasoning_present' })?.path,
    ).toBe('observations.tradeoff_reasoning_present');
  });

  it('PATH-4 — still accepts legacy top-level literals (backward compat)', () => {
    for (const top of [
      'schemaVersion',
      'nodeId',
      'checkedRawKeys',
      'observations',
      'confidence',
      'evidenceSpan',
      'modelInfo',
      'modelInfo.provider',
      'modelInfo.serverName',
      'modelInfo.classifierSetVersion',
    ]) {
      expect(edgeBuildFailureDetail({ path: top })?.path).toBe(top);
    }
  });

  it('PATH-5 — rejects nested dotted paths (no `<top>.<a>.<b>`)', () => {
    expect(
      edgeBuildFailureDetail({ path: 'evidenceSpan.foo.bar' })?.path,
    ).toBeUndefined();
  });

  it('PATH-6 — rejects non-identifier suffix (whitespace, quotes, etc.)', () => {
    expect(
      edgeBuildFailureDetail({ path: 'evidenceSpan.has space' })?.path,
    ).toBeUndefined();
    expect(
      edgeBuildFailureDetail({ path: 'evidenceSpan."with"quotes' })?.path,
    ).toBeUndefined();
    expect(
      edgeBuildFailureDetail({ path: 'evidenceSpan.has-dash' })?.path,
    ).toBeUndefined();
  });

  it('PATH-7 — rejects unknown top (no `claim.<rawKey>` etc.)', () => {
    expect(
      edgeBuildFailureDetail({ path: 'arbitrary.compares_options' })?.path,
    ).toBeUndefined();
    expect(
      edgeBuildFailureDetail({ path: 'verdict.someKey' })?.path,
    ).toBeUndefined();
  });

  it('PATH-8 — rejects empty suffix `evidenceSpan.`', () => {
    expect(edgeBuildFailureDetail({ path: 'evidenceSpan.' })?.path).toBeUndefined();
  });

  it('PATH-9 — rejects identifier starting with a digit', () => {
    expect(
      edgeBuildFailureDetail({ path: 'evidenceSpan.1compares' })?.path,
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildFailureDetail — detailCategory plumbing
// ─────────────────────────────────────────────────────────────────────

describe('MCP-EGI-003 — buildFailureDetail({ detailCategory })', () => {
  it('DET-1 — known category is persisted', () => {
    const r = edgeBuildFailureDetail({
      detailCategory: 'evidence_span_length_exceeded',
    });
    expect(r?.detailCategory).toBe('evidence_span_length_exceeded');
  });

  it('DET-2 — unknown / freeform string is dropped (allowlist enforced)', () => {
    const r = edgeBuildFailureDetail({
      detailCategory: 'not-a-real-category' as never,
    });
    expect(r?.detailCategory).toBeUndefined();
  });

  it('DET-3 — every documented category survives a round-trip', () => {
    for (const cat of EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES) {
      const r = edgeBuildFailureDetail({ detailCategory: cat });
      expect(r?.detailCategory).toBe(cat);
    }
  });

  it('DET-4 — adapter-typical combo: serverReason + path + detailCategory', () => {
    const r = edgeBuildFailureDetail({
      serverReason: 'validation_failed',
      path: 'evidenceSpan.compares_options',
      detailCategory: 'evidence_span_invalid_type',
      receivedKeysFrom: { isError: true, reason: 'validation_failed', path: 'x' },
    });
    expect(r?.serverReason).toBe('validation_failed');
    expect(r?.path).toBe('evidenceSpan.compares_options');
    expect(r?.detailCategory).toBe('evidence_span_invalid_type');
    expect(r?.receivedKeys).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildRunRowFailureDetail — persisted snake_case fields
// ─────────────────────────────────────────────────────────────────────

describe('MCP-EGI-003 — buildRunRowFailureDetail persists mcp_tool_* fields', () => {
  it('ROW-1 — known reason + known category persist as snake_case', () => {
    const r = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'thread_topology',
      correlationId: '7bf37011-fbca-4de7-b24f-a9ea6060966a',
      attemptCount: 5,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      validatorPath: 'evidenceSpan.compares_options',
      mcpToolReason: 'validation_failed',
      mcpToolDetailCategory: 'evidence_span_invalid_type',
    });
    expect(r?.mcp_tool_reason).toBe('validation_failed');
    expect(r?.mcp_tool_detail_category).toBe('evidence_span_invalid_type');
    expect(r?.validator_path).toBe('evidenceSpan.compares_options');
    expect(r?.reason).toBe('mcp_api_error');
    expect(r?.family).toBe('thread_topology');
    expect(r?.attempt_count).toBe(5);
  });

  it('ROW-2 — unknown mcpToolReason is dropped (closed allowlist)', () => {
    const r = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'thread_topology',
      mcpToolReason: 'invented_reason',
    });
    expect(r?.mcp_tool_reason).toBeUndefined();
    expect(r?.reason).toBe('mcp_api_error');
  });

  it('ROW-3 — unknown mcpToolDetailCategory is dropped (closed enum)', () => {
    const r = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'thread_topology',
      mcpToolDetailCategory: 'definitely_not_a_category',
    });
    expect(r?.mcp_tool_detail_category).toBeUndefined();
  });

  it('ROW-4 — bearer/JWT/sk-ant in mcpToolReason are dropped (secret-shape scrub)', () => {
    const constructed = [
      'sk' + '-ant-' + 'AAAAAAAAAAA',
      'eyJ' + 'AAAAAAAAAA' + '.BBBBBB' + '.CCCCCC',
      'Bea' + 'rer ' + 'ABCDEFGHIJ',
    ];
    for (const s of constructed) {
      const r = edgeBuildRunRowFailureDetail({
        reason: 'mcp_api_error',
        family: 'thread_topology',
        mcpToolReason: s,
      });
      expect(r?.mcp_tool_reason).toBeUndefined();
    }
  });

  it('ROW-5 — preserves backward-compat: rows without mcp_tool_* still build', () => {
    const r = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'thread_topology',
      correlationId: 'abc-123',
      attemptCount: 5,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
    });
    expect(r?.reason).toBe('mcp_api_error');
    expect(r?.mcp_tool_reason).toBeUndefined();
    expect(r?.mcp_tool_detail_category).toBeUndefined();
  });

  it('ROW-6 — cross-file allowlist drift guard (categories)', () => {
    // The persisted snake_case allowlist (the closed Set in
    // classifierRunRowFailureDetail.ts) is re-derived locally per the
    // preservation-manifest pattern. Verify it accepts every value the
    // in-memory enum (booleanObservationFailureSubreason.ts) declares.
    for (const cat of EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES) {
      const r = edgeBuildRunRowFailureDetail({ mcpToolDetailCategory: cat });
      expect(r?.mcp_tool_detail_category).toBe(cat);
    }
  });

  it('ROW-7 — cross-file allowlist drift guard (reasons)', () => {
    for (const reason of EDGE_ALLOWED_MCP_TOOL_REASONS) {
      const r = edgeBuildRunRowFailureDetail({ mcpToolReason: reason });
      expect(r?.mcp_tool_reason).toBe(reason);
    }
  });

  it('ROW-8 — happy-path canary shape: discriminator visible on a hypothetical EGI dead-letter', () => {
    // Simulates what a future MCP-EGI-004 D3 canary will see on the row,
    // post-deploy. The Edge unmasks: hosted-MCP `validation_failed` becomes
    // visible on `mcp_tool_reason`, the structural category on
    // `mcp_tool_detail_category`, and the dotted path on `validator_path` —
    // all without exposing any raw value.
    const lengthOverflow = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'thread_topology',
      correlationId: 'fb2ba0d3-6edd-401c-94a4-09210a8ef0b8',
      attemptCount: 5,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      validatorPath: 'evidenceSpan.compares_options',
      mcpToolReason: 'validation_failed',
      mcpToolDetailCategory: 'evidence_span_length_exceeded',
    });
    expect(lengthOverflow?.mcp_tool_reason).toBe('validation_failed');
    expect(lengthOverflow?.mcp_tool_detail_category).toBe(
      'evidence_span_length_exceeded',
    );
    expect(lengthOverflow?.validator_path).toBe('evidenceSpan.compares_options');

    const typeShape = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'argument_scheme',
      correlationId: '05641d58-bce3-42a5-8498-2dfa48266a2d',
      attemptCount: 5,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      validatorPath: 'evidenceSpan.convergent_premise_structure',
      mcpToolReason: 'validation_failed',
      mcpToolDetailCategory: 'evidence_span_invalid_type',
    });
    expect(typeShape?.mcp_tool_reason).toBe('validation_failed');
    expect(typeShape?.mcp_tool_detail_category).toBe('evidence_span_invalid_type');
    expect(typeShape?.validator_path).toBe(
      'evidenceSpan.convergent_premise_structure',
    );
  });

  it('ROW-9 — genuine provider 5xx (no mcpToolReason / no category) remains distinguishable', () => {
    // The Edge wraps a true provider 5xx as `api_error` without an isError
    // envelope; in that case the adapter does not populate serverReason or
    // detailCategory, so the row's mcp_tool_* fields stay absent. That is
    // the gate that lets a future MCP-EGI-004 D3 canary distinguish a
    // validation residual (mcp_tool_reason='validation_failed' present)
    // from a real provider transient (both fields absent).
    const r = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'evidence_source_chain',
      correlationId: 'a-real-5xx',
      attemptCount: 3,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
    });
    expect(r?.mcp_tool_reason).toBeUndefined();
    expect(r?.mcp_tool_detail_category).toBeUndefined();
    expect(r?.reason).toBe('mcp_api_error');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Leak-safety / source-scan
// ─────────────────────────────────────────────────────────────────────

describe('MCP-EGI-003 — leak-safety: the raw `detail` string never enters the persisted shape', () => {
  it('LEAK-1 — schemaVersion-mismatch raw value is NOT captured in any persisted field', () => {
    // The Edge mapper key-off the PREFIX `expected mcp-021.` and returns
    // only the category — the raw `got <X>` payload is discarded by
    // construction. This test simulates that flow and asserts no row field
    // carries the X value.
    const X_VALUE = 'this-could-be-an-arbitrary-model-emit-string-9k2j3';
    const category = edgeMcpToolDetailToCategory(
      `expected mcp-021.machine-observations.boolean.v1; got ${X_VALUE}`,
    );
    expect(category).toBe('schema_version_mismatch');
    const row = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'argument_scheme',
      mcpToolReason: 'validation_failed',
      mcpToolDetailCategory: category,
    });
    expect(JSON.stringify(row)).not.toContain(X_VALUE);
  });

  it('LEAK-2 — observations key-name detail does not smuggle the key value', () => {
    // The validator emits `observations key "<key>" missing from checkedRawKeys`
    // where <key> is a rawKey identifier. The category mapper does NOT
    // extract the key; it returns the category only. The persisted row
    // therefore carries no quoted-key content.
    const detail = 'observations key "made_up_rawKey_x" missing from checkedRawKeys';
    const category = edgeMcpToolDetailToCategory(detail);
    expect(category).toBe('observation_key_missing_from_checked');
    const row = edgeBuildRunRowFailureDetail({
      reason: 'mcp_api_error',
      family: 'argument_scheme',
      mcpToolReason: 'validation_failed',
      mcpToolDetailCategory: category,
    });
    expect(JSON.stringify(row)).not.toContain('made_up_rawKey_x');
  });

  it('LEAK-3 — every documented category is identifier-shaped (no spaces / no separators)', () => {
    for (const cat of EDGE_ALL_MCP_TOOL_DETAIL_CATEGORIES) {
      expect(cat).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
