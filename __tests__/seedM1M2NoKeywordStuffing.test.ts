/**
 * Stage 6.1.9 follow-up — M1 (xAI-derived root thesis) and M2 (xAI-derived
 * initial rebuttal) must not be rejected for missing lexical keyword
 * overlap with the room resolution or the parent body.
 *
 * These tests run against the shared evaluation engine that `submit-argument`
 * uses on the server side. If any of them flips to `allowPost: false` because
 * of topic / parent-overlap / concession / clarification / axis / short-body
 * heuristics, the Edge Function would reject the seed move at runtime.
 */
import { evaluateArgumentDraft } from '../src/domain/constitution/evaluateArgumentDraft';
import { runRailsChecks } from '../src/domain/constitution/railsChecks';
import { FLAG_CODES } from '../src/domain/constitution/types';
import {
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
  constitutionVersion,
} from '../src/domain/constitution/constitution.v1';
import type {
  ArgumentDraftEvaluationInput,
  ParentArgument,
} from '../src/domain/constitution/types';

const ROOM_RESOLUTION =
  'Universal basic income is a net positive policy for long-term poverty reduction.';
const ROOM_DESCRIPTION = 'Debate over UBI as a poverty-reduction policy.';

function input(overrides: Partial<ArgumentDraftEvaluationInput> = {}): ArgumentDraftEvaluationInput {
  return {
    debateId: 'debate-seed-1',
    debateResolution: ROOM_RESOLUTION,
    debateDescription: ROOM_DESCRIPTION,
    parentArgument: undefined,
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'placeholder',
    selectedTagCodes: [],
    activeConstitution: constitutionVersion,
    activeRules: constitutionRules,
    tagDefinitions,
    flagDefinitions,
    ...overrides,
  };
}

function parent(argumentType: ParentArgument['argumentType'], body: string): ParentArgument {
  return { id: 'parent-1', argumentType, side: 'affirmative', body, depth: 0 };
}

describe('Stage 6.1.9 follow-up — M1 / M2 seed validation does not require keyword stuffing', () => {
  // ── M1: root thesis from xAI source post ───────────────────────

  it('M1 root thesis with zero lexical overlap with the room resolution still posts', () => {
    // xAI-derived "real X discussion" seed — shares no words with the
    // operator-set resolution about UBI.
    const xaiSeed =
      'The pitch clock visibly changed the pacing of regular-season baseball games this year, and umpires have grown more confident enforcing it.';
    const result = evaluateArgumentDraft(input({
      argumentType: 'thesis',
      body: xaiSeed,
      parentArgument: undefined,
    }));
    expect(result.allowPost).toBe(true);
    // The off-topic warning may be present, but it must be a WARNING, not a block.
    expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.OFF_TOPIC)).toBe(false);
  });

  it('M1 root thesis is allowed as `thesis` at root without parent (no missing_parent block)', () => {
    const result = evaluateArgumentDraft(input({
      argumentType: 'thesis',
      body:
        'Bike lanes work better as curb space than parking in dense urban cores, but only when enforcement budgets match.',
      parentArgument: undefined,
    }));
    expect(result.allowPost).toBe(true);
    expect(result.blockingErrors.some((e) => e.flagCode === FLAG_CODES.MISSING_PARENT)).toBe(false);
  });

  // ── M2: initial rebuttal tied to selectedDissent / target excerpt ─

  it('M2 initial rebuttal posts when it is parent-linked, even with no lexical overlap with parent or resolution', () => {
    const parentBody =
      'Pitch-clock enforcement is consistent and games are noticeably shorter without losing competitive integrity.';
    const m2Body =
      'Quote the umpire-discretion log for late-game high-leverage at-bats; the mechanism is not what the talking points claim.';
    const result = evaluateArgumentDraft(input({
      argumentType: 'rebuttal',
      body: m2Body,
      parentArgument: parent('thesis', parentBody),
      selectedTagCodes: ['evidence_challenge'], // axis declared
      target: {
        targetExcerpt: 'Pitch-clock enforcement is consistent',
        disagreementAxis: 'evidence',
      },
    }));
    expect(result.allowPost).toBe(true);
    expect(result.blockingErrors.length).toBe(0);
  });

  it('M2 with a target_excerpt that is a substring of the parent body silences parent-nonresponsive entirely', () => {
    const parentBody =
      'Universal basic income reduces poverty over the long run, especially in regions with weak labor markets.';
    const targetSlice = parentBody.slice(0, 60);
    const m2Body =
      'Quote the section about long-run effects — the bridge from short-term pilots to long-term policy is the missing mechanism.';
    const rails = runRailsChecks({
      argumentType: 'rebuttal',
      body: m2Body,
      parentBody,
      selectedTagCodes: ['evidence_challenge'],
      target: { targetExcerpt: targetSlice, disagreementAxis: 'evidence' },
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    // No entries at all when the target_excerpt is found in the parent body.
    const parentRelated = rails.entries.filter(
      (e) =>
        e.flagCode === FLAG_CODES.PARENT_NONRESPONSIVE ||
        e.flagCode === FLAG_CODES.TANGENT_SHIFT,
    );
    expect(parentRelated).toHaveLength(0);
  });

  it('M2 dissent skeleton without any matching parent keywords does not get a blocking flag', () => {
    const parentBody = 'Solar panels make grid balancing easier in sunny regions of the country.';
    const m2Body =
      'Show the curtailment numbers for the Iberian peninsula in the last twelve months; the framing is amplification, not analysis.';
    const result = evaluateArgumentDraft(input({
      argumentType: 'rebuttal',
      body: m2Body,
      parentArgument: parent('thesis', parentBody),
      selectedTagCodes: ['evidence_challenge'],
      target: { disagreementAxis: 'evidence' },
    }));
    expect(result.allowPost).toBe(true);
  });

  // ── Late moves still get advisory feedback (but never blocking) ──

  it('an unrelated tangent at m3+ still posts but surfaces an advisory parent-nonresponsive warning', () => {
    const parentBody =
      'The new pitch-clock rule reduced average game duration by 25 minutes during the regular season.';
    const m3Body = 'Cats are wonderful pets that bring joy to households everywhere in the world today.';
    const rails = runRailsChecks({
      argumentType: 'counter_rebuttal',
      body: m3Body,
      parentBody,
      selectedTagCodes: [],
      activeRules: constitutionRules,
      source: 'server_rules',
    });
    const advisoryHits = rails.entries.filter((e) => e.kind === 'warning');
    expect(advisoryHits.length).toBeGreaterThan(0);
    const blockingHits = rails.entries.filter((e) => e.kind === 'blocking');
    expect(blockingHits.length).toBe(0);
  });

  // ── Posting path safety ────────────────────────────────────────

  it('xAI-derived seed bodies are not normalized in a way that creates blocking flags from redactor markers', () => {
    const body =
      'Posted at <x-link> by <x-handle>: the underlying claim about subway delays needs a primary source, not a screenshot.';
    const result = evaluateArgumentDraft(input({
      argumentType: 'thesis',
      body,
      parentArgument: undefined,
    }));
    expect(result.allowPost).toBe(true);
  });
});
