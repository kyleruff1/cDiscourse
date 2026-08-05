/**
 * UX-FLAGS-005 (issue 837) — doctrine ban-list for the lifecycle copy family.
 *
 * The one visible string the card ships (`Still reading this...`) must
 * survive every doctrine constraint that already governs feedback-flag
 * copy: no verdict tokens, no internal codes, no snake_case, no
 * provider/error/queue vocabulary. The copy object itself must have
 * EXACTLY ONE key (`pending`) -- the absence of a `failed:` key is
 * doctrinally load-bearing (silent-on-failure at the source layer).
 *
 * The shipped #950 uxDoctrineCopyLint guard scans `gameCopy.ts` (Tier A);
 * this file adds the UX-FLAGS-005-specific enumeration guarantees a
 * general-lexicon scan does not enumerate on its own.
 */

import { _forbiddenVerdictTokens } from '../src/features/feedbackFlags/friendlyFlagMap';
import { POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY } from '../src/features/arguments/gameCopy';

// The set of internal codes UX-FLAGS-005 MUST NEVER surface. This is the
// queue enum ('pending' / 'leased' / 'retry_scheduled' / 'succeeded' /
// 'failed_terminal' / 'dead_letter') plus the raw-error vocabulary a
// provider might return, plus the classifier subsystem's own prefix. The
// literal 'pending' is in the OBJECT KEY but the VALUE must never contain
// it (the whole test asserts VALUE content only).
const INTERNAL_CODE_BAN_LIST: readonly string[] = Object.freeze([
  'retry_scheduled',
  'dead_letter',
  'failed_terminal',
  'leased',
  'succeeded',
  'provider_',
  'provider_server_error',
  'provider_network_error',
  'provider_timeout',
  'mcp_',
  'sub_reason',
  'failure_reason',
  'failure_sub_reason',
  'dead_letter_reason',
  'lease_owner',
  'lease_expires_at',
  'input_hash',
  'model_name',
  'attempt_count',
  'available_at',
  'last_attempt_at',
  // Raw-error tokens callers should never encounter.
  'unauthorized',
  'forbidden',
  'not_found',
  'validated',
  '_error',
  'errored',
  // Snake_case in general is a smell (the router only maps codes; user
  // copy is plain English).
  '_',
]);

describe('POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY — shape', () => {
  it('is a frozen object', () => {
    expect(Object.isFrozen(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY)).toBe(true);
  });

  it('has EXACTLY one key: pending (no failed key by design)', () => {
    const keys = Object.keys(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY);
    expect(keys).toEqual(['pending']);
    // Explicit negative: no failed key. Silent-on-failure at the source.
    expect(keys).not.toContain('failed');
    expect(keys).not.toContain('error');
    expect(keys).not.toContain('retry');
    expect(keys).not.toContain('dead_letter');
    expect(keys).not.toContain('failed_terminal');
  });

  it('pending is a non-empty string', () => {
    expect(typeof POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending).toBe('string');
    expect(POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending.length).toBeGreaterThan(0);
  });

  it('pending copy is calm plain-language (Still reading this pattern)', () => {
    // Deliberately loose: allow future word tweaks but pin the calm posture.
    // Must contain "reading" and NOT contain any imperative or urgent word.
    const copy = POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending.toLowerCase();
    expect(copy).toContain('reading');
    const urgent = ['urgent', 'now', 'immediately', 'please wait', 'loading', 'processing'];
    for (const word of urgent) {
      expect(copy).not.toContain(word);
    }
  });
});

describe('POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY — doctrine ban-list', () => {
  it('the pending value contains no internal queue / provider / error code', () => {
    const value = POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending.toLowerCase();
    for (const banned of INTERNAL_CODE_BAN_LIST) {
      expect(value).not.toContain(banned);
    }
  });

  it('the pending value contains no verdict / person-label / heat token', () => {
    const value = POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending.toLowerCase();
    for (const banned of _forbiddenVerdictTokens()) {
      expect(value).not.toContain(banned);
    }
  });

  it('the pending value contains no popularity / engagement token', () => {
    const value = POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending.toLowerCase();
    for (const token of [
      'likes',
      'retweets',
      'shares',
      'views',
      'followers',
      'verified',
      'engagement',
      'amplification',
      'trending',
      'virality',
      'popular',
      'viral',
      'score',
      'importance',
      'severity',
      'priority',
    ]) {
      expect(value).not.toContain(token);
    }
  });

  it('the pending value uses only readable plain-English characters', () => {
    const value = POINT_FEEDBACK_FLAGS_LIFECYCLE_COPY.pending;
    // U+2026 (horizontal ellipsis) is allowed. No angle brackets, no braces,
    // no code-like tokens.
    expect(value).not.toMatch(/[<>{}\[\]\\]/);
    // No template-string interpolation leak.
    expect(value).not.toContain('${');
    // No snake_case in the visible string.
    expect(value).not.toMatch(/[a-z]_[a-z]/);
  });
});
