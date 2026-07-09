/**
 * PROOF-002 (#889) — read-path adapter flip fidelity (the contract snapshot).
 *
 * Models PROOF-001 write-side fidelity test on the READ side: a move rendered
 * from proof_items ROWS must produce the SAME ReceiptChip copy/doctrine fields
 * as the same move rendered from the JSONB snapshot, across every kind->status
 * path. Plus: the flag-off path (no rows arg) is byte-identical to today, and
 * rows-first precedence holds when a move has BOTH.
 */
import { buildArtifactsByMessageId } from '../src/features/arguments/argumentGameSurfaceEvidence';
import { summarizeArtifactsForReceiptChip } from '../src/features/evidence/evidenceModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import type { ProofItemRow } from '../src/features/proof/proofDrawerModel';
import type { ArgumentMessageInput } from '../src/features/arguments/argumentGameSurfaceModel';

function msg(id: string, attachedEvidence: unknown): ArgumentMessageInput {
  return {
    id,
    authorId: 'author-1',
    createdAt: '2026-07-09T00:00:00.000Z',
    attachedEvidence,
  } as unknown as ArgumentMessageInput;
}

function row(overrides: Partial<ProofItemRow>): ProofItemRow {
  return {
    id: 'proof-1',
    debate_id: 'debate-1',
    argument_id: 'arg-1',
    added_by: 'author-1',
    kind: 'url',
    label: 'A report',
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

const CHIP_FIELDS = [
  'label',
  'helper',
  'tone',
  'invitesFollowup',
  'showsSourceChainPressure',
  'status',
  'count',
] as const;

function chipFor(artifacts: ReadonlyArray<EvidenceArtifact>) {
  const c = summarizeArtifactsForReceiptChip(artifacts);
  return {
    label: c.label,
    helper: c.helper,
    tone: c.tone,
    invitesFollowup: c.invitesFollowup,
    showsSourceChainPressure: c.showsSourceChainPressure,
    status: c.status,
    count: c.count,
  };
}

// Each case: an equivalent JSONB attachment + the proof_items row it back-fills to.
const CASES: Array<{ name: string; jsonb: unknown; rows: ProofItemRow[] }> = [
  {
    name: 'url with source (source_no_quote)',
    jsonb: [{ url: 'https://a.test/x', label: 'A report' }],
    rows: [row({ kind: 'url', url: 'https://a.test/x', label: 'A report', source_chain_status: 'source_no_quote' })],
  },
  {
    name: 'url + quote (source_and_quote)',
    jsonb: [{ url: 'https://a.test/x', label: 'A report', quote: 'the passage' }],
    rows: [
      row({
        kind: 'url',
        url: 'https://a.test/x',
        label: 'A report',
        quote: 'the passage',
        source_chain_status: 'source_and_quote',
      }),
    ],
  },
  {
    name: 'source_text (source_no_quote)',
    jsonb: [{ sourceText: 'An excerpt of the source.', label: 'Excerpt' }],
    rows: [
      row({ kind: 'source_text', source_text: 'An excerpt of the source.', label: 'Excerpt', source_chain_status: 'source_no_quote' }),
    ],
  },
];

describe('PROOF-002 — rows-path chip equals JSONB-path chip (copy/doctrine fields)', () => {
  for (const c of CASES) {
    it(`chip parity for: ${c.name}`, () => {
      const jsonbArtifacts = buildArtifactsByMessageId([msg('arg-1', c.jsonb)])['arg-1'];
      const rowArtifacts = buildArtifactsByMessageId([msg('arg-1', c.jsonb)], { 'arg-1': c.rows })['arg-1'];
      const chipA = chipFor(jsonbArtifacts);
      const chipB = chipFor(rowArtifacts);
      for (const f of CHIP_FIELDS) {
        expect({ field: f, value: chipB[f] }).toEqual({ field: f, value: chipA[f] });
      }
    });
  }
});

describe('PROOF-002 — flag-off byte-identity (no rows arg === today)', () => {
  it('an absent second arg resolves identically to the JSONB-only build for every fixture', () => {
    for (const c of CASES) {
      const withArg = buildArtifactsByMessageId([msg('arg-1', c.jsonb)], undefined);
      const without = buildArtifactsByMessageId([msg('arg-1', c.jsonb)]);
      expect(withArg).toEqual(without);
    }
  });

  it('an empty rows map falls back to JSONB byte-identically', () => {
    const withEmpty = buildArtifactsByMessageId([msg('arg-1', CASES[0].jsonb)], { 'arg-1': [] });
    const without = buildArtifactsByMessageId([msg('arg-1', CASES[0].jsonb)]);
    expect(withEmpty).toEqual(without);
  });
});

describe('PROOF-002 — rows-first precedence', () => {
  it('when a move has BOTH JSONB and rows, the rows win', () => {
    const jsonb = [{ url: 'https://jsonb.test', label: 'from jsonb' }];
    const rows = [row({ id: 'p9', kind: 'quote', quote: 'from rows', source_chain_status: 'unverified', label: 'from rows' })];
    const out = buildArtifactsByMessageId([msg('arg-1', jsonb)], { 'arg-1': rows })['arg-1'];
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('from rows');
    expect(out[0].quote).toBe('from rows');
  });

  it('a message with no rows entry and no JSONB yields an empty list (no_source form)', () => {
    const out = buildArtifactsByMessageId([msg('arg-1', [])], {})['arg-1'];
    expect(out).toEqual([]);
    expect(chipFor(out).status).toBe('no_source');
  });
});
