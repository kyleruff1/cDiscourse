/**
 * CORPUS-QUEUE-SMOKE-TAG-001 — queue smoke-tag prefix for the adversarial
 * corpus runner.
 *
 * The runner can opt-in to prefix every debate title it creates with the
 * Edge routing contract literal `[arch-001-queue-smoke]`, so the ARCH-001
 * queue-routing predicate's `title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)`
 * branch recognizes the room and a queue-routed corpus smoke can be run by
 * tag instead of by percentage.
 *
 * Doctrine boundary (asserted by construction, not by this suite arming
 * anything): this card only changes the synthetic-corpus debate TITLE in a
 * dev script. It never arms routing, never reads
 * CLASSIFIER_QUEUE_ROUTING_ENABLED, and never changes whether a post is
 * accepted. The deterministic rules engine remains the sole acceptance
 * gate; classifiers run after an argument is stored.
 *
 * These tests cover:
 *  1. flag-on → titles from BOTH builders startsWith the tag.
 *  2. flag-off (default) → no title carries the tag; byte-equal to the
 *     pre-change golden construction.
 *  3. drift guard — runner literal === the Edge contract literal.
 *  4. a prefixed title satisfies the predicate's startsWith check.
 *  5. env-fallback (CORPUS_SMOKE_TAG=true) enables; both-unset does not.
 *  6. override (--queue-smoke-tag) matches the Edge contract exactly.
 *  7. tag-outside-slice — the claim is capped at 80 chars; the tag is not
 *     truncated.
 */

import * as fs from 'fs';
import * as path from 'path';

interface SmokeTagArgs {
  smokeTag?: boolean;
  queueSmokeTag?: string | null;
}
interface ParsedArgs extends SmokeTagArgs {
  [key: string]: unknown;
}
interface RoomTitleInput {
  prefix: string;
  claim: string;
  runTag: string;
  threadIndex: number;
}
interface RunnerModule {
  CORPUS_SMOKE_TAG_DEFAULT: string;
  resolveSmokeTagPrefix: (args: SmokeTagArgs, env?: Record<string, string | undefined>) => string;
  buildRoomTitle: (input: RoomTitleInput) => string;
  parseArgs: (argv: string[]) => ParsedArgs;
}

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus') as RunnerModule;

const { CORPUS_SMOKE_TAG_DEFAULT, resolveSmokeTagPrefix, buildRoomTitle, parseArgs } = runner;

// The Edge contract literal, replicated here so the drift guard compares
// the runner's copy against an independent source of truth. Pinned to
// supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:51.
const EDGE_CONTRACT_TAG = '[arch-001-queue-smoke]';

// A claim longer than 80 chars to prove the slice budget applies to the
// claim only (and the tag is never truncated).
const LONG_CLAIM =
  'Cars dominate the street and a bike lane would change the safety calculus dramatically over many years';
const RUN_TAG = 'corpus-dev-synthetic-2026-06-04-abcd1234';
const THREAD_INDEX = 3;

// Reconstruct the pre-change title EXACTLY the old way (claim.slice(0,80) +
// ` [runTag tNN]`, no prefix) so the default-off path can be proven
// byte-identical.
function goldenLegacyTitle(claim: string, runTag: string, threadIndex: number): string {
  return `${(claim || '').slice(0, 80)} [${runTag} t${String(threadIndex).padStart(2, '0')}]`;
}

describe('CORPUS-QUEUE-SMOKE-TAG-001 — runner exports', () => {
  it('exports the resolver, the titling helper, and the literal', () => {
    expect(typeof resolveSmokeTagPrefix).toBe('function');
    expect(typeof buildRoomTitle).toBe('function');
    expect(typeof CORPUS_SMOKE_TAG_DEFAULT).toBe('string');
  });

  it('drift guard: runner literal === the Edge contract literal', () => {
    // If someone edits the runner literal and forgets the Edge side (or
    // vice versa), the startsWith predicate would silently stop matching.
    expect(CORPUS_SMOKE_TAG_DEFAULT).toBe(EDGE_CONTRACT_TAG);
  });

  it('drift guard: the Edge file actually declares this exact literal', () => {
    // Read the const out of the Edge file so the contract literal in this
    // test cannot drift from the deployed predicate either.
    const edgePath = path.join(
      process.cwd(),
      'supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts',
    );
    const src = fs.readFileSync(edgePath, 'utf8');
    const m = src.match(/CLASSIFIER_QUEUE_SMOKE_TAG\s*=\s*'([^']+)'/);
    expect(m).not.toBeNull();
    expect(m && m[1]).toBe(CORPUS_SMOKE_TAG_DEFAULT);
  });
});

describe('CORPUS-QUEUE-SMOKE-TAG-001 — resolveSmokeTagPrefix', () => {
  it('returns empty string when disabled (default off, no flag, no env)', () => {
    expect(resolveSmokeTagPrefix({ smokeTag: false }, {})).toBe('');
    expect(resolveSmokeTagPrefix(parseArgs(['node', 'runner']), {})).toBe('');
  });

  it('returns "<tag> " (literal + single trailing space) when flag enabled', () => {
    expect(resolveSmokeTagPrefix({ smokeTag: true }, {})).toBe(`${EDGE_CONTRACT_TAG} `);
  });

  it('env opt-in CORPUS_SMOKE_TAG=true enables the prefix without the CLI flag', () => {
    expect(resolveSmokeTagPrefix({ smokeTag: false }, { CORPUS_SMOKE_TAG: 'true' })).toBe(
      `${EDGE_CONTRACT_TAG} `,
    );
    // Case-insensitive truthiness; non-"true" values do NOT enable.
    expect(resolveSmokeTagPrefix({ smokeTag: false }, { CORPUS_SMOKE_TAG: 'TRUE' })).toBe(
      `${EDGE_CONTRACT_TAG} `,
    );
    expect(resolveSmokeTagPrefix({ smokeTag: false }, { CORPUS_SMOKE_TAG: '1' })).toBe('');
    expect(resolveSmokeTagPrefix({ smokeTag: false }, { CORPUS_SMOKE_TAG: 'false' })).toBe('');
  });

  it('both flag and env unset → not applied', () => {
    expect(resolveSmokeTagPrefix({ smokeTag: false }, { CORPUS_SMOKE_TAG: '' })).toBe('');
  });

  it('CLI override (--queue-smoke-tag) sets the literal exactly and implies enable', () => {
    const args = parseArgs(['node', 'runner', '--queue-smoke-tag', EDGE_CONTRACT_TAG]);
    expect(args.smokeTag).toBe(true);
    expect(args.queueSmokeTag).toBe(EDGE_CONTRACT_TAG);
    expect(resolveSmokeTagPrefix(args, {})).toBe(`${EDGE_CONTRACT_TAG} `);
  });

  it('CLI override literal precedence beats env literal', () => {
    const prefix = resolveSmokeTagPrefix(
      { smokeTag: true, queueSmokeTag: EDGE_CONTRACT_TAG },
      { CLASSIFIER_QUEUE_SMOKE_TAG: '[some-other-tag]' },
    );
    expect(prefix).toBe(`${EDGE_CONTRACT_TAG} `);
  });

  it('env CLASSIFIER_QUEUE_SMOKE_TAG overrides the literal when enabled and no CLI override', () => {
    const prefix = resolveSmokeTagPrefix(
      { smokeTag: true },
      { CLASSIFIER_QUEUE_SMOKE_TAG: '[arch-001-queue-smoke]' },
    );
    expect(prefix).toBe(`${EDGE_CONTRACT_TAG} `);
  });

  it('does NOT read CLASSIFIER_QUEUE_ROUTING_ENABLED (arming routing is operator-only)', () => {
    // Even if the routing-enable env is set, the runner must not treat it
    // as a smoke-tag enable signal.
    expect(
      resolveSmokeTagPrefix({ smokeTag: false }, { CLASSIFIER_QUEUE_ROUTING_ENABLED: 'true' }),
    ).toBe('');
  });
});

describe('CORPUS-QUEUE-SMOKE-TAG-001 — buildRoomTitle (both live sites use this)', () => {
  it('flag-on: legacy-shape title startsWith the contract tag', () => {
    const prefix = resolveSmokeTagPrefix({ smokeTag: true }, {});
    const title = buildRoomTitle({ prefix, claim: LONG_CLAIM, runTag: RUN_TAG, threadIndex: THREAD_INDEX });
    expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(true);
  });

  it('flag-on: banked-shape title startsWith the contract tag', () => {
    // The banked site differs only in the claim source; the helper is the
    // same. Use a distinct claim to prove both call paths behave.
    const prefix = resolveSmokeTagPrefix({ smokeTag: true }, {});
    const title = buildRoomTitle({
      prefix,
      claim: 'A different banked seed claim summary that is also fairly long for the slice test budget',
      runTag: RUN_TAG,
      threadIndex: 7,
    });
    expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(true);
  });

  it('flag-off (default): legacy-shape title is byte-identical to the pre-change golden string', () => {
    const prefix = resolveSmokeTagPrefix({ smokeTag: false }, {});
    const title = buildRoomTitle({ prefix, claim: LONG_CLAIM, runTag: RUN_TAG, threadIndex: THREAD_INDEX });
    expect(title).toBe(goldenLegacyTitle(LONG_CLAIM, RUN_TAG, THREAD_INDEX));
    expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(false);
  });

  it('flag-off (default): banked-shape title is byte-identical to the pre-change golden string', () => {
    const bankedClaim = 'Banked seed claim summary string';
    const prefix = resolveSmokeTagPrefix({ smokeTag: false }, {});
    const title = buildRoomTitle({ prefix, claim: bankedClaim, runTag: RUN_TAG, threadIndex: 1 });
    expect(title).toBe(goldenLegacyTitle(bankedClaim, RUN_TAG, 1));
    expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(false);
  });

  it('a prefixed title satisfies the predicate startsWith(smokeTag) check', () => {
    // Replicate the Edge predicate's prefix match exactly.
    const prefix = resolveSmokeTagPrefix({ smokeTag: true }, {});
    const title = buildRoomTitle({ prefix, claim: LONG_CLAIM, runTag: RUN_TAG, threadIndex: 0 });
    // This is the literal check from classifierQueueRouting.ts:174.
    expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(true);
  });

  it('tag is OUTSIDE the slice(0,80): the claim portion is capped at 80 chars and the tag is not truncated', () => {
    const prefix = resolveSmokeTagPrefix({ smokeTag: true }, {});
    const title = buildRoomTitle({ prefix, claim: LONG_CLAIM, runTag: RUN_TAG, threadIndex: 0 });
    // Tag at position 0, untruncated.
    expect(title.startsWith(`${EDGE_CONTRACT_TAG} `)).toBe(true);
    // The claim portion (between the tag-prefix and the ` [runTag` suffix)
    // is the first 80 chars of the claim only.
    const afterPrefix = title.slice(`${EDGE_CONTRACT_TAG} `.length);
    const claimPortion = afterPrefix.slice(0, afterPrefix.indexOf(` [${RUN_TAG}`));
    expect(claimPortion).toBe(LONG_CLAIM.slice(0, 80));
    expect(claimPortion.length).toBe(80);
  });

  it('flag-on vs flag-off differ ONLY by the leading tag-prefix (no other byte changes)', () => {
    const offTitle = buildRoomTitle({
      prefix: resolveSmokeTagPrefix({ smokeTag: false }, {}),
      claim: LONG_CLAIM,
      runTag: RUN_TAG,
      threadIndex: THREAD_INDEX,
    });
    const onTitle = buildRoomTitle({
      prefix: resolveSmokeTagPrefix({ smokeTag: true }, {}),
      claim: LONG_CLAIM,
      runTag: RUN_TAG,
      threadIndex: THREAD_INDEX,
    });
    expect(onTitle).toBe(`${EDGE_CONTRACT_TAG} ${offTitle}`);
  });
});
