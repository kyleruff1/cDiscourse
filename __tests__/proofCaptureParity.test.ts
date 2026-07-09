/**
 * PROOF-003 (#890) R2 — first-attach capture parity scan.
 *
 * The Deno-side capture mirror `_shared/proofCapture.ts` cannot import from src/
 * (separate module graph). This test pins it BEHAVIOURALLY equal to the shipped
 * back-fill pipeline (scripts/proof-backfill/backfillProofItemsCore.ts
 * classifyArgumentRow, which runs the REAL buildEvidenceArtifacts +
 * foldArtifactsToProofItemRows): the SAME fixtures run through both and the
 * emitted proof_items rows must be byte-equal. This is the R2-sanctioned
 * "byte-equal Deno twin WITH a jest parity scan" fallback, proven at the row
 * output level (stronger than source-text equality, which is impossible across
 * the Deno boundary).
 *
 * DOCUMENTED BOUNDARY: the QOL-036 payment redaction DOWNGRADE (a `payment`
 * sub-object failing the redaction guard -> screenshot_redacted -> note) is NOT
 * mirrored (see proofCapture.ts header). This test therefore covers every
 * non-payment kind + the CLEAN payment_screenshot DEFER (which both pipelines
 * agree produces no row); it does not exercise a raw-account-data payment.
 */
import {
  classifyArgumentRow,
  type AttachedEvidenceArgumentRow,
} from '../scripts/proof-backfill/backfillProofItemsCore';
import { captureRowsFromJsonb } from '../supabase/functions/_shared/proofCapture';

const CTX = { argumentId: 'arg-1', debateId: 'debate-1', authorId: 'user-1' };

function backfillRows(attachedEvidence: unknown) {
  const row: AttachedEvidenceArgumentRow = {
    id: CTX.argumentId,
    debate_id: CTX.debateId,
    author_id: CTX.authorId,
    created_at: '2026-07-09T00:00:00.000Z',
    attachedEvidence,
  };
  return classifyArgumentRow(row).rows;
}

const CASES: Array<{ name: string; jsonb: unknown }> = [
  { name: 'plain url + label + excerpt', jsonb: [{ url: 'https://a.test/x', label: 'A report', sourceText: 'excerpt' }] },
  { name: 'dataset host url (data.gov)', jsonb: [{ url: 'https://data.gov/dataset/abc' }] },
  { name: 'sourceText only', jsonb: [{ sourceText: 'A free-text excerpt of a source.' }] },
  { name: 'quote only', jsonb: [{ quote: 'A verbatim passage.' }] },
  { name: 'url + quote (source_and_quote)', jsonb: [{ url: 'https://a.test', quote: 'q' }] },
  { name: 'snake_case source_text field', jsonb: [{ source_text: 'snake excerpt' }] },
  { name: 'explicit manual_citation with body', jsonb: [{ kind: 'manual_citation', label: 'Book', sourceText: 'p.12' }] },
  { name: 'explicit screenshot_redacted with body', jsonb: [{ kind: 'screenshot_redacted', sourceText: 'desc' }] },
  { name: 'explicit payment_screenshot defers to no row', jsonb: [{ kind: 'payment_screenshot', sourceText: 'x' }] },
  { name: 'long label truncates identically', jsonb: [{ url: 'https://a.test', label: 'x'.repeat(200) }] },
  { name: 'empty attachment is dropped', jsonb: [{}, { url: 'https://a.test' }] },
  {
    name: 'multi-attachment order + mixed kinds',
    jsonb: [
      { url: 'https://a.test/1', label: 'one' },
      { sourceText: 'two' },
      { kind: 'payment_screenshot', sourceText: 'skip' },
      { quote: 'three' },
    ],
  },
  { name: 'malformed (not an array)', jsonb: { not: 'an array' } },
  { name: 'empty array', jsonb: [] },
];

describe('PROOF-003 R2 — capture mirror equals the real back-fill pipeline', () => {
  for (const c of CASES) {
    it(`row-equal for: ${c.name}`, () => {
      const expected = backfillRows(c.jsonb);
      const actual = captureRowsFromJsonb(c.jsonb, CTX);
      expect(actual).toEqual(expected);
    });
  }

  it('captures nothing from a snapshot of only-empty attachments', () => {
    expect(captureRowsFromJsonb([{}, { label: '' }], CTX)).toEqual([]);
  });

  it('every captured row carries a derivable status + unknown risk (never a verdict)', () => {
    const rows = captureRowsFromJsonb(
      [{ url: 'https://a.test' }, { sourceText: 's' }, { url: 'https://a.test', quote: 'q' }],
      CTX,
    );
    for (const r of rows) {
      expect(['unverified', 'source_no_quote', 'source_and_quote']).toContain(r.source_chain_status);
      expect(r.risk).toBe('unknown');
    }
  });
});
