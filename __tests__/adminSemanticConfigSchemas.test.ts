/**
 * ADMIN-AI-001 — schema tests mirror
 * supabase/functions/_shared/adminSemanticConfigSchemas.ts.
 *
 * The Edge Function schema file imports `npm:zod@4` (Deno-only) and cannot be
 * loaded by Jest — the established `adminSchemas.test.ts` situation. The
 * schemas are re-declared here with the local zod and asserted to behave the
 * same way the Edge Function relies on.
 *
 * If you change the Edge Function schemas, mirror the change here.
 */
import { z } from 'zod';

const SEMANTIC_PROVIDER_WRITE_MODES = ['anthropic', 'mock', 'fixture'] as const;

const GetSemanticConfigSchema = z.object({
  action: z.literal('get_semantic_config'),
});

const SetSemanticConfigSchema = z.object({
  action: z.literal('set_semantic_config'),
  // 'mcp' is intentionally NOT settable — reserved for MCP-018.
  providerMode: z.enum(SEMANTIC_PROVIDER_WRITE_MODES),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  confirmAnthropic: z.boolean().optional(),
}).refine(
  (d) => d.providerMode !== 'anthropic' || d.confirmAnthropic === true,
  {
    message: 'confirmAnthropic=true required to switch to the Anthropic provider',
    path: ['confirmAnthropic'],
  },
);

describe('GetSemanticConfigSchema', () => {
  it('accepts { action: "get_semantic_config" }', () => {
    expect(GetSemanticConfigSchema.safeParse({ action: 'get_semantic_config' }).success).toBe(true);
  });

  it('rejects a wrong action literal', () => {
    expect(GetSemanticConfigSchema.safeParse({ action: 'list_users' }).success).toBe(false);
  });
});

describe('SetSemanticConfigSchema — provider mode enum', () => {
  it('accepts mock with enabled and no confirm flag (one-click rollback)', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mock', enabled: true,
    });
    expect(r.success).toBe(true);
  });

  it('accepts fixture with enabled and no confirm flag', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'fixture', enabled: false,
    });
    expect(r.success).toBe(true);
  });

  it('rejects providerMode: "mcp" on the write path (the slot is reserved)', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mcp', enabled: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown providerMode', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'gpt', enabled: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a missing providerMode', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', enabled: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects a missing enabled flag', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mock',
    });
    expect(r.success).toBe(false);
  });
});

describe('SetSemanticConfigSchema — Anthropic confirmation refine (doctrine #7)', () => {
  it('rejects providerMode: "anthropic" WITHOUT confirmAnthropic', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'anthropic', enabled: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects providerMode: "anthropic" with confirmAnthropic: false', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'anthropic', enabled: true,
      confirmAnthropic: false,
    });
    expect(r.success).toBe(false);
  });

  it('accepts providerMode: "anthropic" WITH confirmAnthropic: true', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'anthropic', enabled: true,
      confirmAnthropic: true,
    });
    expect(r.success).toBe(true);
  });

  it('the refine error points at the confirmAnthropic path', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'anthropic', enabled: true,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('confirmAnthropic'))).toBe(true);
    }
  });

  it('mock / fixture do NOT require confirmAnthropic even when it is omitted', () => {
    expect(SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mock', enabled: true,
    }).success).toBe(true);
    expect(SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'fixture', enabled: true,
    }).success).toBe(true);
  });
});

describe('SetSemanticConfigSchema — reason field', () => {
  it('accepts an optional reason note', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mock', enabled: true,
      reason: 'Rolling back for the demo.',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an over-length reason (> 500 chars)', () => {
    const r = SetSemanticConfigSchema.safeParse({
      action: 'set_semantic_config', providerMode: 'mock', enabled: true,
      reason: 'x'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('the admin-users discriminated union dispatches the two new actions', () => {
  // A minimal mirror of AdminUsersRequestSchema's relevant slice — the union
  // must dispatch get_semantic_config / set_semantic_config to the right
  // member, and still reject unknown actions.
  const ListUsers = z.object({ action: z.literal('list_users') });
  const Union = z.discriminatedUnion('action', [
    ListUsers,
    GetSemanticConfigSchema,
    SetSemanticConfigSchema,
  ]);

  it('dispatches get_semantic_config', () => {
    expect(Union.safeParse({ action: 'get_semantic_config' }).success).toBe(true);
  });

  it('dispatches set_semantic_config (with a valid body)', () => {
    expect(Union.safeParse({
      action: 'set_semantic_config', providerMode: 'mock', enabled: true,
    }).success).toBe(true);
  });

  it('still rejects an unknown action', () => {
    expect(Union.safeParse({ action: 'frob_widget' }).success).toBe(false);
  });
});
