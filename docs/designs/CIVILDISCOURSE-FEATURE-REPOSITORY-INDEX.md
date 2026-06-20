# CivilDiscourse — Feature Repository Index

> Index for the auth-foundation / vertical-timeline / Google-SSO DOCS + ISSUE-PLANNING run. Read-only; the orchestrator files issues after an audit.

---

## 1. What this run did

- Inspected the CivilDiscourse v4 design package (PDF + design zip handoff, read-only under `.tmp/`, not committed) and reconciled it against the live repo + GitHub issues.
- Authored three top-level docs:
  1. `docs/roadmap-expansions/undefined-auth-foundation-vertical-timeline-google-sso-slate.md` — the slate (lanes, DAG, GATE-C matrix, operator decisions, next-5 cards).
  2. `docs/designs/CIVILDISCOURSE-FEATURE-REPOSITORY-INDEX.md` — this index.
  3. `docs/designs/CIVILDISCOURSE-DESIGN-REFERENCE-LEDGER.md` — a per-item ledger so no feature vanishes.
- Re-sequenced the next work stretch into three lanes: **auth foundation → vertical timeline → Google SSO**, with Facebook deferred post-launch and Apple deferred pending an App Store check.
- Proposed 7 FILE cards (5 recommended next), 4 AMENDs, 2 FOLDs, 5 DEFERs, 4 SKIPs (see the slate's totals table). Placeholders `the related card` are filled by the orchestrator at filing time.

## 2. What this run did NOT do

- No code, tests, migrations, Edge/Deno source, native installs, or `package.json`/`app.json` changes.
- No git writes, no issue filing (orchestrator does that), no provider/Anthropic/xAI/X calls.
- No Supabase write, no service-role, no OAuth/Google/Facebook provider configuration, no `.env*` touched.
- No reuse of reference slogans/marketing copy beyond phrases already canonical in the repo.

## 3. Current SHAs

| Ref | SHA | State |
|---|---|---|
| `HEAD` | `aef2203` | clean working tree (read-only run) |
| `main` | `aef2203` | fully published |
| `netlify-prod` | `aef2203` | fully published |

All three point at `aef2203` (`UX-ROOM-1V1-CHIMEIN-001A: 1:1-first room-state pure model + UI/copy (chime-in dormant, OD-1-safe) (#738)`).

## 4. Reference file inventory

**Design zip handoff** — SHA256 `85655920fcd5de4b8345d3371a8b12f6d425a50d11e1433a1ebe0eb080f6f149` (inspected read-only; not committed):

- `handoff/README.md` — how to read the structure trees; index of the set.
- `handoff/design-system.md` — tokens: CSS variables, tweak props, surface/text/axis colors, argument-kind dots, type families, shape/spacing/motion, doctrine.
- `handoff/structure/01-overview-header-and-system-panel.md` — header, accent system, surfaces+type, one-state chip gallery.
- `handoff/structure/02-brand-lockup.md` — primary dark-field lockup, compact header lockup, icon/favicon, minimum mobile-safe, internal-rename note.
- `handoff/structure/03-mobile-flow.md` — sign-in (Google/Facebook/Apple/email), room board, selected node, speech composer, post-response, points sheet, next-move, feedback, impasse.
- `handoff/structure/04-tablet-and-desktop.md` — tablet 768 + desktop 1440 three-column.
- `handoff/structure/05-1-1-room-model.md` — private / public, respondent seat, chime-in states, seat cap, no-chime guard, chime-in composer (R1–R7).
- `handoff/structure/06-node-state-precedence.md` — 9-state ordered precedence table, before/after chip soup, selected-node anatomy, inspect drawer, role-vs-state, conflict resolution.
- `handoff/structure/07-argument-timeline.md` — TL1 history log, TL2 replay scrubber, TL3 moment diff, TL4 desktop timeline axis.
- `handoff/structure/08-component-inventory.md` — component catalog.
- `handoff/structure/09-implementation-mapping.md` — surface → repo home + card; operator open questions 01–07.
- **4 HTML exports:** `CivilDiscourse v4.dc.html` (canonical), `CDiscourse v3.dc.html`, `CDiscourse Redesign v2.dc.html`, `CDiscourse Redesign.dc.html` (history only) + `support.js` (design-tool runtime).
- **Brand assets:** `assets/cd_lockup_dark.png`, `assets/cd_wordmark_gold.png`, `assets/branding/{civic-discourse-logo,civildiscourse-mark,civildiscourse-favicon,lockup-horizontal}.png`, `uploads/{civil_discourse,gold_upgrade_on_transparent}.png`.

**PDF** — `CivilDiscourse v4.pdf`, SHA256 `7c0041665494d248f864bb33b596fab0b1205251e527bd9e5487ecefbd49a6cb` (printed reference for the same v4 design intent).

## 5. PDF / design extraction summary

The design package converges on one direction: a **premium mediator board** as the visual base, a **speech-first loop** as the primary interaction (text fallback always present), and a **disagreement ledger** as the information architecture. Doctrine is encoded in copy + color: gold = brand/dignity emphasis (never the action color); indigo = action/active path; axis dots equal-weight muted (never red/green verdict). The doctrine strip holds: no winner/loser, no AI judge, no truth verdict, no person labels, no "fallacy/bad-faith," no likes/heat; waveform = amplitude only, never credibility.

For this run the load-bearing extracts are: the sign-in social+email screen (drives the auth + Google lanes), the four timeline views (drive the vertical-timeline card), the 9-state precedence table (basis for the timeline's historical state re-projection), and the operator open questions (folded into the slate's operator decisions). Everything else in the package is reconciled in the ledger as SHIPPED / AMEND / FOLD / DEFER and is not re-planned here.

## 6. Issue table

| Card (placeholder) | Title | Disposition |
|---|---|---|
| #739 | Provider-agnostic auth config + redirect allowlist (launch gate) | FILE |
| #740 | Sign-in screen foundation (email/password, states, routing, a11y) | FILE |
| #741 | First-login `public.profiles` provisioning (trigger + RLS) | FILE |
| #750 | Vertical argument timeline (history log + replay scrubber + moment diff + desktop axis) | FILE |
| #743 | Google SSO decision record | FILE |
| #744 | "Continue with Google" sign-in via Supabase OAuth | FILE (GATE-C) |
| #761 | Activate chime-in contribution path (bounded, point-scoped) | FILE (GATE-C) |
| UX-TOKENS-001 #679 | axis-dot oklch + #1C1730 surface + role split + type mapping | AMEND |
| UX-ACCESSIBILITY-001 #693 | glowpulse/waveform reduce-motion degradation | AMEND |
| UX-BRAND-ASSETS-001 #678 | native app-icon / splash | AMEND (GATE-C) |
| UX-MEDIATOR-005 #686 | Disagreement Points full mobile sheet | AMEND |

Deferred (not filed): Facebook SSO (post-launch); Apple SSO (assess App Store); runtime tweak/theme system; internal cdiscourse→CivilDiscourse rename; speech/waveform (VOICE slate #665–#667).

## 7. Project #1 status

Prior v4 slate cards #675–#694 live on Project #1, Phase = Backlog, epic label `epic:civildiscourse-v4`. The new FILE cards in this slate should land on Project #1 with Phase = **Backlog** (the auth foundation lane may move #739 to **Next** as the recommended starting card). Do not add new single-select epic options via API (option-add wipes item assignments) — carry grouping by label.

## 8. Open decisions

- **OD-1** (private-observer policy) — still open from #680; gates #761.
- Handoff open questions 01, 03, 05, 06, 07 — relevant to the timeline + tokens + accessibility cards (see the slate §14). Question 02 is resolved (UX-FEEDBACK / UX-NEXT-MOVE already shipped, #690 / #688). Question 04 (speech persistence) is owned by the VOICE slate.

## 9. Next command

Orchestrator: audit the slate, file the 7 FILE cards + post AMEND comments on #679 / #693 / #678 / #686, replace `the related card` placeholders with filed numbers across all three docs, then implement the recommended next 5 starting with #739 through the roadmap-designer → implementer → reviewer pipeline.
