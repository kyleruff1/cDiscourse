/**
 * PROOF-001 (#888) — back-fill fidelity parity + fold determinism/totality.
 *
 * The load-bearing contract: an evidence snapshot classified via the REAL
 * `buildEvidenceArtifacts` renders IDENTICALLY through the ReceiptChip contract
 * whether summarised directly (path A, JSONB) or after folding to proof_items
 * rows and reconstructing (path B, rows). The chip's copy-bearing +
 * doctrine-bearing fields (label / helper / tone / invitesFollowup /
 * showsSourceChainPressure / status / count) derive from `source_chain_status`
 * (worst-status-wins) + count ONLY, so they are provably invariant under
 * kind-folding — which is why fidelity holds despite the fold. The ONE
 * divergence (the glyph `kinds` array) is documented + asserted.
 *
 * The fold module under test is the SAME module the back-fill runner uses
 * (orchestrator ruling R2: one module, two consumers).
 */

import {
  buildEvidenceArtifacts,
  summarizeArtifactsForReceiptChip,
  ALL_EVIDENCE_ARTIFACT_KINDS,
  type EvidenceArtifact,
  type EvidenceArtifactKind,
  type ReceiptChipContract,
} from '../src/features/evidence/evidenceModel';
import {
  PROOF_ITEM_KINDS,
  PROOF_ITEM_KIND_FOLD,
  foldEvidenceKind,
  foldArtifactsToProofItemRows,
  proofItemRowFromArtifact,
  reconstructArtifactFromRow,
  type ProofItemKind,
} from '../scripts/proof-backfill/proofItemRowFromArtifact';

const DEBATE_ID = 'debate-fixture-1';
const ARG_ID = 'arg-fixture-1';
const AUTHOR_ID = 'author-fixture-1';

/** Build artifacts through the REAL classifier over crafted attachments. */
function build(
  attachments: Parameters<typeof buildEvidenceArtifacts>[0]['attachments'],
  overrides?: Parameters<typeof buildEvidenceArtifacts>[0]['overrides'],
): EvidenceArtifact[] {
  return buildEvidenceArtifacts({
    argumentId: ARG_ID,
    addedByUserId: AUTHOR_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    attachments,
    overrides,
  });
}

const COPY_FIELDS = [
  'label',
  'helper',
  'tone',
  'invitesFollowup',
  'showsSourceChainPressure',
  'status',
  'count',
] as const;

/** Path A over the folded (non-deferred) subset. */
function chipPathA(artifacts: EvidenceArtifact[]): ReceiptChipContract {
  const kept = artifacts.filter((a) => foldEvidenceKind(a.kind) !== null);
  return summarizeArtifactsForReceiptChip(kept);
}

/** Path B: fold to rows, reconstruct, summarise. */
function chipPathB(artifacts: EvidenceArtifact[]): ReceiptChipContract {
  const { rows } = foldArtifactsToProofItemRows(artifacts, { debateId: DEBATE_ID });
  const reconstructed = rows.map((r, i) => reconstructArtifactFromRow(r, i));
  return summarizeArtifactsForReceiptChip(reconstructed);
}

function assertChipParity(a: ReceiptChipContract, b: ReceiptChipContract): void {
  for (const f of COPY_FIELDS) {
    expect(b[f]).toEqual(a[f]);
  }
}

// ── fold totality + shape ─────────────────────────────────────

describe('PROOF-001 fold — totality over all 7 EvidenceArtifactKind values', () => {
  it('PROOF_ITEM_KIND_FOLD has an entry for every EvidenceArtifactKind', () => {
    expect(Object.keys(PROOF_ITEM_KIND_FOLD).sort()).toEqual([...ALL_EVIDENCE_ARTIFACT_KINDS].sort());
    expect(ALL_EVIDENCE_ARTIFACT_KINDS.length).toBe(7);
  });

  it('every non-null folded kind is one of the 6 CHECK-valid proof_items kinds', () => {
    for (const kind of ALL_EVIDENCE_ARTIFACT_KINDS) {
      const folded = PROOF_ITEM_KIND_FOLD[kind];
      if (folded !== null) {
        expect(PROOF_ITEM_KINDS).toContain(folded);
      }
    }
  });

  it('exactly payment_screenshot folds to null (deferred); nothing else does', () => {
    const deferred = ALL_EVIDENCE_ARTIFACT_KINDS.filter((k) => PROOF_ITEM_KIND_FOLD[k] === null);
    expect(deferred).toEqual(['payment_screenshot']);
  });

  it('the 6 shipped proof_items kinds match the migration CHECK set exactly', () => {
    expect([...PROOF_ITEM_KINDS].sort()).toEqual(
      (['external_ref', 'note', 'prior_move', 'quote', 'source_text', 'url'] as ProofItemKind[]).sort(),
    );
  });

  it('foldEvidenceKind agrees with the table for every kind', () => {
    for (const kind of ALL_EVIDENCE_ARTIFACT_KINDS) {
      expect(foldEvidenceKind(kind)).toBe(PROOF_ITEM_KIND_FOLD[kind]);
    }
  });
});

// ── fold determinism ──────────────────────────────────────────

describe('PROOF-001 fold — determinism', () => {
  it('proofItemRowFromArtifact is deterministic for a fixed artifact', () => {
    const [artifact] = build([{ url: 'https://example.org/a', quote: 'q' }]);
    const first = proofItemRowFromArtifact(artifact, { debateId: DEBATE_ID });
    const second = proofItemRowFromArtifact(artifact, { debateId: DEBATE_ID });
    expect(second).toEqual(first);
  });

  it('foldArtifactsToProofItemRows is deterministic over a multi-kind set', () => {
    const artifacts = build([
      { url: 'https://example.org/a' },
      { sourceText: 'excerpt', quote: 'q' },
      { kind: 'manual_citation', sourceText: 'Author (2026). Title.' },
    ]);
    const a = foldArtifactsToProofItemRows(artifacts, { debateId: DEBATE_ID });
    const b = foldArtifactsToProofItemRows(artifacts, { debateId: DEBATE_ID });
    expect(b).toEqual(a);
  });

  it('a folded row carries the artifact fields verbatim (status/label/url copied)', () => {
    const [artifact] = build([{ url: 'https://example.org/a', label: 'My source' }]);
    const row = proofItemRowFromArtifact(artifact, { debateId: DEBATE_ID });
    expect(row).not.toBeNull();
    expect(row?.debate_id).toBe(DEBATE_ID);
    expect(row?.argument_id).toBe(ARG_ID);
    expect(row?.added_by).toBe(AUTHOR_ID);
    expect(row?.source_chain_status).toBe(artifact.sourceChainStatus);
    expect(row?.label).toBe(artifact.label);
    expect(row?.url).toBe('https://example.org/a');
    expect(row?.referenced_argument_id).toBeNull();
  });
});

// ── ReceiptChip parity (the load-bearing contract) ────────────

describe('PROOF-001 fidelity — chip copy parity JSONB-path vs rows-path', () => {
  it('unverified (quote alone): parity on all copy/doctrine fields', () => {
    const artifacts = build([{ quote: 'a bare quote' }]);
    const a = chipPathA(artifacts);
    expect(a.status).toBe('unverified');
    assertChipParity(a, chipPathB(artifacts));
  });

  it('source_no_quote (url alone): parity on all copy/doctrine fields', () => {
    const artifacts = build([{ url: 'https://example.org/report' }]);
    const a = chipPathA(artifacts);
    expect(a.status).toBe('source_no_quote');
    assertChipParity(a, chipPathB(artifacts));
  });

  it('source_and_quote (url + quote): parity on all copy/doctrine fields', () => {
    const artifacts = build([{ url: 'https://example.org/report', quote: 'the passage' }]);
    const a = chipPathA(artifacts);
    expect(a.status).toBe('source_and_quote');
    assertChipParity(a, chipPathB(artifacts));
  });

  it('mixed statuses (worst-status-wins): parity holds across the fold', () => {
    const artifacts = build([
      { url: 'https://example.org/report', quote: 'strong' }, // source_and_quote
      { url: 'https://example.org/other' }, //                    source_no_quote
      { quote: 'weak' }, //                                        unverified (worst)
    ]);
    const a = chipPathA(artifacts);
    expect(a.status).toBe('unverified');
    expect(a.count).toBe(3);
    assertChipParity(a, chipPathB(artifacts));
  });

  it('every-kind fixture: parity on copy fields; deferred payment excluded from count', () => {
    const artifacts = build(
      [
        { url: 'https://example.org/a' }, //                            url
        { kind: 'quote', url: 'https://example.org/b', quote: 'q' }, //  quote
        { sourceText: 'an excerpt' }, //                                 source_text
        { url: 'https://data.gov/dataset/x' }, //                        dataset -> url
        { kind: 'screenshot_redacted', sourceText: 'redacted' }, //      screenshot_redacted -> note
        { kind: 'manual_citation', sourceText: 'Author (2026).' }, //    manual_citation -> note
        { kind: 'payment_screenshot', sourceText: 'payment' }, //        payment_screenshot -> DEFERRED
      ],
    );
    expect(artifacts).toHaveLength(7);
    const { rows, deferred } = foldArtifactsToProofItemRows(artifacts, { debateId: DEBATE_ID });
    expect(rows).toHaveLength(6);
    expect(deferred).toHaveLength(1);
    expect(deferred[0].kind).toBe<EvidenceArtifactKind>('payment_screenshot');

    const a = chipPathA(artifacts); // subset excludes the deferred payment artifact
    expect(a.count).toBe(6);
    assertChipParity(a, chipPathB(artifacts));
  });
});

// ── payment_screenshot deferral ───────────────────────────────

describe('PROOF-001 fold — payment_screenshot deferral', () => {
  it('a payment_screenshot artifact folds to null and lands in deferred, not rows', () => {
    // Force a clean payment_screenshot kind via override (no payment sub-object
    // needed): overrides only touch `kind`, exercising the fold deterministically.
    const artifacts = build([{ url: 'https://example.org/receipt' }], {
      [`${ARG_ID}:evidence:0`]: { kind: 'payment_screenshot' },
    });
    expect(artifacts[0].kind).toBe<EvidenceArtifactKind>('payment_screenshot');
    expect(proofItemRowFromArtifact(artifacts[0], { debateId: DEBATE_ID })).toBeNull();
    const { rows, deferred } = foldArtifactsToProofItemRows(artifacts, { debateId: DEBATE_ID });
    expect(rows).toHaveLength(0);
    expect(deferred).toHaveLength(1);
  });
});

// ── documented `kinds` divergence ─────────────────────────────

describe('PROOF-001 fidelity — the one documented divergence (glyph kinds)', () => {
  it('screenshot_redacted reconstructs as folded kind note, but chip copy is identical', () => {
    const artifacts = build([{ kind: 'screenshot_redacted', sourceText: 'redacted' }]);
    expect(artifacts[0].kind).toBe<EvidenceArtifactKind>('screenshot_redacted');

    const a = chipPathA(artifacts);
    const b = chipPathB(artifacts);
    // Copy/doctrine parity holds.
    assertChipParity(a, b);
    // But the glyph kinds array diverges: original screenshot_redacted -> folded note.
    expect(a.kinds).toEqual(['screenshot_redacted']);
    expect(b.kinds).toEqual(['note']);
  });
});
