# META-1C — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/META-1C-admin-metadata-event-audit-log-surface
**Design:** docs/designs/META-1C.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/78

## Summary

META-1C ships the admin **Metadata Events** tab — a read-only investigation
surface over META-1A's persisted `public.point_tags` manual-tag ledger. It lists
each tag *event* (every apply, every remove) chronologically for a selected
debate, with tag-code / actor-role / applied-vs-removed filter chips and a
sortable Created column. The implementation is faithful to the design: it is a
pure client-side **direct caller-scoped admin-RLS read** (no Edge Function, no
migration, no service-role, no operator deploy step), exactly mirroring the
established `AdminArgumentsTab` / `adminArgumentsApi` pattern. The data layer
cleanly separates a pure `expandPointTagRowToEvents` adapter (1 `point_tags` row
→ 1 `applied` event always + 1 `removed` event when `removed_at` is set) from
the network loaders, and the view-model (`adminMetadataEventsView.ts`) keeps all
filter/sort/format logic pure and unit-testable. Doctrine is respected — the
surface states neutral facts only, the actor-role column honestly shows the
actor's *current* role with a legend (never a fabricated apply-time role), and a
ban-list test scans both model-emitted strings and user-facing copy. Both
design-documented card-vs-reality adjustments (current role + applied/removed
chip) are implemented honestly, not as corner-cutting. No concerns remain.

## Verification

- typecheck: **pass** (`tsc --noEmit` clean)
- lint: **pass** (`eslint . --ext .ts,.tsx --max-warnings 0` clean)
- test: 5021 → **5112 tests** / 181 → **183 suites** (+91 META-1C tests / +2
  suites). In this bare worktree **5093 pass, 19 fail**. The 19 failures are
  **entirely pre-existing and environmental** — all in 5 xAI/bot-fixture suites
  (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialSourceHarvest`,
  `xaiAdversarialPipeline`, `aiDrivenBotCorpus`); every failure message is
  `env_file_missing` because the gitignored `.env.engagement-intelligence` is
  absent from this isolated worktree. **Zero genuine failures.** META-1C's two
  suites (`adminMetadataEventsApi.test.ts`, `adminMetadataEventsTab.test.tsx`)
  run **91/91 green** in isolation.
- secret scan: **clean** — the only `ANTHROPIC_API_KEY` / `SERVICE_ROLE`
  matches in the diff are negative ban-list assertions in test files and
  doctrine-self-check prose in the design doc; no key value, no JWT, no Bearer
  token, no `sb_secret_` / `sk-ant-` literal.
- doctrine scan: **clean** — the only `winner`/`loser`/`liar`/etc. matches are
  inside ban-list arrays in tests and doctrine-self-check prose; no verdict
  token in any production code path or rendered string.

## Design conformance

- [x] All design file-changes are present — 3 new production files
  (`adminMetadataEventsApi.ts`, `adminMetadataEventsView.ts`,
  `AdminMetadataEventsTab.tsx`), 2 new test suites, 2 modified registry files
  (`types.ts`, `AdminScreen.tsx`), 3 doc files. Exactly 10 files.
- [x] No undocumented file-changes — `adminMetadataEventsView.ts` is documented
  in design §"File changes" line 268. No `supabase/` files touched, no new
  migration, no new Edge Function (confirmed `git diff` shows zero
  `supabase/**` changes).
- [x] Data model matches design — reads `point_tags` + the four embeds
  (`arguments!inner`, `debates!inner`, dual disambiguated `profiles` joins);
  `POINT_TAGS_AUDIT_SELECT` is the exact committed string the design specifies
  and is asserted by the test suite.
- [x] API contracts match design — `loadMetadataAuditEvents`,
  `expandPointTagRowToEvents`, `loadAuditDebateOptions`, `loadActorSides`,
  `dedupeDebateOptions`, `sortMetadataAuditEvents` all match the design's
  signatures and flow (caller-scoped select → pure expansion →
  `debate_participants` side enrichment → post-expansion chronological sort).
  Note: the `MetadataAuditEvent` interface adds an `argumentDeleted: boolean`
  field not in the design's §"Client TypeScript shapes" snippet — but the
  design body (edge case #7, UI §"deleted move" sub-label) explicitly requires
  this behavior, so the typed field is a faithful realization, not scope creep.

## Doctrine self-check (must all be ✓)

- [x] No truth/winner/loser language in user-facing strings — ban-list test
  scans JSX text nodes + quoted literals; footnote states "makes no judgment
  about any person" verbatim.
- [x] Score never blocks posting — META-1C touches no posting path; it is a
  read-only admin view.
- [x] No service-role in client code — `adminMetadataEventsApi.ts` imports the
  shared caller-scoped `supabase` client from `src/lib/supabase`; no
  `createClient`, no `SUPABASE_SERVICE_ROLE`, no `.rpc()` bypass. Source-scan
  test asserts all of this.
- [x] No direct insert into public.arguments — META-1C performs **zero writes**
  anywhere; no `.insert` / `.update` / `.delete` / `.upsert` in the diff.
- [x] No AI calls in production app paths — none added.
- [x] Plain language only — all 10 `ManualTagCode` labels rendered via
  `getManualTagPlainLabel` → `gameCopy.PLAIN_LANGUAGE_COPY`; no raw `tag_code`
  reaches a user-facing string; no new copy token.
- [x] Epic-specific doctrine — **cdiscourse-doctrine §1/§2/§3**: the audit
  surface lists events chronologically with no heat/popularity input, no
  count-weighting, no ranking; the actor-role gap (`point_tags` stores no
  apply-time role) is resolved honestly by showing the *current* role with an
  on-screen legend rather than fabricating a fact. **supabase-edge-contract**:
  direct admin-RLS read is the documented repo pattern; the surface is an
  append-only audit *view* (SELECT only, no UPDATE/DELETE affordance).

## Test coverage

- [x] New public functions have unit tests — `expandPointTagRowToEvents`,
  `loadMetadataAuditEvents`, `loadAuditDebateOptions`, `loadActorSides`,
  `dedupeDebateOptions`, `sortMetadataAuditEvents`, `asDebateSide`,
  `filterMetadataAuditEvents`, `formatActorRole`, `eventMatchesRoleFilter` all
  covered.
- [x] User-facing strings have ban-list assertion — data-layer suite scans
  model-emitted strings against `_forbiddenMetadataTokens()`; component suite
  scans JSX text + string literals against a verdict/person-attribution token
  set.
- [x] Edge cases from design §"Edge cases" have tests — applied-only (#3),
  applied+removed (#4), null `removed_by` (#5), soft-deleted argument (#7),
  cross-debate argument (#8), malformed/null-id row (#9), tied timestamps
  (#13), actor with no participant row (#14), bad `tag_code` defensive drop,
  body truncation, `debateId: null` no-query path, query-error throw.
- [x] Accessibility assertions present — component source-scan asserts
  `accessibilityRole` / `accessibilityLabel` / `accessibilityState` on chips +
  refresh + sortable header, `accessibilityHint` on the sort header,
  `hitSlop` for 44×44 targets, the Applied/Removed badge distinguished by
  text + border shape (solid vs dashed) not color alone, and all status
  states carry `accessibilityLabel`ed `<Text>`.

## Blockers

None.

## Suggestions (non-blocking)

1. The doctrine ban-list in `adminMetadataEventsTab.test.tsx` (lines 377-380)
   is a hand-written token list rather than `_forbiddenMetadataTokens()`. The
   data-layer suite uses the canonical list; aligning the component suite to it
   (filtering out tokens that legitimately collide with author-controlled
   content) would keep the two suites in lockstep if the canonical list grows.
   Minor — the current list already covers the doctrine-critical verdict
   tokens.
2. `AdminScreen.tsx`'s tab loop does not set `accessibilityState={{ selected }}`
   on the tab `Pressable`s (the active sub-tab is conveyed by color/border
   only). This is a **pre-existing** gap unchanged by META-1C — the `metadata_events`
   tab simply inherits it. Out of scope for this card; worth a small follow-up
   accessibility card for the whole admin tab strip.
3. The component is verified via a source-scan + pure-view-model tests rather
   than a runtime render (the documented repo pattern, matching
   `adminArguments.test.ts`). This is consistent with the design and the repo,
   so not a defect — but a future card could add a true RTL render pass for
   the admin tabs collectively.

## Operator next steps

- Push the branch: `git push -u origin feat/META-1C-admin-metadata-event-audit-log-surface`
- Open PR: `gh pr create --title "META-1C: Admin metadata-event audit log surface" --body-file docs/reviews/META-1C.md`
- Deploy steps: **none.** META-1C is a pure client-side code change — no
  migration (`db push`), no Edge Function (`functions deploy`), no env var, no
  new dependency. It ships live on merge, provided META-1A's migration is
  already applied to the target environment (it must be, since META-1A is
  merged).
- Recommended post-merge RLS smoke (cannot be unit-tested without a live DB):
  as an admin, open the Metadata Events tab, pick a debate with tags, confirm
  the chronological event list including both `Applied` and `Removed` rows for
  any soft-deleted tag; as a non-admin reaching the tab, confirm only the
  user's own visible debates' tags appear, never the global log.
- Recommended human UI pass: META-1C is a visible-UI card — a manual check of
  the tab on Expo web and native is advised (VoiceOver/TalkBack on native, or
  file as an explicit follow-up).
