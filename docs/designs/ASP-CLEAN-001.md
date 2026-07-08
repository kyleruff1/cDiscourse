# ASP-CLEAN-001 — Retire dead DebateListScreen mount + unify reply vocabulary

**Status:** Design draft
**Epic:** ASP-000 (#826) — Argument-Surface Pivot, Phase 0 (P0 audit & cleanup)
**Release:** Milestone M-ASP-0 · PR slice 02a (`chore/clean-001-dead-mount-vocab`)
**Issue:** https://github.com/civildiscourse/cdiscourse/issues/872 (card) + https://github.com/civildiscourse/cdiscourse/issues/871 (rider — de-apostrophize ArgumentRoom.tsx comments)

> Rider note: #871 (ASP-EXTRACT-003) is folded into this slice as an in-scope third
> mechanical task because it edits comments in a file (`room/ArgumentRoom.tsx`) that the
> `uxOneOneTwoDoctrine` scanner reads with the same naive-quote-parity `STRING_RE` this card
> must stay green against. Doing it here means one branch touches the scanner-covered surface
> once. It carries zero behavior change and no production-code change beyond comment rewrites.

---

## Goal (one paragraph)

Retire two small, permanent liabilities that every later Argument-Surface-Pivot (ASP) card
keeps paying for, plus one latent-fragility rider — all pure hygiene, all zero-behavior-change,
all zero-visual-diff on default surfaces by construction. **(1)** Delete the permanently-false
dead `DebateListScreen` mount block in `App.tsx` (`{false && …}`) plus its now-unused named
import — the block can never render, so every `App.tsx` reader and every doctrine scanner pays
for a component that is unreachable through this path. **(2)** Unify the primary reply-verb set
at the `gameCopy` `MOVE_COPY` choke point ONLY — adopt **Reply / Disagree** (the exact verbs the
shipped Stage 6.4 side-action rail already renders on default surfaces) as the single primary
display set, retiring `Counter` and `Challenge` as primary reply-verb *display labels*. Object
keys and move-type codes are unchanged so every consumer keeps compiling; the later surface cards
(P1 home verbs, P2 Exchange lens + one-bar composer) then consume one vocabulary instead of five
drifting ones. **(3)** Rewrite the ~104 apostrophe-bearing comment lines in
`src/features/arguments/room/ArgumentRoom.tsx` to be apostrophe-free (#871), removing the latent
risk that one lone apostrophe tips the doctrine scanner's `STRING_RE` quote parity and poisons
string parsing file-wide.

Doctrine constraints that shape this design (all from `cdiscourse-doctrine`): **§1** the retained
verbs name the *move*, never the mover, and score never blocks posting — this card touches only
display strings and one dead JSX branch, no gate. **§9** no internal code may leak into
user-facing strings — unaffected; we do not add codes. **The rules engine is sacred** — untouched
(no transition-matrix / move-type / `engine.ts` change; the move-type *codes* `counter` /
`challenge` survive as object keys). **§6/§7** no secrets, no service-role, no AI/provider call of
any kind. The apostrophe rider is a doctrine-scanner hygiene fix (`transcript-lang-min` /
house apostrophe-gotcha) — the memory note "Doctrine scanner apostrophe gotcha" is the founding
incident.

---

## Data model

**No new data model.** No new types, no schema, no migration, no Edge Function. Object *keys* of
`MOVE_COPY` are preserved verbatim (`challenge`, `counter`, `reply`, `yourMove`, …), so the
`typeof MOVE_COPY` shape in `CopyGroup` (gameCopy.ts:1950) and `ALL_COPY.move` (gameCopy.ts:1961)
are byte-identical at the type level. Only two *string values* change.

---

## File changes

Three production files, one test file. All paths absolute-verified in the worktree
`C:/Users/kyler/cdiscourse/wt-asp-p0`.

### Modified — production

- **`App.tsx`** — two deletions, ~15 lines removed net, zero lines added.
  - **Delete the dead mount block** at **lines 1011–1023** (the JSX branch *and* its
    preceding explanatory comment):
    ```
    1011        {/* Old sortable table is dev-only behind the chip; keep mount path so
    1012            admin / tests can still reach it via a separate route if needed. */}
    1013        {false && activeTab === 'arguments' && !hasDebate && (
    1014          <DebateListScreen
    1015            debates={debates}
    1016            loading={debatesLoading}
    1017            error={debatesError}
    1018            onRefresh={refresh}
    1019            onCreate={create}
    1020            onJoin={join}
    1021            onSelect={selectDebate}
    1022          />
    1023        )}
    ```
    Delete lines 1011–1023 inclusive (the comment on 1011–1012 documents *only* this dead block;
    remove it with the block). Leave the blank line 1010 that closes the preceding gallery `)}`
    and the blank line 1024 before the next `{/* Arguments tab: room view. */}` comment so the
    surrounding structure reads cleanly.
  - **Remove the `DebateListScreen` named import** from **line 23**. The line is:
    ```
    import { DebateListScreen, DebateDetailHeader, useDebates, useCurrentDebate, useRoomContract } from './src/features/debates';
    ```
    becomes
    ```
    import { DebateDetailHeader, useDebates, useCurrentDebate, useRoomContract } from './src/features/debates';
    ```
    (drop `DebateListScreen, ` only; the other four named imports on that line stay — all four are
    used: `useDebates` @553, `useCurrentDebate` @554, `DebateDetailHeader` @1041, `useRoomContract`
    is destructured in the debates block ~line 26–30 region).
  - **No other App.tsx change.** Verified: every value the deleted block destructured
    (`debates`, `debatesLoading`, `debatesError`, `refresh`, `create`, `join`, `selectDebate`) is
    used elsewhere — `ConversationGalleryScreen` mount (~974–996), deep-link handlers
    (~590–697), invite-accept handler (~1094–1102). So removing the mount **orphans no variable**
    and creates **no `no-unused-vars` lint error**. The *only* symbol that becomes unused is the
    `DebateListScreen` import, which line 23 removes.

- **`src/features/arguments/gameCopy.ts`** — two value edits inside `MOVE_COPY` (lines 32–43),
  ~2 lines changed, keys unchanged.
  - **Line 33** `challenge: 'Challenge',` → `challenge: 'Disagree',`
  - **Line 41** `counter: 'Counter',` → `counter: 'Reply',`
  - **Unchanged** in `MOVE_COPY`: `reply: 'Reply'` (line 40 — already the primary), `yourMove`,
    `clarify`, `dropReceipts`, `concede`, `narrow`, `synthesize`, `branchOff`. The keys
    `challenge:` and `counter:` are **kept** (only their display values change) so `CopyGroup`,
    `ALL_COPY.move`, and any `typeof MOVE_COPY` consumer keep compiling.
  - Add a NOTE comment above the two edits (apostrophe-free — this file is NOT in the
    `uxOneOneTwoDoctrine` scanned set, but keep it apostrophe-free anyway for uniformity and
    because `channelCopyBanList` / `gameCopy` suites read this module). Suggested:
    ```
    // ASP-CLEAN-001 — primary reply-verb unification. Display labels only:
    // the move-type CODES (challenge / counter) are unchanged, so every
    // consumer keeps compiling. Reply / Disagree are the verbs the shipped
    // Stage 6.4 side-action rail already renders on default surfaces
    // (ArgumentSideActionRail.tsx reply / disagree). Counter / Challenge are
    // retired as primary reply-verb display labels; the global COPY-001 sweep
    // across the other drift sites lands in the later surface cards (P1 / P2).
    ```

- **`src/features/arguments/room/ArgumentRoom.tsx`** — #871 rider. Rewrite the **~104
  apostrophe-bearing comment lines** to be apostrophe-free. Comment text only; **zero code
  change, zero string-literal change**. Mechanical transforms:
  - Contractions: `doesn't → does not`, `don't → do not`, `it's → it is`, `won't → will not`,
    `can't → cannot`, `isn't → is not`, `we're → we are`, `they're → they are`, `you're → you
    are`, `that's → that is`, `there's → there is`, `let's → let us`.
  - Possessives with a trailing `'s` in comments (e.g. `node's`, `drawer's`, `user's`,
    `parent's`, `readout's`, `sidecar's`, `dock's`, `Act's`, `Go popout's`): rephrase to drop the
    apostrophe. Prefer `the active node` / `of the active node` / `for the node` over `node's`;
    where a straight rephrase is awkward, use `(node) ` form or restructure the sentence. The goal
    is **zero apostrophes in any comment line**, matched by the same `^\s*(//|\*|/\*).*'` scan that
    currently finds 104 lines returning **0**.
  - Do **not** touch any string literal, JSX text, `accessibilityLabel`, `testID`, or code
    identifier. Only `//`-prefixed and `*`-prefixed (block) comment prose changes.

### Modified — tests

- **`__tests__/gameCopy.test.ts`** — extend the existing `describe('move copy')` block (currently
  lines 58–67) with two NET-NEW assertions (no existing assertion is relaxed or removed):
  1. **Single-primary-verb.** Assert the retained primary reply verbs are exactly the shipped
     default-surface set:
     ```ts
     it('ASP-CLEAN-001 — primary reply verbs are Reply / Disagree', () => {
       expect(MOVE_COPY.reply).toBe('Reply');
       expect(MOVE_COPY.counter).toBe('Reply');   // code kept; label unified
       expect(MOVE_COPY.challenge).toBe('Disagree');
     });
     ```
  2. **Retired-alias absence** over the primary-action display values:
     ```ts
     it('ASP-CLEAN-001 — retired verbs Counter / Challenge are absent from MOVE_COPY values', () => {
       const values = Object.values(MOVE_COPY);
       expect(values).not.toContain('Counter');
       expect(values).not.toContain('Challenge');
     });
     ```
  These are additive; they raise the test count by **2** (see Test plan).

### Deleted

- **None.** `src/features/debates/DebateListScreen.tsx` **stays** (still exported via
  `src/features/debates/index.ts`, still covered by `__tests__/DebateListScreen.visibility.test.tsx`
  which imports it directly, not via the App mount). No route/nav change.

---

## API / interface contracts

- **`MOVE_COPY`** (gameCopy.ts:32–43): the exported const's *type* is unchanged (`as const`,
  same keys). Two string *values* change. `CopyGroup = … | typeof MOVE_COPY | …` and
  `ALL_COPY.move = MOVE_COPY` are unaffected. **No public function signature changes.**
- **`App.tsx`**: no exported symbol; the deleted block is internal JSX. The `DebateListScreen`
  import removal changes nothing another module calls.
- **`ArgumentRoom.tsx`**: comment-only; no exported symbol, prop, or behavior changes.

---

## Edge cases

- **Does any component render `MOVE_COPY.counter` / `.challenge`?** No. Grep across `src/` and
  `App.tsx` for `MOVE_COPY`, `ALL_COPY`, `.move.counter`, `.move.challenge`, `MOVE_COPY.counter`,
  `MOVE_COPY.challenge` finds **only the definition + aggregation inside gameCopy.ts itself** —
  no component consumer. Therefore changing these two display values produces **literally zero
  rendered-pixel change** on any surface. This is the mechanical basis of the "zero visual diff by
  construction" claim.
- **`DebateListScreen.tsx` does not consume `MOVE_COPY.counter/.challenge`** (grep returns nothing)
  — so even the retained component's render is unaffected by the value change.
- **Orphaned destructures after mount delete.** None — every destructured value is used elsewhere
  (enumerated above). If a future edit *did* orphan one, `npm run lint` (`no-unused-vars`) would
  catch it; the implementer must run lint and confirm zero new warnings.
- **`DebateListScreen` becomes an unused import.** Line 23 removal handles it. If the implementer
  forgets, TypeScript `noUnusedLocals` / eslint flags it — a green typecheck+lint is the guard.
- **Apostrophe scanner false-positive today?** The `uxOneOneTwoDoctrine` suite is green now
  (captured baseline below) because `STRING_RE` quote parity across `ArgumentRoom.tsx` is
  currently even. The rider is *preventive*: it removes the fragility so a future unrelated edit
  that adds one contraction cannot silently tip parity and flag a distant innocent string. After
  the rewrite, the scanned comment-apostrophe count goes 104 → 0.
- **A NOTE comment the implementer adds to a scanned file must itself be apostrophe-free.** The
  only production file this card edits that the scanner reads is `App.tsx` (in `UX_001_2_FILES`)
  and `ArgumentRoom.tsx`. The App.tsx edit is a *deletion* plus (optionally) a one-line
  apostrophe-free NOTE. Any NOTE added to App.tsx or ArgumentRoom.tsx MUST be apostrophe-free and
  quote-balanced. (The `gameCopy.ts` NOTE is not scanned but should also be apostrophe-free for
  uniformity.)
- **Empty / concurrent / offline / permission-denied paths:** N/A — no data-plane, no network,
  no async, no auth path touched. Pure display strings + one dead branch + comment prose.

---

## Test plan

Every suite below is named because it either *proves zero visual diff* or *scans the new strings*.
The captured baseline (all six green, 110 tests, exit 0) is recorded so the "runs unchanged" claim
is verifiable.

**Suites that PROVE zero visual diff (must pass UNCHANGED — no edit):**
- `__tests__/sunset003DefaultPathLeakage.test.tsx` — renders the canonical default surfaces
  (`TimelineSelectedReadoutPanel`, `CardDetailPanel`, `PointFeedbackFlagsRow`). Neither the deleted
  mount nor the `MOVE_COPY` values feed these; passes unchanged. This is the acceptance criteria's
  named snapshot/leakage proof.
- `__tests__/DebateListScreen.visibility.test.tsx` — imports `DebateListScreen` directly (not via
  the App mount) and does not read `MOVE_COPY.counter/.challenge`. Passes unchanged, proving the
  component is still reachable by tests after the mount is deleted.
- `__tests__/copySystemBanList.test.ts` — does not scan `MOVE_COPY` (not in `SHIPPED_COPY_CONSTANTS`).
  `Reply` / `Disagree` carry none of its banned tokens (incl. `wrong`). Passes unchanged.
- `__tests__/sideActionDockNoVerdictCopy.test.ts` — scans the rail action set (from
  `ArgumentSideActionRail` / `ObserverActionDockLayout`, not `MOVE_COPY`). `Reply` / `Disagree`
  are already the rail's shipped labels and are ban-list-clean (incl. `right` / `wrong`). Passes
  unchanged.

**Suite that SCANS App.tsx byte-shape (must pass UNCHANGED — no edit):**
- `__tests__/uxOneOneTwoDoctrine.test.ts` — source-scans `App.tsx` and `room/ArgumentRoom.tsx`
  (both in `UX_001_2_FILES`) for verdict tokens / internal-code leaks / secrets / provider imports
  / `console.log`, using the naive-quote-parity `STRING_RE`. Deleting a `{false && …}` block
  removes strings; the rider makes `ArgumentRoom.tsx` comments apostrophe-free, which can only
  *improve* `STRING_RE` parity. Passes unchanged. **The implementer must re-run this suite after
  the ArgumentRoom.tsx rewrite** and confirm green (house apostrophe-gotcha discipline).

**Suite that CHANGES (the only test edit — net-add 2 tests):**
- `__tests__/gameCopy.test.ts` — add the two assertions in "File changes → Modified — tests".
  No existing assertion in this file is relaxed: it currently pins `COMPOSER_COPY.yourMove ===
  'Your Move'`, `MOVE_COPY.dropReceipts` truthy, and `ALL_COPY.move === MOVE_COPY` — all survive.

**Full-gate expectation (the card's done-bar):**
- `npm run typecheck` — exit 0 (keys unchanged, so no type break; `DebateListScreen` import
  removal resolves cleanly since it stays exported).
- `npm run lint` — exit 0, zero new `no-unused-vars` (import removed; no destructure orphaned).
- `npm run test` — full suite green; test count = current baseline **+ 2** (the two new
  `gameCopy.test.ts` assertions). No other suite's count changes. Capture the
  `Tests: Y passed, Y total` line with exit 0 per `test-discipline` gate rule.

---

## Enumerated test-pin relaxations

**Relaxation count: 0.** This card relaxes **no** existing test pin. Justification, per pin the
issue flagged as a candidate:

| Suite | What it pins | Verb change impact | Mount-delete impact | Action |
|---|---|---|---|---|
| `gameCopy.test.ts` | `COMPOSER_COPY.yourMove`, `MOVE_COPY.dropReceipts`, `ALL_COPY.move` | none (those keys/values unchanged) | none | **Net-ADD 2 assertions** (not a relaxation) |
| `uxOneOneTwoDoctrine.test.ts` | App.tsx + ArgumentRoom.tsx byte-shape (scan, not exact literal) | none | strings removed (improves scan) | none |
| `sunset003DefaultPathLeakage.test.tsx` | default-surface rendered text | none (no consumer) | none | none |
| `copySystemBanList.test.ts` | shipped copy constants (not MOVE_COPY) | none | none | none |
| `sideActionDockNoVerdictCopy.test.ts` | rail action labels (not MOVE_COPY) | none | none | none |
| `DebateListScreen.visibility.test.tsx` | direct-import render | none | none (imports directly) | none |

A full-tree grep for `toBe('Counter')`, `toBe('Challenge')`, `toContain('Counter'/'Challenge')`,
and `MOVE_COPY.counter/.challenge` under `__tests__/` returns **zero matches** — there is no
existing pin on the literal `'Counter'` / `'Challenge'` values anywhere, which is *why* the
relaxation count is 0. Per the house NOTE-comment convention, the two NET-NEW assertions each
carry the `ASP-CLEAN-001 —` prefix naming this card; the PR description lists the relaxation count
as **0** and the added-assertion count as **2**.

---

## Dependencies (cards / docs / files)

- **Reads** `App.tsx:23` (import), `App.tsx:1011–1023` (dead block), `src/features/arguments/gameCopy.ts`
  `MOVE_COPY` (lines 32–43), `src/features/arguments/room/ArgumentRoom.tsx` (104 comment lines).
- **Reads existing** shipped default vocabulary at `src/features/arguments/ArgumentSideActionRail.tsx`
  lines 109–110 (`reply: 'Reply'`, `disagree: 'Disagree'`) — the *source of truth* for the chosen
  unified verbs. The card aligns `MOVE_COPY` to what this file already renders.
- **Assumes ASP-EXTRACT-001 (Slices 1+2, #869/#870, merged `cb1885e`/`b4c2e85`) is complete** —
  `room/ArgumentRoom.tsx` exists as the extracted orchestrator carrying the verbatim-moved comments
  the rider targets. This card is slice 02a; slice 02 (extraction) already landed.
- **Blocks (soft)** the later surface cards P1 (HOME-001 home verbs) and P2 (ROOM-002 Exchange lens,
  ROOM-003 one-bar composer) *conceptually* — they consume the unified vocabulary — but does not
  hard-block them. Per `14_PR_SLICING_PLAN.md` sequencing rails, 02a lands before 03–07.
- **Independent of ASP-ADR-001 / D1** — survives a NO on the voice ADR (this is audio-free P0
  cleanup).
- **Absorbs part of #847 (SUNSET-001)** scope per the slicing plan.

---

## Risks

- **The 91-file `gameCopy` blast radius.** 91 test files reference `gameCopy`. The design keeps the
  change to the **two `MOVE_COPY` display values only** — the other drift sites (`actPopoutModel.ts`
  `label: 'Challenge'` @183, `TimelineNodePopover.tsx` `disagree → 'Challenge'` @58, and the
  `railActionCategories.ts` action codes) are **explicitly out of scope** and deferred to the later
  P1/P2 surface cards where the global COPY-001 sweep lives. Touching them here would balloon a
  slice-02a chore into a five-surface sweep and risk a large snapshot churn. **Mitigation:** the
  implementer edits *only* gameCopy.ts:33 and :41 for the verb task; a grep for `MOVE_COPY`
  consumers (zero) is the proof that no other file needs a coordinated edit.
- **`argumentGameSurfaceModel.ts:1666` `label: 'Challenge'` is a KIND family label, NOT a reply
  verb.** It is the timeline-grammar color-family label for the `challenge` kind (per
  `timeline-grammar`). Do **not** touch it — it is a different concept (node kind coloring) and is
  outside this card's "reply verb" scope.
- **Apostrophe rewrite is tedious and error-prone at 104 lines.** Risk: an accidental string-literal
  edit or a missed apostrophe. **Mitigation:** the rewrite is comment-prose only; after the edit run
  `grep -nE "^\s*(//|\*|/\*).*'" src/features/arguments/room/ArgumentRoom.tsx` and confirm **0**
  matches, then re-run `uxOneOneTwoDoctrine.test.ts` + `npm run typecheck` (a corrupted string would
  break the type-check or a behavior test). The rewrite must not change any non-comment character.
- **Existing tests that might need updating:** only `gameCopy.test.ts` (the 2 net-new assertions).
  No other suite changes. If any other suite fails after the change, it is a signal the change
  leaked beyond scope — stop and re-check (it should not, per the zero-consumer grep).
- **Line-number drift.** The dead-block line numbers (1011–1023) and import line (23) are captured
  against the current worktree HEAD. If the branch is rebased and earlier lines shift, the
  implementer must re-locate by content (`grep "false &&" App.tsx`, `grep "DebateListScreen" App.tsx`)
  rather than trusting the absolute numbers.

---

## Out of scope

- **No global COPY-001 sweep.** The 91 `gameCopy`-referencing files and the other reply-verb drift
  sites (`actPopoutModel.ts`, `TimelineNodePopover.tsx`) are the later P1/P2 surface cards' job.
- **No change to `src/features/arguments/railActionCategories.ts`** action codes or any surface
  component.
- **No deletion of `DebateListScreen.tsx`**; no route / navigation change.
- **No engine, migration, Edge Function, or feature-flag work.** (This slice needs no flag — see
  Rollout.)
- **No change to `MOVE_COPY` object keys** or any move-type code (`challenge` / `counter` survive as
  keys and codes; only display values change).
- **No change to `argumentGameSurfaceModel.ts:1666`** kind-family `'Challenge'` label (different
  concept: node kind coloring, owned by `timeline-grammar`).
- **No new behavior, no new component, no new test file** — the two test additions live in the
  existing `gameCopy.test.ts`.

---

## Doctrine self-check

- **`cdiscourse-doctrine` §1 (no truth labels; score never blocks posting; no service-role):**
  respected. The retained verbs `Reply` / `Disagree` name the *move*, never the mover; both are
  ban-list-clean across `copySystemBanList` (incl. `wrong`), `sideActionDockNoVerdictCopy` (incl.
  `right` / `wrong`), and `gameCopy`'s own `FORBIDDEN` scan. No gate is touched — this is display
  strings + one dead JSX branch. No service-role, no client-side AI, no data-plane write.
- **`cdiscourse-doctrine` §9 (plain language / no internal-code leak):** respected. No new internal
  code introduced; `toPlainLanguage` / `PLAIN_LANGUAGE_COPY` untouched. `Reply` / `Disagree` are
  plain English (not snake_case; `looksLikeInternalCode` false).
- **`cdiscourse-doctrine` — rules engine is sacred:** respected. `src/domain/constitution/engine.ts`
  (the live engine path per the CLAUDE.md-path memory note) is untouched; the move-type *codes*
  `challenge` / `counter` survive unchanged, so no transition-matrix or move-type change.
- **`cdiscourse-doctrine` §6/§7 (secrets / no production AI call):** respected. No key reference, no
  provider import, no external call. `uxOneOneTwoDoctrine`'s security + provider-import scans stay
  green over the edited `App.tsx`.
- **`test-discipline`:** respected. The card's production change (2 string values + comment prose)
  is accompanied by its test (2 net-new assertions in `gameCopy.test.ts`); test count goes UP by 2,
  never down. Full-gate (typecheck + lint + jest) green is the done-bar; the gate exit code is the
  contract, not tailed output.
- **Apostrophe-gotcha discipline (memory: "Doctrine scanner apostrophe gotcha"):** respected and
  *advanced* — the rider removes the 104-line latent fragility from `ArgumentRoom.tsx`, and any NOTE
  comment added to a scanned file (`App.tsx`, `ArgumentRoom.tsx`) is authored apostrophe-free with
  balanced quotes.
- **Observations vs Allegations (§10a):** N/A — no node label authored or changed.
- **v1 scope guards (§10):** N/A — no voting / search / OAuth / push / public-API / realtime work.

---

## Operator steps (if any)

**None — pure code change.** No migration (`npx supabase db push`), no Edge Function deploy, no
env var, no flag arm. The implementer commits on `feat/asp-p0-clean-flags`; merge is a plain
docs+code merge with no deploy side-effect (no migration-bearing files, no config.toml-registered
Edge Function touched). Rollback is a straight `revert` (moves + comments only).
