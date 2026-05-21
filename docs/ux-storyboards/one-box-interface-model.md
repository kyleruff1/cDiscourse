# CDiscourse — One-Box Interface Model

The interaction architecture for the CDiscourse MVP: a single switchable
composer **box** plus **three popout menus**, and nothing else. This document is
the wireframe design layout for that piece. It is **MVP-critical** — it is the
surface every other feature is reached through.

> Storyboard canon — not final visual design, but the binding layout + behaviour
> spec. Companion docs: [`keyboard-map.md`](keyboard-map.md),
> [`interaction-taxonomy.md`](interaction-taxonomy.md),
> [`terminology-and-copy-rules.md`](terminology-and-copy-rules.md).

---

## 1. The model in one paragraph

At rest the screen is two things: the **board** (the argument timeline, or its
Cards view) and a **minimized box dock**. Every other piece of functionality is
hidden behind **three popouts** — **Act**, **Inspect**, **Go** — each one key or
tap away, each dismissed instantly. The **box** is one component that re-types
itself: an interactive **flash menu** switches the box *type*, and switching
changes the box's *presentation* and *what's in the box* (its field schema,
including forced lists). There are no bespoke screens — composing a root claim,
a reply, a concession, an evidence move, or a response to evidence is the same
box wearing a different type.

## 2. Locked decisions

| # | Decision | Locked value |
|---|---|---|
| D1 | Surface size | Board + box + **3 popouts** (Act / Inspect / Go). Nothing else. |
| D2 | Card view authorable? | **Yes.** "One box across the board" is literal — the box composes in both Timeline and Cards view. This expands ST-001's "inspection-only" framing. |
| D3 | Content on type-switch | **Per-type draft buffers.** Switching type parks the current draft; switching back restores it. Never destructive. |
| D4 | The box's axes | `type × target × view` — three independent inputs (§3). |
| D5 | Flash menu scope | The flash menu is the **universal action menu**, not only a type picker (box-opening + direct + role-change entries). |
| D6 | Forced lists | Forced **by structure** — a list-typed box has no single free-text body, only item fields. **No AI parsing.** |
| D7 | Gating | The flash menu offers only types that are engine-valid (`engine.ts` transition table) ∩ role-allowed. |

## 3. The three axes

The box's full identity at any moment is `(type, target, view, lifecycleState, draftBuffer[type])`.

- **Type** — the move the box will create. ≈ RULE-005 `MoveChannel` plus the
  respond-to-concession / respond-to-evidence / root-claim targets. Switched by
  the **flash menu**.
- **Target** — what the box acts on: nothing (→ root claim), a message node, an
  evidence object, a concession set, or a branch. Set by **where the box was
  invoked from**. Type availability is a function of the target.
- **View** — Timeline or Cards. Switched by the existing **Timeline↔Cards
  toggle**. Changes presentation only — never type or contents.

`What's in the box = type × target`. Type picks the schema *kind*; the target
populates the *instance* (e.g. respond-to-concession + a concession set → a
forced list mirroring that set, row for row).

## 4. The minimalist surface

| Element | Persistence | Role |
|---|---|---|
| **Board** | Persistent | The argument timeline / Cards view. |
| **Box dock** | Persistent, minimized | The one composer, collapsed to a slim dock at rest. |
| **Act popout** | Hidden until invoked | *Do* — the flash menu. Converges SC-001 rail, SC-004 dock, RULE-005 chip row. |
| **Inspect popout** | Hidden until invoked | *Understand* — node/evidence/branch detail. Converges SC-002 popover, SC-003 sidecar. |
| **Go popout** | Hidden until invoked | *Traverse / re-view* — jump targets, density, lenses, mini-map, view toggle. Converges IX-002, IX-001. |

Three is the floor: *do / understand / traverse* are irreducible intents.

---

## 5. Wireframes

Phone-portrait viewport. ASCII layout only — spacing and labels are binding,
pixels are not. `●` claim · `◆` challenge · `⬡` evidence · `⬭` concession ·
`◇` muted/chime are the VG-001 grammar.

### W1 — Timeline view, at rest

```
┌──────────────────────────────┐
│ Arguments   Account   ⚙      │  top tab bar (existing)
├──────────────────────────────┤
│ Dishes after the camping week │  room title strip
│                               │
│  ●──◆──◆──●──◆        ◇       │  horizontal timeline rail (VG-001)
│  Root         ╲               │
│                ●  chime-in    │  vertical branch
│  ├───┬────┬──────────────┤    │
│  9:01    midday        now    │  beginning · middle · end
│              (board scrolls →)│
│                               │
├──────────────────────────────┤
│ ▸ Reply…                A ⌨  │  MINIMIZED box dock (one line)
└──────────────────────────────┘
```

At rest: tab bar + board + one-line box dock. Everything else is one key away.

### W2 — Act popout (flash menu), anchored to the selected node

```
┌──────────────────────────────┐
│ Dishes after the camping week │
│  ●──◆──[◆]──●                 │  [◆] = selected node — popout anchors here
│        ╔═════════════════╗    │
│        ║ ACT        · esc ║    │
│        ║ RESPOND          ║    │
│        ║  R  Reply        ║    │
│        ║  C  Challenge    ║    │
│        ║  L  Clarify      ║    │
│        ║ EVIDENCE         ║    │
│        ║  E  Add evidence ║    │
│        ║  S  Ask source   ║    │
│        ║  Q  Ask quote    ║    │
│        ║ RESOLVE          ║    │
│        ║  K  Concede      ║    │
│        ║  N  Narrow       ║    │
│        ║  O  Confirm   …  ║    │
│        ║ ⋯ Structure ·    ║    │
│        ║   Direct · Role  ║    │
│        ╚═════════════════╝    │
├──────────────────────────────┤
│ ▸ Reply…                      │
└──────────────────────────────┘
```

Every entry shows its key. Grouped: Respond · Evidence · Resolve · Structure ·
Direct · Role. Disabled entries stay visible with a one-line reason (never a
silent omission). Engine-invalid types are hidden; role-blocked types are shown
disabled-with-reason.

### W3 — Box open, type = Reply (free-body schema)

```
┌──────────────────────────────┐
│  ●──◆──[◆]──●          (board)│  board stays visible above
├──────────────────────────────┤
│╭ ● Reply ▾ ──── to: ◆ ──────╮│  header: type chip (▾ = flash menu) + target
││ replying to "…the alternating ││
││  rule should not apply…"      ││  ComposerTargetPanel (target excerpt)
││ ┌──────────────────────────┐ ││
││ │ Your response…            │ ││  free-body field
││ │                           │ ││
││ └──────────────────────────┘ ││
││ + reasoning    + tags         ││
││           [⌫ park]  [Post ⏎] ││
│╰──────────────────────────────╯│
└──────────────────────────────┘
```

The box header carries the type chip; `▾` (or `Cmd/Ctrl+K`) opens the flash
menu to re-type without leaving the box. The box's accent adopts the VG-001
grammar of the node it will land — composing previews the result.

### W4 — Box open, type = Concede (forced-list schema)

```
│╭ ⬭ Concede ▾ ──── to: ◆ ─────╮│
││ Concede points — each point   ││
││  is its own item              ││
││ ┌──────────────────────────┐ ││
││ │ 1 ▏We did agree to        │ ││  item 1
││ │     alternate dishes.     │ ││
││ └──────────────────────────┘ ││
││ ┌──────────────────────────┐ ││
││ │ 2 ▏You did do the dishes  │ ││  item 2
││ │     four times.           │ ││
││ └──────────────────────────┘ ││
││ [+ Add a point]               ││  no single body — list by construction
││           [⌫ park]  [Post ⏎] ││
│╰──────────────────────────────╯│
```

There is **no free-text body** on a list-typed box — only item fields and
`+ Add a point`. Itemization is forced by structure, not by parsing. `Tab`
moves between items; `Alt+↑/↓` reorders.

### W5 — Box open, type = Add evidence (structured-form schema)

```
│╭ ⬡ Add evidence ▾ ───────────╮│
││ Kind:   [Payment screenshot ▾]││
││ Amount: [$120]   Date: [Mar 3]││
││ From / To:   ▦ redacted        ││  raw account data never entered
││ Note:   ["practice space"]     ││
││ Applies to: [March rent ▾]     ││  claimed applicability
││ Confidence: user-asserted  🔒  ││  locked — never "system-proven"
││ [⎙ attach file]                ││
││           [⌫ park]  [Post ⏎]  ││
│╰──────────────────────────────╯│
```

### W6 — Cards view, box open (card-shaped composer)

```
┌──────────────────────────────┐
│ Arguments        Timeline ⇄  │  view toggle (T)
├──────────────────────────────┤
│┌ ◆ Challenge ────────────────┐│  a posted move as a Card Details card
││ "…rule should not apply…"    ││
││ unresolved: fact             ││
││ ⬡ evidence    ↳ 2 replies    ││
│└──────────────────────────────┘│
│╭ ● Reply ▾  (composing) ──────╮│  the BOX, card-shaped, in Cards view
││ to: ◆ Challenge               ││
││ ┌──────────────────────────┐ ││
││ │ Your response…            │ ││
││ └──────────────────────────┘ ││
││ semantic flags ▸   path ▸     ││  Cards view exposes the extra detail slots
││           [⌫ park]  [Post ⏎] ││
│╰──────────────────────────────╯│
└──────────────────────────────┘
```

Same box, same type, same draft — re-presented for Cards view. Toggling
Timeline↔Cards mid-compose keeps everything and re-renders only.

### W7 — Inspect popout

```
│        ╔═════════════════╗    │
│        ║ INSPECT    · esc ║    │
│        ║ 1 What it says   ║    │
│        ║ 2 Why it matters ║    │
│        ║ 3 What's unresolved
│        ║ 4 Where it sits  ║    │
│        ║ 5 Suggested next ║    │
│        ║ 6 Semantic flags ║    │
│        ║ E Evidence detail▸    │
│        ║ ‹ prev    next ›  ║   │
│        ╚═════════════════╝    │
```

Read-only. No body editing (editing is the box's job). Plain language only — no
raw `snake_case` codes.

### W8 — Go popout

```
│ ╔══════════════════════════╗  │
│ ║ GO                 · esc ║  │
│ ║ JUMP   R root  L latest  ║  │
│ ║        Z hot   B branches║  │
│ ║ VIEW   T timeline / cards║  │
│ ║ DENSITY  1 · 2 · 3       ║  │
│ ║ LENS   P path  U unresolved
│ ║        E evidence        ║  │
│ ║ ▁▂▃▅▇▅▂▁▂▃▁  mini-map    ║  │
│ ╚══════════════════════════╝  │
```

---

## 6. The popout chassis (components)

One shared chassis, three content models:

- **`Popout`** — anchored container · scrim that does **not** hide the board ·
  fast "flash" open/close (120–160 ms; reduce-motion = instant) · focus trap ·
  `Esc` closes · the keyboard layer.
- **`PopoutEntry`** — icon (VG-001 grammar where relevant) · terminology-clean
  label · **key badge** · enabled/disabled with a visible reason · `kind`
  (`box-opening` / `direct` / `role-change` / `navigate` / `inspect`).
- **`PopoutGroup`** — labelled entry group.
- **Three pure content models** — `actPopoutModel`, `inspectPopoutModel`,
  `goPopoutModel` — each a pure function of `(target, role, view, engine)`.
  Same pure-model discipline as the rest of the repo.

## 7. Box lifecycle

`empty → typed → drafting → review → posted | parked`

- **typed** — the flash menu set a type; the schema renders.
- **review** — RULE-004 pre-send review fires on the Post intent (any type).
- **parked** — per-type draft buffer; switching type or target parks, never
  destroys. `ComposerDraftRecoveryNotice` is the seed of this.
- **posted** — the move commits via the existing `submit-argument` path.

## 8. What's in the box — the three schema kinds

| Schema kind | Box types | Structure |
|---|---|---|
| **Free-body** | root claim · reply · challenge · clarify | one body (+ optional reasoning + qualifier tags) |
| **Forced list** | concede · respond-to-concession | item fields only; no single body; respond-to-concession mirrors the incoming list row-for-row, each row = 5-level acceptance gradient + conditional required clarification |
| **Structured form** | add-evidence · respond-to-evidence · ask-source · ask-quote | typed fields; respond-to-evidence = the choice set (Accept / Dispute applicability / …) + required clarification on any non-Accept |

## 9. Keyboard model

Every action is reachable in ≤2 keystrokes; the top ~12 in one. Keys are
**contextual** — board context has single-letter keys; box context fires only
modified keys so typing never triggers an action. The full map is
[`keyboard-map.md`](keyboard-map.md).

## 10. Doctrine compliance

- The flash menu is **engine-gated** (`engine.ts` transition table) and
  role-gated — it can only ever offer valid, permitted moves. No AI.
- Popout content models are deterministic pure functions — no network, no AI.
- The box never bypasses `submit-argument`; no service-role, no direct insert.
- No popout or box copy carries verdict / winner / loser / truth language; the
  box previews a node's *type*, never its correctness.
- Terminology rules hold for every label — `npm run ux:terminology:audit`.

## 11. Convergence audit — what folds where

| Shipped surface | Folds into | Expansion ticket |
|---|---|---|
| SC-001 side action rail | Act popout | QOL-031 |
| SC-004 node action dock | Act popout | QOL-031 |
| RULE-005 `ChannelChipRow` | Act popout (box-opening entries) | QOL-031 |
| SC-002 node popover | Inspect popout | QOL-032 |
| SC-003 sidecar (not yet built) | Inspect popout — design it here directly | QOL-032 |
| IX-002 mini-map | Go popout | QOL-033 |
| IX-001 density / lenses (in flight) | Go popout — design it here directly | QOL-033 |
| COMPOSER-001/002 composer dock | The box | QOL-030 |
| CreateDebateForm · JoinDebatePanel | Box types (`root claim` · the join is a role-change entry) | QOL-030 follow-up |
| EV-005 `AddAnnotationSheet` · `DeletionRequestSheet` | Box types or named exceptions | QOL-030 follow-up |

**The reassuring finding:** every shipped surface above is a thin React shell
over a *pure model* (`timelineNodeActionDockModel`, `sourceChainPopoverModel`,
`timelineMiniMapModel`, `channelModel`, `ObserverActionDockLayout`).
Convergence is **re-housing the shells under one chassis — the pure models
survive**. This is a consolidation, not a rewrite.

## 12. The design tickets

| Card | Title | Epic | Priority | Effort |
|---|---|---|---|---|
| **QOL-030** | One-box composer + flash-popout chassis (foundation) | Interaction | P0 | XL |
| **QOL-031** | Act popout — the flash menu | Sidecar Rail | P0 | L |
| **QOL-032** | Inspect popout | Sidecar Rail | P1 | L |
| **QOL-033** | Go popout | Interaction | P1 | M |
| **IX-003** (reopened) | Full keyboard map + quick-access shortcuts | Interaction | P1 | M |

QOL-030 is the foundation; QOL-031/032/033 depend on it. The "what's in the box"
schema cards from the storyboard pass — QOL-036 (evidence form), QOL-037
(evidence-response), QOL-041 (concession forced list) — plug into QOL-030.

Each card's deliverable is a full wireframe design doc under `docs/designs/`,
expanding the wireframes in §5 to component-level fidelity.
