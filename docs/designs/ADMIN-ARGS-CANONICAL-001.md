# ADMIN-ARGS-CANONICAL-001 — Canonical Argument-Artifact grouping across admin argument list surfaces

**Status:** Design draft — GATE A
**Type:** Admin UI / pure-TS view-model design (DESIGN-ONLY; test delta 0 in this card)
**Epic:** Admin Operations / Visibility
**Release:** Stage 6.x admin tooling
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/463
**Verified-at-HEAD:** `37ccd9e` (`37ccd9ed027c625686f3eee517d03a48df25a29d`) — `git rev-parse HEAD`. This HEAD is itself the squash-merge of PR #480 (`feat(ADMIN-ARGS-INACTIVE-001): reversible inactive visibility state … (#480)`), confirmed by `git log -1 --format="%H %s"`.

---

## 0. Skill preamble

Skills invoked: `cdiscourse-doctrine` (§1 no truth labels · §3 popularity-not-evidence · §4 AI advisory-only · §4-C never-self-approve · §4-T no bar lowering · §5 engine.ts sole gate · §6 secrets · §8 soft-delete + append-only migrations + RLS · §9 plain-language mapping · §10a Observations vs Allegations / sensitive composer-only), `test-discipline` (tests are part of the deliverable; baseline **630 suites / 19263 passing / 1 skipped / 19264 total** on `main`).

Governance: `pipeline-governance-contract` §2 stage machine (Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C), §4 never-self-approve, §5 merge=deploy (only `supabase/functions/**` + `supabase/migrations/**` auto-apply on merge; the recommended option (a) touches neither).

**Constitutional acceptance-gate invariant (stated verbatim):** *"AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."* This card touches the admin **read path** only — it adds zero classifier, zero submit-path, zero routing, and zero MCP behavior. The invariant is preserved trivially.

Authoritative sources read in full before drafting:
- Phase 0 fact bundle, dimension *"Read-only issue dedup + admin-args inventory for #463"* (cited below as `[fact:<key>]`).
- Backlog card body: `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:309-410` (the #463 card body — verbatim authority for scope, options, surfaces, acceptance, test plan).
- Sibling design (now shipped): `docs/designs/ADMIN-ARGS-INACTIVE-001.md:1-60`.

---

## 1. Scope

Group the admin argument-list surfaces so that **one clickable artifact appears per logical argument**, with child runs / updates / observations rendered as an expansion. Concretely:

1. A new pure-TS view-model `src/features/arguments/argumentArtifactModel.ts` exporting `ArgumentArtifact`, `ArgumentRevision`, `groupArgumentsIntoArtifacts(rows): ArgumentArtifact[]`, `sortArtifactsByLatestActivity(artifacts, direction)`, `filterArtifactsByQuery(artifacts, query)` — no React / Supabase / `fetch` imports (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:347-353`).
2. The five argument-list surfaces (§ "Current production state") consume the model so each renders one row per logical argument with a structural update-count + observation-coverage badge and a "show update history" expansion (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:355-360`).
3. The artifact's `isInactive` is **derived** from the *shipped* `inactive_at` column (now reality, see §5/§6), never reserved as a default-false boolean.
4. No row is hidden, no row is hard-deleted, no data is rewritten — this is presentation grouping over the existing read path (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:333,367-373`).

## 2. Non-goals

- No DB migration (for the recommended option a) and no data rewrite / canonicalization of stored rows (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:369-370`).
- No change to `submit-argument`, the rules engine, classifier dispatch, queue routing, or any MCP family — read path only (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:373`).
- No change to the inactive-state workflow itself (shipped separately as #464) — this card **consumes** its column, it does not re-implement it.
- No hard-delete / bulk-delete UI; no client write to `arguments.status` (doctrine §8).
- No timeline-visual change; the debate timeline scrubber stays; only the row list beneath it groups (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:358,374`).
- Not v2-scope: this introduces no voting, no winner, no truth verdict, no search index beyond the existing in-memory filter.

## 3. Current production state

The Admin Arguments tab renders **one row per `public.arguments` row** today: `AdminArgumentsTab.tsx:469` iterates `filtered.map((r) => …)` directly over `AdminArgumentRow[]` — there is no grouping layer. The loader `adminArgumentsApi.loadAdminArguments` selects argument columns joined to `debates(title)` + `profiles(display_name)`, orders by the sort field, applies `.neq('status','deleted')` by default and `.is('inactive_at', null)` by default, and maps raw rows to `AdminArgumentRow` (`adminArgumentsApi.ts:110-155`).

Three read surfaces list arguments (`[fact:463_design_fact_three_surfaces]`):
- **AdminArgumentsTab** (`AdminArgumentsTab.tsx:469`) — the primary grouping target.
- **AdminViewAsTab.recentArguments** and **AdminUserDetailPanel.recentArguments** — both carry the server-fetched `recentArguments` shape (`types.ts:53-61`, `AdminViewAsSnapshot.recentArguments` at `types.ts:102`). These two come from the `admin-users` Edge path and do **not** include `inactive_at` in their projected shape today (`types.ts:53-61` lists `id, debate_id, argument_type, side, body, status, created_at` only).

A debate-level dedupe **already exists** at a different layer (Stage 6.3 gallery): `cleanTitleForDedupe` strips suffix tags `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` / `[scenario-…]` / `[seed-…]` via `SUFFIX_TAG_PATTERNS` (`conversationGalleryModel.ts:437-455`); `deriveCanonicalConversationKey` builds the dedupe key (`:463-479`); `dedupeConversationCards` collapses by `canonicalConversationKey`, picks the primary by `sortKeys.latestActivityMs`, and tracks `duplicateCount` / `duplicateDebateIds` (`:1049-1079`). That is **debate-level**; this card adds the **argument-level** analogue.

A forward-resilience test already exists in the tree referencing *this card's design §14 #5* and the `ArgumentArtifact.isInactive` projection: `__tests__/argumentArtifactInactiveResilience.test.ts:1-90`. It currently pins only the `inactive_at → inactiveAt` plumbing + an `isVisibleToNonAdmin` predicate (`status !== 'deleted' && (inactiveAt ?? null) === null`); the build phase extends it with the full artifact projection.

`src/features/arguments/argumentArtifactModel.ts` does **not** exist yet (Glob `**/argumentArtifact*.ts` returns only the resilience test). This card designs that module.

H/I/J families remain frozen: `familyRegistry.ts:105-118` shows `claim_clarity` / `thread_topology` / `sensitive_composer` all `productionEnabled: false`. This card does not touch the registry.

## 4. RCA / problem summary

Admin sees "duplicate-looking" rows because the corpus runners create many near-identical rooms/arguments (suffix-tagged `[xai-adv …]` etc.) and because a logical argument can accrue updates. The list query fans these into one row each, so a single logical argument occupies N admin rows. This is a **presentation** defect, not a data defect — the rows are legitimate and must all remain reachable. The fix is a grouping view-model over the read path, mirroring the debate-level collapse the gallery already ships.

## 5. Why this is or is not a ceiling/limit

This is **not** an architectural ceiling. The schema simply has no canonical lineage column: `public.arguments` has **no `canonical_id` / `origin_id` / `revision_id` / `version_of` / `root_id`** (`[fact:463_design_fact_grouping_key]`; backlog hypotheses-to-falsify `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:339-344`). Grouping must therefore use the primitives that DO exist on the row — `id`, `parent_id`, `debate_id`, `depth`, `updated_at`, `created_at` — exactly as the gallery dedupe uses title + root-body + resolution. A canonical column is *available* (option b) but is an operator-gated migration, not a forced one. So the limit is a missing convenience column, removable later without re-architecting; option (a) ships value with zero schema change.

## 6. Architecture options considered

### Option (a) — UI-only lineage/title-suffix dedupe (RECOMMENDED for first ship)

Group entirely in the pure-TS view-model, mirroring `conversationGalleryModel` at the argument level. Grouping key precedence (designer's chosen order, each falsifiable in the build spike):

1. **`argument_id` (the row's own `id`) is the artifact key** when the surface's "duplicate rows" are *updates of one logical argument* (backlog hypothesis 2, the recommended primary — `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:341,350`). `updated_at ≠ created_at` distinguishes an updated row; the artifact's `latestUpdatedAt` is the max over its revisions.
2. **Title-suffix-stripped lineage** for cross-room corpus duplicates: reuse a `cleanTitleForDedupe`-equivalent on the *debate title* carried by `AdminArgumentRow.debateTitle` to fold `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` siblings, mirroring `conversationGalleryModel.ts:437-455`.
3. **Fallback derived key** (`debate_id` + normalized body excerpt) only when neither above applies, with its own test pack (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:396`).

Pros: no migration, no DB write, no Edge change, pure read-path presentation → **auto-merge eligible** under governance §5 (touches no `supabase/functions/**`, no `supabase/migrations/**`). Mirrors a pattern already in production. Cons: grouping is heuristic, recomputed per load; cross-`argument_id` re-posts only fold via the derived key.

### Option (b) — new `canonical_id` migration on `public.arguments`

Add an append-only nullable `canonical_id uuid` column + backfill, then group on it deterministically server-side.

Pros: exact, durable, indexable lineage; no heuristic. Cons: a **migration** that auto-applies on merge (governance §5 merge=deploy) → **GATE C operator-only**; requires backfill design, RLS review, and an append-only migration file (doctrine §8). Strictly heavier than the first ship needs. Recorded as the durable successor, **not** chosen now.

### Option (c) — SQL view / Edge adapter that pre-collapses server-side

A DB view or `admin-users` Edge change that returns artifacts. Same GATE-C weight as (b) (Edge source edit auto-deploys on merge) without (b)'s durability. Recorded and not chosen.

## 7. Chosen architecture

**Option (a).** Ship the pure-TS `argumentArtifactModel.ts`, wire `AdminArgumentsTab` first, then the remaining surfaces. Mirror `dedupeConversationCards`'s primary-by-latest-activity + collapsed-count pattern (`conversationGalleryModel.ts:1049-1079`) at the argument level. Defer option (b) to a follow-up only if heuristic grouping proves insufficient in operator review.

**Load-bearing correction vs the predecessor design.** The predecessor body assumed an `ADMIN-ARGS-INACTIVE-001 ships-first` contingency (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:320-324,403`) and reserved `ArgumentArtifact.isInactive?: boolean` defaulting to `false`. That contingency is now **reality**: #464 merged via PR #480 (`git log -1` at HEAD `37ccd9e` is the #480 squash-merge; `[fact:dedup_463_ADMIN-ARGS-CANONICAL-001]`, `[fact:463_inactive_field_reservation]`). Therefore:

- The artifact **derives** `isInactive` from the *shipped* column, it does not reserve a default-false boolean. The shipped client field is `AdminArgumentRow.inactiveAt: string | null` (`types.ts:154`, NULL = active) — and on the domain row `ArgumentRow.inactiveAt?: string | null` (`src/features/arguments/types.ts:44-56`, absent ⇒ active). The derivation is `revision.isInactive = (row.inactiveAt ?? null) !== null` and `artifact.isInactive = artifact.revisions.some(r => r.isInactive)`.
- The model **never** surfaces `inactive_reason`: it is admin-only free text (`AdminArgumentRow.inactiveReason: string | null`, `types.ts:157-162`, doctrine §10a composer-only). `inactive_reason` is excluded from `ArgumentArtifact` and `ArgumentRevision` entirely; it has no field on either type.
- Grouping invariant: an active sibling must **not** resurrect an inactive child. `groupArgumentsIntoArtifacts` derives each revision's `isInactive` independently and OR-folds for the artifact badge only — it never clears a child's inactive state (`argumentArtifactInactiveResilience.test.ts` is the guard; extended in the build phase).

## 8. Data model

New pure-TS types in `src/features/arguments/argumentArtifactModel.ts` (no migration):

```
ArgumentRevision {
  revisionId: string;        // the source row id
  body: string;
  updatedAt: string;
  createdAt: string;
  isInactive: boolean;       // DERIVED: (row.inactiveAt ?? null) !== null. NEVER reads inactive_reason.
}

ArgumentArtifact {
  artifactId: string;        // chosen grouping key (option a precedence in §6)
  latestBody: string;        // body of the revision with max(updatedAt)
  authorId: string | null;
  debateId: string;
  debateTitle: string | null;
  latestUpdatedAt: string;
  createdAt: string;         // min(createdAt) across revisions
  updateCount: number;       // revisions.length - 1 (structural; rendered "N updates")
  observationCount: { covered: number; total: number }; // rendered "5/7 observations"
  duplicateRunCount: number; // structural; rendered "N duplicate runs collapsed"
  qualifiers: string[];      // existing derived qualifier labels (no verdict tokens)
  isInactive: boolean;       // DERIVED: revisions.some(r => r.isInactive)
  revisions: ArgumentRevision[];
}
```

Inputs are `AdminArgumentRow[]` (admin surfaces) and `ArgumentRow[]` (user/gallery surfaces); the model reads only `id`, `debateId`, `debateTitle`, `authorId`, `body`, `createdAt`, `updatedAt`, `inactiveAt`, and existing qualifier inputs. **No `inactiveReason`, no body-rewrite, no truth/score field.** `observationCount` is sourced from existing per-argument observation coverage already available to the admin row; it is a structural coverage count, not a verdict.

**Known gap (Open Question 1):** `AdminViewAsTab.recentArguments` / `AdminUserDetailPanel.recentArguments` (`types.ts:53-61`) do not project `inactive_at` and apply no `status='deleted'` filter (`[fact:463_design_fact_three_surfaces]`). For those two surfaces the model treats absent `inactiveAt` as active (per `ArgumentRow.inactiveAt?` semantics, `types.ts:53-56`); whether to extend their Edge projection to carry `inactive_at` is an operator decision (it would be a GATE-C Edge edit and is deferred).

## 9. Worker/drainer model

Not applicable. This card adds no worker, no drainer, no queue, no async dispatch. Stated explicitly to satisfy §8 structure.

## 10. Liveness and observability

No new telemetry, no new logs, no new env flags. Grouping is recomputed deterministically per render from already-loaded rows. The only observable change is the rendered row set: artifacts in place of raw rows, plus structural badges. A determinism property test (`groupArgumentsIntoArtifacts` returns JSON-equal output for the same input across N=10 calls, `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:416`) is the liveness guard.

## 11. Cutover and rollback path

Pure client presentation; cutover is the merge itself. Rollback is a code revert — no migration to unwind, no flag to flip, no deploy to roll back (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:428`). If grouping mis-folds a surface, the implementer can scope the `groupArgumentsIntoArtifacts` call to a single surface and revert the others independently (Phase C lands one screen at a time, `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:355-360`).

## 12. Smoke plan

DESIGN-only card → no live smoke. The build-phase verification is: `npm run typecheck`, `npm run lint`, `npm run test` all exit 0; the new model tests + ban-list test green; existing `adminArgumentsTable*` tests still green (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:408,418`). No Supabase, no Edge, no provider call in this card.

## 13. Open questions

1. **ViewAs / UserDetail `recentArguments` posture.** Those two surfaces don't project `inactive_at` and don't filter `status='deleted'` (`types.ts:53-61`; `[fact:463_design_fact_three_surfaces]`). Treat absent `inactiveAt` as active for the artifact, or extend their Edge projection (GATE-C)? Recommend: treat as active for first ship; defer projection extension.
2. **`observationCount` source.** Confirm the exact per-argument observation-coverage field available on `AdminArgumentRow` at build time so `5/7 observations` reads real coverage and never reads green on absent data (§4-T). If unavailable, render `n/a`, never a fabricated count.
3. **Cross-`argument_id` re-posts.** When the same claim is re-posted under different `argument_id`s across rooms, only the derived key folds them — confirm in the spike whether this case occurs in the admin corpus or is purely a gallery-title concern.
4. **Route key.** If the route key today is `argument_id`, `artifactId` IS that id and routing is unchanged (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:375`). Surface any deviation rather than silently changing the route (HALT trigger, §15).

## 14. Stage gates before implementation

- **GATE A (this doc):** records the chosen grouping key with the four hypotheses falsified/accepted, each with `file:line` evidence; reconciles the `inactiveAt: string | null` ↔ reserved-boolean mismatch. ← satisfied here.
- **GATE B:** committed diff + new tests + existing tests all green + typecheck + lint, captured with exit codes.
- **GATE C:** review + merge. Because option (a) touches no `supabase/functions/**` and no `supabase/migrations/**`, autonomous green squash-merge is permitted under governance §5 (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:428`). If the build switches to option (b)/(c), GATE C becomes operator-only.

## 15. Commit-slice plan

1. `argumentArtifactModel.ts` + `argumentArtifactModel.test.ts` (≥12 cases) — pure model, no UI.
2. Extend `argumentArtifactInactiveResilience.test.ts` to the full projection (derive `isInactive` from `inactiveAt`; assert no-resurrect; assert `inactiveReason` never appears).
3. `argumentArtifactBanList.test.ts` — scan every rendered artifact string for the ban list.
4. Wire `AdminArgumentsTab.tsx:469` to `groupArgumentsIntoArtifacts(rows)` + `AdminArgumentsTab.canonical.test.tsx`.
5. Wire remaining surfaces one screen at a time (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:355-360`).

**HALT trigger (verbatim from backlog `:423-426`):** if the spike contradicts all four hypotheses, or adopting the model alters an existing argument deep-link route, or a test that asserted "N rows for argument X" would need to be *relaxed* — **do not relax the test**; surface as an operator decision (§4-A never relax a failing guard to make a PR pass).

## 16. Test-count forecast

This card is **DESIGN-only: test delta = 0** at GATE A (`[fact:463_doctrine_posture]`). The IMPLEMENT phase forecast is **+18 to +24 tests** (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:410`) on the **630 suites / 19263 passing / 1 skipped / 19264 total** baseline. No test is removed or relaxed.

## 17. HALT ceiling

Stop and surface (do not proceed) if any of: a migration becomes required for first ship (switch to option b → GATE C); a `productionEnabled` family flag would change (frozen set — forbidden, §4-C); `inactive_reason` would reach any user-facing surface (§10a); a grouped-row label would carry a truth/popularity/verdict token (§1/§3); or an existing guard test would need relaxing (§4-T / §4-A).

## 18. Current-status manifest stub

- **NEW:** `src/features/arguments/argumentArtifactModel.ts` (pure-TS view-model) — build phase.
- **NEW:** `__tests__/argumentArtifactModel.test.ts`, `__tests__/argumentArtifactBanList.test.ts`, `__tests__/AdminArgumentsTab.canonical.test.tsx` — build phase.
- **MODIFIED (build phase):** `__tests__/argumentArtifactInactiveResilience.test.ts` (extend to full projection); `src/features/admin/AdminArgumentsTab.tsx` (`:469` rows.map → grouped artifacts); the four remaining list surfaces.
- **BYTE-EQUAL preserved:** `src/lib/constitution/engine.ts`; `supabase/functions/**` (incl. `submit-argument`, classifier, routing, `familyRegistry.ts`); `supabase/migrations/**`; `conversationGalleryModel.ts` (pattern is mirrored, not edited); `src/features/admin/types.ts` and `adminArgumentsApi.ts` (consumed as-is — `inactiveAt`/`inactiveReason` already shipped).
- **Test deltas:** DESIGN 0; IMPLEMENT +18 to +24.
- **Operator follow-up:** decide ViewAs/UserDetail `recentArguments` projection posture (Open Q1); decide whether option (b) `canonical_id` migration is ever wanted (GATE-C).
- **Discipline line:** NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO new dependency. NO direct insert into `public.arguments`. NO data rewrite. Read-path presentation grouping only.

## 19. Required-reading manifest for the build phase

- This doc.
- `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:309-410` (the #463 card body).
- `src/features/admin/types.ts:128-163` (`AdminArgumentRow`, incl. `inactiveAt` / `inactiveReason`) and `:53-61` (`recentArguments` shape).
- `src/features/admin/adminArgumentsApi.ts:110-155` (loader + mapping).
- `src/features/admin/AdminArgumentsTab.tsx:455-484` (render site).
- `src/features/arguments/types.ts:25-57` (`ArgumentRow`, incl. `inactiveAt?`).
- `src/features/debates/conversationGalleryModel.ts:437-479,1049-1079` (the dedupe pattern to mirror).
- `__tests__/argumentArtifactInactiveResilience.test.ts:1-90` (the forward-resilience guard to extend).
- `docs/designs/ADMIN-ARGS-INACTIVE-001.md:1-60` (shipped sibling — vocabulary + inactive doctrine).
- Skills: `cdiscourse-doctrine` (§1/§3/§8/§9/§10a), `test-discipline`.

---

### Self-check

Design-only: this doc is the sole artifact; no code, test, migration, or non-`docs/designs/` file written. No secret value embedded. Frozen set untouched: `familyRegistry.ts:105-118` H/I/J `productionEnabled: false` is read, never proposed-changed. Every state claim carries a `file:line` or `[fact:<key>]` citation, each verified against HEAD `37ccd9e`. Ban-list scan (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot) run over this doc — zero matches; grouped-row labels are structural ("N duplicate runs collapsed", "M updates", "5/7 observations").
