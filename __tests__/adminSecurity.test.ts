/**
 * Defense-in-depth tests:
 *  - getVisibleTabs gates the Admin tab correctly by role.
 *  - The client wrapper does not include service-role keys anywhere.
 *  - Account API never writes role.
 *  - PROTECTED_PROFILE_FIELDS is enforced in client payloads.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => ({
  supabase: {},
  SUPABASE_CONFIGURED: false,
}));

import { getVisibleTabs, TAB_LABELS } from '../src/features/arguments/roomNavigation';
import { buildProfileUpdatePayload } from '../src/features/account/accountApi';
import { PROTECTED_PROFILE_FIELDS } from '../src/features/admin/adminHelpers';
import * as fs from 'fs';
import * as path from 'path';

describe('admin tab gating', () => {
  it('hides admin tab for role=user', () => {
    const tabs = getVisibleTabs('user', false);
    expect(tabs).not.toContain('admin');
  });

  it('hides admin tab for role=moderator', () => {
    const tabs = getVisibleTabs('moderator', false);
    expect(tabs).not.toContain('admin');
  });

  it('hides admin tab for null role', () => {
    const tabs = getVisibleTabs(null, false);
    expect(tabs).not.toContain('admin');
  });

  it('shows admin tab for role=admin', () => {
    const tabs = getVisibleTabs('admin', false);
    expect(tabs).toContain('admin');
  });

  it('shows debug tab only in dev', () => {
    expect(getVisibleTabs('admin', true)).toContain('debug');
    expect(getVisibleTabs('admin', false)).not.toContain('debug');
  });

  it('always includes arguments and account', () => {
    for (const role of [null, 'user', 'moderator', 'admin'] as const) {
      const tabs = getVisibleTabs(role, false);
      expect(tabs).toContain('arguments');
      expect(tabs).toContain('account');
    }
  });

  it('TAB_LABELS includes Admin', () => {
    expect(TAB_LABELS.admin).toBe('Admin');
  });
});

describe('account API cannot update role', () => {
  it('buildProfileUpdatePayload does not include role', () => {
    const p = buildProfileUpdatePayload({ displayName: 'Test User' });
    expect(p).not.toHaveProperty('role');
    expect(p).not.toHaveProperty('id');
    expect(p).not.toHaveProperty('email');
  });
});

describe('PROTECTED_PROFILE_FIELDS', () => {
  it('includes id, email, password', () => {
    expect(PROTECTED_PROFILE_FIELDS).toContain('id');
    expect(PROTECTED_PROFILE_FIELDS).toContain('email');
    expect(PROTECTED_PROFILE_FIELDS).toContain('password');
  });
});

describe('client never contains service-role/secret keys', () => {
  const BANNED = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEYS',
    'sb_secret_',
    'service_role_key',
    'serviceRoleKey',
  ];

  function readAllSources(dir: string): string {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) return '';
    if (fs.statSync(fullPath).isFile()) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    let acc = '';
    function walk(d: string) {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && /\.(ts|tsx|js)$/.test(e.name)) {
          acc += '\n' + fs.readFileSync(p, 'utf8');
        }
      }
    }
    walk(fullPath);
    return acc;
  }

  it('no service-role key references in src/', () => {
    const blob = readAllSources('src');
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });

  it('no service-role key references in App.tsx', () => {
    const blob = readAllSources('App.tsx');
    for (const banned of BANNED) {
      expect(blob).not.toContain(banned);
    }
  });
});

// ── ADMIN-AI-001 — the two new semantic-config admin actions ─────

describe('ADMIN-AI-001 — admin-users wires the semantic-config actions', () => {
  const auditSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/adminAudit.ts'),
    'utf8',
  );
  const indexSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/admin-users/index.ts'),
    'utf8',
  );
  const schemasSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/adminSchemas.ts'),
    'utf8',
  );

  it('get_semantic_config and set_semantic_config are in WHITELISTED_ACTIONS', () => {
    expect(auditSrc).toContain("'get_semantic_config'");
    expect(auditSrc).toContain("'set_semantic_config'");
  });

  it('the admin-users action switch has a case for each new action', () => {
    expect(indexSrc).toMatch(/case 'get_semantic_config':\s*\n\s*return await handleGetSemanticConfig\(/);
    expect(indexSrc).toMatch(/case 'set_semantic_config':\s*\n\s*return await handleSetSemanticConfig\(/);
  });

  it('the discriminated union includes the two new schemas', () => {
    expect(schemasSrc).toContain('GetSemanticConfigSchema');
    expect(schemasSrc).toContain('SetSemanticConfigSchema');
    expect(schemasSrc).toMatch(/import \{[\s\S]*?GetSemanticConfigSchema[\s\S]*?\} from '\.\/adminSemanticConfigSchemas\.ts'/);
  });

  it('neither new handler builds a caller-scoped bypass — both use the post-requireAdmin service client', () => {
    // The handlers receive `sc` (the service client resolved AFTER
    // requireAdmin). They must not build their own client or read a JWT.
    const handlerBlock = indexSrc.slice(indexSrc.indexOf('async function handleGetSemanticConfig'));
    expect(handlerBlock).not.toMatch(/createCallerClient/);
    expect(handlerBlock).not.toMatch(/createServiceClient\(/);
    expect(handlerBlock).not.toMatch(/getUser\(\)/);
  });

  it('requireAdmin still gates every action (the auth check is unchanged)', () => {
    expect(indexSrc).toMatch(/const auth = await requireAdmin\(req\)/);
    expect(indexSrc).toMatch(/if \(!auth\.ok\)/);
    // The action switch runs only after the admin check.
    const adminIdx = indexSrc.indexOf('requireAdmin(req)');
    const switchIdx = indexSrc.indexOf('switch (body.action)');
    expect(adminIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(adminIdx);
  });

  it('the set handler writes to the dedicated config-audit table, never to public.arguments', () => {
    // Slice from handleSetSemanticConfig to the next non-semantic-config
    // section marker. The semantic-config concern spans the handler plus
    // its private `writeConfigAudit` helper; both belong to ADMIN-AI-001.
    // The ADMIN-ARGS-INACTIVE-001 section follows with its own marker
    // comment ("ADMIN-ARGS-INACTIVE-001 — per-argument inactive"), so we
    // cut there to keep the assertion scoped to the semantic-config region.
    const startIdx = indexSrc.indexOf('async function handleSetSemanticConfig');
    expect(startIdx).toBeGreaterThan(-1);
    const tail = indexSrc.slice(startIdx);
    const inactiveMarkerIdx = tail.indexOf('ADMIN-ARGS-INACTIVE-001 — per-argument inactive');
    const handlerBlock = inactiveMarkerIdx === -1 ? tail : tail.slice(0, inactiveMarkerIdx);
    expect(handlerBlock).toContain("from('semantic_referee_config_audit')");
    expect(handlerBlock).not.toMatch(/from\('arguments'\)/);
  });
});
