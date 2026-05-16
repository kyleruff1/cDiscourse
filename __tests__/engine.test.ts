import {
  hasViolations,
  runDeterministicChecks,
  validateBodyLength,
  validateDepth,
  validateEvidenceLinks,
  validateTags,
} from '../src/domain/constitution/engine';
import { constitutionV1 } from '../src/domain/constitution/v1';
import type { ArgumentInput } from '../src/domain/constitution/types';

const c = constitutionV1;

function baseArg(overrides: Partial<ArgumentInput> = {}): ArgumentInput {
  return {
    type: 'CLM',
    side: 'affirmative',
    body: 'This is a valid claim body that is long enough.',
    tags: [],
    evidenceLinks: [],
    depth: 0,
    parentType: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateDepth
// ---------------------------------------------------------------------------

describe('validateDepth', () => {
  it('passes at depth 0', () => {
    expect(validateDepth(0, c).valid).toBe(true);
  });

  it('passes at maxDepth', () => {
    expect(validateDepth(c.structuralLimits.maxDepth, c).valid).toBe(true);
  });

  it('fails when depth exceeds maxDepth', () => {
    const result = validateDepth(c.structuralLimits.maxDepth + 1, c);
    expect(result.valid).toBe(false);
    expect(result.flags[0].ruleId).toBe('DEPTH_EXCEEDED');
    expect(result.flags[0].severity).toBe('violation');
  });
});

// ---------------------------------------------------------------------------
// validateBodyLength
// ---------------------------------------------------------------------------

describe('validateBodyLength', () => {
  it('passes a normal body', () => {
    expect(validateBodyLength('This is a normal body.', c).valid).toBe(true);
  });

  it('produces BODY_TOO_SHORT warning for trimmed body < 20 chars', () => {
    const result = validateBodyLength('Too short.', c);
    expect(result.flags.some((f) => f.ruleId === 'BODY_TOO_SHORT')).toBe(true);
    expect(result.flags[0].severity).toBe('warning');
    expect(result.valid).toBe(true); // warning, not violation
  });

  it('produces BODY_TOO_LONG violation', () => {
    const longBody = 'a'.repeat(c.structuralLimits.maxBodyLength + 1);
    const result = validateBodyLength(longBody, c);
    expect(result.flags.some((f) => f.ruleId === 'BODY_TOO_LONG')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('passes at exactly maxBodyLength', () => {
    const body = 'a'.repeat(c.structuralLimits.maxBodyLength);
    expect(validateBodyLength(body, c).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTags
// ---------------------------------------------------------------------------

describe('validateTags', () => {
  it('passes with no tags', () => {
    expect(validateTags([], c).valid).toBe(true);
  });

  it('passes with valid tags within limit', () => {
    expect(validateTags(['empirical', 'statistical'], c).valid).toBe(true);
  });

  it('produces EXCESS_TAGS warning when over maxTagsPerArgument', () => {
    const tags = ['empirical', 'statistical', 'theoretical', 'anecdotal'];
    const result = validateTags(tags, c);
    expect(result.flags.some((f) => f.ruleId === 'EXCESS_TAGS')).toBe(true);
  });

  it('produces DUPLICATE_TAG warning for repeated tag', () => {
    const result = validateTags(['empirical', 'empirical'], c);
    expect(result.flags.some((f) => f.ruleId === 'DUPLICATE_TAG')).toBe(true);
  });

  it('produces UNKNOWN_TAG warning for unregistered tag', () => {
    const result = validateTags(['not-a-real-tag'], c);
    expect(result.flags.some((f) => f.ruleId === 'UNKNOWN_TAG')).toBe(true);
  });

  it('tag warnings do not mark valid as false', () => {
    const result = validateTags(['empirical', 'empirical', 'empirical', 'empirical'], c);
    expect(result.valid).toBe(true); // only warnings
  });
});

// ---------------------------------------------------------------------------
// validateEvidenceLinks
// ---------------------------------------------------------------------------

describe('validateEvidenceLinks', () => {
  it('passes EVD with a valid URL', () => {
    const arg = { type: 'EVD' as const, evidenceLinks: [{ url: 'https://example.com', label: 'Source' }] };
    expect(validateEvidenceLinks(arg, c).valid).toBe(true);
  });

  it('produces EVIDENCE_MISSING_SOURCE violation for EVD with no links', () => {
    const arg = { type: 'EVD' as const, evidenceLinks: [] };
    const result = validateEvidenceLinks(arg, c);
    expect(result.valid).toBe(false);
    expect(result.flags.some((f) => f.ruleId === 'EVIDENCE_MISSING_SOURCE')).toBe(true);
  });

  it('does not require evidence for CLM type', () => {
    const arg = { type: 'CLM' as const, evidenceLinks: [] };
    expect(validateEvidenceLinks(arg, c).valid).toBe(true);
  });

  it('produces ANON_EVIDENCE info for non-http link', () => {
    const arg = { type: 'CLM' as const, evidenceLinks: [{ url: 'ftp://weird', label: 'Weird' }] };
    const result = validateEvidenceLinks(arg, c);
    expect(result.flags.some((f) => f.ruleId === 'ANON_EVIDENCE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runDeterministicChecks — root argument rules
// ---------------------------------------------------------------------------

describe('runDeterministicChecks — root arguments', () => {
  it('passes a valid root CLM', () => {
    const flags = runDeterministicChecks(baseArg(), c);
    expect(hasViolations(flags)).toBe(false);
  });

  it('produces INVALID_ROOT_TYPE violation for root RBT', () => {
    const flags = runDeterministicChecks(baseArg({ type: 'RBT' }), c);
    expect(flags.some((f) => f.ruleId === 'INVALID_ROOT_TYPE')).toBe(true);
    expect(hasViolations(flags)).toBe(true);
  });

  it('produces INVALID_ROOT_TYPE for root EVD', () => {
    const flags = runDeterministicChecks(
      baseArg({ type: 'EVD', evidenceLinks: [{ url: 'https://x.com', label: 'X' }] }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'INVALID_ROOT_TYPE')).toBe(true);
  });

  it('produces INVALID_ROOT_TYPE for root SYN', () => {
    const flags = runDeterministicChecks(baseArg({ type: 'SYN' }), c);
    expect(flags.some((f) => f.ruleId === 'INVALID_ROOT_TYPE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runDeterministicChecks — CLR type rules
// ---------------------------------------------------------------------------

describe('runDeterministicChecks — CLR type rules', () => {
  it('produces CLR_NOT_QUESTION warning when body does not end with ?', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'CLR',
        parentType: 'CLM',
        depth: 1,
        body: 'What do you mean by universal basic income',
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'CLR_NOT_QUESTION')).toBe(true);
    expect(flags.find((f) => f.ruleId === 'CLR_NOT_QUESTION')?.severity).toBe('warning');
  });

  it('passes CLR when body ends with ?', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'CLR',
        parentType: 'CLM',
        depth: 1,
        body: 'What do you mean by universal basic income?',
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'CLR_NOT_QUESTION')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runDeterministicChecks — CON type rules
// ---------------------------------------------------------------------------

describe('runDeterministicChecks — CON type rules', () => {
  it('produces CON_MISSING_ACKNOWLEDGMENT for concession without acknowledgment keywords', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'CON',
        parentType: 'CLM',
        depth: 1,
        body: 'This point has some merit but it is complicated.',
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'CON_MISSING_ACKNOWLEDGMENT')).toBe(true);
  });

  it('passes CON with acknowledgment keyword', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'CON',
        parentType: 'CLM',
        depth: 1,
        body: 'I concede that this point about economic impact is valid.',
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'CON_MISSING_ACKNOWLEDGMENT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runDeterministicChecks — SYN thread rules
// ---------------------------------------------------------------------------

describe('runDeterministicChecks — SYN thread rules', () => {
  it('produces SYN_THREAD_OPEN violation when parentThreadClosed is false', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'SYN',
        parentType: 'CON',
        depth: 2,
        body: 'Summary of the debate so far on this point.',
        parentThreadClosed: false,
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'SYN_THREAD_OPEN')).toBe(true);
  });

  it('allows SYN when parentThreadClosed is true', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'SYN',
        parentType: 'CON',
        depth: 2,
        body: 'Summary of the debate so far on this point.',
        parentThreadClosed: true,
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'SYN_THREAD_OPEN')).toBe(false);
  });

  it('skips SYN_THREAD_OPEN check when parentThreadClosed is undefined', () => {
    const flags = runDeterministicChecks(
      baseArg({
        type: 'SYN',
        parentType: 'CON',
        depth: 2,
        body: 'Summary of the debate so far on this point.',
        // parentThreadClosed omitted
      }),
      c
    );
    expect(flags.some((f) => f.ruleId === 'SYN_THREAD_OPEN')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasViolations helper
// ---------------------------------------------------------------------------

describe('hasViolations', () => {
  it('returns false for empty flags', () => {
    expect(hasViolations([])).toBe(false);
  });

  it('returns false for warning-only flags', () => {
    expect(
      hasViolations([
        { ruleId: 'X', severity: 'warning', message: '', source: 'deterministic', authoritative: true },
      ])
    ).toBe(false);
  });

  it('returns true when any flag is a violation', () => {
    expect(
      hasViolations([
        { ruleId: 'X', severity: 'warning', message: '', source: 'deterministic', authoritative: true },
        { ruleId: 'Y', severity: 'violation', message: '', source: 'deterministic', authoritative: true },
      ])
    ).toBe(true);
  });
});
