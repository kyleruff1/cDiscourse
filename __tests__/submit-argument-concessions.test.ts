/**
 * QOL-041 — submit-argument concession-list / acceptance-gradient
 * contract tests.
 *
 * The Edge Function `index.ts` and its `_shared/validationSchemas.ts`
 * use Deno-style imports (`npm:zod@4`) and cannot be loaded by Jest, so
 * both their CONTRACTS are asserted by source-file inspection (the
 * `applyManualTagEdgeFunction.test.ts` pattern). Pure-payload validation
 * tests for the QOL-041 client model live in
 * `__tests__/respondToConcessionModel.test.ts`,
 * `__tests__/concessionListModel.test.ts`, and
 * `__tests__/acceptanceGradient.test.ts` — those exercise the SAME
 * 5-level vocabulary + conditional-clarification rule from pure-TS,
 * Jest-loadable code.
 *
 * Per QOL-041 design §10 test plan:
 *   - a `respond` move inserts N concession_items atomically
 *   - a `respond_to_concession` move with a missing clarification on a
 *     non-`agree` row returns `validation_failed` (a BLOCK, not a score)
 *   - a complete move inserts N concession_acceptances
 *   - only the conceded-to participant may grade
 *   - migration ↔ Zod ↔ client-model vocabulary parity
 *
 * Pure TS. No React. No Deno runtime.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ALL_ACCEPTANCE_LEVELS } from '../src/features/concessions/acceptanceGradient';
import { MAX_CONCESSION_ITEMS } from '../src/features/concessions/concessionListModel';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/submit-argument/index.ts'),
  'utf8',
);
const schemaSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/_shared/validationSchemas.ts'),
  'utf8',
);
const migrationSrc = fs.readFileSync(
  path.join(
    repoRoot,
    'supabase/migrations/20260522000012_qol_041_concession_acceptance.sql',
  ),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── validationSchemas.ts source contract ──────────────────────

describe('validationSchemas.ts — QOL-041 Zod schema source contract', () => {
  it('exports AcceptanceLevelSchema with the 5-value enum verbatim', () => {
    expect(schemaSrc).toMatch(
      /export const AcceptanceLevelSchema = z\.enum\(\[[\s\S]*?'agree'[\s\S]*?'agree_with_caveat'[\s\S]*?'disagree_framing'[\s\S]*?'disagree_context'[\s\S]*?'disagree_fact'/,
    );
  });

  it('exports ConcessionItemPayloadSchema enforcing 1..600 char text + non-negative ordinal', () => {
    expect(schemaSrc).toMatch(/export const ConcessionItemPayloadSchema/);
    expect(schemaSrc).toMatch(/z\.number\(\)\.int\(\)\.min\(0\)/);
    expect(schemaSrc).toMatch(/z\.string\(\)\.min\(1\)\.max\(600\)/);
  });

  it('exports ConcessionAcceptancePayloadSchema with the conditional clarification refine', () => {
    expect(schemaSrc).toMatch(/export const ConcessionAcceptancePayloadSchema/);
    // The .refine that enforces non-empty clarification iff non-agree.
    expect(schemaSrc).toMatch(
      /\.refine\([\s\S]*?acceptance_level === 'agree'[\s\S]*?clarification_body\.trim\(\)\.length >= 1/,
    );
  });

  it('SubmitArgumentSchema extends with optional concession arrays + a 8-item cap', () => {
    expect(schemaSrc).toMatch(/concession_items:\s*z\.array\(ConcessionItemPayloadSchema\)\.max\(8\)\.optional\(\)/);
    expect(schemaSrc).toMatch(
      /concession_acceptances:\s*z\.array\(ConcessionAcceptancePayloadSchema\)\.optional\(\)/,
    );
  });

  it('the schema 8-item cap matches the client model MAX_CONCESSION_ITEMS', () => {
    // The cap is a single source of truth — Zod max + client model
    // constant must agree.
    expect(MAX_CONCESSION_ITEMS).toBe(8);
  });
});

// ── Edge Function source-shape contract ───────────────────────

describe('submit-argument — QOL-041 contract', () => {
  it('inserts concession_items rows after the parent argument insert', () => {
    expect(fnSrc).toMatch(/from\(['"]concession_items['"]\)/);
    expect(fnSrc).toMatch(/\.insert\(itemsRows\)/);
  });

  it('inserts concession_acceptances rows after the parent argument insert', () => {
    expect(fnSrc).toMatch(/from\(['"]concession_acceptances['"]\)/);
    expect(fnSrc).toMatch(/\.insert\(acceptanceRows\)/);
  });

  it('soft-rolls-back the parent argument on a child-insert failure (atomic move)', () => {
    // The Edge Function uses status='deleted' as the closest atomic
    // approximation since supabase-js cannot wrap multi-statement
    // transactions. The soft-rollback appears next to every child
    // insert site.
    const rollbackOccurrences = (fnSrc.match(/status: 'deleted'/g) || []).length;
    expect(rollbackOccurrences).toBeGreaterThanOrEqual(3);
  });

  it('rejects a concession without a parent (a concession needs a node to concede TO)', () => {
    expect(fnSrc).toMatch(/concession_requires_parent/);
  });

  it('rejects an acceptance whose concession_item is unknown / wrong-debate', () => {
    expect(fnSrc).toMatch(/concession_item_unknown/);
    expect(fnSrc).toMatch(/concession_item_wrong_debate/);
  });

  it('rejects an acceptance posted by anyone OTHER than the conceded-to author', () => {
    // The function looks up the conceded-to node's author for every
    // concession_item being graded, then forbids the post if any does
    // not match the caller.
    expect(fnSrc).toMatch(/notReceiver/);
    expect(fnSrc).toMatch(
      /Only the participant the concession was made to may grade it/,
    );
  });

  it('returns validation_failed (a BLOCK, not a score) when clarification missing on non-agree', () => {
    expect(fnSrc).toMatch(/clarification_required_unless_agree/);
    expect(fnSrc).toMatch(/Explain why you disagree on each point/);
  });

  it('never imports any point-standing / scoring module', () => {
    // The concession-row inserts NEVER touch standing. Doctrine: QOL-041
    // stores LEVEL + CLARIFICATION only. Strip comments so doctrine
    // comments naming the avoided modules do not register as real
    // imports.
    const code = stripComments(fnSrc);
    expect(code).not.toMatch(/from\s+['"][^'"]*pointStanding/);
    expect(code).not.toMatch(/PointStandingDelta/);
    expect(code).not.toMatch(/gradeRepair/);
    expect(code).not.toMatch(/gradeChallenge/);
  });

  it('still uses createCallerClient for authz and createServiceClient for the insert', () => {
    expect(fnSrc).toMatch(/createCallerClient/);
    expect(fnSrc).toMatch(/createServiceClient/);
  });

  it('never logs the Authorization header or any key', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*SERVICE_ROLE/i);
  });
});

// ── Migration ↔ Zod ↔ client-model parity ─────────────────────

describe('parity — the 5-level enum is a single source of truth', () => {
  it('every level appears in the migration CHECK', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(migrationSrc).toContain(`'${level}'`);
    }
  });

  it('every level appears in the validationSchemas.ts AcceptanceLevelSchema', () => {
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(schemaSrc).toContain(`'${level}'`);
    }
  });

  it('the migration carries the clarification_required_unless_agree CHECK', () => {
    expect(migrationSrc).toMatch(/clarification_required_unless_agree/);
    expect(migrationSrc).toMatch(/char_length\(trim\(clarification_body\)\) >= 1/);
  });

  it('the migration soft-deletes only — no `for delete` policy on any QOL-041 table', () => {
    // Strip comments so the doctrine notes ("Soft-delete only; rows are
    // never hard-deleted") do not register as `for delete` usages.
    const stripped = migrationSrc
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^--[^\n]*$/gm, ' ');
    expect(stripped.match(/for delete/gi)).toBeNull();
  });

  it('the move_reactions.kind CHECK contains EXACTLY ONE value (`fist_bump`)', () => {
    expect(migrationSrc).toMatch(/check \(kind in \('fist_bump'\)\)/);
    // Defensive — no second value smuggled in via additional CHECK statements
    // by scanning for likely vote-tally tokens in the migration body.
    expect(migrationSrc).not.toMatch(/'upvote'/);
    expect(migrationSrc).not.toMatch(/'thumbs_up'/);
    expect(migrationSrc).not.toMatch(/'like'/);
    expect(migrationSrc).not.toMatch(/'downvote'/);
  });

  it('the migration sets RLS on all three QOL-041 tables', () => {
    expect(migrationSrc).toMatch(
      /alter table public\.concession_items enable row level security/,
    );
    expect(migrationSrc).toMatch(
      /alter table public\.concession_acceptances enable row level security/,
    );
    expect(migrationSrc).toMatch(
      /alter table public\.move_reactions enable row level security/,
    );
  });

  it('the migration stores NO standing / score column anywhere (doctrine)', () => {
    // QOL-041 stores LEVEL + CLARIFICATION only. The grep below is a
    // structural guard against accidentally introducing a numeric
    // standing column. Doctrine comments + COMMENT-ON-TABLE strings
    // legitimately *mention* these tokens to call out their absence,
    // so we scan CODE only. Walk the source line-by-line, drop
    // `--`-comment lines entirely, and collapse any SQL string literal
    // on a code line. Doing string-stripping AFTER line-stripping is
    // important — a stray `'s` inside a comment otherwise looks like
    // the open of a multi-line literal.
    const lines = migrationSrc.split('\n');
    const codeOnly = lines
      .map((l) => {
        const trimmed = l.trim();
        if (trimmed.startsWith('--')) return '';
        // Collapse all single-quoted SQL literals on this code line.
        return l.replace(/'(?:[^']|'')*'/g, "''");
      })
      .join('\n');
    expect(codeOnly).not.toMatch(/standing/i);
    expect(codeOnly).not.toMatch(/\bscore\b/i);
    expect(codeOnly).not.toMatch(/\bweight\b/i);
    expect(codeOnly).not.toMatch(/\bdelta\b/i);
  });
});
