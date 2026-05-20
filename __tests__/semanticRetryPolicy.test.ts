/**
 * MCP-012 — Semantic call router: retry-policy tests.
 *
 * Asserts the policy descriptor shape, `shouldRetry`'s transient-vs-terminal
 * split, and that the two error-class lists partition `SemanticErrorClass`.
 */

import {
  SEMANTIC_RETRY_POLICY,
  RETRYABLE_ERROR_CLASSES,
  TERMINAL_ERROR_CLASSES,
  shouldRetry,
} from '../src/features/semanticReferee/retryPolicy';
import type { SemanticErrorClass } from '../src/features/semanticReferee/retryPolicy';

/** The full enumeration of `SemanticErrorClass` — kept in sync with the type. */
const ALL_ERROR_CLASSES: readonly SemanticErrorClass[] = [
  'network_timeout',
  'provider_5xx',
  'provider_rate_limited',
  'key_missing',
  'validation_failed',
  'parse_failure',
  'disabled',
  'over_budget',
];

describe('MCP-012 SEMANTIC_RETRY_POLICY', () => {
  it('has maxAttempts === 2 (one initial attempt + at most one retry)', () => {
    expect(SEMANTIC_RETRY_POLICY.maxAttempts).toBe(2);
  });

  it('has a single backoff entry (length === maxAttempts - 1)', () => {
    expect(SEMANTIC_RETRY_POLICY.backoffMs).toHaveLength(1);
    expect(SEMANTIC_RETRY_POLICY.backoffMs[0]).toBe(250);
  });

  it('has an 8000 ms per-attempt timeout', () => {
    expect(SEMANTIC_RETRY_POLICY.attemptTimeoutMs).toBe(8000);
  });
});

describe('MCP-012 shouldRetry — transient classes', () => {
  it('returns true for network_timeout', () => {
    expect(shouldRetry('network_timeout')).toBe(true);
  });

  it('returns true for provider_5xx', () => {
    expect(shouldRetry('provider_5xx')).toBe(true);
  });

  it('returns true for provider_rate_limited', () => {
    expect(shouldRetry('provider_rate_limited')).toBe(true);
  });
});

describe('MCP-012 shouldRetry — terminal classes', () => {
  it('returns false for key_missing', () => {
    expect(shouldRetry('key_missing')).toBe(false);
  });

  it('returns false for validation_failed', () => {
    expect(shouldRetry('validation_failed')).toBe(false);
  });

  it('returns false for parse_failure', () => {
    expect(shouldRetry('parse_failure')).toBe(false);
  });

  it('returns false for disabled', () => {
    expect(shouldRetry('disabled')).toBe(false);
  });

  it('returns false for over_budget', () => {
    expect(shouldRetry('over_budget')).toBe(false);
  });
});

describe('MCP-012 retryable / terminal partition', () => {
  it('RETRYABLE_ERROR_CLASSES has the three transient classes', () => {
    expect(RETRYABLE_ERROR_CLASSES).toHaveLength(3);
  });

  it('TERMINAL_ERROR_CLASSES has the five terminal classes', () => {
    expect(TERMINAL_ERROR_CLASSES).toHaveLength(5);
  });

  it('the two lists are disjoint', () => {
    for (const cls of RETRYABLE_ERROR_CLASSES) {
      expect(TERMINAL_ERROR_CLASSES).not.toContain(cls);
    }
  });

  it('the union of the two lists covers every SemanticErrorClass member', () => {
    const union = new Set<SemanticErrorClass>([
      ...RETRYABLE_ERROR_CLASSES,
      ...TERMINAL_ERROR_CLASSES,
    ]);
    expect(union.size).toBe(ALL_ERROR_CLASSES.length);
    for (const cls of ALL_ERROR_CLASSES) {
      expect(union.has(cls)).toBe(true);
    }
  });

  it('shouldRetry is total — defined for every error class', () => {
    for (const cls of ALL_ERROR_CLASSES) {
      expect(typeof shouldRetry(cls)).toBe('boolean');
    }
  });
});
