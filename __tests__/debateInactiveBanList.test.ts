/**
 * ADMIN-CONV-INACTIVE-001 — Ban-list scan + FK-pinning regression guard +
 * Edge-handler leakage source-scan.
 *
 * 1. Ban-list: the card uses the lifecycle verb pair "inactive/active"; no new
 *    code authored by this card may use the banned erasure verbs
 *    (delete/remove/archive/clean slate — case-sensitive so SQL referential
 *    actions like `ON DELETE SET NULL` / `FOR DELETE` are not flagged) or any
 *    verdict token. Scanned over the strictly-new files this card created.
 *
 * 2. FK-pinning regression (OPS-ADMIN-ARGS-PROFILES-EMBED-001 lesson applied
 *    debate-side): after this card's migration, `public.debates` has TWO FKs to
 *    `public.profiles`. The new loader MUST pin `profiles!debates_created_by_fkey`
 *    and never use a bare `profiles(...)` embed (PostgREST rejects it). It must
 *    NOT embed the inactivator's profile (`inactive_by`).
 *
 * 3. Edge-handler leakage: the new admin-users handler functions must never
 *    console.log the reason / title / resolution / Authorization / body.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

// Files strictly NEW to this card, scanned IN FULL for the banned-VERB regex.
// AdminDebatesTab.tsx is intentionally EXCLUDED from the banned-verb scan: it
// uses the JavaScript `Set.prototype.delete()` API (`next.delete(id)`) which is
// language syntax, not product copy — the exact reason the #480 ban-list test
// excluded its tab. The tab's user-facing PRODUCT copy (Inactive / Active /
// Mark inactive / etc.) is guarded by AdminDebatesTab.test.tsx and is verified
// verdict-clean below.
const BANNED_VERB_FILES: string[] = [
  'supabase/migrations/20260606000001_admin_conv_inactive_001_debate_inactive_state.sql',
  'supabase/functions/_shared/adminDebateInactiveSchemas.ts',
  'src/features/admin/adminDebatesInactiveApi.ts',
  'src/features/admin/adminDebatesApi.ts',
  'src/features/admin/adminDebateRowView.ts',
];

// All new files (incl. the tab) are scanned for verdict tokens — there is no
// JS-API false-positive class for verdict words.
const VERDICT_SCAN_FILES: string[] = [
  ...BANNED_VERB_FILES,
  'src/features/admin/AdminDebatesTab.tsx',
];

// Case-sensitive: SQL referential actions / policy-type clauses are upper-case
// PostgreSQL syntax, not product language. The PRODUCT lifecycle verb is always
// lower-case, so this precisely separates SQL syntax from product copy.
const BANNED_RE =
  /\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b/g;

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

describe('ADMIN-CONV-INACTIVE-001 — banned vocabulary scan (new files)', () => {
  for (const rel of BANNED_VERB_FILES) {
    const abs = join(ROOT, rel);
    describe(rel, () => {
      it('exists on disk', () => {
        expect(existsSync(abs)).toBe(true);
      });
      it('contains zero matches for the banned vocabulary regex', () => {
        const text = readFileSync(abs, 'utf8');
        const matches = text.match(BANNED_RE);
        expect(matches ?? []).toEqual([]);
      });
    });
  }
});

describe('ADMIN-CONV-INACTIVE-001 — verdict-token scan (new files, incl. tab)', () => {
  for (const rel of VERDICT_SCAN_FILES) {
    const abs = join(ROOT, rel);
    const text = existsSync(abs) ? readFileSync(abs, 'utf8').toLowerCase() : '';
    for (const t of VERDICT_TOKENS) {
      it(`${rel} does not contain the verdict token "${t}"`, () => {
        expect(text).not.toContain(t);
      });
    }
  }
});

describe('ADMIN-CONV-INACTIVE-001 — debates<->profiles FK-pinning regression', () => {
  const loader = readFileSync(
    join(ROOT, 'src/features/admin/adminDebatesApi.ts'),
    'utf8',
  );

  it('pins the creator FK in the profiles embed', () => {
    // `debates` has two FKs to `profiles` (created_by + inactive_by from this
    // card); the embed must be pinned to the creator FK.
    expect(loader).toContain('profiles!debates_created_by_fkey(display_name)');
  });

  it('never uses the bare ambiguous profiles(...) embed', () => {
    // The pinned form contains `profiles!...` so it does NOT match this bare
    // substring — the assertion is precise.
    expect(loader).not.toContain('profiles(display_name)');
  });

  it('never embeds the inactivator profile (inactive_by) — §10a who-inactivated leak', () => {
    expect(loader).not.toContain('profiles!debates_inactive_by_fkey');
  });

  it('the JSON key stays `profiles`, so the mapper read is unchanged', () => {
    expect(loader).toContain('asDisplayName(r.profiles)');
  });
});

describe('ADMIN-CONV-INACTIVE-001 — Edge handler leakage source-scan', () => {
  const handler = readFileSync(
    join(ROOT, 'supabase/functions/admin-users/index.ts'),
    'utf8',
  );

  // Isolate the debate-inactive handler region authored by this card so the
  // scan does not touch pre-existing handlers.
  function debateInactiveRegion(): string {
    const start = handler.indexOf('ADMIN-CONV-INACTIVE-001');
    expect(start).toBeGreaterThanOrEqual(0);
    return handler.slice(start);
  }

  it('never console.log/console.error the reason / title / resolution / Authorization / body', () => {
    const region = debateInactiveRegion();
    // The only console call in the region is the named audit-write-failure
    // (logs the error message only, never the reason/title/body).
    const consoleCalls = region.match(/console\.(log|error|info|warn)\([^)]*\)/g) ?? [];
    for (const call of consoleCalls) {
      expect(call).not.toMatch(/\b(reason|title|resolution|Authorization|body)\b/);
    }
  });

  it('the response never echoes another row\'s inactive_reason (per-id shape only)', () => {
    const region = debateInactiveRegion();
    // The PerIdDebateInactiveResult shape is {debateId, ok, errorCode?}. The
    // handler must not place a `reason` key into the returned per-id result.
    expect(region).not.toMatch(/return\s+\{\s*debateId[^}]*reason/);
  });

  it('stamps inactive_at server-side (never trusts a client timestamp)', () => {
    const region = debateInactiveRegion();
    expect(region).toMatch(/inactive\s*\?\s*new Date\(\)\.toISOString\(\)\s*:\s*null/);
  });
});
