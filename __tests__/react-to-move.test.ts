/**
 * QOL-041 — react-to-move Edge Function contract tests.
 *
 * The Edge Function `index.ts` uses Deno-style imports and cannot be
 * loaded by Jest, so its CONTRACT is asserted by source-file inspection
 * (the `applyManualTagEdgeFunction.test.ts` pattern).
 *
 * Per QOL-041 design §10 test plan:
 *   - JWT required
 *   - caller-scoped to reactor_id
 *   - idempotent re-bump returns `ok`
 *   - own-move reaction rejected
 *   - the function imports no AI / model client
 *   - the function touches NO standing path
 *
 * Pure TS. No React. No Deno runtime.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/react-to-move/index.ts'),
  'utf8',
);
const configTomlSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/config.toml'),
  'utf8',
);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Method gate + CORS ────────────────────────────────────────

describe('react-to-move — request boundary', () => {
  it('handles CORS preflight and rejects non-POST', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/methodNotAllowed\(\)/);
  });

  it('requires JWT via the authorization header', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]authorization['"]\)/);
    expect(fnSrc).toMatch(/unauthorized\(\)/);
  });

  it('config.toml registers the function with verify_jwt = true', () => {
    expect(configTomlSrc).toMatch(/\[functions\.react-to-move\][\s\S]*?verify_jwt = true/);
  });
});

// ── Validation ────────────────────────────────────────────────

describe('react-to-move — validation', () => {
  it('rejects an invalid action ("add" / "remove" only)', () => {
    expect(fnSrc).toMatch(/body\.action !== 'add' && body\.action !== 'remove'/);
    expect(fnSrc).toMatch(/'invalid_action'/);
  });

  it('rejects malformed UUIDs', () => {
    expect(fnSrc).toMatch(/badRequest\('debateId_and_argumentId_required'\)/);
    expect(fnSrc).toMatch(/isUuid/);
  });

  it('enforces the single-value kind enum (`fist_bump`)', () => {
    // The ALLOWED_KINDS set + DEFAULT_KIND constant make the
    // restriction structural; an unknown kind returns `invalid_kind`.
    expect(fnSrc).toMatch(/ALLOWED_KINDS/);
    expect(fnSrc).toMatch(/DEFAULT_KIND/);
    expect(fnSrc).toMatch(/'invalid_kind'/);
    // The CHECK constraint mirror — the migration also restricts to
    // 'fist_bump'.
    expect(fnSrc).toContain("'fist_bump'");
  });
});

// ── Authorization ─────────────────────────────────────────────

describe('react-to-move — authorization', () => {
  it('uses the caller-scoped client for the argument lookup and writes', () => {
    expect(fnSrc).toMatch(/createCallerClient\(auth\)/);
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]arguments['"]\)/);
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]move_reactions['"]\)/);
  });

  it('REJECTS self-fist-bump (own-bubble guard — QOL-041 §8)', () => {
    expect(fnSrc).toMatch(/argRow\.author_id === reactorId/);
    expect(fnSrc).toMatch(/forbidden\('cannot_react_to_own_move'\)/);
  });

  it('treats an invisible argument as forbidden (no existence leak)', () => {
    expect(fnSrc).toMatch(/forbidden\('argument_not_visible'\)/);
  });

  it('rejects a debate/argument mismatch and a deleted argument', () => {
    expect(fnSrc).toMatch(/badRequest\('debate_argument_mismatch'\)/);
    expect(fnSrc).toMatch(/badRequest\('argument_deleted'\)/);
  });
});

// ── Mutation (idempotent) ─────────────────────────────────────

describe('react-to-move — idempotent mutation', () => {
  it('treats a duplicate add (23505) as idempotent success', () => {
    expect(fnSrc).toMatch(/insertErr\.code !== '23505'/);
  });

  it('soft-deletes on remove (sets removed_at)', () => {
    expect(fnSrc).toMatch(/removed_at:\s*new Date\(\)\.toISOString\(\)/);
  });

  it('re-activates a previously soft-deleted row on a re-add (toggle on)', () => {
    expect(fnSrc).toMatch(/Re-activate/);
    expect(fnSrc).toMatch(
      /\.update\(\{\s*removed_at: null,\s*removed_by: null\s*\}\)/,
    );
  });

  it('never hard-deletes move_reactions (no .delete() call)', () => {
    expect(fnSrc).not.toMatch(/from\(['"]move_reactions['"]\)[\s\S]*?\.delete\(/);
  });
});

// ── Doctrine — no score, no standing, no AI ───────────────────

describe('react-to-move — doctrine guards', () => {
  it('returns the render-only summary { fistBumpCount, viewerHasReacted } — no score field', () => {
    // The shape of the response: argumentId + summary + activeReactions.
    expect(fnSrc).toMatch(/summary:\s*\{\s*fistBumpCount,\s*viewerHasReacted\s*\}/);
  });

  it('never imports any point-standing module', () => {
    // Strip comments so the doctrine notes ("imports nothing from
    // _shared/pointStanding/ — no such import exists") do not register
    // as an actual import. The same hazard the QOL-030 oneBoxCopyBanList
    // test calls out for boxModel.ts.
    const code = stripComments(fnSrc);
    // Real-import scan: only `from '..._shared/pointStanding...'`
    expect(code).not.toMatch(/from\s+['"][^'"]*pointStanding/);
    expect(code).not.toMatch(/PointStandingDelta/);
    expect(code).not.toMatch(/gradeRepair/);
    expect(code).not.toMatch(/gradeChallenge/);
  });

  it('never touches public.arguments writes (no .insert / .update / .delete on arguments)', () => {
    const code = stripComments(fnSrc);
    expect(code).not.toMatch(
      /from\(['"]arguments['"]\)\s*\.\s*insert\(/,
    );
    expect(code).not.toMatch(
      /from\(['"]arguments['"]\)\s*\.\s*update\(/,
    );
    expect(code).not.toMatch(
      /from\(['"]arguments['"]\)\s*\.\s*delete\(/,
    );
  });

  it('makes NO AI / external-provider call', () => {
    expect(fnSrc).not.toMatch(/anthropic/i);
    expect(fnSrc).not.toMatch(/api\.x\.ai/i);
    expect(fnSrc).not.toMatch(/openai/i);
    // No fetch() to any external endpoint either — there is exactly
    // ZERO fetch() call in this function.
    expect(stripComments(fnSrc)).not.toMatch(/\bfetch\(/);
  });

  it('never logs the Authorization header or any key', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*SERVICE_ROLE/i);
  });

  it('uses the service-role client ONLY for the best-effort audit row', () => {
    const svcMatches = fnSrc.match(/createServiceClient\(\)/g) || [];
    expect(svcMatches).toHaveLength(1);
    expect(fnSrc).toMatch(/admin_audit_events/);
    expect(fnSrc).toMatch(/catch\b/);
  });
});
