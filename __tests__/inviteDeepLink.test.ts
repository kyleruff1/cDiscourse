/**
 * QOL-038 — pure-model tests for `src/features/invites/inviteDeepLink.ts`.
 *
 * Covers parse + serialise round-trip, token shape validation, the
 * never-throw contract for parse, and the explicit programmer-error throws
 * for the build helpers.
 */
import {
  INVITE_ROUTE_PREFIX,
  INVITE_TOKEN_MAX_LENGTH,
  INVITE_TOKEN_MIN_LENGTH,
  NATIVE_INVITE_SCHEME_PREFIX,
  buildInviteLink,
  buildNativeInviteLink,
  isValidInviteTokenShape,
  parseInviteDeepLink,
} from '../src/features/invites/inviteDeepLink';

// 43-char base64url token — typical width for sha256 / 32-byte random.
const GOOD_TOKEN = 'aB12345678901234567890123456789012345678901';

describe('isValidInviteTokenShape', () => {
  it('accepts a base64url token within the length window', () => {
    expect(isValidInviteTokenShape(GOOD_TOKEN)).toBe(true);
    expect(isValidInviteTokenShape('A'.repeat(INVITE_TOKEN_MIN_LENGTH))).toBe(true);
    expect(isValidInviteTokenShape('A'.repeat(INVITE_TOKEN_MAX_LENGTH))).toBe(true);
  });

  it('rejects too-short, too-long, empty, non-string', () => {
    expect(isValidInviteTokenShape('')).toBe(false);
    expect(isValidInviteTokenShape('A'.repeat(INVITE_TOKEN_MIN_LENGTH - 1))).toBe(false);
    expect(isValidInviteTokenShape('A'.repeat(INVITE_TOKEN_MAX_LENGTH + 1))).toBe(false);
    expect(isValidInviteTokenShape(undefined as never)).toBe(false);
    expect(isValidInviteTokenShape(null as never)).toBe(false);
    expect(isValidInviteTokenShape(1234 as never)).toBe(false);
  });

  it('rejects forbidden characters (slash, plus, equals, space)', () => {
    expect(isValidInviteTokenShape('aB1/345678901234567890123456789012345678901')).toBe(false);
    expect(isValidInviteTokenShape('aB1+345678901234567890123456789012345678901')).toBe(false);
    expect(isValidInviteTokenShape('aB1=345678901234567890123456789012345678901')).toBe(false);
    expect(isValidInviteTokenShape('aB1 345678901234567890123456789012345678901')).toBe(false);
  });
});

describe('parseInviteDeepLink — web (HTTPS)', () => {
  it('extracts the token from a typical hosted URL', () => {
    expect(parseInviteDeepLink(`https://dev.cdiscourse.com${INVITE_ROUTE_PREFIX}${GOOD_TOKEN}`)).toEqual({
      token: GOOD_TOKEN,
    });
  });

  it('tolerates trailing slash, ?query, and #fragment', () => {
    expect(parseInviteDeepLink(`https://dev.cdiscourse.com/invite/${GOOD_TOKEN}/`)).toEqual({
      token: GOOD_TOKEN,
    });
    expect(parseInviteDeepLink(`https://dev.cdiscourse.com/invite/${GOOD_TOKEN}?utm=email`)).toEqual({
      token: GOOD_TOKEN,
    });
    expect(parseInviteDeepLink(`https://dev.cdiscourse.com/invite/${GOOD_TOKEN}#fragment`)).toEqual({
      token: GOOD_TOKEN,
    });
  });

  it('accepts http:// (for local dev) as well as https://', () => {
    expect(parseInviteDeepLink(`http://localhost:8081/invite/${GOOD_TOKEN}`)).toEqual({
      token: GOOD_TOKEN,
    });
  });
});

describe('parseInviteDeepLink — native scheme', () => {
  it('extracts the token from the cdiscourse:// form', () => {
    expect(parseInviteDeepLink(`cdiscourse://invite/${GOOD_TOKEN}`)).toEqual({
      token: GOOD_TOKEN,
    });
  });

  it('tolerates a case-mismatched scheme prefix', () => {
    expect(parseInviteDeepLink(`CDISCOURSE://invite/${GOOD_TOKEN}`)).toEqual({
      token: GOOD_TOKEN,
    });
  });
});

describe('parseInviteDeepLink — null returns (never throws)', () => {
  it('returns null for unrelated URLs without throwing', () => {
    expect(parseInviteDeepLink('https://dev.cdiscourse.com/some/other/path')).toBeNull();
    expect(parseInviteDeepLink('https://dev.cdiscourse.com/')).toBeNull();
    expect(parseInviteDeepLink('https://dev.cdiscourse.com/invite/')).toBeNull(); // empty token
    expect(parseInviteDeepLink('cdiscourse://other/route')).toBeNull();
    expect(parseInviteDeepLink('not-a-url')).toBeNull();
    expect(parseInviteDeepLink('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseInviteDeepLink(undefined)).toBeNull();
    expect(parseInviteDeepLink(null)).toBeNull();
    expect(parseInviteDeepLink(42)).toBeNull();
    expect(parseInviteDeepLink({})).toBeNull();
  });

  it('returns null for an invite path with a bad-shape token (never carries a typo forward)', () => {
    expect(parseInviteDeepLink('https://dev.cdiscourse.com/invite/short')).toBeNull();
    expect(parseInviteDeepLink(`https://dev.cdiscourse.com/invite/${'A'.repeat(200)}`)).toBeNull();
    // Token contains a forbidden character.
    expect(parseInviteDeepLink('https://dev.cdiscourse.com/invite/aB+1234567890123456789012345678901234567')).toBeNull();
  });

  it('rejects schemes other than http/https/cdiscourse://', () => {
    expect(parseInviteDeepLink(`file:///invite/${GOOD_TOKEN}`)).toBeNull();
    expect(parseInviteDeepLink(`ftp://example.com/invite/${GOOD_TOKEN}`)).toBeNull();
    expect(parseInviteDeepLink(`javascript:alert(/invite/${GOOD_TOKEN}/)`)).toBeNull();
  });

  it('never throws — exhaustive sample of garbage inputs', () => {
    const inputs = [
      '',
      '   ',
      'http://',
      'https://',
      '://',
      'cdiscourse://',
      'cdiscourse://invite',
      'cdiscourse://invite/',
      String.fromCharCode(0),
      '\n\n\n',
    ];
    for (const v of inputs) {
      expect(() => parseInviteDeepLink(v)).not.toThrow();
      expect(parseInviteDeepLink(v)).toBeNull();
    }
  });
});

// ── Build helpers ──────────────────────────────────────────────

describe('buildInviteLink', () => {
  it('is the inverse of parseInviteDeepLink for a valid token', () => {
    const url = buildInviteLink('https://dev.cdiscourse.com', GOOD_TOKEN);
    expect(url).toBe(`https://dev.cdiscourse.com${INVITE_ROUTE_PREFIX}${GOOD_TOKEN}`);
    expect(parseInviteDeepLink(url)).toEqual({ token: GOOD_TOKEN });
  });

  it('strips a trailing slash from the origin', () => {
    expect(buildInviteLink('https://dev.cdiscourse.com/', GOOD_TOKEN)).toBe(
      `https://dev.cdiscourse.com${INVITE_ROUTE_PREFIX}${GOOD_TOKEN}`,
    );
  });

  it('throws on missing origin', () => {
    expect(() => buildInviteLink('', GOOD_TOKEN)).toThrow();
  });

  it('throws on bad token shape', () => {
    expect(() => buildInviteLink('https://dev.cdiscourse.com', 'too-short')).toThrow();
    expect(() => buildInviteLink('https://dev.cdiscourse.com', 'a'.repeat(500))).toThrow();
  });
});

describe('buildNativeInviteLink', () => {
  it('is the inverse of parseInviteDeepLink for the native form', () => {
    const url = buildNativeInviteLink(GOOD_TOKEN);
    expect(url).toBe(`${NATIVE_INVITE_SCHEME_PREFIX}${GOOD_TOKEN}`);
    expect(parseInviteDeepLink(url)).toEqual({ token: GOOD_TOKEN });
  });

  it('throws on bad token shape', () => {
    expect(() => buildNativeInviteLink('too-short')).toThrow();
  });
});

// ── Round-trip property ────────────────────────────────────────

describe('parse / build round-trip', () => {
  const sampleTokens = [
    GOOD_TOKEN,
    'A'.repeat(INVITE_TOKEN_MIN_LENGTH),
    'z'.repeat(INVITE_TOKEN_MAX_LENGTH),
    'aZ09_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_-_',
  ];
  for (const t of sampleTokens) {
    it(`web round-trip for token of length ${t.length}`, () => {
      const url = buildInviteLink('https://dev.cdiscourse.com', t);
      expect(parseInviteDeepLink(url)).toEqual({ token: t });
    });

    it(`native round-trip for token of length ${t.length}`, () => {
      const url = buildNativeInviteLink(t);
      expect(parseInviteDeepLink(url)).toEqual({ token: t });
    });
  }
});
