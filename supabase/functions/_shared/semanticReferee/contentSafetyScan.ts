/**
 * MCP-017 — Semantic referee Deno-side content-safety scanner (zod-free).
 *
 * The Deno twin of the Stage-5 content-safety scan in MCP-011's
 * `src/features/semanticReferee/semanticRefereeValidator.ts`. The Node
 * validator imports Node `zod` and uses extensionless specifiers, so the Deno
 * boundary cannot import it — this is a parity-tested mirror, the same
 * dual-mirror arrangement `types.ts` already uses.
 *
 * `scanPacketContent(packet)` walks an UNTRUSTED, contract-shaped object and
 * rejects:
 *   - a verdict / outcome token inside any string field (`reasonCode`, a span,
 *     a version string) — a `.strict()` schema cannot express this; the schema
 *     only rejects an unknown KEY, not a banned token inside a valid string;
 *   - a person-label token / phrase inside any string field;
 *   - a secret-shaped or PII-shaped (handle / URL / email / post-id) string;
 *   - a smuggled `block` / `reasoning` / `system_prompt` / copy key (additive
 *     insurance — the `.strict()` `SemanticRefereePacketSchema` already drops
 *     these; this catches one nested inside `binaries[]` / `scoreHints`).
 *
 * On a failure it returns `{ ok: false, reason: 'validation_failed', detail }`
 * — a SANITIZED detail that NEVER echoes the offending value. On a clean
 * packet it returns `{ ok: true }`. It never throws.
 *
 * PARITY: `__tests__/semanticAnthropicContentScanParity.test.ts` reads this
 * file and the Node upstream as source text and fails the build if the
 * ban-list constants drift. A new verdict / person token must be added to
 * BOTH.
 *
 * SAFETY-SCAN NOTE: this file deliberately names verdict / person tokens — they
 * are the ban-list it ENFORCES, not user-facing strings. The secret-prefix
 * literals are ASSEMBLED from `RegExp` fragments (like `redaction.ts`) so the
 * repo secret-literal scan stays green.
 *
 * PURE TYPESCRIPT — imports only `types.ts`. Zero `npm:` imports, so the Jest
 * bridge can `require()` it.
 */
import { SCORE_HINT_FIELDS } from './types.ts';

// ── Ban-list definitions (scanner internals, NOT user-facing) ──────
//
// These MIRROR `src/features/semanticReferee/semanticRefereeValidator.ts`. The
// parity test fails the build if they diverge from the Node upstream.

/**
 * Verdict / outcome tokens — a string carrying any of these (whole word or
 * `snake_case` segment) is rejected. Catches a `reasonCode` like
 * `winner_detected`.
 */
const VERDICT_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'defeated',
];

/** Person-label tokens — a string carrying any of these is rejected. */
const PERSON_LABEL_TOKENS: readonly string[] = [
  'liar',
  'lying',
  'dishonest',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
];

/** Multi-word person-label phrases — scanned as substrings after whitespace collapse. */
const PERSON_LABEL_PHRASES: readonly string[] = ['bad faith'];

/**
 * Secret-shape patterns. The three provider-key prefixes and the service-role
 * marker are ASSEMBLED from fragments via `RegExp` constructors so no
 * contiguous banned literal sits in this source.
 */
const SECRET_KEY_BODY = '[A-Za-z0-9_-]{4,}';
const SECRET_SHAPE_PATTERNS: readonly RegExp[] = [
  new RegExp('sk-' + 'ant-' + SECRET_KEY_BODY, 'i'),
  new RegExp('xai' + '-' + SECRET_KEY_BODY, 'i'),
  new RegExp('sb_' + 'secret_' + SECRET_KEY_BODY, 'i'),
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/,
  /eyJ[A-Za-z0-9_-]{20,}/,
  /Authorization\s*:/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/,
  new RegExp('service' + '[_-]?' + 'role' + '[_-]?' + 'key', 'i'),
];

/** PII-shape patterns — handle / URL / email / post-id. */
const PII_SHAPE_PATTERNS: readonly RegExp[] = [
  /@[A-Za-z0-9_]{1,15}\b/,
  /\b(?:https?:\/\/)?(?:x|twitter)\.com\/[^\s)]+/i,
  /\b(?:https?:\/\/)?t\.co\/[^\s)]+/i,
  /\bhttps?:\/\/\S+/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b\d{15,20}\b/,
];

/** Smuggled / off-contract field names — a key matching any is rejected. */
const BLOCK_FIELD_NAMES: readonly string[] = ['block', 'blocked', 'shouldblock', 'gate'];
const CHAIN_OF_THOUGHT_FIELD_NAMES: readonly string[] = [
  'reasoning',
  'thinking',
  'chain_of_thought',
  'chainofthought',
  'cot',
  'rationale',
  'analysis',
  'scratchpad',
  'deliberation',
];
const RAW_PROMPT_FIELD_NAMES: readonly string[] = [
  'prompt',
  'systemprompt',
  'system_prompt',
  'rawprompt',
  'raw_prompt',
  'promptecho',
  'inputprompt',
];
const COPY_FIELD_NAMES: readonly string[] = [
  'bannertext',
  'displaymessage',
  'usermessage',
  'copy',
  'message',
  'text',
  'label',
];

/** Every smuggled-key family, flattened — the key-name scan reads this set. */
const SMUGGLED_FIELD_NAMES: ReadonlySet<string> = new Set<string>([
  ...BLOCK_FIELD_NAMES,
  ...CHAIN_OF_THOUGHT_FIELD_NAMES,
  ...RAW_PROMPT_FIELD_NAMES,
  ...COPY_FIELD_NAMES,
]);

/** The contract's known top-level keys — anything else is off-contract. */
const KNOWN_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set<string>([
  'packetVersion',
  'promptVersion',
  'modelVersion',
  'provider',
  'authoritative',
  'inputHash',
  'contentHash',
  'roomId',
  'moveId',
  'parentId',
  'selectedAction',
  'selectedMoveType',
  'debateMode',
  'binaries',
  'routeSuggestion',
  'frictionSuggestion',
  'scoreHints',
]);

/** The contract's known `binaries[]` keys. */
const KNOWN_BINARY_KEYS: ReadonlySet<string> = new Set<string>([
  'classifierId',
  'value',
  'confidence',
  'reasonCode',
  'evidenceSpan',
  'parentSpan',
]);

/** The contract's known `scoreHints` keys. */
const KNOWN_SCORE_HINT_KEYS: ReadonlySet<string> = new Set<string>(
  SCORE_HINT_FIELDS as readonly string[],
);

// ── Result type ───────────────────────────────────────────────────

export type ContentScanResult =
  | { ok: true }
  | { ok: false; reason: 'validation_failed'; detail: string };

// ── Helpers ───────────────────────────────────────────────────────

/** Split a string into lowercase word / snake_case segments. */
function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((seg) => seg.length > 0);
}

/**
 * Classify one string against the content ban-lists. Returns a SANITIZED
 * category description (never the offending value), or `null` if the string is
 * safe.
 */
function unsafeStringCategory(value: string): string | null {
  const segmentSet = new Set(tokenSegments(value));
  for (const token of VERDICT_TOKENS) {
    if (segmentSet.has(token)) return 'a verdict / outcome token';
  }
  for (const token of PERSON_LABEL_TOKENS) {
    if (segmentSet.has(token)) return 'a person-label token';
  }
  const collapsed = value.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const phrase of PERSON_LABEL_PHRASES) {
    if (collapsed.includes(phrase)) return 'a person-label phrase';
  }
  for (const pattern of SECRET_SHAPE_PATTERNS) {
    if (pattern.test(value)) return 'a key-shaped or credential-shaped string';
  }
  for (const pattern of PII_SHAPE_PATTERNS) {
    if (pattern.test(value)) return 'a handle / URL / email / id-shaped string';
  }
  return null;
}

function fail(detail: string): ContentScanResult {
  return { ok: false, reason: 'validation_failed', detail };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Scan one key for a smuggled / off-contract name. `known` is the set of
 * contract-legal keys at this nesting level. A key not in `known` is rejected;
 * if it additionally matches a smuggled-field family the detail names that
 * family.
 */
function scanKey(key: string, known: ReadonlySet<string>, scope: string): ContentScanResult | null {
  if (known.has(key)) return null;
  const lower = key.toLowerCase();
  if (BLOCK_FIELD_NAMES.includes(lower)) {
    return fail(`${scope} carried a blocking field — the packet contract has no blocking field`);
  }
  if (CHAIN_OF_THOUGHT_FIELD_NAMES.includes(lower)) {
    return fail(`${scope} carried a chain-of-thought field, which is not part of the contract`);
  }
  if (RAW_PROMPT_FIELD_NAMES.includes(lower)) {
    return fail(`${scope} carried a raw-prompt field, which is not part of the contract`);
  }
  if (COPY_FIELD_NAMES.includes(lower)) {
    return fail(`${scope} carried a user-facing copy field — the packet carries no copy`);
  }
  if (SMUGGLED_FIELD_NAMES.has(lower)) {
    return fail(`${scope} carried an off-contract field`);
  }
  return fail(`${scope} carried an unrecognized field`);
}

// ── Public surface ────────────────────────────────────────────────

/**
 * Scan an untrusted, contract-shaped object for unsafe content. Returns
 * `{ ok: true }` ONLY when every string field is clean and no off-contract /
 * smuggled key is present. Otherwise returns
 * `{ ok: false, reason: 'validation_failed', detail }` with a SANITIZED detail.
 * Never throws.
 *
 * This is additive insurance on top of the `.strict()`
 * `SemanticRefereePacketSchema`: the schema rejects an unknown KEY, this
 * rejects a banned TOKEN inside an otherwise-valid string value.
 */
export function scanPacketContent(packet: unknown): ContentScanResult {
  if (!isPlainObject(packet)) {
    return fail('packet is not an object');
  }

  // Top-level keys.
  for (const key of Object.keys(packet)) {
    const keyResult = scanKey(key, KNOWN_TOP_LEVEL_KEYS, 'the packet');
    if (keyResult) return keyResult;
  }

  // Top-level string fields.
  const topLevelStringFields: readonly string[] = [
    'packetVersion',
    'promptVersion',
    'modelVersion',
    'provider',
    'inputHash',
    'contentHash',
    'roomId',
    'moveId',
    'parentId',
    'selectedAction',
    'selectedMoveType',
    'debateMode',
    'routeSuggestion',
    'frictionSuggestion',
  ];
  for (const field of topLevelStringFields) {
    const value = packet[field];
    if (typeof value !== 'string') continue;
    const category = unsafeStringCategory(value);
    if (category) return fail(`the ${field} field contained ${category}`);
  }

  // binaries[].
  const binaries = packet['binaries'];
  if (Array.isArray(binaries)) {
    for (let i = 0; i < binaries.length; i += 1) {
      const binary = binaries[i];
      if (!isPlainObject(binary)) continue;
      for (const key of Object.keys(binary)) {
        const keyResult = scanKey(key, KNOWN_BINARY_KEYS, `binaries[${i}]`);
        if (keyResult) return keyResult;
      }
      for (const field of ['reasonCode', 'evidenceSpan', 'parentSpan'] as const) {
        const value = binary[field];
        if (typeof value !== 'string') continue;
        const category = unsafeStringCategory(value);
        if (category) return fail(`binaries[${i}].${field} contained ${category}`);
      }
    }
  }

  // scoreHints.
  const scoreHints = packet['scoreHints'];
  if (isPlainObject(scoreHints)) {
    for (const key of Object.keys(scoreHints)) {
      const keyResult = scanKey(key, KNOWN_SCORE_HINT_KEYS, 'scoreHints');
      if (keyResult) return keyResult;
    }
  }

  return { ok: true };
}
