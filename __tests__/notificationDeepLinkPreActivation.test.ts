/**
 * QOL-040.3 — Room-consumer pre-activation tests.
 *
 * `deriveInitialActiveMessageId(sorted, latestId, entryHint)` is the
 * pure-TS deriver that the ArgumentGameSurface room consumer calls
 * inside its `initialActiveId` useMemo. The room consumer adds a
 * dev-only `console.warn` side effect on the fallback case; the deriver
 * itself is silent so the tests stay deterministic and side-effect-free.
 *
 * Coverage:
 *  1. Hint present + valid id → that id is the initial active id.
 *  2. Hint absent → fallback to latestId.
 *  3. Hint references id not in `sorted` (soft-deleted / wrong-room /
 *     RLS-hidden) → fallback to the `activate` policy (which is
 *     `'latest'` on the notification path).
 *  4. Hint references id not in `sorted` AND no messages loaded yet →
 *     returns null (the empty-slice short-circuit beats every other
 *     branch).
 *  5. Existing GAL-002 paths (`activate === 'root'` /
 *     `'first_open_challenge'` / `'latest'`) still work when the new
 *     field is absent — byte-identical to today's behavior.
 *  6. Ban-list scan × 1 (the deriver source is clean).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveInitialActiveMessageId,
  type ArgumentMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { GalleryEntryHint } from '../src/features/debates/conversationGalleryModel';

function mkMsg(
  id: string,
  createdAt: string,
  argumentType: string = 'rebuttal',
): ArgumentMessageInput {
  return {
    id,
    debateId: 'd-1',
    parentId: null,
    authorId: 'u-other',
    argumentType,
    side: 'negative',
    body: `body-${id}`,
    createdAt,
  };
}

const SORTED: ArgumentMessageInput[] = [
  mkMsg('m1', '2026-05-17T01:00:00Z', 'root_claim'),
  mkMsg('m2', '2026-05-17T02:00:00Z', 'rebuttal'),
  mkMsg('m3', '2026-05-17T03:00:00Z', 'rebuttal'),
  mkMsg('m4', '2026-05-17T04:00:00Z', 'evidence'),
];

const LATEST = 'm4';

function notificationHint(id: string | undefined): GalleryEntryHint {
  // Mirrors `buildDeepLinkEntryHint(link)`: empty verbPhrase suppresses
  // the micro-moment banner; `activate: 'latest'` is the safe fallback.
  return {
    activate: 'latest',
    code: 'watch_first',
    verbPhrase: '',
    helperLine: '',
    presetKey: null,
    dockAction: null,
    entryHintForArgumentId: id,
  };
}

describe('QOL-040.3 deriveInitialActiveMessageId — hint present and valid', () => {
  it('hint pointing at messages[1] → that argument is the initial active id', () => {
    const hint = notificationHint('m2');
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m2');
  });

  it('hint pointing at the root → root id is selected', () => {
    const hint = notificationHint('m1');
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m1');
  });

  it('hint pointing at the latest message → latest id is selected (and matches latestId)', () => {
    const hint = notificationHint('m4');
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m4');
  });
});

describe('QOL-040.3 deriveInitialActiveMessageId — hint absent', () => {
  it('null entryHint → falls back to latestId', () => {
    expect(deriveInitialActiveMessageId(SORTED, LATEST, null)).toBe(LATEST);
  });

  it('undefined entryHint → falls back to latestId', () => {
    expect(deriveInitialActiveMessageId(SORTED, LATEST, undefined)).toBe(LATEST);
  });
});

describe('QOL-040.3 deriveInitialActiveMessageId — hint references missing id', () => {
  it('id not in `sorted` (soft-deleted / wrong-room / RLS-hidden) → fallback to latest per activate policy', () => {
    const hint = notificationHint('a-missing');
    // notification-path hints set `activate: 'latest'`, so the fallback
    // is the latest message id — the safe default the room consumer
    // wants when the specific move is no longer reachable.
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe(LATEST);
  });

  it('empty-string id is treated as no-hint (defensive — bypass the lookup)', () => {
    const hint = notificationHint('');
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe(LATEST);
  });

  it('hint with missing id BUT activate=root falls through to the root branch', () => {
    const hint: GalleryEntryHint = {
      activate: 'root',
      code: 'be_first_rebuttal',
      verbPhrase: 'Rebut this claim',
      helperLine: 'no rebuttals yet',
      presetKey: 'reply',
      dockAction: 'reply',
      entryHintForArgumentId: 'a-missing',
    };
    // The id miss falls through; `activate === 'root'` picks the root.
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m1');
  });
});

describe('QOL-040.3 deriveInitialActiveMessageId — empty slice', () => {
  it('hint present but `sorted` empty → returns null', () => {
    const hint = notificationHint('m2');
    expect(deriveInitialActiveMessageId([], null, hint)).toBeNull();
  });

  it('hint absent and `sorted` empty → returns null', () => {
    expect(deriveInitialActiveMessageId([], null, null)).toBeNull();
  });

  it('not-an-array sorted is treated as empty', () => {
    const hint = notificationHint('m2');
    expect(
      deriveInitialActiveMessageId(undefined as unknown as ArgumentMessageInput[], LATEST, hint),
    ).toBeNull();
  });
});

describe('QOL-040.3 deriveInitialActiveMessageId — existing GAL-002 paths unchanged', () => {
  it('activate === "root" with no entryHintForArgumentId → root id (byte-identical to pre-QOL-040.3 behaviour)', () => {
    const hint: GalleryEntryHint = {
      activate: 'root',
      code: 'be_first_rebuttal',
      verbPhrase: 'Rebut this claim',
      helperLine: 'no rebuttals yet',
      presetKey: 'reply',
      dockAction: 'reply',
    };
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m1');
  });

  it('activate === "first_open_challenge" picks the most recent challenge-style move', () => {
    const hint: GalleryEntryHint = {
      activate: 'first_open_challenge',
      code: 'ask_source',
      verbPhrase: 'Ask for a source',
      helperLine: '',
      presetKey: 'source',
      dockAction: 'ask_source',
    };
    // Most recent rebuttal / counter_rebuttal / clarification_request is m3
    // (m4 is `evidence`, not a challenge-style type).
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe('m3');
  });

  it('activate === "first_open_challenge" with no qualifying message → falls back to latestId', () => {
    const noChallenges = [
      mkMsg('m1', '2026-05-17T01:00:00Z', 'root_claim'),
      mkMsg('m2', '2026-05-17T02:00:00Z', 'evidence'),
    ];
    const hint: GalleryEntryHint = {
      activate: 'first_open_challenge',
      code: 'ask_source',
      verbPhrase: 'Ask for a source',
      helperLine: '',
      presetKey: 'source',
      dockAction: 'ask_source',
    };
    expect(deriveInitialActiveMessageId(noChallenges, 'm2', hint)).toBe('m2');
  });

  it('activate === "latest" picks latestId', () => {
    const hint: GalleryEntryHint = {
      activate: 'latest',
      code: 'watch_first',
      verbPhrase: 'Read first',
      helperLine: '',
      presetKey: null,
      dockAction: null,
    };
    expect(deriveInitialActiveMessageId(SORTED, LATEST, hint)).toBe(LATEST);
  });
});

// ── Source-file scan ─────────────────────────────────────────

describe('QOL-040.3 deriveInitialActiveMessageId — source-file safety', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/argumentGameSurfaceModel.ts'),
    'utf8',
  );

  it('the deriver is silent — no console.log / console.warn / console.error inside the function body', () => {
    // The dev-only console.warn lives in the React consumer, NOT in the
    // pure deriver. Pull the function body and assert no console call.
    const start = SRC.indexOf('export function deriveInitialActiveMessageId');
    expect(start).toBeGreaterThan(0);
    // The function ends at the matching closing brace before the next
    // top-level export. Slice a generous window and scan it.
    const window = SRC.slice(start, start + 2500);
    expect(window).not.toMatch(/console\.(log|warn|error|info|debug)/);
  });

  it('the deriver does not call any AI provider, fetch, or read time / randomness', () => {
    const start = SRC.indexOf('export function deriveInitialActiveMessageId');
    const window = SRC.slice(start, start + 2500);
    expect(window).not.toMatch(/\bfetch\s*\(/);
    expect(window).not.toMatch(/\banthropic\b/i);
    expect(window).not.toMatch(/\bxai\b/i);
    expect(window).not.toMatch(/\bopenai\b/i);
    expect(window).not.toMatch(/Math\.random/);
    expect(window).not.toMatch(/Date\.now/);
  });
});

// ── Doctrine ban-list ────────────────────────────────────────

describe('QOL-040.3 deriveInitialActiveMessageId — doctrine ban-list', () => {
  const SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/argumentGameSurfaceModel.ts'),
    'utf8',
  );

  it('the QOL-040.3 region introduces no verdict / popularity / amplification / person-attribution tokens', () => {
    // Scan ONLY the bracketed QOL-040.3 region. The model file already
    // contains a `FORBIDDEN_VERDICT_TOKENS` doctrine artifact further
    // down (which intentionally enumerates ban-list strings); we exclude
    // it by anchoring the slice to the explicit region markers added by
    // this card.
    const start = SRC.indexOf('// ── QOL-040.3 — Deep-link node pre-activation deriver');
    const end = SRC.indexOf('// ── End QOL-040.3 region');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const region = SRC.slice(start, end);

    const VERDICT_TOKENS = [
      'winner', 'loser', 'correct', 'incorrect', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'propagandist',
      'troll', 'astroturfer', 'stupid', 'idiot', 'proven', 'disproven',
    ];
    const POPULARITY_TOKENS = [
      'likes', 'retweets', 'shares', 'views', 'followers', 'trending',
      'virality', 'viral', 'popular',
    ];
    const PERSON_ATTRIBUTION_TOKENS = [
      'this person', 'this user', 'the user is', 'the author is',
    ];
    const lower = region.toLowerCase();
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
});
