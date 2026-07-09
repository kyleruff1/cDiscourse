/**
 * PROOF-003 (#890) §1 — pure contract module tests.
 *
 * Imports the Deno-side pure module `_shared/proofAttach.ts` directly (the
 * `annotateEvidenceEdgeFunction` precedent) so the deterministic guards carry
 * REAL branch coverage. Also spot-checks status-derivation parity against the
 * authoritative src classifier.
 */
import {
  ATTACHABLE_PROOF_KINDS,
  DEFERRED_PROOF_KINDS,
  KNOWN_REQUEST_KINDS,
  DERIVABLE_SOURCE_CHAIN_STATUSES,
  PROOF_RELATION_KINDS,
  MAX_PROOFS_PER_MOVE,
  PROOF_LABEL_MAX,
  PROOF_URL_MAX,
  PROOF_QUOTE_MAX,
  PROOF_SOURCE_TEXT_MAX,
  isAttachableKind,
  validateKindFields,
  deriveProofSourceChainStatus,
  proofIdempotencyKey,
  type AttachableProofKind,
  type ProofAttachFields,
} from '../supabase/functions/_shared/proofAttach';
import { deriveSourceChainStatus } from '../src/features/evidence/evidenceModel';

function fields(overrides: Partial<ProofAttachFields> & { kind: AttachableProofKind }): ProofAttachFields {
  return { label: '', url: null, sourceText: null, quote: null, referencedArgumentId: null, ...overrides };
}

describe('PROOF-003 §1 — vocabularies + caps', () => {
  it('ATTACHABLE_PROOF_KINDS is exactly the 6 shipped kinds', () => {
    expect([...ATTACHABLE_PROOF_KINDS]).toEqual([
      'url',
      'quote',
      'source_text',
      'note',
      'prior_move',
      'external_ref',
    ]);
  });

  it('DEFERRED_PROOF_KINDS carries the storage + marker kinds (parse-but-reject)', () => {
    expect([...DEFERRED_PROOF_KINDS]).toEqual(['screenshot', 'file', 'voice_excerpt', 'timestamp']);
  });

  it('KNOWN_REQUEST_KINDS is the union; no attachable kind is deferred', () => {
    expect([...KNOWN_REQUEST_KINDS].sort()).toEqual(
      [...ATTACHABLE_PROOF_KINDS, ...DEFERRED_PROOF_KINDS].sort(),
    );
    for (const k of ATTACHABLE_PROOF_KINDS) {
      expect(DEFERRED_PROOF_KINDS as ReadonlyArray<string>).not.toContain(k);
    }
  });

  it('isAttachableKind accepts the 6 and rejects deferred + garbage', () => {
    for (const k of ATTACHABLE_PROOF_KINDS) expect(isAttachableKind(k)).toBe(true);
    for (const k of DEFERRED_PROOF_KINDS) expect(isAttachableKind(k)).toBe(false);
    expect(isAttachableKind('banana')).toBe(false);
  });

  it('the relation vocabulary is the 4 shipped kinds', () => {
    expect([...PROOF_RELATION_KINDS]).toEqual([
      'supports',
      'contradicts',
      'contextualizes',
      'answers_request',
    ]);
  });

  it('caps match the schema + migration', () => {
    expect(MAX_PROOFS_PER_MOVE).toBe(8);
    expect(PROOF_LABEL_MAX).toBe(120);
    expect(PROOF_URL_MAX).toBe(2048);
    expect(PROOF_QUOTE_MAX).toBe(4000);
    expect(PROOF_SOURCE_TEXT_MAX).toBe(8000);
  });
});

describe('PROOF-003 §1 — validateKindFields (per-kind required fields)', () => {
  it('url / external_ref require an http(s) url', () => {
    expect(validateKindFields(fields({ kind: 'url', url: 'https://a.test/x' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'external_ref', url: 'http://a.test' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'url', url: null }))).toEqual({ ok: false, issue: 'url_required' });
    expect(validateKindFields(fields({ kind: 'url', url: '   ' }))).toEqual({ ok: false, issue: 'url_required' });
    expect(validateKindFields(fields({ kind: 'url', url: 'ftp://a.test' }))).toEqual({
      ok: false,
      issue: 'url_invalid_scheme',
    });
    expect(validateKindFields(fields({ kind: 'url', url: 'javascript:alert(1)' }))).toEqual({
      ok: false,
      issue: 'url_invalid_scheme',
    });
  });

  it('quote requires quote text', () => {
    expect(validateKindFields(fields({ kind: 'quote', quote: 'a passage' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'quote', quote: null }))).toEqual({ ok: false, issue: 'quote_required' });
  });

  it('source_text requires sourceText', () => {
    expect(validateKindFields(fields({ kind: 'source_text', sourceText: 'excerpt' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'source_text', sourceText: null }))).toEqual({
      ok: false,
      issue: 'source_text_required',
    });
  });

  it('note requires a label OR a body', () => {
    expect(validateKindFields(fields({ kind: 'note', label: 'A note' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'note', sourceText: 'note body' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'note', label: '', sourceText: null }))).toEqual({
      ok: false,
      issue: 'note_content_required',
    });
  });

  it('prior_move requires a referenced argument', () => {
    expect(validateKindFields(fields({ kind: 'prior_move', referencedArgumentId: 'x' }))).toEqual({ ok: true });
    expect(validateKindFields(fields({ kind: 'prior_move', referencedArgumentId: null }))).toEqual({
      ok: false,
      issue: 'referenced_argument_required',
    });
  });
});

describe('PROOF-003 §1 — deriveProofSourceChainStatus (condition (ii))', () => {
  it('returns ONLY the three derivable values across every field combination', () => {
    const urls = [null, 'https://a.test'];
    const texts = [null, 'excerpt'];
    const quotes = [null, 'quote'];
    for (const kind of ATTACHABLE_PROOF_KINDS) {
      for (const url of urls) {
        for (const sourceText of texts) {
          for (const quote of quotes) {
            const status = deriveProofSourceChainStatus(fields({ kind, url, sourceText, quote }));
            expect(DERIVABLE_SOURCE_CHAIN_STATUSES as ReadonlyArray<string>).toContain(status);
            expect(status).not.toBe('broken');
            expect(status).not.toBe('primary_present');
          }
        }
      }
    }
  });

  it('follows the decision table', () => {
    expect(deriveProofSourceChainStatus(fields({ kind: 'url', url: 'https://a.test' }))).toBe('source_no_quote');
    expect(deriveProofSourceChainStatus(fields({ kind: 'source_text', sourceText: 'x' }))).toBe('source_no_quote');
    expect(deriveProofSourceChainStatus(fields({ kind: 'quote', quote: 'q' }))).toBe('unverified');
    expect(deriveProofSourceChainStatus(fields({ kind: 'url', url: 'https://a.test', quote: 'q' }))).toBe(
      'source_and_quote',
    );
    expect(deriveProofSourceChainStatus(fields({ kind: 'prior_move', referencedArgumentId: 'x' }))).toBe('unverified');
  });

  it('agrees with the authoritative src deriveSourceChainStatus on url/sourceText/quote', () => {
    const combos = [
      { url: 'https://a.test', sourceText: null, quote: null },
      { url: null, sourceText: 'x', quote: null },
      { url: null, sourceText: null, quote: 'q' },
      { url: 'https://a.test', sourceText: null, quote: 'q' },
      { url: null, sourceText: 'x', quote: 'q' },
      { url: null, sourceText: null, quote: null },
    ];
    for (const c of combos) {
      const mine = deriveProofSourceChainStatus(fields({ kind: 'url', ...c }));
      const theirs = deriveSourceChainStatus(c);
      expect(mine).toBe(theirs);
    }
  });
});

describe('PROOF-003 §1 — proofIdempotencyKey', () => {
  it('is deterministic + total; identical fields yield identical keys', () => {
    const f = fields({ kind: 'url', url: 'https://a.test', label: 'L' });
    expect(proofIdempotencyKey('arg-1', 'user-1', f)).toBe(proofIdempotencyKey('arg-1', 'user-1', f));
  });

  it('a changed field yields a different key', () => {
    const base = fields({ kind: 'url', url: 'https://a.test', label: 'L' });
    const key = proofIdempotencyKey('arg-1', 'user-1', base);
    expect(proofIdempotencyKey('arg-1', 'user-1', fields({ kind: 'url', url: 'https://b.test', label: 'L' }))).not.toBe(
      key,
    );
    expect(proofIdempotencyKey('arg-1', 'user-1', fields({ kind: 'url', url: 'https://a.test', label: 'M' }))).not.toBe(
      key,
    );
    expect(proofIdempotencyKey('arg-2', 'user-1', base)).not.toBe(key);
    expect(proofIdempotencyKey('arg-1', 'user-2', base)).not.toBe(key);
    expect(proofIdempotencyKey('arg-1', 'user-1', fields({ kind: 'source_text', sourceText: 'x' }))).not.toBe(key);
  });
});
