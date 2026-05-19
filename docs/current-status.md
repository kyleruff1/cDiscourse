# CDiscourse — Current Status

_Last updated: 2026-05-19 (Release 6.8 hosting prep — Google Cloud Run plan landed; COMPOSER-001 merged in Release 6.6)_

## HOST — Google Cloud Run hosting plan for cdiscourse.com (Release 6.8 / hosting prep)

**Status:** Plan written. Operator decisions LOCKED. No deploy executed.

- New doc [`docs/deployment/google-cloud-run-hosting-plan.md`](deployment/google-cloud-run-hosting-plan.md) is the master architecture plan for moving CDiscourse onto a real public dev / sandbox environment on Google Cloud Run, using the existing `cdiscourse.com` domain (GoDaddy) and the existing Supabase backend. 18 sections covering goal, current app assumptions, environment topology (local / dev / prod), recommended GCP architecture (Cloud Run + Artifact Registry + Secret Manager + service accounts), domain strategy (`dev.cdiscourse.com` recommended over `cdiscourse.com/dev` because Cloud Run domain mapping maps a domain to `/`, not a path), DNS strategy (Option A keep GoDaddy / Option B migrate to Cloud DNS — recommendation A for v0), secret migration (inventory names only, history-leak audit, `gcloud secrets versions add --data-file=-` from stdin, never agent-run), Supabase integration (no schema change, redirect URLs + site URL config only), dev access control (Option A IAM + IAP / Option B Cloud Armor IP allowlist via HTTPS LB + serverless NEG — recommendation A), deploy script plan (`scripts/deploy/gcloud-preflight.*` / `deploy-cloud-run-dev.*` / `promote-cloud-run-prod.*` stub; all dry-run default, refuse on dirty git, never echo secret values), manual operator steps, smoke plan (existing HOST-003 checklist + 2 new hosting checks H1 TLS / H2 revision-match), rollback (one `gcloud run services update-traffic` command), cost watchpoints, risks/decisions table, do-not-implement-in-this-card boundary, proposed issue changes, and next implementation sequence.
- Companion doc [`docs/deployment/claude-code-vertex-ai-note.md`](deployment/claude-code-vertex-ai-note.md) keeps the Claude Code Vertex AI routing setup explicitly separate from app hosting — Vertex AI is the operator's local model-routing convenience, **not** part of `cdiscourse.com` infrastructure.
- HOST-001 (#27) is refreshed to point at the plan doc; HOST-002 (#28) and HOST-003 (#29) remain closed (banner + smoke checklist already shipped). Plan proposes splitting hosting work into HOST-001 (architecture design + first Cloud Run revision) plus new cards HOST-004 (deploy scripts + Artifact Registry), HOST-005 (Secret Manager migration + Cloud Run binding), HOST-006 (DNS strategy + GoDaddy record set), HOST-007 (dev access control — IAM+IAP or Cloud Armor), HOST-008 (prod promotion pipeline stub). Each card has a distinct manual-operator gate and rollback surface.
- Hard rules held in writing:
  1. **No `.env*` value is ever read or printed by the agent.** Operator runs §7.1 inventory locally and shares only key names.
  2. **No service-role key, Anthropic key, xAI key, or X Bearer in Cloud Run env or Secret Manager.** Service-role stays in Supabase Function secrets; bot-fixture keys stay operator-gated and out of Cloud Run.
  3. **No DNS mutation, no Supabase migration, no Supabase Function deploy, no production deploy** in this card.
  4. **Cloud Run dev defaults to gated access** (`--no-allow-unauthenticated` or Cloud Armor deny-default) — never world-readable in v0.
  5. **Scripts default to dry-run**, refuse on dirty git, refuse on non-`main` branch unless overridden, never echo secret values, never grant `roles/run.invoker` to `allUsers` without explicit `--allow-public` double-confirmation.
- **Operator decisions LOCKED 2026-05-19** (D1–D9 in plan §"Locked decisions"): GCP project = **`cdiscourse-host`** (D1); region = **`us-central1`** (D2); dev URL = **`dev.cdiscourse.com`** (D3); no IP allowlist (D4); GoDaddy stays as DNS authority for v0 (D5); access control = **IAM + IAP** Google sign-in, **not** Cloud Armor IP rules (D6); operator IP capture = N/A (D7); operator runs every `gcloud secrets create` / `versions add --data-file=-` themselves when prompted (D8); production cutover deferred until dev is live and pushing daily changes (D9). Consequence: direct Cloud Run domain mapping (no HTTPS LB) becomes the default; HOST-007 implements IAP only; HOST-006 implements GoDaddy-only DNS records. R7 (reuse dev Supabase project or create new), R9 (`.env*` leak audit before HOST-005), R11–R14 remain open.
- No code change in the app itself. No new dependency. No migration. No Edge Function deploy. No Anthropic / xAI / X / Supabase write by the agent in this card.

## COMPOSER-001 — Wire SC-004 narrow/confirm/synthesize preset bodies into composer prefill (Release 6.6 / Wave 2)

**Status:** Build complete, awaiting Review.

- Seam-wiring patch on top of SC-004 (PR #83). SC-004 shipped the dock model `actionDockToComposerPreset(action, target, parentType)` which returns the correct `MoveDraftPatch` for `narrow` / `confirm` / `synthesize` (plus the existing EV-002 ask presets), but `ArgumentGameSurface.handleActionDockAction` discarded the patch and routed every fall-through case through `handleAction('reply', targetMessageId)`. Downstream, `FullRoomGameSurfaceMount.handleAction` then computed a `presetLabel='reply'` preset (null) and clobbered any preset the dock had chosen. Net effect: the SC-004 dock advertised a one-click playable move, but the user landed in a blank composer.
- Fix lands in two files:
  - `src/features/arguments/ArgumentGameSurface.tsx` — extends the `onAction` prop with an optional third `preset?: MoveDraftPatch | null` argument (existing callers ignore it; no breaking change). `handleAction` forwards the preset to `onAction`. `handleActionDockAction` computes the patch via `actionDockToComposerPreset(action, target, parentType)` once and threads it into `handleAction(control, messageId, preset)` for every preset-producing dock action (`narrow` / `confirm` / `synthesize` / `concede` / `clarify` / `add_evidence` / `challenge` / `ask_source` / `ask_quote`). `parentType` is resolved by looking up the target message's `argumentType` from the already-memoized `sorted` array. `reply` and `branch` continue to dispatch with an explicit `null` preset.
  - `src/features/arguments/ArgumentTreeScreen.tsx` — `FullRoomGameSurfaceMount.handleAction` accepts the optional `explicitPreset` argument and prefers it over the locally-computed EV-002 preset. When no explicit preset is supplied (sidecar / popover / Stack-mode bubble dispatch paths), the existing EV-002 `quickActionToPreset(presetLabel, arg.argumentType)` path runs unchanged.
- Composer surface (`ArgumentComposer.tsx`) is zero-diff. The composer's existing `initialPatch` reference-equality `useEffect` (Stage 6.2 M7) writes the seeded body / argumentType / suggestedTagCodes into the draft on mount. The user can edit before submit.
- Doctrine held:
  1. **The preset body must remain editable by the user before submit.** EV-002 doctrine intact — `initialPatch` is applied once per patch reference; user typing is never overwritten.
  2. **No accusatory or coercive prefilled copy.** The three SC-004 bodies (`NARROW_PRESET_BODY` / `CONFIRM_PRESET_BODY` / `SYNTHESIZE_PRESET_BODY`) are used verbatim from `quickActionPresets.ts`. The COMPOSER-001 ban-list test (14 banned tokens × 3 bodies = 42 regression assertions) re-locks them.
  3. **No new `QuickActionLabel` codes.** No new preset bodies. No new `gameCopy.PLAIN_LANGUAGE_COPY` labels. No new dependency. No new lifecycle / metadata / evidence types.
  4. **No service-role in client. No direct insert into `public.arguments`.** Source-scan of both modified files verifies the doctrine.
  5. **No Supabase migration. No Edge Function deploy. No `.env*` change. No AI inference path. No live API call.**
  6. **Frozen-surface zero-diff** for VG-002 / BR-001 / LIFE-001 / META-001 / EV-001 / EV-002 / SC-002 / SC-004 module files. The two modified files are the explicit seam-wiring surfaces this card is about; the SC-004 selection-exclusion test's regex was updated to accept the new `[handleAction, sorted]` deps array (the doctrine assertions about no router push / no `Linking.openURL` are unchanged).
- New test file `__tests__/argumentGameSurfaceDockComposerWiring.test.ts` (65 tests):
  - 3 tests assert each SC-004 preset shape (narrow / confirm / synthesize).
  - 3 tests assert EV-002 regression for `ask_source` / `ask_quote` (via the dock model) and `weak_source` (via the existing popover-quick-action path).
  - 7 tests assert non-preset actions (`reply` / `branch` / `flag` / `mark_moved_on` / `mark_ignored` / `open_cards_detail` / `expand_branch`) return `null` from `actionDockToComposerPreset` (no auto-fill body).
  - 6 source-scan tests on `ArgumentGameSurface.tsx` (preset compute call, threaded `handleAction` calls, `onAction` prop signature, forwarded preset).
  - 4 source-scan tests on `ArgumentTreeScreen.tsx` (`explicitPreset` arg, prefer-over-fallback, EV-002 fallback still present, `onComposerPreset` runs before `onReply`).
  - 42 verdict-token regression assertions on the three SC-004 preset bodies (14 banned tokens × 3 bodies).
- Tiny chore bundled in the same PR: added `'COMPOSER'` to `ROADMAP_PREFIXES` in `scripts/github/agentIssueRunner.js` so the agent issue runner discovers `COMPOSER-*` cards (this card #84 and future ones). The existing `agentIssueRunner.test.ts` iterates `runner.ROADMAP_PREFIXES` and parses `<PREFIX>-007 — Something`, so the new prefix is covered automatically.
- Tests: **+65 across 1 new file** (`argumentGameSurfaceDockComposerWiring.test.ts`), 1 regex update in `timelineNodeActionDockSelectionExclusion.test.ts`. **3117 tests / 114 suites passing** (+65, baseline 3052 / 113 measured locally; pre-existing 19 xAI/anthropic env-file failures persist on main `03f91d6` and are unrelated). Typecheck + lint clean.
- Frozen-surface zero-diff confirmed: `timelineNodeActionDockModel.ts`, `quickActionPresets.ts`, `gameCopy.ts`, `TimelineNodeActionDock.tsx`, `ArgumentReplySidecar.tsx`, `ArgumentComposer.tsx`, `ArgumentTimelineMap.tsx` are all unchanged in this card.
- Operator follow-up: **None — pure code change.** Review agent runs `npm run typecheck && npm run lint && npm run test`.

## SC-004 — Timeline node action dock (Release 6.6 / Wave 2)

**Status:** Build complete, awaiting Review.

- New pure-TS module `src/features/arguments/timelineNodeActionDockModel.ts`. Exports:
  - The locked 16-code `TimelineNodeActionDockActionCode` vocabulary (15 roadmap §8 codes + the `expand_branch` collapsed-stub UI primitive).
  - `TimelineNodeActionDockActor` (6 values; mirrors `ArgumentBubbleActor` plus explicit `observer`).
  - `TimelineNodeActionDockTarget` discriminated union (`node | cluster | collapsed_stub`).
  - `TimelineNodeActionDockAction` / `TimelineNodeActionDockClusterHeader` / `TimelineNodeActionDockMoveChip` / `TimelineNodeActionDockPrimarySuggestion` / `TimelineNodeActionDockDisabledReason` (10 reasons).
  - The `TimelineNodeActionDockModel` render contract.
  - `buildTimelineNodeActionDockModel(input)`, `getPrimaryTimelineNodeAction(input)`, `actionDockToComposerPreset(action, target, parentType)`, `_forbiddenDockTokens`, and a test-only `_debug` namespace exposing the internal tables.
  - The lifecycle → primary action table covers all 19 LIFE-001 states (`open / answered / rebutted / clarified / sourced / quote_requested / source_requested / narrowed / conceded / confirmed / synthesis_ready / moved_on_by_affirmative / moved_on_by_negative / ignored_by_affirmative / ignored_by_negative / ignored_by_both / exhausted / branch_recommended / archived_or_resolved`).
  - The manual-tag → action promotion table covers all 10 META-001 codes.
  - The source-chain → action override table covers all 6 EV-001 statuses.
- New RN component `src/features/arguments/TimelineNodeActionDock.tsx`. Bottom dock layout. Cluster header strip (lifecycle + manual-tag aggregate + cluster-level auto metadata + evidence label) + per-move chip area + primary action pill (56pt, full-width with 3pt border) + horizontal-scrolling secondary chips (44pt, 1pt border, italic when disabled) + dismiss affordance. RN core primitives only (`Pressable / View / Text / ScrollView / StyleSheet / AccessibilityInfo`). No new dependency.
- Extended `src/features/arguments/quickActionPresets.ts` with three new `QuickActionLabel` values (`narrow / confirm / synthesize`) and three new preset bodies (`NARROW_PRESET_BODY` / `CONFIRM_PRESET_BODY` / `SYNTHESIZE_PRESET_BODY`) + `ALL_SC004_PRESET_BODIES`. Existing EV-002 cases unchanged.
- Integration in `ArgumentTimelineMap.tsx` (5 new optional props): `selectedTarget`, `actionDockModel`, `onSelectTarget`, `onActionDockAction`, `onOpenCardsDetail`. Tap handler short-circuits to dock-selection when `onSelectTarget` is wired; info-icon dismisses the dock before opening the popover; JSX renders the dock only when `popoverModel` is null. The SC-002 popover and the SC-004 dock are MUTUALLY EXCLUSIVE.
- Integration in `ArgumentGameSurface.tsx`: builds `lifecycleMap` (LIFE-001) + `metadataLedger` (META-001) + `dockModel` once per render (memoized by timelineMap / lifecycle / metadata references). Classifies dock actor from `resolvedViewerRole` + active bubble actor. Dispatches actions through the existing `handleAction` path (composer + `submit-argument` Edge Function) plus `open_cards_detail` and `expand_branch` surface-toggle helpers. No service-role, no direct insert into `public.arguments`, no router push, no `Linking.openURL`.
- Doctrine encoded in code + tests (172 new tests across 4 files):
  1. **Dock RECOMMENDS, never BLOCKS.** Every one of the 19 lifecycle states keeps `reply` enabled in the action list for participants. Even `exhausted` and `archived_or_resolved` only re-order suggestions.
  2. **Lifecycle is play state, not truth.** No code path reads `standingBand` / `toneBand` / `temperatureBand`. A wrong-but-loud + a right-but-quiet fixture produce deep-equal action shapes.
  3. **No verdict tokens in any user-facing copy.** Ban-list scans every action label, accessibility label, helper copy, cluster header label, and the three new preset bodies (`NARROW_PRESET_BODY` / `CONFIRM_PRESET_BODY` / `SYNTHESIZE_PRESET_BODY`). `_forbiddenDockTokens()` returns the full token list.
  4. **No person-attribution drift.** Cluster header reads via `getPointLifecyclePlainLabel` — `ignored_by_negative` renders as `"Negative did not respond"`, never as a user accusation.
  5. **No re-derivation of upstream signals.** Forbidden-imports source scan (18 tests) asserts no value import of `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair` / `buildPointLifecycleMap` / `buildMoveMetadataLedger`. No `'react'` / `'react-native'` / supabase-js / `'expo-*'` / `'react-router'` / `Linking`. No `fetch(` / `XMLHttpRequest`. No env secrets.
  6. **No service-role / no direct insert / no route push.** Source scan asserts no `from('arguments').insert`, no `supabase.from`, no `router.push`, no `router.navigate`, no `Linking.openURL`, no `console.log`.
  7. **COPY-001 guardrail.** Cluster-level codes (`answered`, `rebutted`, `synthesis_candidate`, `point_stalled`, `branch_suggested`, etc.) render in `clusterHeader`; move-level codes (`has_reply`, `has_rebuttal`, `source_attached`, etc.) render in `moveChips`. When the cluster header's plain-language label would duplicate a move chip's plain-language label (e.g. `answered` + `has_reply` both → `"Has a reply"`), the move chip is suppressed.
  8. **Heat ≠ correctness.** Identical lifecycle structure + different `standingBand` / `toneBand` / `temperatureBand` → deep-equal action shape + identical primary suggestion.
- SC-004 ships **no migration, no Edge Function, no schema change, no `.env*` change, no new dependency, no AI inference path, no Supabase write, no production AI call, no service-role usage, no route transition**. The dock is the dispatch surface; the room shell uses the existing composer + `submit-argument` Edge Function.
- New preset bodies (verbatim — verdict-checked):
  - `NARROW_PRESET_BODY = "I'd narrow this to: [the part I still accept]. Where I'd push back is: [the more limited scope]."`
  - `CONFIRM_PRESET_BODY = "I accept this narrowed point. Moving on with the rest of the claim."`
  - `SYNTHESIZE_PRESET_BODY = "Synthesis: where I think we landed is — [shared point]. Open questions still on the table: [list]."`
- Tests: +129 across 4 new files (`timelineNodeActionDockModel.test.ts` +86, `timelineNodeActionDockDoctrine.test.ts` +20, `timelineNodeActionDockForbiddenImports.test.ts` +18, `timelineNodeActionDockSelectionExclusion.test.ts` +5). Performance gate: dock build < 50 ms on 250-message tree (measured well under). **3071 tests / 113 suites passing** (+129, baseline 2942 / 109). Typecheck + lint clean.
- Frozen-surface zero-diff confirmed: BR-001 / LIFE-001 / META-001 / EV-001 / EV-002 / SC-002 / VG-002 module files are unchanged in this card. Only the explicit integration additions in `ArgumentTimelineMap.tsx` (5 new optional props) and `ArgumentGameSurface.tsx` (dock state + wiring) were made.
- Operator follow-up: **None — pure code change.** Review agent runs `npm run typecheck && npm run lint && npm run test`.
- Discovery follow-up candidates (P2 unless noted, none block SC-004): SC-1A (inline-on-wide dock variant), META-001 patch for `moved_on_by_<side>` / `ignored_by_<side>` manual tags, EV-001 patch for own-bubble `add_evidence`, AccessibilityInfo reduce-motion subscription (P3), metadata-debug overlay (P3), QOL-022 render tooling (P2), NAV-002 selected-cluster breadcrumb (P2), Branch composer routing (P2).
- See `docs/designs/SC-004.md` for the full reference (1021 lines, committed at 3965715).

## META-001 — Move tag / flag / metadata event ledger (Release 6.6)

**Status:** Build complete, awaiting Review.

- New pure-TS module `src/features/metadata/`. Files:
  - `moveMetadataLedger.ts` — entry point. Exports the locked 10-code `ManualTagCode` vocabulary (`needs_source / needs_quote / definition_issue / scope_issue / causal_mechanism / evidence_debt / concession_offered / narrowed_claim / tangent / ready_for_synthesis`), the locked 16-code `AutoMetadataCode` vocabulary (`has_reply / has_rebuttal / has_counter_rebuttal / has_evidence / source_requested / quote_requested / source_attached / quote_attached / participant_skipped_node / no_response_after_n_turns / repeated_axis_pressure / branch_suggested / branch_created / point_stalled / point_exhausted / synthesis_candidate`), the per-move `MoveLinkageRecord` shape (`messageId / parentMessageId / rootPointId / pointClusterId / branchId / targetExcerpt / disagreementAxis / semanticFlags / userAppliedTags / autoDerivedMetadata / lifecycleEventsCausedByMove`), the per-cluster `ClusterMetadataSummary`, the per-tree `MoveMetadataLedger` (`byMessage / byCluster / metadataEvents / messageOrder / inputHash`), the `MetadataEvent` shape (`add | remove | transition` × `manual_tag | auto_metadata | lifecycle_causation`), the `LifecycleCausationEntry` shape, the `EligibilityContext` + `ApplyManualTagInput` shapes, `AutoMetadataConfig` + `DEFAULT_AUTO_METADATA_CONFIG` (`noResponseTurnThreshold=3 / repeatedAxisPressureThreshold=2 / participantSkippedTurnThreshold=3`), the three-pass `buildMoveMetadataLedger` deriver, the immutable mutators `applyManualTag` / `removeManualTag`, the plain-language helpers `getManualTagPlainLabel` / `getAutoMetadataPlainLabel`, and `_forbiddenMetadataTokens`.
  - `manualTagModel.ts` — `MANUAL_TAG_ELIGIBILITY_TABLE` (the closed eligibility matrix), `getManualTagEligibility`, `isApplyAllowed`, `makeManualTagDedupeKey`. Eligibility per design §"Manual tag vocabulary": observers may NEVER apply tags in v1; own-bubble may apply only `concession_offered` / `narrowed_claim` / `ready_for_synthesis`; admins may apply all 10 for moderation review.
  - `autoMetadataModel.ts` — `deriveAutoMetadataForMessage` reads existing seams only (`PointLifecycleSnapshot.axis`, `PointLifecycleClusterSummary`, `node.droppedTags[].code`, `EvidenceArtifact`); never re-derives axis, message category, or anti-amplification. Cluster-wide codes (`point_stalled`, `point_exhausted`, `synthesis_candidate`) mirror onto every cluster member with the source documented in `inputSignals` so AN-003 can distinguish per-message from cluster-mirrored signals.
  - `metadataEvents.ts` — `computeLifecycleCausationForMove` snapshot-diffs two `PointLifecycleMap`s. First-render rule: when there is no `previousLifecycleMap`, emit `from: 'open'` cluster-state events for any cluster whose current state ≠ `'open'` ON the chronologically-last cluster member only. Cluster transitions between renders attributed only to the chronologically-last member (last-contribution-dominates).
  - `index.ts` — public re-exports for SC-004 / ST-002 / GAME-001 / RULE-003 / GAL-002 / AN-003 / EV-003 / HIST-001 consumption.
- Extended `src/features/arguments/gameCopy.ts` `PLAIN_LANGUAGE_COPY` with 23 new entries (9 manual-tag labels + 14 auto-metadata labels; LIFE-001's shared codes `source_requested` / `quote_requested` / `synthesis_ready` reused as-is) and updated `evidence_debt` value from `'Receipts needed'` to `'Evidence debt'` to match the manual-tag vocabulary verbatim. The runner pipeline reads the code, not the label — only `__tests__/pointLifecyclePlainLabels.test.ts` and `__tests__/seamlessConversationEntry.test.ts` needed their hardcoded `'Receipts needed'` assertion updated.
- Doctrine encoded in code + tests:
  1. **A manual tag is a participant annotation, never a verdict.** Plain labels carry zero verdict / amplification / person-attribution tokens; ban-list scans across every label, every `inputSignals` string, every `cause` field, and the JSON dump of the ledger.
  2. **An auto-derived metadata code is an observation about move structure, never a truth claim.** `has_evidence` means "an artifact is attached", not "the evidence is sufficient or correct". Programmatic JSON-scan asserts zero `block` / `prevent` / `reject` / `forbid` / `disallow` / `denied` tokens in the ledger.
  3. **A moderation flag is NOT a gameplay tag.** Type-level separation: `ManualTagCode` is a closed 10-code union; flag codes like `'flag:civility'` from `node.droppedTags[].code` mirror into `MoveLinkageRecord.semanticFlags` but NEVER cross into `userAppliedTags` or any `MetadataEvent` of `codeFamily === 'manual_tag'`. Test asserts.
  4. **Heat / popularity / engagement / virality / strength bands NEVER feed any code.** Six band variations (across `standingBand` × `toneBand` × `temperatureBand`) all produce deep-equal `byMessage` code shape on identical move structure.
  5. **META-001 reads existing seams; it never re-derives.** Forbidden-imports source-scan asserts no value imports of `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` / `deriveAxis` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair`, no imports from `engagementIntelligence/`, no React / RN / Supabase / Expo imports, no `fetch(` / `XMLHttpRequest`, no env-secret references, no `console.log` (58 forbidden-imports tests).
  6. **Auto-derived metadata is non-blocking.** No code path prevents posting, auto-archives, auto-hides, or suppresses a reply.
- LIFE-001 surface lock + BR-001 surface lock confirmed by the integration test (`metadataLifecycleIntegration.test.ts`, 8 tests): cluster boundary parity, lifecycleState pass-through, axis mirror, no dropped messages, branchId mirror, snapshot-diff transition events across two renders, BR-001 `branch_created` auto-metadata.
- META-001 ships **no production UI surface**. The ledger is built and unused until SC-004 (timeline node action dock) / ST-002 (Cards-detail per-bubble badges + suggested-next-move chip ordering) / GAME-001 (advisory threshold tuning) / RULE-003 (lifecycle-to-UX doctrine map extension) / GAL-002 (gallery first-suggested-move hint) / AN-003 (per-room diagnostics) / EV-003 (evidence-debt tracker) / HIST-001 (P2 lifecycle event history view) wire it.
- Manual-tag persistence is explicitly **v2** per roadmap §19. v1 stores manual tags in caller-owned `useState` (or equivalent); the ledger has no Supabase write path. Discovery candidates: META-1A (persisted ledger via `point_tags` migration), META-1B (real-time multi-user tag sync), META-1C (admin audit-log surface), META-1D (six-month vocabulary review after AN-003), META-1E (Cards-detail metadata-diff inspector).
- No new dependency. No migration. No Edge Function. No schema change. No AI inference path. No Supabase write. No `.env*` change. No service-role usage. No direct insert into `public.arguments`. No production AI call. Pure-TS hygiene matches `src/lib/constitution/engine.ts` rules.
- Tests: +318 across 7 new files (`moveMetadataLedger.test.ts` +49, `manualTagModel.test.ts` +97, `autoMetadataModel.test.ts` +44, `metadataEvents.test.ts` +19, `metadataPlainLabels.test.ts` +29, `metadataDoctrineAnchors.test.ts` +14, `metadataForbiddenImports.test.ts` +58, `metadataLifecycleIntegration.test.ts` +8). Full 80-case eligibility matrix (10 tags × 4 actor roles × 2 own-bubble values). Per-code derivation happy + boundary for all 16 auto codes. 250-message synthetic fixture asserts `buildMoveMetadataLedger` runs in < 60 ms (measured ~9 ms). Full-pipeline (timeline + lifecycle + ledger) 60-node tree < 150 ms. JSON-serializability round-trip. **2942 tests / 109 suites passing** (+318, baseline 2624 / 101). Typecheck + lint clean.
- See `docs/designs/META-001.md` for the full reference.

## LIFE-001 — Point lifecycle metadata model (Release 6.6)

**Status:** Build complete, awaiting Review.

- New pure-TS module `src/features/lifecycle/`. Files:
  - `pointLifecycleModel.ts` — the locked 18-state `PointLifecycleState` vocabulary (`open / answered / rebutted / clarified / sourced / quote_requested / source_requested / narrowed / conceded / confirmed / synthesis_ready / moved_on_by_affirmative / moved_on_by_negative / ignored_by_affirmative / ignored_by_negative / ignored_by_both / exhausted / branch_recommended / archived_or_resolved`), the `LIFECYCLE_PRIORITY` worst-priority-wins table (`archived_or_resolved=0 / synthesis_ready=5 / conceded=narrowed=confirmed=10 / sourced=clarified=20 / open=answered=30 / rebutted=quote_requested=source_requested=50 / branch_recommended=60 / moved_on_by_*=70 / ignored_by_*=80 / ignored_by_both=85 / exhausted=90`), the per-message `PointLifecycleSnapshot`, the per-cluster `PointLifecycleClusterSummary`, the per-tree `PointLifecycleMap` (`byCluster` / `byMessage` / `clusterOrder` / `cumulativeStateSequence` / `inputHash`), the `LifecycleAdvisoryConfig` thresholds + `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` (`exhaustionRepeatThreshold=3 / movedOnTurnThreshold=4 / ignoredBySideTurnThreshold=3 / ignoredByBothTurnThreshold=6 / branchRecommendedRepeatThreshold=2`), the three derivers (`derivePointLifecycleSnapshot` / `deriveClusterLifecycleSummary` / `buildPointLifecycleMap`), the `getPointLifecyclePlainLabel` typed lookup helper, and the `_forbiddenLifecycleTokens` ban-list.
  - `pointLifecycleClusters.ts` — internal helpers `groupNodesByCluster` / `findSameAxisAncestor` / `buildSideTurnSequence` / `deriveAxis` / `nodeHasQualifierCode`. The axis deriver reads existing `droppedTags[].code` fields produced by `mapDroppedTags` — it NEVER calls `messageQualifiers.deriveMessageCategory` or any qualifier deriver function.
  - `pointLifecycleAdvisoryInputs.ts` — advisory threshold helpers `countSameAxisPressure` / `hasAdditiveAxisInformation` / `moveAddsAxisInformation` (alias) / `turnsSinceSideEngagedCluster` / `countOffAxisPressure`.
  - `index.ts` — public re-exports for SC-004 / ST-002 / GAME-001 / RULE-003 / GAL-002 / AN-003 / META-001 consumption.
- Extended `src/features/arguments/gameCopy.ts` `PLAIN_LANGUAGE_COPY` with the 17 new lifecycle codes; updated the existing `synthesis_ready` value from `'Near resolution'` to `'Ready for synthesis'` per roadmap §6 verbatim. The runner pipeline reads the code, not the label, so no runner-side regression — only `__tests__/seamlessConversationEntry.test.ts` needed its `toContain('Near resolution')` assertion updated to `toContain('Ready for synthesis')`.
- Doctrine encoded in code + tests:
  1. **A lifecycle state is a gameplay signal, never a verdict.** No code path infers truth / winner / loser / correctness.
  2. **Heat / popularity / engagement / virality / strength bands never feed lifecycle derivation.** Deep-equal classifier output across `standingBand`, `toneBand`, `temperatureBand` — proven by 3 doctrine-anchor tests.
  3. **`ignored_by_*` describes a cluster, never a person.** Plain labels `'Affirmative did not respond'` / `'Negative did not respond'` / `'Nobody followed up'` — never person-attribution tokens.
  4. **Concession is a scoring repair, not a defeat.** No `lost` / `defeated` / `won` token in any label. The cluster state reports the move structure; the point-standing economy reports the score outcome — separate concerns.
  5. **Exhaustion / moved-on / ignored / branch-recommended are ADVISORIES, never blocking.** Programmatic JSON-scan test: zero `block` / `prevent` / `reject` / `forbid` / `disallow` / `denied` tokens in any produced snapshot field.
- LIFE-001 reads existing surface-model fields and EV-001 contract output. It NEVER re-derives `MessageCategory`, never re-classifies a challenge axis, never re-runs anti-amplification. The forbidden-imports test (`__tests__/pointLifecycleClustersIntegration.test.ts`) source-scans the lifecycle files for any value import of `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair` — fails on accidental coupling.
- `flagCodes` upstream wiring confirmed in place at `src/features/arguments/ArgumentGameSurface.tsx:176` — `flagsByArgumentId` populates each input row's `flagCodes` from `argument_flags`. The `archived_or_resolved` rule consumes this path. No upstream change needed in this card.
- LIFE-001 ships **no production UI surface**. The model is built and unused until SC-004 (timeline node action dock) / ST-002 (suggested reply flags) / GAME-001 (exhaustion advisories) / RULE-003 (lifecycle-to-UX map) / GAL-002 (gallery first-suggested-move) / IX-002 (mini-map) / AN-003 (diagnostics) / META-001 (metadata ledger) wire it.
- No new dependency. No migration. No Edge Function. No schema change. No AI inference path. No Supabase write. No `.env*` change. No service-role usage. No direct insert into `public.arguments`. No production AI call. Pure-TS hygiene matches `src/lib/constitution/engine.ts` rules.
- Tests: +115 across 4 new files (`pointLifecycleModel.test.ts` +73, `pointLifecycleAdvisories.test.ts` +20, `pointLifecyclePlainLabels.test.ts` +10, `pointLifecycleClustersIntegration.test.ts` +12). 250-message synthetic fixture asserts `buildPointLifecycleMap` runs in < 120 ms (design budget < 30 ms; CI headroom). JSON-serializability round-trip test. Deep-equal doctrine anchors (3 × standing / tone / temperature bands). Ban-lists (verdict + amplification + snake_case). Forbidden-imports doctrine anchor (7 categories). 22-code plain-language coverage. **2624 tests / 101 suites passing** (+115, baseline 2509 / 97). Typecheck + lint clean.
- See `docs/designs/LIFE-001.md` for the full reference.

## Timeline Tree Game Board roadmap expansion (Release 6.6 / 6.7)

**Status:** Roadmap-only pass. No production code, no migration, no Edge Function change in this expansion.

- New master doc [`docs/roadmap-timeline-tree-game-board.md`](roadmap-timeline-tree-game-board.md) encodes the product thesis: argument rooms behave as a **playable argument tree**, not a linear message list. Timeline is the primary game board; Cards / Stack is the semantic detail surface.
- Wave 1 (foundation): **BR-001** (tree + branch grammar), **LIFE-001** (point lifecycle metadata), **META-001** (tag / flag / metadata ledger).
- Wave 2 (board interaction): **SC-004** (timeline node action dock), **IX-001** (zoom + density + focus modes), **ST-002** (lifecycle-driven suggestions).
- Wave 3 (game constraints): **GAME-001** (exhaustion + moved-on advisories), **RULE-003** (lifecycle-to-UX map), **IX-002** (mini-map).
- Wave 4 (diagnostics / polish): **AN-003** (tree playability diagnostics), GAL-002 expansion, EV-003 / EV-004 tie-ins.
- Doctrine preserved: lifecycle states are gameplay signals, never verdicts. Exhaustion / moved-on / ignored are advisories, never blocking. No popularity / heat / engagement signal becomes a correctness signal. No `winner / loser / liar / true / false / verdict` in any produced label.
- See `docs/ux-ui-project-board.md` for per-card acceptance criteria and the updated dependency graph.



## BR-001 — Tangent kink model (Release 6.6)

**Status:** Build complete, awaiting Review.

- New pure-TS module `src/features/arguments/branchTopologyModel.ts`. Exports:
  - `deriveBranchKindFromConstitutionModel(input)` — the four-axis classifier (isDetached / siblingIndex / isEvidenceThread / hasTangentLexicalCode → one of the five locked `RailBranchKind` values).
  - `buildBranchKindMap({ nodes, edges, evidenceThreadByBranchRoot })` — two-pass O(n) classifier producing a `Map<edgeId, RailBranchKind>`. Pass 1 = main / kink_start / detached; pass 2 fills `tangent` (interior of a kinked subtree) and `kink_end` (leaf of a tangent subtree).
  - `isEvidenceLikeNode(node)` + `buildEvidenceThreadMap(nodes)` — read-only consumer of `kindColorFamily === 'evidence'` and the existing evidence qualifier codes (`evidence`, `evidence_challenge`, `source_request`, `quote_request`, `ask_receipts`, `quote_exact_bit`). A subtree is an evidence-thread when size ≥ 2 AND ≥ 50% of non-root descendants are evidence-like. Never reads `sourceChainStatus` — evidence-thread describes "this conversation is about evidence", never "this evidence is sufficient / primary / correct".
  - `BranchCollapseState` (`Readonly<Record<branchRootMessageId, 'expanded' | 'collapsed'>>`) + `EMPTY_COLLAPSE_STATE`, `toggleBranchCollapse(state, branchRootMessageId)` (immutable), `applyActiveAutoExpand(state, activeMessageId, nodeById)` (silently uncollapses ancestor branch roots of the active path; returns the same reference when no change).
  - `buildCollapsedRailInputs({ segments, nodeById, collapseState, activeMessageId? })` → `{ visibleSegments, stubs }`. Filters segments whose `toMessageId` lives inside a collapsed subtree; keeps the inbound (parent → branchRoot) edge so the stub has a geometric anchor on the rail.
  - `RailStubViewModel` (visible label, accessibility label, anchor coords, hidden message count, borderColor inherited from `node.kindColor`, `containsActive` defensive flag).
  - `derivePlaceholderBranchKindBR001Adapter` — same three-arg shape as VG-002's `derivePlaceholderBranchKind`; safe-default delegation.
- New RN component `src/features/arguments/BranchCollapseStub.tsx`. 24×24 pill with a `+N` count badge, anchored to the branch root node's `(x, y)`. Background reuses VG-001's `BRAND.surface.appElevated.bg`; border reuses `stub.borderColor` (= `node.kindColor` — no new color token). `accessibilityRole='button'`, `accessibilityState={{ expanded: false }}`. `hitSlop` of 14px each side → effective tap target 52×52 (≥ 44 a11y target). No animation (reduce-motion contract preserved).
- `railSegmentModel.derivePlaceholderBranchKind` body now delegates to `deriveBranchKindFromConstitutionModel`. Signature unchanged. `buildRailSegmentInput` accepts an optional `evidenceThreadByBranchRoot` map; when supplied, the richer classifier runs. `RailSegmentInput` is unchanged (no new field). `RailBranchKind` enum is unchanged. `GradientWaveRail.tsx` is untouched.
- `ArgumentTimelineMap.tsx` extended in place. Threads `BranchCollapseState`, runs `buildEvidenceThreadMap` once per render, passes the map to `buildRailSegmentInput`, calls `applyActiveAutoExpand` after every active-node change (and fires `AccessibilityInfo.announceForAccessibility('Branch expanded to show the active move.')` only when the state actually changed), and renders one `<BranchCollapseStub />` per collapsed branch on a separate Pressable layer (so VG-002's `pointerEvents: 'none'` rail invariant is preserved). The public `Props` surface is unchanged.
- Behavior change from VG-002: the legacy "isDetached + flag-family → tangent" placeholder rule is removed. `isDetached === true` now always returns `'detached'`. Explicit-tangent qualifier (`branch_this_off` / `tangent_or_joke`) on a non-detached siblingIndex-0 child → `'kink_start'` (BR-001 row 4). Additional non-evidence siblings → `'kink_start'` (rows 6/7).
- Doctrine: **a tangent is a topology label, not a verdict.** The classifier never reads heat / tone / temperature / popularity / engagement / standing band / `sourceChainStatus`. Doctrine-anchor test feeds identical trees with different `toneBand` + `temperatureBand` + `standingBand` and asserts deep-equal classifier output. All stub `label` / `accessibilityLabel` strings pass the verdict + amplification ban-lists and `looksLikeInternalCode`.
- No new dependency. No migration. No Edge Function change. No Supabase mutation. No service-role. No `.env*` change. No AI inference path. Collapse state is in-memory only (not persisted across sessions in v1).
- Tests: +83 across 2 new files (`branchTopologyModel.test.ts` +62, `BranchCollapseStub.test.tsx` +17) plus updates to `railSegmentModel.test.ts` (+4 new tests for the BR-001 four-axis behavior surfaced via `buildRailSegmentInput`; 7 legacy placeholder tests updated to reflect the new "detached always wins" semantics). The four `[ISSUE]` AC tests from the card body are explicit. 250-message synthetic fixture asserts the classifier runs in < 50 ms. **2509 tests / 97 suites passing** (+83), typecheck + lint clean.
- See `docs/designs/BR-001.md` for the full reference.

## VG-002 — Gradient wave rail (Release 6.6)

**Status:** Build complete, awaiting Review.

- New pure-TS model `src/features/arguments/railSegmentModel.ts`: exports `RailBranchKind` (5 values; `main | tangent | kink_start | kink_end | detached`), `ALL_RAIL_BRANCH_KINDS`, `RailSegmentInput`, `RailSegmentStyle`, `RailEvidenceTrackLayer`, `RailGlowLayer`, `deriveRailSegmentStyle`, `derivePlaceholderBranchKind` (BR-001 seam), `buildRailSegmentInput`, `visibleSegmentSlice`, `buildWholeRailAccessibilityLabel`, plus constants `RAIL_SOURCE_CHAIN_TEAL` (= EV-002's `RECEIPT_CHIP_RING_COLOR` = `#0f766e`), `RAIL_ACTIVE_PATH_GLOW` (`#a5b4fc`), `RAIL_THICKNESS_PX`, `FIRST_CLASH_RAIL_THICKNESS_PX`, `EDGE_SEGMENTS`, `VISIBLE_SLICE_DEFAULT_BUFFER_PX`. No React, no Supabase, no network.
- New RN component `src/features/arguments/GradientWaveRail.tsx`: replaces the inline `EdgeStrip` subcomponent in `ArgumentTimelineMap.tsx`. Renders the 5-layer stacked-View visual (base color band → tone wash → evidence track → branch / kink stubs → active-path glow). Every layer is `pointerEvents="none"` — the rail is not a tap target. No animation; the component carries a documented seam (see source) so future cards (VG-004 / QOL-016) gate any pulse / sweep on `AccessibilityInfo.isReduceMotionEnabled()`.
- Wiring: `ArgumentTimelineMap.tsx` extended in place. The component now tracks `scrollX` + measured `viewportWidth`, builds `RailSegmentInput[]` once per render from `map.edges` + `nodeById` + the existing EV-002 `artifactsByMessageId` prop (no new prop), virtualises via `visibleSegmentSlice` (default buffer one viewport wide), and exposes the rail-level a11y summary `buildWholeRailAccessibilityLabel(...)` on the horizontal ScrollView. The public `Props` surface is unchanged. `argumentGameSurfaceModel.ts` carries a comment block above `ArgumentTimelineMapEdge` pointing readers to `railSegmentModel.ts`.
- Performance: virtualized rail bounds the visible slice to ≤ 50 segments at default 800px viewport with one-viewport buffer (measured 34 segments at scrollX=5000 across a 250×72px scroll width). Style derivation is memoizable per `segmentId` via the optional `styleCache` Map prop on `GradientWaveRail`.
- Doctrine: warm tone wash = activity, never correctness; saturated teal track = trail quality, never claim quality. Every produced `accessibilityFragment` and every whole-rail label passes the verdict-token ban-list (`winner / loser / correct / true / liar / verdict / proof / proven / validated / winning / …`), the amplification ban-list (`likes / retweets / shares / followers / verified / engagement / trending / viral / popular / …`), and `looksLikeInternalCode`. Color-independence test for every color signal (saturated track → "source attached"; dotted broken → "weak source trail"; no_source → "needs a source"; tangent → "tangent off mainline"; active-path → "active branch"; detached → "detached branch").
- BR-001 seam: `derivePlaceholderBranchKind` is the only function BR-001 swaps. The placeholder rule fires `tangent` only when `isDetached === true` AND (`fromNode.kindColorFamily === 'flag'` OR either endpoint's droppedTags include `branch_this_off` / `tangent_or_joke`). False-positive guard test asserts a flag-family node on the mainline stays `main`. The placeholder NEVER emits `kink_start` / `kink_end`; the dispatch table handles all five `RailBranchKind` values deterministically.
- No new dependency. No migration. No Edge Function change. No Supabase mutation. No service-role. No `.env*` change.
- Tests: +83 across 2 new files (`railSegmentModel.test.ts` +73, `GradientWaveRail.test.ts` +10). State-to-style matrix per row, placeholder decision table, tone-wash alpha lookup, `buildRailSegmentInput` worst-status, virtualization slice (incl. 250-segment performance bound), memoization determinism, ban-lists, doctrine anchors (heat is activity / saturated track is trail), color-independence per signal, no-animation guarantee. **2426 tests / 95 suites passing** (+83), typecheck + lint clean.
- See `docs/designs/VG-002.md` for the full reference.

## EV-002 — Source-chain popover (Release 6.6)

**Status:** Build complete, awaiting Review.

- Pure-TS dispatch model `src/features/evidence/sourceChainPopoverModel.ts`: exports `SourceChainPopoverAction`, `SourceChainPopoverModel`, `buildSourceChainPopoverModel(contract)`, `buildSourceChainPopoverModelFromChip(chip)`, `buildSourceChainPopoverModelFromArtifacts(artifacts)`, `ALL_SOURCE_CHAIN_POPOVER_ACTIONS`. Consumes EV-001's `TimelineEvidenceContract` / `ReceiptChipContract` directly — never redefines `SourceChainStatus`. Locked dispatch table: `no_source` / `unverified` / `broken` → ask-for-source-style CTAs; `source_no_quote` → ask-for-quote; `source_and_quote` / `primary_present` → read-only "Inspect receipt". `unverified` resolution is "Ask for source" (matches EV-001's structural gap rationale).
- New frozen string module `src/features/evidence/sourceChainPresetCopy.ts`: `ASK_SOURCE_PRESET_BODY`, `ASK_QUOTE_PRESET_BODY`, `ASK_STRONGER_SOURCE_PRESET_BODY`, `ALL_SOURCE_CHAIN_PRESET_BODIES`. Every preset is question-shaped, uses inspection / trail language, never accuses the author, ≤ 200 chars.
- Two new RN components: `ReceiptChip.tsx` (renders the EV-001 chip contract with the dotted-teal VG-001 ring when `showsSourceChainPressure === true`; hitSlop provides ≥ 44×44 tap target; pure helpers `buildReceiptChipDisplayLabel`, `buildReceiptChipContainerStyle`, `buildReceiptChipAccessibilityLabel`, `RECEIPT_CHIP_HIT_SLOP`, `RECEIPT_CHIP_RING_COLOR`) and `SourceChainPopover.tsx` (inline collapsible section anchored inside the existing `TimelineNodePopover`; reduce-motion respected; pure helpers `planSourceChainPopover`, `buildSourceChainPopoverAccessibilityLabel`, locked `SOURCE_CHAIN_POPOVER_OBSERVER_HELPER = "Join a side to ask"`).
- Observer-mode contract is LOCKED: `isReadModeViewer === true` keeps the CTA visible but disabled with the helper "Join a side to ask" (operator confirmed at design handoff). `isOwnMessage === true` hides every "ask" CTA across every status — authors fix their own trail by attaching a new evidence move.
- Wiring: `MoveDraftPatch` extended with optional `body?: string`; `quickActionPresets.ts` now seeds non-accusatory bodies on `source` / `quote` / `weak_source` (new) and returns `null` for `inspect_receipt` (new); `ArgumentComposer.handleMovePatch` + the `initialPatch` useEffect both honor the new `body` field; `ArgumentMessageInput` gains optional `attachedEvidence`; `ArgumentTreeScreen` threads `row.clientValidation.attachedEvidence` through; `ArgumentGameSurface` builds `artifactsByMessageId` once per render via the new `buildArtifactsByMessageId` pure helper in `argumentGameSurfaceEvidence.ts`; `ArgumentTimelineMap` accepts `artifactsByMessageId` + `evidenceContractFor` + `isReadModeViewer`; `TimelineNodePopover` renders a `ReceiptChip` in the bandRow and a collapsible `SourceChainPopover` body section when an evidence contract is present.
- Persistence is unchanged: no migration, no Edge Function, no `submit-argument` change, no service-role, no Supabase mutation. `evaluateArgumentDraft` and `src/lib/constitution/engine.ts` are untouched. The user attaches evidence via the existing `ArgumentComposer` field — that path stays untouched.
- Tests: +68 across 4 new files (`sourceChainPopoverModel.test.ts`, `sourceChainPresetWiring.test.ts`, `ReceiptChip.test.tsx`, `SourceChainPopover.test.tsx`) + extensions to `timelineNodePopoverModel.test.ts` + `argumentGameSurface.test.ts`. Coverage: state-to-action dispatch table per row, ban-list across every produced string (verdict + amplification + snake_case), doctrine anchor (no truth phrases like "is true" / "is false"), observer-disabled + own-message edge cases, EV-001 surface consumption (no string forking), composer preset wiring with seeded bodies, artifact-map builder. **2343 tests / 93 suites passing**, typecheck + lint clean.
- See `docs/designs/EV-002.md` for the full reference.

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

### Next — Release 6.6 (Timeline Tree Game Board)

Goal: branch / cluster / lifecycle foundation, then board action dock, then game constraints. See [`docs/roadmap-timeline-tree-game-board.md`](roadmap-timeline-tree-game-board.md) for the master plan.

**Wave 1 — Foundation**
- BR-001 tangent kink model / argument tree layout foundation (P0/L).
- LIFE-001 point lifecycle metadata model (P0/L) — NEW.
- META-001 move tag / flag / metadata event ledger (P0/L) — NEW.

**Wave 2 — Board interaction**
- SC-004 timeline node action dock (P0/M) — NEW.
- IX-001 timeline zoom + density + focus modes (P0/L) — promoted from P1.
- ST-002 suggested reply flags per bubble card (P1/M) — scope expanded with lifecycle inputs.

**Wave 3 — Game constraints**
- GAME-001 point exhaustion and timeout rules (P1/M) — NEW.
- RULE-003 lifecycle-to-UX doctrine map (P1/M) — NEW.
- IX-002 timeline mini-map overview (P1/M) — scope expanded with cluster summaries.

**Wave 4 — Diagnostics / polish**
- AN-003 tree playability diagnostics (P2/M) — NEW (Release 6.7).
- GAL-002 entry cards with first suggested move (P1/M) — scope expanded.
- EV-003 evidence debt tracker (P1/L), EV-004 evidence symmetry (P1/M), RULE-002 evidence symmetry between validation and visuals (P1/M).

**Already shipped in 6.6**: EV-001 evidence object model ✅, EV-002 source-chain popover ✅, VG-002 gradient wave rail ✅, RULE-001 semantic rule-to-UI map ✅.

**Side tracks**: BR-002 split-screen branch inspector (P2/XL), SW-002 heat / momentum without truth claims (P1/M), SC-003 sidecar as detail inspector (P1/M, boundary now shared with SC-004), GAL-001 sections-as-play-lanes (P1/M), QOL-019 / QOL-020 bot test infra (P1/M each).

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
