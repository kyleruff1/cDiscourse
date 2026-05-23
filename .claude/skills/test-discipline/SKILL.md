---
name: test-discipline
description: Testing discipline for CDiscourse — where tests live, what counts as required coverage, how to structure tests for pure models vs UI vs Edge Functions. Invoke for every roadmap card; tests are part of "done", not a follow-up.
---

# Test discipline — CDiscourse

## The rule

If you wrote production code in a roadmap card and didn't write tests, the card is not done. Tests are part of the deliverable, not a follow-up.

## Where tests live

```
__tests__/                                      # top-level test suites
  <feature>.test.ts                             # most feature tests
  <subsystem>/<scenario>.test.ts                # deeper scenarios
src/__tests__/constitution/                     # rules-engine tests (kept separate for branch-coverage focus)
```

Conventions:
- Test file name mirrors the source: `argumentScoreModel.ts` → `__tests__/argumentScoreModel.test.ts` (or co-located).
- Pure-model tests: import the model directly, no React, no Supabase, no fetch.
- UI tests: use React Testing Library patterns from existing test files. Run on the JSDOM environment.
- Fixtures: under `fixtures/` or inline `const fixture = { ... }`. Do not check in raw JSONL from bot runs.

## Required coverage

| Surface | Required | How verified |
| --- | --- | --- |
| `src/lib/constitution/engine.ts` | 100% branch on transition matrix | `npm run test -- --coverage` + manual sanity |
| Pure-TS models in `src/features/<x>/<x>Model.ts` | Each public function has unit tests, including failure cases | Tests fail if a public function has no test |
| Game-copy plain-language mapping | Every code in the union type has a mapping | Ban-list test: no internal code appears in a UI snapshot |
| Doctrine constraints | A ban-list test that scans rendered strings for "winner / loser / liar / true / false / etc." | `__tests__/*.test.ts` — pattern of existing safety tests |
| Edge Functions | Happy path + auth-refused path + invalid-input path | Local `supabase functions serve` + integration tests where possible |

## What "passing tests" means

- `npm run test` exits 0
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- No new `console.log` in committed code
- No `.skip` / `.only` / `xit` / `xdescribe` left in
- Test count goes UP, never down, when adding a card (unless a card explicitly removes tests with a documented reason)

## Test count tracking

The current test count is the source of truth for stage completion. As of Stage 6.4: **1805 tests / 70 suites**.

When you finish a card:
- Run `npm run test` and capture the new count.
- Update `docs/core/current-status.md` only AFTER the count is confirmed.
- The number in CLAUDE.md "Current stage" line is the canonical baseline — bump it on stage completion, not per card.

## Patterns that already work in this repo

### Pure-model test

```ts
// __tests__/myModel.test.ts
import { computeThing } from '../src/features/foo/myModel';

describe('computeThing', () => {
  it('returns expected value for the happy path', () => {
    expect(computeThing({ a: 1, b: 2 })).toEqual({ result: 3 });
  });

  it('returns null for an invalid input shape', () => {
    expect(computeThing(null as any)).toBeNull();
  });
});
```

### Ban-list test (doctrine safety)

```ts
// __tests__/noTruthLabels.test.ts
import { renderTimelineLabels } from '../src/features/arguments/argumentGameSurfaceModel';

const BANNED = ['winner', 'loser', 'liar', 'true', 'false', 'correct', 'dishonest', 'bad faith'];

it('never emits truth labels in timeline strings', () => {
  const labels = renderTimelineLabels(fullFixture);
  for (const label of labels) {
    for (const b of BANNED) {
      expect(label.toLowerCase()).not.toContain(b);
    }
  }
});
```

### Plain-language mapping coverage

```ts
import { toPlainLanguage, ALL_INTERNAL_CODES } from '../src/features/arguments/gameCopy';

it('maps every internal code to plain language', () => {
  for (const code of ALL_INTERNAL_CODES) {
    expect(toPlainLanguage(code)).not.toMatch(/_/); // no snake_case leak
    expect(toPlainLanguage(code).length).toBeGreaterThan(0);
  }
});
```

## Anti-patterns to refuse

- "I'll add the test in a follow-up" → NO. Add it now or don't claim the card is done.
- "I mocked the Supabase client to make the test pass" → Only if the test is genuinely about client behavior. If it's about RLS or migration shape, use a real Supabase test harness.
- "I'll skip these tests because they're flaky" → Diagnose the flake first. Skipped tests are debt.
- "100% coverage on a new model isn't realistic" → It is for pure-TS models. The engine has it. Match the bar.

## How to verify before claiming done

```powershell
npm run typecheck
npm run lint
npm run test
git status   # confirm no .skip / .only / committed console.log
```

Then update `docs/core/current-status.md` with the new count + a one-line note about what changed.
