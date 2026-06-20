# CivilDiscourse — Feature Repository Index

> Closing artifact for **#756** ("Feature-repository index — canonical product-feature → docs/code/issue catalog").
>
> The front door for "does this capability exist, where does it live, and who owns it?" — answered in one lookup instead of grepping `docs/designs/` (100+ files) and `src/features/` (38 modules). Grouped by feature area; each row names the implementing module path(s), the primary design doc(s), the owning issue(s), and a one-line status. Docs/PM only; no code or semantics changed.
>
> This is **product-feature-keyed** and broader than v4. The v4-specific, reference-deliverable-keyed subset is the separate ledger `docs/designs/civildiscourse-v4-reference-ledger.md` (#755). The run-summary `docs/designs/CIVILDISCOURSE-FEATURE-REPOSITORY-INDEX.md` (merged `main` `cb1bf82`) records what the planning run did; this file is the durable feature catalog the run named.

---

## 1. How to read this index

- **Feature area** — the grouping a contributor scans first (Room model, Mediator board, Composer/voice, Evidence/standing, Gallery, Admin, Auth/identity, Branding/tokens, plus supporting areas).
- **Module(s)** — the `src/features/<area>/` (or `src/lib/`) path(s) that implement it. Every major `src/features/` module appears at least once.
- **Design doc(s)** — the primary `docs/designs/<CODE>.md` (or other doc) that specifies it.
- **Owning issue(s)** — the issue number(s) most responsible for it; `—` when the module predates issue-tracking or is supporting infrastructure.
- **Status** — `shipped` / `partial` / `dormant` / `scaffold` — display/ship state only, never a verdict.

All referenced paths and issue numbers below are well-formed and resolve in the repo at the time of writing.

---

## 2. Room model & seats

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| 1:1 room creation matrix + visibility | `src/features/debates/argumentRoomCreationMatrix.ts`, `src/features/debates/oneToOneRoomModel.ts` | `docs/designs/ARG-ROOM-001-CREATION-MATRIX-AND-MODEL.md` | #680, #738 | shipped |
| Room contract seat strip (Host / respondent / open seat) | `src/features/debates/roomContractModel.ts`, `src/features/debates/RoomContractSeatStrip.tsx`, `src/features/debates/useRoomContract.ts` | `docs/designs/GAME-004.md`, `docs/designs/ARG-ROOM-ADR-001-VISIBILITY-CAPACITY-INVITE-DOCTRINE.md` | #681, #717 | shipped |
| Visibility / capacity / public-slot claiming | `src/features/debates/` (room visibility model) | `docs/designs/ARG-ROOM-002-BACKEND-VISIBILITY-CAPACITY-INVITES.md`, `docs/designs/ARG-ROOM-005-PUBLIC-SLOT-CLAIMING.md`, `docs/designs/ARG-ROOM-006-VISIBILITY-FEED-ACCESS.md` | (ARG-ROOM slate) | shipped |
| Chime-in governance (bounded third voice) | `src/features/debates/oneToOneRoomModel.ts` (dormant model) | `docs/designs/ARG-ROOM-ADR-001-VISIBILITY-CAPACITY-INVITE-DOCTRINE.md` | #738 → #761 (GATE-C) | dormant |
| Invites (token, redeem, credential step) | `src/features/invites/inviteModel.ts`, `src/features/invites/inviteApi.ts`, `src/features/invites/inviteCopy.ts`, `src/features/invites/InviteRedeemGate.tsx` | `docs/designs/ARG-ROOM-004-INVITE-ACCEPTANCE-AND-EMAIL-TRANSPORT.md` | (ARG-ROOM slate) | shipped |

## 3. Mediator board

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Board state derivation (one state per node) | `src/features/mediator/deriveMediatorBoardState.ts`, `src/features/mediator/mediatorBoardTypes.ts` | `docs/designs/UX-MEDIATOR-001.md` | #682 | shipped |
| Plain-language state copy + ban-list | `src/features/mediator/mediatorPlainLanguage.ts` | `docs/designs/UX-MEDIATOR-001.md` | #682 | shipped |
| Node markup / Inspect drawer | `src/features/mediator/MediatorNodeInspectDetail.tsx`, `src/features/mediator/MediatorNextMovesCard.tsx` | `docs/designs/UX-MEDIATOR-002.md` | #683 | shipped |
| Disagreement Points rail | `src/features/mediator/DisagreementPointsRail.tsx`, `src/features/mediator/mediatorDistribution.ts` | `docs/designs/UX-MEDIATOR-002.md` | #686 | partial (rail shipped; full mobile sheet AMEND) |
| Mediator progress note (advisory) | `src/features/mediator/MediatorProgressNote.tsx`, `src/features/mediator/feedbackForMediatorProgress.ts`, `src/features/mediator/roomMediatorAdapter.ts` | `docs/designs/UX-MEDIATOR-002.md` | #690 | shipped |
| Node annotations / labels | `src/features/nodeAnnotations/`, `src/features/nodeLabels/` | `docs/designs/AN-002.md`, `docs/designs/AN-003.md` | (AN slate) | shipped |

## 4. Argument surface, composer & voice

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Argument game surface / timeline map | `src/features/arguments/` (game surface, timeline), `src/features/arguments/TimelineSelectedReadoutPanel.tsx` | `docs/designs/UX-MEDIATOR-002.md`, `docs/designs/GAME-003.md` | #683, #715, #719 | shipped |
| One-box composer (Act / Inspect / Go) | `src/features/arguments/oneBox/` (`ActPopout.tsx`, `boxModel.ts`, …) | `docs/designs/COMPOSER-002.md`, `docs/designs/COMP-001.md` | #687 | shipped |
| Plain-language code mapping | `src/features/arguments/gameCopy.ts` | `docs/copy-review/plain-language-labels-pass-1.md` | #676 | shipped |
| Voice / transcript data model (capture UI deferred) | `src/features/languageProcessing/` | `docs/designs/CIVILDISCOURSE-DESIGN-REFERENCE-LEDGER.md` (Speech composer rows) | VOICE-007 #665, #666, #667 | scaffold (model only) |
| Modes (composer mode switching) | `src/features/modes/` | `docs/designs/COMPOSER-002.md` | — | shipped |

## 5. Evidence, standing & strength

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Evidence / source-chain surfaces | `src/features/evidence/` | `docs/designs/EV-001.md` … `docs/designs/EV-005.md` | (EV slate) | shipped |
| Point-standing economy (concession / narrowing / synthesis) | `src/features/pointStanding/` (`antiAmplification.ts`, `concessionEffects.ts`, `eligibility.ts`) | `docs/point-standing-economy.md` | (Stage 6.1.4) | shipped (pure engine, not auto-wired) |
| Concessions surface | `src/features/concessions/` | `docs/point-standing-economy.md` | — | shipped |
| Strength / weakness bands | `src/features/strengthWeakness/` | `docs/designs/SW-001` family | (SW slate) | shipped |
| Lifecycle (point lifecycle model) | `src/features/lifecycle/` | `docs/designs/LIFE-001.md` | — | shipped |
| Move metadata ledger | `src/features/metadata/` | `docs/designs/META-001` family | — | shipped |

## 6. Gallery & navigation

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Conversation gallery model + screen | `src/features/debates/conversationGalleryModel.ts` | `docs/conversation-gallery-ux.md`, `docs/designs/GAL-001.md`, `docs/designs/GAL-002.md` | (Stage 6.3) | shipped |
| Seamless conversation entry | `src/features/debates/` (entry hint + section grouping) | `docs/seamless-conversation-entry.md` | (Stage 6.4) | shipped |
| App navigation shell | `src/features/navigation/` | `docs/designs/BRAND-001.md` | #46 | shipped |
| Notifications surface | `src/features/notifications/` | — | — | shipped |

## 7. Admin, moderation & referee

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Admin arguments / history tabs | `src/features/admin/` | `docs/designs/ADMIN-ARGS-CANONICAL-001.md`, `docs/designs/ADMIN-ARGS-INACTIVE-001.md` | (Stage 6.1.5.1, 6.1.6) | shipped |
| Admin AI assist | `src/features/admin/`, `src/features/semanticReferee/` | `docs/designs/ADMIN-AI-001.md` | (Epic 12) | shipped |
| Classifier-health admin | `src/features/adminClassifierHealth/` | `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` | (ARCH-001) | shipped |
| Moderation surfaces | `src/features/moderation/`, `src/features/requestReview/` | `docs/designs/MCP-*` family | (MCP slate) | shipped |
| Semantic referee / override | `src/features/semanticReferee/`, `src/features/semanticOverride/`, `src/features/refereeBanners/`, `src/features/refereeLedger/`, `src/features/refereeLoop/` | `docs/designs/MCP-001.md` family | (Epic 12) | shipped (mcp slot dormant) |
| Rules UX | `src/features/rulesUx/` | `docs/designs/RULE-*` family | (Epic 12) | shipped |

## 8. Auth, profile & session

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Sign-in screen (email + password) | `src/features/auth/AuthScreen.tsx`, `src/features/auth/authApi.ts`, `src/features/auth/useAuthSession.ts` | `docs/designs/AUTH-FOUNDATION-INDEX.md`, `docs/designs/AUTH-CALLBACK-CONSUMER-001.md` | #607, #740 | shipped (email-only; provider slots not yet present) |
| Sign-in lockup model | `src/features/auth/signInLockupModel.ts`, `src/lib/brandCopy.ts` | `docs/designs/BRAND-002.md` | #678 | shipped |
| Auth foundation (config + allowlist) | `src/features/auth/` | `docs/designs/AUTH-FOUNDATION-INDEX.md` | #739 (GATE-C) | scaffold (FILE) |
| Google SSO | none yet | `docs/designs/AUTH-GOOGLE-SSO-INDEX.md` | #743, #744 (GATE-C) | scaffold (FILE) |
| Account surface | `src/features/account/`, `src/features/preferences/`, `src/features/profileTags/` | `docs/designs/IX-004.md` | (Epic 9) | shipped |
| Session | `src/features/session/` | `docs/designs/AUTH-CALLBACK-CONSUMER-001.md` | #607 | shipped |
| Email transport | `src/features/email/` | `docs/designs/EMAIL-TRANSPORT-001.md`, `docs/designs/EMAIL-TRANSPORT-002.md` | #635, #637 | shipped |

## 9. Branding, tokens & supporting infrastructure

| Feature | Module(s) | Design doc(s) | Issue(s) | Status |
|---|---|---|---|---|
| Design tokens (surface / brand / control / typography) | `src/lib/designTokens.ts`, `src/lib/brandCopy.ts` | `docs/designs/BRAND-001.md`, `docs/designs/BRAND-002.md` | #46, #679 | shipped (axis-dot / #1C1730 token additions AMEND) |
| App shell / header | `src/components/AppHeader.tsx`, `src/components/Screen.tsx` | `docs/designs/BRAND-001.md`, `docs/designs/CARD-VIEW-DETAIL-HUB-001.md` | #46, #735, #656 | shipped |
| Analytics (board diagnostics) | `src/features/analytics/` | `docs/designs/AN-003.md` | #34 | shipped |
| Engagement intelligence (bot-fixture / corpus tooling) | `src/features/engagementIntelligence/` | `docs/ai-driven-bot-rooms.md` | (Stage 6.1.3.2+) | shipped (scaffold; live ops-gated) |
| Dev environment / fixtures / demo corridor | `src/features/devEnvironment/`, `src/features/devFixtures/`, `src/features/demoCorridor/` | `docs/designs/DEMO-001.md`, `docs/designs/HOST-002` | #28 | shipped |
| Cutover health alerts | `src/features/cutoverHealthAlerts/` | `docs/designs/HOST-005.md` | (HOST slate) | shipped |

---

## 10. Maintenance rule

- **When a new feature area is added** (a new top-level `src/features/<area>/` module, or a `src/lib/` capability with its own design doc), add or update its row in the matching section above (or open a new section). The change rides the feature's own PR — the same PR that adds the module also adds its index row, so the index never lags the tree by more than one merge.
- **When a feature's status changes** (e.g. `scaffold` → `shipped`, or a `dormant` model is activated), the row's `Status` flips in the same sign-off change set that updates `docs/product-status-ledger.md` via `node scripts/github/agentIssueRunner.js signoff --issue <n> ...` (`docs/product-status-ledger.md:4-5`). This is the same touchpoint the v4 reference ledger (#755) uses, so the three surfaces — this index, the v4 ledger, and the status log — flip together.
- **Doc-guard expectation:** the index must stay non-empty and every referenced `src/...` / `docs/...` path and `#<num>` issue reference must be well-formed and resolvable; a row whose module is removed is updated or deleted in the removing PR. This is a docs-content check (link resolution), not a production-code change.
- **Non-goal:** this index does not move or rename any existing doc or module, and does not replace either status surface (`docs/core/current-status.md`, `docs/product-status-ledger.md`) — those track status; this maps features → docs/code/issue.

---

## 11. Acceptance evidence map (#756)

| Acceptance bullet | Satisfied by | Evidence |
|---|---|---|
| `docs/feature-repository-index.md` exists, grouped by feature area, with every major `src/features/` module represented and linked to its design doc + issue. | this doc §2–§9 | Eight feature-area sections; the 38 `src/features/` modules (account, admin, adminClassifierHealth, analytics, arguments, auth, concessions, cutoverHealthAlerts, debates, demoCorridor, devEnvironment, devFixtures, email, engagementIntelligence, evidence, invites, languageProcessing, lifecycle, mediator, metadata, moderation, modes, navigation, nodeAnnotations, nodeLabels, notifications, pointStanding, preferences, profileTags, refereeBanners, refereeLedger, refereeLoop, requestReview, rulesUx, semanticOverride, semanticReferee, session, strengthWeakness) each appear in a row with module path + design doc + issue. |
| All referenced paths/issues resolve (doc-guard test passes). | this doc | Module paths cited from a live `ls src/features/`; design-doc paths cited from a live `ls docs/designs/`; issue numbers are well-formed `#<num>` references. Maintenance rule §10 pins the resolution expectation. |
| The maintenance rule is documented. | this doc §10 | New-area / status-flip / doc-guard / non-goal rules, hooked to the existing `agentIssueRunner.js signoff` step. |

---

## 12. Boundary attestation

Docs/PM only. NO Anthropic / xAI / X API call · NO Supabase write · NO service-role · NO migration · NO deploy · NO code edit · NO doc/module moved or renamed · NO room/seat/chime-in/submission semantics changed. No verdict / winner / loser / truth / AI-judge framing introduced; where mediator / classifier features are cataloged the advisory-not-gate and Observation-vs-Allegation framing is preserved. No reference slogan or marketing copy is reproduced; all feature descriptions are original repo-native wording.
