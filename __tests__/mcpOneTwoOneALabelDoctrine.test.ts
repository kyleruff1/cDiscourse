/**
 * MCP-021A — Test category 7: Doctrine ban-list + label safety.
 *
 * Per design §8.7. Verifies plain-language fields (label, shortLabel,
 * description) NEVER contain verdict tokens, raw rawKey leaks, or
 * fallacy framing for Family E schemes.
 *
 * Uses AGGREGATE iteration per design §8.9 implementer choice
 * (~25 tests, not ~860 per-entry expansion).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — never label as winner/loser/correct etc.
 *   - cdiscourse-doctrine §9 — internal codes never in user-facing strings.
 *   - design §3.5 — Family E entries NEVER call a scheme a "fallacy".
 */

import { _INTERNAL_ALL_DEFINITIONS } from '../src/features/nodeLabels/machineObservationDefinitions';

// Canonical ban list (cdiscourse-doctrine §1 + §10a)
const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'troll',
  'fallacy',
  'fallacious',
];

// Quality-verdict phrases — patterns that frame as verdict.
const QUALITY_VERDICT_PHRASES = [
  'argument is wrong',
  'argument is weak',
  'claim is false',
  'claim is correct',
  'this is true',
  'this is false',
  'this is correct',
];

describe('MCP-021A — Label doctrine ban-list (aggregate)', () => {
  it('no entry label contains any verdict token', () => {
    const offenders: Array<{ rawKey: string; field: string; banned: string }> = [];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      const label = def.label.toLowerCase();
      for (const banned of VERDICT_TOKENS) {
        if (label.includes(banned)) {
          offenders.push({ rawKey: def.rawKey, field: 'label', banned });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no entry shortLabel contains any verdict token', () => {
    const offenders: Array<{ rawKey: string; field: string; banned: string }> = [];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      const sl = def.shortLabel.toLowerCase();
      for (const banned of VERDICT_TOKENS) {
        if (sl.includes(banned)) {
          offenders.push({ rawKey: def.rawKey, field: 'shortLabel', banned });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no entry description contains any verdict token', () => {
    const offenders: Array<{ rawKey: string; field: string; banned: string }> = [];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      const d = def.description.toLowerCase();
      for (const banned of VERDICT_TOKENS) {
        if (d.includes(banned)) {
          offenders.push({ rawKey: def.rawKey, field: 'description', banned });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no entry user-facing fields contain quality-verdict phrases', () => {
    const offenders: Array<{ rawKey: string; phrase: string }> = [];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      const combined = `${def.label} ${def.shortLabel} ${def.description}`.toLowerCase();
      for (const phrase of QUALITY_VERDICT_PHRASES) {
        if (combined.includes(phrase)) {
          offenders.push({ rawKey: def.rawKey, phrase });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no snake_case rawKey leaks into label or shortLabel verbatim', () => {
    const offenders: Array<{ rawKey: string; field: string }> = [];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      if (!def.rawKey.includes('_')) continue; // single-word rawKeys are plain English
      if (def.label.toLowerCase().includes(def.rawKey)) {
        offenders.push({ rawKey: def.rawKey, field: 'label' });
      }
      if (def.shortLabel.toLowerCase().includes(def.rawKey)) {
        offenders.push({ rawKey: def.rawKey, field: 'shortLabel' });
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021A — Family E (argument_scheme) NEVER calls schemes fallacies', () => {
  it('no Family E entry contains "fallacy" or "fallacious" in user-facing fields', () => {
    const familyE = _INTERNAL_ALL_DEFINITIONS.filter((d) => d.family === 'argument_scheme');
    const offenders: string[] = [];
    for (const def of familyE) {
      const combined = `${def.label} ${def.shortLabel} ${def.description}`.toLowerCase();
      if (combined.includes('fallacy') || combined.includes('fallacious')) {
        offenders.push(def.rawKey);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('slippery_slope_reasoning_present specifically does not call itself a fallacy', () => {
    const ss = _INTERNAL_ALL_DEFINITIONS.find(
      (d) => d.rawKey === 'slippery_slope_reasoning_present',
    );
    expect(ss).toBeDefined();
    if (ss) {
      const combined = `${ss.label} ${ss.shortLabel} ${ss.description}`.toLowerCase();
      expect(combined).not.toContain('fallacy');
    }
  });
});

describe('MCP-021A — Family F (critical_question) plain-language framing', () => {
  it('no Family F entry uses "unwarranted" / "unsupported" / "weak" framing in label/shortLabel', () => {
    const familyF = _INTERNAL_ALL_DEFINITIONS.filter((d) => d.family === 'critical_question');
    const bannedFraming = ['unwarranted', 'unsupported', 'weak'];
    const offenders: Array<{ rawKey: string; banned: string }> = [];
    for (const def of familyF) {
      const combined = `${def.label} ${def.shortLabel}`.toLowerCase();
      for (const banned of bannedFraming) {
        if (combined.includes(banned)) {
          offenders.push({ rawKey: def.rawKey, banned });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021A — Family J disposition enforcement', () => {
  it('every Family J entry has composer_only or inspect_only disposition', () => {
    const familyJ = _INTERNAL_ALL_DEFINITIONS.filter((d) => d.family === 'sensitive_composer');
    for (const def of familyJ) {
      expect(['composer_only', 'inspect_only']).toContain(def.disposition);
    }
  });

  it('Family J entries NEVER have defaultSurface timeline_node', () => {
    const familyJ = _INTERNAL_ALL_DEFINITIONS.filter((d) => d.family === 'sensitive_composer');
    for (const def of familyJ) {
      expect(def.defaultSurface).not.toBe('timeline_node');
    }
  });
});

describe('MCP-021A — Machine Observation kind invariant', () => {
  it('every entry is kind machine_observation (never collapses into allegations)', () => {
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      // cdiscourse-doctrine §10a: Machine Observations and User Allegations
      // are NEVER collapsed.
      expect(def.kind).toBe('machine_observation');
    }
  });
});
