/**
 * Deterministic rules engine — pure TypeScript, no side effects, no async.
 * Safe to import on the client for instant feedback and in Edge Functions for
 * authoritative enforcement. Never import Supabase, React, or network libs here.
 */
import type {
  ArgumentInput,
  ArgumentTypeCode,
  ConstitutionSchema,
  Flag,
  ValidationResult,
} from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeFlag(
  ruleId: string,
  severity: Flag['severity'],
  message: string,
  payload?: Record<string, unknown>
): Flag {
  return { ruleId, severity, message, source: 'deterministic', authoritative: true, payload };
}

function ok(): ValidationResult {
  return { valid: true, flags: [] };
}

function fail(flag: Flag): ValidationResult {
  return { valid: false, flags: [flag] };
}

// ---------------------------------------------------------------------------
// Individual validators (each returns a ValidationResult)
// ---------------------------------------------------------------------------

export function validateTransition(
  parentType: ArgumentTypeCode,
  childType: ArgumentTypeCode,
  constitution: ConstitutionSchema
): ValidationResult {
  const allowed = constitution.transitionMatrix[parentType] ?? [];
  if (!allowed.includes(childType)) {
    return fail(
      makeFlag(
        'INVALID_TRANSITION',
        'violation',
        `A ${childType} cannot be a reply to a ${parentType}. Allowed reply types: ${allowed.length ? allowed.join(', ') : 'none (terminal node)'}.`,
        { parentType, childType, allowed }
      )
    );
  }
  return ok();
}

export function validateDepth(depth: number, constitution: ConstitutionSchema): ValidationResult {
  if (depth > constitution.structuralLimits.maxDepth) {
    return fail(
      makeFlag(
        'DEPTH_EXCEEDED',
        'violation',
        `Argument depth ${depth} exceeds the maximum of ${constitution.structuralLimits.maxDepth}.`,
        { depth, maxDepth: constitution.structuralLimits.maxDepth }
      )
    );
  }
  return ok();
}

export function validateBodyLength(
  body: string,
  constitution: ConstitutionSchema
): ValidationResult {
  const flags: Flag[] = [];

  if (body.length > constitution.structuralLimits.maxBodyLength) {
    flags.push(
      makeFlag(
        'BODY_TOO_LONG',
        'violation',
        `Body is ${body.length} characters; maximum is ${constitution.structuralLimits.maxBodyLength}.`,
        { length: body.length, max: constitution.structuralLimits.maxBodyLength }
      )
    );
  }

  if (body.trim().length < 20) {
    flags.push(
      makeFlag('BODY_TOO_SHORT', 'warning', 'Body must be at least 20 characters when trimmed.', {
        length: body.trim().length,
      })
    );
  }

  return flags.length === 0 ? ok() : { valid: !flags.some((f) => f.severity === 'violation'), flags };
}

export function validateTags(tags: string[], constitution: ConstitutionSchema): ValidationResult {
  const flags: Flag[] = [];
  const { maxTagsPerArgument } = constitution.structuralLimits;
  const validTagIds = new Set(constitution.tags.map((t) => t.id));

  if (tags.length > maxTagsPerArgument) {
    flags.push(
      makeFlag(
        'EXCESS_TAGS',
        'warning',
        `${tags.length} tags applied; maximum is ${maxTagsPerArgument}.`,
        { count: tags.length, max: maxTagsPerArgument }
      )
    );
  }

  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag)) {
      flags.push(
        makeFlag('DUPLICATE_TAG', 'warning', `Tag "${tag}" is applied more than once.`, { tag })
      );
    }
    seen.add(tag);

    if (!validTagIds.has(tag)) {
      flags.push(
        makeFlag('UNKNOWN_TAG', 'warning', `Tag "${tag}" is not in the constitution registry.`, {
          tag,
        })
      );
    }
  }

  return flags.length === 0 ? ok() : { valid: true, flags }; // tag issues are warnings only
}

export function validateEvidenceLinks(
  arg: Pick<ArgumentInput, 'type' | 'evidenceLinks'>,
  constitution: ConstitutionSchema
): ValidationResult {
  const flags: Flag[] = [];
  const { maxEvidenceLinksPerArgument } = constitution.structuralLimits;

  if (arg.type === 'EVD' && arg.evidenceLinks.length === 0) {
    flags.push(
      makeFlag(
        'EVIDENCE_MISSING_SOURCE',
        'violation',
        'Evidence arguments must include at least one cited source URL.',
        {}
      )
    );
  }

  if (arg.evidenceLinks.length > maxEvidenceLinksPerArgument) {
    flags.push(
      makeFlag(
        'EXCESS_EVIDENCE_LINKS',
        'warning',
        `${arg.evidenceLinks.length} evidence links; maximum is ${maxEvidenceLinksPerArgument}.`,
        { count: arg.evidenceLinks.length, max: maxEvidenceLinksPerArgument }
      )
    );
  }

  for (const link of arg.evidenceLinks) {
    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
      flags.push(
        makeFlag(
          'ANON_EVIDENCE',
          'info',
          `Evidence link "${link.label || link.url}" does not appear to be a reachable URL.`,
          { url: link.url }
        )
      );
    }
  }

  return flags.length === 0
    ? ok()
    : { valid: !flags.some((f) => f.severity === 'violation'), flags };
}

// ---------------------------------------------------------------------------
// Type-specific body checks
// ---------------------------------------------------------------------------

const CONCESSION_KEYWORDS = [
  'concede',
  'agree',
  'acknowledge',
  'grant',
  'accept',
  'valid point',
  "you're right",
  'you are right',
  'fair point',
  'i agree',
  'correct',
  'admitted',
  'true that',
];

function validateTypeSpecificBody(arg: ArgumentInput): Flag[] {
  const flags: Flag[] = [];
  const body = arg.body;

  if (arg.type === 'CLR' && !body.trimEnd().endsWith('?')) {
    flags.push(
      makeFlag(
        'CLR_NOT_QUESTION',
        'warning',
        'Clarification Request body should end with a question mark.',
        {}
      )
    );
  }

  if (arg.type === 'CON') {
    const lower = body.toLowerCase();
    const hasAcknowledgment = CONCESSION_KEYWORDS.some((kw) => lower.includes(kw));
    if (!hasAcknowledgment) {
      flags.push(
        makeFlag(
          'CON_MISSING_ACKNOWLEDGMENT',
          'warning',
          'Concession body should explicitly acknowledge the parent argument (e.g., "I concede", "I agree", "Valid point").',
          {}
        )
      );
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run all deterministic checks for a prospective argument.
 * Returns an array of flags. Violations block submission; warnings require confirmation.
 */
export function runDeterministicChecks(
  arg: ArgumentInput,
  constitution: ConstitutionSchema
): Flag[] {
  const flags: Flag[] = [];

  // Root-level constraints
  if (arg.parentType === null) {
    if (arg.type !== 'CLM') {
      flags.push(
        makeFlag(
          'INVALID_ROOT_TYPE',
          'violation',
          `Root-level arguments must be Claims (CLM). Received: ${arg.type}.`,
          { type: arg.type }
        )
      );
    }
  } else {
    // Transition check
    const transitionResult = validateTransition(arg.parentType, arg.type, constitution);
    flags.push(...transitionResult.flags);
  }

  // Structural limits
  const depthResult = validateDepth(arg.depth, constitution);
  flags.push(...depthResult.flags);

  const bodyResult = validateBodyLength(arg.body, constitution);
  flags.push(...bodyResult.flags);

  const tagResult = validateTags(arg.tags, constitution);
  flags.push(...tagResult.flags);

  const evidenceResult = validateEvidenceLinks(arg, constitution);
  flags.push(...evidenceResult.flags);

  // Type-specific body rules
  flags.push(...validateTypeSpecificBody(arg));

  // SYN requires parent thread to be closed
  if (
    arg.type === 'SYN' &&
    arg.parentThreadClosed !== undefined &&
    arg.parentThreadClosed === false
  ) {
    flags.push(
      makeFlag(
        'SYN_THREAD_OPEN',
        'violation',
        'Synthesis Notes can only be added after the parent thread is closed.',
        {}
      )
    );
  }

  return flags;
}

/** Convenience: true if any returned flag has severity === 'violation' */
export function hasViolations(flags: Flag[]): boolean {
  return flags.some((f) => f.severity === 'violation');
}
