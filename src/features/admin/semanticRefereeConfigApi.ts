/**
 * ADMIN-AI-001 — typed client wrapper for the semantic-referee runtime
 * provider-mode config.
 *
 * Thin pass-throughs over `adminUsers({ action: ... })`, mirroring
 * `adminApi.ts` exactly. The client never holds a service-role key — the
 * `admin-users` Edge Function verifies the JWT and checks `profiles.role =
 * 'admin'` before any read or write.
 *
 * Doctrine:
 *   - `ANTHROPIC_API_KEY` is never referenced here — `SemanticRefereeConfigView`
 *     carries only a `anthropicKeyPresent` boolean.
 *   - No service-role key, no direct DB access — the Edge Function is the only
 *     write path.
 */
import { adminUsers } from '../../lib/edgeFunctions';
import type {
  AdminUsersResult,
  SemanticRefereeConfigView,
  SetSemanticRefereeConfigInput,
} from '../../lib/edgeFunctions';

/** The plain-language label for each provider mode shown in the Admin UI. */
export const PROVIDER_MODE_LABELS: Record<
  SemanticRefereeConfigView['providerMode'],
  string
> = {
  anthropic: 'Anthropic',
  mock: 'Mock',
  fixture: 'Fixture (dev/test)',
  mcp: 'Coming later (MCP-018)',
};

/**
 * Result of a `set_semantic_config` write — the settled config the Edge
 * Function read back after the update.
 */
export interface SetSemanticRefereeConfigResult {
  providerMode: string;
  enabled: boolean;
  updatedAt: string;
}

/** Read the current semantic-referee runtime config. */
export async function adminGetSemanticRefereeConfig(): Promise<
  AdminUsersResult<SemanticRefereeConfigView>
> {
  return adminUsers<SemanticRefereeConfigView>({ action: 'get_semantic_config' });
}

/**
 * Write the semantic-referee runtime config. Switching to `anthropic`
 * requires `confirmAnthropic: true` — the Edge Function's `.refine()` rejects
 * it otherwise.
 */
export async function adminSetSemanticRefereeConfig(
  input: SetSemanticRefereeConfigInput,
): Promise<AdminUsersResult<SetSemanticRefereeConfigResult>> {
  // Explicit field list (not `...input`) so no stray field leaks into the
  // payload — mirrors `adminInviteUser` in `adminApi.ts`.
  return adminUsers<SetSemanticRefereeConfigResult>({
    action: 'set_semantic_config',
    providerMode: input.providerMode,
    enabled: input.enabled,
    reason: input.reason,
    confirmAnthropic: input.confirmAnthropic,
  });
}

/**
 * Shared rule: switching INTO the Anthropic provider needs a confirmation
 * step ("Anthropic mode may use provider credits."). The UI dialog and the
 * confirmation test both use this one rule. Switching to `mock` / `fixture`
 * is one-click — no confirmation.
 */
export function requiresProviderConfirmation(nextMode: string): boolean {
  return nextMode === 'anthropic';
}
