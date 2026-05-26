/**
 * MCP-SERVER-001 — GET /health endpoint.
 *
 * Unauthenticated by design (see design §8.3). The endpoint is for uptime
 * monitoring and the smoke script's first phase. It MUST NOT leak any
 * environment-sensitive value: `credentialsConfigured` is a boolean (not a
 * value), `version` is the public semver, `environment` is a low-cardinality
 * enum.
 *
 * No model call. Cheap; safe to hit at high frequency.
 */
import { log } from '../lib/logging.ts';

export const SERVER_VERSION = '0.1.0';

export const SUPPORTED_TOOLS: readonly string[] = Object.freeze([
  'classify_semantic_move',
  'classify_argument_boolean_observations',
]);

export type HealthEnvironment = 'local' | 'dev' | 'staging' | 'prod' | 'unknown';

function normalizeEnvironment(raw: string | undefined): HealthEnvironment {
  if (raw === 'local' || raw === 'dev' || raw === 'staging' || raw === 'prod') return raw;
  return 'unknown';
}

export interface HealthResponseBody {
  status: 'ok';
  version: string;
  environment: HealthEnvironment;
  supportedTools: readonly string[];
  credentialsConfigured: boolean;
  protocolVersion: string;
  timestamp: string;
}

export interface HealthInputs {
  bearerToken: string | undefined;
  anthropicKey: string | undefined;
  environment: string | undefined;
  protocolVersion: string;
  /** Override for tests; defaults to current ISO timestamp. */
  now?: () => string;
}

export function buildHealthBody(inputs: HealthInputs): HealthResponseBody {
  const now = inputs.now ?? (() => new Date().toISOString());
  return {
    status: 'ok',
    version: SERVER_VERSION,
    environment: normalizeEnvironment(inputs.environment),
    supportedTools: SUPPORTED_TOOLS,
    credentialsConfigured:
      typeof inputs.bearerToken === 'string' &&
      inputs.bearerToken.length > 0 &&
      typeof inputs.anthropicKey === 'string' &&
      inputs.anthropicKey.length > 0,
    protocolVersion: inputs.protocolVersion,
    timestamp: now(),
  };
}

/** HTTP handler — pulls config from Deno env, no caller-supplied inputs read. */
export function handleHealth(
  requestId: string,
  protocolVersion: string,
): Response {
  const body = buildHealthBody({
    bearerToken: Deno.env.get('MCP_SERVER_BEARER_TOKEN'),
    anthropicKey: Deno.env.get('ANTHROPIC_API_KEY'),
    environment: Deno.env.get('MCP_SERVER_ENV'),
    protocolVersion,
  });
  log('info', 'health_check', {
    requestId,
    endpoint: '/health',
    httpStatus: 200,
    status: 'success',
  });
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': protocolVersion,
      'X-Request-Id': requestId,
    },
  });
}
