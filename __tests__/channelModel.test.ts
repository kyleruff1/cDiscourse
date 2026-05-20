/**
 * RULE-005 — channelModel pure-model definition tests.
 *
 * Asserts the static channel vocabulary + definitions:
 *   - ALL_MOVE_CHANNELS has all 14 channels; ACTIVE excludes the 2 reserved.
 *   - Every channel has a CHANNEL_DEFINITIONS entry with a non-empty
 *     purpose, ReadonlyArray optionalFields, ReadonlyArray suggestedFollowups.
 *   - suggestedFollowups only contains valid MoveChannel values.
 *   - channelDefinition returns the frozen entry; throws on unknown.
 *   - channelToDraftPatch returns the expected argumentType per channel;
 *     returns an empty patch for the no-type channels.
 *   - getChannelLabel reads from gameCopy and is plain English.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_MOVE_CHANNELS,
  ACTIVE_MOVE_CHANNELS,
  RESERVED_MOVE_CHANNELS,
  CHANNEL_DEFINITIONS,
  channelDefinition,
  channelToDraftPatch,
  getChannelLabel,
  type MoveChannel,
} from '../src/features/arguments/channelModel';
import type { ConstitutionRule, ArgumentType } from '../src/domain/constitution/types';
import { RULE_CODES } from '../src/domain/constitution/types';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

/** A minimal Constitution rule set that allows the standard transitions. */
function rulesAllowing(): ConstitutionRule[] {
  const make = (code: string, allowedChildren: ArgumentType[]): ConstitutionRule => ({
    id: `rule-${code}`,
    constitutionId: 'test-const',
    code,
    title: code,
    description: '',
    ruleType: 'transition',
    severity: 'blocking',
    params: { allowedChildren },
    enabled: true,
  });
  return [
    make(RULE_CODES.TRANSITION_THESIS, ['claim', 'rebuttal', 'clarification_request']),
    make(RULE_CODES.TRANSITION_CLAIM, [
      'rebuttal',
      'evidence',
      'clarification_request',
      'concession',
      'synthesis',
    ]),
    make(RULE_CODES.TRANSITION_REBUTTAL, [
      'counter_rebuttal',
      'evidence',
      'clarification_request',
      'concession',
      'synthesis',
    ]),
    make(RULE_CODES.TRANSITION_COUNTER_REBUTTAL, [
      'rebuttal',
      'evidence',
      'clarification_request',
      'concession',
      'synthesis',
    ]),
    make(RULE_CODES.TRANSITION_EVIDENCE, ['rebuttal', 'clarification_request', 'concession']),
    make(RULE_CODES.TRANSITION_CLARIFICATION_REQUEST, ['claim', 'rebuttal', 'evidence']),
    make(RULE_CODES.TRANSITION_CONCESSION, ['synthesis']),
    make(RULE_CODES.TRANSITION_SYNTHESIS, []),
  ];
}

describe('RULE-005 channelModel — vocabulary', () => {
  it('ALL_MOVE_CHANNELS contains all 14 channels', () => {
    expect(ALL_MOVE_CHANNELS.length).toBe(14);
  });

  it('ACTIVE_MOVE_CHANNELS contains exactly the 12 non-reserved channels', () => {
    expect(ACTIVE_MOVE_CHANNELS.length).toBe(12);
    expect(ACTIVE_MOVE_CHANNELS).not.toContain('evidence_interaction');
    expect(ACTIVE_MOVE_CHANNELS).not.toContain('mode_specific');
  });

  it('RESERVED_MOVE_CHANNELS is exactly the 2 future-card channels', () => {
    expect([...RESERVED_MOVE_CHANNELS].sort()).toEqual(['evidence_interaction', 'mode_specific']);
  });

  it('ACTIVE + RESERVED partition ALL with no overlap', () => {
    const union = new Set([...ACTIVE_MOVE_CHANNELS, ...RESERVED_MOVE_CHANNELS]);
    expect(union.size).toBe(ALL_MOVE_CHANNELS.length);
    for (const c of ALL_MOVE_CHANNELS) expect(union.has(c)).toBe(true);
  });

  it('ALL_MOVE_CHANNELS / ACTIVE_MOVE_CHANNELS are frozen', () => {
    expect(Object.isFrozen(ALL_MOVE_CHANNELS)).toBe(true);
    expect(Object.isFrozen(ACTIVE_MOVE_CHANNELS)).toBe(true);
    expect(Object.isFrozen(RESERVED_MOVE_CHANNELS)).toBe(true);
  });

  it('there are no duplicate channel values', () => {
    expect(new Set(ALL_MOVE_CHANNELS).size).toBe(ALL_MOVE_CHANNELS.length);
  });
});

describe('RULE-005 channelModel — CHANNEL_DEFINITIONS', () => {
  it('every channel in ALL_MOVE_CHANNELS has a definition', () => {
    for (const c of ALL_MOVE_CHANNELS) {
      expect(Object.prototype.hasOwnProperty.call(CHANNEL_DEFINITIONS, c)).toBe(true);
    }
  });

  it('every active channel definition has a non-empty purpose', () => {
    for (const c of ACTIVE_MOVE_CHANNELS) {
      const def = CHANNEL_DEFINITIONS[c];
      expect(typeof def.purpose).toBe('string');
      expect(def.purpose.trim().length).toBeGreaterThan(0);
    }
  });

  it('every channel definition has array optionalFields + suggestedFollowups', () => {
    for (const c of ALL_MOVE_CHANNELS) {
      const def = CHANNEL_DEFINITIONS[c];
      expect(Array.isArray(def.optionalFields)).toBe(true);
      expect(Array.isArray(def.suggestedFollowups)).toBe(true);
    }
  });

  it('suggestedFollowups only references valid MoveChannel values', () => {
    const valid = new Set<MoveChannel>(ALL_MOVE_CHANNELS);
    for (const c of ALL_MOVE_CHANNELS) {
      for (const followup of CHANNEL_DEFINITIONS[c].suggestedFollowups) {
        expect(valid.has(followup)).toBe(true);
      }
    }
  });

  it('every definition.channel field matches its key', () => {
    for (const c of ALL_MOVE_CHANNELS) {
      expect(CHANNEL_DEFINITIONS[c].channel).toBe(c);
    }
  });

  it('CHANNEL_DEFINITIONS table + each entry is frozen', () => {
    expect(Object.isFrozen(CHANNEL_DEFINITIONS)).toBe(true);
    for (const c of ALL_MOVE_CHANNELS) {
      expect(Object.isFrozen(CHANNEL_DEFINITIONS[c])).toBe(true);
    }
  });

  it('meta_process / branch_tangent / confirm have a null resultingArgumentType', () => {
    expect(CHANNEL_DEFINITIONS.meta_process.resultingArgumentType).toBeNull();
    expect(CHANNEL_DEFINITIONS.branch_tangent.resultingArgumentType).toBeNull();
    expect(CHANNEL_DEFINITIONS.confirm.resultingArgumentType).toBeNull();
  });

  it('reserved channels have null resultingArgumentType + empty fields', () => {
    for (const c of RESERVED_MOVE_CHANNELS) {
      expect(CHANNEL_DEFINITIONS[c].resultingArgumentType).toBeNull();
      expect(CHANNEL_DEFINITIONS[c].optionalFields.length).toBe(0);
      expect(CHANNEL_DEFINITIONS[c].suggestedFollowups.length).toBe(0);
    }
  });

  it('add_evidence maps to the evidence argument type', () => {
    expect(CHANNEL_DEFINITIONS.add_evidence.resultingArgumentType).toBe('evidence');
  });

  it('challenge maps to the rebuttal base type', () => {
    expect(CHANNEL_DEFINITIONS.challenge.resultingArgumentType).toBe('rebuttal');
  });
});

describe('RULE-005 channelModel — channelDefinition', () => {
  it('returns the frozen definition for a known channel', () => {
    expect(channelDefinition('challenge')).toBe(CHANNEL_DEFINITIONS.challenge);
  });

  it('throws on an unknown channel value (untyped boundary guard)', () => {
    expect(() => channelDefinition('not_a_channel' as MoveChannel)).toThrow();
  });
});

describe('RULE-005 channelModel — getChannelLabel', () => {
  it('every active channel has a non-empty plain-English label', () => {
    for (const c of ACTIVE_MOVE_CHANNELS) {
      const label = getChannelLabel(c);
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
      expect(/^[A-Z]/.test(label)).toBe(true);
    }
  });

  it('no channel label looks like an internal code', () => {
    for (const c of ACTIVE_MOVE_CHANNELS) {
      expect(looksLikeInternalCode(getChannelLabel(c))).toBe(false);
    }
  });

  it('reserved channels fall back to a neutral label', () => {
    for (const c of RESERVED_MOVE_CHANNELS) {
      expect(getChannelLabel(c)).toBe('Reserved');
    }
  });

  it('channel labels are distinct across active channels', () => {
    const labels = ACTIVE_MOVE_CHANNELS.map(getChannelLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('RULE-005 channelModel — channelToDraftPatch', () => {
  const rules = rulesAllowing();

  it('add_evidence yields an evidence-type patch', () => {
    const patch = channelToDraftPatch('add_evidence', 'claim', rules);
    expect(patch.argumentType).toBe('evidence');
    expect(patch.suggestedTagCodes).toContain('evidence');
  });

  it('synthesize yields a synthesis-type patch', () => {
    expect(channelToDraftPatch('synthesize', 'concession', rules).argumentType).toBe('synthesis');
  });

  it('narrow and concede both yield a concession-type patch', () => {
    expect(channelToDraftPatch('narrow', 'claim', rules).argumentType).toBe('concession');
    expect(channelToDraftPatch('concede', 'claim', rules).argumentType).toBe('concession');
  });

  it('clarify / ask_source / ask_quote yield a clarification_request-type patch', () => {
    for (const c of ['clarify', 'ask_source', 'ask_quote'] as MoveChannel[]) {
      expect(channelToDraftPatch(c, 'claim', rules).argumentType).toBe('clarification_request');
    }
  });

  it('reply yields a claim-type patch', () => {
    expect(channelToDraftPatch('reply', null, rules).argumentType).toBe('claim');
  });

  it('challenge resolves to rebuttal against a claim parent', () => {
    expect(channelToDraftPatch('challenge', 'claim', rules).argumentType).toBe('rebuttal');
  });

  it('challenge resolves to counter_rebuttal against a rebuttal parent', () => {
    expect(channelToDraftPatch('challenge', 'rebuttal', rules).argumentType).toBe(
      'counter_rebuttal',
    );
  });

  it('challenge with no parent falls back to rebuttal', () => {
    expect(channelToDraftPatch('challenge', null, rules).argumentType).toBe('rebuttal');
  });

  it('meta_process returns an empty patch (does not change argumentType)', () => {
    expect(channelToDraftPatch('meta_process', 'claim', rules)).toEqual({});
  });

  it('branch_tangent returns an empty patch (branch is a topology op)', () => {
    expect(channelToDraftPatch('branch_tangent', 'claim', rules)).toEqual({});
  });

  it('confirm returns an empty patch (no Constitution confirm type)', () => {
    expect(channelToDraftPatch('confirm', 'claim', rules)).toEqual({});
  });

  it('returns a patch even for a transition the engine would reject (separation of concerns)', () => {
    // Parent type `synthesis` allows no replies in our rule set; the model
    // still emits a patch — Constitution validation is the engine's job.
    const patch = channelToDraftPatch('synthesize', 'synthesis', rules);
    expect(patch.argumentType).toBe('synthesis');
  });
});
