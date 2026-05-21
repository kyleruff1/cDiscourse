# CDiscourse — Terminology and Copy Rules

The strict vocabulary for **normal-user UI copy**. CDiscourse is an **argument**
product. Its user-facing surfaces never call it a "game" and avoid "debate."

This document is enforced by `scripts/ux/auditUserFacingTerminology.js`
(`npm run ux:terminology:audit`), which scans app source for user-facing strings
and writes [`terminology-audit.md`](terminology-audit.md).

---

## The two-layer rule

CDiscourse has two naming layers, and only one is held to the strict rule.

| Layer | Held to the strict rule? | Examples |
|---|---|---|
| **Normal-user UI copy** — anything a non-admin user reads on screen, in a screen-reader label, or in an email | **Yes** | Tab labels, button text, headings, helper copy, notification copy, accessibility labels |
| **Internal code and schema** — identifiers, type names, database tables, migration comments, admin/debug-only technical docs | **No** | The `debates` table, `gameCopy.ts`, `argumentGameSurface`, `ArgumentGameSurface.tsx` |

**Why the split exists.** Renaming a shipped database table (`debates`) is risky
— it touches RLS, Edge Functions, generated types, and migrations. Renaming
stable code identifiers is churn with no user benefit. The user never sees these
names. So the rule targets exactly what the user sees, and nothing else.

Admin and debug docs **may** mention legacy terms — for example, to explain that
the table is still called `debates` internally. They should do so explicitly, as
a mapping, not by accident.

---

## Strict terminology table

| Forbidden in normal-user UI | Replacement | Allowed internal contexts | Example fix |
|---|---|---|---|
| **game** | "argument experience", "interaction surface", "argument flow", or "argument board" | `gameCopy.ts`, `argumentGameSurface`, `gameStatus` identifiers; design docs discussing the concept | "current game state" → "the current state of the argument" |
| **gaming** | "argument experience" | — | "gaming the room" → "the argument experience" |
| **game surface** | "interaction surface", "argument board" | `argumentGameSurface` identifier | "open the game surface" → "open the argument board" |
| **debate** | "argument" | The `debates` table; migration comments; admin/debug docs | "Leave debate" → "Leave argument" |
| **debates** (as a tab or page label) | "Arguments" | The `debates` table name; `.from('debates')` query strings | A "Debates" header → "Arguments" |
| **debate room** | "argument room" | — | "Start a new debate room" → "Start a new argument room" |
| **Tap to join** | "Open", "Observe", "Respond", or "Jump in" | — | "Tap to join →" → "Observe →" |
| **player** | "participant" | — | "another player" → "another participant" |
| **moderator** | "observer" or "admin" (depending on context) | `ParticipantSide` value `'moderator'`; admin tooling | "moderator review" → "admin review" |
| **winner** | "resolved", "supported", "accepted", or "settled" | Ban-list / forbidden-token constants that *enumerate* the word to forbid it | "you are the winner" → "this point is supported" |
| **loser** | "challenged", "unresolved", or "conceded" | Ban-list / forbidden-token constants | "the loser" → "the unresolved point" |

### Notes on specific rows

- **"debate" is *discouraged*, not hard-prohibited** in prose copy — it should be
  reworded opportunistically. But **"Debates" as a tab or page label** and
  **"debate room"** *are* hard-prohibited.
- **"moderator"** is discouraged: prefer "observer" for a read-only room role and
  "admin" for the moderation/admin function. The internal `ParticipantSide`
  value `'moderator'` stays.
- **"winner" / "loser"** appear constantly in the codebase inside *ban-list
  constants* — arrays that list the words precisely so user copy can be scanned
  against them. That is the rule working, not breaking. The audit only flags
  these words inside **sentence-shaped copy**, never bare single-word tokens.

---

## The approved vocabulary

Use these words. They are the canon for both copy and these storyboards.

`argument` · `argument room` · `conversation` · `claim` · `response` ·
`concession` · `refutation` · `evidence` · `chime in` · `branch` · `timeline` ·
`node` · `room` · `private argument` · `public argument` · `participant` ·
`observer` · `primary participants` · `tangent` · `resolution` · `settled` ·
`linked prior argument`.

---

## Doctrine — what copy must never imply

Beyond word choice, four rules govern what user-facing copy is allowed to
*say*. These hold in every storyboard and every screen.

### 1. Do not imply the app decides truth

The app structures and records an argument. It never adjudicates it. Copy never
says a participant is "right", a claim is "true" or "false", or an argument has
a "verdict". A settled room is "settled" — reached by agreement — not "decided."

### 2. Do not imply popularity is evidence

Heat means **activity and friction**, never correctness. A room with many
replies is *active*, not *right*. A claim repeated often is not, for that
reason, better supported. Copy never frames engagement, reply count, or rep
count as proof.

### 3. Do not imply a participant's intent

Copy describes **text and moves**, never a person's motive. A move can be
"off track", "a tangent", or "missing a source". A *person* is never a "troll",
"liar", "bad-faith actor", "manipulative", or "biased."

### 4. Text behavior can be classified; people are not classified

This is the load-bearing distinction. The system may classify a *move* — its
type, its channel, its lifecycle state, its evidence status. It may not classify
a *user*. "This response introduces a new axis" is allowed. "This user is
argumentative" is not.

---

## For implementers

- Run `npm run ux:terminology:audit` before committing user-facing copy.
- The audit is **warn-mode by default** — it writes the report and exits 0 even
  with pre-existing violations, so it never blocks unrelated work. Run it with
  `--strict` to fail on a *live* prohibited violation.
- A genuine false positive (the scanner misreading an internal identifier) can
  be suppressed with a trailing `ux-audit-ignore-line` comment, or by adding a
  justified entry to `ALLOWLIST` in the audit script. Use this sparingly.
- Database table names and code identifiers are out of scope by design — do not
  rename `debates`, `gameCopy`, or `argumentGameSurface` to satisfy the audit.
