/**
 * EV-005 — evidenceAnnotationApi client wrapper + meta adapter tests.
 *
 * The wrapper (`addEvidenceAnnotation`) routes through the Edge Function —
 * `supabase.functions.invoke` is mocked. The pure adapter
 * (`evidenceAnnotationsFromMeta`) is executed directly. A file-level scan
 * asserts the no-service-role / no-direct-update structural contract.
 */
import * as fs from 'fs';
import * as path from 'path';

const mockInvoke = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import {
  addEvidenceAnnotation,
  evidenceAnnotationsFromMeta,
} from '../src/features/evidence/evidenceAnnotationApi';

beforeEach(() => {
  mockInvoke.mockReset();
});

const ARTIFACT_ID = 'arg-1:evidence:0';

// ── addEvidenceAnnotation — call shape ────────────────────────

describe('addEvidenceAnnotation — Edge Function routing', () => {
  it('invokes annotate-evidence with the exact body', async () => {
    mockInvoke.mockResolvedValue({
      data: { argumentId: 'arg-1', evidenceArtifactId: ARTIFACT_ID, annotations: [] },
      error: null,
    });
    await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      note: 'an original record',
      depth: 0,
    });
    expect(mockInvoke).toHaveBeenCalledWith('annotate-evidence', {
      body: {
        debateId: 'd1',
        argumentId: 'arg-1',
        evidenceArtifactId: ARTIFACT_ID,
        kind: 'primary_source',
        note: 'an original record',
        depth: 0,
        parentAnnotationId: null,
      },
    });
  });

  it('defaults note + parentAnnotationId to null when omitted', async () => {
    mockInvoke.mockResolvedValue({
      data: { argumentId: 'arg-1', evidenceArtifactId: ARTIFACT_ID, annotations: [] },
      error: null,
    });
    await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'broken_link',
      depth: 0,
    });
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.note).toBeNull();
    expect(body.parentAnnotationId).toBeNull();
  });

  it('returns ok:true with the annotations array on success', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        argumentId: 'arg-1',
        evidenceArtifactId: ARTIFACT_ID,
        annotations: [
          {
            id: `${ARTIFACT_ID}:annotation:0`,
            evidenceArtifactId: ARTIFACT_ID,
            kind: 'primary_source',
            addedByUserId: 'u1',
            createdAt: '2026-05-20T00:00:00.000Z',
            depth: 0,
          },
        ],
      },
      error: null,
    });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.annotations).toHaveLength(1);
  });

  it('maps a 403 not_eligible function error to ok:false with status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 403,
        context: { json: async () => ({ error: 'forbidden', reason: 'not_eligible' }) },
      },
    });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error.reason).toBe('not_eligible');
    }
  });

  it('maps a 400 depth_cap_exceeded function error to ok:false', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 400,
        context: { json: async () => ({ error: 'bad_request', detail: 'depth_cap_exceeded' }) },
      },
    });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'context_requested',
      depth: 1,
      parentAnnotationId: `${ARTIFACT_ID}:annotation:0`,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error.detail).toBe('depth_cap_exceeded');
    }
  });

  it('maps a 401 to ok:false with status 401', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 401,
        context: { json: async () => ({ error: 'unauthorized' }) },
      },
    });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('maps a 500 function error to ok:false', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        status: 500,
        context: { json: async () => ({ error: 'internal_error', detail: 'persist_failed' }) },
      },
    });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(500);
  });

  it('maps a FunctionsFetchError (not deployed / offline) to status 503', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error.error).toBe('network_error');
    }
  });

  it('returns ok:false empty_response when invoke yields no data and no error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const result = await addEvidenceAnnotation({
      debateId: 'd1',
      argumentId: 'arg-1',
      evidenceArtifactId: ARTIFACT_ID,
      kind: 'primary_source',
      depth: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('empty_response');
      expect(result.status).toBe(500);
    }
  });
});

// ── evidenceAnnotationsFromMeta — pure adapter ────────────────

describe('evidenceAnnotationsFromMeta', () => {
  it('pulls annotations for the artifact out of a well-formed client_validation', () => {
    const clientValidation = {
      attachedEvidence: [{ url: 'https://example.com' }],
      evidenceAnnotations: [
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'primary_source',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'broken_link',
          addedByUserId: 'u2',
          createdAt: '2026-05-20T01:00:00.000Z',
          depth: 0,
        },
      ],
    };
    const out = evidenceAnnotationsFromMeta(clientValidation, ARTIFACT_ID);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.kind)).toEqual(['primary_source', 'broken_link']);
  });

  it('filters out annotations for a different artifact', () => {
    const clientValidation = {
      evidenceAnnotations: [
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'primary_source',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
        {
          evidenceArtifactId: 'arg-1:evidence:1',
          kind: 'broken_link',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
      ],
    };
    const out = evidenceAnnotationsFromMeta(clientValidation, ARTIFACT_ID);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('primary_source');
  });

  it('returns [] for null / undefined / non-object client_validation', () => {
    expect(evidenceAnnotationsFromMeta(null, ARTIFACT_ID)).toHaveLength(0);
    expect(evidenceAnnotationsFromMeta(undefined, ARTIFACT_ID)).toHaveLength(0);
    expect(evidenceAnnotationsFromMeta('garbage', ARTIFACT_ID)).toHaveLength(0);
  });

  it('returns [] when evidenceAnnotations is missing or not an array', () => {
    expect(evidenceAnnotationsFromMeta({ attachedEvidence: [] }, ARTIFACT_ID)).toHaveLength(0);
    expect(
      evidenceAnnotationsFromMeta({ evidenceAnnotations: 'nope' }, ARTIFACT_ID),
    ).toHaveLength(0);
  });

  it('returns [] for an empty / blank evidenceArtifactId', () => {
    const clientValidation = {
      evidenceAnnotations: [
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'primary_source',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
      ],
    };
    expect(evidenceAnnotationsFromMeta(clientValidation, '')).toHaveLength(0);
    expect(evidenceAnnotationsFromMeta(clientValidation, '   ')).toHaveLength(0);
  });

  it('drops a malformed entry (unknown kind) without throwing', () => {
    const clientValidation = {
      evidenceAnnotations: [
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'not_a_real_kind',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'primary_source',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
      ],
    };
    const out = evidenceAnnotationsFromMeta(clientValidation, ARTIFACT_ID);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('primary_source');
  });

  it('applies the depth cap — drops an orphan depth-1 annotation', () => {
    const clientValidation = {
      evidenceAnnotations: [
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'primary_source',
          addedByUserId: 'u1',
          createdAt: '2026-05-20T00:00:00.000Z',
          depth: 0,
        },
        {
          evidenceArtifactId: ARTIFACT_ID,
          kind: 'context_requested',
          addedByUserId: 'u2',
          createdAt: '2026-05-20T01:00:00.000Z',
          depth: 1,
          parentAnnotationId: 'does-not-resolve',
        },
      ],
    };
    const out = evidenceAnnotationsFromMeta(clientValidation, ARTIFACT_ID);
    // depth-0 accepted; orphan depth-1 suppressed.
    expect(out).toHaveLength(1);
    expect(out[0].depth).toBe(0);
  });
});

// ── File-level safety ─────────────────────────────────────────

describe('evidenceAnnotationApi — file-level safety', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/evidence/evidenceAnnotationApi.ts'),
    'utf8',
  );

  it('imports no service-role / Anthropic key', () => {
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/service_role/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/createServiceClient/);
  });

  it("never updates public.arguments directly — only invokes the Edge Function", () => {
    expect(src).not.toMatch(/from\(['"]arguments['"]\)/);
    expect(src).toMatch(/supabase\.functions\.invoke(<[^>]*>)?\(\s*['"]annotate-evidence['"]/);
  });

  it('never calls .update() or .delete() on a Supabase table', () => {
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
  });

  it('makes no AI call', () => {
    expect(src).not.toMatch(/anthropic/i);
    expect(src).not.toMatch(/api\.x\.ai/i);
  });
});
