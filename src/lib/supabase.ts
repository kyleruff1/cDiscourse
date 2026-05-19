import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Runtime-env shim shape written by the Cloud Run entrypoint (HOST-001).
 *
 * The web bundle is built once, with no Supabase URL or publishable key baked
 * in. Cloud Run injects EXPO_PUBLIC_SUPABASE_URL +
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY via --set-secrets= at container start;
 * the entrypoint writes them to dist/runtime-env.js which sets
 * window.__CDISCOURSE_RUNTIME_ENV__ before the React bundle boots.
 *
 * Native (`expo run:ios` / `:android`) and local web dev (`expo start`)
 * continue to read process.env via the babel-injected EXPO_PUBLIC_* fallback.
 */
interface CDiscourseRuntimeEnv {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

/**
 * Read the runtime-env shim if it is present on `window`. Returns an empty
 * object on native, in tests, or when the shim has not been written.
 *
 * This intentionally does NOT throw; it falls through to process.env so
 * `expo start` keeps working.
 */
export function readRuntimeEnv(): CDiscourseRuntimeEnv {
  // typeof guard keeps this safe on React Native (no `window` global) and in
  // Jest (the JSDOM env may or may not expose the shim).
  if (typeof window === 'undefined') return {};
  const candidate = (window as unknown as { __CDISCOURSE_RUNTIME_ENV__?: unknown })
    .__CDISCOURSE_RUNTIME_ENV__;
  if (!candidate || typeof candidate !== 'object') return {};
  const obj = candidate as Record<string, unknown>;
  const url = typeof obj.EXPO_PUBLIC_SUPABASE_URL === 'string' ? obj.EXPO_PUBLIC_SUPABASE_URL : undefined;
  const key =
    typeof obj.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? obj.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      : undefined;
  return { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
}

const runtimeEnv = readRuntimeEnv();

// Resolution order: window.__CDISCOURSE_RUNTIME_ENV__ (web Cloud Run) first,
// then process.env (native + local dev).
const supabaseUrl = runtimeEnv.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  runtimeEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

/** False when env vars are missing — all API calls will return config_missing errors. */
export const SUPABASE_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);

// createClient requires non-empty strings; use placeholders so the module always
// loads. Actual API calls will fail gracefully via SUPABASE_CONFIGURED checks.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
