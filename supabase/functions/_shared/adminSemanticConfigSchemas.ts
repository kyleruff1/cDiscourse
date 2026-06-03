/**
 * ADMIN-AI-001 — zod schemas for the two new `admin-users` actions that
 * read / write the semantic-referee runtime config.
 *
 * Kept in a small dedicated file (not appended to `adminSchemas.ts`) so the
 * semantic-referee config concern is co-located; `adminSchemas.ts` extends its
 * `AdminUsersRequestSchema` discriminated union by importing these two schemas.
 *
 * Doctrine:
 *   - `mcp` IS settable on the write path as of 2026-06-03 (post-MCP-server-up).
 *     The operator-hosted MCP server is configured + reachable
 *     (SEMANTIC_REFEREE_MCP_URL + SEMANTIC_REFEREE_MCP_TOKEN secrets present).
 *     The slot is no longer reserved-but-disabled; admins can pick it
 *     one-click like mock/fixture. (The DB `CHECK` constraint always allowed
 *     `mcp`; the write enum is what changed.)
 *   - The Anthropic confirmation step is enforced server-side by `.refine()`
 *     (the UI dialog is the UX; this refine is the wall — doctrine
 *     constraint #7). Switching to `mock` / `fixture` / `mcp` needs no
 *     confirmation flag (constraint #8 — those are one-click).
 */
import { z } from 'npm:zod@4';

/**
 * The four config provider slots. Mirrors the `CHECK` constraint on
 * `public.semantic_referee_runtime_config.provider_mode` and the
 * `SemanticProviderMode` union in `semanticReferee/runtimeConfig.ts`.
 */
export const SEMANTIC_PROVIDER_MODES = ['anthropic', 'mock', 'fixture', 'mcp'] as const;

/**
 * The modes an admin can SET. As of 2026-06-03, `mcp` is included — the
 * operator-hosted MCP server is configured + reachable, so the slot is no
 * longer reserved-but-disabled. Switching INTO `anthropic` still requires
 * `confirmAnthropic: true` (see `.refine()` below); `mock` / `fixture` / `mcp`
 * are all one-click.
 */
export const SEMANTIC_PROVIDER_WRITE_MODES = ['anthropic', 'mock', 'fixture', 'mcp'] as const;

/** Read the current semantic-referee runtime config. No parameters. */
export const GetSemanticConfigSchema = z.object({
  action: z.literal('get_semantic_config'),
});

/**
 * Write the semantic-referee runtime config.
 *
 * - `providerMode` is the four-mode write enum (`mcp` added 2026-06-03).
 * - `confirmAnthropic` MUST be `true` when `providerMode === 'anthropic'`
 *   (the `.refine()` below). Switching to `mock` / `fixture` / `mcp`
 *   ignores it (those are one-click).
 */
export const SetSemanticConfigSchema = z.object({
  action: z.literal('set_semantic_config'),
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
