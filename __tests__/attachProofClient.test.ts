/**
 * PROOF-003 (#890) §4 — attachProof / detachProof client wrapper tests.
 *
 * Both route through supabase.functions.invoke('attach-proof'); invoke is
 * mocked (NO live call). The wrappers never throw: success, a structured
 * function error, a FunctionsFetchError, and an empty response all resolve to a
 * branchable outcome. The client holds NO service-role key (anon + JWT only).
 */
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
  attachProof,
  detachProof,
  MAX_PROOFS_PER_MOVE,
  type AttachProofPayload,
  type DetachProofPayload,
} from '../src/lib/edgeFunctions';
import { MAX_PROOFS_PER_MOVE as SHARED_CAP } from '../supabase/functions/_shared/proofAttach';

beforeEach(() => {
  mockInvoke.mockReset();
});

const ATTACH: AttachProofPayload = {
  action: 'attach',
  debateId: 'debate-1',
  argumentId: 'arg-1',
  kind: 'url',
  label: 'A report',
  url: 'https://example.test/x',
};

const DETACH: DetachProofPayload = { action: 'detach', debateId: 'debate-1', proofItemId: 'proof-1' };

const ATTACH_OK = {
  ok: true,
  proofItem: {
    id: 'proof-1',
    debateId: 'debate-1',
    argumentId: 'arg-1',
    kind: 'url',
    label: 'A report',
    url: 'https://example.test/x',
    sourceText: null,
    quote: null,
    referencedArgumentId: null,
    sourceChainStatus: 'source_no_quote',
    risk: 'unknown',
    createdAt: '2026-07-09T00:00:00.000Z',
    deletedAt: null,
  },
  relation: null,
  idempotent: false,
  relationIdempotent: false,
  debtSignalEmitted: false,
};

describe('attachProof — call shape + success', () => {
  it('invokes attach-proof with the payload as the body', async () => {
    mockInvoke.mockResolvedValue({ data: ATTACH_OK, error: null });
    await attachProof(ATTACH);
    expect(mockInvoke).toHaveBeenCalledWith('attach-proof', { body: ATTACH });
  });

  it('returns ok:true with the created proofItem', async () => {
    mockInvoke.mockResolvedValue({ data: ATTACH_OK, error: null });
    const result = await attachProof(ATTACH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proofItem.id).toBe('proof-1');
      expect(result.data.idempotent).toBe(false);
    }
  });
});

describe('attachProof — error normalisation', () => {
  it('normalises a structured function error (context.json) with its status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        status: 403,
        context: { json: async () => ({ error: 'not_your_move', message: 'You can only add a source to your own move.' }) },
      },
    });
    const result = await attachProof(ATTACH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('not_your_move');
      expect(result.status).toBe(403);
    }
  });

  it('maps a FunctionsFetchError to status 503 (offline-safe)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    const result = await attachProof(ATTACH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error.error).toBe('network_error');
    }
  });

  it('returns 500 empty_response when the function resolves with no data + no error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const result = await attachProof(ATTACH);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error.error).toBe('empty_response');
    }
  });

  it('never throws even if context.json rejects', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { status: 500, context: { json: async () => { throw new Error('boom'); } } },
    });
    const result = await attachProof(ATTACH);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toBe('network_error');
  });
});

describe('detachProof', () => {
  it('invokes attach-proof with the detach body and returns the outcome', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, proofItemId: 'proof-1', deletedAt: '2026-07-09T00:00:00.000Z', idempotent: false },
      error: null,
    });
    const result = await detachProof(DETACH);
    expect(mockInvoke).toHaveBeenCalledWith('attach-proof', { body: DETACH });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.proofItemId).toBe('proof-1');
  });

  it('normalises a detach error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { status: 404, context: { json: async () => ({ error: 'proof_not_found' }) } },
    });
    const result = await detachProof(DETACH);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.error).toBe('proof_not_found');
  });
});

describe('MAX_PROOFS_PER_MOVE mirror', () => {
  it('equals the shared Edge constant', () => {
    expect(MAX_PROOFS_PER_MOVE).toBe(8);
    expect(MAX_PROOFS_PER_MOVE).toBe(SHARED_CAP);
  });
});
