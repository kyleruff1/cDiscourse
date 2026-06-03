/**
 * ADMIN-AI-001 — semanticRefereeConfigApi client wrapper.
 *
 * The wrapper is tested with a mocked transport (`adminUsers`) so the exact
 * request payload it builds can be captured. No real Supabase call.
 */
jest.mock('../src/lib/edgeFunctions', () => ({
  adminUsers: jest.fn(),
}));

import {
  adminGetSemanticRefereeConfig,
  adminSetSemanticRefereeConfig,
  requiresProviderConfirmation,
  PROVIDER_MODE_LABELS,
} from '../src/features/admin/semanticRefereeConfigApi';

const adminUsersMock = jest.requireMock('../src/lib/edgeFunctions').adminUsers as jest.Mock;

function lastPayload(): Record<string, unknown> {
  expect(adminUsersMock).toHaveBeenCalled();
  return adminUsersMock.mock.calls[adminUsersMock.mock.calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  adminUsersMock.mockReset();
  adminUsersMock.mockResolvedValue({
    ok: true,
    data: {
      providerMode: 'anthropic',
      enabled: true,
      updatedAt: '2026-05-22T00:00:00Z',
      updatedByDisplayName: 'Admin Ada',
      anthropicKeyPresent: true,
    },
  });
});

describe('adminGetSemanticRefereeConfig', () => {
  it('calls adminUsers with { action: "get_semantic_config" } and no other field', async () => {
    await adminGetSemanticRefereeConfig();
    const payload = lastPayload();
    expect(payload).toEqual({ action: 'get_semantic_config' });
  });

  it('resolves the config view the Edge Function returns', async () => {
    const r = await adminGetSemanticRefereeConfig();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.providerMode).toBe('anthropic');
      expect(r.data.anthropicKeyPresent).toBe(true);
      expect(r.data.updatedByDisplayName).toBe('Admin Ada');
    }
  });

  it('passes a failure result straight through', async () => {
    adminUsersMock.mockResolvedValue({
      ok: false, error: { error: 'forbidden' }, status: 403,
    });
    const r = await adminGetSemanticRefereeConfig();
    expect(r.ok).toBe(false);
  });
});

describe('adminSetSemanticRefereeConfig', () => {
  it('forwards providerMode + enabled to the set_semantic_config action', async () => {
    await adminSetSemanticRefereeConfig({ providerMode: 'mock', enabled: true });
    const payload = lastPayload();
    expect(payload.action).toBe('set_semantic_config');
    expect(payload.providerMode).toBe('mock');
    expect(payload.enabled).toBe(true);
  });

  it('forwards reason + confirmAnthropic when switching to anthropic', async () => {
    await adminSetSemanticRefereeConfig({
      providerMode: 'anthropic',
      enabled: true,
      reason: 'Enabling the live referee.',
      confirmAnthropic: true,
    });
    const payload = lastPayload();
    expect(payload.providerMode).toBe('anthropic');
    expect(payload.reason).toBe('Enabling the live referee.');
    expect(payload.confirmAnthropic).toBe(true);
  });

  it('builds an explicit field list — no stray field leaks into the payload', async () => {
    await adminSetSemanticRefereeConfig({ providerMode: 'fixture', enabled: false });
    const keys = Object.keys(lastPayload()).sort();
    expect(keys).toEqual(
      ['action', 'confirmAnthropic', 'enabled', 'providerMode', 'reason'].sort(),
    );
  });

  it('the request body carries no service-role / token / key substrings', async () => {
    await adminSetSemanticRefereeConfig({
      providerMode: 'anthropic', enabled: true, confirmAnthropic: true,
    });
    const serialized = JSON.stringify(lastPayload());
    for (const banned of [
      'SERVICE_ROLE', 'service_role', 'sb_secret_', 'Bearer ', 'eyJ',
      'ANTHROPIC_API_KEY', 'sk-ant',
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it('passes a failure result straight through', async () => {
    adminUsersMock.mockResolvedValue({
      ok: false, error: { error: 'validation_failed' }, status: 422,
    });
    const r = await adminSetSemanticRefereeConfig({ providerMode: 'mock', enabled: true });
    expect(r.ok).toBe(false);
  });
});

describe('requiresProviderConfirmation — the shared confirmation rule', () => {
  it('returns true for anthropic', () => {
    expect(requiresProviderConfirmation('anthropic')).toBe(true);
  });

  it('returns false for mock (one-click rollback — doctrine #8)', () => {
    expect(requiresProviderConfirmation('mock')).toBe(false);
  });

  it('returns false for fixture', () => {
    expect(requiresProviderConfirmation('fixture')).toBe(false);
  });

  it('returns false for mcp and any unknown value', () => {
    expect(requiresProviderConfirmation('mcp')).toBe(false);
    expect(requiresProviderConfirmation('whatever')).toBe(false);
  });
});

describe('PROVIDER_MODE_LABELS — plain-language vocabulary', () => {
  it('has a label for each of the four modes', () => {
    expect(PROVIDER_MODE_LABELS.anthropic).toBe('Anthropic');
    expect(PROVIDER_MODE_LABELS.mock).toBe('Mock');
    expect(PROVIDER_MODE_LABELS.fixture).toBe('Fixture (dev/test)');
    expect(PROVIDER_MODE_LABELS.mcp).toBe('CD - MCP Server');
  });

  it('no label contains an internal snake_case code', () => {
    for (const label of Object.values(PROVIDER_MODE_LABELS)) {
      // MCP-018 is a card code (hyphenated), not a snake_case internal code.
      expect(label).not.toMatch(/_/);
    }
  });
});
