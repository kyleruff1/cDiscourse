/**
 * EV-005 — annotate-evidence Edge Function contract + eligibility tests.
 *
 * The Edge Function `index.ts` uses Deno-style imports and cannot be loaded
 * by Jest, so its CONTRACT is asserted by source-file inspection (the
 * `applyManualTagEdgeFunction.test.ts` pattern). The eligibility + depth-cap
 * LOGIC is the pure code in `_shared/evidenceAnnotationEligibility.ts` —
 * that file has no Deno-runtime imports, so it is loaded and EXECUTED here
 * directly.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_EVIDENCE_ANNOTATION_KINDS,
  OWN_BUBBLE_ANNOTATION_KINDS,
  enforceAnnotationDepthCap,
  isAnnotationAllowed,
  isEvidenceAnnotationKind,
  type DepthCapAnnotation,
  type EvidenceAnnotationActorRole,
} from '../supabase/functions/_shared/evidenceAnnotationEligibility';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/annotate-evidence/index.ts'),
  'utf8',
);
const mirrorSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/_shared/evidenceAnnotationEligibility.ts'),
  'utf8',
);
const configSrc = fs.readFileSync(path.join(repoRoot, 'supabase/config.toml'), 'utf8');

// ── Eligibility matrix — executed over the shared mirror ──────

describe('isAnnotationAllowed — shared mirror, executed', () => {
  const ROLES: EvidenceAnnotationActorRole[] = [
    'participant_other_bubble',
    'participant_own_bubble',
    'observer',
    'admin',
  ];

  it('exercises all 18 kinds x 4 roles x depth {0,1}', () => {
    let cases = 0;
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      for (const role of ROLES) {
        for (const depth of [0, 1] as const) {
          cases += 1;
          const allowed = isAnnotationAllowed(kind, { actorRole: role, targetDepth: depth });
          let expected: boolean;
          if (role === 'observer') {
            expected = false;
          } else if (role === 'participant_own_bubble') {
            expected = OWN_BUBBLE_ANNOTATION_KINDS.includes(kind);
          } else {
            expected = true;
          }
          expect(allowed).toBe(expected);
        }
      }
    }
    expect(cases).toBe(18 * 4 * 2);
  });

  it('observers may never add any kind', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      expect(isAnnotationAllowed(kind, { actorRole: 'observer', targetDepth: 0 })).toBe(false);
    }
  });

  it('own-bubble allows exactly the 3 self-descriptive kinds', () => {
    expect(OWN_BUBBLE_ANNOTATION_KINDS).toHaveLength(3);
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      expect(
        isAnnotationAllowed(kind, { actorRole: 'participant_own_bubble', targetDepth: 0 }),
      ).toBe(OWN_BUBBLE_ANNOTATION_KINDS.includes(kind));
    }
  });

  it('a depth beyond {0,1} is refused for every role (depth cap)', () => {
    for (const role of ROLES) {
      for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
        expect(
          // @ts-expect-error — deliberately out-of-range depth
          isAnnotationAllowed(kind, { actorRole: role, targetDepth: 2 }),
        ).toBe(false);
      }
    }
  });

  it('isEvidenceAnnotationKind rejects an unknown kind', () => {
    expect(isEvidenceAnnotationKind('garbage')).toBe(false);
    expect(isEvidenceAnnotationKind('primary_source')).toBe(true);
  });
});

// ── Depth cap — executed over the shared mirror ───────────────

describe('enforceAnnotationDepthCap — shared mirror, executed', () => {
  function node(id: string, depth: number, parent: string | null = null): DepthCapAnnotation {
    return { id, depth, parentAnnotationId: parent };
  }

  it('accepts a depth-0 + a resolving depth-1 candidate', () => {
    const result = enforceAnnotationDepthCap([node('a0', 0), node('a1', 1, 'a0')]);
    expect(result.accepted.map((a) => a.id)).toEqual(['a0', 'a1']);
  });

  it('suppresses a depth-2 candidate', () => {
    const result = enforceAnnotationDepthCap([
      node('a0', 0),
      node('a1', 1, 'a0'),
      node('a2', 2, 'a1'),
    ]);
    expect(result.suppressed.map((a) => a.id)).toContain('a2');
    expect(result.accepted.map((a) => a.id)).not.toContain('a2');
  });

  it('suppresses an orphan depth-1 candidate', () => {
    const result = enforceAnnotationDepthCap([node('a0', 0), node('a1', 1, 'missing')]);
    expect(result.suppressed.map((a) => a.id)).toEqual(['a1']);
  });

  it('suppresses a depth-1 whose parent is itself depth-1', () => {
    const result = enforceAnnotationDepthCap([
      node('a0', 0),
      node('a1', 1, 'a0'),
      node('a2', 1, 'a1'),
    ]);
    expect(result.accepted.map((a) => a.id)).toEqual(['a0', 'a1']);
    expect(result.suppressed.map((a) => a.id)).toEqual(['a2']);
  });
});

// ── Edge Function source-shape contract ───────────────────────

describe('annotate-evidence — Edge Function contract', () => {
  it('handles CORS preflight and rejects non-POST', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/methodNotAllowed\(\)/);
  });

  it('verifies the JWT via the authorization header', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]authorization['"]\)/);
    expect(fnSrc).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('validates the kind, depth, and parentAnnotationId for depth 1', () => {
    expect(fnSrc).toMatch(/badRequest\('invalid_kind'\)/);
    expect(fnSrc).toMatch(/badRequest\('invalid_depth'\)/);
    expect(fnSrc).toMatch(/badRequest\('depthId_required'\)/);
    expect(fnSrc).toMatch(/isEvidenceAnnotationKind/);
  });

  it('validates debateId / argumentId UUIDs and the evidenceArtifactId', () => {
    expect(fnSrc).toMatch(/badRequest\('debateId_and_argumentId_required'\)/);
    expect(fnSrc).toMatch(/badRequest\('evidence_artifact_id_required'\)/);
    expect(fnSrc).toContain('isUuid');
  });

  it('uses the caller-scoped client for the argument lookup', () => {
    expect(fnSrc).toMatch(/createCallerClient\(auth\)/);
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]arguments['"]\)/);
  });

  it('treats an invisible argument as forbidden (no existence leak)', () => {
    expect(fnSrc).toMatch(/forbidden\('argument_not_visible'\)/);
  });

  it('rejects a debate/argument mismatch and a deleted argument', () => {
    expect(fnSrc).toMatch(/badRequest\('debate_argument_mismatch'\)/);
    expect(fnSrc).toMatch(/badRequest\('argument_deleted'\)/);
  });

  it('enforces eligibility server-side via the shared mirror', () => {
    expect(fnSrc).toMatch(/from ['"]\.\.\/_shared\/evidenceAnnotationEligibility\.ts['"]/);
    expect(fnSrc).toMatch(/isAnnotationAllowed\(kind, \{ actorRole, targetDepth: depth \}\)/);
    expect(fnSrc).toMatch(/forbidden\('not_eligible'\)/);
  });

  it('rejects an evidenceArtifactId that does not resolve to the argument', () => {
    expect(fnSrc).toMatch(/badRequest\('evidence_artifact_not_found'\)/);
    expect(fnSrc).toMatch(/evidenceArtifactExists/);
  });

  it('runs the depth cap on [...existing, candidate] before the write', () => {
    expect(fnSrc).toMatch(/enforceAnnotationDepthCap/);
    expect(fnSrc).toMatch(/badRequest\('depth_cap_exceeded'\)/);
  });

  it('writes only the client_validation column (no migration, no other column)', () => {
    // The only `.update(...)` on `arguments` writes client_validation.
    expect(fnSrc).toMatch(/\.update\(\{ client_validation: mergedClientValidation \}\)/);
    // No DDL / migration text.
    expect(fnSrc).not.toMatch(/alter table/i);
    expect(fnSrc).not.toMatch(/create table/i);
    // The function never writes `body`, `status`, `is_deleted`, or any other
    // arguments column.
    const updateCalls = fnSrc.match(/\.update\(\{[^}]*\}\)/g) || [];
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toContain('client_validation');
  });

  it('spread-merges so attachedEvidence is preserved (never a blob replace)', () => {
    expect(fnSrc).toMatch(/\.\.\.clientValidation,/);
    expect(fnSrc).toMatch(/evidenceAnnotations: mergedAnnotations/);
  });

  it('uses the service-role client for the privileged write + audit only', () => {
    expect(fnSrc).toMatch(/createServiceClient\(\)/);
    expect(fnSrc).toMatch(/admin_audit_events/);
    expect(fnSrc).toMatch(/evidence_annotation_added/);
  });

  it('never hard-deletes an argument row', () => {
    expect(fnSrc).not.toMatch(/from\(['"]arguments['"]\)[\s\S]*?\.delete\(/);
  });

  it('returns the stable ok envelope with argumentId + evidenceArtifactId + annotations', () => {
    expect(fnSrc).toMatch(/ok\(\{ argumentId, evidenceArtifactId, annotations[^}]*\}\)/);
  });

  it('never logs the Authorization header, a key, or the note text', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*SERVICE_ROLE/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*\bnote\b/i);
    // The function does not log at all.
    expect(fnSrc).not.toMatch(/console\.\w+\(/);
  });

  it('makes no AI / external-provider call', () => {
    expect(fnSrc).not.toMatch(/anthropic/i);
    expect(fnSrc).not.toMatch(/api\.x\.ai/i);
    expect(fnSrc).not.toMatch(/openai/i);
  });

  it('is registered in config.toml with verify_jwt = true', () => {
    expect(configSrc).toMatch(/\[functions\.annotate-evidence\][\s\S]*?verify_jwt = true/);
  });
});

// ── Doctrine ban-list — function + mirror sources ─────────────

describe('annotate-evidence — doctrine ban-list', () => {
  /**
   * Whole-word verdict / amplification / person-attribution tokens. `block`
   * is excluded (the function header uses "never block an ordinary post").
   * `viral` / `verified` etc. are scanned because nothing legitimate in this
   * function should reference amplification.
   */
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'hoax',
    'propagandist',
    'astroturfer',
    'extremist',
    'manipulative',
    'trending',
    'virality',
  ];

  function containsBanned(src: string): string | null {
    const lower = src.toLowerCase();
    for (const token of BANNED) {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      if (re.test(lower)) return token;
    }
    return null;
  }

  it('the Edge Function source contains no verdict / attribution token', () => {
    expect(containsBanned(fnSrc)).toBeNull();
  });

  it('the shared mirror source contains no verdict / attribution token', () => {
    expect(containsBanned(mirrorSrc)).toBeNull();
  });
});
