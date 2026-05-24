/**
 * PR-003 — upload-avatar Edge Function source-shape contract.
 *
 * Mirrors annotateEvidenceEdgeFunction.test.ts: the Edge Function uses
 * Deno-style imports and is not loadable by Jest, so its contract is
 * asserted by source-file inspection.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const fnSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/functions/upload-avatar/index.ts'),
  'utf8',
);
const configSrc = fs.readFileSync(path.join(repoRoot, 'supabase/config.toml'), 'utf8');
const migrationSrc = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/20260525000016_pr_003_profile_avatars.sql'),
  'utf8',
);

// ── HTTP contract ─────────────────────────────────────────────

describe('upload-avatar — HTTP shape', () => {
  it('handles CORS preflight (OPTIONS)', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
  });

  it('rejects non-POST', () => {
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/methodNotAllowed\(\)/);
  });

  it('reads the Authorization header (lowercase + uppercase)', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]authorization['"]\)/);
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]Authorization['"]\)/);
  });

  it('returns 401 unauthorized when no auth header', () => {
    expect(fnSrc).toMatch(/if \(!auth\) return unauthorized\(\)/);
  });

  it('parses JSON body and returns invalid_json on parse failure', () => {
    expect(fnSrc).toMatch(/req\.json\(\)/);
    expect(fnSrc).toMatch(/badRequest\(['"]invalid_json['"]\)/);
  });
});

// ── Auth + caller scoping ─────────────────────────────────────

describe('upload-avatar — auth + caller scoping', () => {
  it('uses createCallerClient with the auth header for getUser()', () => {
    expect(fnSrc).toMatch(/createCallerClient\(auth\)/);
    expect(fnSrc).toMatch(/callerClient\.auth\.getUser\(\)/);
  });

  it('verifies caller identity BEFORE branching on action', () => {
    // The order check ensures a new action variant cannot bypass auth.
    const authIdx = fnSrc.indexOf('callerClient.auth.getUser()');
    const switchIdx = fnSrc.indexOf('switch (body.action)');
    expect(authIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(switchIdx);
  });

  it('imports createServiceClient for the privileged writes', () => {
    expect(fnSrc).toMatch(/createServiceClient/);
  });
});

// ── Three actions dispatched ──────────────────────────────────

describe('upload-avatar — three-action dispatch', () => {
  it('declares the upload action', () => {
    expect(fnSrc).toMatch(/case 'upload':/);
    expect(fnSrc).toMatch(/handleUpload\(/);
  });

  it('declares the remove action', () => {
    expect(fnSrc).toMatch(/case 'remove':/);
    expect(fnSrc).toMatch(/handleRemove\(/);
  });

  it('declares the read_url_for_user action', () => {
    expect(fnSrc).toMatch(/case 'read_url_for_user':/);
    expect(fnSrc).toMatch(/handleReadUrlForUser\(/);
  });

  it('rejects an unknown action', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]unknown_action['"]\)/);
  });
});

// ── Upload action server-side validation ──────────────────────

describe('upload-avatar — upload action server validation', () => {
  it('rejects mime_not_allowed server-side (not just trusting the client)', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]mime_not_allowed['"]\)/);
  });

  it('rejects too_large server-side', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]too_large['"]\)/);
  });

  it('rejects empty server-side', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]empty['"]\)/);
  });

  it('rejects invalid_image on decode failure', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]invalid_image['"]\)/);
  });

  it('rejects image_too_small for dimensions below 64 px', () => {
    expect(fnSrc).toMatch(/badRequest\(['"]image_too_small['"]\)/);
    expect(fnSrc).toMatch(/AVATAR_MIN_DIMENSION/);
  });

  it('enforces a 2 MiB cap (2 * 1024 * 1024)', () => {
    expect(fnSrc).toMatch(/AVATAR_MAX_BYTES = 2 \* 1024 \* 1024/);
  });

  it('imports imagescript from a pinned version URL', () => {
    expect(fnSrc).toMatch(/from ['"]https:\/\/deno\.land\/x\/imagescript@\d+\.\d+\.\d+\/mod\.ts['"]/);
  });
});

// ── Storage path derivation (security spine) ──────────────────

describe('upload-avatar — storage path is server-derived from auth.uid()', () => {
  it('derives the storage path from callerUserId, not from request body', () => {
    expect(fnSrc).toMatch(/avatarPathFor\(callerUserId\)/);
    // The avatarPathFor helper builds `${userId}/avatar-256.webp` +
    // `${userId}/avatar-64.webp`.
    expect(fnSrc).toMatch(/`\$\{userId\}\/avatar-256\.webp`/);
    expect(fnSrc).toMatch(/`\$\{userId\}\/avatar-64\.webp`/);
  });

  it('writes both objects to the profile-avatars bucket', () => {
    expect(fnSrc).toMatch(/AVATAR_BUCKET = 'profile-avatars'/);
    expect(fnSrc).toMatch(/\.from\(AVATAR_BUCKET\)\s*\n?\s*\.upload\(/);
  });

  it('uses upsert: true so a change action overwrites in place', () => {
    expect(fnSrc).toMatch(/upsert: true/);
  });

  it('writes contentType image/webp (the server-resized output format)', () => {
    expect(fnSrc).toMatch(/contentType: ['"]image\/webp['"]/);
  });
});

// ── Profile update (the narrowed RLS column set) ──────────────

describe('upload-avatar — profile column update via service-role', () => {
  it('updates the four avatar columns on success', () => {
    expect(fnSrc).toMatch(/avatar_path:/);
    expect(fnSrc).toMatch(/avatar_thumb_path:/);
    expect(fnSrc).toMatch(/avatar_updated_at:/);
  });

  it('nulls avatar_path + avatar_thumb_path on remove', () => {
    expect(fnSrc).toMatch(/avatar_path: null/);
    expect(fnSrc).toMatch(/avatar_thumb_path: null/);
  });

  it('scopes the profile UPDATE to the caller (id eq callerUserId)', () => {
    expect(fnSrc).toMatch(/\.eq\(['"]id['"], callerUserId\)/);
  });
});

// ── read_url_for_user moderation gate ─────────────────────────

describe('upload-avatar — read_url_for_user moderation gate', () => {
  it('checks avatar_moderation_status and returns null URLs when removed', () => {
    expect(fnSrc).toMatch(/avatar_moderation_status/);
    expect(fnSrc).toMatch(/moderationStatus: ['"]removed['"]/);
    expect(fnSrc).toMatch(/publicUrl: null,\s*\n?\s*publicThumbUrl: null/);
  });

  it('validates userId as a UUID', () => {
    expect(fnSrc).toMatch(/isUuid\(body\.userId\)/);
    expect(fnSrc).toMatch(/badRequest\(['"]userId_required['"]\)/);
  });

  it('uses the caller-scoped client for the profile read (RLS-respecting)', () => {
    expect(fnSrc).toMatch(/callerClient\s*\n?\s*\.from\(['"]profiles['"]\)/);
  });
});

// ── Audit (best-effort, never blocks) ─────────────────────────

describe('upload-avatar — audit', () => {
  it('writes admin_audit_events for upload and remove', () => {
    expect(fnSrc).toMatch(/admin_audit_events/);
    expect(fnSrc).toMatch(/avatar_uploaded/);
    expect(fnSrc).toMatch(/avatar_removed/);
  });

  it('wraps the audit insert in try/catch (best-effort)', () => {
    expect(fnSrc).toMatch(/try \{[\s\S]*?admin_audit_events[\s\S]*?\} catch/);
  });

  it('audit payload includes source = edge_function (the CHECK constraint)', () => {
    expect(fnSrc).toMatch(/source: ['"]edge_function['"]/);
  });
});

// ── Logging hygiene ───────────────────────────────────────────

describe('upload-avatar — logging hygiene', () => {
  it('never logs Authorization, SERVICE_ROLE, ANTHROPIC, or RESEND keys', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*authorization/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*SERVICE_ROLE/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*ANTHROPIC_API_KEY/i);
    expect(fnSrc).not.toMatch(/console\.\w+\([^)]*RESEND_API_KEY/i);
  });

  it('does not log anything at all (no console.* calls in the function)', () => {
    expect(fnSrc).not.toMatch(/console\.\w+\(/);
  });

  it('never returns admin emails or other users PII', () => {
    expect(fnSrc).not.toMatch(/admin\.listUsers/);
    expect(fnSrc).not.toMatch(/auth\.admin/);
  });
});

// ── No AI / external provider call ────────────────────────────

describe('upload-avatar — no AI / external provider call', () => {
  // Strip comments before scanning so a doc-comment mention of "anthropic"
  // (as in "Never calls Anthropic, xAI...") does not trigger a false
  // positive. The annotateEvidence test uses the same approach.
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  }
  const code = stripComments(fnSrc);

  it('does not import or call anthropic', () => {
    expect(code).not.toMatch(/anthropic/i);
  });
  it('does not import or call api.x.ai', () => {
    expect(code).not.toMatch(/api\.x\.ai/i);
  });
  it('does not import or call openai', () => {
    expect(code).not.toMatch(/openai/i);
  });
});

// ── Never hard-deletes a content row ──────────────────────────

describe('upload-avatar — never hard-deletes a content row', () => {
  it('never calls .delete() on public.arguments', () => {
    expect(fnSrc).not.toMatch(/from\(['"]arguments['"]\)[\s\S]*?\.delete\(/);
  });
  it('never calls .delete() on public.flags', () => {
    expect(fnSrc).not.toMatch(/from\(['"]flags['"]\)[\s\S]*?\.delete\(/);
  });
});

// ── Single body read (no double-parse) ────────────────────────

describe('upload-avatar — single body parse', () => {
  it('reads req.json() exactly once', () => {
    const matches = fnSrc.match(/req\.json\(\)/g) || [];
    expect(matches).toHaveLength(1);
  });
});

// ── Registered in config.toml ─────────────────────────────────

describe('upload-avatar — config.toml registration', () => {
  it('is registered with verify_jwt = true', () => {
    expect(configSrc).toMatch(/\[functions\.upload-avatar\][\s\S]*?verify_jwt = true/);
  });
});

// ── OPS-001 migration source-scan ─────────────────────────────

describe('upload-avatar — companion migration OPS-001 four-class compliance', () => {
  it('header names all four OPS-001 classes', () => {
    expect(migrationSrc).toMatch(/Class 1 — Ambiguous column references/);
    expect(migrationSrc).toMatch(/Class 2 — Column type mismatches/);
    expect(migrationSrc).toMatch(/Class 3 — Implicit ordering dependencies/);
    expect(migrationSrc).toMatch(/Class 4 — Function \/ trigger \/ extension dependencies/);
  });

  it('header documents pgcrypto dependency status', () => {
    expect(migrationSrc).toMatch(/pgcrypto/);
  });

  it('storage.objects policy references columns fully qualified', () => {
    expect(migrationSrc).toMatch(/storage\.objects\.bucket_id/);
  });

  it('public.profiles policy references columns fully qualified', () => {
    expect(migrationSrc).toMatch(/public\.profiles\.avatar_path/);
    expect(migrationSrc).toMatch(/public\.profiles\.avatar_thumb_path/);
    expect(migrationSrc).toMatch(/public\.profiles\.avatar_updated_at/);
    expect(migrationSrc).toMatch(/public\.profiles\.avatar_moderation_status/);
  });

  it('creates the profile-avatars bucket BEFORE storage.objects policies', () => {
    const bucketIdx = migrationSrc.indexOf("INSERT INTO storage.buckets");
    const policyIdx = migrationSrc.indexOf('"profile-avatars: anyone can read"');
    expect(bucketIdx).toBeGreaterThan(-1);
    expect(policyIdx).toBeGreaterThan(-1);
    expect(bucketIdx).toBeLessThan(policyIdx);
  });

  it('adds the four avatar columns BEFORE the narrowed UPDATE policy is created', () => {
    const alterIdx = migrationSrc.indexOf('ADD COLUMN IF NOT EXISTS avatar_path');
    // Target the actual CREATE POLICY statement (not the header comment
    // that names the policy in the OPS-001 walk).
    const policyIdx = migrationSrc.indexOf(
      'CREATE POLICY "profiles: users update own — narrow"',
    );
    expect(alterIdx).toBeGreaterThan(-1);
    expect(policyIdx).toBeGreaterThan(-1);
    expect(alterIdx).toBeLessThan(policyIdx);
  });

  it('drops the prior UPDATE policy before creating the narrowed one', () => {
    const dropIdx = migrationSrc.indexOf(
      'DROP POLICY IF EXISTS "profiles: users update own; mods update any"',
    );
    const createIdx = migrationSrc.indexOf(
      'CREATE POLICY "profiles: users update own — narrow"',
    );
    expect(dropIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(createIdx);
  });

  it('moderation_status column defaults to allowed with a two-value CHECK', () => {
    expect(migrationSrc).toMatch(
      /avatar_moderation_status text[\s\S]*?DEFAULT ['"]allowed['"][\s\S]*?CHECK \(avatar_moderation_status IN \(['"]allowed['"], ['"]removed['"]\)\)/,
    );
  });

  it('the bucket has the 2 MiB file size cap', () => {
    expect(migrationSrc).toMatch(/2097152/);
  });

  it('the bucket has the JPG/PNG/WebP MIME allowlist', () => {
    expect(migrationSrc).toMatch(/ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  });

  it('does NOT grant INSERT / UPDATE / DELETE to authenticated on storage.objects', () => {
    // Absence is the denial — only the public SELECT policy exists.
    expect(migrationSrc).not.toMatch(
      /CREATE POLICY "profile-avatars[^"]*"\s+ON storage\.objects\s+FOR INSERT/i,
    );
    expect(migrationSrc).not.toMatch(
      /CREATE POLICY "profile-avatars[^"]*"\s+ON storage\.objects\s+FOR UPDATE/i,
    );
    expect(migrationSrc).not.toMatch(
      /CREATE POLICY "profile-avatars[^"]*"\s+ON storage\.objects\s+FOR DELETE/i,
    );
  });
});

// ── Source has no service-role / AI literal leakage ───────────

describe('upload-avatar — source-scan zero secret literal', () => {
  it('does not contain any service-role key literal', () => {
    expect(fnSrc).not.toMatch(/sb_secret_/);
    expect(fnSrc).not.toMatch(/eyJhbGciOiJIUzI1NiIsInR5cCI/); // common JWT prefix
  });
});

// ── Doctrine ban-list on Edge Function + migration ────────────

describe('upload-avatar — doctrine ban-list', () => {
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'manipulative',
    'extremist',
    'propagandist',
    'astroturfer',
    'hoax',
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

  it('the migration source contains no verdict / attribution token', () => {
    expect(containsBanned(migrationSrc)).toBeNull();
  });
});
