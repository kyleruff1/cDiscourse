/**
 * PR-002 — doctrine ban-list + safety source-scan for the "Profile tags"
 * feature.
 *
 * The card ships a self-service popout and user-facing copy, so the
 * mandatory doctrine assertions are:
 *   - no verdict / truth tokens leak into copy;
 *   - no internal codes (snake_case) leak into UI labels;
 *   - no role-escalation surface — the popout never binds a
 *     role / admin / moderator field to a control;
 *   - no secrets / hidden auth fields;
 *   - the popout chrome / chip carry the right testIDs + accessibility
 *     attributes;
 *   - the copy plainly says tags are OPTIONAL.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import {
  chipAccessibilityLabel,
  PROFILE_TAG_CATEGORY_COPY,
  PROFILE_TAGS_POPOUT_COPY,
  PROFILE_TAGS_ROW_COPY,
} from '../src/features/profileTags/profileTagCopy';
import { PROFILE_TAG_VOCABULARY } from '../src/features/profileTags/profileTagVocabulary';

const SRC = join(__dirname, '..', 'src', 'features', 'profileTags');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * Strip block + line comments. A forbidden token in a COMMENT is
 * acceptable (the doctrine sections in source use the very tokens they
 * forbid to explain them) — only a token in executable code is a
 * violation. Mirrors `preferencesDoctrine.test.ts`.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const POPOUT = read('ProfileTagPopout.tsx');
const CHIP = read('ProfileTagChip.tsx');
const COPY = read('profileTagCopy.ts');
const MODEL = read('profileTagModel.ts');
const VOCAB = read('profileTagVocabulary.ts');
const STORAGE = read('profileTagsStorage.ts');
const HOOK = read('useProfileTags.ts');

const POPOUT_CODE = stripComments(POPOUT);
const CHIP_CODE = stripComments(CHIP);
const COPY_CODE = stripComments(COPY);
const MODEL_CODE = stripComments(MODEL);
const VOCAB_CODE = stripComments(VOCAB);
const STORAGE_CODE = stripComments(STORAGE);
const HOOK_CODE = stripComments(HOOK);

/** Every user-facing string from the copy module + the vocabulary labels. */
const allCopyStrings = (): string[] => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      // Copy functions build strings — exercise with sample args.
      try {
        const r = (v as (...a: unknown[]) => unknown)(3, 5);
        if (typeof r === 'string') out.push(r);
      } catch {
        // ignore non-string-producing helpers
      }
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  [PROFILE_TAGS_ROW_COPY, PROFILE_TAGS_POPOUT_COPY, PROFILE_TAG_CATEGORY_COPY].forEach(
    walk,
  );
  for (const t of PROFILE_TAG_VOCABULARY) out.push(t.label);
  return out;
};

// ── Verdict / truth ban-list ────────────────────────────────────

describe('verdict / truth ban-list on copy', () => {
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

  it('no banned verdict phrase appears in any profile-tag copy string', () => {
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
  it('every category header label is human prose, not a snake_case code', () => {
    for (const c of Object.values(PROFILE_TAG_CATEGORY_COPY)) {
      expect(looksLikeInternalCode(c.title)).toBe(false);
    }
  });

  it('every tag label is human prose, not a snake_case code', () => {
    for (const t of PROFILE_TAG_VOCABULARY) {
      expect(looksLikeInternalCode(t.label)).toBe(false);
    }
  });

  it('the popout never renders a raw tag id as user text', () => {
    // The tag ids (topic_climate, etc.) may appear only inside testID
    // strings / keys, never as visible <Text> content.
    for (const t of PROFILE_TAG_VOCABULARY.slice(0, 6)) {
      expect(POPOUT).not.toMatch(new RegExp(`<Text[^>]*>\\s*${t.id}\\s*<`));
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

  it('no role / admin / moderation identifier appears in the feature code', () => {
    for (const code of [POPOUT_CODE, CHIP_CODE, COPY_CODE, MODEL_CODE, VOCAB_CODE]) {
      for (const tok of ROLE_TOKENS) {
        expect(code).not.toContain(tok);
      }
    }
  });

  it('no control is bound to a role / admin / moderator field', () => {
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

  it('the profile-tag blob shape carries no role field', () => {
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
    'token',
  ];

  it('the profile-tag feature code contains no secret or auth tokens', () => {
    for (const f of [
      POPOUT_CODE,
      CHIP_CODE,
      COPY_CODE,
      MODEL_CODE,
      VOCAB_CODE,
      STORAGE_CODE,
      HOOK_CODE,
    ]) {
      for (const tok of SECRET_TOKENS) {
        expect(f).not.toContain(tok);
      }
    }
  });

  it('the popout has no secure / password TextInput', () => {
    expect(POPOUT).not.toMatch(/secureTextEntry/i);
  });
});

// ── ProfileTagPopout source-scan ────────────────────────────────

describe('ProfileTagPopout source-scan', () => {
  const CHROME_TEST_IDS = [
    'profile-tag-popout',
    'profile-tag-close',
    'profile-tag-count',
    'profile-tag-empty',
    'profile-tag-clear',
  ];

  const SECTION_TEST_IDS = [
    'profile-tag-section-${category}',
  ];

  it('renders the popout chrome testIDs', () => {
    for (const id of CHROME_TEST_IDS) {
      expect(POPOUT).toContain(id);
    }
  });

  it('renders one section per category via a templated testID', () => {
    for (const id of SECTION_TEST_IDS) {
      expect(POPOUT).toContain(id);
    }
  });

  it('renders one chip per tag via a templated testID', () => {
    expect(POPOUT).toContain('profile-tag-chip-${definition.id}');
  });

  it('the close button exists with a button role', () => {
    expect(POPOUT).toMatch(/testID="profile-tag-close"/);
    expect(POPOUT).toMatch(/accessibilityRole="button"/);
  });

  it('the Modal animationType is conditioned on reduce motion', () => {
    expect(POPOUT).toMatch(/animationType=\{[^}]*reduceMotion/);
  });

  it('every Pressable in the popout carries an accessibilityRole', () => {
    const pressables = (POPOUT.match(/<Pressable/g) ?? []).length;
    const roles = (POPOUT.match(/accessibilityRole=/g) ?? []).length;
    expect(roles).toBeGreaterThanOrEqual(pressables);
  });

  it('the count line uses a polite live region', () => {
    expect(POPOUT).toMatch(/accessibilityLiveRegion="polite"/);
  });
});

// ── ProfileTagChip accessibility scan ───────────────────────────

describe('ProfileTagChip accessibility', () => {
  it('uses the checkbox role with an accessibilityState', () => {
    expect(CHIP).toContain('accessibilityRole="checkbox"');
    expect(CHIP).toMatch(/accessibilityState=\{\{[^}]*checked/);
  });

  it('has a >= 44 minimum touch height and a hitSlop', () => {
    expect(CHIP).toMatch(/minHeight:\s*44/);
    expect(CHIP).toMatch(/hitSlop=/);
  });

  it('renders the chip label only inside a <Text> element', () => {
    // The label is a string prop on the definition — it must render
    // through <Text>, never as a raw string in a <View>.
    expect(CHIP).toMatch(/<Text[^>]*>[\s\S]*definition\.label/);
  });

  it('the selected state is carried by a glyph, not colour alone', () => {
    // A check glyph distinguishes the selected state for users who
    // cannot rely on colour (accessibility-targets).
    expect(CHIP).toMatch(/selected \? '✓'/);
  });
});

// ── chipAccessibilityLabel helper ───────────────────────────────

describe('chipAccessibilityLabel', () => {
  it('builds a descriptive selected / not-selected label', () => {
    expect(chipAccessibilityLabel('Climate & environment', 'Topic interests', true)).toBe(
      'Climate & environment, Topic interests, selected',
    );
    expect(
      chipAccessibilityLabel('Climate & environment', 'Topic interests', false),
    ).toBe('Climate & environment, Topic interests, not selected');
  });
});

// ── Optionality copy ────────────────────────────────────────────

describe('optionality copy', () => {
  it('the copy module plainly states that tags are optional', () => {
    const haystack = [
      PROFILE_TAGS_POPOUT_COPY.subtitle,
      PROFILE_TAGS_POPOUT_COPY.optionalHelper,
      PROFILE_TAGS_POPOUT_COPY.emptyState,
      PROFILE_TAGS_ROW_COPY.helper,
    ]
      .join(' ')
      .toLowerCase();
    expect(haystack).toContain('optional');
  });

  it('every exported copy string is non-empty', () => {
    for (const s of allCopyStrings()) {
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });
});
