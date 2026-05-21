/**
 * QOL-037 — submit-argument advisory evidenceResponse pass-through contract.
 *
 * The Edge Function `index.ts` uses Deno-style imports and cannot be loaded by
 * Jest, so its CONTRACT is asserted by source-file inspection (the
 * `annotateEvidenceEdgeFunction.test.ts` / `applyManualTagEdgeFunction.test.ts`
 * pattern). This suite proves the QOL-037 change is the MINIMAL advisory
 * pass-through the design §7.4 specifies — and nothing more:
 *
 *   - the request schema gains one OPTIONAL `evidence_response` field;
 *   - the function copies the block VERBATIM into the server validation
 *     snapshot it already writes;
 *   - it adds NO new hard-block, NO new validation rule, NO insert-path
 *     change, NO RLS change.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/submit-argument/index.ts'),
  'utf8',
);
const schemaSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/_shared/validationSchemas.ts'),
  'utf8',
);

// ── The request schema — one optional advisory field ───────────

describe('SubmitArgumentSchema — optional evidence_response field', () => {
  it('defines an EvidenceResponseSchema with the three contract fields', () => {
    expect(schemaSrc).toMatch(/EvidenceResponseSchema\s*=\s*z\.object\(/);
    expect(schemaSrc).toMatch(/evidence_artifact_id:\s*z\.string\(\)/);
    expect(schemaSrc).toMatch(/choice:\s*z\.string\(\)/);
    expect(schemaSrc).toMatch(/clarification_body:\s*z\.string\(\)/);
  });

  it('attaches evidence_response to the submit schema as OPTIONAL', () => {
    // `.optional()` → an older client that omits the field is unaffected.
    expect(schemaSrc).toMatch(/evidence_response:\s*EvidenceResponseSchema\.optional\(\)/);
  });

  it('keeps the choice field a permissive string (no enum that could reject)', () => {
    // A malformed / future `choice` must never block a post — the client-side
    // deriveApplicabilityStatus ignores an unknown choice. The schema must not
    // narrow `choice` to an enum.
    const evidenceBlock = schemaSrc.slice(
      schemaSrc.indexOf('EvidenceResponseSchema'),
      schemaSrc.indexOf('EvidenceResponseSchema') + 260,
    );
    expect(evidenceBlock).toMatch(/choice:\s*z\.string\(\)/);
    expect(evidenceBlock).not.toMatch(/choice:\s*z\.enum/);
  });
});

// ── The function copies the block verbatim into the snapshot ───

describe('submit-argument — verbatim advisory copy into the snapshot', () => {
  it('copies data.evidence_response into the serverValidation snapshot', () => {
    expect(fnSrc).toMatch(/if\s*\(\s*data\.evidence_response\s*\)/);
    expect(fnSrc).toMatch(/serverValidation\.evidenceResponse\s*=\s*data\.evidence_response/);
  });

  it('the copy is guarded so an absent block adds nothing to the snapshot', () => {
    // The assignment is inside `if (data.evidence_response)` — when the field
    // is absent the snapshot is byte-identical to the pre-QOL-037 shape.
    const idx = fnSrc.indexOf('serverValidation.evidenceResponse');
    const guardIdx = fnSrc.lastIndexOf('if (data.evidence_response)', idx);
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeLessThan(idx);
  });

  it('the block is copied as-is — no per-field re-mapping or transformation', () => {
    // Verbatim: the RHS is exactly `data.evidence_response`, not a rebuilt
    // object. This keeps it advisory and the client the single source of
    // truth for the applicability derivation.
    expect(fnSrc).toMatch(/=\s*data\.evidence_response;/);
  });
});

// ── No new hard-block, no insert-path / RLS change ─────────────

describe('submit-argument — the change is advisory only (no behaviour change)', () => {
  it('adds no validationFailed branch keyed on evidence_response', () => {
    // The function must NOT reject a post because of the evidenceResponse
    // block. There is no `validationFailed` call near the evidence_response
    // handling.
    const evidenceIdx = fnSrc.indexOf('data.evidence_response');
    const window = fnSrc.slice(Math.max(0, evidenceIdx - 400), evidenceIdx + 400);
    expect(window).not.toMatch(/validationFailed/);
    expect(window).not.toMatch(/forbidden\(/);
  });

  it('does not add evidence_response into the arguments insert row', () => {
    // The advisory block lives ONLY in the validation snapshot — it is never
    // a new column on the arguments insert (no migration in v1).
    const insertBlock = fnSrc.slice(
      fnSrc.indexOf('const argInsert'),
      fnSrc.indexOf('const argInsert') + 700,
    );
    expect(insertBlock).not.toMatch(/evidence_response/);
    expect(insertBlock).not.toMatch(/evidenceResponse/);
  });

  it('still writes server_validation from the serverValidation object', () => {
    // The snapshot column wiring is unchanged — server_validation is fed by
    // the same `serverValidation` object the advisory block is added to.
    expect(fnSrc).toMatch(/server_validation:\s*serverValidation/);
  });

  it('still passes client_validation through verbatim (unchanged)', () => {
    expect(fnSrc).toMatch(/client_validation:\s*data\.client_validation\s*\?\?\s*\{\}/);
  });

  it('does not disable or alter RLS — no rls / policy keyword appears', () => {
    expect(fnSrc.toLowerCase()).not.toMatch(/disable\s+row\s+level/);
    expect(fnSrc.toLowerCase()).not.toMatch(/alter\s+policy/);
  });

  it('introduces no AI / model-provider call', () => {
    expect(fnSrc.toLowerCase()).not.toMatch(/anthropic|openai|\bxai\b|api\.x\.ai/);
  });

  it('the existing body-validation gate (evaluateArgumentDraft) is untouched', () => {
    // The only post gate remains evalResult.allowPost — QOL-037 adds no gate.
    expect(fnSrc).toMatch(/if\s*\(\s*!evalResult\.allowPost\s*\)/);
  });
});
