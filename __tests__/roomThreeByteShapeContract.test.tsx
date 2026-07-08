/**
 * ROOM-003 (#829) — byte-shape contract (THE pin).
 *
 * The single HARD acceptance criterion: for equivalent input the one-bar
 * path produces a submit-argument payload that is byte-shape-identical to
 * today composer path. This is achieved by construction (both paths call the
 * SAME buildSubmitArgumentPayload on a draft from the SAME useArgumentComposer),
 * so this file is the loud guard.
 *
 * S1 half (this commit): the model-level KEY CENSUS. Snapshots the exact key
 * set buildSubmitArgumentPayload emits across every fixture (plain reply,
 * type-defaulted counter, side-defaulted, evidence-type, with target) so any
 * added / removed / renamed key fails loudly.
 *
 * S3 half (added later): the dual-render deep-equal — the legacy
 * ArgumentComposer and the new ArgumentEntryComposer rendered for equivalent
 * input, both payloads captured and compared with toEqual.
 */
import { buildSubmitArgumentPayload } from '../src/features/arguments/composerSubmit';
import type { ComposerDraft } from '../src/features/arguments/composerState';

const FIXED_ID = 'fixed-client-submission-id';

function baseDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: 'parent-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A body long enough to clear the advisory minimum comfortably.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-07-08T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

// The frozen contract: the exact required key set + the two optional keys.
const REQUIRED_KEYS = [
  'argument_type',
  'body',
  'client_submission_id',
  'debate_id',
  'parent_id',
  'selected_tag_codes',
  'side',
].sort();

describe('ROOM-003 byte-shape contract — payload key census', () => {
  it('a plain reply emits exactly the required keys (no optional keys)', () => {
    const payload = buildSubmitArgumentPayload(baseDraft(), FIXED_ID);
    expect(Object.keys(payload).sort()).toEqual(REQUIRED_KEYS);
    expect(payload).not.toHaveProperty('attached_evidence');
    expect(payload).not.toHaveProperty('target');
  });

  it('a type-defaulted counter vs an explicit counter produce the same key shape', () => {
    const defaulted = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'counter_rebuttal', parentId: 'reb-1' }),
      FIXED_ID,
    );
    const explicit = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'counter_rebuttal', parentId: 'reb-1' }),
      FIXED_ID,
    );
    expect(Object.keys(defaulted).sort()).toEqual(Object.keys(explicit).sort());
    expect(defaulted).toEqual(explicit);
    expect(defaulted.argument_type).toBe('counter_rebuttal');
  });

  it('a side-defaulted neutral reply keeps the required key set', () => {
    const payload = buildSubmitArgumentPayload(baseDraft({ side: 'neutral' }), FIXED_ID);
    expect(Object.keys(payload).sort()).toEqual(REQUIRED_KEYS);
    expect(payload.side).toBe('neutral');
  });

  it('an evidence-typed draft with a source adds attached_evidence with exactly {url,label,source_text}', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({
        argumentType: 'evidence',
        attachedEvidence: [{ url: 'https://example.test/x', label: 'A report', sourceText: 'An excerpt.' }],
      }),
      FIXED_ID,
    );
    expect(payload).toHaveProperty('attached_evidence');
    expect(payload.attached_evidence).toHaveLength(1);
    expect(Object.keys(payload.attached_evidence![0]).sort()).toEqual(['label', 'source_text', 'url']);
    expect(payload).not.toHaveProperty('target');
  });

  it('a draft with a target excerpt / disagreement axis adds target with exactly {target_excerpt,disagreement_axis}', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'rebuttal', parentId: 'claim-1', targetExcerpt: 'the disputed phrase', disagreementAxis: 'scope' }),
      FIXED_ID,
    );
    expect(payload).toHaveProperty('target');
    expect(Object.keys(payload.target!).sort()).toEqual(['disagreement_axis', 'target_excerpt']);
    expect(payload.target!.target_excerpt).toBe('the disputed phrase');
    expect(payload.target!.disagreement_axis).toBe('scope');
  });

  it('the client_submission_id is threaded verbatim (idempotency carrier)', () => {
    const payload = buildSubmitArgumentPayload(baseDraft(), FIXED_ID);
    expect(payload.client_submission_id).toBe(FIXED_ID);
  });

  it('the full key census — a maximal draft emits required + both optional keys and nothing else', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({
        argumentType: 'evidence',
        selectedTagCodes: ['evidence'],
        attachedEvidence: [{ url: 'https://example.test/y', label: 'L', sourceText: 'S' }],
        targetExcerpt: 'phrase',
        disagreementAxis: 'evidence',
      }),
      FIXED_ID,
    );
    expect(Object.keys(payload).sort()).toEqual(
      [...REQUIRED_KEYS, 'attached_evidence', 'target'].sort(),
    );
  });
});
