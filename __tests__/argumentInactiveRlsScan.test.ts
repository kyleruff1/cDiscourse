/**
 * ADMIN-ARGS-INACTIVE-001 — RLS scan: every non-admin SELECT policy on
 * `public.arguments` includes `inactive_at IS NULL` after this card's
 * migration applies, OR the policy arm is the admin/moderator unrestricted
 * arm (which is intentionally exempt).
 *
 * ADMIN-CONV-INACTIVE-001 (#502) renames the canonical arguments SELECT
 * policy from #480's
 *   "arguments: select active for own/participant/public; admins read all"
 * to the cascade successor
 *   "arguments: select active for own/participant/public; active debate; admins read all"
 * (it ADDs the `NOT is_debate_inactive(debate_id)` cascade gate alongside the
 * preserved per-argument `inactive_at IS NULL` gate). The canonical-name
 * assertions below were UPDATED to the new successor name + migration so the
 * guard stays GREEN and keeps tracking the live chokepoint (it is not relaxed
 * or deleted — the inactive_at + drop-by-name guarantees still hold).
 *
 * The scan reads:
 *   - The #480 SELECT policy name (which is DROPped IF EXISTS by #502).
 *   - The #502 NEW SELECT policy (which is the canonical successor).
 *
 * Failure mode: a future migration adds a non-admin SELECT policy on
 * `public.arguments` without the inactive_at predicate.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIG_DIR = join(__dirname, '..', 'supabase', 'migrations');
// ADMIN-CONV-INACTIVE-001 (#502) — the canonical arguments SELECT policy now
// lives in the conversation-inactive cascade migration (it DROP+CREATEs the
// #480 policy to ADD the cascade gate). The guard tracks the live chokepoint.
const THIS_CARD_MIG = '20260606000001_admin_conv_inactive_001_debate_inactive_state.sql';
// #480's migration — still the authoritative source for the per-argument
// columns/audit; its arguments SELECT policy is superseded (renamed) by #502.
const ARGS_INACTIVE_MIG = '20260604000001_admin_args_inactive_001_argument_inactive_state.sql';

describe('ADMIN-ARGS-INACTIVE-001 — RLS successor policy presence', () => {
  it("the canonical migration creates the successor policy with the canonical (#502 cascade) name", () => {
    const text = readFileSync(join(MIG_DIR, THIS_CARD_MIG), 'utf8');
    expect(text).toContain(
      'CREATE POLICY "arguments: select active for own/participant/public; active debate; admins read all"',
    );
  });

  it('the successor policy USING clause contains inactive_at IS NULL', () => {
    const text = readFileSync(join(MIG_DIR, THIS_CARD_MIG), 'utf8');
    expect(text).toMatch(/inactive_at\s+IS\s+NULL/i);
  });

  it("the #502 migration drops the #480 arguments SELECT policy by exact name", () => {
    const text = readFileSync(join(MIG_DIR, THIS_CARD_MIG), 'utf8');
    expect(text).toContain(
      'DROP POLICY IF EXISTS "arguments: select active for own/participant/public; admins read all"',
    );
  });

  it("the #480 migration still defines the per-argument inactive columns + audit (source of truth)", () => {
    const text = readFileSync(join(MIG_DIR, ARGS_INACTIVE_MIG), 'utf8');
    // #480 remains the authoritative source for the per-argument inactive
    // primitive; #502 only renames its SELECT policy to add the cascade.
    expect(text).toContain('public.argument_inactive_audit');
    expect(text).toMatch(/inactive_at\s+IS\s+NULL/i);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — no later migration re-introduces a leaky SELECT policy', () => {
  it('no migration file dated AFTER this card adds a public.arguments SELECT policy without inactive_at', () => {
    const files = readdirSync(MIG_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const thisIdx = files.indexOf(THIS_CARD_MIG);
    expect(thisIdx).toBeGreaterThanOrEqual(0);
    const later = files.slice(thisIdx + 1);
    for (const f of later) {
      const text = readFileSync(join(MIG_DIR, f), 'utf8');
      // Find every `CREATE POLICY` clause that targets public.arguments
      // FOR SELECT. If any exists and lacks `inactive_at IS NULL` AND lacks
      // the moderator/admin arm name, flag it.
      const policyRe = /CREATE\s+POLICY[^;]*public\.arguments[^;]*FOR\s+SELECT[^;]*/gi;
      const matches = text.match(policyRe) ?? [];
      for (const m of matches) {
        const hasInactivePredicate = /inactive_at\s+IS\s+NULL/i.test(m);
        const hasAdminArm = /is_moderator_or_admin|is_admin/i.test(m);
        // Either the policy gates non-admin arms with inactive_at IS NULL,
        // or it is an admin-only policy (with is_admin / is_moderator_or_admin).
        if (!hasInactivePredicate && !hasAdminArm) {
          throw new Error(
            `Migration ${f} adds a non-admin public.arguments SELECT policy without inactive_at IS NULL. Snippet:\n${m}`,
          );
        }
      }
    }
    // Pass through if no future migration was found.
    expect(true).toBe(true);
  });
});

describe('ADMIN-ARGS-INACTIVE-001 — client-side SQL loaders gate on inactive_at IS NULL', () => {
  it('argumentsApi.ts list functions all include .is("inactive_at", null)', () => {
    const text = readFileSync(
      join(__dirname, '..', 'src', 'features', 'arguments', 'argumentsApi.ts'),
      'utf8',
    );
    // The four list functions each include one .is('inactive_at', null) call.
    const matches = text.match(/\.is\('inactive_at',\s*null\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('crossRoom/argumentRoomLinksApi.ts loadPriorRoomContext filters on inactive_at', () => {
    const text = readFileSync(
      join(
        __dirname,
        '..',
        'src',
        'features',
        'arguments',
        'crossRoom',
        'argumentRoomLinksApi.ts',
      ),
      'utf8',
    );
    expect(text).toMatch(/\.is\('inactive_at',\s*null\)/);
  });
});
