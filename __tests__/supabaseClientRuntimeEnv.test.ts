/**
 * HOST-001 / HOST-001b folded — verify that `src/lib/supabase.ts` reads
 * runtime config from `window.__CDISCOURSE_RUNTIME_ENV__` first (Cloud Run
 * web path) and falls back to `process.env` (native + local dev).
 *
 * The Cloud Run container's entrypoint writes `dist/runtime-env.js` from
 * process.env at start. The Expo Web bundle reads `window.__CDISCOURSE_RUNTIME_ENV__`
 * via this helper so a single image can be promoted across environments
 * without rebuild.
 */

// Source-scan import; the doctrine half of this test never executes Supabase.
import * as fs from 'fs';
import * as path from 'path';

// Force the supabase mock for tests that need the module-level fallthrough.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const SUPABASE_PATH = path.join(process.cwd(), 'src/lib/supabase.ts');

describe('readRuntimeEnv — runtime env shim helper', () => {
  beforeEach(() => {
    // Reset window stub between tests.
    delete (global as unknown as { window?: unknown }).window;
    jest.resetModules();
  });

  afterEach(() => {
    delete (global as unknown as { window?: unknown }).window;
  });

  it('returns an empty object when window is undefined (native / SSR)', () => {
    // Ensure window is absent in this test.
    expect(typeof (global as unknown as { window?: unknown }).window).toBe('undefined');
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({});
  });

  it('returns an empty object when the shim is not set on window', () => {
    (global as unknown as { window: Record<string, unknown> }).window = {};
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({});
  });

  it('returns an empty object when the shim is not a plain object', () => {
    (global as unknown as { window: Record<string, unknown> }).window = {
      __CDISCOURSE_RUNTIME_ENV__: 'not-an-object',
    };
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({});
  });

  it('reads EXPO_PUBLIC_SUPABASE_URL when the shim provides it', () => {
    (global as unknown as { window: Record<string, unknown> }).window = {
      __CDISCOURSE_RUNTIME_ENV__: {
        EXPO_PUBLIC_SUPABASE_URL: 'https://dev-project.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
    };
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: 'https://dev-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
  });

  it('coerces non-string shim values to undefined', () => {
    (global as unknown as { window: Record<string, unknown> }).window = {
      __CDISCOURSE_RUNTIME_ENV__: {
        EXPO_PUBLIC_SUPABASE_URL: 12345,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: null,
      },
    };
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: undefined,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
  });

  it('reads the shim even when only one key is present (partial config)', () => {
    (global as unknown as { window: Record<string, unknown> }).window = {
      __CDISCOURSE_RUNTIME_ENV__: {
        EXPO_PUBLIC_SUPABASE_URL: 'https://partial.supabase.co',
      },
    };
    const { readRuntimeEnv } = require('../src/lib/supabase');
    expect(readRuntimeEnv()).toEqual({
      EXPO_PUBLIC_SUPABASE_URL: 'https://partial.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
  });
});

describe('src/lib/supabase.ts — source contract', () => {
  let supabaseSource = '';
  beforeAll(() => {
    supabaseSource = fs.readFileSync(SUPABASE_PATH, 'utf8');
  });

  it('exports the readRuntimeEnv helper', () => {
    expect(supabaseSource).toMatch(/export function readRuntimeEnv/);
  });

  it('reads window.__CDISCOURSE_RUNTIME_ENV__ before process.env for the URL', () => {
    expect(supabaseSource).toMatch(/__CDISCOURSE_RUNTIME_ENV__/);
    expect(supabaseSource).toMatch(
      /runtimeEnv\.EXPO_PUBLIC_SUPABASE_URL\s*\?\?\s*process\.env\.EXPO_PUBLIC_SUPABASE_URL/,
    );
  });

  it('reads window.__CDISCOURSE_RUNTIME_ENV__ before process.env for the publishable key', () => {
    expect(supabaseSource).toMatch(
      /runtimeEnv\.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY[\s\S]*?process\.env\.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it('guards window access with a typeof check (safe on native + SSR)', () => {
    expect(supabaseSource).toMatch(/typeof window === 'undefined'/);
  });

  it('never references service-role / Anthropic / xAI / Bearer / Resend secret shapes', () => {
    // Hard rule: this client file must remain free of any non-publishable
    // secret reference, even in comments.
    expect(supabaseSource).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(supabaseSource).not.toMatch(/service_role/);
    expect(supabaseSource).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(supabaseSource).not.toMatch(/XAI_API_KEY/);
    expect(supabaseSource).not.toMatch(/X_BEARER_TOKEN/);
    expect(supabaseSource).not.toMatch(/RESEND_API_KEY/);
  });
});
