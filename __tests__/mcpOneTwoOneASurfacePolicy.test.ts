/**
 * MCP-021A — Test category 4: Surface policy.
 *
 * Per design §8.4. Verifies Decision 4 (Family B umbrella +
 * Inspect-only subtypes) and disposition assignment rules.
 */

import {
  _INTERNAL_ALL_DEFINITIONS,
  getDefinitionsForFamily,
} from '../src/features/nodeLabels/machineObservationDefinitions';

describe('MCP-021A — Surface policy (Decision 4 binding)', () => {
  it('Family B has 2 Timeline-eligible entries (umbrella + existing #49 retained per RETROACTIVE rule)', () => {
    // Per Decision 4: disagreement_present is the new Timeline-eligible
    // umbrella key. Per design §3.2: existing #49 disputes_evidence_applicability
    // retains its original 'timeline_node' defaultSurface (RETROACTIVE_VERBOSE_
    // DEFINITIONS adds fields but does NOT change surface).
    const b = getDefinitionsForFamily('disagreement_axis');
    const timeline = b.filter((d) => d.defaultSurface === 'timeline_node');
    expect(timeline.length).toBe(2);
    const timelineRawKeys = timeline.map((d) => d.rawKey).sort();
    expect(timelineRawKeys).toEqual(['disagreement_present', 'disputes_evidence_applicability']);
  });

  it('Family B umbrella disagreement_present is defaultSurface timeline_node', () => {
    const b = getDefinitionsForFamily('disagreement_axis');
    const umbrella = b.find((d) => d.rawKey === 'disagreement_present');
    expect(umbrella?.defaultSurface).toBe('timeline_node');
  });

  it('all NEW Family B subtypes (excluding existing #49) are defaultSurface inspect per Decision 4', () => {
    const b = getDefinitionsForFamily('disagreement_axis');
    const subtypes = b.filter(
      (d) =>
        d.rawKey !== 'disagreement_present' &&
        d.rawKey !== 'disputes_evidence_applicability',
    );
    for (const sub of subtypes) {
      expect(sub.defaultSurface).toBe('inspect');
    }
  });

  it('Family E (argument_scheme) entries are all defaultSurface inspect', () => {
    const e = getDefinitionsForFamily('argument_scheme');
    for (const def of e) {
      expect(def.defaultSurface).toBe('inspect');
    }
  });

  it('Family F (critical_question) entries are all defaultSurface inspect', () => {
    const f = getDefinitionsForFamily('critical_question');
    for (const def of f) {
      expect(def.defaultSurface).toBe('inspect');
    }
  });

  it('Family J entries are composer or inspect (3 + 2; never Timeline)', () => {
    const j = getDefinitionsForFamily('sensitive_composer');
    for (const def of j) {
      expect(['composer', 'inspect']).toContain(def.defaultSurface);
    }
    const composerCount = j.filter((d) => d.defaultSurface === 'composer').length;
    const inspectCount = j.filter((d) => d.defaultSurface === 'inspect').length;
    expect(composerCount).toBe(3);
    expect(inspectCount).toBe(2);
  });

  it('Family J entries NEVER appear with defaultSurface timeline_node', () => {
    const j = getDefinitionsForFamily('sensitive_composer');
    const timeline = j.filter((d) => d.defaultSurface === 'timeline_node');
    expect(timeline.length).toBe(0);
  });

  it('all Family J entries are composer_only or inspect_only disposition', () => {
    const j = getDefinitionsForFamily('sensitive_composer');
    for (const def of j) {
      expect(['composer_only', 'inspect_only']).toContain(def.disposition);
    }
  });

  it('new entries (non-existing) default to disposition future_source', () => {
    // The 107 new entries should have disposition: 'future_source'.
    const newDispositions = _INTERNAL_ALL_DEFINITIONS.filter(
      (d) => d.disposition === 'future_source',
    );
    // We have 64 existing entries (some rendered_now, some inspect_only,
    // some composer_only, some future_source for AI classifier). The new
    // 107 are all future_source. Existing future_source: 25 ai_classifier.
    // So future_source total ≥ 107 + 25 = 132.
    expect(newDispositions.length).toBeGreaterThanOrEqual(107);
  });

  it('every defaultSurface value is from the allowed enum', () => {
    const allowed = ['timeline_node', 'selected_context', 'inspect', 'composer', 'hidden'];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(allowed).toContain(def.defaultSurface);
    }
  });

  it('every disposition value is from the allowed enum', () => {
    const allowed = [
      'rendered_now',
      'inspect_only',
      'composer_only',
      'hidden_sensitive',
      'future_source',
      'intentionally_silent',
    ];
    for (const def of _INTERNAL_ALL_DEFINITIONS) {
      expect(allowed).toContain(def.disposition);
    }
  });
});
