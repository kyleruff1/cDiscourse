/**
 * PR-002 — the named "tag-vocabulary safety test".
 *
 * Doctrine-load-bearing. The closed, curated tag vocabulary is the
 * mechanism that makes the card's DISALLOWED list enforceable. Because
 * the vocabulary is a fixed, code-checked array — and there is NO
 * free-text tag entry anywhere in PR-002 — this test can exhaustively
 * assert that EVERY shipped tag is safe.
 *
 * It scans every label AND every id in `PROFILE_TAG_VOCABULARY` for:
 *   - protected-class targeting,
 *   - party affiliation,
 *   - unverified "expert" / credential claims,
 *   - hostile labels,
 *   - ideology / personality scoring tokens,
 * and asserts the structural invariants (28 tags, 4 categories, unique
 * id shape, plain-language labels) plus the closed-vocabulary guarantee
 * (no `TextInput` in the popout or chip).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import {
  ALL_PROFILE_TAG_CATEGORIES,
  PROFILE_TAG_VOCABULARY,
} from '../src/features/profileTags/profileTagVocabulary';

const SRC = join(__dirname, '..', 'src', 'features', 'profileTags');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/** Every searchable token from the vocabulary: ids + labels, lower-cased. */
const VOCAB_TOKENS: string[] = PROFILE_TAG_VOCABULARY.flatMap((t) => [
  t.id.toLowerCase(),
  t.label.toLowerCase(),
]);

/** Assert none of `banned` appears as a substring of any vocabulary token. */
const expectNoneOf = (banned: string[]) => {
  for (const token of VOCAB_TOKENS) {
    for (const b of banned) {
      expect(token).not.toContain(b);
    }
  }
};

/** Assert none of `banned` appears as a WHOLE WORD in any vocabulary token. */
const expectNoWholeWord = (banned: string[]) => {
  for (const token of VOCAB_TOKENS) {
    for (const b of banned) {
      expect(token).not.toMatch(new RegExp(`\\b${b}\\b`));
    }
  }
};

// ── No protected-class targeting ────────────────────────────────

describe('vocabulary has no protected-class targeting', () => {
  it('no race / religion / gender / disability-as-label / nationality token', () => {
    expectNoneOf([
      'race',
      'racial',
      'religion',
      'religious',
      'christian',
      'muslim',
      'jewish',
      'hindu',
      'buddhist',
      'atheist',
      'gender',
      'transgender',
      'nationality',
      'ethnic',
      'ethnicity',
      'pregnan',
      'veteran',
      'immigrant',
      'disability',
      'disabled',
      'blind',
      'deaf',
      'autistic',
      'autism',
    ]);
  });

  it('no sex / sexual-orientation token', () => {
    expectNoWholeWord(['sex', 'sexual', 'orientation', 'gay', 'lesbian', 'queer']);
  });

  it('no age-as-protected-category token', () => {
    expectNoWholeWord(['age', 'elderly', 'minor']);
  });
});

// ── No party affiliation ────────────────────────────────────────

describe('vocabulary has no party / partisan affiliation', () => {
  it('no party-affiliation token appears', () => {
    expectNoneOf([
      'republican',
      'democrat',
      'conservative',
      'libertarian',
      'socialist',
      'communist',
      'fascist',
      'maga',
      'progressive',
      'left-wing',
      'right-wing',
    ]);
  });

  it('no "party" / "vote for" token appears', () => {
    expectNoWholeWord(['party', 'liberal']);
    for (const token of VOCAB_TOKENS) {
      expect(token).not.toContain('vote for');
    }
  });
});

// ── No unverified "expert" claim ────────────────────────────────

describe('vocabulary has no unverified expert / credential claim', () => {
  it('no expert / credential token appears', () => {
    expectNoneOf([
      'expert',
      'verified',
      'certified',
      'professional',
      'phd',
      'doctorate',
      'authority',
      'credential',
      'licensed',
    ]);
  });

  it('no whole-word "doctor" token appears', () => {
    expectNoWholeWord(['doctor']);
  });
});

// ── No hostile labels ───────────────────────────────────────────

describe('vocabulary has no hostile labels', () => {
  it('no hostile-label token appears', () => {
    expectNoneOf([
      'troll',
      'bot',
      'liar',
      'idiot',
      'stupid',
      'bad faith',
      'propagandist',
      'extremist',
      'manipulative',
      'dishonest',
      'shill',
      'astroturfer',
    ]);
  });
});

// ── No ideology / personality scoring ───────────────────────────

describe('vocabulary has no ideology / personality scoring', () => {
  it('no verdict / score token appears', () => {
    expectNoneOf([
      'winner',
      'loser',
      'incorrect',
      'aggressive',
      'ruthless',
      'always right',
      'never wrong',
      'dominant',
      'superior',
      'dumb',
    ]);
  });

  it('no whole-word verdict token (correct / right / wrong / true / false / smart)', () => {
    expectNoWholeWord(['correct', 'right', 'wrong', 'true', 'false', 'smart']);
  });
});

// ── Structural assertions ───────────────────────────────────────

describe('vocabulary structure', () => {
  it('ships exactly 28 tags', () => {
    expect(PROFILE_TAG_VOCABULARY).toHaveLength(28);
  });

  it('ships exactly 4 categories', () => {
    expect(ALL_PROFILE_TAG_CATEGORIES).toHaveLength(4);
  });

  it('every tag belongs to one of the 4 declared categories', () => {
    for (const t of PROFILE_TAG_VOCABULARY) {
      expect(ALL_PROFILE_TAG_CATEGORIES).toContain(t.category);
    }
  });

  it('every category has at least one tag', () => {
    for (const category of ALL_PROFILE_TAG_CATEGORIES) {
      const has = PROFILE_TAG_VOCABULARY.some((t) => t.category === category);
      expect(has).toBe(true);
    }
  });

  it('all tag ids are unique', () => {
    const ids = PROFILE_TAG_VOCABULARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every id matches /^[a-z][a-z0-9_]*$/', () => {
    for (const t of PROFILE_TAG_VOCABULARY) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('every label is a non-empty string', () => {
    for (const t of PROFILE_TAG_VOCABULARY) {
      expect(typeof t.label).toBe('string');
      expect(t.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('no label is a snake_case internal code', () => {
    for (const t of PROFILE_TAG_VOCABULARY) {
      expect(looksLikeInternalCode(t.label)).toBe(false);
    }
  });

  it('the vocabulary array is frozen', () => {
    expect(Object.isFrozen(PROFILE_TAG_VOCABULARY)).toBe(true);
  });
});

// ── Closed-vocabulary assertion ─────────────────────────────────

describe('the vocabulary is closed — no free-text tag entry', () => {
  it('ProfileTagPopout.tsx contains no TextInput', () => {
    expect(read('ProfileTagPopout.tsx')).not.toMatch(/TextInput/);
  });

  it('ProfileTagChip.tsx contains no TextInput', () => {
    expect(read('ProfileTagChip.tsx')).not.toMatch(/TextInput/);
  });

  it('no "custom" / "other" free-text escape hatch exists in the popout', () => {
    // A free-text escape hatch would surface as an editable field; the
    // closed-vocabulary doctrine forbids one. The TextInput checks above
    // are the structural guarantee; this is a belt-and-braces scan.
    const popout = read('ProfileTagPopout.tsx');
    expect(popout).not.toMatch(/onChangeText/);
  });
});
