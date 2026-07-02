/**
 * PRIVATE-GROUPS-002 (#859) — circle visibility composition RLS scan (THE ANCHOR).
 *
 * The load-bearing safety property: is_argument_visible_in_circle must
 * COMPOSE with the COV-004 canonical is_argument_visible (by CALL, never
 * inlined-and-diverged), and its circle arm must require visibility='private'
 * AND circle membership. If a future implementer inlines the COV-004 arms and
 * then edits one copy, the two diverge silently and a private room could leak.
 * This test is the alarm bell.
 *
 * It also EXTENDS the COV-004 drift detector: if is_argument_visible changes
 * without a coordinated edit to the circle helper, this fails with an explicit
 * lockstep message.
 *
 * Pure fs.readFileSync — no Docker / Supabase harness.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CIRCLE_MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260702000001_private_groups_002_circles.sql',
);

const COV_004_MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260630000001_cov_004_argument_visibility_helper.sql',
);

let circleText = '';
let cov004Text = '';

beforeAll(() => {
  circleText = readFileSync(CIRCLE_MIGRATION_PATH, 'utf8');
  cov004Text = readFileSync(COV_004_MIGRATION_PATH, 'utf8');
});

/** Extract the is_argument_visible_in_circle helper body. */
function circleVisibilityHelperBody(): string {
  const m = circleText.match(
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_argument_visible_in_circle[\s\S]*?\$\$;/i,
  );
  return m ? m[0] : '';
}

describe('PRIVATE-GROUPS-002 — file presence', () => {
  it('both migrations exist at their locked paths', () => {
    expect(existsSync(CIRCLE_MIGRATION_PATH)).toBe(true);
    expect(existsSync(COV_004_MIGRATION_PATH)).toBe(true);
    expect(circleText.length).toBeGreaterThan(0);
  });
});

describe('PRIVATE-GROUPS-002 — the composition anchor (is_argument_visible by CALL, never inlined)', () => {
  it('the circle helper body BEGINS with a call to public.is_argument_visible(arg_id, viewer_id)', () => {
    const body = circleVisibilityHelperBody();
    expect(body.length).toBeGreaterThan(0);
    // Strip the CREATE ... AS $$ preamble; the first executable expression in
    // the body must be the is_argument_visible call (the "select" then the
    // call). We assert the call appears BEFORE the circle-arm EXISTS.
    const callIdx = body.search(/public\.is_argument_visible\(\s*arg_id\s*,\s*viewer_id\s*\)/i);
    const circleArmIdx = body.search(/or\s+exists\s*\(/i);
    expect(callIdx).toBeGreaterThan(-1);
    expect(circleArmIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeLessThan(circleArmIdx);
  });

  it('the canonical arms are NOT re-inlined (no is_moderator_or_admin / author_id arm copied into the circle helper)', () => {
    const body = circleVisibilityHelperBody();
    // The COV-004 arms (is_moderator_or_admin, a.author_id = viewer_id,
    // is_debate_open_or_locked_public) must be reached via the CALL, never
    // copied into this helper. If any appears here, the two have been
    // inlined-and-can-diverge.
    expect(body).not.toMatch(/is_moderator_or_admin/i);
    expect(body).not.toMatch(/a\.author_id\s*=\s*viewer_id/i);
    expect(body).not.toMatch(/is_debate_open_or_locked_public/i);
  });

  it('the circle arm requires d.visibility = private AND is_circle_member', () => {
    const body = circleVisibilityHelperBody();
    expect(body).toMatch(/d\.circle_id is not null/i);
    expect(body).toMatch(/d\.visibility = 'private'/i);
    expect(body).toMatch(/public\.is_circle_member\(d\.circle_id, viewer_id\)/i);
  });

  it('the circle arm mirrors the COV-004 inactive predicates (posted / inactive_at / is_debate_inactive)', () => {
    const body = circleVisibilityHelperBody();
    expect(body).toMatch(/a\.status = 'posted'/i);
    expect(body).toMatch(/a\.inactive_at is null/i);
    expect(body).toMatch(/not public\.is_debate_inactive\(a\.debate_id\)/i);
  });
});

describe('PRIVATE-GROUPS-002 — COV-004 drift detector (extends concessionAccessibilityRlsScan)', () => {
  it('the COV-004 is_argument_visible signature is unchanged (the call target still exists)', () => {
    const driftMsg =
      'The COV-004 is_argument_visible signature changed without a coordinated edit to public.is_argument_visible_in_circle. Update the circle helper in a new migration AND update this test, in LOCKSTEP — a divergence can leak a private room.';
    if (
      !cov004Text.match(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.is_argument_visible\s*\(\s*arg_id\s+uuid\s*,\s*viewer_id\s+uuid\s*\)\s*RETURNS\s+boolean/i,
      )
    ) {
      throw new Error(driftMsg);
    }
    // And the circle helper must still call it with the same arg names.
    const body = circleVisibilityHelperBody();
    if (!body.match(/public\.is_argument_visible\(\s*arg_id\s*,\s*viewer_id\s*\)/i)) {
      throw new Error(driftMsg);
    }
  });

  it('the circle helper carries the LOCKSTEP comment so the coupling is documented', () => {
    expect(circleText).toMatch(/LOCKSTEP/i);
  });
});
