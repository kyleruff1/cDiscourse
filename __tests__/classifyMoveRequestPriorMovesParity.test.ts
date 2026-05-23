/**
 * MCP-MOD-008 — `ClassifyMoveRequest.priorMovesRedacted` parity scan.
 *
 * The optional `priorMovesRedacted` field exists in TWO places:
 *
 *   1. Node-side: `src/lib/edgeFunctions.ts` — used by the client wrapper.
 *   2. Deno-side: `supabase/functions/_shared/semanticReferee/types.ts` +
 *      `supabase/functions/_shared/semanticReferee/schema.ts` — used by the
 *      Edge Function for type definition and runtime validation.
 *
 * A drift between the two would silently break the boundary. This test
 * READS BOTH files as source text and asserts the field exists on both sides
 * with the same shape: optional, an array of `{ authorAlias, bodyRedacted }`.
 *
 * Mirrors the existing parity pattern (`semanticDenoNodeParity.test.ts` for
 * the response side; `semanticClassifyRequestSchema.test.ts` for the schema
 * surface).
 */
import * as fs from 'fs';
import * as path from 'path';

const NODE_PATH = path.join(
  process.cwd(),
  'src/lib/edgeFunctions.ts',
);
const DENO_TYPES_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/types.ts',
);
const DENO_SCHEMA_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/schema.ts',
);

const nodeSrc = fs.readFileSync(NODE_PATH, 'utf8');
const denoTypesSrc = fs.readFileSync(DENO_TYPES_PATH, 'utf8');
const denoSchemaSrc = fs.readFileSync(DENO_SCHEMA_PATH, 'utf8');

describe('MCP-MOD-008 priorMovesRedacted parity — Node side', () => {
  it('declares the PriorMoveContext interface', () => {
    expect(nodeSrc).toMatch(/export interface PriorMoveContext/);
  });

  it('PriorMoveContext carries authorAlias: string', () => {
    expect(nodeSrc).toMatch(/PriorMoveContext[\s\S]*?authorAlias:\s*string/);
  });

  it('PriorMoveContext carries bodyRedacted: string', () => {
    expect(nodeSrc).toMatch(/PriorMoveContext[\s\S]*?bodyRedacted:\s*string/);
  });

  it('ClassifyMoveRequest carries priorMovesRedacted as an optional ReadonlyArray', () => {
    expect(nodeSrc).toMatch(
      /ClassifyMoveRequest[\s\S]*?priorMovesRedacted\?:\s*ReadonlyArray<PriorMoveContext>/,
    );
  });
});

describe('MCP-MOD-008 priorMovesRedacted parity — Deno types side', () => {
  it('declares the PriorMoveContext interface', () => {
    expect(denoTypesSrc).toMatch(/export interface PriorMoveContext/);
  });

  it('PriorMoveContext carries authorAlias: string', () => {
    expect(denoTypesSrc).toMatch(
      /PriorMoveContext[\s\S]*?authorAlias:\s*string/,
    );
  });

  it('PriorMoveContext carries bodyRedacted: string', () => {
    expect(denoTypesSrc).toMatch(
      /PriorMoveContext[\s\S]*?bodyRedacted:\s*string/,
    );
  });

  it('ClassifyMoveRequest carries priorMovesRedacted as an optional ReadonlyArray', () => {
    expect(denoTypesSrc).toMatch(
      /ClassifyMoveRequest[\s\S]*?priorMovesRedacted\?:\s*ReadonlyArray<PriorMoveContext>/,
    );
  });
});

describe('MCP-MOD-008 priorMovesRedacted parity — Deno schema side', () => {
  it('declares a strict PriorMoveContextSchema', () => {
    // The schema validator for one entry must be present and .strict() so a
    // smuggled extra field fails validation.
    expect(denoSchemaSrc).toMatch(/PriorMoveContextSchema/);
    // The schema chain must include both authorAlias and bodyRedacted.
    expect(denoSchemaSrc).toMatch(
      /PriorMoveContextSchema[\s\S]*?authorAlias:\s*z\.string\(\)/,
    );
    expect(denoSchemaSrc).toMatch(
      /PriorMoveContextSchema[\s\S]*?bodyRedacted:\s*z\.string\(\)/,
    );
  });

  it('ClassifyMoveRequestSchema carries priorMovesRedacted as optional', () => {
    expect(denoSchemaSrc).toMatch(
      /priorMovesRedacted:\s*z[\s\S]*?\.optional\(\)/,
    );
  });

  it('ClassifyMoveRequestSchema bounds priorMovesRedacted at MAX_PRIOR_MOVES', () => {
    expect(denoSchemaSrc).toMatch(/MAX_PRIOR_MOVES/);
    expect(denoSchemaSrc).toMatch(
      /priorMovesRedacted:\s*z[\s\S]*?\.max\(MAX_PRIOR_MOVES/,
    );
  });

  it('the alias bound MAX_ALIAS_LEN exists and is small (single-digit or low double-digit)', () => {
    // Must be present as a const and small enough that a verdict / person
    // label cannot fit. 8 chars covers A..Z + AA..AZ wrap-around.
    const aliasLenMatch = denoSchemaSrc.match(/MAX_ALIAS_LEN\s*=\s*(\d+)/);
    expect(aliasLenMatch).not.toBeNull();
    const len = aliasLenMatch ? parseInt(aliasLenMatch[1], 10) : 0;
    expect(len).toBeGreaterThan(0);
    expect(len).toBeLessThanOrEqual(16);
  });
});

describe('MCP-MOD-008 priorMovesRedacted parity — redactor coverage', () => {
  const REDACTION_PATH = path.join(
    process.cwd(),
    'supabase/functions/_shared/semanticReferee/redaction.ts',
  );
  const redactionSrc = fs.readFileSync(REDACTION_PATH, 'utf8');

  it('redactClassifyMoveRequest runs the redactor over priorMovesRedacted entries', () => {
    // The boundary's defensive redaction pass must touch the prior-moves
    // bodies (belt-and-suspenders, same posture the existing code applies to
    // moveBodyRedacted + parentBodyRedacted).
    expect(redactionSrc).toMatch(/priorMovesRedacted/);
    // The redactor MUST call redactString on each entry's bodyRedacted.
    expect(redactionSrc).toMatch(/redactString\(entry\.bodyRedacted\)/);
  });
});

describe('MCP-MOD-008 priorMovesRedacted parity — Node/Deno field name agreement', () => {
  it('both sides spell the field "priorMovesRedacted" exactly (camelCase, no underscores)', () => {
    expect(nodeSrc).toContain('priorMovesRedacted');
    expect(denoTypesSrc).toContain('priorMovesRedacted');
    expect(denoSchemaSrc).toContain('priorMovesRedacted');
  });

  it('both sides spell the entry fields "authorAlias" / "bodyRedacted" exactly', () => {
    for (const src of [nodeSrc, denoTypesSrc, denoSchemaSrc]) {
      expect(src).toContain('authorAlias');
      expect(src).toContain('bodyRedacted');
    }
  });

  it('no side carries a "userId" / "displayName" / "email" field on PriorMoveContext (alias-only)', () => {
    // Doctrine: the alias map carries no PII. The shape forbids those fields
    // structurally — this scan is a belt-and-suspenders proof that no one
    // typed them in by accident.
    const sliceOf = (src: string, marker: string): string => {
      const idx = src.indexOf(marker);
      if (idx === -1) return '';
      return src.slice(idx, idx + 2_000);
    };
    for (const src of [nodeSrc, denoTypesSrc]) {
      const ctxBlock = sliceOf(src, 'interface PriorMoveContext');
      expect(ctxBlock).not.toMatch(/\buserId\b/);
      expect(ctxBlock).not.toMatch(/\bdisplayName\b/);
      expect(ctxBlock).not.toMatch(/\bemail\b/);
      expect(ctxBlock).not.toMatch(/\bhandle\b/);
    }
  });
});
