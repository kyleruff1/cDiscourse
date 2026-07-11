/**
 * ASP-FLAGS-001 (#873) — featureFlags behavioral suite.
 *
 * Each of the seven ASP surface flags is default OFF: its accessor returns true
 * ONLY when the resolved value (runtime-env shim first, then process.env) is the
 * exact string 'true'. Resolution mirrors src/features/auth/googleAuthGate.ts.
 *
 * The supabase module is mocked with a readRuntimeEnv jest.fn so each case
 * controls the shim input without touching the real environment. The per-flag
 * process.env key is saved / restored around every test.
 *
 * NOTE: this suite runs on Node, which has a real process.env, so it cannot catch
 * the babel-preset-expo web-inlining defect. The static-literal presence and
 * dynamic-read ban live in __tests__/featureFlagsStaticEnv.test.ts.
 */
const mockReadRuntimeEnv = jest.fn<Record<string, unknown>, []>();

jest.mock('../src/lib/supabase', () => ({
  readRuntimeEnv: () => mockReadRuntimeEnv(),
}));

import {
  isHomeV2Enabled,
  isRoomExchangeV2Enabled,
  isProofDrawerEnabled,
  isVoiceEntriesEnabled,
  isTimestampRebuttalsEnabled,
  isOneTimePlaybackEnabled,
  isMoveMarksEnabled,
  isDerivedSignalsEnabled,
  isQuoteForgeEnabled,
  isFeedbackFlagIntentsEnabled,
  resolveAspFeatureFlag,
  ASP_FEATURE_FLAGS,
  HOME_V2_FLAG,
  ROOM_EXCHANGE_V2_FLAG,
  PROOF_DRAWER_FLAG,
  VOICE_ENTRIES_FLAG,
  TIMESTAMP_REBUTTALS_FLAG,
  ONE_TIME_PLAYBACK_FLAG,
  MOVE_MARKS_FLAG,
  DERIVED_SIGNALS_FLAG,
  QUOTE_FORGE_FLAG,
  FEEDBACK_FLAG_INTENTS_FLAG,
  type AspFeatureFlag,
} from '../src/lib/featureFlags';

interface FlagCase {
  key: AspFeatureFlag;
  envName: string;
  accessor: () => boolean;
}

const FLAG_CASES: FlagCase[] = [
  { key: 'home_v2', envName: HOME_V2_FLAG, accessor: isHomeV2Enabled },
  { key: 'room_exchange_v2', envName: ROOM_EXCHANGE_V2_FLAG, accessor: isRoomExchangeV2Enabled },
  { key: 'proof_drawer', envName: PROOF_DRAWER_FLAG, accessor: isProofDrawerEnabled },
  { key: 'voice_entries', envName: VOICE_ENTRIES_FLAG, accessor: isVoiceEntriesEnabled },
  {
    key: 'timestamp_rebuttals',
    envName: TIMESTAMP_REBUTTALS_FLAG,
    accessor: isTimestampRebuttalsEnabled,
  },
  { key: 'one_time_playback', envName: ONE_TIME_PLAYBACK_FLAG, accessor: isOneTimePlaybackEnabled },
  { key: 'move_marks', envName: MOVE_MARKS_FLAG, accessor: isMoveMarksEnabled },
  { key: 'derived_signals', envName: DERIVED_SIGNALS_FLAG, accessor: isDerivedSignalsEnabled },
  { key: 'quote_forge', envName: QUOTE_FORGE_FLAG, accessor: isQuoteForgeEnabled },
  {
    key: 'feedback_flag_intents',
    envName: FEEDBACK_FLAG_INTENTS_FLAG,
    accessor: isFeedbackFlagIntentsEnabled,
  },
];

const ALL_ENV_NAMES = FLAG_CASES.map((c) => c.envName);

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  mockReadRuntimeEnv.mockReset();
  mockReadRuntimeEnv.mockReturnValue({});
  for (const name of ALL_ENV_NAMES) {
    savedEnv[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ALL_ENV_NAMES) {
    if (savedEnv[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = savedEnv[name];
    }
  }
});

describe('featureFlags — flag env names', () => {
  it('every flag name carries the public EXPO_PUBLIC_ prefix', () => {
    for (const { envName } of FLAG_CASES) {
      expect(envName.startsWith('EXPO_PUBLIC_')).toBe(true);
    }
  });

  it('exposes exactly the ten expected env-name literals', () => {
    expect(ALL_ENV_NAMES).toEqual([
      'EXPO_PUBLIC_HOME_V2',
      'EXPO_PUBLIC_ROOM_EXCHANGE_V2',
      'EXPO_PUBLIC_PROOF_DRAWER',
      'EXPO_PUBLIC_VOICE_ENTRIES',
      'EXPO_PUBLIC_TIMESTAMP_REBUTTALS',
      'EXPO_PUBLIC_ONE_TIME_PLAYBACK',
      'EXPO_PUBLIC_MOVE_MARKS',
      'EXPO_PUBLIC_DERIVED_SIGNALS',
      'EXPO_PUBLIC_QUOTE_FORGE',
      'EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS',
    ]);
  });
});

describe('featureFlags — default OFF', () => {
  it.each(FLAG_CASES)('$key returns false when unset and shim empty (default OFF)', ({ accessor }) => {
    expect(accessor()).toBe(false);
  });

  const OFF_VALUES = ['', 'false', '1', 'TRUE', 'True', ' true ', 'yes', 'enabled'];

  for (const { key, envName, accessor } of FLAG_CASES) {
    it.each(OFF_VALUES)(`${key} returns false for non-"true" value %p (via process.env)`, (value) => {
      process.env[envName] = value;
      expect(accessor()).toBe(false);
    });
  }
});

describe('featureFlags — exact "true" enables (via process.env static read)', () => {
  // Set the exact env key by its literal name so the production static-read path
  // is exercised. Each block sets ONE literal key so the read under test matches
  // the static dot access in the source.
  it('EXPO_PUBLIC_HOME_V2 === "true" enables home_v2', () => {
    process.env.EXPO_PUBLIC_HOME_V2 = 'true';
    expect(isHomeV2Enabled()).toBe(true);
  });
  it('EXPO_PUBLIC_ROOM_EXCHANGE_V2 === "true" enables room_exchange_v2', () => {
    process.env.EXPO_PUBLIC_ROOM_EXCHANGE_V2 = 'true';
    expect(isRoomExchangeV2Enabled()).toBe(true);
  });
  it('EXPO_PUBLIC_PROOF_DRAWER === "true" enables proof_drawer', () => {
    process.env.EXPO_PUBLIC_PROOF_DRAWER = 'true';
    expect(isProofDrawerEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_VOICE_ENTRIES === "true" enables voice_entries', () => {
    process.env.EXPO_PUBLIC_VOICE_ENTRIES = 'true';
    expect(isVoiceEntriesEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_TIMESTAMP_REBUTTALS === "true" enables timestamp_rebuttals', () => {
    process.env.EXPO_PUBLIC_TIMESTAMP_REBUTTALS = 'true';
    expect(isTimestampRebuttalsEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_ONE_TIME_PLAYBACK === "true" enables one_time_playback', () => {
    process.env.EXPO_PUBLIC_ONE_TIME_PLAYBACK = 'true';
    expect(isOneTimePlaybackEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_MOVE_MARKS === "true" enables move_marks', () => {
    process.env.EXPO_PUBLIC_MOVE_MARKS = 'true';
    expect(isMoveMarksEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_DERIVED_SIGNALS === "true" enables derived_signals', () => {
    process.env.EXPO_PUBLIC_DERIVED_SIGNALS = 'true';
    expect(isDerivedSignalsEnabled()).toBe(true);
  });
  it('EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS === "true" enables feedback_flag_intents', () => {
    process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS = 'true';
    expect(isFeedbackFlagIntentsEnabled()).toBe(true);
  });
});

describe('featureFlags — runtime-env shim override', () => {
  it.each(FLAG_CASES)('$key: shim "true" enables with process.env unset', ({ envName, accessor }) => {
    mockReadRuntimeEnv.mockReturnValue({ [envName]: 'true' });
    delete process.env[envName];
    expect(accessor()).toBe(true);
  });

  it.each(FLAG_CASES)(
    '$key: shim "true" wins over process.env "false"',
    ({ envName, accessor }) => {
      mockReadRuntimeEnv.mockReturnValue({ [envName]: 'true' });
      process.env[envName] = 'false';
      expect(accessor()).toBe(true);
    },
  );

  it.each(FLAG_CASES)(
    '$key: shim missing the key falls back to process.env',
    ({ envName, accessor }) => {
      mockReadRuntimeEnv.mockReturnValue({ SOMETHING_ELSE: 'x' });
      process.env[envName] = 'true';
      expect(accessor()).toBe(true);
    },
  );

  it.each(FLAG_CASES)(
    '$key: shim non-string value never coerces to enabled (falls back to process.env)',
    ({ envName, accessor }) => {
      mockReadRuntimeEnv.mockReturnValue({ [envName]: true });
      delete process.env[envName];
      expect(accessor()).toBe(false);
    },
  );
});

describe('featureFlags — flag independence (no cross-talk)', () => {
  function readAll(): Record<AspFeatureFlag, boolean> {
    return {
      home_v2: isHomeV2Enabled(),
      room_exchange_v2: isRoomExchangeV2Enabled(),
      proof_drawer: isProofDrawerEnabled(),
      voice_entries: isVoiceEntriesEnabled(),
      timestamp_rebuttals: isTimestampRebuttalsEnabled(),
      one_time_playback: isOneTimePlaybackEnabled(),
      move_marks: isMoveMarksEnabled(),
      derived_signals: isDerivedSignalsEnabled(),
      quote_forge: isQuoteForgeEnabled(),
      feedback_flag_intents: isFeedbackFlagIntentsEnabled(),
    };
  }

  it('setting one flag ON via process.env leaves the other nine OFF', () => {
    process.env.EXPO_PUBLIC_HOME_V2 = 'true';
    const all = readAll();
    expect(all).toEqual({
      home_v2: true,
      room_exchange_v2: false,
      proof_drawer: false,
      voice_entries: false,
      timestamp_rebuttals: false,
      one_time_playback: false,
      move_marks: false,
      derived_signals: false,
      quote_forge: false,
      feedback_flag_intents: false,
    });
  });

  it('setting a different single flag ON via the shim leaves the other nine OFF', () => {
    mockReadRuntimeEnv.mockReturnValue({ [MOVE_MARKS_FLAG]: 'true' });
    const all = readAll();
    expect(all).toEqual({
      home_v2: false,
      room_exchange_v2: false,
      proof_drawer: false,
      voice_entries: false,
      timestamp_rebuttals: false,
      one_time_playback: false,
      move_marks: true,
      derived_signals: false,
      quote_forge: false,
      feedback_flag_intents: false,
    });
  });
});

describe('featureFlags — registry + dispatcher', () => {
  it('resolveAspFeatureFlag agrees with the direct accessor when OFF', () => {
    expect(resolveAspFeatureFlag('home_v2')).toBe(isHomeV2Enabled());
    expect(resolveAspFeatureFlag('home_v2')).toBe(false);
  });

  it('resolveAspFeatureFlag agrees with the direct accessor when ON', () => {
    process.env.EXPO_PUBLIC_HOME_V2 = 'true';
    expect(resolveAspFeatureFlag('home_v2')).toBe(true);
    expect(resolveAspFeatureFlag('home_v2')).toBe(isHomeV2Enabled());
  });

  it('ASP_FEATURE_FLAGS has exactly the ten expected keys', () => {
    expect(Object.keys(ASP_FEATURE_FLAGS).sort()).toEqual(
      [
        'derived_signals',
        'feedback_flag_intents',
        'home_v2',
        'move_marks',
        'one_time_playback',
        'proof_drawer',
        'quote_forge',
        'room_exchange_v2',
        'timestamp_rebuttals',
        'voice_entries',
      ].sort(),
    );
  });

  it('each descriptor carries the correct key + envName literal', () => {
    for (const { key, envName } of FLAG_CASES) {
      expect(ASP_FEATURE_FLAGS[key].key).toBe(key);
      expect(ASP_FEATURE_FLAGS[key].envName).toBe(envName);
    }
  });

  it('the registry object is frozen', () => {
    expect(Object.isFrozen(ASP_FEATURE_FLAGS)).toBe(true);
  });
});
