/**
 * PROOF-002 (#889) — proofDrawerModel pure-model tests.
 */
import {
  PROOF_DRAWER_KINDS,
  buildProofKindTiles,
  proofItemRowToEvidenceArtifact,
  isProofDraftPostable,
  type ProofDrawerKind,
  type ProofItemRow,
} from '../src/features/proof/proofDrawerModel';
import { PROOF_DRAWER_COPY } from '../src/features/proof/proofDrawerCopy';
import { ALL_SOURCE_CHAIN_STATUSES, ALL_EVIDENCE_RISKS } from '../src/features/evidence/evidenceModel';

function baseRow(overrides: Partial<ProofItemRow>): ProofItemRow {
  return {
    id: 'p1',
    debate_id: 'd1',
    argument_id: 'a1',
    added_by: 'u1',
    kind: 'url',
    label: 'L',
    url: null,
    source_text: null,
    quote: null,
    referenced_argument_id: null,
    source_chain_status: 'source_no_quote',
    risk: 'unknown',
    created_at: '2026-07-09T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('PROOF_DRAWER_KINDS', () => {
  it('is exactly the 6 shipped kinds', () => {
    expect([...PROOF_DRAWER_KINDS]).toEqual(['url', 'quote', 'source_text', 'note', 'prior_move', 'external_ref']);
  });

  it('does NOT include storage or marker kinds (negative control)', () => {
    for (const banned of ['screenshot', 'file', 'voice_excerpt', 'timestamp']) {
      expect(PROOF_DRAWER_KINDS as ReadonlyArray<string>).not.toContain(banned);
    }
  });
});

describe('buildProofKindTiles', () => {
  it('produces exactly one tile per kind with a valid inputMode + non-empty label/glyph/helper', () => {
    const tiles = buildProofKindTiles(PROOF_DRAWER_COPY);
    expect(tiles).toHaveLength(6);
    const kinds = tiles.map((t) => t.kind);
    expect(kinds.sort()).toEqual([...PROOF_DRAWER_KINDS].sort());
    for (const t of tiles) {
      expect(['url', 'text', 'longtext', 'argument_ref']).toContain(t.inputMode);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.glyph.length).toBeGreaterThan(0);
      expect(t.helper.length).toBeGreaterThan(0);
    }
  });
});

describe('proofItemRowToEvidenceArtifact', () => {
  it('maps every field 1:1 and sets optional fields only when non-null', () => {
    const row = baseRow({
      kind: 'url',
      url: 'https://a.test',
      source_text: null,
      quote: 'q',
      source_chain_status: 'source_and_quote',
      risk: 'unknown',
    });
    const a = proofItemRowToEvidenceArtifact(row);
    expect(a.id).toBe(row.id);
    expect(a.argumentId).toBe(row.argument_id);
    expect(a.addedByUserId).toBe(row.added_by);
    expect(a.label).toBe(row.label);
    expect(a.sourceChainStatus).toBe('source_and_quote');
    expect(a.risk).toBe('unknown');
    expect(a.url).toBe('https://a.test');
    expect(a.quote).toBe('q');
    expect(a).not.toHaveProperty('sourceText');
  });

  it('maps the kind superset onto EvidenceArtifactKind per the fold table', () => {
    const expected: Record<ProofDrawerKind, string> = {
      url: 'url',
      quote: 'quote',
      source_text: 'source_text',
      external_ref: 'url',
      note: 'manual_citation',
      prior_move: 'manual_citation',
    };
    for (const kind of PROOF_DRAWER_KINDS) {
      const a = proofItemRowToEvidenceArtifact(baseRow({ kind, source_text: 'x' }));
      expect(a.kind).toBe(expected[kind]);
    }
  });

  it('round-trips every source_chain_status and risk value', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      if (status === 'no_source') continue; // aggregate-only, never a stored per-row value
      const a = proofItemRowToEvidenceArtifact(baseRow({ source_chain_status: status }));
      expect(a.sourceChainStatus).toBe(status);
    }
    for (const risk of ALL_EVIDENCE_RISKS) {
      const a = proofItemRowToEvidenceArtifact(baseRow({ risk }));
      expect(a.risk).toBe(risk);
    }
  });
});

describe('isProofDraftPostable', () => {
  it('gates the Attach button on the focused kinds required field', () => {
    expect(isProofDraftPostable({ kind: 'url', label: '', url: 'https://a.test' })).toBe(true);
    expect(isProofDraftPostable({ kind: 'url', label: '' })).toBe(false);
    expect(isProofDraftPostable({ kind: 'quote', label: '', quote: 'q' })).toBe(true);
    expect(isProofDraftPostable({ kind: 'quote', label: '' })).toBe(false);
    expect(isProofDraftPostable({ kind: 'source_text', label: '', sourceText: 's' })).toBe(true);
    expect(isProofDraftPostable({ kind: 'note', label: 'a note' })).toBe(true);
    expect(isProofDraftPostable({ kind: 'note', label: '' })).toBe(false);
    expect(isProofDraftPostable({ kind: 'prior_move', label: '', referencedArgumentId: 'x' })).toBe(true);
    expect(isProofDraftPostable({ kind: 'prior_move', label: '' })).toBe(false);
  });
});
