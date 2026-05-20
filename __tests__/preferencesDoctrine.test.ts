/**
 * PR-001 — doctrine ban-list + safety source-scan for the "My
 * preferences" feature.
 *
 * The card touches user-facing strings and ships a self-service popout,
 * so the mandatory doctrine assertions are:
 *   - no verdict / truth tokens leak into copy;
 *   - no internal codes (snake_case) leak into UI labels;
 *   - no role-escalation surface — the popout never binds a
 *     role / admin / moderator field to a control;
 *   - no secrets / hidden auth fields;
 *   - the preferences module never imports a score / engine /
 *     validation module — a preference can never reach a gate.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import {
  COLOR_MODE_COPY,
  CONTACT_EMAIL_COPY,
  DENSITY_COPY,
  DISPLAY_NAME_COPY,
  NOTIFICATIONS_COPY,
  PREFERENCES_COPY,
  REDUCE_MOTION_COPY,
  ROOM_ENTRY_COPY,
  SIDE_LABEL_COPY,
} from '../src/features/preferences/preferencesCopy';

const SRC = join(__dirname, '..', 'src', 'features', 'preferences');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * Strip block + line comments. The doctrine rules say a forbidden
 * token in a COMMENT is acceptable (the design's doctrine section uses
 * these very tokens to explain what is forbidden) — only a token in
 * executable code is a violation. So the code-scan tests run against
 * the comment-stripped source.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const POPOUT = read('PreferencesPopout.tsx');
const ROW = read('PreferenceRow.tsx');
const COPY = read('preferencesCopy.ts');
const MODEL = read('userPreferencesModel.ts');
const STORAGE = read('preferencesStorage.ts');
const HOOK = read('useUserPreferences.ts');
const AVATAR = read('GeneratedAvatar.tsx');

const POPOUT_CODE = stripComments(POPOUT);
const ROW_CODE = stripComments(ROW);
const COPY_CODE = stripComments(COPY);
const MODEL_CODE = stripComments(MODEL);
const STORAGE_CODE = stripComments(STORAGE);
const HOOK_CODE = stripComments(HOOK);
const AVATAR_CODE = stripComments(AVATAR);

const allCopyStrings = (): string[] => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  [
    PREFERENCES_COPY,
    DISPLAY_NAME_COPY,
    CONTACT_EMAIL_COPY,
    NOTIFICATIONS_COPY,
    ROOM_ENTRY_COPY,
    DENSITY_COPY,
    COLOR_MODE_COPY,
    REDUCE_MOTION_COPY,
    SIDE_LABEL_COPY,
  ].forEach(walk);
  return out;
};

const allOptionLabels = (): string[] => [
  ...Object.values(ROOM_ENTRY_COPY.options),
  ...Object.values(DENSITY_COPY.options),
  ...Object.values(COLOR_MODE_COPY.options),
  ...Object.values(REDUCE_MOTION_COPY.options),
  ...Object.values(SIDE_LABEL_COPY.options),
];

// ── Verdict / truth ban-list ────────────────────────────────────

describe('verdict / truth ban-list', () => {
  // Whole-word matching so "preferences" does not trip "true" etc. The
  // tokens that genuinely must never appear in cosmetic-preference copy.
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'verdict',
  ];
  const BANNED_WORDS = ['correct', 'incorrect', 'true', 'false', 'right', 'wrong'];

  it('no banned verdict phrase appears in preferences copy', () => {
    for (const s of allCopyStrings()) {
      const lower = s.toLowerCase();
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
      for (const w of BANNED_WORDS) {
        expect(lower).not.toMatch(new RegExp(`\\b${w}\\b`));
      }
    }
  });
});

// ── No internal codes leak ──────────────────────────────────────

describe('no internal codes leak into UI labels', () => {
  it('every option label is human prose, not a snake_case code', () => {
    for (const label of allOptionLabels()) {
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });

  it('the popout never renders a raw enum value as user text', () => {
    // The enum values themselves (high_contrast, for_against …) must
    // only appear as object keys / option `value=` props, never as
    // visible `<Text>` content.
    for (const code of ['high_contrast', 'for_against', 'side_a_b', 'last_used']) {
      // Allowed inside `value` props / keys, not inside a Text body.
      expect(POPOUT).not.toMatch(new RegExp(`<Text[^>]*>\\s*${code}\\s*<`));
    }
  });
});

// ── No role-escalation surface ──────────────────────────────────

describe('no role-escalation surface', () => {
  const ROLE_TOKENS = [
    'is_admin',
    'is_moderator_or_admin',
    'service_role',
    'profiles.role',
  ];

  it('no role / admin / moderation identifier appears in popout/row code', () => {
    for (const tok of ROLE_TOKENS) {
      expect(POPOUT_CODE).not.toContain(tok);
      expect(ROW_CODE).not.toContain(tok);
      expect(COPY_CODE).not.toContain(tok);
      expect(MODEL_CODE).not.toContain(tok);
    }
  });

  it('no control is bound to a role / admin / moderator field', () => {
    // A control bound to one of these would look like `onValueChange`
    // / `onPress` / `value=` adjacent to the token. Scan each code line
    // (comments stripped — a comment mentioning "role" is acceptable).
    const lines = POPOUT_CODE.split('\n');
    for (const line of lines) {
      const bindsControl =
        /onValueChange|onPress|onChangeText|onChange=|value=/.test(line);
      if (bindsControl) {
        expect(line.toLowerCase()).not.toMatch(/\brole\b/);
        expect(line.toLowerCase()).not.toMatch(/\badmin\b/);
        expect(line.toLowerCase()).not.toMatch(/\bmoderator\b/);
      }
    }
  });

  it('the preference blob shape carries no role field', () => {
    // The UserPreferences interface must not declare a role key.
    expect(MODEL_CODE).not.toMatch(/\brole\s*:/);
  });
});

// ── No secrets / hidden auth ────────────────────────────────────

describe('no secrets / hidden auth fields', () => {
  const SECRET_TOKENS = [
    'SERVICE_ROLE',
    'ANTHROPIC_API_KEY',
    'Bearer',
    'password',
  ];

  it('the preferences module code contains no secret or auth tokens', () => {
    for (const f of [
      POPOUT_CODE,
      ROW_CODE,
      COPY_CODE,
      MODEL_CODE,
      STORAGE_CODE,
      HOOK_CODE,
      AVATAR_CODE,
    ]) {
      for (const tok of SECRET_TOKENS) {
        expect(f).not.toContain(tok);
      }
    }
  });

  it('the popout has no secure / password TextInput', () => {
    // No `secureTextEntry` prop anywhere — the popout never captures a
    // password or auth secret.
    expect(POPOUT).not.toMatch(/secureTextEntry/i);
  });
});

// ── No score / engine / validation import ───────────────────────

describe('preferences never reach a scoring or gate path', () => {
  const FORBIDDEN_IMPORTS = [
    'constitution/engine',
    'argumentScoreModel',
    'pointStanding',
    'antiAmplification',
    'evaluateArgumentDraft',
    'clientValidation',
  ];

  /** All `import ... from '...'` specifier strings in a source file. */
  const importSpecifiers = (src: string): string[] => {
    const specs: string[] = [];
    const re = /import[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) specs.push(m[1]);
    return specs;
  };

  const assertNoForbiddenImport = (src: string) => {
    for (const spec of importSpecifiers(src)) {
      for (const mod of FORBIDDEN_IMPORTS) {
        expect(spec).not.toContain(mod);
      }
    }
  };

  it('userPreferencesModel.ts imports no score / engine / validation module', () => {
    assertNoForbiddenImport(MODEL);
  });

  it('PreferencesPopout.tsx imports no score / engine / validation module', () => {
    assertNoForbiddenImport(POPOUT);
  });

  it('the storage + hook modules import no score / engine / validation module', () => {
    assertNoForbiddenImport(STORAGE);
    assertNoForbiddenImport(HOOK);
  });
});

// ── PreferencesPopout source-scan ───────────────────────────────

describe('PreferencesPopout source-scan', () => {
  const FIELD_TEST_IDS = [
    'preferences-popout',
    'preferences-close',
    'pref-field-display-name',
    'pref-field-avatar',
    'pref-field-contact-email',
    'pref-field-notifications',
    'pref-field-default-room-entry',
    'pref-field-density',
    'pref-field-color-mode',
    'pref-field-reduce-motion',
    'pref-field-default-side-label',
  ];

  it('renders all nine field testIDs plus the popout chrome', () => {
    for (const id of FIELD_TEST_IDS) {
      expect(POPOUT).toContain(id);
    }
  });

  it('the close button exists with a button role', () => {
    expect(POPOUT).toMatch(/testID="preferences-close"/);
    expect(POPOUT).toMatch(/accessibilityRole="button"/);
  });

  it('the Modal animationType is conditioned on reduce motion', () => {
    expect(POPOUT).toMatch(/animationType=\{[^}]*effectiveReduceMotion/);
  });

  it('the contact email is read-only — no email TextInput', () => {
    // The only TextInput in the popout is the display-name input.
    const inputs = POPOUT.match(/<TextInput/g) ?? [];
    expect(inputs.length).toBe(1);
    expect(POPOUT).toMatch(/testID="pref-display-name-input"/);
    // The contact email renders as Text, not an editable field.
    expect(POPOUT).toMatch(/testID="pref-contact-email-value"/);
  });
});

// ── PreferenceRow accessibility source-scan ─────────────────────

describe('PreferenceRow accessibility', () => {
  it('the segmented control options use radio inside a radiogroup', () => {
    expect(ROW).toContain('accessibilityRole="radiogroup"');
    expect(ROW).toContain('accessibilityRole="radio"');
  });

  it('the toggle row switch uses the switch role', () => {
    expect(ROW).toContain('accessibilityRole="switch"');
  });

  it('every Pressable / Switch in the row primitives has an accessibility role', () => {
    const interactiveLines = ROW.split('\n').filter(
      (l) => l.includes('<Pressable') || l.includes('<Switch'),
    );
    // Each interactive element block carries an accessibilityRole
    // somewhere — assert the file has at least as many roles as
    // interactive elements.
    const roleCount = (ROW.match(/accessibilityRole=/g) ?? []).length;
    expect(roleCount).toBeGreaterThanOrEqual(interactiveLines.length);
  });
});
