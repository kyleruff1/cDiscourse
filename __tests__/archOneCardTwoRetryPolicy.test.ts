/**
 * ARCH-001 Card 2 — Drainer retry policy (PURE behavioral unit tests).
 *
 * classifierDrainerRetryPolicy.ts is pure TS (no Deno / fetch / npm:), so it
 * is Jest-importable and gets REAL behavioral tests (not just a source scan).
 * Covers intent-brief test (h) (retryable → retry with available_at backoff,
 * NOT finalize) + the §A.9 retry table + the ban-list doctrine scan.
 */
import {
  classifyDrainerFailure,
  drainerUnavailableReasonToFailureReason,
  DRAINER_MAX_ATTEMPTS,
  DRAINER_RETRY_BACKOFF_SECONDS,
  ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS,
} from './_helpers/classifierQueueCard2Deno';

describe('ARCH-001 Card 2 — classifyDrainerFailure (§A.9 retry table)', () => {
  it('RP-1 — MAX_ATTEMPTS is 4 (Card 3 raised 3 → 4 per Card-2 C-calibration signal)', () => {
    expect(DRAINER_MAX_ATTEMPTS).toBe(4);
  });

  it('RP-2 — default backoff schedule preserves [30, 120] (Card 3 keeps the default exact)', () => {
    expect(DRAINER_RETRY_BACKOFF_SECONDS).toEqual([30, 120]);
  });

  it('RP-3 — network_error on attempt 1 → retry with +30s backoff (NOT finalize)', () => {
    const d = classifyDrainerFailure('network_error', 1, 'provider_network_error');
    expect(d.disposition).toBe('retry');
    expect(d.backoffSeconds).toBe(30);
    expect(d.failureReason).toBe('mcp_network_error');
    expect(d.deadLetterReason).toBeNull();
  });

  it('RP-4 — network_error on attempt 2 → retry with +120s backoff', () => {
    const d = classifyDrainerFailure('network_error', 2, 'provider_network_error');
    expect(d.disposition).toBe('retry');
    expect(d.backoffSeconds).toBe(120);
  });

  it('RP-5 — network_error at the attempt cap (4) → dead_letter (NOT retry)', () => {
    const d = classifyDrainerFailure('network_error', DRAINER_MAX_ATTEMPTS, 'provider_network_error');
    expect(d.disposition).toBe('dead_letter');
    expect(d.deadLetterReason).toBe('retry_attempts_exhausted');
    expect(d.backoffSeconds).toBe(0);
  });

  it('RP-6 — rate_limited is retryable (429 → backoff at attempts 1–3, dead_letter at cap=4)', () => {
    expect(classifyDrainerFailure('rate_limited', 1, 'provider_rate_limited').disposition).toBe('retry');
    expect(classifyDrainerFailure('rate_limited', 3, 'provider_rate_limited').disposition).toBe('retry');
    expect(classifyDrainerFailure('rate_limited', 4, 'provider_rate_limited').disposition).toBe('dead_letter');
  });

  it('RP-6b — network_error attempt 3 → retry with clamped +120s backoff (default schedule)', () => {
    // Card 3: default schedule stays length-2; attempt 3 transition reuses
    // the last entry via Math.min clamping.
    const d = classifyDrainerFailure('network_error', 3, 'provider_network_error');
    expect(d.disposition).toBe('retry');
    expect(d.backoffSeconds).toBe(120);
  });

  it('RP-7 — api_error (covers the provider_server_error {isError} envelope) is retryable', () => {
    const d = classifyDrainerFailure('api_error', 1, 'provider_server_error');
    expect(d.disposition).toBe('retry');
    expect(d.failureReason).toBe('mcp_api_error');
    // The provider_server_error sub-reason is threaded through unchanged.
    expect(d.failureSubReason).toBe('provider_server_error');
  });

  it('RP-8 — url_missing → failed_terminal immediately (config; never retried)', () => {
    const d = classifyDrainerFailure('url_missing', 1);
    expect(d.disposition).toBe('failed_terminal');
    expect(d.backoffSeconds).toBe(0);
    expect(d.deadLetterReason).toBeNull();
  });

  it('RP-9 — token_missing → failed_terminal immediately (config)', () => {
    expect(classifyDrainerFailure('token_missing', 1).disposition).toBe('failed_terminal');
  });

  it('RP-10 — validation_failed (contract) → ONE retry then failed_terminal (never dead_letter)', () => {
    // Attempt 1: a single transient truncation is allowed → retry.
    const first = classifyDrainerFailure('validation_failed', 1, 'response_wrong_shape');
    expect(first.disposition).toBe('retry');
    expect(first.backoffSeconds).toBe(30);
    // Attempt 2: a deterministic bad response will not heal → terminal.
    const second = classifyDrainerFailure('validation_failed', 2, 'response_wrong_shape');
    expect(second.disposition).toBe('failed_terminal');
    expect(second.deadLetterReason).toBeNull();
  });

  it('RP-11 — parse_failure (contract) → bounded like validation_failed', () => {
    expect(classifyDrainerFailure('parse_failure', 1).disposition).toBe('retry');
    expect(classifyDrainerFailure('parse_failure', 2).disposition).toBe('failed_terminal');
  });

  it('RP-12 — a contract failure NEVER dead-letters (it is not a capacity/transport outage)', () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(classifyDrainerFailure('validation_failed', attempt).disposition).not.toBe('dead_letter');
      expect(classifyDrainerFailure('parse_failure', attempt).disposition).not.toBe('dead_letter');
    }
  });

  it('RP-13 — every adapter reason maps to a stable mcp_* failure_reason', () => {
    for (const reason of ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS) {
      const fr = drainerUnavailableReasonToFailureReason(reason);
      expect(fr.startsWith('mcp_')).toBe(true);
    }
  });

  it('RP-14 — failure_reason strings match the direct-path vocabulary byte-for-byte', () => {
    expect(drainerUnavailableReasonToFailureReason('network_error')).toBe('mcp_network_error');
    expect(drainerUnavailableReasonToFailureReason('api_error')).toBe('mcp_api_error');
    expect(drainerUnavailableReasonToFailureReason('rate_limited')).toBe('mcp_rate_limited');
    expect(drainerUnavailableReasonToFailureReason('validation_failed')).toBe('mcp_validation_failed');
    expect(drainerUnavailableReasonToFailureReason('url_missing')).toBe('mcp_url_missing');
    expect(drainerUnavailableReasonToFailureReason('token_missing')).toBe('mcp_token_missing');
    expect(drainerUnavailableReasonToFailureReason('parse_failure')).toBe('mcp_parse_failure');
  });

  it('RP-15 — never throws on any (reason, attemptCount) combination', () => {
    for (const reason of ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS) {
      for (const attempt of [0, 1, 2, 3, 4, 99]) {
        expect(() => classifyDrainerFailure(reason, attempt)).not.toThrow();
      }
    }
  });

  it('RP-16 — DOCTRINE: no reason/sub-reason/dead-letter string carries a verdict token', () => {
    const BANNED = [
      'winner', 'loser', 'liar', 'true', 'false', 'correct', 'incorrect',
      'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
      'stupid', 'idiot',
    ];
    const strings: string[] = [];
    for (const reason of ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS) {
      strings.push(drainerUnavailableReasonToFailureReason(reason));
      for (const attempt of [1, 2, 3]) {
        const d = classifyDrainerFailure(reason, attempt, 'provider_server_error');
        strings.push(d.disposition, d.failureReason, d.deadLetterReason ?? '');
      }
    }
    for (const s of strings) {
      for (const bad of BANNED) {
        expect(s.toLowerCase()).not.toContain(bad);
      }
    }
  });
});
