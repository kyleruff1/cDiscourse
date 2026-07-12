# CDiscourse design-cohesion principles

**Purpose:** the ratified design contract for CDiscourse — the shared visual
and state grammar every user-facing surface converges on. It is the **ratchet
that lands before the repaint** (COHESION §9.8): the principles are stated and
three of them are enforced by source-scan tests **before** the migration PRs
repaint the app, so the eras stop multiplying during migration.

**Derived from** `UX_COHESION_AND_MISSION_REVIEW.md` §8–§9 (audit branch
`docs/ux-continuity-audit-2026-07`). This doc is the on-`main` home of that
contract. It is not a copy of the full audit — only the principles and their
§9 commitments live here. Read the full audit with:

```
git show origin/docs/ux-continuity-audit-2026-07:docs/audits/ux-continuity-2026-07/UX_COHESION_AND_MISSION_REVIEW.md
```

Cited as **COHESION §N** below. Production-file citations are `path:line`,
grep-verified at base `origin/main @ 6aaea78f`.

**Guard pointer:** Principles **#2**, **#3**, and **#9** are enforced by
source-scan ratchet tests:

- `__tests__/cohesionPrinciple2Guard.test.ts` — tokens by reference (#2)
- `__tests__/cohesionPrinciple3Guard.test.tsx` — provenance visible (#3)
- `__tests__/cohesionPrinciple9Guard.test.ts` — red = app failure only (#9)

Each guard is a **ratchet, not an absolute ban**: it passes on the current
tree today and fires on a freshly-introduced violation. The remaining known
debts are scheduled for later burn-down PRs (see §4).

---

## §1 The canonical language

The implicit design language is **"calm slate console with kind-color spines"
inside a warm brand shell** (anchors: the surface token ladder
`designTokens.ts:2-21`; the per-kind spine colors
`TIMELINE_KIND_COLORS argumentGameSurfaceModel.ts:824-832`). COHESION §2 / §9.1.

**Era A is canonical.** Everything user-facing converges on the
token-referenced slate console. The other eras resolve toward it:

- **Era A′** (hardcoded-hex variants of the same slate look) migrates
  mechanically onto the tokens — **P2-2**, with byte-identical-render
  verification.
- **Era C** (legacy track/counter surfaces) is deprecated post-bake — **P3-3**.
- **Era D** (ops-console density) stays sanctioned strictly inside `admin/`,
  with a `fontSize` guard at the boundary — **P2-6**.

(COHESION §2 era table, §9.1.)

The **two-zone shell (Era B)** is **unratified**. The decision itself —
`#08060F`-everywhere versus a formal identity-zone / work-zone model
(**P3-1**) — is **SUBJECTIVE DESIGN DIRECTION** and is deferred, but it must
be decided. It is recorded here so it is not forgotten (COHESION §9.2).

---

## §2 The 12 cohesion principles

Transcribed from COHESION §8. For each principle: the statement, its evidence
anchor(s), the §9 commitment it serves, and its guard status.

| # | Principle | Evidence anchor | Guard | §9 commitment |
|---|---|---|---|---|
| 1 | One black, one elevation ladder | `App.tsx:1731` vs `RoomBoardLayout.tsx:165` | — | §9.2 ratify/collapse two-zone shell |
| 2 | Tokens by reference, never matching literals | `RingsideCard.tsx:416-517` (the A′ counter-example) | **source-scan** (`cohesionPrinciple2Guard.test.ts`) | §9.1 Era A canonical |
| 3 | Provenance must be visible, not only audible | `derivedSignalConsumerModel.ts:40` VERIFIED; `MediatorNodeMarker.tsx:44` | **source-scan** (`cohesionPrinciple3Guard.test.tsx`) | §9.3 provenance is visible grammar |
| 4 | Dashed/dotted = owed or provisional; solid = standing fact | `ReceiptChip.tsx:91`; `RingsideCard.tsx:483` | — | §9.3 (extend the named rule to "derived") |
| 5 | Body is the largest, quietest type; chrome may be small or bold, never both | `RingsideCard.tsx:434,451` | — | §9.4 argument text is protagonist |
| 6 | A reading measure (~640-720px) on wide web | `RoomBoardLayout.tsx:175` | — | §9.4 |
| 7 | One verb per intent; kind labels are grammar, not verbs | `gameCopy.ts:40` vs `:1180` | — | §9.6 one vocabulary, derived once |
| 8 | A chrome budget per card — generalize the mediator one-chip-per-node rule | `ArgumentRoom.tsx:3253-3267` | — | §9.4 |
| 9 | Red means app failure, never content state | `ConversationGalleryScreen.tsx:790` vs the mediator ban (`a11y693MediatorBoardAxisGuard`) | **source-scan** (`cohesionPrinciple9Guard.test.ts`) | §9.5 red reserved for app failure |
| 10 | Current-vs-historical is ambient, not just a slot notice | `RoomSettledNotice.tsx:57`; `TimestampMarker.tsx:68` (good pattern) | — | §9.7 screens tell the truth about state |
| 11 | Two fidelities per concept max, both documented | `RingsideCard.tsx:268` vs `ProofChip.tsx:39` | — | §9.1 |
| 12 | Every capability reachable from both lenses via the same action codes | `roomCapabilityParity.ts` (already binding, keep) | — | §9.6 |

### #1 — One black, one elevation ladder
There is one background black and one elevation ladder; a surface reads its
depth from the shared token ladder, not from a locally-chosen shade.
**Anchor:** `App.tsx:1731` vs `RoomBoardLayout.tsx:165`. **Commitment:** §9.2
(ratify or collapse the two-zone shell). **Guard:** none (documented only).

### #2 — Tokens by reference, never matching literals
A surface references a design token; it never hardcodes a hex that happens to
match a token value. Matching literals drift the moment the token moves.
**Anchor:** `RingsideCard.tsx:416-517` is the Era A′ counter-example (27 quoted
color-hex literals). **Commitment:** §9.1 (Era A canonical). **Guard:**
`__tests__/cohesionPrinciple2Guard.test.ts` — bans quoted color-hex in four
grep-verified-clean Era-A files (`ArgumentCard.tsx`, `MediatorNodeMarker.tsx`,
`ProofDrawer.tsx`, `AdminArgumentsTab.tsx`).

### #3 — Provenance must be visible, not only audible
Machine-derived text must carry a **visible** provenance marker, not only an
audible one — a sighted user must see that a line is machine-derived, exactly
as the screen reader announces it. **Anchor:** `derivedSignalConsumerModel.ts:40`
(VERIFIED); `MediatorNodeMarker.tsx:44`. **Commitment:** §9.3 (provenance is a
visible grammar). **Guard:** `__tests__/cohesionPrinciple3Guard.test.tsx` —
locks the two PR-C visible affixes (`DERIVED_SIGNAL_PROVENANCE_AFFIX`,
`MEDIATOR_NODE_PROVENANCE_AFFIX`) as accessibility-hidden visible siblings.

### #4 — Dashed/dotted = owed or provisional; solid = standing fact
Border/stroke grammar carries meaning: dashed or dotted marks an obligation or
a provisional state; solid marks a standing fact. **Anchor:** `ReceiptChip.tsx:91`;
`RingsideCard.tsx:483`. **Commitment:** §9.3 (extend the named rule to cover
"derived"). **Guard:** none (documented only).

### #5 — Body is the largest, quietest type; chrome may be small or bold, never both
The argument body is the largest and quietest type on the surface; chrome may
be small or bold but never both at once, so chrome never out-shouts the text.
**Anchor:** `RingsideCard.tsx:434,451`. **Commitment:** §9.4 (argument text is
the protagonist). **Guard:** none (documented only).

### #6 — A reading measure (~640-720px) on wide web
On wide web the body text holds a reading measure of roughly 640–720px so long
lines never sprawl edge to edge. **Anchor:** `RoomBoardLayout.tsx:175`.
**Commitment:** §9.4. **Guard:** none (documented only).

### #7 — One verb per intent; kind labels are grammar, not verbs
Each intent has exactly one verb; kind labels are grammar (nouns), never a
second verb for the same intent. **Anchor:** `gameCopy.ts:40` vs `:1180`.
**Commitment:** §9.6 (one vocabulary, derived once). **Guard:** none.

### #8 — A chrome budget per card
Each card has a chrome budget — generalize the mediator one-chip-per-node rule
so no card accretes unbounded chips. **Anchor:** `ArgumentRoom.tsx:3253-3267`.
**Commitment:** §9.4. **Guard:** none (documented only).

### #9 — Red means app failure, never content state
Red is reserved for application failure and danger. It never signals a content
state — a red chip must never read as "this claim is wrong / false".
**Anchor:** `ConversationGalleryScreen.tsx:790` vs the mediator red ban
(`a11y693MediatorBoardAxisGuard`). **Commitment:** §9.5 (red reserved for app
failure). **Guard:** `__tests__/cohesionPrinciple9Guard.test.ts` — bans
crimson-red hex in six content-state files outside a documented per-file
allowlist of today's known reds.

### #10 — Current-vs-historical is ambient, not just a slot notice
Whether a surface is showing current or historical state is signaled ambiently
across the surface, not only by a single slot notice a reader can miss.
**Anchor:** `RoomSettledNotice.tsx:57`; `TimestampMarker.tsx:68` (the good
pattern). **Commitment:** §9.7 (screens tell the truth about state). **Guard:**
none (documented only).

### #11 — Two fidelities per concept max, both documented
A concept is rendered in at most two fidelities, and both are documented so a
third variant cannot quietly appear. **Anchor:** `RingsideCard.tsx:268` vs
`ProofChip.tsx:39`. **Commitment:** §9.1. **Guard:** none (documented only).

### #12 — Every capability reachable from both lenses via the same action codes
Every capability is reachable from both lenses (participant and observer) using
the same action codes, so a lens is a view, not a different app. **Anchor:**
`roomCapabilityParity.ts` (already binding — keep). **Commitment:** §9.6.
**Guard:** none — already enforced by the capability-parity contract.

---

## §3 The state principle (the "+1")

Transcribed from COHESION §8's state principle:

- Hooks return `{ data, loading, error, refetch }`; screens render
  **banner-over-stale-content, never silent-empty**. A failed refetch shows a
  banner above the last-good content; it does not blank the screen.
- **Template (the write path to copy):** `BooleanFeedbackBar.tsx:151-176`.
- **Anti-pattern (do not copy):** `ArgumentHome.tsx:206-217`.
- **Commitment:** §9.7 (hedge copy renders only when the hedge is real).

**Documented by-design exception** (recorded explicitly so the P1-2 family fix
neither misses it nor "fixes" it): `useMyCircles.ts:10,40-44` is an
**intentional silent-failure hook** — `error` stays `null` by construction
(verified this worktree: the header comment at lines 8-13 states "Circles are
an accelerator, never a gate… `error` stays `null` by construction"; the
`setState` at 40-44 hardcodes `error: null`). Circles are an accelerator, never
a gate; a failed read yields no circle chips, not a blocking error. This
exception carries a **by-design tag** in the family census (COHESION §8, critic
gap #1). It is not a state-principle violation — it is the one sanctioned
silent read.

---

## §4 The ratchet and its burn-down map

PR-D ships this doc **plus the three guards FIRST** (COHESION §9.8), ahead of
the migration PRs, so the still-open debts cannot regress further while the
repaint proceeds. Each open debt has a scheduled burn-down PR. Each guard is a
**ratchet**: it forces the conversation on a new violation but does not forbid
all instances forever — a burn-down PR shrinks the relevant allowlist as it
removes the debt, and the #9 allowlist-completeness test fails loudly if a PR
removes a red but forgets to shrink the allowlist.

| Principle | Current known debt (still open) | Burn-down PR |
|---|---|---|
| #2 | ~1,169 hex literals; Era A′ files hardcode hex (`RingsideCard.tsx`, `ConversationGalleryScreen.tsx`, `RoomBoardLayout.tsx:165`, `TimestampMarker.tsx:125`) | **P2-2** (Era A′ token migration; byte-identical-render verification) |
| #3 | closed for the two named surfaces by **PR-C** (issue 923 — the visible affix). Extend "dashed/dotted = provisional/owed" to cover "derived" | **P1-5 + P2-11** (extend the named rule) |
| #9 | gallery maroon `#7f1d1d`, `#fecaca`; flag `#ef4444`; tone-hostile `#dc2626`; standing-band `#b91c1c` red→green gradient (dup'd in 3 places); legacy `counter` `#ef4444` | **P1-7** (dedupe now + re-ramp off red/green — doctrine-gated, operator ruling required) and **P2-9** (gallery re-tone) |

**Note to the P1-7 / P2-9 implementers:** each burn-down PR that removes a red
MUST shrink the `ALLOWLIST_P9` map in `cohesionPrinciple9Guard.test.ts` in the
same PR. The allowlist-completeness test asserts on-disk reds ⊆ allowlist AND
allowlist ⊆ on-disk reds, so a stale entry fails the suite. When a later PR
adds a genuinely-app-failure red to a scanned file, add it to that file's
allowlist with a one-line justification ("app-failure error state, legit per
#9"); the ratchet forces the conversation, it does not forbid red forever.

---

## §5 What already serves the mission (do not regress)

Transcribed from COHESION §7. The migration PRs must not flatten these assets:

- **The obligation-vs-possession dashed/dotted grammar** — dashed/dotted marks
  what is owed or provisional; solid marks a standing fact (principle #4).
- **Verdict-token ban-lists with test guards** — the doctrine ban-lists that
  keep "winner / loser / liar / true / false / correct / dishonest / bad faith"
  out of rendered strings.
- **Advisory-never-gates** — machine signals are advisory offers; validation
  can block posting, score never does.
- **Marker tombstones** — retracted/moved markers leave a calm tombstone, not a
  silent disappearance.
- **Body-text hierarchy** — the argument body is the protagonist type
  (principle #5).
- **The capability-parity contract** — every capability reachable from both
  lenses via the same action codes (principle #12; `roomCapabilityParity.ts`).
