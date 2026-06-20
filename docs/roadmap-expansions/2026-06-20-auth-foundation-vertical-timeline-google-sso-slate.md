# Auth Foundation → Vertical Timeline → Google SSO — Roadmap Expansion Slate

> **Run type:** DOCS + ISSUE-PLANNING (read-only). No code, no installs, no migrations, no provider call, no Supabase write, no production change.
> **Visible product name:** **CivilDiscourse** (one word). Internal repo identifiers stay `cdiscourse` until a separate operator-gated migration.
> **Baseline read at:** `HEAD = main = netlify-prod = aef2203` (fully published, read-only).
> **Author role:** Claude Code (SLATE-DOCS author), human-orchestrated under the CDiscourse credential contract.
> **Governance:** binds to `docs/core/pipeline-governance-contract.md`. This run performs no card's IMPLEMENT stage. Cards are filed by the orchestrator after an audit, then implemented later one at a time through the roadmap-designer → implementer → reviewer pipeline.

---

## 1. Executive summary

This slate re-sequences the next stretch of CivilDiscourse work around a launch-readiness spine: **sign-in must work reliably before anything else gets polished**, the **vertical argument timeline** is the highest-value still-unshipped surface from the v4 design package, and **Google single-sign-on** is the one social-login path worth opening for launch.

The earlier v4 overhaul slate (`docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`, issues #675–#694) planned the full design package. Since then the mediator stack, the one-state-per-node chip, the selected-node readout, the Disagreement Points rail, the structured-impasse screen, the clarity-feedback notes, and the "suggest my next move" actions have all shipped or are implemented. What remains under-owned are three things the design package shows clearly but that no open issue currently owns end to end:

1. **A provider-agnostic auth foundation** — email/password sign-in, session handling, redirect allowlist, and first-login profile-row provisioning as one launch-readiness umbrella. Today this is scattered across narrow bug-fix and email-transport issues (#639, #635, #637) with no owner for the foundation itself.
2. **A dedicated vertical timeline surface** — the design package's Section 7 (`07-argument-timeline.md`) shows a history event log, a replay scrubber, a moment-diff view, and a desktop timeline axis. Every existing timeline issue is a *horizontal* board-rail, readout, or declutter card; none owns the vertical replayable history.
3. **A Google SSO lane** — the sign-in screen (`03-mobile-flow.md` screen 01) leads with "Continue with Google." v1 scope excluded OAuth; for launch we open exactly one provider (Google), layered on the auth foundation, never absorbing it.

Facebook (also shown on the sign-in screen) stays **deferred post-launch**. Apple SSO is deferred and assessed alongside the Google lane only if an App Store requirement forces it.

Nothing in this slate weakens doctrine: the deterministic Constitution engine remains the sole submission gate; mediator/MCP/classifier output stays advisory and post-storage; no truth/winner/loser/verdict/person-judgment framing; voice stays a future composition aid with a text fallback; unknown signal stays unknown.

---

## 2. Why this order changed

The v4 slate sequenced work design-section by design-section. This slate re-orders around **what blocks launch and what delivers the most still-missing value**, in three lanes:

### Lane 1 — Auth foundation (config / UI / provisioning) — *first*
Sign-in is the front door. The design package opens on it (screen 01), and the repo already has the callback-consumer plumbing (`AUTH-CALLBACK-CONSUMER-001`, closed) plus a live callback-hang bug (#639) and email-transport work in flight (#635, #637). But **no single issue owns provider-agnostic sign-in as a launch gate**: the redirect allowlist, session lifecycle, and first-login `public.profiles` provisioning have no home. Until that exists, every other surface is polishing a room nobody can reliably enter. This lane goes first, split into config, UI, and provisioning so each can ship and verify independently.

### Lane 2 — Vertical timeline design — *second*
With sign-in solid, the highest-value unshipped design surface is the replayable vertical timeline. The design package devotes an entire section to it (history log → replay scrubber → moment diff → desktop axis), and it is genuinely net-new: the existing board rail is horizontal and the readout panels are point-in-time, not historical. It depends on the shipped mediator board projection but adds a read-only history projection on top. It comes after auth (you must be able to enter a room to value its history) and before SSO (it is product value, not launch plumbing).

### Lane 3 — Google SSO lane — *third*
Google sign-in is desirable but not blocking: email/password already works. It is deliberately last of the three because it (a) depends on the auth foundation lane, (b) requires operator-side provider configuration (consent screen, client id/secret, redirect URIs) that is GATE-C deploy-bearing, and (c) is a convenience path, not the only path. Opening it before the foundation is solid would couple a launch gate to an optional feature.

---

## 3. Inputs used

| Input | What it provided |
|---|---|
| **PDF — `CivilDiscourse v4.pdf`** (SHA256 `7c0041665494d248f864bb33b596fab0b1205251e527bd9e5487ecefbd49a6cb`) | Canonical printed reference for the v4 design intent (screens, doctrine strip, brand). |
| **Design zip handoff** (SHA256 `85655920fcd5de4b8345d3371a8b12f6d425a50d11e1433a1ebe0eb080f6f149`) | The structure-tree handoff set (`design-system.md`, `README.md`, `structure/01`–`09`), 4 HTML exports, and brand assets, inspected read-only under `.tmp/` (not committed). |
| **Repo docs** | `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`, `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md`, `docs/core/current-status.md`, `docs/designs/UX-ROOM-1V1-CHIMEIN-001.md`, `src/features/auth/*`, `src/features/mediator/*`, `src/features/arguments/ArgumentTimelineMap.tsx`. |
| **GitHub issues** | The AUTH / Google / SSO / OAuth / provider / Facebook / provisioning / profile / redirect-callback / invite / ARG-ROOM / timeline reconciliation families (open + closed). |

Key evidence pins:
- Sign-in social buttons + email path: `structure/03-mobile-flow.md` L34–69 (Google L34–42, Facebook L43–48, Apple L49–54, email divider/field/Continue L55–65, footer L66–69).
- Vertical timeline: `structure/07-argument-timeline.md` — TL1 history log (L17–118), TL2 replay scrubber (L119–210), TL3 moment diff (L211–280), TL4 desktop timeline axis (L281–390).
- Node-state precedence (9 display states, deterministic order): `structure/06-node-state-precedence.md` L19–182.
- Tokens / doctrine: `design-system.md` L7–85.
- Open operator questions: `structure/09-implementation-mapping.md` L64–125 (questions 01–07).

---

## 4. Feature preservation rule

**No feature in the reference package vanishes from the plan.** Every item the design shows is accounted for in the reference ledger (`docs/designs/CIVILDISCOURSE-DESIGN-REFERENCE-LEDGER.md`) with exactly one disposition: SHIPPED (cross-reference, do not rebuild), AMEND (advance an existing issue), FOLD (captured by a sibling), DEFER (recorded, not filed now), or FILE (new card). If a feature is SHIPPED it is cross-referenced to its closed/merged work and never re-implemented. If a feature is deferred it is written down with the reason and the gate, not dropped.

**Reference-copy rule.** The design package is inspiration and feature reference, not a copy source. Slogans, catchphrases, and polished marketing lines from the package are NOT reused unless that exact phrase already exists as canonical CivilDiscourse copy in the repo. Feature intent is extracted in original, repo-native wording. Any card that introduces user-facing copy carries a no-copied-reference-slogans note.

---

## 5. Reference feature ledger summary

Compact view; full per-item rows live in `docs/designs/CIVILDISCOURSE-DESIGN-REFERENCE-LEDGER.md`.

| Reference item | Status | Owner card / issue |
|---|---|---|
| Hero promise + doctrine pill | SHIPPED | UX-COPY-001 #676 / QUICK-COPY-001 #712 |
| Accent system + #1C1730 surface + axis-dot oklch | AMEND | UX-TOKENS-001 #679 |
| Three-family typography mapping | AMEND (fold) | UX-TOKENS-001 #679 |
| Runtime tweak/theme knobs | DEFER (record defaults only) | UX-TOKENS-001 #679 / UX-ACCESSIBILITY-001 #693 |
| One-state-per-node chip set | SHIPPED | UX-MEDIATOR-001/002 #682/#683 |
| Brand lockups (sign-in, header, compact) | SHIPPED | UX-BRAND-ASSETS-001/002, UX-ROOM-CHROME-002 #735 |
| Native app icon / splash | AMEND (GATE-C) | UX-BRAND-ASSETS-001 #678 |
| Internal rename cdiscourse → CivilDiscourse | DEFER (operator-gated) | — |
| Sign-in: Google OAuth | FILE | #744 + Google lane below |
| Sign-in: Facebook OAuth | DEFER (post-launch) | — |
| Sign-in: Apple OAuth | DEFER (assess App Store) | Google lane |
| Sign-in: email path | SHIPPED | AUTH-CALLBACK-CONSUMER-001 + auth foundation |
| First-run / mediator-not-judge copy | SHIPPED | UX-COPY-001 #676 / QUICK-COPY-001 #712 |
| Room header seat line | SHIPPED | UX-ROOM-SEATLINE-001 #681 |
| Vertical argument path (node cards) | SHIPPED | UX-MEDIATOR-002 #683 / UX-BOARD-RAIL-002 #715 |
| Selected-node glowpulse + #1C1730 | AMEND | UX-TOKENS-001 #679 / UX-ACCESSIBILITY-001 #693 |
| Chime-in clarification node | PARTIAL → FILE contribution | UX-ROOM-1V1-CHIMEIN-001A #738 → #761 |
| Disagreement points sheet + composer dock | AMEND | UX-MEDIATOR-005 #686 / UX-BOARD-RAIL-004 #731 |
| Selected-node responding-to anchor | SHIPPED | UX-SELECTED-NODE-001 #687 |
| Selected-node one state chip + axis tail | SHIPPED | UX-MEDIATOR-002 #683 |
| Mediator note block (advisory) | SHIPPED | UX-FEEDBACK-001 #690 |
| Act / Inspect / Go dock | SHIPPED (OneBox) | UX-SELECTED-NODE-001 #687 |
| Speech composer + waveform + transcript | DEFER (VOICE slate) | VOICE-007/008/009 #665–#667 |
| Deterministic composer validation | SHIPPED | composer validation (existing) |
| Post-response progress moment | SHIPPED (already shipped) | UX-FEEDBACK-001 #690 |
| "Suggest my next move" | SHIPPED (already shipped) | UX-NEXT-MOVE-001 #688 |
| Clarity feedback ratings | SHIPPED (already shipped) | UX-FEEDBACK-001 #690 |
| Structured impasse screen | SHIPPED | UX-IMPASSE-001 #689 |
| 9-state node precedence table | SHIPPED | UX-MEDIATOR-001 #682 |
| **Timeline: history event log (TL1)** | FILE | #750 |
| **Timeline: replay scrubber (TL2)** | FILE | #750 |
| **Timeline: moment diff (TL3)** | FILE | #750 |
| **Timeline: desktop axis (TL4)** | FILE | #750 |
| **Auth foundation: config / allowlist** | FILE | #739 |
| **Auth foundation: sign-in UI** | FILE | #740 |
| **Auth foundation: first-login provisioning** | FILE | #741 |
| **Google SSO ADR** | FILE | #743 |
| Tablet/desktop three-column responsive | (v4 slate) | UX-RESPONSIVE-V4-001 #691 |

---

## 6. Auth foundation lane

**Goal.** Make provider-agnostic sign-in a verified launch gate: email/password sign-in/sign-up, session lifecycle, redirect allowlist, and first-login `public.profiles` provisioning, owned as one umbrella and split into three shippable cards.

**Why not fold into existing issues.** The reconciliation is explicit: #639 is a live callback-hang bug-fix; #635/#637 are email-transport / invite-redemption; #607/#109/#40 are the closed invite-callback consumer/redirect-helper. None owns the provider-agnostic foundation. We FILE a new foundation and keep the in-flight issues distinct — the foundation must not absorb the live bug or the email-transport work, and Google/SSO must not absorb the foundation.

**Repo grounding.** `src/features/auth/` already has `authApi.ts`, `AuthScreen.tsx` (email+password), `AuthCallbackScreen.tsx`, `consumeAuthCallback.ts`, `useAuthSession.ts`, `signInLockupModel.ts`. Callback-consumer infra exists; provider buttons and a provisioning trigger do not.

**Cards.**
- **#739** — provider-agnostic auth config + redirect allowlist as a launch-readiness checklist + tests. GATE-C where it touches hosted Auth config (operator-applied; no service-role in client; secrets only in Supabase). Depends on (root).
- **#740** — sign-in screen foundation: email/password lockup, error/loading/empty states, session-aware routing, accessibility, no provider buttons yet (those ride the Google lane). UI-only; eligible after reviewer PASS. Depends on #739.
- **#741** — first-login `public.profiles` row provisioning (trigger/RLS), idempotent, never overwriting an existing row. GATE-C (migration-bearing). Depends on #739. Distinct from #637 (invite-token decoupling) and #110 (admin invite/create, closed).

---

## 7. Vertical timeline lane

**Goal.** A read-only, replayable vertical history of a room derived from the existing argument graph + mediator board projection — never a new write path, never a re-derivation of point state.

**Design evidence.** `structure/07-argument-timeline.md`:
- **TL1 — History event log** (L17–118): newest-first vertical stream of typed events (move added, point → Needs evidence, chime-in added a source, point narrowed, reached a structured impasse), each with actor + relative time; a Board / History / Points segmented control; a "Replay this argument" CTA.
- **TL2 — Replay scrubber** (L119–210): an "as the board stood at Move N" frozen snapshot with a horizontal scrub track carrying event ticks + playhead, transport controls, and "Jump to latest."
- **TL3 — Moment diff** (L211–280): for a single move, the point's state before → after and the claim-body before → after.
- **TL4 — Desktop timeline axis** (L281–390): the three-column board (path · selected node · points) with a read-only timeline axis underneath, legend (move / state change / chime-in / impasse), and a playhead at the replayed moment.

**Why FILE (not fold).** Reconciliation: existing timeline issues are all horizontal/board-rail/declutter — TL-001 (default landing, closed), IX-004 (readout, closed), UX-BOARD-RAIL-002/003 (horizontal scrubber/segment-nav), #504 (card declutter, open). None owns a vertical replayable history. The vertical timeline is distinct from the board rail (#730/#728) and readability (#718).

**Doctrine.** The timeline is a **read-only projection** from the argument graph. Scrubbing re-renders a past board state; it never mutates anything and never recomputes point state (state is recomputed only by the engine on real moves). Event labels use structure language ("Point narrowed," "Reached a structured impasse"), never verdicts. Impasse is "preserved — not lost, and not decided."

**Card.** **#750** — vertical argument timeline: history event log + replay scrubber + moment diff + desktop axis, as a read-only history projection. Depends on the shipped mediator board projection (UX-MEDIATOR-002 #683); does not subsume #504's card data contract. Coordinate with the horizontal board rail (#715/#728/#731), do not replace it. Likely staged into model (event derivation) + UI (log/scrubber/diff) sub-slices at design time given effort.

---

## 8. Google SSO lane

**Goal.** Open exactly one social-login provider — Google — via Supabase Auth OAuth, layered on the auth foundation, as a launch convenience path alongside the always-present email/password path.

**Design evidence.** `structure/03-mobile-flow.md` screen 01 leads with "Continue with Google" (L34–42); the maps-to line names "Supabase Auth · Google / Facebook / Apple OAuth."

**Why FILE (not fold).** Reconciliation: every "Google" issue in the repo is Google Cloud Run / GCP hosting (HOST-* epic, all closed). No issue owns Google sign-in. OAuth provider plumbing folds into the per-provider enablement card (not a standalone provider-agnostic OAuth card), layered on the foundation.

**Cards.**
- **#743** — decision record: Supabase Auth Google provider vs alternatives, consent-screen ownership, redirect-URI strategy across dev/prod hosts, native vs web flow, and the secrets boundary (client id/secret in Supabase only; never in client/git). Docs-only; eligible after reviewer PASS. Depends on the auth foundation lane.
- **#744** — "Continue with Google" sign-in via Supabase OAuth: button on the foundation sign-in screen, redirect/callback exchange reusing the existing consumer infra, profile provisioning via the foundation provisioning card. **GATE-C** (provider config + deploy-bearing redirect URIs). Depends on #739, #740, #741, #743, and #639 (callback hang must be fixed for a reliable OAuth return).

**Apple (deferred within this lane).** Apple SSO (`03-mobile-flow.md` L49–54) is recorded as a deferred sibling — assess only if the App Store requires it once another social login is present. Not filed now.

---

## 9. Facebook deferred lane

Facebook sign-in (`03-mobile-flow.md` L43–48, brand `#1877F2`) is **deferred post-launch**. Per the run constraints and v1 scope (email+password only), no Facebook card is filed in this run. If a placeholder is ever wanted it must be explicitly labelled deferred/post-launch and depend on the auth foundation lane and the Google lane (foundation reuse). Standing recommendation: **DEFER — no issue this run.** No Supabase Facebook provider config, no client secrets, no OAuth wiring in this slate.

---

## 10. Additional UX enhancement cards

These are AMEND/FILE items the ledger surfaces that are adjacent to the three lanes but not part of them:

- **UX-TOKENS-001 #679 (AMEND)** — axis-dot oklch hue set, `#1C1730` selected-node surface token, gold-vs-action role separation as tokens, and the three-family typography mapping (assess font loading; TYPOGRAPHY tokens are test-pinned — do not mass-bump). Gold must never become the action/credibility color; axis dots stay equal-weight muted (no red/green verdict).
- **UX-ACCESSIBILITY-001 #693 (AMEND)** — `glowpulse` selected-node animation and waveform must degrade to static under reduce-motion (open question 07); `roomEnergy` Hushed ≈ reduce-motion feel recorded here, not as a live runtime tweak.
- **UX-BRAND-ASSETS-001 #678 (AMEND, GATE-C)** — native app-icon / adaptive-icon / splash from the crane mark (web favicon shipped via #721/#727). Native-asset-bearing.
- **#761 (FILE, GATE-C)** — activate the chime-in *contribution* path (bounded, point-scoped third voice) on top of the dormant 1:1-first model shipped in #738. Backend seat/contribution semantics + RLS (migration likely). Chime-in is a role + attached treatment, never a third principal; private rooms never allow it (OD-1).

---

## 11. FILE / AMEND / FOLD / DEFER / SKIP totals

| Disposition | Count | Cards |
|---|---|---|
| **FILE** | 7 | #739, #740, #741, #750, #743, #744, #761 |
| **AMEND** | 4 | UX-TOKENS-001 #679, UX-ACCESSIBILITY-001 #693, UX-BRAND-ASSETS-001 #678, UX-MEDIATOR-005 #686 |
| **FOLD** | 2 | OAuth plumbing → Google provider card; provisioning → #741 |
| **DEFER** | 5 | Facebook SSO (post-launch); Apple SSO (assess App Store); runtime tweak system; internal cdiscourse→CivilDiscourse rename; speech/waveform (VOICE slate) |
| **SKIP** | 4 | "Supabase Auth" keyword (substrate, owned by #635); "provider" keyword (AI/MCP, unrelated); "profile" keyword (PR-* closed); "redirect/callback" keyword (owned by #639/#637) |

---

## 12. Dependency DAG

```
(root)
 └─ AUTH-FOUNDATION-CONFIG-001
     ├─ AUTH-FOUNDATION-UI-001
     ├─ AUTH-FOUNDATION-PROVISIONING-001
     └─ AUTH-GOOGLE-SSO-ADR-001
           └─ UX-AUTH-GOOGLE-SSO-001  ◄── also needs AUTH-FOUNDATION-UI-001,
                                          AUTH-FOUNDATION-PROVISIONING-001, #639 (callback fix)

UX-MEDIATOR-002 #683 (shipped)
 └─ UX-TIMELINE-VERTICAL-001   ◄── coordinates with #715/#728/#731 (board rail), does not subsume #504

UX-ROOM-1V1-CHIMEIN-001A #738 (shipped, dormant)
 └─ UX-ROOM-CHIMEIN-CONTRIB-001 (GATE-C; gated on OD-1)

UX-DESIGN-PACKAGE-001 #675 (shipped)
 ├─ UX-TOKENS-001 #679 (AMEND)
 └─ UX-ACCESSIBILITY-001 #693 (AMEND)

Deferred (no edge filed): Facebook SSO, Apple SSO, runtime tweak system, internal rename.
```

---

## 13. GATE-C matrix

| Card | GATE-C? | Why |
|---|---|---|
| AUTH-FOUNDATION-CONFIG-001 | **Yes (partial)** | Hosted Auth config + redirect allowlist are operator-applied / deploy-bearing. |
| AUTH-FOUNDATION-UI-001 | No | UI-only; reuses anon key; no deploy coupling. |
| AUTH-FOUNDATION-PROVISIONING-001 | **Yes** | Migration-bearing (trigger + RLS on `public.profiles`). |
| AUTH-GOOGLE-SSO-ADR-001 | No | Docs-only decision record. |
| UX-AUTH-GOOGLE-SSO-001 | **Yes** | Google provider config (consent screen, client id/secret, redirect URIs) + deploy. |
| UX-TIMELINE-VERTICAL-001 | No (if read-only model+UI) | Pure projection over existing graph; no schema, no write path. Re-check at design if any persisted replay state is proposed. |
| UX-ROOM-CHIMEIN-CONTRIB-001 | **Yes** | Seat/contribution semantics + RLS (migration likely). |
| UX-TOKENS-001 #679 (AMEND) | No | Token values + font mapping; assess font asset bundling. |
| UX-ACCESSIBILITY-001 #693 (AMEND) | No | Reduce-motion degradation; no backend. |
| UX-BRAND-ASSETS-001 #678 (AMEND) | **Yes** | Native app.json icon/splash assets. |
| UX-MEDIATOR-005 #686 (AMEND) | No | Mobile sheet UI. |

---

## 14. Operator decisions

### Still open from #680 (OD-1)
- **OD-1 — private-observer policy.** Whether/how private 1:1 rooms ever expose any observer/read affordance. **Still open** (the shipped #738 layer is OD-1-safe: chime-in dormant, private rooms render no chime control). #761 is gated on OD-1 resolving — private rooms must never allow chime-in.

### From the design handoff open questions (`structure/09-implementation-mapping.md` L64–125)
- **01 — Room internals color.** Unify on the warm BRAND black `#08060F` (v3's choice) or keep the cooler `#020617` SURFACE family for the timeline? *(Bears on #750 surface tokens + UX-TOKENS-001 #679.)*
- **02 — UX-FEEDBACK / UX-NEXT-MOVE net-new vs extension?** **Resolved by reality: ALREADY SHIPPED** — UX-FEEDBACK-001 #690 and UX-NEXT-MOVE-001 #688 are both CLOSED. No decision needed; recorded so the question is not reopened.
- **03 — One-state precedence.** How exactly do today's lifecycle tags + manual tags + classifier signals collapse to *one* state? Need the precedence rule (the 9-state ordered table in `06-node-state-precedence.md` is the shipped basis; confirm tie-breaks for the timeline's historical re-projection).
- **04 — Speech persistence.** Transcript text only + a stored amplitude envelope, **no raw audio** per doctrine. *(VOICE slate; recorded here for the timeline's provenance display.)*
- **05 — Desktop col-3 ledger.** Does the desktop ledger column replace the existing side-action rail or sit beside it? *(Bears on UX-RESPONSIVE-V4-001 #691 + the TL4 desktop axis.)*
- **06 — 9-state vocabulary final?** Open · Needs evidence · Definition not shared · Scope mismatch · Evidence blocked · Missing link · Narrowed · Accounts differ · Structured impasse. Confirm final before the timeline hard-codes event labels.
- **07 — Reduce-motion degradation.** Waveform + selected-node glow must degrade to static under reduce-motion. *(AMEND UX-ACCESSIBILITY-001 #693; applies to any timeline playhead/scrub animation too.)*

---

## 15. Recommended next 5 cards

1. **#739** — provider-agnostic auth config + redirect allowlist (launch gate). *Start here; unblocks the rest of the auth lane.*
2. **#740** — sign-in screen foundation (email/password, states, routing, a11y).
3. **#741** — first-login `public.profiles` provisioning (migration-bearing).
4. **#750** — vertical timeline (history log + replay scrubber + moment diff + desktop axis).
5. **#743** — Google SSO decision record (precedes #744).

---

## 16. Doctrine compliance

- Deterministic Constitution engine remains the **sole submission gate**; the timeline and mediator surfaces are advisory/read-only projections.
- No truth / winner / loser / verdict / intent / honesty / bad-faith / person-judgment / AI-judge framing in any planned surface or copy.
- Unknown / insufficient signal stays unknown/open — the timeline re-projects recorded state, it never strengthens a claim.
- Voice stays a future composition aid (VOICE slate); a text fallback always exists; no raw audio stored.
- Observations (machine) vs Allegations (user) stay distinct.
- Secrets never in repo/client; no service-role in client. Google provider secrets live only in Supabase.
- **No-copied-reference-slogans:** any user-facing copy in these cards is authored in original repo-native wording unless an exact phrase is already canonical CivilDiscourse copy in the repo.

## 17. Output doc pointers

- Repository index: `docs/designs/CIVILDISCOURSE-FEATURE-REPOSITORY-INDEX.md`
- Full per-item reference ledger: `docs/designs/CIVILDISCOURSE-DESIGN-REFERENCE-LEDGER.md`
- Prior v4 slate (predecessor, do not re-run): `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md`
