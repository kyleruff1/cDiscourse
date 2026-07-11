/**
 * ASP-FLAGS-001 (#873) — feature-flag registry for the Argument Surface Pivot.
 *
 * Pure decision module. NO React, NO Supabase call, NO network, NO secret. Each
 * of the eleven flags it resolves reads a PUBLIC runtime flag whose name carries
 * the `EXPO_PUBLIC_` prefix; that prefix is the public-config contract, so these
 * are runtime toggles, never key material. Merging this card changes zero live
 * surfaces: every flag defaults OFF and no component consumes an accessor in this
 * slice. A downstream surface card (HOME-001, ROOM-002, PROOF-002, MARKS, ...)
 * wires its own accessor at the surface boundary and owns the byte-identical
 * OFF fallback branch.
 *
 * Resolution order mirrors src/lib/supabase.ts and
 * src/features/auth/googleAuthGate.ts: the runtime-env shim
 * (window.__CDISCOURSE_RUNTIME_ENV__, surfaced via readRuntimeEnv()) first, then
 * the STATIC process.env dot read (native + local dev, and the path Metro inlines
 * for the web bundle).
 *
 * WEB-BUNDLE SAFETY (the reason this registry exists) — mirrors the #776 gate
 * fix: the process.env read for each flag MUST be a STATIC member expression
 * (`process.env.EXPO_PUBLIC_HOME_V2`, and so on). babel-preset-expo inlines
 * `EXPO_PUBLIC_*` values ONLY for static dot access at web-bundle build time. A
 * DYNAMIC computed read (bracket-indexed by a variable, a name table indexed into
 * the env, a shared helper that takes an env-name argument) is left un-inlined and
 * resolves to `undefined` in the deployed Netlify web bundle, silently forcing
 * every flag OFF in production while jest and typecheck stay green (Node has a
 * real process.env). Therefore there are ELEVEN hard-coded static dot reads below,
 * one per flag — never a loop, never a computed key. Do NOT refactor them into a
 * single dynamic read. The source-scan guard in
 * __tests__/featureFlagsStaticEnv.test.ts asserts each static literal is present
 * and bans the dynamic form across src/.
 *
 * DIVERGENCE from googleAuthGate.ts: these resolvers do NOT gate on
 * SUPABASE_CONFIGURED. The ASP flags toggle client-only UI surfaces that are
 * legible without a live Supabase connection; a Supabase-config guard would
 * wrongly force every ASP surface OFF in an unconfigured local build. (The Google
 * gate needs it because sign-in is meaningless without Supabase.)
 *
 * DOCTRINE: flags gate UI surface availability only. A flag being ON never grants
 * a claim factual standing, never alters a strength band, never changes a
 * validation outcome, and never touches src/domain/constitution/engine.ts. This
 * module reads and writes no score, heat, or evidence.
 */
import { readRuntimeEnv } from './supabase';

/** The eleven ASP surface flags. Stable string ids used as registry keys. */
export type AspFeatureFlag =
  | 'home_v2'
  | 'room_exchange_v2'
  | 'proof_drawer'
  | 'voice_entries'
  | 'timestamp_rebuttals'
  | 'one_time_playback'
  | 'move_marks'
  | 'derived_signals'
  | 'quote_forge'
  | 'feedback_flag_intents'
  | 'chime_in';

/** A single flag descriptor. `resolve()` returns the current boolean state. */
export interface AspFeatureFlagDescriptor {
  /** Stable internal id, e.g. 'home_v2'. */
  readonly key: AspFeatureFlag;
  /** The public runtime env var name, e.g. 'EXPO_PUBLIC_HOME_V2'. */
  readonly envName: string;
  /** Pure resolver: reads the runtime-env shim then the STATIC process.env dot read. */
  readonly resolve: () => boolean;
}

// ── Public runtime flag names ──────────────────────────────────────
// Each is the exact EXPO_PUBLIC_-prefixed env var name for one surface. Left as
// named constants for the registry + tests; the actual production read below is a
// STATIC dot access, never a lookup keyed by one of these constants.

export const HOME_V2_FLAG = 'EXPO_PUBLIC_HOME_V2' as const;
export const ROOM_EXCHANGE_V2_FLAG = 'EXPO_PUBLIC_ROOM_EXCHANGE_V2' as const;
export const PROOF_DRAWER_FLAG = 'EXPO_PUBLIC_PROOF_DRAWER' as const;
export const VOICE_ENTRIES_FLAG = 'EXPO_PUBLIC_VOICE_ENTRIES' as const;
export const TIMESTAMP_REBUTTALS_FLAG = 'EXPO_PUBLIC_TIMESTAMP_REBUTTALS' as const;
export const ONE_TIME_PLAYBACK_FLAG = 'EXPO_PUBLIC_ONE_TIME_PLAYBACK' as const;
export const MOVE_MARKS_FLAG = 'EXPO_PUBLIC_MOVE_MARKS' as const;
export const DERIVED_SIGNALS_FLAG = 'EXPO_PUBLIC_DERIVED_SIGNALS' as const;
export const QUOTE_FORGE_FLAG = 'EXPO_PUBLIC_QUOTE_FORGE' as const;
export const FEEDBACK_FLAG_INTENTS_FLAG = 'EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS' as const;
export const CHIME_IN_FLAG = 'EXPO_PUBLIC_CHIME_IN' as const;

// ── Resolvers ──────────────────────────────────────────────────────
// One per flag. Each is default OFF: true ONLY when the resolved value is the
// exact three-character lowercase string 'true'. Unset / '' / 'false' / '1' /
// 'TRUE' / 'True' / ' true ' / 'yes' / 'enabled' all resolve false. The shim read
// via a Record cast indexes the returned OBJECT (a real-object access, not an
// inlining concern), so a test that stubs readRuntimeEnv() can flip a flag; the
// process.env read is a STATIC dot access so Metro inlines it for the web bundle.

/** Default OFF. True only when EXPO_PUBLIC_HOME_V2 resolves to the exact string 'true'. */
export function isHomeV2Enabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[HOME_V2_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_HOME_V2; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_ROOM_EXCHANGE_V2 resolves to the exact string 'true'. */
export function isRoomExchangeV2Enabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[ROOM_EXCHANGE_V2_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_ROOM_EXCHANGE_V2; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_PROOF_DRAWER resolves to the exact string 'true'. */
export function isProofDrawerEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[PROOF_DRAWER_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_PROOF_DRAWER; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_VOICE_ENTRIES resolves to the exact string 'true'. */
export function isVoiceEntriesEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[VOICE_ENTRIES_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_VOICE_ENTRIES; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_TIMESTAMP_REBUTTALS resolves to the exact string 'true'. */
export function isTimestampRebuttalsEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[TIMESTAMP_REBUTTALS_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_TIMESTAMP_REBUTTALS; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_ONE_TIME_PLAYBACK resolves to the exact string 'true'. */
export function isOneTimePlaybackEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[ONE_TIME_PLAYBACK_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_ONE_TIME_PLAYBACK; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/** Default OFF. True only when EXPO_PUBLIC_MOVE_MARKS resolves to the exact string 'true'. */
export function isMoveMarksEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[MOVE_MARKS_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_MOVE_MARKS; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/**
 * FEEDBACK-002 (#899) — the 8th ASP flag. Gates the derivedObservationSignals
 * advisory surfaces (Inspect active-node lines + mediator rail overlay). Default
 * OFF, byte-identical when off. True only when EXPO_PUBLIC_DERIVED_SIGNALS
 * resolves to the exact string 'true'.
 */
export function isDerivedSignalsEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[DERIVED_SIGNALS_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_DERIVED_SIGNALS; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/**
 * UX-COMPOSER-005 (#831) / QUOTE-FORGE-002 (#842) — the 9th ASP flag. Gates the
 * cross-room quote/callback pair: the composer-side weave affordance + draft echo
 * (#831) and the posted-node echo on Timeline / Stack / Ringside (#842). Default
 * OFF, byte-identical when off (no crossRoomCallback key emitted in the submit
 * payload, no echo chrome). True only when EXPO_PUBLIC_QUOTE_FORGE resolves to the
 * exact string 'true'.
 */
export function isQuoteForgeEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[QUOTE_FORGE_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_QUOTE_FORGE; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/**
 * UX-FLAGS-004 (#836) — the 10th ASP flag. Gates the tappability of the (already
 * live, currently read-only) point feedback-flag pills: when on, an actionable
 * pill opens the shipped reply-with-preset composer lane pre-typed to the flag
 * intent. Default OFF, byte-identical when off (onFlagIntent stays undefined at
 * every mount, pills render exactly as UX-FLAGS-002 shipped). True only when
 * EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS resolves to the exact string 'true'.
 */
export function isFeedbackFlagIntentsEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[FEEDBACK_FLAG_INTENTS_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

/**
 * CHIMEIN-P8 Round 2 (#761) — the 11th ASP flag. Gates the chime-in contribution
 * UI surface: the composer affordance (oneToOneRoomModel.chimeAffordanceVisible),
 * the ArgumentStateRail chime-seat chip feed, and the ChimeInGovernanceSurface.
 * The chime-in Edge Function + RLS enforce public-only / cap / author-scope /
 * point-scope REGARDLESS of this flag — the flag is a UI rollout control, NOT a
 * security boundary. Default OFF, byte-identical when off (no chime affordance,
 * no chime chip, the governance surface renders null). True only when
 * EXPO_PUBLIC_CHIME_IN resolves to the exact string 'true'.
 */
export function isChimeInEnabled(): boolean {
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[CHIME_IN_FLAG];
  const fromEnv = process.env.EXPO_PUBLIC_CHIME_IN; // STATIC dot access REQUIRED (#776)
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}

// ── Registry + dispatcher ──────────────────────────────────────────

/** Frozen registry of the eleven ASP flag descriptors, keyed by AspFeatureFlag. */
export const ASP_FEATURE_FLAGS: Readonly<Record<AspFeatureFlag, AspFeatureFlagDescriptor>> =
  Object.freeze({
    home_v2: { key: 'home_v2', envName: HOME_V2_FLAG, resolve: isHomeV2Enabled },
    room_exchange_v2: {
      key: 'room_exchange_v2',
      envName: ROOM_EXCHANGE_V2_FLAG,
      resolve: isRoomExchangeV2Enabled,
    },
    proof_drawer: { key: 'proof_drawer', envName: PROOF_DRAWER_FLAG, resolve: isProofDrawerEnabled },
    voice_entries: {
      key: 'voice_entries',
      envName: VOICE_ENTRIES_FLAG,
      resolve: isVoiceEntriesEnabled,
    },
    timestamp_rebuttals: {
      key: 'timestamp_rebuttals',
      envName: TIMESTAMP_REBUTTALS_FLAG,
      resolve: isTimestampRebuttalsEnabled,
    },
    one_time_playback: {
      key: 'one_time_playback',
      envName: ONE_TIME_PLAYBACK_FLAG,
      resolve: isOneTimePlaybackEnabled,
    },
    move_marks: { key: 'move_marks', envName: MOVE_MARKS_FLAG, resolve: isMoveMarksEnabled },
    derived_signals: {
      key: 'derived_signals',
      envName: DERIVED_SIGNALS_FLAG,
      resolve: isDerivedSignalsEnabled,
    },
    quote_forge: { key: 'quote_forge', envName: QUOTE_FORGE_FLAG, resolve: isQuoteForgeEnabled },
    feedback_flag_intents: {
      key: 'feedback_flag_intents',
      envName: FEEDBACK_FLAG_INTENTS_FLAG,
      resolve: isFeedbackFlagIntentsEnabled,
    },
    chime_in: { key: 'chime_in', envName: CHIME_IN_FLAG, resolve: isChimeInEnabled },
  });

/**
 * Registry lookup (a real-object index on ASP_FEATURE_FLAGS, NOT an env index)
 * that dispatches to the flag descriptor resolver. Returns the flag boolean.
 */
export function resolveAspFeatureFlag(key: AspFeatureFlag): boolean {
  return ASP_FEATURE_FLAGS[key].resolve();
}
