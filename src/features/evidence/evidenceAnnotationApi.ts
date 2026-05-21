/**
 * EV-005 — Client write-path wrapper + meta read adapter for evidence
 * annotations.
 *
 * Owns:
 *   - `addEvidenceAnnotation(input)` — a typed wrapper that routes through
 *     the `annotate-evidence` Edge Function. This file performs no direct
 *     write to the arguments table: the Edge Function is the single write
 *     path. It never references a service-role key.
 *   - `evidenceAnnotationsFromMeta(clientValidation, evidenceArtifactId)` — a
 *     pure adapter that reads the persisted `evidenceAnnotations` array back
 *     out of an argument's `client_validation` jsonb and runs it through
 *     `buildEvidenceAnnotations` (which applies `enforceAnnotationDepthCap`).
 *
 * Doctrine: an evidence annotation describes a source / record, never a
 * person. This wrapper only calls `supabase.functions.invoke` — mirrors
 * `pointTagsApi.ts` exactly.
 */
import { supabase } from '../../lib/supabase';
import {
  buildEvidenceAnnotations,
  type EvidenceAnnotation,
  type EvidenceAnnotationKind,
} from './evidenceModel';

// ── Edge Function request / response types ────────────────────

export interface AddEvidenceAnnotationInput {
  debateId: string;
  /** The argument that carries the EvidenceArtifact being annotated. */
  argumentId: string;
  /** EvidenceArtifact.id — `<argumentId>:evidence:<n>`. */
  evidenceArtifactId: string;
  kind: EvidenceAnnotationKind;
  note?: string | null;
  /** 0 = on the artifact; 1 = on a depth-0 annotation. */
  depth: 0 | 1;
  /** Required when depth === 1. */
  parentAnnotationId?: string | null;
}

export interface AddEvidenceAnnotationResponse {
  argumentId: string;
  evidenceArtifactId: string;
  /** The full annotation set on the artifact after the append. */
  annotations: ReadonlyArray<EvidenceAnnotation>;
}

export interface AddEvidenceAnnotationOutcome {
  ok: true;
  data: AddEvidenceAnnotationResponse;
}

export interface AddEvidenceAnnotationFailure {
  ok: false;
  error: { error: string; reason?: string; detail?: string };
  status: number;
}

export type AddEvidenceAnnotationResult =
  | AddEvidenceAnnotationOutcome
  | AddEvidenceAnnotationFailure;

// ── Public wrapper ────────────────────────────────────────────

/**
 * Add an evidence annotation via the `annotate-evidence` Edge Function.
 *
 * Never imports or references a service-role key, and never mutates the
 * arguments table directly — the Edge Function is the only write path. A
 * failed call returns `{ ok: false }`; the caller surfaces it inline, and
 * an ordinary post is never blocked by an annotation failure.
 */
export async function addEvidenceAnnotation(
  input: AddEvidenceAnnotationInput,
): Promise<AddEvidenceAnnotationResult> {
  const { data, error } = await supabase.functions.invoke<AddEvidenceAnnotationResponse>(
    'annotate-evidence',
    {
      body: {
        debateId: input.debateId,
        argumentId: input.argumentId,
        evidenceArtifactId: input.evidenceArtifactId,
        kind: input.kind,
        note: input.note ?? null,
        depth: input.depth,
        parentAnnotationId: input.parentAnnotationId ?? null,
      },
    },
  );

  if (error) {
    let errorBody: { error: string; reason?: string; detail?: string } = {
      error: 'network_error',
    };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as { error: string; reason?: string; detail?: string };
      }
    } catch {
      // ignore parse failures — keep the network_error fallback.
    }
    const status =
      (error as { status?: number }).status ??
      ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }

  if (!data) {
    return { ok: false, error: { error: 'empty_response' }, status: 500 };
  }

  return { ok: true, data };
}

// ── Pure meta read adapter ────────────────────────────────────

/** A raw persisted annotation entry inside client_validation.evidenceAnnotations. */
interface RawPersistedAnnotation {
  evidenceArtifactId?: unknown;
  kind?: unknown;
  note?: unknown;
  addedByUserId?: unknown;
  createdAt?: unknown;
  depth?: unknown;
  parentAnnotationId?: unknown;
}

/**
 * Pure adapter — pull persisted annotations for one artifact back out of an
 * argument's `client_validation` jsonb.
 *
 * Reads `clientValidation.evidenceAnnotations` (an array), filters to the
 * given `evidenceArtifactId`, and runs the result through
 * `buildEvidenceAnnotations` (which drops unknown kinds + applies the depth
 * cap). Returns `[]` for any malformed / missing input — never throws.
 */
export function evidenceAnnotationsFromMeta(
  clientValidation: unknown,
  evidenceArtifactId: string,
): ReadonlyArray<EvidenceAnnotation> {
  if (
    typeof evidenceArtifactId !== 'string' ||
    evidenceArtifactId.trim().length === 0 ||
    clientValidation === null ||
    typeof clientValidation !== 'object'
  ) {
    return [];
  }
  const rawAll = (clientValidation as { evidenceAnnotations?: unknown }).evidenceAnnotations;
  if (!Array.isArray(rawAll)) return [];

  const forArtifact: Array<{
    kind: EvidenceAnnotationKind;
    note?: string | null;
    addedByUserId: string;
    createdAt: string;
    depth?: number;
    parentAnnotationId?: string | null;
  }> = [];

  for (const entry of rawAll as RawPersistedAnnotation[]) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.evidenceArtifactId !== evidenceArtifactId) continue;
    // buildEvidenceAnnotations drops entries with an unknown kind or missing
    // addedByUserId / createdAt — pass them through unfiltered.
    forArtifact.push({
      kind: entry.kind as EvidenceAnnotationKind,
      note: typeof entry.note === 'string' ? entry.note : null,
      addedByUserId: typeof entry.addedByUserId === 'string' ? entry.addedByUserId : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      depth: typeof entry.depth === 'number' ? entry.depth : 0,
      parentAnnotationId:
        typeof entry.parentAnnotationId === 'string' ? entry.parentAnnotationId : null,
    });
  }

  return buildEvidenceAnnotations({ evidenceArtifactId, raw: forArtifact });
}
