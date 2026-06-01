/**
 * Tests for src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts.
 *
 * Covers:
 *   - Per-condition (A–F) threshold band classification
 *   - parsePgNumeric null/empty/non-numeric handling
 *   - Overall severity aggregation
 *   - FORBIDDEN_OUTPUT_SUBSTRINGS coverage (no classifier output contains
 *     secret-shaped or doctrine-banned tokens)
 *   - Pure / no-side-effect property (same input → same output)
 */

import {
  classifyCutoverHealth,
  classifyConditionA,
  classifyConditionB,
  classifyConditionC,
  classifyConditionD,
  classifyConditionE,
  classifyConditionF,
  parsePgNumeric,
  containsForbiddenSubstring,
  FORBIDDEN_OUTPUT_SUBSTRINGS,
  type CutoverHealthInputs,
} from '../src/features/cutoverHealthAlerts/cutoverHealthAlertModel';

const PASS_INPUTS: CutoverHealthInputs = {
  conditionA: {
    seconds_since_last_completed_drain: 30,
    completed_in_window: 30,
    non_completed_in_window: 0,
  },
  conditionB: {
    non_terminal_rows: 0,
    oldest_pending_age_seconds: null,
    pending_count: 0,
    leased_count: 0,
    retry_scheduled_count: 0,
  },
  conditionC: {
    total_terminal_cells: 100,
    dead_letter_cells: 0,
    dead_letter_pct: '0.000',
  },
  conditionD: { direct_dispatch_leak_count: 0 },
  conditionE: { duplicate_success_cell_count: 0 },
  conditionF: {
    total_evidence_spans_scanned: 100,
    hits_verdict_persona: 0,
    hits_truth_or_victory: 0,
    hits_quality_verdict: 0,
    hits_motive_verdict: 0,
  },
};

describe('parsePgNumeric', () => {
  it('returns fallback (0) for null/undefined/empty', () => {
    expect(parsePgNumeric(null)).toBe(0);
    expect(parsePgNumeric(undefined)).toBe(0);
    expect(parsePgNumeric('')).toBe(0);
    expect(parsePgNumeric('   ')).toBe(0);
  });

  it('parses Postgres-numeric-as-string', () => {
    expect(parsePgNumeric('123.456')).toBeCloseTo(123.456);
    expect(parsePgNumeric('0.893')).toBeCloseTo(0.893);
    expect(parsePgNumeric('1.786')).toBeCloseTo(1.786);
  });

  it('returns fallback on non-numeric', () => {
    expect(parsePgNumeric('not-a-number')).toBe(0);
    expect(parsePgNumeric('NaN')).toBe(0);
    expect(parsePgNumeric('Infinity')).toBe(0);
  });

  it('passes through finite numbers; rejects non-finite', () => {
    expect(parsePgNumeric(42)).toBe(42);
    expect(parsePgNumeric(Number.NaN, 7)).toBe(7);
    expect(parsePgNumeric(Number.POSITIVE_INFINITY, 7)).toBe(7);
  });

  it('honors custom fallback', () => {
    expect(parsePgNumeric(null, 999)).toBe(999);
    expect(parsePgNumeric('bad', -1)).toBe(-1);
  });
});

describe('classifyConditionA — drainer stale', () => {
  it('PASS at < 120s', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: 30,
      completed_in_window: 30,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('pass');
    expect(v.observedValue).toBe(30);
  });

  it('WARN at exactly 120s', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: 120,
      completed_in_window: 29,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('warn');
  });

  it('WARN at 299s (upper warn band)', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: 299,
      completed_in_window: 28,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('warn');
  });

  it('ALERT at exactly 300s', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: 300,
      completed_in_window: 28,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('alert');
  });

  it('ALERT at NULL (no completed drain in window)', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: null,
      completed_in_window: 0,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('alert');
    expect(v.thresholdExpression).toContain('no completed drain row');
  });

  it('ALERT carries a non-empty remediation', () => {
    const v = classifyConditionA({
      seconds_since_last_completed_drain: 500,
      completed_in_window: 25,
      non_completed_in_window: 0,
    });
    expect(v.severity).toBe('alert');
    expect(v.remediation.length).toBeGreaterThan(0);
  });
});

describe('classifyConditionB — queue backlog', () => {
  it('PASS when no pending rows', () => {
    const v = classifyConditionB({
      non_terminal_rows: 0,
      oldest_pending_age_seconds: null,
      pending_count: 0,
      leased_count: 0,
      retry_scheduled_count: 0,
    });
    expect(v.severity).toBe('pass');
  });

  it('PASS at < 300s', () => {
    const v = classifyConditionB({
      non_terminal_rows: 3,
      oldest_pending_age_seconds: 60,
      pending_count: 3,
      leased_count: 0,
      retry_scheduled_count: 0,
    });
    expect(v.severity).toBe('pass');
  });

  it('WARN at 300s', () => {
    const v = classifyConditionB({
      non_terminal_rows: 5,
      oldest_pending_age_seconds: 300,
      pending_count: 5,
      leased_count: 0,
      retry_scheduled_count: 0,
    });
    expect(v.severity).toBe('warn');
  });

  it('ALERT at 900s', () => {
    const v = classifyConditionB({
      non_terminal_rows: 10,
      oldest_pending_age_seconds: 900,
      pending_count: 10,
      leased_count: 0,
      retry_scheduled_count: 0,
    });
    expect(v.severity).toBe('alert');
  });
});

describe('classifyConditionC — dead-letter rate', () => {
  it('PASS at 0 terminal cells (empty window)', () => {
    const v = classifyConditionC({
      total_terminal_cells: 0,
      dead_letter_cells: 0,
      dead_letter_pct: null,
    });
    expect(v.severity).toBe('pass');
  });

  it('PASS at < 1%', () => {
    const v = classifyConditionC({
      total_terminal_cells: 1000,
      dead_letter_cells: 5,
      dead_letter_pct: '0.500',
    });
    expect(v.severity).toBe('pass');
  });

  it('WARN at exactly 1%', () => {
    const v = classifyConditionC({
      total_terminal_cells: 1000,
      dead_letter_cells: 10,
      dead_letter_pct: '1.000',
    });
    expect(v.severity).toBe('warn');
  });

  it('WARN at 2.999% (upper warn band)', () => {
    const v = classifyConditionC({
      total_terminal_cells: 1000,
      dead_letter_cells: 29,
      dead_letter_pct: '2.900',
    });
    expect(v.severity).toBe('warn');
  });

  it('ALERT at exactly 3%', () => {
    const v = classifyConditionC({
      total_terminal_cells: 1000,
      dead_letter_cells: 30,
      dead_letter_pct: '3.000',
    });
    expect(v.severity).toBe('alert');
  });
});

describe('classifyConditionD — direct-dispatch leak', () => {
  it('PASS at 0', () => {
    const v = classifyConditionD({ direct_dispatch_leak_count: 0 });
    expect(v.severity).toBe('pass');
  });

  it('ALERT at 1 (no WARN band; binary)', () => {
    const v = classifyConditionD({ direct_dispatch_leak_count: 1 });
    expect(v.severity).toBe('alert');
    expect(v.remediation).toContain('IMMEDIATELY');
  });

  it('treats NaN as 0 (PASS)', () => {
    const v = classifyConditionD({ direct_dispatch_leak_count: Number.NaN });
    expect(v.severity).toBe('pass');
  });
});

describe('classifyConditionE — duplicate success', () => {
  it('PASS at 0', () => {
    const v = classifyConditionE({ duplicate_success_cell_count: 0 });
    expect(v.severity).toBe('pass');
  });

  it('ALERT at any non-zero', () => {
    const v = classifyConditionE({ duplicate_success_cell_count: 1 });
    expect(v.severity).toBe('alert');
    expect(v.remediation).toContain('IMMEDIATELY');
  });
});

describe('classifyConditionF — doctrine ban-list', () => {
  it('PASS when all 4 categories are 0', () => {
    const v = classifyConditionF({
      total_evidence_spans_scanned: 364,
      hits_verdict_persona: 0,
      hits_truth_or_victory: 0,
      hits_quality_verdict: 0,
      hits_motive_verdict: 0,
    });
    expect(v.severity).toBe('pass');
  });

  it('ALERT when any single category is non-zero', () => {
    const v = classifyConditionF({
      total_evidence_spans_scanned: 100,
      hits_verdict_persona: 0,
      hits_truth_or_victory: 0,
      hits_quality_verdict: 1,
      hits_motive_verdict: 0,
    });
    expect(v.severity).toBe('alert');
    expect(v.remediation).toContain('quality-verdict');
  });

  it('cites multiple categories on multi-hit', () => {
    const v = classifyConditionF({
      total_evidence_spans_scanned: 100,
      hits_verdict_persona: 2,
      hits_truth_or_victory: 1,
      hits_quality_verdict: 0,
      hits_motive_verdict: 0,
    });
    expect(v.severity).toBe('alert');
    expect(v.remediation).toContain('verdict-persona');
    expect(v.remediation).toContain('truth-or-victory');
    expect(v.observedValue).toBe(3);
  });
});

describe('classifyCutoverHealth — bundle-level aggregation', () => {
  it('overallSeverity = pass when all conditions PASS', () => {
    const out = classifyCutoverHealth(PASS_INPUTS);
    expect(out.overallSeverity).toBe('pass');
    expect(out.alertCount).toBe(0);
    expect(out.warnCount).toBe(0);
    expect(out.passCount).toBe(6);
    expect(out.conditionVerdicts).toHaveLength(6);
  });

  it('overallSeverity = warn when any single condition is WARN and none ALERT', () => {
    const out = classifyCutoverHealth({
      ...PASS_INPUTS,
      conditionA: {
        seconds_since_last_completed_drain: 150,
        completed_in_window: 29,
        non_completed_in_window: 0,
      },
    });
    expect(out.overallSeverity).toBe('warn');
    expect(out.warnCount).toBe(1);
  });

  it('overallSeverity = alert when any condition ALERT (overrides WARN)', () => {
    const out = classifyCutoverHealth({
      ...PASS_INPUTS,
      conditionD: { direct_dispatch_leak_count: 1 },
      conditionA: {
        seconds_since_last_completed_drain: 150,
        completed_in_window: 29,
        non_completed_in_window: 0,
      },
    });
    expect(out.overallSeverity).toBe('alert');
    expect(out.alertCount).toBe(1);
    expect(out.warnCount).toBe(1);
  });

  it('overall counts sum to 6', () => {
    const out = classifyCutoverHealth(PASS_INPUTS);
    expect(out.alertCount + out.warnCount + out.passCount).toBe(6);
  });

  it('emits ALL 6 condition ids exactly once', () => {
    const out = classifyCutoverHealth(PASS_INPUTS);
    const ids = out.conditionVerdicts.map((v) => v.conditionId).sort();
    expect(ids).toEqual(
      [
        'A_drainer_stale',
        'B_queue_backlog',
        'C_dead_letter_spike',
        'D_direct_dispatch_leak',
        'E_duplicate_success',
        'F_doctrine_banned_token',
      ].sort(),
    );
  });
});

describe('Purity — same input yields same output', () => {
  it('classifyCutoverHealth is deterministic', () => {
    const out1 = classifyCutoverHealth(PASS_INPUTS);
    const out2 = classifyCutoverHealth(PASS_INPUTS);
    expect(out1).toEqual(out2);
  });

  it('classifyConditionA is deterministic across cases', () => {
    const cases = [30, 119, 120, 200, 299, 300, 500];
    for (const s of cases) {
      const a = classifyConditionA({
        seconds_since_last_completed_drain: s,
        completed_in_window: 30,
        non_completed_in_window: 0,
      });
      const b = classifyConditionA({
        seconds_since_last_completed_drain: s,
        completed_in_window: 30,
        non_completed_in_window: 0,
      });
      expect(a).toEqual(b);
    }
  });
});

describe('Safety — no forbidden substrings in classifier output', () => {
  it('FORBIDDEN_OUTPUT_SUBSTRINGS list is non-empty + frozen', () => {
    expect(FORBIDDEN_OUTPUT_SUBSTRINGS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(FORBIDDEN_OUTPUT_SUBSTRINGS)).toBe(true);
  });

  it('containsForbiddenSubstring detects sbp_ / sk-ant- / eyJ / Bearer', () => {
    expect(containsForbiddenSubstring('this contains sbp_abc123')).toBe(true);
    expect(containsForbiddenSubstring('a sk-ant- key here')).toBe(true);
    expect(containsForbiddenSubstring('and a eyJjwt token')).toBe(true);
    expect(containsForbiddenSubstring('Authorization: Bearer foo')).toBe(true);
  });

  it('containsForbiddenSubstring detects doctrine verdict tokens', () => {
    expect(containsForbiddenSubstring('the winner is')).toBe(true);
    expect(containsForbiddenSubstring('LOSER!')).toBe(true);
    expect(containsForbiddenSubstring('Liar Liar')).toBe(true);
    expect(containsForbiddenSubstring('they were dishonest')).toBe(true);
  });

  it('containsForbiddenSubstring returns false for clean text', () => {
    expect(containsForbiddenSubstring('drainer ticked at 30s; PASS')).toBe(false);
    expect(containsForbiddenSubstring('queue depth healthy')).toBe(false);
    expect(containsForbiddenSubstring('')).toBe(false);
  });

  it('every classifier output verdict (remediation + thresholdExpression) is clean across all severity bands', () => {
    const bundles: CutoverHealthInputs[] = [
      PASS_INPUTS,
      {
        // All ALERT severities to exercise the alert remediation strings.
        conditionA: {
          seconds_since_last_completed_drain: null,
          completed_in_window: 0,
          non_completed_in_window: 0,
        },
        conditionB: {
          non_terminal_rows: 10,
          oldest_pending_age_seconds: 1200,
          pending_count: 10,
          leased_count: 0,
          retry_scheduled_count: 0,
        },
        conditionC: {
          total_terminal_cells: 1000,
          dead_letter_cells: 50,
          dead_letter_pct: '5.000',
        },
        conditionD: { direct_dispatch_leak_count: 1 },
        conditionE: { duplicate_success_cell_count: 2 },
        conditionF: {
          total_evidence_spans_scanned: 100,
          hits_verdict_persona: 1,
          hits_truth_or_victory: 1,
          hits_quality_verdict: 1,
          hits_motive_verdict: 1,
        },
      },
    ];
    for (const inputs of bundles) {
      const out = classifyCutoverHealth(inputs);
      for (const v of out.conditionVerdicts) {
        expect(containsForbiddenSubstring(v.remediation)).toBe(false);
        expect(containsForbiddenSubstring(v.thresholdExpression)).toBe(false);
        // Verdict id is fixed-vocabulary; defensive scan:
        expect(containsForbiddenSubstring(v.conditionId)).toBe(false);
      }
    }
  });
});
