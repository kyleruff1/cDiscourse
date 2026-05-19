# Seamless Conversation Entry + Observer-first Side Action Rail

_Stage 6.4 — UI / UX only. No xAI, Anthropic, or X API calls. No Supabase writes beyond existing user actions. No service-role. No DB migration._

## What this is

Opening a debate from the Conversation Gallery now **defaults to Observer / read mode** with the side action rail **collapsed**. No "choose observer / aff / neg" modal. The rail is the single explicit entry point for picking a side; until the user does that, the room exposes timeline / sidecar / qualifier inspection only.

## Components added

### `gameCopy.ts` — plain-language mappings

Internal codes that used to leak into normal-user surfaces now map to prose:

| Internal code | Normal-user prose |
|---|---|
| `topic_satisfaction_lexical` | "This reply needs a clearer link to the active card." |
| `weak_relevance` | "Needs a stronger tie-in" |
| `source_chain` | "Source trail" |
| `anti_amplification` | "Popularity is not proof" |
| `evidence_debt` | "Receipts needed" |
| `platform_support_warning` | "Do not score as proven yet" |
| `validation_failed_after_retries` | "The move needs a clearer shape before it can play well." |
| `max_depth_reached` | "Deep unresolved chain" |
| `synthesis_ready` | "Near resolution" |
| `submit_failed` | "Posting failed" |
| `observer` | "Watching" |
| `moderator` | "Observer" |

Helpers: `toPlainLanguage(code)` returns the prose or `null`; `toPlainLanguageOrSuppress(code)` is the recommended path for normal-user surfaces (silently drops unknown internal codes). `looksLikeInternalCode(s)` flags snake_case identifiers and HTTP-status reasons; useful in defensive renderers.

Internal codes may still appear in Admin / Debug / Dev surfaces. Stage 6.4 only governs the normal-player flow.

### `ArgumentSideActionRail.tsx`

Collapsed by default for observers. Expanded forms:

| Viewer | Bubble | Actions |
|---|---|---|
| Observer | any | `Watch` · `Join For` · `Join Against` · `Ask source` · `Open timeline` · `Share` |
| Participant | other | `Reply` · `Disagree` · `Ask source` · `Ask quote` · `Split branch` · `Flag` · `Qualifiers` |
| Participant | self | `Qualifiers` · `Request deletion` (no edit, no disagree, no flag, no score controls) |

Each action carries a short helper string. Pure helpers `getRailActions(viewerRole, bubbleActor)` and `railActionToBubbleControl(code)` are exported for tests.

### Smart entry hints — `deriveConversationEntryHint(card)`

Pure function. When the user opens a gallery card, the room shell pre-activates the right message and shows a one-line micro-moment:

| Card bucket | Activate | Hint |
|---|---|---|
| `needs_rebuttal` | root | "Be the first rebuttal" |
| `source_chain_fight` | first open challenge | "Ask for the source" |
| `evidence_fight` | first open challenge | "Challenge the mechanism" |
| `definition_scope_fight` | latest | "Narrow the claim" |
| `unresolved_deep_chain` | latest | "Try narrowing or offer a synthesis" |
| `hot_now` | latest | "Jump into the live exchange" |
| `gaining_heat` | latest | "Add the next move" |
| `pedantic_plain` | root | "Watch first — quiet room" |
| `resolved_or_synthesized` | latest | "Resolved — read how it closed" |
| `my_rooms` | latest | "Continue where you left off" |
| `all_open` | latest | "Watch first — join when ready" |

### Section grouping — `groupGalleryCardsBySection(cards)`

**Stage 6.4 shipped six entry sections.** GAL-001 (Release 6.6 / Wave 4) replaced them with **ten "play lanes"** matching the kind of move a user wants to make. The current set, in render order:

1. **My active rooms** — rooms the viewer has joined for or against.
2. **Needs first rebuttal** — someone posted a claim and nobody has replied yet.
3. **Jump in now** — active back-and-forth; a fresh move lands cleanly.
4. **Source trail fights** — open disputes over what the source actually says.
5. **Evidence needed** — open requests for primary evidence are waiting.
6. **Definition fights** — key terms or scope are being argued out.
7. **Logic traps** — same-axis pressure has repeated without new information.
8. **Tangents and branches** — off-axis pressure built up; a branch reads cleaner.
9. **Almost synthesis** — the two sides have converged enough to summarise.
10. **Quiet beginner rooms** — low-activity rooms; an easy place to start.

Stage 6.4's `hot_unresolved` lane was retired; cards split between `jump_in` (hot_now / overheated) and `logic_traps` (unresolved_deep_chain). Stage 6.4's `easy_first_move` lane was renamed to `quiet_beginner_rooms` (classification rule unchanged). See `docs/current-status.md` § GAL-001 and `docs/designs/GAL-001.md` § "Deterministic grouping" for the full 14-row priority chain.

Each card lives in **exactly one** section (priority-ordered).

## Entry behaviour

1. **Gallery card press** → derives the entry hint, calls `onSelect(debate, sideToUse, hint)`.
2. **Side resolution**: `debate.myParticipantSide || 'observer'`. Existing participants keep their actual side; everyone else enters as observer.
3. **No `JoinDebatePanel` modal on entry.** That panel is kept mounted only for explicit Join Aff / Join Neg actions surfaced inside the room.
4. **Room shell** receives the entry hint and viewer role, pre-activates the correct message, shows the micro-moment prompt above the body, and renders the action rail (collapsed for observers).
5. **Rail expansion** is local — observers can expand to see Join For / Join Against / Ask source / Open timeline / Share. Joining a side runs the existing `onJoin` Supabase upsert (existing user action; no service-role; no direct insert).

## Action label changes

Gallery cards now say:

- `Continue →` — when the user is already a participant
- `Observe →` — open status, not yet joined
- `Open →` — non-open rooms
- Secondary line: "Jump in from inside"

The old "Tap to join →" is reserved for the explicit Join Aff / Join Neg actions inside the rail.

## Hard constraints upheld

- No xAI / Anthropic / X API calls.
- No Supabase writes beyond existing user actions (existing `onJoin` upsert into `debate_participants`).
- No service-role.
- No direct insert into `public.arguments`.
- Message bodies remain immutable.
- Own-bubble action set never includes edit / disagree / flag / score.
- Internal validation codes do NOT leak into normal-user UI (use `toPlainLanguageOrSuppress`).
- Heat means activity / friction. Popularity is not factored as truth credit.
- Duplicate generated rooms remain visually collapsed (Stage 6.3 dedupe preserved).
- Admin Arguments / Admin History tables untouched.

## Manual verification

1. Open Debates / Arguments.
2. Confirm duplicate `[xai-adv …]` / `[ai-corpus …]` / `[stress …]` rooms remain collapsed into single cards (Stage 6.3 dedupe).
3. Confirm card primary action says **Observe** / **Continue** / **Open**, not "Tap to join".
4. Open a room as a non-participant — confirm **no observer-choice modal appears**.
5. Confirm the active message matches the entry hint (root for needs_rebuttal, latest otherwise).
6. Confirm the side action rail starts **collapsed** ("Actions ›").
7. Tap the collapsed rail; confirm `Join For` / `Join Against` / `Ask source` are present.
8. Tap `Join For` — `onJoin` fires, your participant side becomes affirmative, the rail switches to the participant set on the active bubble.
9. Tap your own bubble — the rail's `self` set shows only `Qualifiers` and `Request deletion`.
10. Switch to Timeline mode — confirm the rail stays at the bottom and the timeline rail itself remains horizontal.
11. Confirm validation copy uses plain-language phrasing, not internal codes like `topic_satisfaction_lexical`.
12. Admin tables — confirm untouched.

## Tests

- `__tests__/seamlessConversationEntry.test.ts` — 33 tests covering:
  - plain-language copy mappings + case-insensitive normalisation
  - `looksLikeInternalCode` flags snake_case / HTTP-status reasons
  - `OBSERVER_COPY` + `GALLERY_SECTIONS` catalogues
  - rail action sets (observer / participant-other / self)
  - `railActionToBubbleControl` mapping (incl. rail-only `null` for join/share/open_timeline)
  - `deriveConversationEntryHint` per bucket
  - `groupGalleryCardsBySection` priority + exactly-one-section invariant

## Known follow-ups

- Wide-screen vertical rail (currently bottom-docked at all widths).
- Animated rail expand/collapse.
- "Share" action wiring to a copy-to-clipboard fallback when the platform `Share` API isn't available.
- Section pagination at the entry screen (current screen uses a single paginated list; section view could be added as a toggle).
