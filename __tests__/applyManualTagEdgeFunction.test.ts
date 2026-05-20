/**
 * META-1A — apply-manual-tag Edge Function contract + eligibility tests.
 *
 * The Edge Function `index.ts` uses Deno-style imports and cannot be loaded
 * by Jest, so its CONTRACT is asserted by source-file inspection (the
 * `argumentDeletionRequest.test.ts` pattern). The eligibility LOGIC is the
 * pure `isApplyAllowed` from the `_shared/pointTagEligibility.ts` mirror —
 * that file has no Deno-runtime imports, so it is loaded and EXECUTED here
 * directly over the full 80-case matrix.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  isApplyAllowed,
  ALL_MANUAL_TAG_CODES,
  MANUAL_TAG_ELIGIBILITY_TABLE,
  type ManualTagActorRole,
  type ManualTagCode,
} from '../supabase/functions/_shared/pointTagEligibility';
import { _forbiddenMetadataTokens } from '../src/features/metadata/moveMetadataLedger';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/apply-manual-tag/index.ts'),
  'utf8',
);
const mirrorSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/_shared/pointTagEligibility.ts'),
  'utf8',
);

// ── Eligibility matrix — 80 cases, executed ───────────────────

describe('isApplyAllowed — 80-case eligibility matrix (executed)', () => {
  const roles: ManualTagActorRole[] = [
    'participant_affirmative',
    'participant_negative',
    'observer',
    'admin',
  ];
  const ownBubbleValues = [true, false];

  it('exercises all 10 codes x 4 roles x 2 own-bubble values', () => {
    let caseCount = 0;
    for (const code of ALL_MANUAL_TAG_CODES) {
      const record = MANUAL_TAG_ELIGIBILITY_TABLE[code];
      for (const role of roles) {
        for (const isOwnBubble of ownBubbleValues) {
          caseCount += 1;
          const actual = isApplyAllowed(code, {
            applierUserId: 'u1',
            applierActorRole: role,
            isOwnBubble,
          });
          let expected: boolean;
          if (role === 'observer') {
            expected = record.allowObserver;
          } else if (role === 'admin') {
            expected = record.allowAdmin;
          } else if (isOwnBubble) {
            expected = record.allowOnOwnBubble;
          } else {
            expected = record.allowOnOtherBubble;
          }
          expect(actual).toBe(expected);
        }
      }
    }
    expect(caseCount).toBe(80);
  });

  it('observers can never apply any of the 10 codes', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      for (const isOwnBubble of [true, false]) {
        expect(
          isApplyAllowed(code, { applierUserId: 'u1', applierActorRole: 'observer', isOwnBubble }),
        ).toBe(false);
      }
    }
  });

  it('admins can apply all 10 codes regardless of own-bubble', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      for (const isOwnBubble of [true, false]) {
        expect(
          isApplyAllowed(code, { applierUserId: 'u1', applierActorRole: 'admin', isOwnBubble }),
        ).toBe(true);
      }
    }
  });

  it('own-bubble allows only the 3 intent tags for participants', () => {
    const ownAllowed: ManualTagCode[] = ['concession_offered', 'narrowed_claim', 'ready_for_synthesis'];
    for (const code of ALL_MANUAL_TAG_CODES) {
      const allowed = isApplyAllowed(code, {
        applierUserId: 'u1',
        applierActorRole: 'participant_affirmative',
        isOwnBubble: true,
      });
      expect(allowed).toBe(ownAllowed.includes(code));
    }
  });

  it('other-bubble allows all 10 codes for participants', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(
        isApplyAllowed(code, {
          applierUserId: 'u1',
          applierActorRole: 'participant_negative',
          isOwnBubble: false,
        }),
      ).toBe(true);
    }
  });

  it('affirmative and negative participants are treated identically', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      for (const isOwnBubble of [true, false]) {
        const aff = isApplyAllowed(code, {
          applierUserId: 'u1',
          applierActorRole: 'participant_affirmative',
          isOwnBubble,
        });
        const neg = isApplyAllowed(code, {
          applierUserId: 'u1',
          applierActorRole: 'participant_negative',
          isOwnBubble,
        });
        expect(aff).toBe(neg);
      }
    }
  });
});

// ── Edge Function source-shape contract ───────────────────────

describe('apply-manual-tag — Edge Function contract', () => {
  it('handles CORS preflight and rejects non-POST', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/methodNotAllowed\(\)/);
  });

  it('verifies the JWT via the authorization header', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]authorization['"]\)/);
    expect(fnSrc).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('validates action, debateId/argumentId UUIDs, and tagCode', () => {
    expect(fnSrc).toMatch(/badRequest\('invalid_action'\)/);
    expect(fnSrc).toMatch(/badRequest\('debateId_and_argumentId_required'\)/);
    expect(fnSrc).toMatch(/badRequest\('invalid_tag_code'\)/);
    expect(fnSrc).toContain('isUuid');
    expect(fnSrc).toContain('isTagCode');
  });

  it('supports exactly the two actions apply and remove', () => {
    expect(fnSrc).toMatch(/body\.action !== 'apply' && body\.action !== 'remove'/);
    expect(fnSrc).toMatch(/action === 'apply'/);
    expect(fnSrc).toMatch(/'invalid_action'/);
  });

  it('uses the caller-scoped client for the argument lookup and the write', () => {
    expect(fnSrc).toMatch(/createCallerClient\(auth\)/);
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]arguments['"]\)/);
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]point_tags['"]\)/);
  });

  it('enforces eligibility server-side via the mirror', () => {
    expect(fnSrc).toMatch(/from ['"]\.\.\/_shared\/pointTagEligibility\.ts['"]/);
    expect(fnSrc).toMatch(/isApplyAllowed\(tagCode, eligibilityContext\)/);
    expect(fnSrc).toMatch(/forbidden\('not_eligible'\)/);
  });

  it('treats an invisible argument as forbidden (no existence leak)', () => {
    expect(fnSrc).toMatch(/forbidden\('argument_not_visible'\)/);
  });

  it('rejects a debate/argument mismatch and a deleted argument', () => {
    expect(fnSrc).toMatch(/badRequest\('debate_argument_mismatch'\)/);
    expect(fnSrc).toMatch(/badRequest\('argument_deleted'\)/);
  });

  it('treats a duplicate apply (23505) as idempotent success', () => {
    expect(fnSrc).toMatch(/insertErr\.code !== '23505'/);
  });

  it('soft-deletes on remove (sets removed_at) and never hard-deletes point_tags', () => {
    expect(fnSrc).toMatch(/removed_at:\s*new Date\(\)\.toISOString\(\)/);
    // No .delete() against point_tags anywhere.
    expect(fnSrc).not.toMatch(/from\(['"]point_tags['"]\)[\s\S]*?\.delete\(/);
  });

  it('lets an admin remove others tags by dropping the tagged_by filter', () => {
    expect(fnSrc).toMatch(/if \(!isAdmin\)/);
    expect(fnSrc).toMatch(/\.eq\('tagged_by', callerId\)/);
  });

  it('uses the service-role client ONLY for the best-effort audit row', () => {
    const svcMatches = fnSrc.match(/createServiceClient\(\)/g) || [];
    expect(svcMatches).toHaveLength(1);
    expect(fnSrc).toMatch(/admin_audit_events/);
    expect(fnSrc).toMatch(/catch \{ \/\* audit failure must not block the user \*\/ \}/);
  });

  it('returns the stable ok envelope with argumentId + activeTags', () => {
    expect(fnSrc).toMatch(/ok\(\{ argumentId, activeTags \}\)/);
  });

  it('never logs the Authorization header or any key', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*SERVICE_ROLE/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*auth\b/);
  });

  it('makes no AI / external-provider call', () => {
    expect(fnSrc).not.toMatch(/anthropic/i);
    expect(fnSrc).not.toMatch(/api\.x\.ai/i);
    expect(fnSrc).not.toMatch(/openai/i);
  });
});

// ── Doctrine ban-list — function + mirror ─────────────────────

/**
 * Tokens scanned as WHOLE WORDS. `true` / `false` are excluded because
 * they are TypeScript boolean literals (the eligibility table's record
 * field values) — not verdict usages. `right` / `wrong` / `block` /
 * `reject` / `prevent` / `forbid` are excluded because they are generic
 * English verbs that occur in operational prose; the META-001 client
 * model itself makes the same carve-out. Every remaining token is a hard
 * verdict / person-attribution ban.
 */
function bannedWholeWordTokens(): string[] {
  const excluded = new Set([
    'true', 'false', 'right', 'wrong', 'block', 'reject',
    'prevent', 'forbid', 'disallow', 'denied', 'verified',
  ]);
  return _forbiddenMetadataTokens().filter((t) => !excluded.has(t));
}

function containsBannedWholeWord(src: string): string | null {
  const lower = src.toLowerCase();
  for (const token of bannedWholeWordTokens()) {
    // Whole-word match: not part of a camelCase identifier (e.g. `won`
    // inside `allowOnOwnBubble`).
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) return token;
  }
  return null;
}

describe('apply-manual-tag — doctrine ban-list', () => {
  it('the Edge Function source contains no verdict / attribution tokens', () => {
    expect(containsBannedWholeWord(fnSrc)).toBeNull();
  });

  it('the mirror source contains no verdict / attribution tokens', () => {
    expect(containsBannedWholeWord(mirrorSrc)).toBeNull();
  });
});
