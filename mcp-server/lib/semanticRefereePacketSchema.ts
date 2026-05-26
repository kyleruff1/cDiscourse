/**
 * MCP-SERVER-001 — Mirror of the SemanticRefereePacket schema.
 *
 * MIRROR of the structural subset CDiscourse validates via
 * `SemanticRefereePacketSchema` (`supabase/functions/_shared/semanticReferee/
 * packetSchema.ts`). The server returns ONLY the structural fields — identity
 * fields (packetVersion, promptVersion, provider, authoritative, inputHash,
 * contentHash, roomId, etc.) are stamped by the adapter on the CDiscourse side
 * (`stampPacketIdentity`, `mcpAdapter.ts:102-138`). The server MUST NOT emit
 * them, and an attempt to do so is treated as a doctrine violation.
 *
 * Pure validation — no Zod or external schema lib. Functions are total; never
 * throw.
 */
import { DOCTRINE_BAN_PATTERNS } from './doctrineBanList.ts';

export type Binary01 = 0 | 1;
export type SemanticConfidence = 'low' | 'medium' | 'high';

export const ALL_SEMANTIC_CLASSIFIER_IDS: readonly string[] = Object.freeze([
  'responds_to_parent',
  'introduces_new_issue',
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'quote_anchors_parent',
  'narrows_claim',
  'concedes_narrow_point',
  'requests_clarification',
  'answers_clarification',
  'shifts_to_person_or_intent',
  'uses_popularity_as_evidence',
  'contains_playable_hot_take',
  'contains_unplayable_insult_only',
  'is_satire_or_parody',
  'uses_satire_as_evidence',
  'cites_retraction',
  'creates_source_chain_gap',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'fits_selected_debate_mode',
  'needs_pre_send_pause',
  'ready_for_synthesis',
  'disputes_evidence_applicability',
  'references_prior_agreement',
  'provides_temporal_constraint',
  'accepts_partial_with_caveat',
  'provides_alternate_interpretation',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'introduces_sub_axis',
  'concedes_with_new_dispute',
  'proposes_settlement_terms',
  'accepts_settlement_terms',
]);

export const ALL_ROUTE_SUGGESTIONS: readonly string[] = Object.freeze([
  'mainline',
  'vertical_chime_branch',
  'diagonal_tangent',
  'outer_realm',
  'cards_detail',
  'synthesis_lane',
  'no_route_change',
]);

export const ALL_FRICTION_SUGGESTIONS: readonly string[] = Object.freeze([
  'none',
  'soft_chip',
  'pre_send_pause',
  'ask_for_quote',
  'ask_for_source',
  'suggest_branch',
  'suggest_narrow',
  'cooldown_notice',
]);

export const ALL_CONFIDENCE_VALUES: readonly string[] = Object.freeze([
  'low',
  'medium',
  'high',
]);

export const ALL_ACTOR_ROLES: readonly string[] = Object.freeze([
  'initiator',
  'primary_opponent',
  'chime_in',
  'observer',
  'moderator',
]);

export const ALL_PARTICIPANT_SIDES: readonly string[] = Object.freeze([
  'affirmative',
  'negative',
  'observer',
  'moderator',
]);

export const SCORE_HINT_MIN = 0;
export const SCORE_HINT_MAX = 3;
export const MAX_COPY_FIELD_LEN = 280;
export const MAX_STRING_FIELD_LEN = 512;
export const MAX_BODY_FIELD_LEN = 8000;

export interface SemanticBinarySample {
  classifierId: string;
  value: Binary01;
  confidence: SemanticConfidence;
  reasonCode: string;
  evidenceSpan?: string;
  parentSpan?: string;
}

export interface SemanticScoreHints {
  continuityCredit: number;
  evidencePressure: number;
  branchHygiene: number;
  synthesisReadiness: number;
  sourceChainDebt: number;
  unresolvedRedirectRisk: number;
}

export interface SemanticRefereeStructuralPacket {
  binaries: SemanticBinarySample[];
  routeSuggestion: string;
  frictionSuggestion: string;
  scoreHints: SemanticScoreHints;
  modelVersion?: string;
}

export interface ClassifyMoveRoomContext {
  debateMode?: string;
  selectedAction?: string;
  selectedMoveType?: string;
  side?: 'affirmative' | 'negative' | 'observer' | 'moderator';
  actorRole?: 'initiator' | 'primary_opponent' | 'chime_in' | 'observer' | 'moderator';
}

export interface ClassifyMoveRequestValue {
  moveBodyRedacted: string;
  parentBodyRedacted?: string;
  roomContext: ClassifyMoveRoomContext;
  requestedClassifiers: string[];
  contentHash: string;
  roomId: string;
  moveId?: string;
  parentId?: string;
  promptVersionHint?: string;
}

export type ValidationResult<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; path: string; detail: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkStringBound(
  value: unknown,
  path: string,
  min: number,
  max: number,
): ValidationResult<string> {
  if (typeof value !== 'string') return { ok: false, path, detail: 'must be a string' };
  if (value.length < min) return { ok: false, path, detail: `length below ${min}` };
  if (value.length > max) return { ok: false, path, detail: `length above ${max}` };
  return { ok: true, value };
}

function checkInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
): ValidationResult<number> {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, path, detail: 'must be an integer' };
  }
  if (value < min || value > max) {
    return { ok: false, path, detail: `out of range ${min}..${max}` };
  }
  return { ok: true, value };
}

export function validateClassifyMoveInput(
  raw: unknown,
): ValidationResult<ClassifyMoveRequestValue> {
  if (!isPlainObject(raw)) {
    return { ok: false, path: '$', detail: 'must be an object' };
  }
  const body = checkStringBound(raw['moveBodyRedacted'], 'moveBodyRedacted', 1, MAX_BODY_FIELD_LEN);
  if (!body.ok) return body;
  const contentHash = checkStringBound(raw['contentHash'], 'contentHash', 1, MAX_STRING_FIELD_LEN);
  if (!contentHash.ok) return contentHash;
  const roomId = checkStringBound(raw['roomId'], 'roomId', 1, MAX_STRING_FIELD_LEN);
  if (!roomId.ok) return roomId;

  // requestedClassifiers
  const reqRaw = raw['requestedClassifiers'];
  if (!Array.isArray(reqRaw) || reqRaw.length < 1 || reqRaw.length > 5) {
    return { ok: false, path: 'requestedClassifiers', detail: 'must be array of 1..5 strings' };
  }
  const requestedClassifiers: string[] = [];
  for (let i = 0; i < reqRaw.length; i += 1) {
    if (typeof reqRaw[i] !== 'string') {
      return { ok: false, path: `requestedClassifiers[${i}]`, detail: 'must be a string' };
    }
    requestedClassifiers.push(reqRaw[i] as string);
  }

  // roomContext
  const ctxRaw = raw['roomContext'];
  if (!isPlainObject(ctxRaw)) {
    return { ok: false, path: 'roomContext', detail: 'must be an object' };
  }
  const roomContext: ClassifyMoveRoomContext = {};
  if (ctxRaw['debateMode'] !== undefined) {
    const v = checkStringBound(ctxRaw['debateMode'], 'roomContext.debateMode', 0, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    roomContext.debateMode = v.value;
  }
  if (ctxRaw['selectedAction'] !== undefined) {
    const v = checkStringBound(ctxRaw['selectedAction'], 'roomContext.selectedAction', 0, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    roomContext.selectedAction = v.value;
  }
  if (ctxRaw['selectedMoveType'] !== undefined) {
    const v = checkStringBound(ctxRaw['selectedMoveType'], 'roomContext.selectedMoveType', 0, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    roomContext.selectedMoveType = v.value;
  }
  if (ctxRaw['side'] !== undefined) {
    if (typeof ctxRaw['side'] !== 'string' || !ALL_PARTICIPANT_SIDES.includes(ctxRaw['side'])) {
      return { ok: false, path: 'roomContext.side', detail: 'must be one of affirmative|negative|observer|moderator' };
    }
    roomContext.side = ctxRaw['side'] as ClassifyMoveRoomContext['side'];
  }
  if (ctxRaw['actorRole'] !== undefined) {
    if (typeof ctxRaw['actorRole'] !== 'string' || !ALL_ACTOR_ROLES.includes(ctxRaw['actorRole'])) {
      return { ok: false, path: 'roomContext.actorRole', detail: 'must be one of initiator|primary_opponent|chime_in|observer|moderator' };
    }
    roomContext.actorRole = ctxRaw['actorRole'] as ClassifyMoveRoomContext['actorRole'];
  }

  const result: ClassifyMoveRequestValue = {
    moveBodyRedacted: body.value,
    roomContext,
    requestedClassifiers,
    contentHash: contentHash.value,
    roomId: roomId.value,
  };
  if (raw['parentBodyRedacted'] !== undefined) {
    const v = checkStringBound(raw['parentBodyRedacted'], 'parentBodyRedacted', 0, MAX_BODY_FIELD_LEN);
    if (!v.ok) return v;
    result.parentBodyRedacted = v.value;
  }
  if (raw['moveId'] !== undefined) {
    const v = checkStringBound(raw['moveId'], 'moveId', 1, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    result.moveId = v.value;
  }
  if (raw['parentId'] !== undefined) {
    const v = checkStringBound(raw['parentId'], 'parentId', 1, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    result.parentId = v.value;
  }
  if (raw['promptVersionHint'] !== undefined) {
    const v = checkStringBound(raw['promptVersionHint'], 'promptVersionHint', 1, MAX_STRING_FIELD_LEN);
    if (!v.ok) return v;
    result.promptVersionHint = v.value;
  }
  return { ok: true, value: result };
}

function validateBinaries(raw: unknown): ValidationResult<SemanticBinarySample[]> {
  if (!Array.isArray(raw)) return { ok: false, path: 'binaries', detail: 'must be an array' };
  const out: SemanticBinarySample[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!isPlainObject(entry)) {
      return { ok: false, path: `binaries[${i}]`, detail: 'must be an object' };
    }
    // additionalProperties: false
    for (const key of Object.keys(entry)) {
      if (!['classifierId', 'value', 'confidence', 'reasonCode', 'evidenceSpan', 'parentSpan'].includes(key)) {
        return { ok: false, path: `binaries[${i}].${key}`, detail: 'additionalProperties not allowed' };
      }
    }
    const cid = entry['classifierId'];
    if (typeof cid !== 'string' || !ALL_SEMANTIC_CLASSIFIER_IDS.includes(cid)) {
      return { ok: false, path: `binaries[${i}].classifierId`, detail: 'unknown classifier id' };
    }
    const value = entry['value'];
    if (value !== 0 && value !== 1) {
      return { ok: false, path: `binaries[${i}].value`, detail: 'must be 0 or 1' };
    }
    const confidence = entry['confidence'];
    if (typeof confidence !== 'string' || !ALL_CONFIDENCE_VALUES.includes(confidence)) {
      return { ok: false, path: `binaries[${i}].confidence`, detail: 'must be low|medium|high' };
    }
    const reasonCode = entry['reasonCode'];
    if (typeof reasonCode !== 'string' || reasonCode.length < 1 || reasonCode.length > MAX_COPY_FIELD_LEN) {
      return { ok: false, path: `binaries[${i}].reasonCode`, detail: 'must be 1..280 chars' };
    }
    if (!/^[a-z0-9_]+$/.test(reasonCode)) {
      return { ok: false, path: `binaries[${i}].reasonCode`, detail: 'must be lowercase snake_case' };
    }
    const sample: SemanticBinarySample = {
      classifierId: cid,
      value: value as Binary01,
      confidence: confidence as SemanticConfidence,
      reasonCode,
    };
    if (entry['evidenceSpan'] !== undefined) {
      if (typeof entry['evidenceSpan'] !== 'string' || entry['evidenceSpan'].length > MAX_COPY_FIELD_LEN) {
        return { ok: false, path: `binaries[${i}].evidenceSpan`, detail: 'must be string <= 280 chars' };
      }
      sample.evidenceSpan = entry['evidenceSpan'];
    }
    if (entry['parentSpan'] !== undefined) {
      if (typeof entry['parentSpan'] !== 'string' || entry['parentSpan'].length > MAX_COPY_FIELD_LEN) {
        return { ok: false, path: `binaries[${i}].parentSpan`, detail: 'must be string <= 280 chars' };
      }
      sample.parentSpan = entry['parentSpan'];
    }
    out.push(sample);
  }
  return { ok: true, value: out };
}

function validateScoreHints(raw: unknown): ValidationResult<SemanticScoreHints> {
  if (!isPlainObject(raw)) return { ok: false, path: 'scoreHints', detail: 'must be an object' };
  const keys = [
    'continuityCredit',
    'evidencePressure',
    'branchHygiene',
    'synthesisReadiness',
    'sourceChainDebt',
    'unresolvedRedirectRisk',
  ] as const;
  for (const key of Object.keys(raw)) {
    if (!keys.includes(key as typeof keys[number])) {
      return { ok: false, path: `scoreHints.${key}`, detail: 'additionalProperties not allowed' };
    }
  }
  const out: SemanticScoreHints = {
    continuityCredit: 0,
    evidencePressure: 0,
    branchHygiene: 0,
    synthesisReadiness: 0,
    sourceChainDebt: 0,
    unresolvedRedirectRisk: 0,
  };
  for (const key of keys) {
    const v = checkInteger(raw[key], `scoreHints.${key}`, SCORE_HINT_MIN, SCORE_HINT_MAX);
    if (!v.ok) return v;
    out[key] = v.value;
  }
  return { ok: true, value: out };
}

/**
 * Validate a model-returned packet against the structural-subset schema. Also
 * runs the doctrine ban-list scan across every string field — a banned token
 * fails the packet with `path: '<field>', detail: 'doctrine_ban_list'`.
 */
export function validateSemanticRefereePacket(
  raw: unknown,
): ValidationResult<SemanticRefereeStructuralPacket> {
  if (!isPlainObject(raw)) {
    return { ok: false, path: '$', detail: 'must be an object' };
  }
  for (const key of Object.keys(raw)) {
    if (!['binaries', 'routeSuggestion', 'frictionSuggestion', 'scoreHints', 'modelVersion'].includes(key)) {
      return { ok: false, path: `$.${key}`, detail: 'additionalProperties not allowed' };
    }
  }
  const binaries = validateBinaries(raw['binaries']);
  if (!binaries.ok) return binaries;

  const routeRaw = raw['routeSuggestion'];
  if (typeof routeRaw !== 'string' || !ALL_ROUTE_SUGGESTIONS.includes(routeRaw)) {
    return { ok: false, path: 'routeSuggestion', detail: 'must be a known route value' };
  }
  const frictionRaw = raw['frictionSuggestion'];
  if (typeof frictionRaw !== 'string' || !ALL_FRICTION_SUGGESTIONS.includes(frictionRaw)) {
    return { ok: false, path: 'frictionSuggestion', detail: 'must be a known friction value' };
  }
  const scoreHints = validateScoreHints(raw['scoreHints']);
  if (!scoreHints.ok) return scoreHints;

  let modelVersion: string | undefined;
  if (raw['modelVersion'] !== undefined) {
    if (typeof raw['modelVersion'] !== 'string' || raw['modelVersion'].length > MAX_STRING_FIELD_LEN) {
      return { ok: false, path: 'modelVersion', detail: 'must be string <= 512 chars' };
    }
    modelVersion = raw['modelVersion'];
  }

  // Doctrine ban-list scan over every string field in the packet.
  const stringsToScan: Array<{ path: string; value: string }> = [
    { path: 'routeSuggestion', value: routeRaw },
    { path: 'frictionSuggestion', value: frictionRaw },
  ];
  for (let i = 0; i < binaries.value.length; i += 1) {
    const b = binaries.value[i];
    stringsToScan.push({ path: `binaries[${i}].reasonCode`, value: b.reasonCode });
    if (b.evidenceSpan !== undefined) stringsToScan.push({ path: `binaries[${i}].evidenceSpan`, value: b.evidenceSpan });
    if (b.parentSpan !== undefined) stringsToScan.push({ path: `binaries[${i}].parentSpan`, value: b.parentSpan });
  }
  if (modelVersion !== undefined) stringsToScan.push({ path: 'modelVersion', value: modelVersion });
  for (const { path, value } of stringsToScan) {
    for (const pattern of DOCTRINE_BAN_PATTERNS) {
      if (pattern.test(value)) {
        return { ok: false, path, detail: 'doctrine_ban_list' };
      }
    }
  }

  const packet: SemanticRefereeStructuralPacket = {
    binaries: binaries.value,
    routeSuggestion: routeRaw,
    frictionSuggestion: frictionRaw,
    scoreHints: scoreHints.value,
  };
  if (modelVersion !== undefined) packet.modelVersion = modelVersion;
  return { ok: true, value: packet };
}
