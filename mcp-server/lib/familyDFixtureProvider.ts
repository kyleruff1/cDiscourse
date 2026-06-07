/**
 * MCP-SERVER-005-FAMILY-D + MCP-BUILD2d — Family D fixture provider for
 * offline smoke testing.
 *
 * Activated when `MCP_SERVER_USE_FIXTURE_PROVIDER=true`. Loads the Family D
 * BATCH-0 response from
 * `fixtures/classify-argument-boolean-observations.family-d-batch0-response.json`
 * and returns it as the model "response". No real Anthropic call, no token
 * consumption — used by the smoke script (Checks 14 + 15) to verify the
 * full request lifecycle without a real key.
 *
 * MCP-BUILD2d NOTE: the full Family D Subset is now 22 keys (> the
 * per-response cap of 20), so the Edge splits it into 2 batches (16 + 6).
 * The mcp-server only ever serves a single BATCH per call; this provider
 * therefore returns the valid 16-key batch-0 response (the previous canonical
 * 19-key response is superseded by the per-batch fixtures — the canonical
 * 22-key fixture is now the MERGED reference, not a single wire response, and
 * would trip the 20-key validator if served whole). The merged 22-key result
 * is assembled at the Edge after both batches return.
 *
 * PRODUCTION DEPLOYS MUST NOT SET THE FLAG. The runbook documents the kill
 * switch behavior.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-side only; no AI provider call.
 */
import { log } from './logging.ts';

const FIXTURE_PATH = new URL(
  '../fixtures/classify-argument-boolean-observations.family-d-batch0-response.json',
  import.meta.url,
);

export type FamilyDFixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };

/**
 * Load the Family D canonical response fixture. Returns the parsed JSON
 * object, or a structured failure. Caller treats failure as a key_missing
 * style fallback that the Edge Function can recover from deterministically.
 */
export async function loadFixtureFamilyDPacket(): Promise<FamilyDFixtureResult> {
  try {
    const text = await Deno.readTextFile(FIXTURE_PATH);
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      log('error', 'family_d_fixture_provider_invalid_shape', {
        reason: 'fixture_load_failed',
        status: 'failure',
      });
      return { ok: false, reason: 'fixture_load_failed' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    log('error', 'family_d_fixture_provider_threw', {
      reason: 'fixture_load_failed',
      status: 'failure',
      errorClass: err instanceof Error ? err.name : 'unknown',
    });
    return { ok: false, reason: 'fixture_load_failed' };
  }
}
