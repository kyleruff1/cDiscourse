/**
 * CHIMEIN-P8 Round 2 (#761) — chimeInApi seam tests.
 *
 * The seam maps the scoped input onto the chime-in wire body, normalises success
 * (snake_case wire -> camelCase marker) + every reconciled error code to plain
 * language (never echoing a raw code), and never throws on a network error. The
 * supabase client is mocked at the functions.invoke boundary so the whole
 * edgeFunctions.chimeIn wrapper chain runs for real.
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
  attachChimeIn,
  retractChimeIn,
  CHIME_IN_ERROR_COPY,
  toChimeInErrorCode,
  type ChimeInErrorCode,
} from '../src/features/debates/chimeInApi';

function attachOk() {
  return {
    data: {
      ok: true,
      chime_in: { id: 'chime-1', seat_index: 2, target_argument_id: 'point-1' },
      open_chime_in_seat_count: 1,
    },
    error: null,
  };
}

function retractOk() {
  return { data: { ok: true, open_chime_in_seat_count: 3 }, error: null };
}

beforeEach(() => mockInvoke.mockReset());

describe('chimeInApi — attach body mapping', () => {
  it('maps the input onto the attach body (snake_case wire, no debate_id)', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    await attachChimeIn({ argumentId: 'reply-1', targetArgumentId: 'point-1' });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, opts] = mockInvoke.mock.calls[0];
    expect(fn).toBe('chime-in');
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toEqual({
      action: 'attach',
      argument_id: 'reply-1',
      target_argument_id: 'point-1',
    });
    // debate_id is derived server-side from the argument row, never on the wire.
    expect(body).not.toHaveProperty('debate_id');
    expect(body).not.toHaveProperty('seat_index');
  });
});

describe('chimeInApi — retract body mapping', () => {
  it('maps the input onto the retract body with an optional contribution_id', async () => {
    mockInvoke.mockResolvedValue(retractOk());
    await retractChimeIn({ argumentId: 'reply-1', contributionId: 'chime-1' });
    const body = (mockInvoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toEqual({
      action: 'retract',
      argument_id: 'reply-1',
      contribution_id: 'chime-1',
    });
  });
});

describe('chimeInApi — success normalisation (snake -> camel)', () => {
  it('returns the marker + open seat count on attach', async () => {
    mockInvoke.mockResolvedValue(attachOk());
    const result = await attachChimeIn({ argumentId: 'reply-1', targetArgumentId: 'point-1' });
    expect(result.ok).toBe(true);
    expect(result.marker).toEqual({ id: 'chime-1', seatIndex: 2, targetArgumentId: 'point-1' });
    expect(result.openChimeInSeatCount).toBe(1);
  });

  it('returns only the open seat count on retract', async () => {
    mockInvoke.mockResolvedValue(retractOk());
    const result = await retractChimeIn({ argumentId: 'reply-1' });
    expect(result.ok).toBe(true);
    expect(result.marker).toBeUndefined();
    expect(result.openChimeInSeatCount).toBe(3);
  });
});

describe('chimeInApi — error normalisation (never echoes a raw code)', () => {
  const CASES: Array<[string, ChimeInErrorCode]> = [
    ['not_author', 'not_author'],
    ['not_point_scoped', 'not_point_scoped'],
    ['room_private', 'room_private'],
    ['seats_full', 'seats_full'],
    ['not_found', 'not_found'],
    ['invalid_input', 'invalid_input'],
    ['unauthorized', 'unauthorized'],
    ['network_error', 'network_error'],
  ];
  for (const [raw, expected] of CASES) {
    it(`maps ${raw} to its plain-language message`, async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { status: 400, context: { json: async () => ({ error: raw }) } },
      });
      const result = await attachChimeIn({ argumentId: 'reply-1', targetArgumentId: 'point-1' });
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe(expected);
      expect(result.errorMessage).toBe(CHIME_IN_ERROR_COPY[expected]);
      // The raw code never surfaces to the user.
      expect(result.errorMessage).not.toMatch(/_/);
    });
  }

  it('maps validation_failed / invalid_json to invalid_input at the seam', async () => {
    expect(toChimeInErrorCode('validation_failed')).toBe('invalid_input');
    expect(toChimeInErrorCode('invalid_json')).toBe('invalid_input');
  });

  it('maps an unknown code to network_error (safe fallback)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { status: 500, context: { json: async () => ({ error: 'some_new_code' }) } },
    });
    const result = await attachChimeIn({ argumentId: 'reply-1', targetArgumentId: 'point-1' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network_error');
  });

  it('never throws on a network failure (no context body)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    const result = await retractChimeIn({ argumentId: 'reply-1' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('network_error');
  });
});

describe('chimeInApi — plain-language doctrine (ban-list clean)', () => {
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    'third principal',
    'third voice',
  ];
  it('no chime-in error string contains a verdict / amplification / third-voice token', () => {
    for (const message of Object.values(CHIME_IN_ERROR_COPY)) {
      const lower = message.toLowerCase();
      for (const token of BANNED) {
        expect(lower).not.toContain(token);
      }
      // No internal snake_case code leaks into user copy.
      expect(message).not.toMatch(/_/);
    }
  });
});
