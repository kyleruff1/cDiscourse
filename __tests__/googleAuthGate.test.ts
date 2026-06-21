/**
 * AUTH-GOOGLE-SSO-003 (#746) — googleAuthGate unit suite.
 *
 * The gate is default OFF: it returns true ONLY when SUPABASE_CONFIGURED is true
 * AND the public flag EXPO_PUBLIC_GOOGLE_AUTH_ENABLED is the exact string
 * 'true'. Resolution mirrors src/lib/supabase.ts: the runtime-env shim
 * (readRuntimeEnv) first, then process.env.
 *
 * The supabase module is mocked with a mutable SUPABASE_CONFIGURED getter and a
 * readRuntimeEnv jest.fn so each case controls both inputs without touching the
 * real environment. process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED is saved /
 * restored around each test.
 */
const mockSupabaseConfigured = { value: true };
const mockReadRuntimeEnv = jest.fn<Record<string, unknown>, []>();

jest.mock('../src/lib/supabase', () => ({
  get SUPABASE_CONFIGURED() {
    return mockSupabaseConfigured.value;
  },
  readRuntimeEnv: () => mockReadRuntimeEnv(),
}));

import {
  resolveGoogleAuthEnabled,
  GOOGLE_AUTH_ENABLED_FLAG,
} from '../src/features/auth/googleAuthGate';

const FLAG = 'EXPO_PUBLIC_GOOGLE_AUTH_ENABLED';
let savedEnv: string | undefined;

beforeEach(() => {
  mockSupabaseConfigured.value = true;
  mockReadRuntimeEnv.mockReset();
  mockReadRuntimeEnv.mockReturnValue({});
  savedEnv = process.env[FLAG];
  delete process.env[FLAG];
});

afterEach(() => {
  if (savedEnv === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = savedEnv;
  }
});

describe('googleAuthGate — GOOGLE_AUTH_ENABLED_FLAG', () => {
  it('exposes the public EXPO_PUBLIC_-prefixed flag name', () => {
    expect(GOOGLE_AUTH_ENABLED_FLAG).toBe(FLAG);
    expect(GOOGLE_AUTH_ENABLED_FLAG.startsWith('EXPO_PUBLIC_')).toBe(true);
  });
});

describe('googleAuthGate — resolveGoogleAuthEnabled (default OFF)', () => {
  it('returns false when the flag is unset (default OFF)', () => {
    expect(resolveGoogleAuthEnabled()).toBe(false);
  });

  it.each(['false', '1', 'TRUE', 'True', 'yes', '', ' true ', 'enabled'])(
    'returns false when the flag is a non-"true" value (%p)',
    (value) => {
      process.env[FLAG] = value;
      expect(resolveGoogleAuthEnabled()).toBe(false);
    },
  );

  it('returns false when the flag is "true" but SUPABASE_CONFIGURED is false', () => {
    mockSupabaseConfigured.value = false;
    process.env[FLAG] = 'true';
    expect(resolveGoogleAuthEnabled()).toBe(false);
  });

  it('returns false when SUPABASE_CONFIGURED is false even with the runtime shim set', () => {
    mockSupabaseConfigured.value = false;
    mockReadRuntimeEnv.mockReturnValue({ [FLAG]: 'true' });
    expect(resolveGoogleAuthEnabled()).toBe(false);
  });
});

describe('googleAuthGate — resolveGoogleAuthEnabled (enabled)', () => {
  it('returns true ONLY when the flag === "true" AND SUPABASE_CONFIGURED is true (via process.env)', () => {
    process.env[FLAG] = 'true';
    expect(resolveGoogleAuthEnabled()).toBe(true);
  });

  it('reads the runtime-env shim value in preference to process.env', () => {
    // Shim says 'true', process.env unset → true (shim wins).
    mockReadRuntimeEnv.mockReturnValue({ [FLAG]: 'true' });
    delete process.env[FLAG];
    expect(resolveGoogleAuthEnabled()).toBe(true);
  });

  it('uses the runtime-env shim string even when process.env disagrees', () => {
    // Shim 'true' takes precedence over a process.env 'false'.
    mockReadRuntimeEnv.mockReturnValue({ [FLAG]: 'true' });
    process.env[FLAG] = 'false';
    expect(resolveGoogleAuthEnabled()).toBe(true);
  });

  it('falls back to process.env when the shim does not carry the flag', () => {
    mockReadRuntimeEnv.mockReturnValue({ SOMETHING_ELSE: 'x' });
    process.env[FLAG] = 'true';
    expect(resolveGoogleAuthEnabled()).toBe(true);
  });
});

describe('AUTH-GOOGLE-SSO-GATE-FIX-001 (#776) — static EXPO_PUBLIC_GOOGLE_AUTH_ENABLED read', () => {
  // The gate now reads process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED via STATIC dot
  // access (so Expo/Metro inlines it on web). These cases set that exact env key
  // by its literal name to prove the static-access path still resolves the flag
  // at runtime (Node) and stays default-OFF for every non-'true' value.
  it("returns true when EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' (static read, shim empty)", () => {
    mockReadRuntimeEnv.mockReturnValue({});
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED = 'true';
    expect(resolveGoogleAuthEnabled()).toBe(true);
  });

  it.each(['false', '', '1', 'TRUE'])(
    'returns false when EXPO_PUBLIC_GOOGLE_AUTH_ENABLED is %p (default OFF, static read)',
    (value) => {
      mockReadRuntimeEnv.mockReturnValue({});
      process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED = value;
      expect(resolveGoogleAuthEnabled()).toBe(false);
    },
  );

  it('returns false when EXPO_PUBLIC_GOOGLE_AUTH_ENABLED is unset/undefined (default OFF)', () => {
    mockReadRuntimeEnv.mockReturnValue({});
    delete process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED;
    expect(process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED).toBeUndefined();
    expect(resolveGoogleAuthEnabled()).toBe(false);
  });

  it("returns false when SUPABASE_CONFIGURED is false even with the static env set to 'true'", () => {
    mockSupabaseConfigured.value = false;
    mockReadRuntimeEnv.mockReturnValue({});
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED = 'true';
    expect(resolveGoogleAuthEnabled()).toBe(false);
  });
});
