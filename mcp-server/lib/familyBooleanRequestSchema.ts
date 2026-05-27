/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Server-side validator for the
 * boolean-observation request shape (multi-family-capable; routes via the
 * FamilyValidatorRegistry).
 *
 * Accepts the MCP-021A wire shape per `classifyArgumentBooleanObservations.ts`
 * inputSchema, PLUS these binding extras:
 *
 *   - schemaVersion MUST equal MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION
 *   - requestedFamilies entries MUST be registered families
 *     (per familyRegistry.isFamilySupported)
 *   - requestedRawKeys (if non-empty) MUST be supported by the requested
 *     family (per familyRegistry.isRawKeySupportedForFamily). When
 *     requestedFamilies is empty, raw-key checks default to 'parent_relation'
 *     — the only family currently registered (Family A) — preserving
 *     pre-refactor behavior byte-equal.
 *   - timeoutMs MUST be in [1, 60000]
 *
 * Returns a typed ValidatedFamilyARequest or an error envelope. The success-
 * envelope value type stays `ValidatedFamilyARequest` per design §4.5 (the
 * type rename to a discriminated union is deferred to MCP-SERVER-003-FAMILY-B).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §7 — pure validation; no fetch / no I/O
 *   - cdiscourse-doctrine §6 — request shape never includes secrets;
 *     bodies are caller-redacted at the Edge Function boundary (MCP-021C)
 *   - cdiscourse-doctrine §10a — request validator runs BELOW the
 *     observation-emit layer; encodes no verdict
 */
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchemaMirror.ts';
import { isFamilySupported, isRawKeySupportedForFamily } from './familyRegistry.ts';
import type { ValidatedFamilyARequest } from './familyAPrompt.ts';

const MAX_TIMEOUT_MS = 60000;
const MIN_TIMEOUT_MS = 1;
const MAX_BODY_LEN = 8000;
const MAX_THREAD_CONTEXT_LEN = 8000;

/**
 * Default family used for raw-key membership checks when the caller passes an
 * empty requestedFamilies array. Preserves pre-refactor behavior byte-equal
 * (the original validator hard-coded Family A's rawKeys for ALL requests; in
 * the multi-family world, when no family is named the raw-key check still
 * routes to Family A — the only registered family).
 *
 * When Family B/C/D/E land and callers can pass requestedFamilies=[]
 * meaningfully across multiple families, this default will need to be
 * revisited. For now it is the byte-equal-preservation anchor.
 */
const DEFAULT_FAMILY_FOR_RAWKEY_CHECK = 'parent_relation';

export type FamilyRequestValidationFailure =
  | { ok: false; kind: 'invalid_params'; path: string; detail: string }
  | { ok: false; kind: 'unsupported_family'; requestedFamilies: readonly string[] }
  | { ok: false; kind: 'unsupported_rawKey'; unsupportedRawKeys: readonly string[] };

export type FamilyRequestValidationResult =
  | { ok: true; value: ValidatedFamilyARequest }
  | FamilyRequestValidationFailure;

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
 * Validate a boolean-observation request against the registered families.
 * Returns the validated value typed as ValidatedFamilyARequest, or a
 * structured failure.
 *
 * Routing semantics:
 *   - requestedFamilies entries are checked against the registry's
 *     `isFamilySupported`.
 *   - requestedRawKeys entries are checked against the requested family's
 *     rawKey set. If requestedFamilies is empty, raw-key checks default
 *     to 'parent_relation' (preserves pre-refactor byte-equal behavior;
 *     Family A is the only registered family in the current server build).
 *
 * The handler maps failure kinds to MCP error envelopes:
 *   - 'invalid_params'      → errorResult('invalid_params', ...)
 *   - 'unsupported_family'  → errorResult('unsupported_family', ...)
 *   - 'unsupported_rawKey'  → errorResult('unsupported_rawKey', ...)
 */
export function validateFamilyBooleanRequest(
  raw: unknown,
): FamilyRequestValidationResult {
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

  // requestedFamilies — each entry must be a registered family.
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
    if (!isFamilySupported(family)) {
      return {
        ok: false,
        kind: 'unsupported_family',
        requestedFamilies,
      };
    }
  }

  // requestedRawKeys — each entry must belong to one of the requested
  // families. When requestedFamilies is empty, default to the byte-equal
  // anchor (parent_relation / Family A) so the original "subset of
  // FAMILY_A_RAW_KEYS" semantics survive the refactor.
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
  const familiesToCheck: readonly string[] =
    requestedFamilies.length > 0 ? requestedFamilies : [DEFAULT_FAMILY_FOR_RAWKEY_CHECK];
  const unsupportedKeys: string[] = [];
  for (const key of requestedRawKeys) {
    let supportedBySomeFamily = false;
    for (const family of familiesToCheck) {
      if (isRawKeySupportedForFamily(family, key)) {
        supportedBySomeFamily = true;
        break;
      }
    }
    if (!supportedBySomeFamily) {
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
