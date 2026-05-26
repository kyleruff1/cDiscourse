/**
 * MCP-021A — Test category 7: Doctrine ban-list + label safety.
 *
 * Per design §8.7. Verifies plain-language fields (label, shortLabel,
 * description) NEVER contain verdict tokens, raw rawKey leaks, or
 * fallacy framing for Family E schemes.
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

// Tokens that should NEVER appear as a quality verdict, but may legitimately
// appear in technical context. We check for usage patterns rather than raw
// presence.
const QUALITY_VERDICT_PHRASES = [
  'argument is wrong',
  'argument is weak',
  'claim is false',
  'claim is correct',
  'this is true',
  'this is false',
  'this is correct',
  'this is wrong',
];

describe('MCP-021A — Label doctrine ban-list', () => {
  for (const def of _INTERNAL_ALL_DEFINITIONS) {
    describe(`entry "${def.rawKey}" (family ${def.family})`, () => {
      it('label contains no verdict tokens', () => {
        for (const banned of VERDICT_TOKENS) {
          expect(def.label.toLowerCase()).not.toContain(banned);
        }
      });

      it('shortLabel contains no verdict tokens', () => {
        for (const banned of VERDICT_TOKENS) {
          expect(def.shortLabel.toLowerCase()).not.toContain(banned);
        }
      });

      it('description contains no verdict tokens', () => {
        for (const banned of VERDICT_TOKENS) {
          expect(def.description.toLowerCase()).not.toContain(banned);
        }
      });

      it('user-facing fields contain no quality-verdict phrases', () => {
        const combined = `${def.label} ${def.shortLabel} ${def.description}`.toLowerCase();
        for (const phrase of QUALITY_VERDICT_PHRASES) {
          expect(combined).not.toContain(phrase);
        }
      });

      it('user-facing fields do NOT leak obviously-internal rawKey patterns', () => {
        // The rawKey is an internal code; should not leak into user-facing
        // strings AS AN INTERNAL CODE. Single-word lifecycle rawKeys like
        // "narrowed" / "clarified" / "open" are also plain English words
        // that legitimately appear in label / description (their plain
        // language IS the rawKey). We only flag obviously-internal patterns:
        // snake_case rawKeys with underscores in the user-facing fields.
        if (def.rawKey.includes('_')) {
          expect(def.label.toLowerCase()).not.toContain(def.rawKey);
          expect(def.shortLabel.toLowerCase()).not.toContain(def.rawKey);
        }
      });
    });
  }
});

describe('MCP-021A — Family E (argument_scheme) NEVER calls schemes fallacies', () => {
  it('no Family E entry contains "fallacy" or "fallacious" in user-facing fields', () => {
    const familyE = _INTERNAL_ALL_DEFINITIONS.filter((d) => d.family === 'argument_scheme');
    for (const def of familyE) {
      const combined = `${def.label} ${def.shortLabel} ${def.description}`.toLowerCase();
      expect(combined).not.toContain('fallacy');
      expect(combined).not.toContain('fallacious');
    }
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
    for (const def of familyF) {
      const combined = `${def.label} ${def.shortLabel}`.toLowerCase();
      for (const banned of bannedFraming) {
        expect(combined).not.toContain(banned);
      }
    }
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
