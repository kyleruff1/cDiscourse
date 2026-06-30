/**
 * COV-004 — argument-visibility helper RLS scan.
 *
 * Source-scan that pins the COV-004 migration shape AND detects future drift
 * between the canonical arguments SELECT policy and the new helper
 * `public.is_argument_visible(arg_id, viewer_id)` that mirrors it.
 *
 * Pattern mirrors __tests__/debateInactiveCascadeRlsScan.test.ts — pure
 * fs.readFileSync, no Docker / Supabase harness required. The migration text
 * is the single chokepoint contract.
 *
 * Addresses gap #4 (HIGH/M) of the 2026-06-30 coverage audit
 * (docs/audits/COVERAGE-AUDIT-2026-06-30.md, commit 00554af), tracking
 * issue #808.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const COV_004_MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260630000001_cov_004_argument_visibility_helper.sql',
);

const ADMIN_CONV_INACTIVE_MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260606000001_admin_conv_inactive_001_debate_inactive_state.sql',
);

/**
 * Canonical token list — these are the building blocks of the
 * arguments SELECT policy that the helper must mirror in lockstep.
 *
 * If the arguments SELECT policy's canonical arms change, BOTH this list
 * AND the helper migration must be updated together. The drift test below
 * is the alarm bell.
 */
const CANONICAL_ARGUMENTS_SELECT_TOKENS = [
  'is_moderator_or_admin()',
  "inactive_at IS NULL",
  'is_debate_inactive(debate_id)',
  "status = 'posted'",
  'is_debate_open_or_locked_public(debate_id)',
  'is_debate_participant(debate_id, auth.uid())',
] as const;

let cov004Text = '';
let canonicalMigrationText = '';

beforeAll(() => {
  cov004Text = readFileSync(COV_004_MIGRATION_PATH, 'utf8');
  canonicalMigrationText = readFileSync(ADMIN_CONV_INACTIVE_MIGRATION_PATH, 'utf8');
});

/** Extract the canonical arguments SELECT policy body from the source-of-truth migration. */
function argumentsSelectPolicyBody(): string {
  const m = canonicalMigrationText.match(
    /CREATE\s+POLICY\s+"arguments:\s*select\s+active\s+for\s+own\/participant\/public;\s+active\s+debate;\s+admins\s+read\s+all"\s+ON\s+public\.arguments[\s\S]*?\)\s*;/i,
  );
  return m ? m[0] : '';
}

/** Extract the COV-004 helper function body for `is_argument_visible`. */
function isArgumentVisibleHelperBody(): string {
  const m = cov004Text.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_argument_visible[\s\S]*?\$\$;/i,
  );
  return m ? m[0] : '';
}

describe('COV-004 — migration file presence', () => {
  it('the new migration file exists at the locked path', () => {
    expect(existsSync(COV_004_MIGRATION_PATH)).toBe(true);
    expect(cov004Text.length).toBeGreaterThan(0);
  });
});

describe('COV-004 — is_argument_visible helper signature + attributes', () => {
  it('declares the helper with the exact signature', () => {
    expect(cov004Text).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_argument_visible\s*\(\s*arg_id\s+uuid\s*,\s*viewer_id\s+uuid\s*\)\s*RETURNS\s+boolean/i,
    );
  });

  it('declares LANGUAGE sql', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/LANGUAGE\s+sql\b/i);
  });

  it('declares STABLE', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/\bSTABLE\b/i);
  });

  it('declares SECURITY DEFINER', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/\bSECURITY\s+DEFINER\b/i);
  });

  it('pins search_path = public', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/SET\s+search_path\s*=\s*public\b/i);
  });
});

describe('COV-004 — helper body mirrors the canonical arguments SELECT arms', () => {
  it('the helper body references is_moderator_or_admin()', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/public\.is_moderator_or_admin\(\)/i);
  });

  it('the helper body references a.author_id = viewer_id', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/a\.author_id\s*=\s*viewer_id/i);
  });

  it('the helper body references a.inactive_at IS NULL', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/a\.inactive_at\s+IS\s+NULL/i);
  });

  it('the helper body negates is_debate_inactive(a.debate_id)', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/NOT\s+public\.is_debate_inactive\(a\.debate_id\)/i);
  });

  it("the helper body references a.status = 'posted'", () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/a\.status\s*=\s*'posted'/i);
  });

  it('the helper body references is_debate_open_or_locked_public(a.debate_id)', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/public\.is_debate_open_or_locked_public\(a\.debate_id\)/i);
  });

  it('the helper body references is_debate_participant(a.debate_id, viewer_id)', () => {
    const body = isArgumentVisibleHelperBody();
    expect(body).toMatch(/public\.is_debate_participant\(a\.debate_id\s*,\s*viewer_id\)/i);
  });
});

describe('COV-004 — SELECT policies dropped + recreated against helper', () => {
  it('ci_select_read_access is dropped + recreated calling the helper', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+ci_select_read_access\s+ON\s+public\.concession_items\s*;/i,
    );
    expect(cov004Text).toMatch(
      /CREATE\s+POLICY\s+ci_select_read_access[\s\S]*?ON\s+public\.concession_items[\s\S]*?USING\s*\(\s*public\.is_argument_visible\(\s*argument_id\s*,\s*auth\.uid\(\)\s*\)\s*\)\s*;/i,
    );
  });

  it('ca_select_read_access is dropped + recreated calling the helper', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+ca_select_read_access\s+ON\s+public\.concession_acceptances\s*;/i,
    );
    expect(cov004Text).toMatch(
      /CREATE\s+POLICY\s+ca_select_read_access[\s\S]*?ON\s+public\.concession_acceptances[\s\S]*?USING\s*\(\s*public\.is_argument_visible\(\s*argument_id\s*,\s*auth\.uid\(\)\s*\)\s*\)\s*;/i,
    );
  });

  it('mr_select_read_access is dropped + recreated calling the helper', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+mr_select_read_access\s+ON\s+public\.move_reactions\s*;/i,
    );
    expect(cov004Text).toMatch(
      /CREATE\s+POLICY\s+mr_select_read_access[\s\S]*?ON\s+public\.move_reactions[\s\S]*?USING\s*\(\s*public\.is_argument_visible\(\s*argument_id\s*,\s*auth\.uid\(\)\s*\)\s*\)\s*;/i,
    );
  });
});

describe('COV-004 — drops target the correct three tables', () => {
  it('drops a policy on public.concession_items', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+\w+\s+ON\s+public\.concession_items\s*;/i,
    );
  });

  it('drops a policy on public.concession_acceptances', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+\w+\s+ON\s+public\.concession_acceptances\s*;/i,
    );
  });

  it('drops a policy on public.move_reactions', () => {
    expect(cov004Text).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+\w+\s+ON\s+public\.move_reactions\s*;/i,
    );
  });
});

describe('COV-004 — canonical arguments SELECT drift detector (THE ANCHOR)', () => {
  it('the canonical arguments SELECT policy body still contains every token the helper mirrors', () => {
    const body = argumentsSelectPolicyBody();
    expect(body.length).toBeGreaterThan(0);

    const driftFailureMessage =
      'The arguments SELECT canonical arms changed without a paired update to public.is_argument_visible. Update the helper in a new migration AND update this test\'s expected canonical token list.';

    for (const token of CANONICAL_ARGUMENTS_SELECT_TOKENS) {
      if (!body.includes(token)) {
        throw new Error(
          `${driftFailureMessage}\n\nMissing canonical token in arguments SELECT policy body: "${token}"`,
        );
      }
    }
  });
});

describe('COV-004 — negative: legacy bare-EXISTS shape is gone from executable SQL', () => {
  it('no executable SQL line in the new migration contains the pre-fix bare EXISTS shape', () => {
    // The exact shape we are replacing — its presence in any non-comment line
    // of the COV-004 migration would mean we forgot to remove it from one of
    // the three policy rewrites. The hazard description in the leading comment
    // block is allowed to NAME the shape; only executable SQL must be clean.
    const legacyBareExists = /exists\s*\(\s*select\s+1\s+from\s+public\.arguments\s+a\s+where\s+a\.id\s*=\s*argument_id\s*\)/i;
    const executableLines = cov004Text
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'));
    const offenders = executableLines.filter((line) => legacyBareExists.test(line));
    expect(offenders).toEqual([]);
  });
});
