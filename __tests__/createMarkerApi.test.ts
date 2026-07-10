/**
 * MARK-002 (#894) — createMarkerApi seam tests.
 *
 * The seam maps the scoped input onto the create-marker wire body, defaults the
 * kind to rebuttal_anchor, normalises success + every reconciled error code to
 * plain language (never echoing a raw code), and never throws on a network
 * error.
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

import { createMarkerScoped } from '../src/features/arguments/markers/createMarkerApi';
import { MARKER_ERROR_COPY } from '../src/features/arguments/markers/markerCopy';
import type { PendingMarkerScope } from '../src/features/arguments/markers/timestampMarkerModel';

const SCOPE: PendingMarkerScope = {
  targetArgumentId: 'target-1',
  spanStart: 0,
  spanEnd: 4,
  quote: 'Cars',
};

const CREATED = {
  id: 'marker-1',
  debateId: 'debate-1',
  targetArgumentId: 'target-1',
  replyArgumentId: 'reply-1',
  kind: 'rebuttal_anchor',
  spanStart: 0,
  spanEnd: 4,
  spanUnit: 'chars',
  quotedText: 'Cars',
  createdAt: '2026-07-11T00:00:00.000Z',
};

function mintOk(idempotent = false) {
  return { data: { ok: true, idempotent, marker: CREATED }, error: null };
}

beforeEach(() => mockInvoke.mockReset());

describe('createMarkerApi — body mapping', () => {
  it('maps the scoped input onto the create-marker body with default kind rebuttal_anchor', async () => {
    mockInvoke.mockResolvedValue(mintOk());
    await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE, replyArgumentId: 'reply-1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, opts] = mockInvoke.mock.calls[0];
    expect(fn).toBe('create-marker');
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toEqual({
      action: 'mint',
      debateId: 'debate-1',
      targetArgumentId: 'target-1',
      spanStart: 0,
      spanEnd: 4,
      quote: 'Cars',
      kind: 'rebuttal_anchor',
      replyArgumentId: 'reply-1',
    });
  });

  it('omits replyArgumentId when not supplied (standalone scope)', async () => {
    mockInvoke.mockResolvedValue(mintOk());
    await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE });
    const body = (mockInvoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).not.toHaveProperty('replyArgumentId');
  });
});

describe('createMarkerApi — success', () => {
  it('returns the minted marker + idempotent flag', async () => {
    mockInvoke.mockResolvedValue(mintOk(true));
    const result = await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE, replyArgumentId: 'reply-1' });
    expect(result.ok).toBe(true);
    expect(result.marker?.id).toBe('marker-1');
    expect(result.idempotent).toBe(true);
  });
});

describe('createMarkerApi — error normalisation (never echoes a raw code)', () => {
  const CASES: Array<[string, keyof typeof MARKER_ERROR_COPY]> = [
    ['quote_mismatch', 'quote_mismatch'],
    ['marker_cap_reached', 'marker_cap_reached'],
    ['not_a_participant', 'not_a_participant'],
    ['not_your_reply', 'not_your_reply'],
    ['target_not_found', 'target_not_found'],
    ['span_out_of_bounds', 'span_out_of_bounds'],
    ['span_too_long', 'span_too_long'],
    ['debate_reply_mismatch', 'debate_reply_mismatch'],
    ['network_error', 'network_error'],
  ];
  for (const [raw, expected] of CASES) {
    it(`maps ${raw} to its plain-language message`, async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { status: 400, context: { json: async () => ({ error: raw }) } } });
      const result = await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE, replyArgumentId: 'reply-1' });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe(expected);
      expect(result.errorMessage).toBe(MARKER_ERROR_COPY[expected]);
      // The raw code never surfaces to the user.
      expect(result.errorMessage).not.toContain('_');
    });
  }

  it('maps an unknown code to the fallback', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { status: 500, context: { json: async () => ({ error: 'some_new_code' }) } } });
    const result = await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('unknown');
    expect(result.errorMessage).toBe(MARKER_ERROR_COPY.unknown);
  });

  it('never throws on a network failure (no context body)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    const result = await createMarkerScoped({ debateId: 'debate-1', scope: SCOPE });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network_error');
  });
});
