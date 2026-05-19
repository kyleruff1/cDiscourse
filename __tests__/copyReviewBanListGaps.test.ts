/**
 * COPY-001 — Ban-list gap regression tests.
 *
 * The COPY-001 audit (docs/copy-review/plain-language-labels-pass-1.md §8)
 * identified three verdict-flavored adjacency tokens — `right`, `wrong`,
 * `validated` — that should be in `_forbiddenLifecycleTokens()` and
 * `_forbiddenMetadataTokens()` so future label drift in those directions
 * is caught by the existing per-label scan in
 * `pointLifecyclePlainLabels.test.ts` + `metadataPlainLabels.test.ts`.
 *
 * The token `hot` is deliberately NOT added — doctrine §2 carves out
 * "hot = activity" as a legitimate usage in `GALLERY_SECTIONS`
 * ("Hot rooms…", "Hot but unresolved"). The audit §5.1 + §8 names this
 * exclusion explicitly. This test pins the carve-out as an invariant so
 * a future PR cannot quietly add `hot` to either ban-list without
 * surfacing this rationale.
 *
 * The audit confirmed zero current labels in `PLAIN_LANGUAGE_COPY` trip
 * the three new tokens; the per-label scans below re-prove that with the
 * expanded ban-list.
 */

import {
  ALL_POINT_LIFECYCLE_STATES,
  _forbiddenLifecycleTokens,
  getPointLifecyclePlainLabel,
} from '../src/features/lifecycle';
import {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  _forbiddenMetadataTokens,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
} from '../src/features/metadata';

describe('COPY-001 ban-list gap hardening', () => {
  it('lifecycle ban-list contains the three new gap tokens', () => {
    const tokens = _forbiddenLifecycleTokens();
    expect(tokens).toContain('right');
    expect(tokens).toContain('wrong');
    expect(tokens).toContain('validated');
  });

  it('metadata ban-list contains the three new gap tokens', () => {
    const tokens = _forbiddenMetadataTokens();
    expect(tokens).toContain('right');
    expect(tokens).toContain('wrong');
    expect(tokens).toContain('validated');
  });

  it('lifecycle ban-list does NOT contain `hot` (doctrine §2 carve-out)', () => {
    // `hot` is a permitted activity word in `GALLERY_SECTIONS`. The audit
    // §5.1 + §8 records the carve-out; this assertion makes it a test
    // invariant so a future drift surfaces here before merging.
    expect(_forbiddenLifecycleTokens()).not.toContain('hot');
  });

  it('metadata ban-list does NOT contain `hot` (doctrine §2 carve-out)', () => {
    expect(_forbiddenMetadataTokens()).not.toContain('hot');
  });

  it('every lifecycle label still scans clean against the expanded ban-list', () => {
    const tokens = _forbiddenLifecycleTokens();
    for (const state of ALL_POINT_LIFECYCLE_STATES) {
      const lc = getPointLifecyclePlainLabel(state).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('every manual-tag label still scans clean against the expanded ban-list', () => {
    const tokens = _forbiddenMetadataTokens();
    for (const code of ALL_MANUAL_TAG_CODES) {
      const lc = getManualTagPlainLabel(code).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('every auto-metadata label still scans clean against the expanded ban-list', () => {
    const tokens = _forbiddenMetadataTokens();
    for (const code of ALL_AUTO_METADATA_CODES) {
      const lc = getAutoMetadataPlainLabel(code).toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });
});
