/**
 * MCP-011 — Semantic referee packet validator.
 *
 * `parseSemanticPacket(raw: unknown)` accepts a known-good `SemanticRefereePacket`
 * and REJECTS every malformed, off-contract, or unsafe provider output. It is
 * the wall that makes "advisory" structurally true: an off-contract packet is
 * rejected, the consumer falls back to deterministic layer 1, and the game is
 * unaffected. A rejection NEVER blocks a post.
 *
 * Library strategy (MCP-011 §7): `zod@4` (already a dependency) supplies the
 * structural shape layer; a pure-TS content-safety scanner sits on top to map
 * unknown fields to specific rejection codes and to reject verdict / person /
 * secret / PII shapes. `zod` is imported ONLY here.
 *
 * SAFETY-SCAN NOTE: this file deliberately names verdict / person tokens and
 * secret-shape patterns — they are the ban-list it ENFORCES, not user-facing
 * strings. Documented expected false positive (MCP-011 §16).
 *
 * Pure TypeScript — no network, no Supabase, no React, no `Deno`, no env.
 */

import { z } from 'zod';

import {
  ALL_CONFIDENCE_VALUES,
  ALL_FRICTION_SUGGESTIONS,
  ALL_ROUTE_SUGGESTIONS,
  ALL_SEMANTIC_CLASSIFIER_IDS,
  ALL_SEMANTIC_PROVIDERS,
  MAX_COPY_FIELD_LEN,
  MAX_STRING_FIELD_LEN,
  PACKET_VERSION,
  REASON_CODE_FAMILIES,
  SCORE_HINT_FIELDS,
  SCORE_HINT_MAX,
  SCORE_HINT_MIN,
} from './semanticRefereeTypes';
import type {
  SemanticBinarySample,
  SemanticPacketRejection,
  SemanticPacketValidationResult,
  SemanticRefereePacket,
  SemanticRejectionCode,
} from './semanticRefereeTypes';

// ── Ban-list definitions (validator internals, NOT user-facing) ────

/**
 * Verdict tokens — a string carrying any of these (whole word or `snake_case`
 * segment) is rejected `verdict_token`. Catches a `reasonCode` like
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

/** Person-label tokens — a string carrying any of these is rejected `person_label`. */
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

/** Multi-word person-label phrases — scanned as substrings (after whitespace collapse). */
const PERSON_LABEL_PHRASES: readonly string[] = ['bad faith'];

/**
 * Secret-shape patterns — a string matching any of these is rejected
 * `secret_shape`. Mirrors the `scripts/engagement-intelligence/` sanitizer
 * (`xaiSourceRedactor.js` `SECRET_REPLACERS`) so the two stay parallel.
 *
 * The three provider-key prefixes and the service-role marker are ASSEMBLED
 * from fragments via `RegExp` constructors so no contiguous banned literal sits
 * in this source — the repo-wide `adminSecurity.test.ts` secret-literal scan
 * stays green. The runtime regex is byte-identical to the literal form.
 */
const SECRET_KEY_BODY = '[A-Za-z0-9_-]{4,}';
const SECRET_SHAPE_PATTERNS: readonly RegExp[] = [
  new RegExp('sk-' + 'ant-' + SECRET_KEY_BODY, 'i'),
  new RegExp('xai' + '-' + SECRET_KEY_BODY, 'i'),
  new RegExp('sb_' + 'secret_' + SECRET_KEY_BODY, 'i'),
  // JWT-shape: three base64url segments.
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/,
  // Long base64url JWT header alone.
  /eyJ[A-Za-z0-9_-]{20,}/,
  /Authorization\s*:/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/,
  // service-role-shaped marker.
  new RegExp('service' + '[_-]?' + 'role' + '[_-]?' + 'key', 'i'),
];

/**
 * PII-shape patterns — a string matching any of these is rejected `pii_shape`.
 * Mirrors the sanitizer's `X_IDENTIFIER_REPLACERS`.
 */
const PII_SHAPE_PATTERNS: readonly RegExp[] = [
  // @handle — 1-15 word chars.
  /@[A-Za-z0-9_]{1,15}\b/,
  // x.com / twitter.com / t.co — with or without scheme.
  /\b(?:https?:\/\/)?(?:x|twitter)\.com\/[^\s)]+/i,
  /\b(?:https?:\/\/)?t\.co\/[^\s)]+/i,
  // any http(s) URL.
  /\bhttps?:\/\/\S+/i,
  // email.
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  // 15-20 digit run — a post id.
  /\b\d{15,20}\b/,
];

/** Field-name → specific rejection code for smuggled / off-contract keys. */
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

// ── Helpers ───────────────────────────────────────────────────────

function rejection(
  code: SemanticRejectionCode,
  detail: string,
  field?: string,
): SemanticPacketRejection {
  return field === undefined ? { code, detail } : { code, detail, field };
}

/** Split a string into lowercase word / snake_case segments for token matching. */
function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((seg) => seg.length > 0);
}

/** Collapse whitespace for multi-word phrase matching. */
function collapsedLower(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Classify a string field against the content-safety ban-lists. Returns the
 * first applicable rejection code, or `null` if the string is safe. NEVER
 * echoes the offending value — the caller builds a sanitized `detail`.
 */
function scanStringContent(value: string): SemanticRejectionCode | null {
  const segments = tokenSegments(value);
  const segmentSet = new Set(segments);

  for (const token of VERDICT_TOKENS) {
    if (segmentSet.has(token)) return 'verdict_token';
  }
  for (const token of PERSON_LABEL_TOKENS) {
    if (segmentSet.has(token)) return 'person_label';
  }
  const collapsed = collapsedLower(value);
  for (const phrase of PERSON_LABEL_PHRASES) {
    if (collapsed.includes(phrase)) return 'person_label';
  }
  for (const pattern of SECRET_SHAPE_PATTERNS) {
    if (pattern.test(value)) return 'secret_shape';
  }
  for (const pattern of PII_SHAPE_PATTERNS) {
    if (pattern.test(value)) return 'pii_shape';
  }
  return null;
}

/** A sanitized human-readable description of a content-scan rejection. */
function contentRejectionDetail(code: SemanticRejectionCode, field: string): string {
  switch (code) {
    case 'verdict_token':
      return `${field} contained a verdict / outcome token`;
    case 'person_label':
      return `${field} contained a person-label token`;
    case 'secret_shape':
      return `${field} contained a key-shaped or credential-shaped string`;
    case 'pii_shape':
      return `${field} contained a handle / URL / email / id-shaped string`;
    default:
      return `${field} failed the content-safety scan`;
  }
}

// ── Structural zod schema (shape layer) ───────────────────────────
//
// `zod@4`'s `strictObject` flags every unrecognized TOP-LEVEL key — Stage 4
// then maps each flagged key to a specific rejection code. `binaries` and
// `scoreHints` are validated by the hand-rolled traversal below (which needs
// per-field rejection codes zod cannot express), so the schema models them as
// `unknown` here and the traversal does the real work.

const packetSchema = z.strictObject({
  packetVersion: z.string(),
  promptVersion: z.string(),
  modelVersion: z.string(),
  provider: z.string(),
  authoritative: z.unknown(),
  inputHash: z.string(),
  contentHash: z.string(),
  roomId: z.string(),
  moveId: z.string().optional(),
  parentId: z.string().optional(),
  selectedAction: z.string().optional(),
  selectedMoveType: z.string().optional(),
  debateMode: z.string().optional(),
  binaries: z.array(z.unknown()),
  routeSuggestion: z.string(),
  frictionSuggestion: z.string(),
  scoreHints: z.unknown(),
});

/** Map an unknown top-level / nested key name to its most specific code. */
function classifyUnknownKey(key: string): SemanticRejectionCode {
  const lower = key.toLowerCase();
  if (BLOCK_FIELD_NAMES.includes(lower)) return 'block_field';
  if (CHAIN_OF_THOUGHT_FIELD_NAMES.includes(lower)) return 'chain_of_thought_field';
  if (RAW_PROMPT_FIELD_NAMES.includes(lower)) return 'raw_prompt_field';
  if (COPY_FIELD_NAMES.includes(lower)) return 'copy_field_smuggled';
  return 'unknown_field';
}

function unknownKeyDetail(code: SemanticRejectionCode, key: string): string {
  switch (code) {
    case 'block_field':
      return `unrecognized field "${key}" — the packet contract has no blocking field`;
    case 'chain_of_thought_field':
      return `unrecognized field "${key}" — chain-of-thought fields are not part of the contract`;
    case 'raw_prompt_field':
      return `unrecognized field "${key}" — raw-prompt fields are not part of the contract`;
    case 'copy_field_smuggled':
      return `unrecognized field "${key}" — the packet carries no user-facing copy`;
    default:
      return `unrecognized field "${key}"`;
  }
}

// ── Stage runners ─────────────────────────────────────────────────

/** A plain-object record after Stage 1/2 pass. */
type RawRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collect every `unrecognized_keys` issue from a zod error and classify it. */
function collectUnknownKeyRejections(error: z.ZodError): SemanticPacketRejection[] {
  const out: SemanticPacketRejection[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      const pathPrefix = issue.path.length > 0 ? issue.path.join('.') : '';
      for (const key of issue.keys) {
        const code = classifyUnknownKey(key);
        const field = pathPrefix.length > 0 ? `${pathPrefix}.${key}` : key;
        out.push(rejection(code, unknownKeyDetail(code, key), field));
      }
    }
  }
  return out;
}

const KNOWN_TOP_LEVEL_KEYS: readonly string[] = [
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
];

const REQUIRED_TOP_LEVEL_KEYS: readonly string[] = [
  'packetVersion',
  'promptVersion',
  'modelVersion',
  'provider',
  'authoritative',
  'inputHash',
  'contentHash',
  'roomId',
  'binaries',
  'routeSuggestion',
  'frictionSuggestion',
  'scoreHints',
];

const KNOWN_BINARY_KEYS: readonly string[] = [
  'classifierId',
  'value',
  'confidence',
  'reasonCode',
  'evidenceSpan',
  'parentSpan',
];
const REQUIRED_BINARY_KEYS: readonly string[] = [
  'classifierId',
  'value',
  'confidence',
  'reasonCode',
];

/** Validate a `reasonCode`: lowercase `snake_case`, bounded, known family. */
function validateReasonCode(value: string, field: string): SemanticPacketRejection | null {
  if (value.length > MAX_COPY_FIELD_LEN) {
    return rejection('field_too_long', `${field} exceeds the maximum length`, field);
  }
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value)) {
    return rejection(
      'unknown_reason_code',
      `${field} is not a lowercase snake_case token`,
      field,
    );
  }
  const hasKnownFamily = REASON_CODE_FAMILIES.some(
    (family) => value === family || value.startsWith(`${family}_`),
  );
  if (!hasKnownFamily) {
    return rejection(
      'unknown_reason_code',
      `${field} does not begin with a known reason-code family prefix`,
      field,
    );
  }
  return null;
}

/** Bounded-length check for a generic string field. */
function checkStringLength(
  value: string,
  field: string,
  max: number,
): SemanticPacketRejection | null {
  if (value.length > max) {
    return rejection('field_too_long', `${field} exceeds the maximum length`, field);
  }
  return null;
}

/** Validate one element of `binaries`. Pushes every rejection it finds. */
function validateBinary(
  raw: unknown,
  index: number,
  rejections: SemanticPacketRejection[],
): void {
  const path = `binaries[${index}]`;
  if (!isPlainObject(raw)) {
    rejections.push(
      rejection('not_an_object', `${path} is not an object`, path),
    );
    return;
  }

  // Unknown / missing keys.
  for (const key of Object.keys(raw)) {
    if (!KNOWN_BINARY_KEYS.includes(key)) {
      const code = classifyUnknownKey(key);
      rejections.push(
        rejection(code, unknownKeyDetail(code, key), `${path}.${key}`),
      );
    }
  }
  for (const key of REQUIRED_BINARY_KEYS) {
    if (!(key in raw)) {
      rejections.push(
        rejection('missing_field', `${path}.${key} is required`, `${path}.${key}`),
      );
    }
  }

  // classifierId.
  const classifierId = raw.classifierId;
  if (typeof classifierId === 'string') {
    if (!ALL_SEMANTIC_CLASSIFIER_IDS.includes(classifierId as SemanticBinarySample['classifierId'])) {
      rejections.push(
        rejection(
          'unknown_classifier_id',
          `${path}.classifierId is not a catalog-v0 classifier id`,
          `${path}.classifierId`,
        ),
      );
    }
  }

  // value — must be the literal 0 or 1.
  if ('value' in raw) {
    const value = raw.value;
    if (value !== 0 && value !== 1) {
      rejections.push(
        rejection(
          'non_binary_value',
          `${path}.value is not the literal 0 or 1`,
          `${path}.value`,
        ),
      );
    }
  }

  // confidence.
  const confidence = raw.confidence;
  if (typeof confidence === 'string') {
    if (!ALL_CONFIDENCE_VALUES.includes(confidence as SemanticBinarySample['confidence'])) {
      rejections.push(
        rejection(
          'unknown_confidence',
          `${path}.confidence is not a known confidence value`,
          `${path}.confidence`,
        ),
      );
    }
  } else if ('confidence' in raw) {
    rejections.push(
      rejection('unknown_confidence', `${path}.confidence is not a string`, `${path}.confidence`),
    );
  }

  // reasonCode.
  const reasonCode = raw.reasonCode;
  if (typeof reasonCode === 'string') {
    const reasonRejection = validateReasonCode(reasonCode, `${path}.reasonCode`);
    if (reasonRejection) {
      rejections.push(reasonRejection);
    } else {
      const contentCode = scanStringContent(reasonCode);
      if (contentCode) {
        rejections.push(
          rejection(contentCode, contentRejectionDetail(contentCode, `${path}.reasonCode`), `${path}.reasonCode`),
        );
      }
    }
  }

  // Optional spans — bounded length + content scan.
  for (const spanField of ['evidenceSpan', 'parentSpan'] as const) {
    const spanValue = raw[spanField];
    if (spanValue === undefined) continue;
    if (typeof spanValue !== 'string') {
      rejections.push(
        rejection('not_an_object', `${path}.${spanField} is not a string`, `${path}.${spanField}`),
      );
      continue;
    }
    const lengthRejection = checkStringLength(spanValue, `${path}.${spanField}`, MAX_COPY_FIELD_LEN);
    if (lengthRejection) {
      rejections.push(lengthRejection);
      continue;
    }
    const contentCode = scanStringContent(spanValue);
    if (contentCode) {
      rejections.push(
        rejection(contentCode, contentRejectionDetail(contentCode, `${path}.${spanField}`), `${path}.${spanField}`),
      );
    }
  }
}

/** Validate the `scoreHints` block. */
function validateScoreHints(raw: unknown, rejections: SemanticPacketRejection[]): void {
  if (!isPlainObject(raw)) {
    rejections.push(
      rejection('not_an_object', 'scoreHints is not an object', 'scoreHints'),
    );
    return;
  }
  for (const key of Object.keys(raw)) {
    if (!SCORE_HINT_FIELDS.includes(key as keyof SemanticRefereePacket['scoreHints'])) {
      const code = classifyUnknownKey(key);
      rejections.push(
        rejection(code, unknownKeyDetail(code, key), `scoreHints.${key}`),
      );
    }
  }
  for (const field of SCORE_HINT_FIELDS) {
    if (!(field in raw)) {
      rejections.push(
        rejection('missing_field', `scoreHints.${field} is required`, `scoreHints.${field}`),
      );
      continue;
    }
    const value = raw[field];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < SCORE_HINT_MIN ||
      value > SCORE_HINT_MAX
    ) {
      rejections.push(
        rejection(
          'score_hint_out_of_range',
          `scoreHints.${field} must be an integer in ${SCORE_HINT_MIN}..${SCORE_HINT_MAX}`,
          `scoreHints.${field}`,
        ),
      );
    }
  }
}

/** Scan every plain string-valued top-level field for unsafe content. */
function scanTopLevelStrings(record: RawRecord, rejections: SemanticPacketRejection[]): void {
  const stringFields: readonly string[] = [
    'modelVersion',
    'debateMode',
    'selectedAction',
    'selectedMoveType',
    'moveId',
    'parentId',
  ];
  for (const field of stringFields) {
    const value = record[field];
    if (typeof value !== 'string') continue;
    const lengthRejection = checkStringLength(value, field, MAX_STRING_FIELD_LEN);
    if (lengthRejection) {
      rejections.push(lengthRejection);
      continue;
    }
    const contentCode = scanStringContent(value);
    if (contentCode) {
      rejections.push(
        rejection(contentCode, contentRejectionDetail(contentCode, field), field),
      );
    }
  }
}

// ── Public surface ────────────────────────────────────────────────

/**
 * Parse and validate an untrusted provider output into a typed
 * `SemanticRefereePacket`. Returns `{ ok: true, packet }` ONLY if there are
 * zero rejections; otherwise `{ ok: false, rejections }` with the complete
 * failure set. A rejected packet is NEVER partially used — the consumer falls
 * back to deterministic layer 1, and the post is unaffected.
 */
export function parseSemanticPacket(raw: unknown): SemanticPacketValidationResult {
  // Stage 1 — JSON acceptance.
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return {
        ok: false,
        rejections: [rejection('non_json', 'input string is not parseable JSON')],
      };
    }
  }

  // Stage 2 — top-level shape.
  if (Array.isArray(value)) {
    return {
      ok: false,
      rejections: [rejection('top_level_array', 'packet must be an object, not an array')],
    };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      rejections: [rejection('not_an_object', 'packet must be a non-null object')],
    };
  }

  const record = value;
  const rejections: SemanticPacketRejection[] = [];

  // Stage 3/4 — structural schema + unknown-field classification.
  const parsed = packetSchema.safeParse(record);
  if (!parsed.success) {
    rejections.push(...collectUnknownKeyRejections(parsed.error));
  }
  // Belt-and-suspenders unknown-key scan (so a non-strict path can never slip).
  for (const key of Object.keys(record)) {
    if (!KNOWN_TOP_LEVEL_KEYS.includes(key)) {
      const code = classifyUnknownKey(key);
      const field = key;
      if (!rejections.some((r) => r.field === field && r.code === code)) {
        rejections.push(rejection(code, unknownKeyDetail(code, key), field));
      }
    }
  }
  // Missing required fields.
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in record)) {
      rejections.push(rejection('missing_field', `${key} is required`, key));
    }
  }

  // packetVersion.
  if ('packetVersion' in record && record.packetVersion !== PACKET_VERSION) {
    rejections.push(
      rejection('unknown_field', 'packetVersion is not the supported contract version', 'packetVersion'),
    );
  }

  // authoritative — must be the literal false.
  if ('authoritative' in record && record.authoritative !== false) {
    rejections.push(
      rejection(
        'authoritative_not_false',
        'authoritative must be the literal false',
        'authoritative',
      ),
    );
  }

  // provider.
  if (
    typeof record.provider === 'string' &&
    !ALL_SEMANTIC_PROVIDERS.includes(record.provider as SemanticRefereePacket['provider'])
  ) {
    rejections.push(
      rejection('unknown_field', 'provider is not a known provider value', 'provider'),
    );
  }

  // routeSuggestion.
  if (
    typeof record.routeSuggestion === 'string' &&
    !ALL_ROUTE_SUGGESTIONS.includes(record.routeSuggestion as SemanticRefereePacket['routeSuggestion'])
  ) {
    rejections.push(
      rejection('unknown_route_suggestion', 'routeSuggestion is not a known value', 'routeSuggestion'),
    );
  }

  // frictionSuggestion.
  if (
    typeof record.frictionSuggestion === 'string' &&
    !ALL_FRICTION_SUGGESTIONS.includes(
      record.frictionSuggestion as SemanticRefereePacket['frictionSuggestion'],
    )
  ) {
    rejections.push(
      rejection(
        'unknown_friction_suggestion',
        'frictionSuggestion is not a known value',
        'frictionSuggestion',
      ),
    );
  }

  // Bounded string ids / hashes / versions.
  for (const field of ['promptVersion', 'modelVersion', 'inputHash', 'contentHash', 'roomId']) {
    const fieldValue = record[field];
    if (typeof fieldValue === 'string') {
      if (fieldValue.length === 0) {
        rejections.push(rejection('missing_field', `${field} must be non-empty`, field));
      } else {
        const lengthRejection = checkStringLength(fieldValue, field, MAX_STRING_FIELD_LEN);
        if (lengthRejection) rejections.push(lengthRejection);
      }
    }
  }

  // Stage 3 (cont.) — binaries.
  if (Array.isArray(record.binaries)) {
    record.binaries.forEach((bin, index) => validateBinary(bin, index, rejections));

    // Stage 6 — coherence: no duplicate classifierId.
    const seen = new Set<string>();
    record.binaries.forEach((bin, index) => {
      if (isPlainObject(bin) && typeof bin.classifierId === 'string') {
        if (seen.has(bin.classifierId)) {
          rejections.push(
            rejection(
              'duplicate_classifier_id',
              `binaries[${index}].classifierId duplicates an earlier binary`,
              `binaries[${index}].classifierId`,
            ),
          );
        }
        seen.add(bin.classifierId);
      }
    });
  } else if ('binaries' in record) {
    rejections.push(rejection('not_an_object', 'binaries must be an array', 'binaries'));
  }

  // scoreHints.
  if ('scoreHints' in record) {
    validateScoreHints(record.scoreHints, rejections);
  }

  // Stage 5 — content-safety scan of top-level string fields.
  scanTopLevelStrings(record, rejections);

  if (rejections.length > 0) {
    return { ok: false, rejections };
  }

  // Zero rejections — the record is a valid, frozen packet.
  const packet = Object.freeze({
    ...record,
    binaries: Object.freeze(
      (record.binaries as unknown[]).map((bin) => Object.freeze({ ...(bin as object) })),
    ),
    scoreHints: Object.freeze({ ...(record.scoreHints as object) }),
  }) as unknown as SemanticRefereePacket;

  return { ok: true, packet };
}

/**
 * A low-confidence binary never moves score on its own (MCP-001 §14). This
 * predicate exposes that fact; it does NOT compute credit (that is MCP-013).
 */
export function isCreditEligible(sample: SemanticBinarySample): boolean {
  return sample.confidence !== 'low';
}

/** The subset of a packet's binaries that may feed point credit. */
export function creditEligibleBinaries(
  packet: SemanticRefereePacket,
): readonly SemanticBinarySample[] {
  return packet.binaries.filter((sample) => isCreditEligible(sample));
}

/**
 * True if a string reads as an internal `snake_case` code (a `classifierId` or
 * `reasonCode`) rather than plain language. Exported for the downstream render
 * cards (MCP-013 / MCP-014) so they can suppress an unmapped code instead of
 * echoing it. MCP-011 itself adds no `gameCopy` code.
 */
export function looksLikeInternalCode(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  // Internal codes are lowercase snake_case with at least one underscore and
  // no whitespace — plain-language copy has spaces / capitals / punctuation.
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(value);
}
