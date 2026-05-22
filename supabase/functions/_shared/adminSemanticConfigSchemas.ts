/**
 * ADMIN-AI-001 — zod schemas for the two new `admin-users` actions that
 * read / write the semantic-referee runtime config.
 *
 * Kept in a small dedicated file (not appended to `adminSchemas.ts`) so the
 * semantic-referee config concern is co-located; `adminSchemas.ts` extends its
 * `AdminUsersRequestSchema` discriminated union by importing these two schemas.
 *
 * Doctrine:
 *   - `mcp` is NOT settable on the write path — the slot is reserved for
 *     MCP-018. The write enum is the three live modes only. (The DB `CHECK`
 *     constraint allows `mcp` so MCP-018 needs no migration; the write schema
 *     is the gate, mirroring `adminSchemas.ts`'s `InviteUser`, where `'admin'`
 *     is excluded from the invite-role enum.)
 *   - The Anthropic confirmation step is enforced server-side by `.refine()`
 *     (the UI dialog is the UX; this refine is the wall — doctrine
 *     constraint #7). Switching to `mock` / `fixture` needs no confirmation
 *     flag (constraint #8 — Mock is one-click).
 */
import { z } from 'npm:zod@4';

/**
 * The four config provider slots. Mirrors the `CHECK` constraint on
 * `public.semantic_referee_runtime_config.provider_mode` and the
 * `SemanticProviderMode` union in `semanticReferee/runtimeConfig.ts`.
 */
export const SEMANTIC_PROVIDER_MODES = ['anthropic', 'mock', 'fixture', 'mcp'] as const;

/**
 * The modes an admin can SET. `mcp` is intentionally excluded — the slot is
 * reserved for MCP-018; only that card enables it (by adding `'mcp'` here).
 */
export const SEMANTIC_PROVIDER_WRITE_MODES = ['anthropic', 'mock', 'fixture'] as const;

/** Read the current semantic-referee runtime config. No parameters. */
export const GetSemanticConfigSchema = z.object({
  action: z.literal('get_semantic_config'),
});

/**
 * Write the semantic-referee runtime config.
 *
 * - `providerMode` is the three-mode write enum — `mcp` cannot be set.
 * - `confirmAnthropic` MUST be `true` when `providerMode === 'anthropic'`
 *   (the `.refine()` below). Switching to `mock` / `fixture` ignores it.
 */
export const SetSemanticConfigSchema = z.object({
  action: z.literal('set_semantic_config'),
  // 'mcp' is intentionally NOT settable — the slot is reserved for MCP-018.
  providerMode: z.enum(SEMANTIC_PROVIDER_WRITE_MODES),
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  // Confirmation gate: switching INTO anthropic requires confirmAnthropic=true.
  confirmAnthropic: z.boolean().optional(),
}).refine(
  (d) => d.providerMode !== 'anthropic' || d.confirmAnthropic === true,
  {
    message: 'confirmAnthropic=true required to switch to the Anthropic provider',
    path: ['confirmAnthropic'],
  },
);

export type GetSemanticConfigRequest = z.infer<typeof GetSemanticConfigSchema>;
export type SetSemanticConfigRequest = z.infer<typeof SetSemanticConfigSchema>;
