/**
 * PROOF-002 (#889) — attachProofApi seam tests (R1 reconciliation coverage).
 *
 * The seam maps the drawer AttachProofInput onto the PROOF-003 wire body,
 * normalises success + every error code to plain language, omits clientAttachId
 * (assumption 6), and threads the answers_request relation (assumption 7). A
 * source-scan pins the security posture (no service role, no direct proof_items
 * write, no featureFlags).
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

import fs from 'fs';
import path from 'path';
import { attachProof, detachProof, type AttachProofInput } from '../src/features/proof/attachProofApi';

const CAMEL_ITEM = {
  id: 'proof-1',
  debateId: 'debate-1',
  argumentId: 'arg-1',
  addedBy: 'user-1',
  kind: 'url',
  label: 'A report',
  url: 'https://a.test/x',
  sourceText: null,
  quote: null,
  referencedArgumentId: null,
  sourceChainStatus: 'source_no_quote',
  risk: 'unknown',
  createdAt: '2026-07-09T00:00:00.000Z',
  deletedAt: null,
};

function attachOk() {
  return {
    data: { ok: true, proofItem: CAMEL_ITEM, relation: null, idempotent: false, relationIdempotent: false, debtSignalEmitted: false },
    error: null,
  };
}

function input(overrides: Partial<AttachProofInput> = {}): AttachProofInput {
  return {
    debateId: 'debate-1',
    argumentId: 'arg-1',
    kind: 'url',
    label: 'A report',
    url: 'https://a.test/x',
    clientAttachId: 'client-uuid-1',
    ...overrides,
  };
}

beforeEach(() => mockInvoke.mockReset());

describe('attachProofApi — body mapping (R1)', () => {
  it('maps AttachProofInput onto the camelCase Edge body and OMITS clientAttachId', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    await attachProof(input());
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, opts] = mockInvoke.mock.calls[0];
    expect(fn).toBe('attach-proof');
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body.action).toBe('attach');
    expect(body.debateId).toBe('debate-1');
    expect(body.argumentId).toBe('arg-1');
    expect(body.kind).toBe('url');
    expect(body.url).toBe('https://a.test/x');
    // Assumption 6 — clientAttachId is NOT sent (a .strict() Edge would 422 it).
    expect(body).not.toHaveProperty('clientAttachId');
  });

  it('threads the answers_request relation when answersDebtKind is set (assumption 7)', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    await attachProof(input({ answersDebtKind: 'source' }));
    const body = (mockInvoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body.relation).toEqual({ claimArgumentId: 'arg-1', kind: 'answers_request' });
  });

  it('sends NO relation when answersDebtKind is absent or null', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    await attachProof(input({ answersDebtKind: null }));
    const body = (mockInvoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty('relation');
  });
});

describe('attachProofApi — success maps the echoed row to a snake ProofItemRow', () => {
  it('returns ok:true with a snake-cased proofItem', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    const result = await attachProof(input());
    expect(result.ok).toBe(true);
    expect(result.proofItem).toMatchObject({
      id: 'proof-1',
      debate_id: 'debate-1',
      argument_id: 'arg-1',
      added_by: 'user-1',
      kind: 'url',
      source_chain_status: 'source_no_quote',
      risk: 'unknown',
    });
  });
});

describe('attachProofApi — error normalisation (R1 assumption 4)', () => {
  const CASES: Array<[string, string]> = [
    ['not_your_move', 'You can only add sources to your own moves.'],
    ['not_a_participant', 'Join this room to add a source.'],
    ['kind_not_supported', 'That kind of source is not available yet.'],
    ['proof_cap_reached', 'This move already has the most sources it can hold.'],
    ['validation_failed', 'That source is missing something — check the field and try again.'],
  ];
  for (const [code, message] of CASES) {
    it(`maps ${code} to plain language`, async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { status: 400, context: { json: async () => ({ error: code }) } } });
      const result = await attachProof(input());
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe(code);
      expect(result.errorMessage).toBe(message);
    });
  }

  it('maps an unknown code to the generic fallback', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { status: 500, context: { json: async () => ({ error: 'some_new_code' }) } } });
    const result = await attachProof(input());
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('unknown');
    expect(result.errorMessage).toBe("Couldn't attach that source — try again.");
  });

  it('maps a fetch error (network_error) to plain language', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    const result = await attachProof(input());
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network_error');
  });
});

describe('attachProofApi — detach', () => {
  it('invokes the detach action and maps errors', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, proofItemId: 'p1', deletedAt: 'now', idempotent: false }, error: null });
    const ok = await detachProof({ debateId: 'debate-1', proofItemId: 'p1' });
    expect(ok.ok).toBe(true);
    const body = (mockInvoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toEqual({ action: 'detach', debateId: 'debate-1', proofItemId: 'p1' });

    mockInvoke.mockResolvedValue({ data: null, error: { status: 403, context: { json: async () => ({ error: 'not_your_proof' }) } } });
    const bad = await detachProof({ debateId: 'debate-1', proofItemId: 'p1' });
    expect(bad.ok).toBe(false);
    expect(bad.errorCode).toBe('not_your_proof');
  });
});

describe('attachProofApi — security posture (source-scan)', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/proof/attachProofApi.ts'),
    'utf8',
  );
  it('has no service-role literal, no direct proof_items write, no featureFlags import', () => {
    const noComments = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(/SERVICE_ROLE|service_role/.test(noComments)).toBe(false);
    expect(/\.from\(['"]proof_items['"]\)/.test(noComments)).toBe(false);
    expect(/featureFlags/.test(noComments)).toBe(false);
  });
});
