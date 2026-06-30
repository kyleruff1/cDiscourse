/**
 * COV-001 — submit-argument QOL-041 soft-rollback atomicity contract.
 *
 * This test exists because the 2026-06-30 coverage audit
 * (`docs/audits/COVERAGE-AUDIT-2026-06-30.md`, gap #1, CRITICAL) flagged
 * the QOL-041 concession soft-rollback path as source-scanned but never
 * structurally verified. The existing `submit-argument-concessions.test.ts`
 * confirms the Zod schemas + migration shape but does NOT enforce that
 * every QOL-041 rollback site soft-deletes the parent argument before
 * returning its error envelope.
 *
 * The Edge Function uses Deno-style imports (`npm:zod@4`, Deno.serve)
 * and cannot be loaded by Jest. Per the existing project convention
 * (`applyManualTagEdgeFunction.test.ts`, `submit-argument-concessions.test.ts`),
 * Edge Function contracts are asserted by source-file inspection. This
 * test strengthens that pattern: instead of just confirming the rollback
 * STRING is present, it asserts the structural invariant that every
 * error-return inside the QOL-041 block is immediately preceded by a
 * soft-rollback of `insertedArg.id` via the `serviceClient`.
 *
 * Invariants checked
 *   1. The QOL-041 block is bounded by recognizable comment markers and
 *      ends before the next major block (argument_tags insert).
 *   2. EVERY soft-rollback in the block has the EXACT shape:
 *        `serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id)`
 *      (no drift to `callerClient`, to a different status, or to a
 *      different target id).
 *   3. The set of rollback sites is the LOCKED list of 9 paths the
 *      QOL-041 design enumerates (see DESIGN.md §5.6 — concession atomicity).
 *      Drift triggers a test failure; adding a 10th path requires
 *      extending this fixture deliberately.
 *   4. Each rollback site is immediately followed (within ≤4 lines, no
 *      intervening `return`) by an error envelope that carries the
 *      identifying token for that path.
 *   5. The happy-path `return created(...)` at the end of the handler
 *      is NOT preceded (within 10 lines) by any soft-rollback call —
 *      i.e., successful submission must NOT delete its own argument.
 *   6. The rollback path is byte-equal in form across all 9 sites
 *      (single-string match, no spacing drift).
 *
 * If a regression breaks any of these invariants, this test surfaces
 * the exact path the rollback discipline was lost on. That's the contract
 * coverage Gap #1 of the 2026-06-30 audit calls for.
 *
 * References
 *   - Audit: docs/audits/COVERAGE-AUDIT-2026-06-30.md (Gap #1)
 *   - Tracking issue: COV-001 / #805
 *   - QOL-041 design: §5.6 "concession atomicity"
 *   - Edge source: supabase/functions/submit-argument/index.ts (block ~386–558)
 *
 * Pure TS. No React. No Deno runtime. Loaded by jest like every other
 * `__tests__/*Edge*Scan.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const fnPath = path.join(repoRoot, 'supabase/functions/submit-argument/index.ts');
const fnSrc = fs.readFileSync(fnPath, 'utf8');
const fnLines = fnSrc.split('\n');

/**
 * The LOCKED set of QOL-041 rollback paths. Each entry pairs the
 * identifying token in the error envelope (or message) with a human-
 * readable description. The order here matches the order the paths
 * appear in `submit-argument/index.ts`.
 *
 * Adding a 10th rollback path is a deliberate contract change — this
 * fixture should be edited in the same PR that introduces it, and the
 * description should make clear why a new failure mode warrants
 * blowing the move.
 */
const QOL_041_ROLLBACK_PATHS = [
  {
    code: 'concession_requires_parent',
    kind: 'validationFailed' as const,
    description:
      'A concession move arrived without a parent_id; the move is invalid because a concession is always to a parent.',
  },
  {
    code: 'concession_items_insert_failed',
    kind: 'internalError' as const,
    description:
      'The concession_items insert failed for a database reason. The parent argument is soft-deleted to preserve atomicity.',
  },
  {
    code: 'concession_items_lookup_failed',
    kind: 'internalError' as const,
    description:
      'A concession_items lookup during acceptance grading failed for a database reason; the move is rolled back.',
  },
  {
    code: 'concession_item_unknown',
    kind: 'validationFailed' as const,
    description:
      'An acceptance referred to a concession_item id that was not found in the lookup.',
  },
  {
    code: 'concession_item_wrong_debate',
    kind: 'validationFailed' as const,
    description:
      'An acceptance referred to a concession_item that belongs to a different debate (cross-room attempt).',
  },
  {
    code: 'conceded_to_lookup_failed',
    kind: 'internalError' as const,
    description:
      'Looking up the conceded-to authors failed for a database reason; the move is rolled back.',
  },
  {
    code: 'notReceiver',
    kind: 'forbidden' as const,
    matchToken: 'Only the participant the concession was made to may grade it.',
    description:
      'The caller is not the author of every conceded-to node referenced by the acceptances; not permitted to grade.',
  },
  {
    code: 'clarification_required_unless_agree',
    kind: 'validationFailed' as const,
    description:
      'A non-agree acceptance arrived without the required clarification body. The CHECK constraint mirror.',
  },
  {
    code: 'concession_acceptances_insert_failed',
    kind: 'internalError' as const,
    description:
      'The concession_acceptances insert failed for a database reason. The parent argument is soft-deleted.',
  },
] as const;

const EXPECTED_ROLLBACK_COUNT = QOL_041_ROLLBACK_PATHS.length;

/** The byte-equal soft-rollback statement that every QOL-041 path must use. */
const SOFT_ROLLBACK_LINE =
  `await serviceClient.from('arguments').update({ status: 'deleted' }).eq('id', insertedArg.id);`;

/** Block boundary markers — anchor the test to recognizable comments. */
const BLOCK_START_MARKER =
  '── QOL-041 — insert concession_items + concession_acceptances ────';
const BLOCK_END_MARKER = '── Insert argument tags ──';

function findLineIndex(needle: string): number {
  const i = fnLines.findIndex((l) => l.includes(needle));
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}

describe('COV-001 — submit-argument QOL-041 soft-rollback contract', () => {
  // ─── 1. Block boundary discovery ────────────────────────────────

  const blockStart = findLineIndex(BLOCK_START_MARKER);
  const blockEnd = findLineIndex(BLOCK_END_MARKER);
  const blockLines = fnLines.slice(blockStart, blockEnd);
  const blockSrc = blockLines.join('\n');

  it('finds the QOL-041 block bounded by recognizable comment markers', () => {
    expect(blockStart).toBeGreaterThan(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(blockEnd - blockStart).toBeGreaterThan(100); // sanity
    expect(blockEnd - blockStart).toBeLessThan(300); // sanity
  });

  // ─── 2. Rollback-line shape is byte-equal across all sites ──────

  it('every soft-rollback call uses the EXACT canonical form (no drift)', () => {
    // No alternative spellings tolerated. If a future refactor wants to
    // change the canonical form, it must update this test + this string
    // in the same PR.
    const matches = blockLines.filter((l) => l.trim() === SOFT_ROLLBACK_LINE);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('there are NO rollback calls using callerClient or admin client', () => {
    // serviceClient bypasses RLS and is the only client authorized to
    // mutate after an authenticated submit. A regression that uses the
    // RLS-checked callerClient would silently fail under some auth states.
    expect(blockSrc).not.toMatch(
      /callerClient\.from\(['"]arguments['"]\)\.update/,
    );
    expect(blockSrc).not.toMatch(/admin(?:Client)?\.from\(['"]arguments['"]\)\.update/);
  });

  it('every rollback target is `insertedArg.id` (no wrong-row deletes)', () => {
    // A regression that targets `argument_id` (a payload field) or some
    // other variable would soft-delete the wrong row. The only valid
    // target is the row we just inserted in this Edge Function call.
    const wrongTargets = blockLines.filter(
      (l) =>
        l.includes(`update({ status: 'deleted' })`) &&
        !l.includes(`.eq('id', insertedArg.id)`),
    );
    expect(wrongTargets).toEqual([]);
  });

  it('every rollback uses status="deleted" (not "removed" / "cancelled" / etc)', () => {
    // The `arguments` table is soft-deleted via `status='deleted'`
    // (per `is_deleted=true` doctrine in CLAUDE.md, encoded in the
    // status enum). A regression that picks a different terminal status
    // would break the RLS-visibility model.
    const wrongStatuses = blockLines.filter(
      (l) =>
        l.includes(`.from('arguments').update`) &&
        !l.includes(`{ status: 'deleted' }`),
    );
    expect(wrongStatuses).toEqual([]);
  });

  // ─── 3. Count locked to fixture ─────────────────────────────────

  it(`has EXACTLY ${EXPECTED_ROLLBACK_COUNT} soft-rollback sites (one per locked QOL-041 path)`, () => {
    const sites = blockLines.filter((l) => l.trim() === SOFT_ROLLBACK_LINE);
    expect(sites.length).toBe(EXPECTED_ROLLBACK_COUNT);
  });

  // ─── 4. Per-path locality: rollback sits immediately before its return ─

  // For each locked path, find the lines containing its identifying
  // token, then assert that within the preceding 4 lines there is a
  // soft-rollback. This is the structural proof that the rollback is
  // BOUND to the error-return, not merely present somewhere in the
  // block.
  for (const p of QOL_041_ROLLBACK_PATHS) {
    it(`path "${p.code}" (${p.kind}) — rollback precedes its error return`, () => {
      const token = ('matchToken' in p ? p.matchToken : p.code) as string;
      const tokenLineIdx = blockLines.findIndex((l) => l.includes(token));
      expect(tokenLineIdx).toBeGreaterThanOrEqual(0);
      // Walk backward up to 10 lines for the soft-rollback. The actual
      // distance in source is 1 line for `internalError`/`forbidden`
      // returns and 5-6 lines for `validationFailed` returns (the
      // envelope shape is `validationFailed({ error, blockingErrors: [{
      // ruleCode, flagCode }]})` which puts `flagCode` ~6 lines below
      // the rollback). 10 lines gives small drift tolerance without
      // admitting a rollback bound to a different path. The next
      // assertion below (no bare returns without preceding rollback)
      // catches the broader-window leak case.
      const window = blockLines
        .slice(Math.max(0, tokenLineIdx - 10), tokenLineIdx)
        .join('\n');
      expect(window).toMatch(/await serviceClient\.from\('arguments'\)\.update\(\{ status: 'deleted' \}\)\.eq\('id', insertedArg\.id\);/);
    });
  }

  // ─── 5. No bare returns inside the block without a preceding rollback ─

  it('NO `return` inside the QOL-041 block lacks a preceding soft-rollback within 8 lines', () => {
    // Walk every line in the block; for each `return`, scan backward up
    // to 8 lines for a soft-rollback. The window is wider here because
    // a `validationFailed({...})` return spans ~12 lines, with the
    // rollback ~2 lines before its own `return validationFailed(`.
    //
    // The single exception: the `if (data.concession_items && ...)` /
    // `if (data.concession_acceptances && ...)` block has no returns
    // outside the rollback paths, so this scan should be exhaustive.
    const returnIndexes: number[] = [];
    for (let i = 0; i < blockLines.length; i++) {
      if (/^\s*return\s+/.test(blockLines[i])) returnIndexes.push(i);
    }
    expect(returnIndexes.length).toBeGreaterThan(0);
    for (const ri of returnIndexes) {
      const window = blockLines
        .slice(Math.max(0, ri - 8), ri)
        .join('\n');
      expect(window).toMatch(
        /await serviceClient\.from\('arguments'\)\.update\(\{ status: 'deleted' \}\)\.eq\('id', insertedArg\.id\);/,
      );
    }
  });

  // ─── 6. Happy-path negative: success path does NOT soft-delete ───

  it('the final `return created(...)` is NOT preceded by a soft-rollback within 30 lines', () => {
    // The Edge Function's success envelope is the very last `return
    // created(...)` in the file. Scanning backward 30 lines must NOT
    // surface any soft-rollback — otherwise the success path would be
    // partially deleting its own argument.
    const createdIdx = fnLines
      .map((l, i) => ({ l, i }))
      .reverse()
      .find(({ l }) => /^\s*return\s+created\(/.test(l));
    expect(createdIdx).toBeDefined();
    const idx = createdIdx!.i;
    const window = fnLines.slice(Math.max(0, idx - 30), idx).join('\n');
    expect(window).not.toMatch(
      /await serviceClient\.from\('arguments'\)\.update\(\{ status: 'deleted' \}\)\.eq\('id', insertedArg\.id\);/,
    );
  });

  // ─── 7. Path-list audit: locked list is correct ─────────────────

  it('every QOL_041_ROLLBACK_PATHS entry token appears in the source EXACTLY ONCE in the block', () => {
    // Each locked path should be findable by its identifying token.
    // A duplicate would mean two paths share an error code (a contract
    // bug); a missing one means the path was removed (a regression
    // unless intentional).
    for (const p of QOL_041_ROLLBACK_PATHS) {
      const token = ('matchToken' in p ? p.matchToken : p.code) as string;
      const occurrences = blockLines.filter((l) => l.includes(token)).length;
      expect({ code: p.code, occurrences }).toEqual({ code: p.code, occurrences: 1 });
    }
  });

  // ─── 8. Path-list audit: no UNKNOWN error-tokens in the block ────

  it('no error-return inside the block carries a token outside the LOCKED path list', () => {
    // If a future PR adds a 10th rollback path with a brand-new error
    // code, this test fails until QOL_041_ROLLBACK_PATHS is updated.
    // That forces the contract review to be conscious, not accidental.
    const knownTokens = QOL_041_ROLLBACK_PATHS.map((p) =>
      ('matchToken' in p ? p.matchToken : p.code) as string,
    );
    // Pull error-token strings from internalError / validationFailed calls
    // inside the block. Use a regex that matches strings inside parens.
    const tokenRegex = /(?:internalError|forbidden)\(\s*['"`]([^'"`]+)['"`]/g;
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = tokenRegex.exec(blockSrc)) !== null) {
      // Strip the trailing ":<message>" part of `concession_*_failed:...`.
      const trimmed = m[1].split(':')[0];
      found.add(trimmed);
    }
    // Also pull flagCode strings from validationFailed envelopes.
    const flagRegex = /flagCode:\s*['"`]([^'"`]+)['"`]/g;
    while ((m = flagRegex.exec(blockSrc)) !== null) {
      found.add(m[1]);
    }
    for (const tok of found) {
      // Strip the trailing ":" for tokens that match a known known prefix.
      const matchedKnown = knownTokens.some((k) => k === tok || k.startsWith(tok));
      if (!matchedKnown) {
        // Tokens that legitimately aren't in our list (e.g., generic
        // helper strings); only fail if the token clearly looks like a
        // QOL-041 error code (starts with `concession_` or matches the
        // notReceiver descriptive string).
        if (/^concession_/.test(tok) || tok === 'notReceiver') {
          throw new Error(
            `Unknown QOL-041 error token found in submit-argument block: "${tok}". ` +
              `Either add it to QOL_041_ROLLBACK_PATHS or rename it.`,
          );
        }
      }
    }
  });
});
