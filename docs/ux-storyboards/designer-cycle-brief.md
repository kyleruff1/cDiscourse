# CDiscourse — Designer-Cycle Brief

The findings from the storyboards and the roadmap collision analysis are **not
optional documentation** — they trigger a **mandatory design cycle with the
designer before broad implementation continues**. This brief is the designer's
input packet.

> Companion: [`design-cycle-handoff.md`](design-cycle-handoff.md) (who gets
> what), [`priority-implementation-queue.md`](priority-implementation-queue.md)
> (the implementer's ordered queue).

---

## Design problem statement

CDiscourse must move from a feature-by-feature roadmap to a **coherent
first-version user experience**: a person lands, understands the argument
landscape in seconds, opens a conversation, and acts through one consistent
input surface. The pieces exist (timeline, gallery, composer, popouts) but they
do not yet add up to one experience.

## Current UX friction

- The Arguments entry screen still exposes legacy / discouraged wording in
  normal-user surfaces.
- Repeated corpus posts flood the entry list — there is no reliable "one card
  per conversation" model.
- The entry surface does not yet compactly show what a user needs to triage a
  room (root post, latest move, status, heat, needs-response, no-rebuttal,
  evidence debt, private/public).
- The timeline is improving but is not yet a clean horizontal line/scrubber
  with branches/tangents/chime-ins visually attached.
- Composing is spread across bespoke surfaces (`CreateDebateForm`,
  `JoinDebatePanel`, `AddAnnotationSheet`, `DeletionRequestSheet`, multiple
  docks) — high compliance friction, inconsistent.

## Desired first-version user experience

1. Land on the **Conversation Gallery** — one card per conversation, scannable.
2. Triage with focus lenses (needs response · no rebuttal · heating up · hot ·
   quiet · evidence requested · private invites · my rooms).
3. Open a room → land on the **horizontal timeline**, latest move active,
   observer-first.
4. Act through the **one box** — re-typed by a flash menu; Act / Inspect / Go
   popouts for everything else. No bespoke screens.
5. Start an argument through one **Argument setup** flow into the same box.

## Product language rules

- **Do not call it a game in UI.** No "game", "gaming", "game surface",
  "player" in normal-user copy.
- **Prefer "Argument" over "Debate" in normal-user UI.** A tab/page label is
  "Arguments", never "Debates".
- No "Tap to join" — use context actions ("Open", "Observe", "Respond").
- No "winner / loser / truth / proof" verdict copy.
- Admin / operator screens and internal code/schema are exempt (the `debates`
  table keeps its name). See `terminology-and-copy-rules.md`.

## Entry-screen redesign needs

- Remove remaining "debate" wording from the live Arguments entry surfaces.
- The entry action is "Start an argument" (already live) → Argument setup.
- One card per conversation; corpus duplicates collapse.

## Argument-gallery redesign needs

A gallery card must compactly show: first/root post · latest move · conversation
status · heat / momentum / temperament · needs-a-response · no-rebuttal-yet ·
evidence/source-chain debt · private/invited/public · and whether the room is
quiet / heating up / hot / pedantic-or-plain / evidence-heavy / unresolved.
Search · pagination · sort (created · activity · engagement state).

## One-box composer needs (QOL-030)

One switchable box; a flash menu re-types it (`root_claim`, `respond`,
`add_evidence`, `ask_source`, `branch_tangent`, …). Per-type schema (free-body /
forced list / structured form). Posting goes through `submit-argument` only.

## Act / Inspect / Go popout needs (QOL-031/032/033)

Three popouts and nothing else beyond the box: **Act** (do), **Inspect**
(understand), **Go** (traverse). Each is engine-gated + role-gated + stage-aware.

## Timeline / branch / tangent needs

Move toward a **horizontal line/scrubber**: mainline nodes left-to-right,
chime-in nodes as vertical branches, tangents as diagonal branches, all
visually attached to the node they spring from. Latest move active by default.
Stack/Cards is the detail surface.

## Evidence-debt needs (EV-003)

"Ask source" opens a visible evidence debt; status surfaces on the node, in
Inspect, and on the gallery card. Evidence ≠ truth.

## Invite / private / public needs

Email invite → signup/auth → directly into the room (QOL-038). Public/private
chosen at setup; public→private transition rules (QOL-039).

## Observer / chime-in needs

Observer-first entry, collapsed side option bar. Chime-ins are vertical branch
nodes governed by the two primary participants (GAME-005).

## Settlement / lock needs

Both parties settle → the room locks, grey, read-only, still referenceable.
Never "case closed" — "settled".

## Future voting / promotion (consider, do not implement)

Voting and public promotion are **out of scope** for this cycle. The gallery
model already reserves placeholder fields; the designer should leave room for
them but specify nothing that requires them.

## Known code constraints

- Pure rules engine (`engine.ts`) stays pure; no network / React in it.
- No service-role in client; posting only via `submit-argument`; no direct
  insert into `public.arguments`.
- Do not rename the `debates` / `arguments` tables.
- AI moderation is advisory only; the flash menu is deterministic (engine-gated,
  not AI-gated).
- No new dependencies unless impossible with RN primitives.

## Dependencies

QOL-030 → QOL-031 → QOL-032 → QOL-033 (sequential). EV-003, IX-001, GAME-003B
design stubs feed the gallery, the popouts, and the setup flow. IX-003 (reopened)
owns the keyboard map.

## Questions for the designer

1. Card view authorable (QOL-030 D2) — confirmed widening of ST-001?
2. Flash-menu trigger + form — radial, chip strip, or list sheet?
3. Is the Inspect popout a third popout, or a long-press on the node (2 popouts)?
4. Gallery card density — how much fits before it stops being scannable?
5. The dedupe key for "one card per conversation" when corpus duplicates exist.

## Decisions required before the implementer proceeds

- Sign-off on the three-popout model (Act / Inspect / Go).
- Sign-off on the one-box `type × target × view` model.
- Sign-off on the gallery card's required fields (the triage set above).
- Confirmation that QOL-030 is the first implementation card.
