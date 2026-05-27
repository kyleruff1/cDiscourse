/**
 * MCP-SERVER-002 — Server-side validator for the Family A request shape.
 *
 * Accepts the MCP-021A wire shape per `classifyArgumentBooleanObservations.ts`
 * inputSchema, PLUS these binding extras:
 *
 *   - schemaVersion MUST equal MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION
 *   - requestedFamilies MUST be a subset of ['parent_relation']
 *   - requestedRawKeys (if non-empty) MUST be a subset of FAMILY_A_RAW_KEYS
 *   - timeoutMs MUST be in [1, 60000]
 *
 * Returns a typed ValidatedFamilyARequest or an error envelope.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §7 — pure validation; no fetch / no I/O
 *   - cdiscourse-doctrine §6 — request shape never includes secrets;
 *     bodies are caller-redacted at the Edge Function boundary (MCP-021C)
 */
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_A_RAW_KEYS } from './familyAKeys.ts';
import type { ValidatedFamilyARequest } from './familyAPrompt.ts';

const SUPPORTED_FAMILIES: readonly string[] = Object.freeze(['parent_relation']);
const MAX_TIMEOUT_MS = 60000;
const MIN_TIMEOUT_MS = 1;
const MAX_BODY_LEN = 8000;
const MAX_THREAD_CONTEXT_LEN = 8000;

export type FamilyARequestValidationFailure =
  | { ok: false; kind: 'invalid_params'; path: string; detail: string }
  | { ok: false; kind: 'unsupported_family'; requestedFamilies: readonly string[] }
  | { ok: false; kind: 'unsupported_rawKey'; unsupportedRawKeys: readonly string[] };

export type FamilyARequestValidationResult =
  | { ok: true; value: ValidatedFamilyARequest }
  | FamilyARequestValidationFailure;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function checkString(value: unknown, path: string, minLen: number, maxLen: number) {
  if (typeof value !== 'string') {
    return { ok: false as const, path, detail: 'must be string' };
  }
  if (value.length < minLen) {
    return { ok: false as const, path, detail: `length below ${minLen}` };
  }
  if (value.length > maxLen) {
    return { ok: false as const, path, detail: `length above ${maxLen}` };
  }
  return { ok: true as const, value };
}

function checkStringOrNull(value: unknown, path: string, maxLen: number) {
  if (value === null) return { ok: true as const, value: null };
  if (typeof value !== 'string') {
    return { ok: false as const, path, detail: 'must be string or null' };
  }
  if (value.length > maxLen) {
    return { ok: false as const, path, detail: `length above ${maxLen}` };
  }
  return { ok: true as const, value };
}

function checkStringArray(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    return { ok: false as const, path, detail: 'must be array' };
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== 'string') {
      return {
        ok: false as const,
        path: `${path}[${i}]`,
        detail: 'must be string',
      };
    }
    out.push(value[i] as string);
  }
  return { ok: true as const, value: out };
}

/**
 * Validate a Family A boolean-observation request. Returns the validated
 * value typed as ValidatedFamilyARequest, or a structured failure.
 *
 * The handler maps failure kinds to MCP error envelopes:
 *   - 'invalid_params'    → errorResult('invalid_params', ...)
 *   - 'unsupported_family'  → errorResult('unsupported_family', ...)
 *   - 'unsupported_rawKey'  → errorResult('unsupported_rawKey', ...)
 */
export function validateFamilyABooleanRequest(
  raw: unknown,
): FamilyARequestValidationResult {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: '$',
      detail: 'must be a plain object',
    };
  }

  // schemaVersion
  if (raw['schemaVersion'] !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: 'schemaVersion',
      detail: `expected ${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}; got ${String(raw['schemaVersion'])}`,
    };
  }

  // nodeId
  const nodeIdCheck = checkString(raw['nodeId'], 'nodeId', 1, 512);
  if (!nodeIdCheck.ok) {
    return { ok: false, kind: 'invalid_params', path: nodeIdCheck.path, detail: nodeIdCheck.detail };
  }

  // parentNodeId (string or null)
  let parentNodeId: string | null = null;
  if ('parentNodeId' in raw) {
    const check = checkStringOrNull(raw['parentNodeId'], 'parentNodeId', 512);
    if (!check.ok) {
      return { ok: false, kind: 'invalid_params', path: check.path, detail: check.detail };
    }
    parentNodeId = check.value;
  }

  // currentText
  const currentTextCheck = checkString(raw['currentText'], 'currentText', 0, MAX_BODY_LEN);
  if (!currentTextCheck.ok) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: currentTextCheck.path,
      detail: currentTextCheck.detail,
    };
  }

  // parentText (string or null; in inputSchema as ['string', 'null'])
  let parentText: string | null = null;
  if ('parentText' in raw) {
    const check = checkStringOrNull(raw['parentText'], 'parentText', MAX_BODY_LEN);
    if (!check.ok) {
      return { ok: false, kind: 'invalid_params', path: check.path, detail: check.detail };
    }
    parentText = check.value;
  }

  // threadContextExcerpt
  const threadCheck = checkString(
    raw['threadContextExcerpt'],
    'threadContextExcerpt',
    0,
    MAX_THREAD_CONTEXT_LEN,
  );
  if (!threadCheck.ok) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: threadCheck.path,
      detail: threadCheck.detail,
    };
  }

  // requestedFamilies
  const familiesCheck = checkStringArray(raw['requestedFamilies'], 'requestedFamilies');
  if (!familiesCheck.ok) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: familiesCheck.path,
      detail: familiesCheck.detail,
    };
  }
  const requestedFamilies = familiesCheck.value;
  for (const family of requestedFamilies) {
    if (!SUPPORTED_FAMILIES.includes(family)) {
      return {
        ok: false,
        kind: 'unsupported_family',
        requestedFamilies,
      };
    }
  }

  // requestedRawKeys (subset of FAMILY_A_RAW_KEYS when non-empty)
  const rawKeysCheck = checkStringArray(raw['requestedRawKeys'], 'requestedRawKeys');
  if (!rawKeysCheck.ok) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: rawKeysCheck.path,
      detail: rawKeysCheck.detail,
    };
  }
  const requestedRawKeys = rawKeysCheck.value;
  const unsupportedKeys: string[] = [];
  for (const key of requestedRawKeys) {
    if (!FAMILY_A_RAW_KEYS.includes(key)) {
      unsupportedKeys.push(key);
    }
  }
  if (unsupportedKeys.length > 0) {
    return {
      ok: false,
      kind: 'unsupported_rawKey',
      unsupportedRawKeys: unsupportedKeys,
    };
  }

  // definitions (accepted but server does not trust caller-supplied
  // definitions — uses its own server-side mirror)
  if (!isPlainObject(raw['definitions'])) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: 'definitions',
      detail: 'must be plain object',
    };
  }

  // timeoutMs
  const timeoutRaw = raw['timeoutMs'];
  if (typeof timeoutRaw !== 'number' || !Number.isInteger(timeoutRaw)) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: 'timeoutMs',
      detail: 'must be integer',
    };
  }
  if (timeoutRaw < MIN_TIMEOUT_MS || timeoutRaw > MAX_TIMEOUT_MS) {
    return {
      ok: false,
      kind: 'invalid_params',
      path: 'timeoutMs',
      detail: `out of range ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS}`,
    };
  }

  return {
    ok: true,
    value: {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: nodeIdCheck.value,
      parentNodeId,
      currentText: currentTextCheck.value,
      parentText,
      threadContextExcerpt: threadCheck.value,
      requestedFamilies,
      requestedRawKeys,
      timeoutMs: timeoutRaw,
    },
  };
}

export { SUPPORTED_FAMILIES };
