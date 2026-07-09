/**
 * PROOF-001 (#888) — the shared evidence-artifact -> proof_items-row fold.
 *
 * ONE module, TWO consumers (orchestrator ruling R2):
 *   - the back-fill runner   (scripts/proof-backfill/backfillProofItemsCore.ts)
 *   - the fidelity parity test (__tests__/proofBackfillFidelity.test.ts)
 *
 * so the jest fidelity test proves the exact fold the back-fill runs.
 *
 * The fold maps the live 7-value EvidenceArtifactKind
 * (docs/evidence-object-model.md; src/features/evidence/evidenceModel.ts) onto
 * the 6 CHECK-valid proof_items.kind values shipped by migration
 * 20260710000001. `payment_screenshot` has no path-c column this card, so it
 * folds to `null` = DEFERRED (excluded from the write, reported separately, left
 * in the JSONB snapshot). This is the honest fold from PROOF-001.md reality-audit
 * finding 4.
 *
 * Pure TypeScript. No React. No Supabase. No network. No async. No console.
 */

import type {
  EvidenceArtifact,
  EvidenceArtifactKind,
  EvidenceRisk,
  SourceChainStatus,
} from '../../src/features/evidence/evidenceModel';

/** The 6 CHECK-valid proof_items.kind values (migration 20260710000001). */
export type ProofItemKind = 'url' | 'quote' | 'source_text' | 'note' | 'prior_move' | 'external_ref';

/** The 6 shipped kinds, frozen for exhaustive tests. */
export const PROOF_ITEM_KINDS: ReadonlyArray<ProofItemKind> = Object.freeze([
  'url',
  'quote',
  'source_text',
  'note',
  'prior_move',
  'external_ref',
]);

/**
 * The writable columns of a proof_items INSERT. id / created_at / deleted_at are
 * DB defaults and are NOT part of the fold. Matches the migration column order.
 */
export interface ProofItemRow {
  debate_id: string;
  argument_id: string;
  added_by: string;
  kind: ProofItemKind;
  label: string;
  url: string | null;
  source_text: string | null;
  quote: string | null;
  referenced_argument_id: string | null;
  source_chain_status: SourceChainStatus;
  risk: EvidenceRisk;
}

/**
 * The fold table (PROOF-001.md reality-audit finding 4). Every one of the 7
 * live EvidenceArtifactKind values maps to a CHECK-valid ProofItemKind, or to
 * `null` for the documented `payment_screenshot` deferral.
 *
 *   url                 -> url          (1:1)
 *   quote               -> quote        (1:1)
 *   source_text         -> source_text  (1:1)
 *   dataset             -> url          (a dataset is an inspectable URL)
 *   screenshot_redacted -> note         (no binary on back-fill; textual note)
 *   manual_citation     -> note         (a citation is a textual note)
 *   payment_screenshot  -> null         (DEFERRED — no path-c column this card)
 */
export const PROOF_ITEM_KIND_FOLD: Readonly<Record<EvidenceArtifactKind, ProofItemKind | null>> =
  Object.freeze({
    url: 'url',
    quote: 'quote',
    source_text: 'source_text',
    dataset: 'url',
    screenshot_redacted: 'note',
    manual_citation: 'note',
    payment_screenshot: null,
  });

/** Fold one EvidenceArtifactKind to its proof_items.kind, or null if deferred. */
export function foldEvidenceKind(kind: EvidenceArtifactKind): ProofItemKind | null {
  const folded = PROOF_ITEM_KIND_FOLD[kind];
  return folded === undefined ? null : folded;
}

export interface FoldContext {
  /** The room the proof belongs to (proof_items.debate_id). */
  debateId: string;
}

/**
 * Fold one artifact to a proof_items row, or `null` when the artifact's kind is
 * DEFERRED (payment_screenshot — no path-c column this card). Deterministic and
 * total: identical input always yields an identical row.
 */
export function proofItemRowFromArtifact(
  artifact: EvidenceArtifact,
  ctx: FoldContext,
): ProofItemRow | null {
  const foldedKind = foldEvidenceKind(artifact.kind);
  if (foldedKind === null) return null; // deferred
  return {
    debate_id: ctx.debateId,
    argument_id: artifact.argumentId,
    added_by: artifact.addedByUserId,
    kind: foldedKind,
    label: artifact.label,
    url: artifact.url ?? null,
    source_text: artifact.sourceText ?? null,
    quote: artifact.quote ?? null,
    // referenced_argument_id has no producer until PROOF-003; back-fill leaves null.
    referenced_argument_id: null,
    source_chain_status: artifact.sourceChainStatus,
    risk: artifact.risk,
  };
}

export interface FoldResult {
  /** Rows that WOULD be written to proof_items. */
  rows: ProofItemRow[];
  /** Artifacts excluded from the write (payment_screenshot). */
  deferred: EvidenceArtifact[];
}

/** Fold an artifact array, partitioning deferred (payment_screenshot) artifacts. */
export function foldArtifactsToProofItemRows(
  artifacts: ReadonlyArray<EvidenceArtifact>,
  ctx: FoldContext,
): FoldResult {
  const rows: ProofItemRow[] = [];
  const deferred: EvidenceArtifact[] = [];
  for (const artifact of artifacts) {
    const row = proofItemRowFromArtifact(artifact, ctx);
    if (row === null) deferred.push(artifact);
    else rows.push(row);
  }
  return { rows, deferred };
}

/**
 * Reconstruct an EvidenceArtifact-shaped object from a stored proof_items row —
 * used by the fidelity parity test (path B: rows -> reconstruct -> chip).
 *
 * The reconstructed `kind` is the FOLDED ProofItemKind, which for
 * screenshot_redacted / manual_citation / dataset differs from the original
 * EvidenceArtifactKind. This is the ONE documented divergence: it changes only
 * the receipt-chip glyph `kinds` array, NEVER the status-derived copy fields
 * (label / helper / tone / invitesFollowup / showsSourceChainPressure / status /
 * count), which is why fidelity holds under folding. The cast is intentional and
 * scoped to this reconstruction — the chip summariser reads `kind` only for the
 * glyph array.
 */
export function reconstructArtifactFromRow(row: ProofItemRow, index = 0): EvidenceArtifact {
  const artifact = {
    id: `${row.argument_id}:proof:${index}`,
    argumentId: row.argument_id,
    kind: row.kind as unknown as EvidenceArtifactKind,
    label: row.label,
    sourceChainStatus: row.source_chain_status,
    risk: row.risk,
    addedByUserId: row.added_by,
    // created_at is a DB default not carried on the writable row; the chip copy
    // never reads it, so a stable placeholder preserves reconstruction fidelity.
    createdAt: '1970-01-01T00:00:00.000Z',
  } as EvidenceArtifact;
  if (row.url !== null) artifact.url = row.url;
  if (row.source_text !== null) artifact.sourceText = row.source_text;
  if (row.quote !== null) artifact.quote = row.quote;
  return artifact;
}
