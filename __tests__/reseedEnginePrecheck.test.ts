/**
 * RESEED-001 — reseedEnginePrecheck tests.
 *
 * Proves the pre-check is a MIRROR of the real evaluateArgumentDraft: valid
 * roots pass, root-type / illegal-transition / evidence-no-source are rejected,
 * a verbatim targetExcerpt passes responsiveness, and a hand-built illegal
 * template is rejected (adversarial check #7).
 */
const { isEngineValidMove } = require('../scripts/reseeder/reseedEnginePrecheck');

const RESOLUTION = 'Resolved: school uniforms — the case for and against.';
const PARENT_BODY =
  'I argue the following thesis. On the question of school uniforms, uniforms reduce peer pressure over clothing and lower cost for families.';

describe('isEngineValidMove', () => {
  it('accepts a valid root thesis', () => {
    const v = isEngineValidMove({
      argumentType: 'thesis',
      parentType: null,
      body: 'On the question of school uniforms, mandatory uniforms reduce bullying and let students focus on learning.',
      targetExcerpt: null,
      parentBody: null,
      selectedTagCodes: [],
      attachedEvidence: [],
      resolution: RESOLUTION,
    });
    expect(v.valid).toBe(true);
    expect(v.blockingCodes).toEqual([]);
  });

  it('accepts a valid root claim', () => {
    const v = isEngineValidMove({
      argumentType: 'claim',
      parentType: null,
      body: 'A specific claim: school uniforms lower the yearly clothing cost that families carry.',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [],
    });
    expect(v.valid).toBe(true);
  });

  it('rejects a root rebuttal (root-type not allowed)', () => {
    const v = isEngineValidMove({
      argumentType: 'rebuttal',
      parentType: null,
      body: 'This rebuts a point that has no parent, which is not a valid root type in the constitution.',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [],
    });
    expect(v.valid).toBe(false);
    expect(v.blockingCodes.length).toBeGreaterThan(0);
  });

  it('rejects an illegal transition (synthesis under thesis) with INVALID_TRANSITION', () => {
    const v = isEngineValidMove({
      argumentType: 'synthesis',
      parentType: 'thesis',
      parentBody: PARENT_BODY,
      body: 'I grant the school uniforms point and synthesize the discussion into a closing summary here.',
      targetExcerpt: 'school uniforms',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [],
    });
    expect(v.valid).toBe(false);
    // blockingCodes are the engine's flagCode values (lowercase snake_case).
    expect(v.blockingCodes).toContain('invalid_transition');
  });

  it('rejects an evidence move with no source (EVIDENCE_REQUIRED)', () => {
    const v = isEngineValidMove({
      argumentType: 'evidence',
      parentType: 'thesis',
      parentBody: PARENT_BODY,
      body: 'Here is evidence for the school uniforms claim, but no source is attached to this move at all.',
      targetExcerpt: 'school uniforms',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [],
    });
    expect(v.valid).toBe(false);
    expect(v.blockingCodes).toContain('evidence_required');
  });

  it('accepts an evidence move WITH a source', () => {
    const v = isEngineValidMove({
      argumentType: 'evidence',
      parentType: 'thesis',
      parentBody: PARENT_BODY,
      body: 'Here is evidence for the school uniforms claim, drawing on the attached reference material.',
      targetExcerpt: 'school uniforms',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [{ sourceText: 'Reference material on school uniforms (dev/test source stub).' }],
    });
    expect(v.valid).toBe(true);
  });

  it('accepts a reply whose targetExcerpt is a verbatim substring of the parent (responsiveness satisfied)', () => {
    const excerpt = 'school uniforms';
    expect(PARENT_BODY.includes(excerpt)).toBe(true);
    const v = isEngineValidMove({
      argumentType: 'rebuttal',
      parentType: 'thesis',
      parentBody: PARENT_BODY,
      body: 'This rebuttal challenges the scope of the claim about reducing peer pressure over clothing.',
      targetExcerpt: excerpt,
      selectedTagCodes: ['scope_challenge'],
      attachedEvidence: [],
      resolution: RESOLUTION,
    });
    expect(v.valid).toBe(true);
  });

  it('rejects a hand-built illegal template (adversarial check #7)', () => {
    // concession under thesis is NOT a legal transition (thesis allows
    // claim|rebuttal|evidence|clarification_request only).
    const v = isEngineValidMove({
      argumentType: 'concession',
      parentType: 'thesis',
      parentBody: PARENT_BODY,
      body: 'I grant this point about school uniforms but that transition is illegal from a thesis parent.',
      targetExcerpt: 'school uniforms',
      resolution: RESOLUTION,
      selectedTagCodes: [],
      attachedEvidence: [],
    });
    expect(v.valid).toBe(false);
    expect(v.blockingCodes).toContain('invalid_transition');
  });

  it('rejects a malformed (non-object) move', () => {
    const v = isEngineValidMove(null);
    expect(v.valid).toBe(false);
  });
});
