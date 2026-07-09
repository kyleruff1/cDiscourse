/**
 * PROOF-002 (#889) — pure model for the source drawer.
 *
 * No React, no Supabase, no network, no featureFlags. Every type + helper is a
 * pure projection so it is unit-testable in isolation. Comments are
 * apostrophe-free for scanner safety; copy STRINGS live in proofDrawerCopy.ts.
 *
 * The load-bearing piece is proofItemRowToEvidenceArtifact — the INVERSE of the
 * PROOF-001 write-side fold (proofItemRowFromArtifact). It lets a stored
 * proof_items row render through the UNCHANGED summarizeArtifactsForReceiptChip
 * and discharge the RIGHT evidence debt (Data model invariants 1 + 2).
 */
import type {
  EvidenceArtifact,
  EvidenceArtifactKind,
  SourceChainStatus,
  EvidenceRisk,
} from '../evidence';
import type { EvidenceDebtKind } from '../evidence/evidenceDebtModel';

/** The 6 kinds PROOF-001 shipped. Storage + marker kinds are NOT here. */
export type ProofDrawerKind = 'url' | 'quote' | 'source_text' | 'note' | 'prior_move' | 'external_ref';

export const PROOF_DRAWER_KINDS: ReadonlyArray<ProofDrawerKind> = Object.freeze([
  'url',
  'quote',
  'source_text',
  'note',
  'prior_move',
  'external_ref',
]);

/** Which single input a kind tile focuses. */
export type ProofDrawerInputMode = 'url' | 'text' | 'longtext' | 'argument_ref';

/** One kind tile in the grid: glyph + Source/Receipts label + which input it focuses. */
export interface ProofKindTile {
  kind: ProofDrawerKind;
  label: string;
  glyph: string;
  inputMode: ProofDrawerInputMode;
  helper: string;
}

/** Simple <Text> glyphs (expo-rn-patterns: no icon lib). One per kind. */
const KIND_GLYPH: Readonly<Record<ProofDrawerKind, string>> = Object.freeze({
  url: '↗',
  quote: '❝',
  source_text: '¶',
  note: '✎',
  prior_move: '↩',
  external_ref: '⧉',
});

/** Which input each kind focuses. */
const KIND_INPUT_MODE: Readonly<Record<ProofDrawerKind, ProofDrawerInputMode>> = Object.freeze({
  url: 'url',
  quote: 'longtext',
  source_text: 'longtext',
  note: 'text',
  prior_move: 'argument_ref',
  external_ref: 'url',
});

/** What the drawer is attached to. */
export type ProofDrawerScope =
  | { kind: 'draft'; debateId: string; argumentId: string | null }
  | {
      kind: 'argument';
      debateId: string;
      argumentId: string;
      owedDebtKind?: EvidenceDebtKind | null;
    };

/** In-progress attach input the drawer builds before calling the wrapper. */
export interface ProofDraftInput {
  kind: ProofDrawerKind;
  label: string;
  url?: string;
  sourceText?: string;
  quote?: string;
  referencedArgumentId?: string;
}

/** Minimal PROOF-001 row shape the read path consumes (render-relevant columns). */
export interface ProofItemRow {
  id: string;
  debate_id: string;
  argument_id: string;
  added_by: string;
  kind: ProofDrawerKind;
  label: string;
  url: string | null;
  source_text: string | null;
  quote: string | null;
  referenced_argument_id: string | null;
  source_chain_status: SourceChainStatus;
  risk: EvidenceRisk;
  created_at: string;
  deleted_at: string | null;
}

/**
 * The inverse fold: proof_items.kind -> EvidenceArtifactKind. The 6 proof kinds
 * are a superset of EvidenceArtifactKind (which has no note / prior_move /
 * external_ref). The mapping is chosen so the chip copy is unchanged (copy is
 * status + count derived, kind-invariant) AND the RIGHT debt is discharged: a
 * link / reference / source-text / note / earlier-point attach that carries a
 * source discharges a source debt; a quote discharges a quote debt.
 */
const KIND_TO_ARTIFACT_KIND: Readonly<Record<ProofDrawerKind, EvidenceArtifactKind>> = Object.freeze({
  url: 'url',
  quote: 'quote',
  source_text: 'source_text',
  external_ref: 'url',
  note: 'manual_citation',
  prior_move: 'manual_citation',
});

/** Build the 6 kind tiles. label + helper come from the ban-list-clean copy object. */
export function buildProofKindTiles(copy: {
  kindLabel: Record<ProofDrawerKind, string>;
  kindHelper: Record<ProofDrawerKind, string>;
}): ProofKindTile[] {
  return PROOF_DRAWER_KINDS.map((kind) => ({
    kind,
    label: copy.kindLabel[kind],
    glyph: KIND_GLYPH[kind],
    inputMode: KIND_INPUT_MODE[kind],
    helper: copy.kindHelper[kind],
  }));
}

/**
 * Reconstruct an EvidenceArtifact from a stored proof_items row so it renders
 * through the UNCHANGED summarizeArtifactsForReceiptChip. Maps every copy /
 * doctrine field 1:1; kind is mapped per KIND_TO_ARTIFACT_KIND. Optional fields
 * are set only when non-null (EvidenceArtifact leaves them undefined).
 */
export function proofItemRowToEvidenceArtifact(row: ProofItemRow): EvidenceArtifact {
  const artifact: EvidenceArtifact = {
    id: row.id,
    argumentId: row.argument_id,
    kind: KIND_TO_ARTIFACT_KIND[row.kind],
    label: row.label,
    sourceChainStatus: row.source_chain_status,
    risk: row.risk,
    addedByUserId: row.added_by,
    createdAt: row.created_at,
  };
  if (row.url !== null) artifact.url = row.url;
  if (row.source_text !== null) artifact.sourceText = row.source_text;
  if (row.quote !== null) artifact.quote = row.quote;
  return artifact;
}

/** True when the focused kinds required field is non-empty (Attach button gate). */
export function isProofDraftPostable(draft: ProofDraftInput): boolean {
  switch (draft.kind) {
    case 'url':
    case 'external_ref':
      return typeof draft.url === 'string' && draft.url.trim().length > 0;
    case 'quote':
      return typeof draft.quote === 'string' && draft.quote.trim().length > 0;
    case 'source_text':
      return typeof draft.sourceText === 'string' && draft.sourceText.trim().length > 0;
    case 'note':
      return (
        (typeof draft.label === 'string' && draft.label.trim().length > 0) ||
        (typeof draft.sourceText === 'string' && draft.sourceText.trim().length > 0)
      );
    case 'prior_move':
      return typeof draft.referencedArgumentId === 'string' && draft.referencedArgumentId.trim().length > 0;
    default:
      return false;
  }
}
