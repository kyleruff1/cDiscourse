import {
  buildUpdateRolePayload,
  normalizeBlockValueClient,
  summarizeAuditPayload,
  PROTECTED_PROFILE_FIELDS,
  adminErrorMessage,
} from '../src/features/admin/adminHelpers';

describe('adminApi pure helpers', () => {
  describe('buildUpdateRolePayload', () => {
    const UID = '4ba8e6c2-1d3e-4b8d-9c4a-1b2c3d4e5f6a';

    it('builds a valid update_role payload for non-admin role', () => {
      const p = buildUpdateRolePayload({
        userId: UID,
        role: 'user',
        reason: 'demote from moderator',
      });
      expect(p.action).toBe('update_role');
      expect(p.userId).toBe(UID);
      expect(p.role).toBe('user');
      expect(p.reason).toBe('demote from moderator');
      expect('confirmAdminGrant' in p).toBe(false);
    });

    it('requires confirmAdminGrant flag when promoting to admin', () => {
      const p = buildUpdateRolePayload({
        userId: UID,
        role: 'admin',
        reason: 'promote',
        confirmAdminGrant: true,
      });
      expect(p.confirmAdminGrant).toBe(true);
    });

    it('sets confirmAdminGrant=false when promoting to admin without confirmation', () => {
      const p = buildUpdateRolePayload({
        userId: UID,
        role: 'admin',
        reason: 'promote',
      });
      // Field is present but false — server will reject.
      expect(p.confirmAdminGrant).toBe(false);
    });

    it('does NOT include email, password, or id-other-than-target in payload', () => {
      const p = buildUpdateRolePayload({
        userId: UID,
        role: 'user',
        reason: 'reason',
      });
      const keys = Object.keys(p);
      for (const protectedField of PROTECTED_PROFILE_FIELDS) {
        if (protectedField === 'id') continue; // userId allowed as target
        expect(keys).not.toContain(protectedField);
      }
      expect(keys).not.toContain('email');
      expect(keys).not.toContain('password');
    });
  });

  describe('normalizeBlockValueClient', () => {
    it('lowercases email', () => {
      expect(normalizeBlockValueClient('email', 'Foo@Bar.COM')).toBe('foo@bar.com');
    });

    it('lowercases email domain', () => {
      expect(normalizeBlockValueClient('email_domain', 'EXAMPLE.com')).toBe('example.com');
    });

    it('trims whitespace', () => {
      expect(normalizeBlockValueClient('email', '  foo@bar.com  ')).toBe('foo@bar.com');
    });

    it('does not lowercase IPs', () => {
      expect(normalizeBlockValueClient('ip', '203.0.113.1')).toBe('203.0.113.1');
    });

    it('passes through IP CIDR', () => {
      expect(normalizeBlockValueClient('ip_cidr', '203.0.113.0/24')).toBe('203.0.113.0/24');
    });
  });

  describe('summarizeAuditPayload', () => {
    it('returns empty string for empty payload', () => {
      expect(summarizeAuditPayload({})).toBe('');
    });

    it('summarizes one key', () => {
      const s = summarizeAuditPayload({ role: 'admin' });
      expect(s).toContain('role');
      expect(s).toContain('admin');
    });

    it('clips long values', () => {
      const s = summarizeAuditPayload({ note: 'x'.repeat(200) });
      expect(s.length).toBeLessThan(200);
    });
  });

  describe('adminErrorMessage', () => {
    it('returns Admin access required for 403', () => {
      expect(adminErrorMessage({ error: 'forbidden' }, 403)).toBe('Admin access required.');
    });

    it('returns Sign in required for 401', () => {
      expect(adminErrorMessage({ error: 'unauthorized' }, 401)).toBe('Sign in required.');
    });

    it('returns function-not-deployed message for 404', () => {
      expect(adminErrorMessage({ error: 'function_not_found' }, 404)).toContain('not deployed');
    });

    it('returns detail when present', () => {
      expect(adminErrorMessage({ error: 'x', detail: 'foo bar' }, 500)).toBe('foo bar');
    });
  });
});
