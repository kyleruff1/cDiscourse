/**
 * RULE-003 — Tests for the lifecycle / manual-tag / auto-metadata UX
 * doctrine map.
 *
 * The map is a render-ready surface for SC-003 (cluster headers),
 * ST-002 (suggested-move chips), GAL-002 (gallery cards), and IX-002
 * (keyboard hint surface). RULE-003 ships labels + helper lines +
 * icon hints + advisory dock actions for every code in the three
 * vocabularies, and these tests pin doctrine guarantees:
 *
 *   - Coverage:    every vocabulary member has a map entry; no extras.
 *   - Parity:      label === plain-language helper for the code (no
 *                  freshly authored labels in this file).
 *   - Ban-lists:   no verdict / amplification / engagement tokens leak
 *                  into label or helperLine, scanned via the shared
 *                  `_forbiddenLifecycleTokens()` and
 *                  `_forbiddenMetadataTokens()` helpers.
 *   - Snake_case:  no helperLine contains an underscored identifier.
 *   - Attribution: no helperLine attributes a move to a specific
 *                  person ("you", "the author", "they", etc.).
 *   - Heat:        no helperLine uses heat / popularity vocabulary.
 *                  The `GALLERY_SECTIONS` doctrine carveout for `hot`
 *                  does NOT extend to helper lines.
 *   - Length:      helperLine ≤ 80 chars (one-line a11y / tooltip).
 *   - Icons:       no verdict glyph (`checkmark`, `crown`, `flame`,
 *                  `thumbs_up`, etc.) leaked into `ALL_ICON_HINTS`.
 *   - Actions:     every `allowedDockActions[]` value is a member of
 *                  SC-004's union; `expand_branch`, `mark_moved_on`,
 *                  `mark_ignored` are intentionally never recommended.
 *   - Readers:     `getLifecycleUx` / `getManualTagUx` /
 *                  `getAutoMetadataUx` are reference-equal to the
 *                  frozen map entry.
 *   - Cross-map:   codes shared by the lifecycle and auto-metadata
 *                  vocabularies (`synthesis_ready`, `quote_requested`,
 *                  `source_requested`) reuse the same plain-language
 *                  label.
 */

import {
  ALL_POINT_LIFECYCLE_STATES,
  getPointLifecyclePlainLabel,
  _forbiddenLifecycleTokens,
} from '../src/features/lifecycle';
import {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
  _forbiddenMetadataTokens,
} from '../src/features/metadata';
import {
  ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  LIFECYCLE_UX_MAP,
  MANUAL_TAG_UX_MAP,
  AUTO_METADATA_UX_MAP,
  ALL_ICON_HINTS,
  getLifecycleUx,
  getManualTagUx,
  getAutoMetadataUx,
  type IconHint,
  type DockAction,
} from '../src/features/rulesUx/lifecycleUxMap';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Shared helpers ────────────────────────────────────────────

function collectHelperLines(): string[] {
  const out: string[] = [];
  for (const code of ALL_POINT_LIFECYCLE_STATES) out.push(LIFECYCLE_UX_MAP[code].helperLine);
  for (const code of ALL_MANUAL_TAG_CODES) out.push(MANUAL_TAG_UX_MAP[code].helperLine);
  for (const code of ALL_AUTO_METADATA_CODES) out.push(AUTO_METADATA_UX_MAP[code].helperLine);
  return out;
}

function collectLabels(): string[] {
  const out: string[] = [];
  for (const code of ALL_POINT_LIFECYCLE_STATES) out.push(LIFECYCLE_UX_MAP[code].label);
  for (const code of ALL_MANUAL_TAG_CODES) out.push(MANUAL_TAG_UX_MAP[code].label);
  for (const code of ALL_AUTO_METADATA_CODES) out.push(AUTO_METADATA_UX_MAP[code].label);
  return out;
}

// ── Coverage ──────────────────────────────────────────────────

describe('LIFECYCLE_UX_MAP — coverage', () => {
  test('every PointLifecycleState in ALL_POINT_LIFECYCLE_STATES has an entry', () => {
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      const entry = LIFECYCLE_UX_MAP[code];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(code);
    }
  });

  test('has no extra keys beyond ALL_POINT_LIFECYCLE_STATES', () => {
    const keys = Object.keys(LIFECYCLE_UX_MAP).sort();
    const vocab = [...ALL_POINT_LIFECYCLE_STATES].sort();
    expect(keys).toEqual(vocab);
  });
});

describe('MANUAL_TAG_UX_MAP — coverage', () => {
  test('every ManualTagCode in ALL_MANUAL_TAG_CODES has an entry', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      const entry = MANUAL_TAG_UX_MAP[code];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(code);
    }
  });

  test('has no extra keys beyond ALL_MANUAL_TAG_CODES', () => {
    const keys = Object.keys(MANUAL_TAG_UX_MAP).sort();
    const vocab = [...ALL_MANUAL_TAG_CODES].sort();
    expect(keys).toEqual(vocab);
  });
});

describe('AUTO_METADATA_UX_MAP — coverage', () => {
  test('every AutoMetadataCode in ALL_AUTO_METADATA_CODES has an entry', () => {
    for (const code of ALL_AUTO_METADATA_CODES) {
      const entry = AUTO_METADATA_UX_MAP[code];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(code);
    }
  });

  test('has no extra keys beyond ALL_AUTO_METADATA_CODES', () => {
    const keys = Object.keys(AUTO_METADATA_UX_MAP).sort();
    const vocab = [...ALL_AUTO_METADATA_CODES].sort();
    expect(keys).toEqual(vocab);
  });
});

// ── Label parity (anti-drift) ─────────────────────────────────

describe('label parity — no freshly authored labels', () => {
  test('every LIFECYCLE_UX_MAP[code].label === getPointLifecyclePlainLabel(code)', () => {
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      expect(LIFECYCLE_UX_MAP[code].label).toBe(getPointLifecyclePlainLabel(code));
    }
  });

  test('every MANUAL_TAG_UX_MAP[code].label === getManualTagPlainLabel(code)', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(MANUAL_TAG_UX_MAP[code].label).toBe(getManualTagPlainLabel(code));
    }
  });

  test('every AUTO_METADATA_UX_MAP[code].label === getAutoMetadataPlainLabel(code)', () => {
    for (const code of ALL_AUTO_METADATA_CODES) {
      expect(AUTO_METADATA_UX_MAP[code].label).toBe(getAutoMetadataPlainLabel(code));
    }
  });
});

// ── Ban-list assertions (doctrine) ────────────────────────────

describe('ban-list — verdict / amplification tokens', () => {
  // Helper lines are full sentences (unlike the short labels in
  // `pointLifecyclePlainLabels.test.ts`), so we scan with word
  // boundaries. Without `\b`, `'bot'` would false-match `'both'`,
  // `'true'` would false-match `'construed'`, etc. — none of which
  // are doctrine violations.
  function escapeForRegex(token: string): string {
    return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function containsToken(haystack: string, token: string): boolean {
    const t = token.trim().toLowerCase();
    if (t.length === 0) return false;
    if (t.includes(' ')) {
      // Multi-word tokens like "bad faith" — match as literal phrase.
      return haystack.includes(t);
    }
    const re = new RegExp(`\\b${escapeForRegex(t)}\\b`, 'i');
    return re.test(haystack);
  }

  test('every helperLine passes _forbiddenLifecycleTokens()', () => {
    const banned = _forbiddenLifecycleTokens();
    for (const line of collectHelperLines()) {
      const lower = line.toLowerCase();
      for (const token of banned) {
        expect(containsToken(lower, token)).toBe(false);
      }
    }
  });

  test('every helperLine passes _forbiddenMetadataTokens()', () => {
    const banned = _forbiddenMetadataTokens();
    for (const line of collectHelperLines()) {
      const lower = line.toLowerCase();
      for (const token of banned) {
        expect(containsToken(lower, token)).toBe(false);
      }
    }
  });

  test('every label passes both ban-lists', () => {
    const combined = [..._forbiddenLifecycleTokens(), ..._forbiddenMetadataTokens()];
    for (const label of collectLabels()) {
      const lower = label.toLowerCase();
      for (const token of combined) {
        expect(containsToken(lower, token)).toBe(false);
      }
    }
  });
});

// ── Snake_case / internal-code scan ──────────────────────────

describe('snake_case / internal code leakage', () => {
  test('no helperLine contains a snake_case identifier shape', () => {
    const snakeShape = /[a-z]+_[a-z]+/;
    for (const line of collectHelperLines()) {
      expect(snakeShape.test(line)).toBe(false);
    }
  });

  test('no helperLine returns true from looksLikeInternalCode', () => {
    for (const line of collectHelperLines()) {
      expect(looksLikeInternalCode(line)).toBe(false);
    }
  });
});

// ── Person-attribution scan ───────────────────────────────────

describe('person attribution', () => {
  test('no helperLine attributes the move to a specific person', () => {
    // Token list per design edge case #7. Lowercased + word-boundary
    // literal `.includes()` scan. "Affirmative" / "Negative" are
    // SIDE labels, not person attribution, and are intentionally OK.
    const banned = [
      'you ',
      ' your ',
      ' they ',
      ' their ',
      ' he ',
      ' she ',
      'the user',
      'the author',
      'the poster',
    ];
    for (const line of collectHelperLines()) {
      const lower = ` ${line.toLowerCase()} `;
      for (const token of banned) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

// ── Heat / popularity / engagement scan ──────────────────────

describe('heat / popularity / engagement tokens', () => {
  test('no helperLine contains heat / popularity / engagement vocabulary', () => {
    // Doctrine §2 carves out `hot` ONLY in `GALLERY_SECTIONS`.
    // RULE-003 helper lines do NOT get that carveout — a helper that
    // says "hot" implies correctness, not activity. See design edge
    // case #8.
    const banned = ['hot', 'viral', 'popular', 'trending', 'engagement'];
    for (const line of collectHelperLines()) {
      const lower = line.toLowerCase();
      for (const token of banned) {
        expect(lower).not.toContain(token);
      }
    }
  });
});

// ── Length cap ────────────────────────────────────────────────

describe('helperLine length cap', () => {
  test('every helperLine is ≤ 80 chars', () => {
    for (const line of collectHelperLines()) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });
});

// ── Icon hint validation ─────────────────────────────────────

describe('iconHint validation', () => {
  test('every iconHint across the three maps is a member of ALL_ICON_HINTS', () => {
    const set = new Set<IconHint>(ALL_ICON_HINTS);
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      expect(set.has(LIFECYCLE_UX_MAP[code].iconHint)).toBe(true);
    }
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(set.has(MANUAL_TAG_UX_MAP[code].iconHint)).toBe(true);
    }
    for (const code of ALL_AUTO_METADATA_CODES) {
      expect(set.has(AUTO_METADATA_UX_MAP[code].iconHint)).toBe(true);
    }
  });

  test('ALL_ICON_HINTS contains no verdict glyph names', () => {
    const banned = [
      'checkmark',
      'check',
      'x_mark',
      'cross',
      'crown',
      'trophy',
      'flame',
      'thumbs_up',
      'thumbs_down',
      'shield',
      'warning',
      'star',
      'medal',
      'gavel',
    ];
    for (const hint of ALL_ICON_HINTS) {
      for (const banned_glyph of banned) {
        expect(hint).not.toBe(banned_glyph);
      }
    }
  });
});

// ── Allowed-action cross-check (lifecycle only) ──────────────

describe('allowedDockActions cross-check', () => {
  test('every entry is a member of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES', () => {
    const set = new Set<DockAction>(ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES);
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      for (const action of LIFECYCLE_UX_MAP[code].allowedDockActions) {
        expect(set.has(action)).toBe(true);
      }
    }
  });

  test('does NOT include expand_branch, mark_moved_on, or mark_ignored', () => {
    const forbidden = new Set<DockAction>(['expand_branch', 'mark_moved_on', 'mark_ignored']);
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      for (const action of LIFECYCLE_UX_MAP[code].allowedDockActions) {
        expect(forbidden.has(action)).toBe(false);
      }
    }
  });

  test('at least one lifecycle state has allowedDockActions: [] (terminal)', () => {
    const empties = ALL_POINT_LIFECYCLE_STATES.filter(
      code => LIFECYCLE_UX_MAP[code].allowedDockActions.length === 0,
    );
    expect(empties.length).toBeGreaterThanOrEqual(1);
    expect(empties).toContain('archived_or_resolved');
  });

  test('at least one lifecycle state has allowedDockActions.length ≥ 3', () => {
    const big = ALL_POINT_LIFECYCLE_STATES.filter(
      code => LIFECYCLE_UX_MAP[code].allowedDockActions.length >= 3,
    );
    expect(big.length).toBeGreaterThanOrEqual(1);
  });

  test('no allowedDockActions[] contains a duplicate code', () => {
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      const actions = LIFECYCLE_UX_MAP[code].allowedDockActions;
      const uniq = new Set(actions);
      expect(uniq.size).toBe(actions.length);
    }
  });
});

// ── Reader contract ──────────────────────────────────────────

describe('readers — Object.is reference equality', () => {
  test('getLifecycleUx returns the exact frozen entry', () => {
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      expect(Object.is(getLifecycleUx(code), LIFECYCLE_UX_MAP[code])).toBe(true);
    }
  });

  test('getManualTagUx returns the exact frozen entry', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(Object.is(getManualTagUx(code), MANUAL_TAG_UX_MAP[code])).toBe(true);
    }
  });

  test('getAutoMetadataUx returns the exact frozen entry', () => {
    for (const code of ALL_AUTO_METADATA_CODES) {
      expect(Object.is(getAutoMetadataUx(code), AUTO_METADATA_UX_MAP[code])).toBe(true);
    }
  });
});

// ── Cross-map sanity ─────────────────────────────────────────

describe('cross-map label reuse (COPY-001 audit §4.5)', () => {
  // `quote_requested` and `source_requested` appear in BOTH the
  // lifecycle and auto-metadata vocabularies. Both layers pass
  // through `PLAIN_LANGUAGE_COPY[code]`, so the LABEL must match
  // exactly across the two maps even though the HELPER line
  // legitimately differs (cluster-scope vs move-scope phrasing).
  //
  // Note: the design text in §"Cross-map sanity" also listed
  // `synthesis_ready`, but that code is a lifecycle state only —
  // the auto-metadata counterpart is `synthesis_candidate`
  // (different observation, different icon, different helper).
  // The test verifies the codes that ARE truly shared.
  test('shared codes (quote_requested / source_requested) produce identical labels in both maps', () => {
    const shared: Array<'quote_requested' | 'source_requested'> = [
      'quote_requested',
      'source_requested',
    ];
    for (const code of shared) {
      expect(LIFECYCLE_UX_MAP[code].label).toBe(AUTO_METADATA_UX_MAP[code].label);
    }
  });
});

// ── Freeze ───────────────────────────────────────────────────

describe('frozen at module load', () => {
  test('LIFECYCLE_UX_MAP entries are frozen', () => {
    for (const code of ALL_POINT_LIFECYCLE_STATES) {
      expect(Object.isFrozen(LIFECYCLE_UX_MAP[code])).toBe(true);
    }
    expect(Object.isFrozen(LIFECYCLE_UX_MAP)).toBe(true);
  });

  test('MANUAL_TAG_UX_MAP entries are frozen', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(Object.isFrozen(MANUAL_TAG_UX_MAP[code])).toBe(true);
    }
    expect(Object.isFrozen(MANUAL_TAG_UX_MAP)).toBe(true);
  });

  test('AUTO_METADATA_UX_MAP entries are frozen', () => {
    for (const code of ALL_AUTO_METADATA_CODES) {
      expect(Object.isFrozen(AUTO_METADATA_UX_MAP[code])).toBe(true);
    }
    expect(Object.isFrozen(AUTO_METADATA_UX_MAP)).toBe(true);
  });
});
