/**
 * IX-001 — doctrine ban-list over every authored string.
 *
 * A density mode and a focus lens are view state only. No authored string
 * may imply truth, winning, losing, correctness, or popularity-as-evidence
 * (cdiscourse-doctrine §1/§2/§3, timeline-grammar). No internal snake_case
 * code may reach a user-facing string (doctrine §9). This suite enforces
 * all of it over `FOCUS_LENS_COPY` and the density spec vocabulary.
 *
 * The verdict / amplification vocabulary is the repo's CANONICAL list
 * (`_forbiddenLifecycleTokens` from LIFE-001) so IX-001's authored copy is
 * held to exactly the same substring bar as the lifecycle labels — and
 * stays future-proof if that list grows.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  ALL_FOCUS_LENSES,
  ALL_GALLERY_DENSITY_MODES,
  FOCUS_LENS_COPY,
  GALLERY_DENSITY_SPECS,
} from '../src/features/arguments/timelineDensityLensModel';
import { _forbiddenLifecycleTokens } from '../src/features/lifecycle';

/**
 * Strip block and line comments so a scan for a code-shape identifier is
 * not tripped by a doctrine comment that legitimately NAMES the forbidden
 * thing — "excludes view / retweet / follower counts" is a doc, not a read.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const MODEL_CODE = stripComments(
  fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'arguments', 'timelineDensityLensModel.ts'),
    'utf8',
  ),
);

/**
 * Every authored string IX-001 introduces — lens label, helper, empty
 * note. These are the only user-facing strings the card owns.
 */
const AUTHORED_LENS_STRINGS: string[] = ALL_FOCUS_LENSES.flatMap((lens) => {
  const copy = FOCUS_LENS_COPY[lens];
  return [copy.label, copy.helper, copy.emptyNote];
});

/**
 * Density spec enum tokens. They carry no free-text label, only the enum
 * values — scanned anyway so a future spec field cannot smuggle a verdict.
 */
const DENSITY_SPEC_TOKENS: string[] = ALL_GALLERY_DENSITY_MODES.flatMap((mode) => {
  const spec = GALLERY_DENSITY_SPECS[mode];
  return [spec.mode, spec.signalChips, spec.rhythm];
});

/**
 * The repo's canonical forbidden vocabulary. `hot` is deliberately NOT in
 * this list — doctrine §2 carves out a legitimate "hot = activity" usage,
 * which is exactly what the `hot` lens is.
 */
const FORBIDDEN = _forbiddenLifecycleTokens().map((t) => t.toLowerCase());

describe('IX-001 doctrine ban-list — authored strings', () => {
  it('no lens label / helper / empty note contains a forbidden token', () => {
    for (const str of AUTHORED_LENS_STRINGS) {
      const lower = str.toLowerCase();
      for (const banned of FORBIDDEN) {
        expect(lower.includes(banned)).toBe(false);
      }
    }
  });

  it('no density spec token contains a forbidden token', () => {
    for (const token of DENSITY_SPEC_TOKENS) {
      const lower = token.toLowerCase();
      for (const banned of FORBIDDEN) {
        expect(lower.includes(banned)).toBe(false);
      }
    }
  });
});

describe('IX-001 doctrine — heat is activity, never correctness', () => {
  it('the hot lens helper carries an explicit activity disclaimer', () => {
    const helper = FOCUS_LENS_COPY.hot.helper.toLowerCase();
    // Names activity and explicitly denies that it is a result/verdict.
    expect(helper).toContain('activity');
    expect(helper).toContain('not a result');
  });

  it('the heating_up lens helper carries an explicit momentum disclaimer', () => {
    const helper = FOCUS_LENS_COPY.heating_up.helper.toLowerCase();
    expect(helper).toContain('momentum');
    expect(helper).toContain('not a result');
  });

  it('the hot / heating_up labels themselves stay verdict-free', () => {
    for (const lens of ['hot', 'heating_up'] as const) {
      const label = FOCUS_LENS_COPY[lens].label.toLowerCase();
      for (const banned of FORBIDDEN) {
        expect(label.includes(banned)).toBe(false);
      }
    }
  });
});

describe('IX-001 doctrine — popularity is not evidence', () => {
  it('the model file contains no popularity-shaped identifier', () => {
    // No view / like / retweet / follower / vote / share-count input.
    // `view` would false-positive on "preview"/"viewer", so the *-count
    // and engagement-metric identifier shapes are scanned instead.
    const POPULARITY_IDENTIFIERS = [
      /\bviewCount\b/,
      /\blikeCount\b/,
      /\bretweet/i,
      /\bfollowerCount\b/,
      /\bvoteCount\b/,
      /\bshareCount\b/,
      /\bengagementVelocity\b/,
      /\bviralityScore\b/,
    ];
    for (const re of POPULARITY_IDENTIFIERS) {
      expect(re.test(MODEL_CODE)).toBe(false);
    }
  });
});

describe('IX-001 doctrine — no internal codes in user-facing copy', () => {
  it('no lens label / helper / empty note contains an underscore-cased token', () => {
    // An internal code like `source_chain` or `point_lifecycle_state` has an
    // underscore between word characters. Authored copy never does.
    for (const str of AUTHORED_LENS_STRINGS) {
      expect(/[a-z]_[a-z]/i.test(str)).toBe(false);
    }
  });
});

describe('IX-001 doctrine — union literals carry no truth-laden token', () => {
  it('no FocusLensId literal is a verdict word', () => {
    // The ids are internal codes (snake_case allowed) but must not be
    // truth/verdict words.
    for (const lens of ALL_FOCUS_LENSES) {
      for (const banned of ['winner', 'loser', 'correct', 'truth', 'liar']) {
        expect(lens).not.toContain(banned);
      }
    }
  });

  it('no GalleryDensityMode literal is a verdict word', () => {
    for (const mode of ALL_GALLERY_DENSITY_MODES) {
      for (const banned of ['winner', 'loser', 'correct', 'truth']) {
        expect(mode).not.toContain(banned);
      }
    }
  });
});
