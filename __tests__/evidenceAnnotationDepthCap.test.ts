/**
 * EV-005 — Annotation depth-cap tests.
 *
 * The cap is ONE nested level: an annotation may sit on an artifact (depth 0)
 * or on a depth-0 annotation (depth 1). Nothing deeper persists. Beyond the
 * cap the UI offers a synthesis move instead.
 *
 * Pure-TS — imports enforceAnnotationDepthCap directly.
 */
import {
  ANNOTATION_SYNTHESIS_PROMPT_LABEL,
  enforceAnnotationDepthCap,
  type EvidenceAnnotation,
  type EvidenceAnnotationKind,
} from '../src/features/evidence/evidenceModel';

const ARTIFACT_ID = 'arg-1:evidence:0';

/**
 * Build a raw annotation object directly (bypassing buildEvidenceAnnotation)
 * so the test can mint a true depth-2 record — the constructor caps depth to
 * 0 | 1, but enforceAnnotationDepthCap must still defensively suppress a
 * deeper value if it appears in stored data.
 */
function raw(
  id: string,
  kind: EvidenceAnnotationKind,
  depth: number,
  parentAnnotationId: string | null = null,
): EvidenceAnnotation {
  return {
    id,
    evidenceArtifactId: ARTIFACT_ID,
    kind,
    addedByUserId: 'u',
    createdAt: '2026-05-20T00:00:00.000Z',
    depth: depth as 0 | 1,
    parentAnnotationId,
  };
}

describe('enforceAnnotationDepthCap', () => {
  it('accepts every depth-0 annotation', () => {
    const list = [
      raw('a0', 'primary_source', 0),
      raw('a1', 'broken_link', 0),
      raw('a2', 'context_requested', 0),
    ];
    const result = enforceAnnotationDepthCap(list);
    expect(result.accepted).toHaveLength(3);
    expect(result.suppressed).toHaveLength(0);
  });

  it('accepts a depth-1 annotation whose parent resolves to an accepted depth-0', () => {
    const list = [
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'a0'),
    ];
    const result = enforceAnnotationDepthCap(list);
    expect(result.accepted.map((a) => a.id)).toEqual(['a0', 'a1']);
    expect(result.suppressed).toHaveLength(0);
  });

  it('one accepted depth-1 annotation sets showsSynthesisPrompt true', () => {
    const result = enforceAnnotationDepthCap([
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'a0'),
    ]);
    expect(result.showsSynthesisPrompt).toBe(true);
    expect(result.synthesisPromptLabel).toBe('Summarise this evidence thread');
    expect(result.synthesisPromptLabel).toBe(ANNOTATION_SYNTHESIS_PROMPT_LABEL);
  });

  it('suppresses a depth-2 annotation (it never appears in accepted)', () => {
    const list = [
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'a0'),
      raw('a2', 'context_requested', 2, 'a1'),
    ];
    const result = enforceAnnotationDepthCap(list);
    expect(result.accepted.map((a) => a.id)).not.toContain('a2');
    expect(result.suppressed.map((a) => a.id)).toContain('a2');
  });

  it('suppresses an orphan depth-1 annotation (parent does not resolve)', () => {
    const result = enforceAnnotationDepthCap([
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'no-such-parent'),
    ]);
    expect(result.accepted.map((a) => a.id)).toEqual(['a0']);
    expect(result.suppressed.map((a) => a.id)).toEqual(['a1']);
  });

  it('suppresses a depth-1 annotation whose parent is itself depth-1', () => {
    const list = [
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'a0'),
      // a2 points at a1, which is a depth-1 annotation — not a valid parent.
      raw('a2', 'context_requested', 1, 'a1'),
    ];
    const result = enforceAnnotationDepthCap(list);
    expect(result.accepted.map((a) => a.id)).toEqual(['a0', 'a1']);
    expect(result.suppressed.map((a) => a.id)).toEqual(['a2']);
  });

  it('no depth-1 annotations → showsSynthesisPrompt false, label empty', () => {
    const result = enforceAnnotationDepthCap([
      raw('a0', 'primary_source', 0),
      raw('a1', 'broken_link', 0),
    ]);
    expect(result.showsSynthesisPrompt).toBe(false);
    expect(result.synthesisPromptLabel).toBe('');
  });

  it('an orphan depth-1 alone does not flip showsSynthesisPrompt', () => {
    const result = enforceAnnotationDepthCap([
      raw('a0', 'primary_source', 0),
      raw('a1', 'context_requested', 1, 'missing'),
    ]);
    expect(result.showsSynthesisPrompt).toBe(false);
  });

  it('empty input → accepted/suppressed empty, no synthesis prompt', () => {
    const result = enforceAnnotationDepthCap([]);
    expect(result.accepted).toHaveLength(0);
    expect(result.suppressed).toHaveLength(0);
    expect(result.showsSynthesisPrompt).toBe(false);
    expect(result.synthesisPromptLabel).toBe('');
  });
});
