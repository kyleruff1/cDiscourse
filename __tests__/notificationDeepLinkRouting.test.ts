/**
 * QOL-040.3 — App.tsx hand-off routing helper tests.
 *
 * `buildDeepLinkEntryHint(link)` converts a `NotificationDeepLink` (from
 * QOL-040's `resolveDeepLink`) into the optional `GalleryEntryHint` the
 * App.tsx callback threads into `setEntryHint`. The room shell then
 * reads `entryHint.entryHintForArgumentId` first and falls back to the
 * existing `activate` policy if the id is not in the loaded slice.
 *
 * Pure-TS; no React, no Supabase, no network.
 *
 * Coverage:
 *  1. Routing helper × 2 (link with id → hint with id + suppressed
 *     banner; link without id → null).
 *  2. Ban-list scan × 1 (the helper's source file is clean).
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildDeepLinkEntryHint } from '../src/features/debates/deepLinkEntryHint';
import type { NotificationDeepLink } from '../src/features/notifications';

describe('QOL-040.3 buildDeepLinkEntryHint', () => {
  it('link with activeArgumentId → returns a hint with entryHintForArgumentId set and empty verbPhrase (banner suppressed)', () => {
    const link: NotificationDeepLink = {
      debateId: 'd-1',
      activeArgumentId: 'a-7',
    };
    const hint = buildDeepLinkEntryHint(link);
    expect(hint).not.toBeNull();
    if (!hint) throw new Error('expected non-null hint');
    expect(hint.entryHintForArgumentId).toBe('a-7');
    // The notification path must not surface the micro-moment banner.
    // ArgumentGameSurface gates the banner on `entryHint?.verbPhrase`
    // being truthy; an empty string is falsy → no render.
    expect(hint.verbPhrase).toBe('');
    expect(hint.helperLine).toBe('');
    // Safe fallback: the room shell's `initialActiveId` only consults
    // `activate` when the hinted id is absent from the loaded slice.
    expect(hint.activate).toBe('latest');
    // Neutral code; the banner is suppressed regardless.
    expect(hint.code).toBe('watch_first');
    expect(hint.presetKey).toBeNull();
    expect(hint.dockAction).toBeNull();
  });

  it('link with null activeArgumentId → returns null (App.tsx caller passes null to setEntryHint)', () => {
    const link: NotificationDeepLink = {
      debateId: 'd-1',
      activeArgumentId: null,
    };
    expect(buildDeepLinkEntryHint(link)).toBeNull();
  });

  it('link with empty-string activeArgumentId → returns null (defensive — null and "" are both no-target)', () => {
    // `resolveDeepLink` produces `null`, not `""`, but the helper guards
    // against either to keep the room consumer's lookup branch off the
    // hot path when there is no real target.
    const link = {
      debateId: 'd-1',
      activeArgumentId: '',
    } as NotificationDeepLink;
    expect(buildDeepLinkEntryHint(link)).toBeNull();
  });
});

// ── 2. Source-file scan ──────────────────────────────────────

describe('QOL-040.3 buildDeepLinkEntryHint source-file safety', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/debates/deepLinkEntryHint.ts'),
    'utf8',
  );

  it('the helper does not import React, Supabase, or any network library', () => {
    // Pure-TS — no React hooks, no Supabase client, no fetch.
    expect(SRC).not.toMatch(/from\s+['"]react['"]/);
    expect(SRC).not.toMatch(/from\s+['"]react-native['"]/);
    expect(SRC).not.toMatch(/@supabase\/supabase-js/);
    expect(SRC).not.toMatch(/\bfetch\s*\(/);
    expect(SRC).not.toMatch(/\bXMLHttpRequest\b/);
  });

  it('the helper does not call any AI provider', () => {
    expect(SRC).not.toMatch(/\banthropic\b/i);
    expect(SRC).not.toMatch(/\bxai\b/i);
    expect(SRC).not.toMatch(/\bopenai\b/i);
  });

  it('the helper source contains no verdict / popularity / amplification / person-attribution tokens', () => {
    const VERDICT_TOKENS = [
      'winner', 'loser', 'correct', 'incorrect', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'propagandist',
      'troll', 'astroturfer', 'stupid', 'idiot',
    ];
    const POPULARITY_TOKENS = [
      'likes', 'retweets', 'shares', 'views', 'followers', 'trending',
      'virality', 'viral',
    ];
    const PERSON_ATTRIBUTION_TOKENS = [
      'this person', 'this user', 'the user is', 'the author is',
    ];
    const lower = SRC.toLowerCase();
    for (const token of VERDICT_TOKENS) {
      expect(lower).not.toContain(token);
    }
    for (const token of POPULARITY_TOKENS) {
      expect(lower).not.toContain(token);
    }
    for (const token of PERSON_ATTRIBUTION_TOKENS) {
      expect(lower).not.toContain(token);
    }
  });

  it('the helper never reads system time or randomness (pure & deterministic)', () => {
    expect(SRC).not.toMatch(/Math\.random/);
    expect(SRC).not.toMatch(/Date\.now/);
  });
});
