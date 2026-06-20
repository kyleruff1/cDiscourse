# CivilDiscourse — Copy System Standard

**Code:** `UX-COPY-SYSTEM-002` · **Type:** DOCS standard (no code, no installs, no migrations, no provider call, no Supabase write, no semantics change).
**Owns:** the durable, repo-native VOCABULARY + meaning-grammar standard for all user-facing product language. This is the WHAT-WORDS-MEAN layer.
**Does NOT own:** which string is shown on which surface (that is the string-swap card, #676); the mechanical case/verb/punctuation grammar (that is the grammar-mechanics card #754 → `docs/copy-review/copy-grammar-standard.md`); the per-construct lint harness (that is #677). Those are complementary guards, not this one.
**Doctrine root:** `cdiscourse-doctrine` §1–§3, §9, §10 · `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` §10 (boundary attestation) · `docs/adr/AUTH-GOOGLE-SSO-ADR-001.md` (auth language).

> CivilDiscourse is a **high-trust mediator board**, not a judge, a feed, a scoreboard, or a debate-game. The deterministic Constitution engine is the **sole submission gate**; the mediator is **advisory and post-storage**. Every word the product shows must hold that line. This document is the canonical word-list and grammar that keeps the copy honest.

---

## 1. Purpose and scope

The shipped product language already lives in a handful of frozen constants:

- `src/features/arguments/gameCopy.ts` — `SEAT_CLAIM_COPY`, `ROOM_ACCESS_COPY`, `ROOM_VISIBILITY_COPY`, `ROOM_ONE_TO_ONE_COPY`, `POINT_SCOPED_CHIME_IN_COPY`, `OBSERVER_COPY`, `STATUS_COPY`, `TIMELINE_COPY`, `INVITE_COPY`, `ARGUMENT_ROOM_CREATE_COPY`, plus the `toPlainLanguage` map.
- `src/features/debates/roomContractModel.ts` — `ROOM_CONTRACT_COPY`.
- `src/features/mediator/mediatorPlainLanguage.ts` — `MEDIATOR_STATE_COPY`, `MEDIATOR_STATE_HELPER`, `PATHWAY_STEP_COPY`, `IMPASSE_SUBTYPE_COPY`.
- `src/lib/brandCopy.ts` — `PRODUCT_NAME`, `PRIMARY_TAGLINE`, `PRINCIPLE_MARK_THE_POINT`, and the reserved mediator prompts.
- `src/features/auth/` — the sign-in surface.

Each of those modules carries its OWN ban-list test today. This standard does three things those scattered tests do not:

1. names the **allowed vocabulary** so new copy reaches for the right word the first time;
2. consolidates the **banned vocabulary** into one published list, with the carve-outs spelled out;
3. pins the **room/seat/invite grammar**, the **mediator-not-judge** voice, the **SSO-READY** auth language, the **voice-FUTURE** wording, the **timeline-is-structure-not-feed** rule, and the **no-copied-reference-catchphrase** rule.

This is a standard, not a refactor. It codifies the strings already shipped; it changes none of them. Wording changes are owned by #676.

---

## 2. Allowed vocabulary

Use these words. They describe the **structure of a disagreement** and the **structural state of a room/seat/point** — never a person, a verdict, a popularity signal, or a feed.

### 2.1 Room / participation

| Concept | Allowed term | Source of truth |
|---|---|---|
| The room as a structured two-voice contract | **Public 1:1** / **Private 1:1** | `ROOM_CONTRACT_COPY.publicRoom/privateRoom`, `ROOM_ONE_TO_ONE_COPY.label_public/label_private` |
| The open second principal seat | **Respondent seat open** | `ROOM_CONTRACT_COPY.seatOpen`, `ROOM_ACCESS_COPY.public_open_line` |
| The two principal participants | **principal voices** ("2 principal voices") | `ROOM_ONE_TO_ONE_COPY.principal_voices_heading` |
| People reading without a seat | **Observers** / **Readers** ("Observers watching") | `ROOM_ONE_TO_ONE_COPY.observers_watching`, `OBSERVER_COPY.badge = 'Watching'` |
| Reading does not consume a seat | **Readers do not use active seats** | `SEAT_CLAIM_COPY.readersNote` |
| Seat capacity fact | **active seats** ("{active} of {cap} active seats") | `SEAT_CLAIM_COPY.activeSeatsSummary` |
| A full room | **Seats are full — you can still observe.** | `ROOM_ACCESS_COPY.public_full_line` |
| Watching as a first-class state | **observe** / **watch** | `OBSERVER_COPY.enterRoom = 'Observe'` |
| A point-attached side contribution | **point-scoped chime-in** (public-only; never a principal seat) | `POINT_SCOPED_CHIME_IN_COPY` |
| Visibility | **Public** / **Private** | `ROOM_VISIBILITY_COPY.option_*_label` |

### 2.2 Mediator / point state

The nine-state mediator vocabulary is the **positive grammar exemplar** — short, person-neutral noun phrases:

> Open · Needs evidence · Definition not shared · Scope mismatch · Missing link · Partially narrowed · Evidence blocked · Difference of recollection · Structured impasse · Resolved · Different priorities · Key detail unavailable · Off-point response

(Source: `MEDIATOR_STATE_COPY`. The product surfaces the v4 nine; the model carries a 13-code superset.) Helper lines describe **the point**, never the author: "This point needs a source or record." "The evidence path is not available right now." "The disagreement is smaller now."

Allowed mediator framing words: **point, claim, source, record, evidence, definition, scope, narrow, branch, synthesize, concede, impasse (structured), preserved, unresolved, open, pathway, what remains unresolved, what would move this forward.**

### 2.3 Standing / support (de-scored)

The product does **not** keep score. Where comparative-standing copy is unavoidable, use **support** language: "More support so far", "Better supported point", with the honesty line "This reflects the current state of the argument, not objective fact." (Source: `STATUS_COPY`.) Never "ahead", "winning", "points" as a tally.

### 2.4 Brand

- Visible product name is **CivilDiscourse** (one word). Internal repo identifiers stay `cdiscourse` (deferred operator-gated migration; do not rename here).
- Primary tagline: **"A high-trust room for hard conversations."** (`PRIMARY_TAGLINE`).
- Principle line, used **sparingly** (never the masthead tagline): **"Mark the point, not the person."** (`PRINCIPLE_MARK_THE_POINT`).

---

## 3. Banned vocabulary

Never ship these in user-facing copy. They assert a verdict, judge a person, treat popularity as evidence, or frame the room as a social feed/forum. This is the consolidated COPY-SYSTEM ban list; it is the union of the existing per-module lists (`_forbiddenMediatorTokens`, `_forbiddenOneToOneTokens`, `_forbiddenRoomAccessTokens`, `_forbiddenSeatClaimTokens`, the COPY-001 gap tokens) plus the social-feed family.

### 3.1 Verdict / correctness / person-judgment

`winner` · `loser` · `won` · `lost` · `score` · `verdict` · `truth` · `true` · `false` · `correct` · `incorrect` · `right` (as correctness) · `wrong` · `proven` · `disproven` · `validated` · `liar` · `dishonest` · `bad faith` · `manipulative` · `extremist` · `propagandist` · `troll` · `fallacy`

### 3.2 AI-authority

`AI judge` · `AI decides` · `AI thinks` · `decide for me`. The mediator is advisory; it never adjudicates truth or names a winner.

### 3.3 Amplification / popularity (popularity is not evidence)

`likes` · `retweets` · `shares` · `views` · `followers` · `verified` · `engagement` · `amplification` · `trending` · `virality` · `popular` · `viral` · `upvote` · `downvote`

### 3.4 Social-feed / comment-thread / forum framing

`social feed` · `feed` (as a place to scroll) · `comment` / `comment thread` · `pile on` · `forum` · `audience` · `open mic` · `join the debate` · `third side`

### 3.5 Punitive / membership-removal

`booted` · `kicked` · `banned` · `silenced` · `blame` · `fault` · `hiding` · `withheld` · `concealed` · `refused` · `failed` (as a person's failing). A blocked evidence path describes an **unavailable record**, never a person hiding one.

### 3.6 Documented carve-outs (banning these would be wrong)

- **`hot`** is permitted as an ACTIVITY word in gallery sections ("Hot but unresolved") — doctrine §2 carve-out, pinned in `copyReviewBanListGaps.test.ts`. It is NOT a heat/popularity verdict there.
- **`block` / `blocked`** is permitted only in **"Evidence blocked"** — the operator-preferred v4 term for an UNAVAILABLE record. It must never mean a posting block (the board never blocks posting; non-gating is guaranteed by architecture). The standalone tokens `prevent/reject/forbid/disallow/denied` ARE banned for the board's own copy.
- **`opponent`** is NOT banned (the `seatOpponent` relabel is the deferred OD-5 decision); new copy should still prefer **respondent / principal voice**.
- **`bot`** appears only in the explicit bot-test marker family; never as a person-attribution token in product copy.

---

## 4. Room / seat / invite grammar

The room is a **structured 1:1 contract**, not a thread anyone can pile into. The canonical grammar:

| State | Canonical copy |
|---|---|
| Public room label | **Public 1:1** |
| Private room label | **Private 1:1** |
| Open second seat | **Respondent seat open** — observe or take it. |
| Reserved seat | A seat is saved for an invited person. You can still observe. |
| Full | Seats are full — you can still observe. |
| Private member view | Private 1:1 — you are in this argument. |
| Principals heading | **2 principal voices** |
| Observers heading | **Observers watching** |
| Reader rule | **Readers do not use active seats** |
| Capacity fact | {active} of {cap} active seats |

Grammar rules:

1. The open public seat is the **respondent / principal** seat — **never** "chime-in", never "step in", never "join the debate".
2. A **chime-in** is **point-scoped**, **public-only**, and **never opens a principal seat** (`POINT_SCOPED_CHIME_IN_COPY.does_not_open_seat`). A private room renders no chime affordance at all — absence, not a disabled control.
3. **Observing/reading is a first-class state**, never a demotion. A full room is a structural fact, not a loss.
4. **OD-1-SAFE private copy:** private rooms say **"Invited access. No public chime-ins."** — they must NOT claim "no observers" / "invited parties only" / "only the person you invite" (shipped code allows private observers; the operator decision OD-1 is unresolved).
5. **No enumeration:** the deep-link unavailable state is cause-neutral and IDENTICAL for a nonexistent id and a private-no-access room (`ROOM_ACCESS_COPY.unavailable_*`). It must never assert "it is private."
6. **Invite grammar** names no one and reveals nothing about whether an invitee already has an account: no `existing` / `new user` / `account` / `registered` tokens.

---

## 5. Mediator, not judge

The product **surfaces the structure of a disagreement — never who is right** (`cdiscourse-doctrine` §1).

- Every mediator state describes **the point**, not the person: "This point needs a source or record", not "You failed to provide evidence."
- The board is **advisory and post-storage**. It never blocks, rejects, routes, or delays an ordinary post. The deterministic Constitution engine is the **sole submission gate**. No copy may imply the mediator gates posting.
- An impasse is a **calm, complete destination** — "The disagreement is preserved" — never a deadlock, failure, defeat, or verdict.
- Narrowing/concession is **progress** — "The disagreement is smaller now" — never a scoring loss.
- No copy assigns a **truth value**, a **winner/loser**, a **person label**, an **intent/honesty judgment**, or a **"fallacy"** call.

---

## 6. SSO-READY auth language

Email + password sign-in is the **canonical, always-present** path and must keep working. Google is governed by `docs/adr/AUTH-GOOGLE-SSO-ADR-001.md` and is **additive**.

Copy rules:

1. **Never claim Google sign-in is live** unless the hosted provider config (#745, GATE-C, operator-run) has actually landed. Until then any "Continue with Google" affordance is **inert** (ADR §63: "the Google button is **inert** until #745 lands") — provably no provider call is possible.
2. The conventional affordance label is **"Continue with Google"** — a single one-link create-or-sign-in action (ADR §29). There is no separate "Sign up with Google."
3. **No account-enumeration** copy: no error or helper may reveal whether a given email already exists (ADR §35).
4. The sign-in hero is the brand lockup + the primary tagline only; do not re-author the value-prop strings here.
5. **SSO-READY ≠ SSO-LIVE.** Describe the surface as ready for a social provider, never as "sign in with Google now" while the button is inert.

This document ships **no auth code**. It states the language constraints; the inert-button guarantee is owned by the auth implementation card and the ADR.

---

## 7. Voice — FUTURE composition aid

Voice/speech composition is a **future** composition aid (the v4 speech-first composer rides VOICE-007/008/009; no shipped React voice component exists today).

- **Never say "voice is on" / "mic active" / "listening"** as if voice were a shipped feature. Voice copy describes a **future** affordance or stays absent.
- A **text fallback always exists** at every entry window; permission denial never blocks posting.
- If/when voice ships, the waveform is **amplitude only, never credibility** — and raw audio is never stored, uploaded, replayed, or sent to a classifier (doctrine; index §10).

---

## 8. Timeline is structure, not a feed

The argument timeline renders the **structure** of the conversation — one node per move on a baseline — not a scrollable social feed.

- Describe it as **"move-by-move history"** / structure (`OBSERVER_COPY.openTimelineHelp = 'Inspect the move-by-move history.'`), never as a "feed", "timeline feed", or "comment thread."
- The bubble stack is explicitly **"Never renders a vertical comment thread"** (`ArgumentBubbleStack.tsx`). Copy must match: it is a structured surface, not a thread.
- Do **not** claim a vertical timeline is LIVE — the vertical-timeline surface (UX-TIMELINE-VERTICAL-001) is design-stage; describing it as shipped would be false.
- Timeline copy carries no heat/popularity/feed framing.

---

## 9. No copied reference catchphrases

The v4 design package (inspected in `.tmp/`, never committed) informs the **grammar classes and feature intent** — not the literal marketing text. Do **not** lift slogans, catchphrases, or polished marketing lines from the v4 PDF/zip into shipped copy unless the exact string is **already canonical repo copy** (e.g. `PRIMARY_TAGLINE`, `PRINCIPLE_MARK_THE_POINT`, the reserved mediator prompts in `brandCopy.ts`). All other normalized strings are authored in **original repo-native wording**.

The only conventional string permitted from outside is the standard **"Continue with Google"** affordance (ADR §90), which is a conventional UI label, not a design slogan.

---

## 10. The guard (test)

This standard is enforced by a centralized ban-list guard, `__tests__/copySystemBanList.test.ts` (additive; co-exists with the per-module ban-list tests):

- It flattens the shipped product-language constants (room/seat/visibility/observer/mediator/brand) to their string values and asserts **no §3 banned token** appears, using whole-word/phrase, case-insensitive matching (the exact word-boundary matcher used in `oneToOneRoomModel.test.ts`) so legitimate substrings never false-positive.
- It includes a **positive control** (intentionally violating strings trip the guard) and a **negative control** (canonical room/seat/auth copy passes).
- It pins the §3.6 carve-outs as invariants: the banned set must NOT contain `block` (the "Evidence blocked" term) or `opponent` (deferred OD-5).

The guard imports only already-exported constants and asserts non-presence of tokens already absent, so it is green on the current tree. It adds no product string and changes no semantics.

---

## 11. Boundary attestation

- **Docs + one additive test only.** No copy CONSTANT is edited (wording is owned by #676); no string is added or removed.
- **No** Anthropic / xAI / X API call · **no** Supabase / RLS / Edge / migration / MCP · **no** native dep / install / `app.json` change · **no** deploy · **no** hosted OAuth/provider config or provider call.
- **No** room / seat / chime-in / invite / observer / auth / session / provisioning **semantics** change; **no** vertical-timeline implementation; **no** repo/runtime identifier rename.
- **Email/password sign-in keeps working.** Any "Continue with Google" affordance stays **inert** (no network possible) until the operator-gated hosted config lands (ADR).
- The deterministic Constitution engine remains the **sole submission gate**; the mediator stays advisory and post-storage.
