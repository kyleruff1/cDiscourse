/**
 * MCP-SERVER-001 — Fixture provider for offline smoke testing.
 *
 * Activated by setting `MCP_SERVER_USE_FIXTURE_PROVIDER=true`. The provider
 * loads the canonical positive response from
 * `fixtures/classify-semantic-move.response.json` and returns it as the
 * model "response". No real Anthropic call, no token consumption — used by
 * the smoke script to verify the full request lifecycle without a real key.
 *
 * PRODUCTION DEPLOYS MUST NOT SET THE FLAG. The runbook documents the kill
 * switch behavior.
 */
import { log } from './logging.ts';

const FIXTURE_PATH = new URL('../fixtures/classify-semantic-move.response.json', import.meta.url);

export type FixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };

export async function loadFixtureSemanticPacket(): Promise<FixtureResult> {
  try {
    const text = await Deno.readTextFile(FIXTURE_PATH);
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      log('error', 'fixture_provider_invalid_shape', {
        reason: 'fixture_load_failed',
        status: 'failure',
      });
      return { ok: false, reason: 'fixture_load_failed' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    log('error', 'fixture_provider_threw', {
      reason: 'fixture_load_failed',
      status: 'failure',
      errorClass: err instanceof Error ? err.name : 'unknown',
    });
    return { ok: false, reason: 'fixture_load_failed' };
  }
}
