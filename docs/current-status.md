# CDiscourse — Current Status

_Last updated: 2026-05-18 (Release 6.6 EV-001 — Evidence object model v1)_

## EV-001 — Evidence object model v1 (Release 6.6)

**Status:** Build complete, awaiting Review.

- New pure-TS module `src/features/evidence/evidenceModel.ts` (+ `index.ts` barrel). No React, no Supabase, no network, no service-role.
- Public surface: types `EvidenceArtifact`, `EvidenceArtifactKind` (6 values), `SourceChainStatus` (6 values incl. aggregate-only `no_source`), `EvidenceRisk` (4 values), `EvidenceAttachmentInput`, `BuildEvidenceArtifactsInput`, `ReceiptChipContract`, `TimelineEvidenceContract`; helpers `classifyEvidenceKind`, `deriveSourceChainStatus`, `buildEvidenceArtifacts`, `summarizeArtifactsForReceiptChip`, `getTimelineEvidenceContract`; frozen enums `ALL_EVIDENCE_ARTIFACT_KINDS`, `ALL_SOURCE_CHAIN_STATUSES`, `ALL_EVIDENCE_RISKS`.
- Persistence path is (b) — pure-TS adapter over the existing `attached_evidence` JSONB. No new migration, no new Edge Function, no change to `submit-argument`, no change to `evaluateArgumentDraft`. `broken` and `primary_present` are admin/override-only; the adapter never auto-derives them.
- Doctrine anchor preserved: missing evidence hard-blocks only `argument_type='evidence'` posts; ordinary replies remain postable. EV-001 asserts this by re-running `evaluateArgumentDraft` with no edits.
- Tests `__tests__/evidenceModel.test.ts` (+64): shape / enum coverage, decision table, adapter id stability + label fallback + 120-char truncation, override merge, receipt-chip worst-status-wins, timeline-node decoration, ban-list (no verdict / person / snake_case tokens in any system string), anti-amplification (no popularity-shaped kinds), and the doctrine anchor. Pre-existing xAI/Anthropic adapter suites (`xaiAdversarial*`, `aiDrivenBotCorpus`, `xaiSeededStancesLive`) remain failing on `main` and out of scope for EV-001.
- See `docs/evidence-object-model.md` for the full reference.

## BRAND-001 — CivilDiscourse global identity (Stage 6.5)

**Status:** complete.

- Canonical PNG committed at `assets/branding/civic-discourse-logo.png` (1370×1148, cream-on-black full lockup).
- New `BRAND` token group in `src/lib/designTokens.ts`: `surface.app` (`#08060F`) and `surface.appElevated` (`#13101D`) for the dark backdrop and one-step-up card / rail tone; `text.primary` (`#F5EDE0`) is the canonical cream that pairs with the backdrop at >14:1 contrast.
- New `src/components/AppHeader.tsx` — top bar mounted in `AppRoot` so it persists across every session state (unconfigured / signed_out / signed_in). Logo on the left tied to a state-only deselect (re-dispatches `SIGNED_IN`), no router. Right-side slot composes with the existing user / observer chrome. Text-only `CivilDiscourse` wordmark fallback if the asset is ever missing.
- Global dark backdrop applied at the app root, tab bar, room toolbar, invite panel, action bar, and `src/components/Screen.tsx` (which wraps `AuthScreen` / `AccountScreen` / `AdminScreen`). Stage 6.4 functionality (observer rail collapsed, gallery dedupe, deletion-request flow) unchanged.
- Tests `__tests__/appHeader.test.ts` (24): BRAND token contract; AppHeader source contract; App.tsx wiring; asset committed (>10KB, PNG magic bytes valid). TL-003 no-route invariant preserved.

## Now / Next / Later — UX board tracker

Mirror of the UX/UI roadmap on [GitHub Project #1](https://github.com/users/kyleruff1/projects/1). Canonical source: [`docs/ux-ui-project-board.md`](ux-ui-project-board.md). Keep this section in sync with the board doc — do not duplicate per-card acceptance criteria here.

- **Active product stage:** Stage 6.4 (shipped 2026-05-18).
- **Next UX target:** Release 6.5 — Timeline-first polish. Start with [TL-001 Make Timeline the default room landing mode](https://github.com/kyleruff1/cDiscourse/issues/1) and the rest of the Timeline epic; followed by the Sidecar Rail consolidation (SC-001 / SC-002), Strong-vs-weak bands (SW-001), and the Visual Grammar pass (VG-001 / VG-003). Project-mgmt slice (PM-002 + QOL-017 / QOL-018) lands alongside.

### Now — Release 6.5 (Timeline-first polish)

Goal: make Timeline the primary surface and tighten the side rail / stack / visual grammar around it.

- Timeline epic: TL-001 default landing mode (P0/M), TL-002 onboarding focus on the first point (P0/S), TL-003 board shell with no page redirect (P0/M).
- Sidecar Rail epic: SC-001 consolidate controls into the side action rail (P0/L), SC-002 timeline node popover (P0/M).
- Visual Grammar epic: VG-001 shape / color / weight / texture (P0/L), VG-003 Bootstrap-inspired design tokens (P1/M).
- Strength-Weakness epic: SW-001 strong vs weak talking-point bands (P0/M).
- Stack Detail epic: ST-001 reposition Stack as Card Details (P1/S).
- Project Mgmt slice: PM-001 board doc ✅, PM-002 NNL tracker (this card), QOL-017 GitHub Projects sync script, QOL-018 repo-local agent charters.

### Next — Release 6.6 (Branches and evidence)

Goal: branch grammar + first-class evidence layer + heat / momentum visuals without truth claims.

- Branches: BR-001 tangent kink model (P0/L), BR-002 split-screen branch inspector (P2/XL).
- Evidence: EV-001 object model v1 (P0/L), EV-002 source-chain popover (P0/M), EV-003 debt tracker (P1/L), EV-004 symmetry with game rules (P1/M).
- Visual Grammar: VG-002 gradient wave rail (P0/L).
- Strength-Weakness: SW-002 heat / momentum / trend without truth claims (P1/M).
- Interaction: IX-001 timeline zoom and density modes (P1/L).
- Sidecar Rail: SC-003 sidecar as detail inspector, not action dumping ground (P1/M).
- Stack Detail: ST-002 suggested reply flags per bubble card (P1/M).
- Gallery: GAL-001 sections-as-play-lanes (P1/M), GAL-002 entry cards with first suggested move (P1/M).
- Rules UX: RULE-001 semantic rule-to-UI map (P1/M), RULE-002 evidence symmetry between validation and visuals (P1/M).
- Analytics: QOL-019 bot tester prompt refresh (P1/M), QOL-020 open-room engagement runner patch (P1/M).

### Later — Release 6.7 (Profiles + interaction polish)

Goal: profile / preferences surfaces and the deeper interaction-accessibility pass.

- Interaction: IX-002 timeline mini-map overview (P2/L), IX-003 keyboard and accessibility navigation (P1/M).
- Profile: PR-001 my preferences popout (P1/M), PR-002 profile tag popout (P2/M), PR-003 avatar upload policy and storage (P2/L), PR-004 contact information update (P2/L).
- Analytics: AN-001 deterministic board diagnostics (P2/M).

### Later — Release 6.8 (Public dev deployment)

Goal: cdiscourse.com/dev hosting + admin-email + auth audit before any public surface goes live.

- Hosting: HOST-001 dev hosting architecture (P0/L), HOST-002 dev environment banner and safety boundary (P0/S), HOST-003 deployment smoke checklist (P0/S).
- Analytics: AN-002 visual QA snapshots (P2/M).
- Project Mgmt: QOL-015 admin email delivery validation — mock first, live operator-gated (P0/M), QOL-016 Supabase Auth email + redirect settings audit (P0/M).

### How this section is maintained

- Update only when a card moves between Now / Next / Later, when a release closes, or when a new card is added.
- Per-card acceptance criteria live in the GitHub issue body, not here.
- Test counts in the per-stage entries below are updated **only after the corresponding implementation lands**, not when this tracker is edited.

### In-room no-route invariant (TL-003)

The room board is a single stateful surface, not a set of routes. All view changes — Cards ↔ Timeline toggle, quick actions, sidecar focus, popovers (when SC-002 lands), composer open/close — happen via `useState` setters in `MainAppShell`. The repo intentionally has **zero** routing libraries installed (no `@react-navigation/*`, no `expo-router`, no `react-router*`). New roadmap cards must preserve this invariant — `__tests__/inRoomNoRoute.test.ts` enforces it by static-scanning the in-room components, `package.json`, and the Cards/Timeline toggle wiring. The dev banner is the single exception that may call `Linking.openURL` (Report-issue link) — and lives outside the room shell.

## Current Stage

**Stage 6.4 complete — Seamless Conversation Entry + Observer-first Side Action Rail.** UI / UX only. No xAI, Anthropic, or X API calls. No Supabase writes beyond existing user actions. No service-role.

- **Observer-first entry.** Opening a debate from the Conversation Gallery defaults to Observer / read mode. Existing participants keep their actual side; everyone else enters with `side='observer'`. No "choose side" modal on entry. The `JoinDebatePanel` mount path is preserved but reached only by an explicit in-rail Join Aff / Join Neg action.
- **`ArgumentSideActionRail.tsx`** — collapsed by default for observers. Observer set: `Watch · Join For · Join Against · Ask source · Open timeline · Share`. Participant on another bubble: `Reply · Disagree · Ask source · Ask quote · Split branch · Flag · Qualifiers`. Own bubble: `Qualifiers · Request deletion` only (no edit, no disagree, no flag, no score). Each action carries a short helper string.
- **Smart entry hints** — `deriveConversationEntryHint(card)` pre-activates the right message per bucket and shows a one-line micro-moment prompt: `needs_rebuttal → root + "Be the first rebuttal"`, `source_chain_fight → first open challenge + "Ask for the source"`, `evidence_fight → first open challenge + "Challenge the mechanism"`, `unresolved_deep_chain → latest + "Try narrowing or offer a synthesis"`, `pedantic_plain → root + "Watch first — quiet room"`, etc.
- **Section grouping** — `groupGalleryCardsBySection(cards)` partitions cards into the six Stage 6.4 entry sections (Jump into a live dispute · Needs first rebuttal · Source trail fights · Hot but unresolved · Easy first move · My rooms). Each card lives in exactly one section by priority.
- **Gallery action labels** — `Observe →` / `Continue →` / `Open →` with secondary "Jump in from inside". The old "Tap to join →" is reserved for the in-rail Join action.
- **Plain-language copy** — `gameCopy.toPlainLanguage(code)` maps internal codes (`topic_satisfaction_lexical`, `source_chain`, `anti_amplification`, `evidence_debt`, `platform_support_warning`, `validation_failed_after_retries`, `max_depth_reached`, `synthesis_ready`, `submit_failed`, `observer`, `moderator`, etc.) into normal-user prose. `toPlainLanguageOrSuppress` is the recommended call for normal-user surfaces — unknown codes are silently dropped.
- **Internal codes blocked from normal-user UI.** `looksLikeInternalCode(s)` flags snake_case / HTTP-status reasons; recommended for defensive renderers.

### Test commands run

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — **1805 / 70 suites passing** (+33 new seamless-entry tests).

### What's NOT done

- Wide-screen vertical rail (currently bottom-docked at all widths).
- Animated rail expand/collapse.
- Section-view toggle inside the gallery (single paginated list remains the default; section grouping is exported and tested for future wiring).
- Voting UI (still placeholders only).

_Last updated: 2026-05-18 (Stage 6.3 — Conversation Gallery + horizontal timeline UX)_

## Current Stage

**Stage 6.3 complete — Conversation Gallery + horizontal argument timeline.** UI / model only; no xAI, Anthropic, or X API calls; no Supabase writes; no service-role; no DB migration.

- **Visual dedupe.** Replaces the row-per-debate sortable table with a card-per-conversation gallery. `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` rooms collapse into one card per canonical conversation/thread family with `N duplicate runs collapsed` shown inline. Underlying debate rows are untouched.
- **Pure model** at `src/features/debates/conversationGalleryModel.ts` exports `ConversationGalleryCard`, `ConversationGalleryBucket`, `ConversationHeatLevel`, `ConversationTemperament`, `ConversationSignal`, `ConversationSortMode`, `ConversationDedupeMode`, plus `buildConversationGalleryCards`, `dedupeConversationCards`, `classifyConversationBucket`, `computeConversationHeat`, `computeConversationTemperament`, `getConversationSignals`, `getConversationSearchText`, `sortConversationGalleryCards`, `paginateConversationGalleryCards`.
- **Buckets**: `needs_rebuttal`, `gaining_heat`, `hot_now`, `source_chain_fight`, `evidence_fight`, `definition_scope_fight`, `pedantic_plain`, `unresolved_deep_chain`, `resolved_or_synthesized`, `my_rooms`, `all_open`.
- **Heat model**: deterministic score in [0,1] from recency, move count, rebuttal count, participant count, source-chain hits, evidence hits, challenge run length, hostile tone hits, and `platformSupportWarning`. Levels: `cold` / `warming` / `hot` / `overheated`. **Popularity is not factored as truth credit.**
- **Temperament**: `plain` / `curious` / `sharp` / `pedantic` / `evidence_heavy` / `source_chain_heavy` / `chaotic` / `near_resolution`.
- **UI**: `ConversationGalleryScreen.tsx` with search, bucket chips, sort chips (latest activity / newest / heat / needs-rebuttal-first / most moves / oldest unresolved), page size (12 / 24 / 48), and a result count showing `N rooms · K duplicate runs collapsed`. Each card shows headline + heat pill + temperament pill, title, starter, FIRST POST excerpt, LATEST move excerpt + author, mini horizontal timeline, moves / replies / participants stats, signal chips.
- **Mini timeline**: `ConversationMiniTimeline.tsx` — one dot per posted move on a SINGLE horizontal baseline (no diagonal scatter). Tinted band underlays for `first_clash` / `evidence_run` / `hot_zone` / `source_chain_run`. Unresolved (`!`) + resolved (`★`) end markers.
- **Full timeline rail (in-room) fix**: `argumentGameSurfaceModel.ts:computeLane` now keeps the first child of a parent on the parent's lane (chain continues on the same horizontal line). Additional siblings branch above/below. Prior parity-driven assignment caused diagonal scatter; that is gone.
- **Data loading**: `listArgumentsForDebateIds(ids, limit=1500)` in `argumentsApi.ts` does one `.in('debate_id', ids)` query for the gallery's batched needs. `useGalleryArguments` hook caches by sorted-id signature. RLS still gates row visibility.
- **Future voting**: reserved `voteScorePreview?: null`, `winnerPreview?: null`, `promotedArgumentCount?: 0` on the card — no UI in this stage.

### 50-scenario corpus rerun with dynamic axis (parallel verification)

Earlier in this session the **100-harvest + 50-scenario corpus** finished (`bxnblrobb`). With the dynamic-axis upgrade from the prior commit:

- **320 / 320 moves posted, 0 rejected** across 32 rooms (cap by source count from the harvest).
- 256 renders with `chosenAxis`; **247 / 256 (96.5%) `jsonParsed`**; **210 / 256 (82%) axis-overridden** by Anthropic vs round-robin fallback.
- 8 distinct disagreement axes used: `source_chain` 50 · `scope` 50 · `evidence` 44 · `logic` 39 · `definition` 39 · `causal` 29 · `fact` 3 · `framing` 2.

### Test commands run

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm run test` — **1772 / 69 suites passing** (+50 gallery model + 6 mini-timeline helper tests + 1 timeline-map lane assertion update).

### What's NOT done

- Voting UI (placeholders only).
- Wide-screen sidecar layout (still single-column docked below the map at all widths).
- Optional DB view for gallery-scale debate loads.
- Soft-cleanup of the older `DebateListScreen` (kept mounted behind a `false` guard for back-compat tests).

_Last updated: 2026-05-17 (Stage 6.1.9 follow-up — dry contract stabilized + M1/M2 seed exemption tests)_

## Current Stage

**Stage 6.1.9 follow-up complete — stabilize xAI adversarial dry contract and prove M1/M2 seed validation is keyword-stuffing-free.**

What changed in this pass:
- **Dry JSONL contract fixed**: the harvester now writes to `<runId>-xai-adversarial-harvest.jsonl` (was colliding with the runner's `…-semantic-corpus.jsonl`). The runner's dry mode now emits the full required event set, **plus** four new granular events: `bot_assignment`, `move_prompt_built`, `move_rendered`, `move_validated`. Existing `bot_move_render` retained for back-compat. Every event still carries `skillGate` with both skill hashes.
- **M1/M2 keyword exemption**: Stage 6.2 already converted topic OFF_TOPIC and parent-overlap PARENT_NONRESPONSIVE to advisory. New `__tests__/seedM1M2NoKeywordStuffing.test.ts` (7 tests) proves: a root thesis with zero overlap with the room resolution posts; a parent-linked rebuttal with zero overlap posts; a target_excerpt that is a substring of the parent body silences the rail entirely; an off-topic tangent at m3+ still surfaces an advisory warning but is not blocking. Pure-function tests against the shared engine the Edge Function uses on the server side.
- **Deploy gap surfaced**: the tiny live app import (Phase 5) succeeded structurally but the deployed `submit-argument` Edge Function still enforces the **pre-Stage-6.2** OFF_TOPIC hard block. Local code is correct; deployment is needed to pick up the advisory change. Operator must run `npx supabase functions deploy submit-argument --linked` for the patch to take effect server-side. Until then, ~25% of moves at m3+ will still bounce with `topic_satisfaction_lexical: appears off-topic`.
- **No service-role, no direct insert, no `.env*` touched, no `console.log` of secrets.** Skill gate validated for every JSONL event.

### Run results

| Phase | Run | Result |
|---|---|---|
| P0 — baseline | `npm run skills:validate` | OK (provocateur `d8cf0cd9ea662501`, revocateur `44d12e0cfadb7fa7`) |
| P0 — typecheck | `npm run typecheck` | clean |
| P0 — lint | `npm run lint` | clean |
| P0 — tests | `npm test` | **1671 / 65 suites passing** (+7 new seed tests since Stage 6.2 commit) |
| P3 — dry harvest | `npm run engagement:intel:xai:adversarial:dry` | 5 sources, 5 usable, 0 synthetic |
| P3 — dry bot corpus | `npm run bot:fixture:xai-adversarial:dry` | 421 events, all 15 stages emitted |
| P4 — tiny live xAI | `npm run engagement:intel:xai:adversarial:tiny` | 5 sources, 30 replies scanned, 4 usable, 3 synthetic, no identifier leaks |
| P5 — tiny live app | `runXaiAdversarialBotCorpus.js --harvest-file … --pilot --scenarios 5 --max-depth 6` | 5 rooms created, 18 attempts, **13 posted / 5 rejected**, all 5 rejections are pre-Stage-6.2 OFF_TOPIC blocks from the deployed Edge Function. Anthropic: 14 calls / ~49k input / ~1.6k output tokens. Skill gate validated. M1 succeeded for all 5 rooms; M2 succeeded for 4 of 5. |
| P6 — full run decision | not run | Gated on operator deploy of `submit-argument` to remove the OFF_TOPIC hard block. |

**Live calls this session:** xAI live (1 harvest), Anthropic live (1 corpus run, 14 calls), Supabase writes (5 debates + 13 arguments). All gated, all redacted, all routed through `submit-argument`.

**Cleanup notes for operator:** the 5 new tiny-test debate rooms are still in Supabase. Earlier sessions left ~10 more. They can be soft-deleted via the admin Edge Function when convenient.

**Stage 6.2 complete — normal-user UX rescue: timeline map, sidecar, score tracker, advisory validation.** Replaces the form-heavy compliance workflow with a playable argument game.

Highlights:
- **Pure timeline map model** (`buildArgumentTimelineMap` in `src/features/arguments/argumentGameSurfaceModel.ts`). One node per posted message, earliest left → latest right, parent-child edges, lane assignment by reply depth/sibling parity, junction detection (`isJunction` + `junctionGroupId`), detached-parent handling (`isDetached`), active-path walk, deterministic bands (`Opening` / `First clash` / `Evidence run` / `Hot zone` / `Current endgame`), participant trends with sparkline, color legend. Future-ready fields for branch/junction splitting.
- **Full-room message loader** (`useArgumentRoomMessages` + `listArgumentsForDebate`). Stack + Timeline share the same complete conversation; Stack no longer reads `visibleArgumentIds`.
- **Normal-user routing**: Stack default; Timeline opens the new graphical map (not the old Tracks/lane screen). Old `tree` / `tracks` chips are visible only when `__DEV__`. Switching modes preserves the active message.
- **Graphical timeline map** (`ArgumentTimelineMap.tsx`): horizontally scrollable, 44px+ tappable nodes, segmented gradient connectors built from `<View>` strips (no new dependency), bands above the rail, active glow ring, latest marker, junction "N routes" pill, detached pill, dropped-tag chips, Prev/Next/Latest controls, color legend, auto-scroll-to-active.
- **Reply detail sidecar** (`ArgumentReplySidecar.tsx`): read-only context (kind / side / actor / timestamps / parent preview / reply count / active-path / tags / standing / tone / junction & detached hints) plus quick actions (`Reply`, `Challenge`, `Source?`, `Quote?`, `Clarify`, `Evidence`, `Concede`, `Branch`, `Flag`, `Qualifiers`). Own-message actions limited to `View qualifiers` and `Request deletion`. No body-editing affordance.
- **Score tracker** (`ArgumentScoreTracker.tsx` + pure `argumentScoreModel.ts`): per-participant standing in the 7-band scale (`Pretty wrong` → `Slightly wrong` → `Neutral` → `Slightly right` → `Maybe right, but misguided` → `Pretty right` → `Completely right`, plus internal `Unscored` / `Not enough signal`). Tone + temperature bands derived from civility flags + body length. Hot-but-sourced messages map to `Maybe right, but misguided`. Score never blocks posting and never declares a winner.
- **Composer simplification**: target excerpt moved under `Advanced anchor quote` (collapsed); disagreement axis renamed to **Optional focus — what are you challenging?** (no `required` label); tag selectors collapsed by default; evidence fields collapsed unless argumentType is Evidence; body input moved to the top; CTA renamed to `Post move`; validation panel now shows `Ready` / `Advisory` / `Structural issue` chips. Matched/missing term lists hidden from normal users (dev-only disclosure).
- **Quick-action presets** (`quickActionPresets.ts` + composer `initialPatch` prop): Challenge → rebuttal/counter-rebuttal without forced axis; Source? / Quote? / Clarify → clarification_request with appropriate tag; Evidence → evidence type (fields auto-expand); Concede → concession (no exact phrase required); Reply / Branch / Flag have no destructive defaults.
- **Validation rails — advisory not blocking** (client + supabase shared mirror): the following are now warnings, not hard blocks — low topic score, low parent overlap, missing target excerpt, missing concession marker, missing clarification question structure, missing disagreement axis, short-but-nonempty body. **Hard blocks remain** for empty body, over-max body, invalid transition, explicit Evidence post without source.

**No service-role.** **No client AI calls.** **No new DB tables.** **No new dependencies.** Old `ArgumentTimelineScreen` (Tracks/lane) stays in the codebase but is no longer reachable for normal users.

### Test commands run
- `npm run typecheck` — pass.
- `npm run lint` — pass (0 errors, 0 warnings).
- `npm test` — **1664 / 64 suites passing**. Targeted suites:
  - `argumentTimelineMap.test.ts` — 37 tests (M1).
  - `quickActionPresets.test.ts` — 9 tests (M7).
  - `advisoryNotBlocking.test.ts` — 10 tests (M9).
  - Existing composer / rails / evaluate suites updated to assert the new advisory contract.
- Live API runs: **none** (no Anthropic, no xAI, no service-role; no `.env*` touched; no Supabase write).
- Browser/Expo Web verification: **not performed in this pass** — remains a manual QA step.

### What's NOT done
- The future branch/junction split-screen view (model is ready; UI not built).
- Auto-pulse / subtle motion polish on the map (no new RN animation lib added).
- Full sidecar-side rendering on wide-screen Timeline mode (sidecar currently docks below the map at all widths; layout placement is single-column).

**Stage 6.1.8 complete (Argument Stack + Timeline game surface; deletion request workflow).** Replaces the argument-room thread/comment surface with an interactive bubble stack + horizontal DAW-style timeline. Latest message is active by default and visually on top. Pure-TS model in `src/features/arguments/argumentGameSurface.ts` (types: `ArgumentSurfaceMode`, `ArgumentBubbleActor`, `ArgumentBubbleControl`, `ArgumentTimelineSegment`, `ArgumentBubbleViewModel`, `ArgumentSurfaceState`; helpers: `buildArgumentBubbleViewModels`, `sortMessagesChronologically`, `getLatestMessageId`, `getPreviousMessageId`, `getNextMessageId`, `getBubbleControlsForActor`, `getDisplayTitle`, `getTimelineSegments`, `getStackTransformForIndex`). Stack uses scale + translate + rotate + opacity + zIndex transforms to fan older cards behind the active one. Timeline is a horizontal scrubber with beginning/middle/end timestamps below the rail. New components: `ArgumentGameSurface`, `ArgumentBubbleStack`, `ArgumentTimelineScrubber`, `ArgumentBubbleCard`, `ArgumentBubbleActions`, `ArgumentDraftQualifierCards`, `DeletionRequestSheet`. Bubble controls are actor-aware: **own bubbles never expose body-edit / disagree / flag / reply / score controls** — only `view_qualifiers` + `request_deletion`. Debate title is optional (`src/features/debates/debateTitleApi.ts` + pure `debateTitleHelpers.ts`); when empty, the room shows the root claim body excerpt; max 120 chars; updating the title never mutates `public.arguments.body`. New migration `20260517000008_stage6_1_8_argument_deletion_requests.sql` (table + 5-state status check + partial unique index + 3 RLS policies). New Edge Function `request-argument-deletion` (JWT-verified, caller-scoped argument-author check, optional Resend notification with graceful `not_configured` fallback, never returns admin email addresses, never logs Authorization headers or RESEND_API_KEY). New `requestArgumentDeletion` client wrapper. **No Anthropic / xAI / X API / Supabase write by Claude in this stage** (migration + Edge Function are not deployed — operator must deploy). Stage 6.1.6b Admin Arguments / Debate list tables remain unchanged. +60 new tests across `argumentGameSurface.test.ts` (30), `argumentDeletionRequest.test.ts` (20), `debateTitleApi.test.ts` (10). **1425 tests / 58 suites passing**, typecheck + lint clean. See `docs/argument-stack-timeline-surface.md`.

**Stage 6.1.7 complete (xAI adversarial thread corpus — scaffold; live pilots operator-gated).** New runner `scripts/bot-fixtures/runXaiAdversarialThreadCorpus.js` turns the xAI Responses API + `x_search` tool into a structured adversarial thread corpus. Provider abstraction (`scripts/engagement-intelligence/xaiAdversarialProvider.js`) exposes `xaiResponsesProvider` (default — Responses API surfaces explicit citation refs so the report can keep metric-vs-inferred ranking honest) and `legacyXaiChatSearchProvider` (chat/completions + `search_parameters` fallback). Both gated, both refuse without `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_XAI=true` + `XAI_API_KEY` + `--pilot`. New modules: `xaiAdversarialSourceCollector` (candidate pool, redacted, deterministic seeded sample), `xaiReplyCollector` (top-12 replies, `topReplyMethod` honestly downgrades `metric_ranked` → `provider_inferred` when no numeric metrics are present), `selectFirstDisagreeableReply` (threshold `disagreementScore ≥ 0.35`, prefers mixed-agreement classes, builds synthetic fallback marked `excludedFromRealEpidemiology`), `xaiAdversarialSceneBuilder` (3-bot scene with deterministic skill assignment, every persona carries a test-bot identity disclaimer), `xaiAdversarialReport` (committable Markdown). The runner reuses the existing `aiMoveRenderer` + `submit-argument` flow (no direct insert into `arguments`, no service-role usage) and the v2 annotation pipeline (Anthropic with deterministic fallback). Streams every event to a gitignored JSONL under `logs/engagement-intelligence/` (event types: `run_start`, `provider_query`, `source_candidate`, `source_selected`, `reply_candidate`, `reply_selected`, `synthetic_rebuttal_generated`, `debate_created`, `bot_assigned`, `move_prompt_built`, `move_generated`, `move_validated`, `move_submitted`, `annotation_completed`, `point_standing_candidate`, `room_resolved`, `room_stalemate`, `run_max_depth`, `run_summary`). Continuation loop stops at: explicit concession / synthesis / soft concession/synthesis marker / max depth / 3-in-a-row submit failures. **Engagement credit and factual-standing eligibility remain SEPARATE scores throughout.** New npm scripts: `bot:fixture:xai-adversarial:dry / :3 / :50`. Dry run produced the JSONL + Markdown shape end-to-end with no network. **No Anthropic / xAI / X API call by Claude in this stage.** +45 new tests. **1360 tests / 54 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.7".

**Stage 6.1.6b complete (timestamp columns as first-class dimensions).** Admin Arguments and the Debate list are now real tables with explicit `Created` and `Last Updated` columns — not cards with timestamp text. `AdminArgumentsTab` columns: Status · Side · Type · Debate / Argument · Category / Qualifier · **Created** · **Last Updated** · Action. `DebateListScreen` columns: Status · My Side · Debate · **Created** · **Last Updated** · Action. Column headers for Created and Last Updated are `Pressable` buttons with `accessibilityRole="button"` and `accessibilityState={{ selected: active }}`; the active column shows `↓ newest first` or `↑ oldest first`, plus a `Sort by <label>` accessibility label so screen readers can navigate them. Each timestamp cell renders the absolute time and the relative age as **separate stacked `<Text>` elements** — no prose concatenation. Both tables wrap in a horizontal `ScrollView` so columns never collapse into card metadata on narrow viewports. Sort fields use **real `Date.getTime()`** comparisons; missing `updated_at` falls back to `created_at` for both display and sort with an inline `same as created` hint. New per-cell testIDs: `admin-arguments-table`, `admin-arguments-header-created`, `admin-arguments-header-updated`, `admin-arguments-cell-created`, `admin-arguments-cell-updated`, plus the matching `debates-*` set. Default sort remains `updated_at desc`. Plain-language sort labels (`Newest activity` / `Oldest activity` / `Newest created` / `Oldest created`), helper copy, and activity legend all carry forward. **No Anthropic / xAI / X API / Supabase write / service-role usage in this stage.** +10 new test assertions on top of the 6.1.6a suite. **1315 tests / 52 suites passing**, typecheck + lint clean.

**Stage 6.1.6a complete (Admin Arguments timestamp sorting + Poppy UI clarity pass).** Admin Arguments and the Debate list now expose explicit `Last Updated` and `Created` timestamp columns with toggleable sort. Default sort is `updated_at desc`. Plain-language sort chips (`Newest activity` / `Oldest activity` / `Newest created` / `Oldest created`), a visible `Sorted by: <Column> ↓/↑ (<plain label>)` status, helper copy (`Use Last Updated to find active conversations. Use Created to find newest rooms.`), and an activity legend (`Activity = most recent argument update · Created = original post/room creation time`) make the surfaces inspectable at a glance. Each row shows both `formatDateTime` + `formatRelativeShort` (`May 17, 2026, 11:42 · 8m ago`). When `updated_at` is missing, the UI labels the cell `Last Updated: same as created` and reuses the created timestamp. Empty/loading/error/filtered-empty states explain what the admin is seeing (`Loading latest argument activity… (sort: Last Updated ↓)`, `Could not load argument activity. Check admin access and try again.`, `No arguments match this search. Try clearing filters or increasing the limit.`). `AdminHistoryTab` was polished in the same pass — audit events now render via `formatDateTime` + `formatRelativeShort` with an actionable `Sorted by: Created ↓` status. The Debate list (`DebateListScreen`) gained the same sort toolbar + per-card timestamps. `adminArgumentsApi.loadAdminArguments` accepts `sortField` (`updated_at | created_at`) and `sortDirection` (`desc | asc`) and threads them into the Supabase `.order()` call. **No Anthropic / xAI / X API call by Claude in this stage.** **No Supabase write.** **No service-role usage.** **No env file or secret touched.** +47 new tests across `adminArguments.test.ts`, `adminArgumentsSort.test.ts`, and `debateListSort.test.ts`. **1305 tests / 52 suites passing**, typecheck + lint clean.

**Stage 6.1.5.2 complete (anti-amplification doctrine + xAI X Search seeder + political frame).** Encodes the doctrine that popularity / repetition / engagement velocity / political identity are NOT evidence. Every annotation now carries `politicalIssueFrame` (14 values), `politicalValence` (12 values, describes TEXT not user), `amplificationSignals` (10-bool object), `evidentiaryRisk`, `amplificationRisk`, `platformSupportWarning`, `recommendedGameTreatment` (9 values), `justification` (text-feature only), plus 9 new `deterministicRuleCandidate` boolean flags. Schema bumped to v2. New pure-TS module `src/features/pointStanding/antiAmplification.ts` post-processes a `PointStandingDelta`: amplification earns engagement credit but never factual-standing credit; narrowing / sourcing / clarification earns the conversion bonus. `loadXaiSeedsLive` is now wired to `POST /v1/chat/completions` with xAI Live Search (`search_parameters`), gated behind the existing env + `--pilot` flags. `runAiDrivenCorpus.js` captures `submitErrorDetail` per move; the intelligence report shows it plus new aggregate sections (political frame distribution, amplification signals fired, rule flags fired, platformSupportWarning examples, claims that should NOT receive factual standing, claims that could receive standing AFTER evidence, viral-without-evidence examples, political-generalization examples). `runTinyXNewsPilot.js` appends a deterministic anti-amplification annotation section to the existing X News pilot report — per-root + per-reply political/amplification fields + aggregates + recommendations. **No Anthropic / xAI call by Claude in this stage.** +57 new tests. **1258 tests / 50 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.5.2".

**Stage 6.1.5.1 annotation pipeline complete (scaffold; live pilots operator-gated).** Adds an optional Anthropic-driven annotation pass on top of the AI-driven corpus runner. Pure-TS schema `src/features/engagementIntelligence/anthropicArgumentAnnotations.ts` defines `AnthropicArgumentAnnotation` (`messageCategory`, `primaryRhetoricalArchetype`, `opinionVector`, `agreementDisagreementVector`, `issueDebtSignal`, `gameImplication`, `evidenceSignals`, `threadSignals`, `modelJustification`, `deterministicRuleCandidate`, `annotationSource`, `userReviewRequired: true`). Every output is advisory and carries `userReviewRequired: true`. Forbidden verdict tokens (liar / dishonest / bad faith / manipulative / extremist / propagandist / winner / loser / stupid / idiot) are banned from any annotation field and stripped from input bodies before they appear in the report. New JS modules under `scripts/bot-fixtures/`: `anthropicAnnotationPrompt.js` (system + user prompt builder with full safety constraints), `anthropicArgumentAnnotator.js` (gated Anthropic call → strict JSON parse → schema validate → single retry → deterministic fallback; never blocks the corpus run), `deterministicArgumentAnnotator.js` (pure-JS fallback mirroring the full schema, classifies category / archetype / issue debt / game implication / rule candidate from local fields), `aiArgumentIntelligenceReport.js` (per-room transcript + aggregate distributions + top-20 rule candidates + sample interest areas + recommendations Markdown writer with redactor that scrubs emails / JWTs / `sb_secret_` / `sk-ant-` / `xai-` / forbidden tokens). `runAiDrivenCorpus.js` accepts new flags `--annotate / --annotation-only / --annotation-jsonl <path> / --deep / --report-name / --max-moves-per-room / --min-moves-per-room`; the live submit loop runs annotation after each move and streams to a gitignored JSONL. New npm scripts: `bot:fixture:ai:annotated:dry`, `bot:fixture:ai:3:annotated`, `bot:fixture:ai:50:annotated`. **No Anthropic / xAI call by Claude in this stage** — the dry path produces a complete annotated Markdown using deterministic fallback only. +45 new tests cover prompt safety (forbidden-token enumeration, no key/Bearer leakage), annotator validation (rejects bad shapes, clamps numerics, retries on invalid JSON, deterministic source on error), deterministic shape coverage (every argument type, archetype mapping), report safety (verdict tokens redacted, secrets stripped, source file safety), and runner wiring (flags, file-level: no service-role, no Authorization literal, routes Anthropic through `claudeMessagesClient`). **1210 tests / 46 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.5.1 — annotation pipeline".

**Stage 6.1.3.2b complete (xAI auth probe Windows clean-exit patch).** The live xAI auth probe (`engagement:intel:xai:probe:live`) was authenticating cleanly (`status=200`, `category=auth_ok`) but Node on Windows printed a `UV_HANDLE_CLOSING` assertion immediately after — a process-cleanup bug, not an auth bug. Patched `scripts/engagement-intelligence/xaiAuthProbe.js` to explicitly cancel/drain the response body, drain the event loop, set `process.exitCode` instead of calling `process.exit()`, and treat an empty-string `XAI_API_KEY` in `process.env` as "no key" (matching `safeEnvSnapshot`). Live probe now exits cleanly with code 0; no Windows assertion. xAI classification remains disabled by default. **1165 tests / 41 suites passing**, typecheck + lint clean. See `docs/x-api-and-xai-setup.md` § "Stage 6.1.3.2b".

**Stage 6.1.5.1 complete (Admin Arguments + message qualifier taxonomy + game recommendations).** Live AI corpus from Stage 6.1.5 completed clean — 3 rooms × ~13 moves = **38 / 38 posted, 0 failures** (`docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md`, run id `2026-05-17T05-33-03-863Z-fc5b47a8`). Stage 6.1.5.1 surfaces that data: new `AdminArgumentsTab` reads `public.arguments` via existing admin RLS (no Edge Function change, no migration), shows `created_at` + `updated_at`, and decorates each row with `MessageCategory` + `MessageQualifier` badges + UI nudges. Pure-TS `src/features/arguments/messageQualifiers.ts` defines 13 categories × 26 qualifiers; vocabulary tests assert zero verdict tokens. New `src/lib/formatDateTime.ts`. New docs: `docs/message-qualifier-taxonomy.md`, `docs/game-qualifier-recommendations.md`. No Anthropic / xAI call by Claude in this stage. +67 new tests. **1157 tests / 41 suites passing**, typecheck + lint clean.

**Stage 6.1.5 scaffold (AI-driven bot test rooms; live runs operator-gated).** Adds an AI-driven fixture path: real-world topic stances seed the thesis (synthetic by default; xAI X Search scaffold), each subsequent bot move body is generated by Anthropic (Claude) conditioned on the persona's skill + Constitution transitions + concession-marker rule + forbidden-phrase list. Posts go through the existing `submit-argument` flow. New files in `scripts/bot-fixtures/` (`claudeMessagesClient.js`, `aiBotPersonas.js`, `aiMoveRenderer.js`, `runAiDrivenCorpus.js`) + `scripts/engagement-intelligence/xaiSeededStances.js` + synthetic seed fixture + `docs/ai-driven-bot-rooms.md`. New npm scripts: `bot:fixture:ai:dry / ai:3 / ai:50`. Anthropic + xAI both fail-closed; **no Anthropic call has been made by Claude in this session**. +28 new tests. **1090 tests / 38 suites passing**, typecheck + lint clean.

Narrow exception to the "Do not call Anthropic" rule: the bot-fixture runner only — gated behind env + `--pilot`. Production app still must not call Anthropic.

**Stage 6.1.4 complete (point-standing economy, pure-TS engine, not auto-wired).** Adds the scoring layer above the Constitution: `PointStandingDelta`, `OpenIssueDebt`, `ScoringEligibility`, `ConcessionEffect` + weight tables, `MIXED_CLASS_WEIGHTS`, `GradingQuestionSet`, and an in-memory `IssueDebtLedger`. Two public functions: `gradeChallenge(input)` (opens debts) and `gradeRepair(input, options)` (closes debts via concession / narrowing / synthesis, or penalizes evasion). Doctrine encoded: **concession is a scoring repair, not a scoring defeat** — a narrow explicit concession lifts broad standing AND pays the responder recovery credit, while evasion pays an unresolved-debt penalty. Anti-exploit gates block tangent / near-duplicate / self-concession-loop / no-axis-identified moves. Credit is awarded at most once per debt. **Not auto-wired into the existing argument room** — a future stage adds the Supabase ledger + Edge Function + UI nudges. +24 new tests (worked bike-lane example, evasion example, anti-exploit, doctrine, ledger). **1062 tests / 37 suites passing**, typecheck + lint clean. See `docs/point-standing-economy.md`.

**Stage 6.1.3.3 scaffold complete (live pilot operator-gated).** Added the mixed-agreement taxonomy (`MixedAgreementClass`, `MixedAgreementFlags`, `GradingFlags`, breadth bands, `playableTensionScore`, suggested game nudges) in both TS and JS, plus a `runTinyXNewsPilot.js` orchestrator that gates on `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_X_API=true` + `X_BEARER_TOKEN` + `--pilot`. Refuses if xAI is accidentally on (`--allow-xai` is NOT to be passed in this stage). Hard caps at 5 stories × 3 posts × 12 replies (180 reply pairs). Redacted JSONL stays local-only at `data/engagement-intelligence/redacted/`; aggregate Markdown lands at `docs/testing-runs/<date>-x-news-reply-pilot.md`. **No live X API call has been made by Claude in this session** — env is not configured. +30 new tests. **1038 tests / 36 suites passing**, typecheck + lint clean. See `docs/x-news-disagreement-epidemiology.md` § "Mixed-agreement taxonomy" and `docs/x-api-and-xai-setup.md` § "Tiny X News pilot".

**Stage 6.1.3.2a complete (xAI auth reality check).** Fail-closed `xaiAuthProbe.js` script + 18 new tests, used to verify that xAI inference is not reachable without `Authorization: Bearer <XAI_API_KEY>`. Probe defaults to dry (no network). Live probe with a key gates on key presence. No-key probe requires explicit `--probe-missing-key` and reports HTTP 200 as `unexpected_unauthenticated_access` (exit 2). Output is always sanitized — keys / Bearer tokens / Authorization headers / response bodies are never logged. **1008 tests / 34 suites passing**. xAI stays disabled by default for the upcoming Stage 6.1.3.3 X News pilot. See `docs/x-api-and-xai-setup.md` § "xAI auth reality check".

**Stage 6.1.3.2 complete (engagement-intelligence scaffold).** Compliant scaffold for X public-reply epidemiology + xAI structured stance classification. Both live APIs are DISABLED by default; scripts refuse to call out unless `ENGAGEMENT_INTEL_ENABLE_X_API=true` / `ENGAGEMENT_INTEL_ENABLE_XAI=true` AND the operator passes `--pilot` on the CLI. New pure-TS module `src/features/engagementIntelligence/` (two-axis agreement+disagreement scalar with `coexistenceScore`, redaction, rule-candidate builder, xAI prompt/schema/validator/merger). New `scripts/engagement-intelligence/` (env loader, plan, API client stub, refuse-by-default collectors, normalizer, offline analyzer, Markdown report writer, xAI CLI). 24-pair synthetic fixture. 4 new test files = 139 new tests. **990 tests / 33 suites passing**, typecheck + lint clean. No live X / xAI calls have been made. See `docs/x-news-disagreement-epidemiology.md` and `docs/x-api-and-xai-setup.md`.

**Stage 6.1.3.1 complete (live corpus:50 written).** Engagement corpus mode landed and ran live. New `scripts/bot-fixtures/engagementCorpus.js` (decision-trace classifiers + 8-dimension room scoring + single-file Markdown / optional JSONL builders). Two new deep-chain templates (`deep-chain-12` at depth 10, `deep-chain-15` at depth 14) plus expanded spicy pools and richer renderers. `runStressBatch.js` gained `--corpus`, `--corpus-only`, `--write-jsonl`, `--no-write-markdown` flags. New npm scripts: `bot:fixture:corpus:dry`, `bot:fixture:corpus:10`, `bot:fixture:corpus:50`. **Live `corpus:50` posted 625/625 moves across 50 rooms** (run id `2026-05-17T02-52-24-643Z-110e0333`, 0 failures, all 8 categories, max depth 14). Corpus md is 12,751 lines with full bodies, decision traces, room scores, no secrets, no forbidden phrases. **851 tests / 29 suites passing**, lint + typecheck clean. Generator now takes `outputDir` so test suites don't race on the shared dir.

**Stage 6.1.3 complete (live stress:10 run).** Spicy bot stress-test suite landed. New: `topicBank.json` (8 categories × 4 topics), `spicyLanguage.js` (bounded phrase pools — claim-hostile, never person-hostile), 3 stress templates (12 / 11 / 13 moves) honoring all Constitution `transition_*` rules and `concession_integrity` markers, a deterministic seeded generator (`generateStressScenarios.js`), and a batch runner (`runStressBatch.js`) with JSONL event logging and a safe Markdown summary. New npm scripts: `bot:fixture:generate-stress`, `bot:fixture:stress:dry`, `bot:fixture:stress:10`, `bot:fixture:stress:50`. Validator extended with `validateStressScenario` (transitions, concession markers, 10–15 move band) and `ScenarioCategory` widened with 7 stress categories. 21 new tests asserting deterministic generation, valid transitions across 50 generated scenarios, concession markers on `concession` + `synthesis`, and absence of forbidden person-attack phrases. `npm run bot:fixture:stress:dry` reports 0 plan issues on 10 scenarios. **824 tests, 28 suites passing.** Live stress runs not yet executed.

**Stage 6.1.2.4b complete.** Bot fixture runner repaired and first end-to-end live fixture run achieved (sports-play-in, 7/7 moves posted via normal Supabase auth + `submit-argument`, room `62305b8b-c11e-41a6-81b8-4c95daf73d2c`). Runner extracts real HTTP status from `FunctionsHttpError.context.status` (no more `failed_500` collapse for real 422/403), records `errorDetail` from `blockingErrors[0]` / 403 `reason`, skips children when parent did not post, and maps persona side `neutral` → participant side `moderator`.

**Stage 6.1.2 (foundation) complete.** Admin and bot operations foundation: `is_admin()` helper, `admin_audit_events` / `admin_block_rules` / `bot_user_registry` tables (migration 0007 applied to hosted DB), `admin-users` Edge Function with 14 whitelisted actions, admin client wrapper, AdminScreen with 5 sub-tabs (Users / View As / History / Blocks / Bot Users), Admin tab gated by `profiles.role = 'admin'`. View As is read-only snapshot only — no auth impersonation. Bootstrap admin SQL is untracked (`scripts/admin/bootstrap-admin.local.sql` is gitignored).

Stages 6.1.0 (gamified UX), 6.0.3 (inline composer), 5.5.6.1 (RLS hotfix), 5.5.6 (account), 5.5.5 (post-submit refresh), and earlier all committed.

## What Works

### Infrastructure (live)
- Supabase project `qsciikhztvzzohssddrq` linked and accessible
- All 7 migrations applied to hosted project (0001–0007)
- `submit-argument` Edge Function ACTIVE (version 1)
- `admin-users` Edge Function: ✅ deployed ACTIVE v1 (2026-05-16 22:20 UTC)
- `.env` configured; gitignored
- Secret scan clean
- ANTHROPIC_API_KEY set as Supabase secret (reportedly rotated — not called in this or earlier stages)

### Core (local, tested)
- Session contracts, reducer, storage
- Constitution v1 engine — pure TS
- `submit-argument` Edge Function (JWT-protected, deterministic re-validation server-side)
- Migrations 0001–0007 (schema, RLS, seed, rails+edge, session+scalability, RLS fix, admin operations)
- Auth: `AuthScreen`, `useAuthSession`
- Argument viewport, tree, timeline/track view
- Argument composer (inline, "Your Move", idempotent submit, server 422)
- Account/profile feature (display name, ADMIN? row visible)
- **Stage 6.1.0** — gameStatus, claimStanding, argumentTimeline, gameCopy, counterClaim, invite UI
- **Stage 6.1.2** — admin layer:
  - Migration 0007: `is_admin()` helper, `admin_audit_events`, `admin_block_rules`, `bot_user_registry`
  - Edge Function `admin-users` (Deno, JWT-verified, admin-only): list_users, get_user_detail, create_user, create_bot_user, update_role, send_password_reset, set_temporary_password, disable_user, enable_user, soft_delete_user, list_blocks, add_block, remove_block, view_as_snapshot
  - Shared helpers: `adminAuth.ts` (requireAdmin), `adminAudit.ts` (write + sanitize), `adminSchemas.ts` (zod discriminated union)
  - Client wrapper: `src/lib/edgeFunctions.ts → adminUsers()`
  - Feature slice: `src/features/admin/` (AdminScreen, AdminUsersTab, AdminUserDetailPanel, AdminCreateUserForm, AdminViewAsTab, AdminHistoryTab, AdminBlocksTab, AdminBotUsersTab, adminHelpers, adminApi, useAdminUsers)
  - Tab gating: `getVisibleTabs(role, isDev)` in `roomNavigation.ts`
  - Account screen shows `ADMIN? true/false`
  - Bootstrap docs + untracked local SQL script (`scripts/admin/bootstrap-admin.local.sql`)
- Jest test suite: **750 tests**, 26 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed / Pending

- `admin-users` deploy: ✅ done
- Admin bootstrap SQL: ✅ run; dev human is `role=admin` (verified)
- **Live browser smoke (Stage 6.1.2.1 A–H)**: pending operator run — see `docs/testing-runs/2026-05-16-admin-smoke.md`
- IP/email block rules are **app-level only**; full Supabase Auth pre-login enforcement is a later stage
- View As is **read-only snapshot only**; no auth impersonation in this stage
- Bot user automation (counter-runner programmatic posting) is a later stage

## What Is Blocked

- **Live admin smoke test** — requires `admin-users` deploy + bootstrap SQL run
- **Docker/Supabase local** — never validated (Docker Desktop unavailable)

## Last Verification Commands

Run on 2026-05-17 (post Stage 6.1.3.1 dry-corpus gate):

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (851 tests, 29 suites) |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | submit-argument ACTIVE v1; admin-users ACTIVE v1 |
| `npm run bot:fixture:sports` | ✅ 7/7 moves posted via normal auth + submit-argument (Stage 6.1.2.4b) |
| `npm run bot:fixture:stress:10` | ✅ 10/10 rooms, 123/123 moves posted (Stage 6.1.3) |
| `npm run bot:fixture:corpus:dry` | ✅ 10 scenarios planned-only, single ~2.5k-line corpus md emitted, no secrets |
| `npm run bot:fixture:corpus:50` | ✅ 50/50 rooms, **625/625 moves posted**, 12,751-line corpus md emitted, no secrets, max depth 14 |
| `npm run engagement:intel:plan` | ✅ dry plan; no live calls (Stage 6.1.3.2) |
| `npm run engagement:intel:synthetic` | ✅ deterministic scalar over 24 synthetic pairs; safe Markdown report emitted |
| `npm run engagement:intel:x-news:dry` | ✅ refuses live X API without explicit `--pilot` + env flag |
| `npm run engagement:intel:xai:probe:dry` | ✅ prints booleans-only env snapshot; no network |
| `npm run engagement:intel:xai:probe:live` | ✅ refuses without `XAI_API_KEY`; no network on refusal path |
| `npm run engagement:intel:x-news:tiny-pilot` | ✅ dry mode; refuses without env + `--pilot`; no network |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Migrations applied | ✅ 0001–0007 |
| `submit-argument` deployed | ✅ ACTIVE v1 |
| `admin-users` deployed | ✅ ACTIVE v1 |
| `.env` configured | ✅ |
| Admin bootstrap SQL run | ✅ dev human promoted; verification row confirms `is_admin=true` |

## Next Recommended Steps

1. ✅ `admin-users` deployed
2. ✅ Admin bootstrap SQL run
3. ✅ Bot fixture runner repaired and first live run posted 7/7 moves (Stage 6.1.2.4b)
4. ✅ Stage 6.1.3 dry-run + `stress:10` live (10/10 rooms, 123/123 moves)
5. ✅ Stage 6.1.3.1 dry-corpus gate (10-scenario corpus written, 851 tests)
6. **Run `bot:fixture:corpus:10` (live)** — writes a single ~2.5k-line corpus Markdown for human engagement review
7. **If `corpus:10` reads usefully**, run `bot:fixture:corpus:50` and triage strongest / weakest rooms
8. **Live browser smoke (A–H)** + **UX triage of stress-generated rooms** — still operator-driven
9. **Stage 6.1.3.3 — tiny live X News pilot** (5 stories × 3 posts × 12 replies = up to 180 reply pairs; X API only, xAI optional + initially off, redacted local logs only)
10. Stage 6.1.4 — argument-room UX simplification informed by corpus engagement notes
11. Stage 6.1.5 — persistent resting status / claim standing from server
