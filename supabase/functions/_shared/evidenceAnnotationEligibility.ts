/**
 * EV-005 — Deno-side mirror of the evidence-annotation eligibility rule.
 *
 * MIRROR of the EV-005 section of src/features/evidence/evidenceModel.ts —
 * keep the kind list + eligibility table + isAnnotationAllowed +
 * enforceAnnotationDepthCap byte-equivalent. Verified by
 * __tests__/annotateEvidenceEdgeFunction.test.ts and
 * __tests__/evidenceAnnotationEligibilityMirror.test.ts.
 *
 * Why this file exists: Edge Functions run on Deno with a separate module
 * graph and cannot import from `src/`. The `annotate-evidence` Edge Function
 * must enforce the SAME eligibility + depth-cap rule the EV-005 client model
 * encodes. This is the same pattern `_shared/pointTagEligibility.ts` follows
 * for META-001.
 *
 * Doctrine: an evidence annotation describes the SOURCE / RECORD, never a
 * person. Observers may NEVER add an annotation. Own-bubble authors may add
 * only the 3 self-descriptive kinds. Other-bubble participants + admins may
 * add all 18. AI may never add one — the caller must be an explicit human.
 *
 * Pure TS. No Deno API, no Supabase, no network, no async, no mutation.
 */

// ── Annotation kind vocabulary (18 kinds) ─────────────────────

export type EvidenceAnnotationKind =
  | 'primary_source'
  | 'secondary_analysis'
  | 'quote_attached'
  | 'source_missing_quote'
  | 'quote_disputed'
  | 'context_requested'
  | 'retraction_attached'
  | 'source_later_updated'
  | 'satire_parody_context'
  | 'screenshot_only_chain_weak'
  | 'misreporting_alleged'
  | 'translation_context_issue'
  | 'outdated_source'
  | 'methodology_dispute'
  | 'broken_link'
  | 'paywalled_source'
  | 'conflicting_source'
  | 'source_chain_anchored';

/** Frozen array of every annotation kind. Exactly 18 entries. */
export const ALL_EVIDENCE_ANNOTATION_KINDS: ReadonlyArray<EvidenceAnnotationKind> = Object.freeze([
  'primary_source',
  'secondary_analysis',
  'quote_attached',
  'source_missing_quote',
  'quote_disputed',
  'context_requested',
  'retraction_attached',
  'source_later_updated',
  'satire_parody_context',
  'screenshot_only_chain_weak',
  'misreporting_alleged',
  'translation_context_issue',
  'outdated_source',
  'methodology_dispute',
  'broken_link',
  'paywalled_source',
  'conflicting_source',
  'source_chain_anchored',
]);

/** The 3 self-descriptive kinds an own-bubble author may add. */
export const OWN_BUBBLE_ANNOTATION_KINDS: ReadonlyArray<EvidenceAnnotationKind> = Object.freeze([
  'source_later_updated',
  'retraction_attached',
  'context_requested',
]);

// ── Actor eligibility ──────────────────────────────────────────

export type EvidenceAnnotationActorRole =
  | 'participant_other_bubble'
  | 'participant_own_bubble'
  | 'observer'
  | 'admin';

export interface EvidenceAnnotationEligibilityContext {
  actorRole: EvidenceAnnotationActorRole;
  /** depth of the annotation being added: 0 (on artifact) or 1 (on annotation). */
  targetDepth: 0 | 1;
}

/**
 * Frozen table — actorRole → the kinds that actor may add. Observers add
 * nothing; own-bubble authors add only the 3 self-descriptive kinds;
 * other-bubble participants and admins add all 18.
 */
export const EVIDENCE_ANNOTATION_ELIGIBILITY: Readonly<
  Record<EvidenceAnnotationActorRole, ReadonlyArray<EvidenceAnnotationKind>>
> = Object.freeze({
  participant_other_bubble: ALL_EVIDENCE_ANNOTATION_KINDS,
  participant_own_bubble: OWN_BUBBLE_ANNOTATION_KINDS,
  observer: Object.freeze([]),
  admin: ALL_EVIDENCE_ANNOTATION_KINDS,
});

/** True when a value is one of the 18 known annotation kinds. */
export function isEvidenceAnnotationKind(value: unknown): value is EvidenceAnnotationKind {
  return (
    typeof value === 'string' &&
    (ALL_EVIDENCE_ANNOTATION_KINDS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * Pure helper. Returns true when an annotation add would be allowed given
 * the actor role + target depth.
 *
 *   - Observers → always false.
 *   - targetDepth not in {0,1} → always false (the depth cap).
 *   - own-bubble → only the 3 self-descriptive kinds.
 *   - other-bubble + admin → all 18.
 */
export function isAnnotationAllowed(
  kind: EvidenceAnnotationKind,
  ctx: EvidenceAnnotationEligibilityContext,
): boolean {
  if (ctx.actorRole === 'observer') return false;
  if (ctx.targetDepth !== 0 && ctx.targetDepth !== 1) return false;
  const allowed = EVIDENCE_ANNOTATION_ELIGIBILITY[ctx.actorRole];
  if (!allowed) return false;
  return allowed.includes(kind);
}

// ── Depth cap ─────────────────────────────────────────────────

/** The locked one-nested-level annotation cap. */
export const MAX_ANNOTATION_DEPTH = 1;

/**
 * A minimal annotation shape — just the fields the depth cap reads. The
 * Edge Function passes `[...existing, candidate]` through this before the
 * privileged write so a depth >= 2 / orphan candidate is rejected.
 */
export interface DepthCapAnnotation {
  id: string;
  depth: number;
  parentAnnotationId?: string | null;
}

export interface DepthCapResult<T extends DepthCapAnnotation> {
  accepted: ReadonlyArray<T>;
  suppressed: ReadonlyArray<T>;
}

/**
 * Partition annotations by the one-level nesting cap.
 *
 *   depth 0 — always accepted.
 *   depth 1 — accepted IF parentAnnotationId resolves to an accepted depth-0
 *             annotation; orphan / depth-1-on-depth-1 otherwise suppressed.
 *   depth >= 2 — always suppressed.
 */
export function enforceAnnotationDepthCap<T extends DepthCapAnnotation>(
  annotations: ReadonlyArray<T>,
): DepthCapResult<T> {
  const accepted: T[] = [];
  const suppressed: T[] = [];

  const acceptedDepthZeroIds = new Set<string>();
  for (const a of annotations) {
    if (a.depth === 0) {
      accepted.push(a);
      acceptedDepthZeroIds.add(a.id);
    }
  }

  for (const a of annotations) {
    if (a.depth === 0) continue;
    if (a.depth === 1) {
      const parentId = a.parentAnnotationId ?? null;
      if (parentId !== null && acceptedDepthZeroIds.has(parentId)) {
        accepted.push(a);
      } else {
        suppressed.push(a);
      }
    } else {
      suppressed.push(a);
    }
  }

  return { accepted: Object.freeze(accepted), suppressed: Object.freeze(suppressed) };
}
