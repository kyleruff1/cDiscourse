/**
 * ADMIN-CONV-INACTIVE-001 — THE CASCADE: RLS scan of the arguments SELECT
 * successor in this card's migration.
 *
 * The cascade is enforced entirely in RLS: the arguments SELECT successor ANDs
 * `NOT public.is_debate_inactive(debate_id)` into EVERY non-admin arm, on top
 * of the preserved per-argument `inactive_at IS NULL` gate from #480. Both
 * gates compose with AND; the admin/moderator arm has neither.
 *
 * This is a textual scan (no Docker harness in CI) — the migration text is the
 * single chokepoint contract.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260606000001_admin_conv_inactive_001_debate_inactive_state.sql',
);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

/** Extract the CREATE POLICY ... ON public.arguments ... ; block. */
function argumentsSelectPolicyBody(): string {
  const m = migrationText.match(
    /CREATE\s+POLICY\s+"arguments:[^"]*"\s+ON\s+public\.arguments[\s\S]*?\)\s*;/i,
  );
  return m ? m[0] : '';
}

describe('ADMIN-CONV-INACTIVE-001 — arguments SELECT successor presence', () => {
  it('creates the cascade successor policy with the canonical name', () => {
    expect(migrationText).toContain(
      'CREATE POLICY "arguments: select active for own/participant/public; active debate; admins read all"',
    );
  });

  it('drops the #480 arguments SELECT policy IF EXISTS (no orphaned policy)', () => {
    expect(migrationText).toContain(
      'DROP POLICY IF EXISTS "arguments: select active for own/participant/public; admins read all"',
    );
  });
});

describe('ADMIN-CONV-INACTIVE-001 — every non-admin arm ANDs BOTH gates', () => {
  it('the arguments policy body references the negated is_debate_inactive cascade gate', () => {
    const body = argumentsSelectPolicyBody();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/NOT\s+public\.is_debate_inactive\(debate_id\)/i);
  });

  it('preserves the per-argument inactive_at IS NULL gate alongside the cascade gate', () => {
    const body = argumentsSelectPolicyBody();
    // author-own arm: inactive_at IS NULL AND NOT is_debate_inactive(...)
    expect(body).toMatch(
      /author_id\s*=\s*auth\.uid\(\)[\s\S]{0,120}inactive_at\s+IS\s+NULL[\s\S]{0,120}NOT\s+public\.is_debate_inactive\(debate_id\)/i,
    );
    // posted-public/participant arm: inactive_at IS NULL AND NOT is_debate_inactive(...)
    expect(body).toMatch(
      /status\s*=\s*'posted'[\s\S]{0,160}inactive_at\s+IS\s+NULL[\s\S]{0,160}NOT\s+public\.is_debate_inactive\(debate_id\)/i,
    );
  });

  it('counts at least two negated cascade gates (one per non-admin arm)', () => {
    const body = argumentsSelectPolicyBody();
    const matches = body.match(/NOT\s+public\.is_debate_inactive\(debate_id\)/gi) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ADMIN-CONV-INACTIVE-001 — admin arm is exempt from the cascade', () => {
  it('the admin/moderator arm is present and is the only arm without the cascade gate', () => {
    const body = argumentsSelectPolicyBody();
    expect(body).toMatch(/is_moderator_or_admin\(\)/i);
    // The admin arm appears on its own (first) line, with no AND inactive_at
    // and no is_debate_inactive on the same line.
    const adminArmLine = body
      .split('\n')
      .find((l) => /is_moderator_or_admin\(\)/.test(l) && !/OR\s*\(/.test(l));
    expect(adminArmLine).toBeDefined();
    expect(adminArmLine).not.toMatch(/inactive_at/i);
    expect(adminArmLine).not.toMatch(/is_debate_inactive/i);
  });
});
