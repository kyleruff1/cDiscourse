/**
 * MCP-SERVER-011-FAMILY-J — Family J fixture provider for offline smoke testing.
 *
 * Activated when `MCP_SERVER_USE_FIXTURE_PROVIDER=true`. Loads the canonical
 * Family J response from
 * `fixtures/classify-argument-boolean-observations.family-j-canonical-response.json`
 * and returns it as the model "response". No real Anthropic call, no token
 * consumption — used by the smoke script (Checks 40 + 41) to verify the
 * full request lifecycle without a real key.
 *
 * PRODUCTION DEPLOYS MUST NOT SET THE FLAG. The runbook documents the kill
 * switch behavior.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — server-side only; no AI provider call.
 */
import { log } from './logging.ts';

const CANONICAL_FIXTURE_NAME =
  'classify-argument-boolean-observations.family-j-canonical-response.json';

/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — test-only fixture-name override. When
 * `MCP_SERVER_FAMILY_J_FIXTURE_NAME` is set (only ever in the Deno test suite,
 * alongside `MCP_SERVER_USE_FIXTURE_PROVIDER=true`), the provider loads that
 * fixture by NAME from `../fixtures/` instead of the canonical clean packet —
 * so a dispatcher-level test can drive the key-level fail-closed branch with a
 * packet whose `needs_pre_send_pause` span is unclean. The name is resolved
 * within the fixtures dir only; production deploys never set the fixture
 * provider flag, let alone this override. Default (unset) is byte-identical to
 * before this card: the canonical fixture.
 */
function resolveFixturePath(): URL {
  const override = Deno.env.get('MCP_SERVER_FAMILY_J_FIXTURE_NAME');
  const name =
    typeof override === 'string' && override.length > 0 ? override : CANONICAL_FIXTURE_NAME;
  // Resolve within the fixtures dir only — strip any path separators so the
  // override can never escape `../fixtures/`.
  const safeName = name.replace(/[\\/]/g, '');
  return new URL(`../fixtures/${safeName}`, import.meta.url);
}

export type FamilyJFixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };

/**
 * Load the Family J canonical response fixture. Returns the parsed JSON
 * object, or a structured failure. Caller treats failure as a key_missing
 * style fallback that the Edge Function can recover from deterministically.
 */
export async function loadFixtureFamilyJPacket(): Promise<FamilyJFixtureResult> {
  try {
    const text = await Deno.readTextFile(resolveFixturePath());
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      log('error', 'family_j_fixture_provider_invalid_shape', {
        reason: 'fixture_load_failed',
        status: 'failure',
      });
      return { ok: false, reason: 'fixture_load_failed' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    log('error', 'family_j_fixture_provider_threw', {
      reason: 'fixture_load_failed',
      status: 'failure',
      errorClass: err instanceof Error ? err.name : 'unknown',
    });
    return { ok: false, reason: 'fixture_load_failed' };
  }
}
