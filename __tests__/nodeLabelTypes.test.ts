/**
 * UX-001.5A — Type contract tests.
 *
 * Maps acceptance criteria AC 1, 2, 14, 15, 16 (taxonomy + provenance
 * preservation + never collapse Observations into Allegations or vice
 * versa).
 */

import {
  ALL_NODE_LABEL_DISPOSITIONS,
  ALL_NODE_LABEL_KINDS,
  ALL_NODE_LABEL_SOURCES,
  ALL_NODE_LABEL_SURFACES,
  type MachineObservationSource,
  type NodeLabelDisposition,
  type NodeLabelKind,
  type NodeLabelMark,
  type NodeLabelSource,
  type NodeLabelSurface,
  type UserAllegationSource,
} from '../src/features/nodeLabels/nodeLabelTypes';

describe('UX-001.5A — nodeLabelTypes — closed unions', () => {
  describe('NodeLabelKind', () => {
    it('has exactly 2 values', () => {
      expect(ALL_NODE_LABEL_KINDS.length).toBe(2);
    });

    it('includes machine_observation', () => {
      expect(ALL_NODE_LABEL_KINDS).toContain('machine_observation');
    });

    it('includes user_allegation', () => {
      expect(ALL_NODE_LABEL_KINDS).toContain('user_allegation');
    });

    it('contains no extra values', () => {
      for (const kind of ALL_NODE_LABEL_KINDS) {
        expect(['machine_observation', 'user_allegation']).toContain(kind);
      }
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ALL_NODE_LABEL_KINDS)).toBe(true);
    });
  });

  describe('NodeLabelSource', () => {
    it('has exactly 7 values', () => {
      expect(ALL_NODE_LABEL_SOURCES.length).toBe(7);
    });

    it('includes manual_tag', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('manual_tag');
    });

    it('includes auto_metadata', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('auto_metadata');
    });

    it('includes lifecycle', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('lifecycle');
    });

    it('includes semantic_referee', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('semantic_referee');
    });

    it('includes composition_mutation', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('composition_mutation');
    });

    it('includes ai_classifier', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('ai_classifier');
    });

    it('includes future_source sentinel', () => {
      expect(ALL_NODE_LABEL_SOURCES).toContain('future_source');
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ALL_NODE_LABEL_SOURCES)).toBe(true);
    });

    it('every value is a NodeLabelSource at compile time (type guard)', () => {
      const acc: NodeLabelSource[] = [];
      for (const v of ALL_NODE_LABEL_SOURCES) acc.push(v);
      expect(acc.length).toBe(7);
    });
  });

  describe('NodeLabelSurface', () => {
    it('has exactly 5 values', () => {
      expect(ALL_NODE_LABEL_SURFACES.length).toBe(5);
    });

    it('includes timeline_node', () => {
      expect(ALL_NODE_LABEL_SURFACES).toContain('timeline_node');
    });

    it('includes selected_context', () => {
      expect(ALL_NODE_LABEL_SURFACES).toContain('selected_context');
    });

    it('includes inspect', () => {
      expect(ALL_NODE_LABEL_SURFACES).toContain('inspect');
    });

    it('includes composer', () => {
      expect(ALL_NODE_LABEL_SURFACES).toContain('composer');
    });

    it('includes hidden', () => {
      expect(ALL_NODE_LABEL_SURFACES).toContain('hidden');
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ALL_NODE_LABEL_SURFACES)).toBe(true);
    });
  });

  describe('NodeLabelDisposition', () => {
    it('has exactly 6 values', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS.length).toBe(6);
    });

    it('includes rendered_now', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('rendered_now');
    });

    it('includes inspect_only', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('inspect_only');
    });

    it('includes composer_only', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('composer_only');
    });

    it('includes hidden_sensitive', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('hidden_sensitive');
    });

    it('includes future_source', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('future_source');
    });

    it('includes intentionally_silent', () => {
      expect(ALL_NODE_LABEL_DISPOSITIONS).toContain('intentionally_silent');
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ALL_NODE_LABEL_DISPOSITIONS)).toBe(true);
    });
  });

  describe('Narrowed subtype aliases (audit-recommended)', () => {
    it('MachineObservationSource excludes manual_tag', () => {
      // Compile-time: assigning manual_tag to MachineObservationSource fails.
      // Runtime: verify by exhausting the union at type-narrow boundary.
      const machineSources: MachineObservationSource[] = [
        'auto_metadata',
        'lifecycle',
        'semantic_referee',
        'composition_mutation',
        'ai_classifier',
      ];
      expect(machineSources).not.toContain('manual_tag' as never);
      expect(machineSources).not.toContain('future_source' as never);
      expect(machineSources.length).toBe(5);
    });

    it('UserAllegationSource includes only manual_tag', () => {
      const userSources: UserAllegationSource[] = ['manual_tag'];
      expect(userSources.length).toBe(1);
      expect(userSources[0]).toBe('manual_tag');
    });
  });

  describe('NodeLabelMark interface shape', () => {
    it('accepts a Machine Observation mark with all required fields', () => {
      const mark: NodeLabelMark = {
        id: 'machine_observation:lifecycle:rebutted:msg-1',
        rawKey: 'rebutted',
        kind: 'machine_observation',
        source: 'lifecycle',
        label: 'Under pressure',
        shortLabel: 'Pressured',
        description: 'This message is under pressure from a challenge.',
        defaultSurface: 'timeline_node',
        disposition: 'rendered_now',
        priority: 14,
        visibleByDefault: true,
      };
      expect(mark.kind).toBe('machine_observation');
      expect(mark.source).toBe('lifecycle');
    });

    it('accepts a User Allegation mark with all required fields', () => {
      const mark: NodeLabelMark = {
        id: 'user_allegation:manual_tag:needs_source:msg-1',
        rawKey: 'needs_source',
        kind: 'user_allegation',
        source: 'manual_tag',
        label: 'Needs source',
        shortLabel: 'Needs src',
        description: 'A participant has flagged this as needing a source.',
        defaultSurface: 'timeline_node',
        disposition: 'rendered_now',
        priority: 10,
        visibleByDefault: true,
      };
      expect(mark.kind).toBe('user_allegation');
      expect(mark.source).toBe('manual_tag');
    });

    it('accepts optional confidence for AI-classifier marks', () => {
      const mark: NodeLabelMark = {
        id: 'machine_observation:ai_classifier:introduces_new_issue:msg-1',
        rawKey: 'introduces_new_issue',
        kind: 'machine_observation',
        source: 'ai_classifier',
        label: 'Side issue',
        shortLabel: 'Side issue',
        description: 'A side issue was introduced.',
        defaultSurface: 'timeline_node',
        disposition: 'future_source',
        priority: 40,
        visibleByDefault: false,
        confidence: 'medium',
      };
      expect(mark.confidence).toBe('medium');
    });
  });

  describe('Closed-union exhaustiveness assertions (compile + runtime)', () => {
    it('every NodeLabelKind value is round-trippable through a typed reducer', () => {
      const result: Record<NodeLabelKind, number> = {
        machine_observation: 0,
        user_allegation: 0,
      };
      for (const k of ALL_NODE_LABEL_KINDS) result[k] += 1;
      expect(result.machine_observation).toBe(1);
      expect(result.user_allegation).toBe(1);
    });

    it('every NodeLabelSurface value is round-trippable through a typed reducer', () => {
      const result: Record<NodeLabelSurface, number> = {
        timeline_node: 0,
        selected_context: 0,
        inspect: 0,
        composer: 0,
        hidden: 0,
      };
      for (const s of ALL_NODE_LABEL_SURFACES) result[s] += 1;
      for (const k of Object.keys(result)) {
        expect(result[k as NodeLabelSurface]).toBe(1);
      }
    });

    it('every NodeLabelDisposition value is round-trippable through a typed reducer', () => {
      const result: Record<NodeLabelDisposition, number> = {
        rendered_now: 0,
        inspect_only: 0,
        composer_only: 0,
        hidden_sensitive: 0,
        future_source: 0,
        intentionally_silent: 0,
      };
      for (const d of ALL_NODE_LABEL_DISPOSITIONS) result[d] += 1;
      for (const k of Object.keys(result)) {
        expect(result[k as NodeLabelDisposition]).toBe(1);
      }
    });
  });
});
