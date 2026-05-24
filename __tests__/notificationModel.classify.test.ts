/**
 * QOL-040 — classifyArgumentTrigger returns the correct
 * argument-derived trigger for each input shape. Per design §5.1
 * + §10 "Multi-meaning move": when a single insert qualifies for
 * multiple triggers, the MORE SPECIFIC one wins
 * (evidence_supplied > concession_challenged > source_requested
 * > new_response).
 */
import {
  classifyArgumentTrigger,
  type ClassifyArgumentTriggerInput,
} from '../src/features/notifications/notificationModel';

function input(overrides: Partial<ClassifyArgumentTriggerInput> = {}): ClassifyArgumentTriggerInput {
  return {
    argumentType: 'rebuttal',
    parentArgumentType: 'thesis',
    concessionAcceptanceGradient: null,
    resolvesEvidenceDebt: false,
    opensEvidenceDebt: false,
    ...overrides,
  };
}

describe('classifyArgumentTrigger — argument-derived trigger selection', () => {
  it('plain rebuttal → new_response', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'rebuttal' }))).toBe('new_response');
  });

  it('counter_rebuttal → new_response', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'counter_rebuttal' }))).toBe('new_response');
  });

  it('synthesis → new_response', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'synthesis' }))).toBe('new_response');
  });

  it('clarification → new_response', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'clarification' }))).toBe('new_response');
  });

  it('clarification_request → new_response (when no debt opens)', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'clarification_request' }))).toBe('new_response');
  });

  it('disagree-gradient concession acceptance → concession_challenged', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'disagree_fact',
        }),
      ),
    ).toBe('concession_challenged');
  });

  it('agree-gradient concession acceptance is NOT a challenge', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'agree',
        }),
      ),
    ).toBe('new_response');
  });

  it('agree_with_caveat is a disagree-direction grade and → concession_challenged', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'agree_with_caveat',
        }),
      ),
    ).toBe('concession_challenged');
  });

  it('opens evidence debt → source_requested (when no debt resolved)', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'clarification_request',
          opensEvidenceDebt: true,
        }),
      ),
    ).toBe('source_requested');
  });

  it('resolves evidence debt → evidence_supplied (most specific wins)', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'evidence',
          resolvesEvidenceDebt: true,
        }),
      ),
    ).toBe('evidence_supplied');
  });

  it('multi-meaning: both resolves and challenges → evidence_supplied wins (more specific)', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'disagree_framing',
          resolvesEvidenceDebt: true,
        }),
      ),
    ).toBe('evidence_supplied');
  });

  it('multi-meaning: both challenges and opens → concession_challenged wins (more specific)', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'disagree_context',
          opensEvidenceDebt: true,
        }),
      ),
    ).toBe('concession_challenged');
  });

  it('thesis → null (own-thesis insert produces no notification)', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'thesis' }))).toBeNull();
  });

  it('claim → null', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'claim' }))).toBeNull();
  });

  it('unknown argument_type → null', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'unknown_arg_type' }))).toBeNull();
  });

  it('handles undefined / wrong-shape input safely (returns null, never throws)', () => {
    expect(classifyArgumentTrigger(undefined as unknown as ClassifyArgumentTriggerInput)).toBeNull();
    expect(classifyArgumentTrigger(null as unknown as ClassifyArgumentTriggerInput)).toBeNull();
  });

  it('case-insensitive on argumentType', () => {
    expect(classifyArgumentTrigger(input({ argumentType: 'REBUTTAL' }))).toBe('new_response');
    expect(classifyArgumentTrigger(input({ argumentType: 'Rebuttal' }))).toBe('new_response');
  });

  it('case-insensitive on concessionAcceptanceGradient', () => {
    expect(
      classifyArgumentTrigger(
        input({
          argumentType: 'respond_to_concession',
          concessionAcceptanceGradient: 'AGREE',
        }),
      ),
    ).toBe('new_response');
  });
});
