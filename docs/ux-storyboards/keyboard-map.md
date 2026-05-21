# CDiscourse — Keyboard Map

Every action in the one-box interface has a keyboard shortcut. This is the
canonical map. It is the design source for the reopened **IX-003** card (full
keyboard map + quick-access shortcuts).

> Companion: [`one-box-interface-model.md`](one-box-interface-model.md). Keyboard
> support is primarily for the web build; on touch the same actions are reached
> through the flash popout.

---

## Principles

1. **Two tiers.** ~14 high-frequency actions have a **direct** single key. Every
   *other* action is reachable by opening a popout (one key) and pressing the
   entry key shown beside it — so **every action has a shortcut**, even obscure
   ones, with no key collisions.
2. **Contextual.** Keys depend on focus context:
   - **Board context** — single-letter keys are live.
   - **Box context** (composer has text focus) — only modified keys fire, so
     typing never triggers an action.
3. **The flash menu teaches the map.** Each Act-popout entry shows its key; a
   user learns the chords (`A` then `R`) from the menu itself.
4. **Keys reuse across popouts.** Only one popout is open at a time, so the same
   letter can mean different things in Act vs. Inspect vs. Go.
5. **`?`** always opens the keyboard-help overlay.

---

## Tier 1 — Board context (global)

| Key | Action |
|---|---|
| `←` `→` | Previous / next node |
| `↑` `↓` | Move across branches / lanes |
| `Home` `End` | Jump to root / latest |
| `Enter` | Activate the focused node |
| `Esc` | Close popout · deselect · minimize box |
| `A` | Open the **Act** popout (flash menu) |
| `I` | Open the **Inspect** popout |
| `G` | Open the **Go** popout |
| `R` | Reply (opens the box) |
| `C` | Challenge (opens the box) |
| `E` | Add evidence (opens the box) |
| `S` | Ask source (opens the box) |
| `T` | Toggle Timeline ↔ Cards |
| `?` | Keyboard-help overlay |

## Tier 1 — Box context (composer focused)

| Key | Action |
|---|---|
| `Esc` | Park & minimize the box |
| `Cmd/Ctrl + Enter` | Post |
| `Tab` / `Shift + Tab` | Next / previous field — **and next item in a forced list** |
| `Cmd/Ctrl + K` | Open the flash menu to switch box type (without leaving the box) |
| `Alt + ↑` / `Alt + ↓` | Reorder the focused forced-list item |

## Tier 2 — Act popout (`A`, then a key)

Every box-opening, direct, and role-change action. Grouped as the popout renders.

| Group | Keys |
|---|---|
| **Respond** | `R` Reply · `C` Challenge · `L` Clarify |
| **Evidence** | `E` Add evidence · `S` Ask source · `Q` Ask quote |
| **Resolve** | `K` Concede · `N` Narrow · `O` Confirm · `Y` Synthesize |
| **Structure** | `B` Branch / tangent · `V` Mark moved-on · `X` Mark ignored |
| **Govern** *(primaries, on a chime-in)* | `1` Useful · `2` Off-track · `3` Needs source · `4` Move to tangent |
| **Direct** | `W` Watch · `H` Share · `F` Flag for review · `U` Acknowledge (fist-bump) · `D` Request deletion *(own move)* |
| **Role** | `J` Join → `1` For / `2` Against |

## Tier 2 — Inspect popout (`I`, then a key)

| Key | Action |
|---|---|
| `1` | What this move says |
| `2` | Why it matters |
| `3` | What is unresolved |
| `4` | Where it sits |
| `5` | Suggested next move |
| `6` | Semantic flags |
| `E` | Evidence detail |
| `←` `→` | Previous / next message within Inspect |

## Tier 2 — Go popout (`G`, then a key)

| Key | Action |
|---|---|
| `R` | Jump to root |
| `L` | Jump to latest |
| `Z` | Jump to the hot zone |
| `B` | Branch list |
| `M` | Mini-map focus |
| `T` | Toggle Timeline ↔ Cards |
| `1` `2` `3` | Density: compact / normal / expanded |
| `P` | Focus lens: active path |
| `U` | Focus lens: unresolved only |
| `E` | Focus lens: evidence / source only |

---

## Accessibility contract

- Each popout is a `role="menu"` with a focus trap; arrow keys move between
  entries, `Enter` activates, `Esc` closes and restores focus to the trigger.
- A box that re-types itself **announces the type change** to screen readers
  (e.g. "Composer is now: Concede — a list of points").
- Forced-list items are announced with position ("Point 2 of 3").
- Every key badge has a text equivalent in the help overlay (`?`); no action is
  keyboard-only *or* pointer-only.
- Reduce-motion disables the flash transition; behaviour is identical.

## Scope note for IX-003 (reopened)

The original IX-003 shipped node navigation only (`←/→`, `Home/End`, `Enter`,
`Esc`, accessibility roles). The reopened card expands it to:

1. The full two-tier map above.
2. The board-context vs. box-context layer.
3. The popout keyboard layer (open key + entry keys + focus trap).
4. The `?` keyboard-help overlay.
5. Tests: per-context key resolution, no-collision assertion within a context,
   the help-overlay completeness check (every action appears).
