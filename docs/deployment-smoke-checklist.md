# CDiscourse — Public Dev Deployment Smoke Checklist

_Target environment: **cdiscourse.com/dev** (Release 6.8 public dev hosting). Last updated: 2026-05-18._

Roadmap card: [HOST-003 in `docs/ux-ui-project-board.md`](ux-ui-project-board.md). Sister cards already merged on `main`: HOST-002 (dev banner + bot/test room marker), TL-001 / TL-002 / TL-003 (Timeline-first room shell), ST-001 (Cards relabel), SW-001 (soft standing bands).

This document is the **exact** pre-launch smoke test that must pass before announcing or sharing a fresh dev deployment with anyone outside the operator. It is intentionally narrower than the full UX checklist in [`docs/browser-visual-test.md`](browser-visual-test.md) and the MVP local-dev smoke in [`docs/mvp-smoke-test.md`](mvp-smoke-test.md).

- Use **this doc** before promoting a build to `cdiscourse.com/dev`.
- Use [`docs/browser-visual-test.md`](browser-visual-test.md) when verifying a specific UX stage end-to-end.
- Use [`docs/mvp-smoke-test.md`](mvp-smoke-test.md) for the local-dev MVP smoke (Stage 5.5.6 era; some items are now superseded).

Every item below is binary — record **PASS** or **FAIL** with a one-line note. If you do not run an item, record **SKIP** with a reason. Do not approve a deploy with any **FAIL** unresolved.

---

## Pre-conditions

Run before opening the browser. All must pass before touching the browser tests below.

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| P1 | `npm run typecheck` on the deployed commit | Exit 0, zero errors | Any error |
| P2 | `npm run lint` on the deployed commit | Exit 0, zero warnings (`--max-warnings 0`) | Any warning or error |
| P3 | `npm test -- --runInBand` on the deployed commit | All non-preexisting suites pass; record preexisting failures (if any) by name | A new failing suite vs. main baseline |
| P4 | `npm run skills:validate` | Exit 0, "all skills pass" line printed | Any skill hash mismatch |
| P5 | Dev hosting bundle built without warnings about `service-role`, `sb_secret_`, `sk-ant-`, `xai-`, `eyJ` | grep over the built bundle returns zero hits | Any literal match |
| P6 | `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` point at the dev project, not prod | URL hostname / project ref matches the dev project's ref | Hostname matches prod |
| P7 | `submit-argument` Edge Function is deployed at the version that treats `topic_satisfaction_lexical` / `parent_overlap` as **advisory** (Stage 6.2 or later) | `supabase functions list --linked` shows ACTIVE; deploy hash matches expected | Older version still hard-blocks |
| P8 | No `.env*` files committed to the deploy artifact | `git ls-files` on the deploy commit shows zero `.env*` files | Any committed `.env*` |

---

## Auth (signup + login)

Open `cdiscourse.com/dev` in a fresh incognito window.

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| A1 | **Sign-up form renders.** | Email + password fields visible; submit button reachable by keyboard | Form missing, fields disabled without explanation, or focus order broken |
| A2 | **Sign-up succeeds.** Use a throwaway email. | Confirmation email arrives (or "check inbox" message renders), then app accepts magic-link / verified login | Error toast; verification email never arrives; redirect leaks any `sb_secret_*`, `sk-ant-*`, or service-role JWT in URL or copy |
| A3 | **Login with existing dev account.** | Lands on the conversation gallery, not a 404 / blank screen | Lands on error page; console shows uncaught error |
| A4 | **Logout.** | Returns to auth screen; subsequent gallery URL bounces back to auth | Stays logged in; gallery accessible after logout |

---

## Gallery (conversation entry)

After A3 lands on the gallery.

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| G1 | **Gallery loads.** | At least one conversation card renders within 3 seconds; no perpetual skeleton | Skeleton never replaced; spinner never resolves; console shows network failure |
| G2 | **Duplicate generated rooms are visually collapsed.** Rooms with `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` titles share one card per family. | Card shows `N duplicate runs collapsed` inline; one card per canonical conversation | Each generated room shows its own card (Stage 6.3 dedupe regression) |
| G3 | **Bot / test rooms are visually marked** so a public visitor can't confuse them with real debates. (HOST-002 has landed: `src/features/devEnvironment/devEnvironmentModel.ts#isBotOrTestDebate` classifies titles carrying the `xai-adv` / `ai-corpus` / `stress-*` / `scenario-*` / `seed-*` suffixes, and `ConversationGalleryScreen.tsx` renders a `Test · <kind>` pill.) | Each suffix-tagged title in the gallery shows a `Test · <kind>` pill alongside the heat/temperament pills | Test rooms are indistinguishable from real debates; or the `Test` pill is missing on a card whose title clearly matches a corpus-runner suffix |
| G4 | **Empty / loading / error states** all render plain-language copy, not internal codes. | No `topic_satisfaction_lexical`, `evidence_debt`, `synthesis_ready`, etc. visible to the user | Any snake_case code visible (use `gameCopy.toPlainLanguage` or `toPlainLanguageOrSuppress`) |
| G5 | **Action labels** show `Observe →` / `Continue →` / `Open →` per the Stage 6.4 contract — no `Tap to join →` on the gallery. | Labels match Stage 6.4 entry copy from [`docs/seamless-conversation-entry.md`](seamless-conversation-entry.md) | `Tap to join` appears on a gallery card |

---

## Conversation entry (observer-first)

Pick any open conversation card from G1.

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| C1 | **Open room from the gallery defaults to Observer mode.** No "choose side" modal on entry. Side defaults to `observer` for users who are not already participants. | URL loads room; user is read-only; `JoinDebatePanel` is NOT auto-mounted | "Choose side" modal pops on every gallery click; observer cannot enter without picking |
| C2 | **Observer side action rail is collapsed by default.** Expanded set is `Watch · Join For · Join Against · Ask source · Open timeline · Share`. | Rail is collapsed; expanding shows exactly those 6 actions | More actions visible than the observer set; observer sees `Reply` / `Disagree` / `Flag` |
| C3 | **Explicit join side works.** Press Join For (or Join Against). | Side updates in DB; rail switches to participant set (`Reply · Disagree · Ask source · Ask quote · Split branch · Flag · Qualifiers`); no page reload required | Side change fails silently; rail does not update; or page hard-refreshes |
| C4 | **Own bubble action set is restricted** after posting. | On your own bubble: only `Qualifiers · Request deletion` are exposed — NO edit, NO disagree, NO flag, NO score control | Any of edit / disagree / flag / score appear on own bubble |

---

## In-room behavior

In the same room as C1–C4.

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| R1 | **Open to Timeline by default.** TL-001 has landed — Timeline is the primary view; the toggle chip says "Cards" for the deeper inspector (ST-001), never "Stack". | Default mode renders Timeline within 1s of room open; no flash of Cards first; chip label reads "Cards" not "Stack" | Default is Cards / unset; user lands on a blank "pick a mode" screen; or the chip still says "Stack" |
| R2 | **Post a move.** Compose a short reply with valid body length. Submit. | Edge Function returns 2xx; new node appears on the Timeline and on the Cards view; sidecar updates | 4xx with internal code in the user-facing toast; OR submit hangs; OR new move not visible without reload |
| R3 | **Timeline ↔ Cards toggle preserves active message.** Switch back and forth. | Active node stays the same; sidecar stays in sync | Active node drifts; sidecar shows stale parent |
| R6 | **In-room no-route invariant (TL-003).** All view changes — Cards ↔ Timeline toggle, quick actions, sidecar focus, popovers, composer open/close — happen via state, not URL routes. | URL path does not change when toggling modes / opening sidecar / firing quick actions; no `@react-navigation/*`, `expo-router`, or `react-router*` request in the network panel | URL changes on any in-room interaction; or a routing-library request appears |
| R4 | **Evidence popover renders** when invoked from a node that has a source claim. (Requires EV-002 to have landed in the deployed commit.) | Popover opens; source chain renders; close returns focus to the rail | Tap registers but popover never opens; or popover crashes the room |
| R5 | **No console 404s.** Open browser devtools, reload, exercise R1–R4. | Network panel shows zero 404s on app-owned routes; any 404 is a known third-party fetch | Any 404 on `/functions/v1/*`, `/storage/*`, `/rest/*`, or static app assets |

---

## Profile / preferences

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| Q1 | **Preferences popout opens.** (Requires PR-001 to have landed.) Until then this item is **SKIP** with the note "PR-001 not yet shipped." | Popout renders; saves persist | Popout missing; save silently fails |
| Q2 | **Avatar default renders.** No broken-image icon for users without an uploaded avatar. (Until PR-003 lands, accept the default initials avatar.) | Initials or generated avatar shows for every user across gallery + room | A broken-image icon appears anywhere |

---

## Plain-language safety

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| L1 | **No raw internal codes are visible to a normal user anywhere.** Sweep gallery, room, banners, error toasts, and modals. | No `topic_satisfaction_lexical`, `parent_overlap`, `evidence_debt`, `platform_support_warning`, `validation_failed_after_retries`, `max_depth_reached`, `synthesis_ready`, `submit_failed`, `anti_amplification`, `source_chain`, `observer`, `moderator`, or other snake_case tokens appear to the user | Any snake_case / HTTP-status reason rendered as user copy |
| L2 | **No verdict tokens** in any visible copy. | No `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `winner`, `loser`, `stupid`, `idiot`, `troll`, `bot`, `astroturfer` in any rendered text | Any of those words appears in user-facing copy |
| L3 | **Standing-band labels are SW-001 soft copy.** Sweep any rendered band cell in the Cards view, sidecar score tracker, and Timeline tooltips. | Visible labels match the SW-001 soft map (`Needs work`, `Thin`, `Some support`, `Has a point, but risky`, `Well supported`, `Strongly supported`, `Neutral`, plus `No reading yet` / `Not enough yet`); a shape glyph prefixes the label so the band is distinguishable when desaturated | Any band cell shows the legacy "Pretty wrong" / "Completely right" copy, or any verdict token from L2 |

---

## Security and leak checks

| # | Check | Pass criterion | Fail criterion |
|---|---|---|---|
| S1 | **No service-role usage in client code.** | `grep -r "SUPABASE_SERVICE_ROLE_KEY\|service_role" app/ src/` returns zero matches in the deployed bundle | Any match |
| S2 | **No long-form secrets in client bundle.** | grep over the built JS bundle for `sk-ant-`, `xai-`, `sb_secret_`, `Bearer `, `eyJ[A-Za-z0-9_-]{20,}` returns zero matches | Any match |
| S3 | **No admin email addresses leaked to client** by `request-argument-deletion` response paths. | Network panel shows no admin email in any response; `not_configured` fallback returns a generic shape | Admin email present in a JSON response |
| S4 | **No raw Authorization or `RESEND_API_KEY` ever logged.** | No `Authorization:` or `RESEND_API_KEY` substring in browser console or in Edge Function logs visible to the operator | Any literal match |
| S5 | **No X handles (`@...`), `x.com/...`, `twitter.com/...`, `t.co/...` URLs, or 15–20 digit X post IDs** appear in any user-facing copy or stored debate body. | Sweep of the gallery + a few open rooms shows zero matches | Any match (regression on the engagement-intelligence redactor) |

---

## Post-smoke record

After every full pass, append a row to the table below. Do not delete previous rows — they are the audit trail for which builds were approved for `cdiscourse.com/dev`.

| Date (ISO) | Operator | Deploy hash | Pre-conditions | Auth | Gallery | Entry | In-room | Profile | Plain-language | Security | Verdict | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05-18 | _example_ | abcdef0 | PASS | SKIP | SKIP | SKIP | SKIP | SKIP | SKIP | SKIP | NOT-RUN | Template row only — replace on first real run. |

---

## When the checklist itself changes

- Update this doc only when a new Stage adds a check, a check becomes obsolete, or a fail-criterion needs tightening.
- Keep historical rows in the "Post-smoke record" table — they are evidence of what was verified at which commit.
- Cross-link to `docs/ux-ui-project-board.md` (HOST-003 card) so the maintenance loop stays visible from the roadmap.
