# REF-006 — Usability smoke results (5-task first-user pass) — BLANK TEMPLATE

Fill in one copy of this template per run. Keep participant identifiers anonymized (**P1 / P2 / P3**). Run the session with
`docs/testing-runs/REF-006-usability-smoke-protocol.md` open beside this file.

---

## Run metadata

| Field | Value |
|---|---|
| Run date | `____-__-__` |
| Facilitator | (initials only) |
| Build / commit under test | `________` (the build the operator confirmed in the dry walk-through) |
| Participant count (1–3) | `__` |
| Operator dry walk-through passed? | [ ] yes — confirmed on build `________` (the card does not close until this is checked) |

**Instrument-vs-usability reminder:** the synthetic corpus runs prove the instrument; this run is the first **human**
usability evidence. **No-quantitative-claims reminder:** with 1–3 participants this is a **directional first baseline only** —
not a metric, not a pass/fail gate, and it produces **no quantitative claim**.

---

## Per-participant, per-task result rows

Which capture fields apply to each task (so the facilitator never has to guess):

- **Task 1** → `timeToFindDisputedPointSec` · `rawCodeSeen` · `stuckPointText`
- **Task 2** → `askedSourceOnIntendedTarget` · `pickedBackendTypeManually` · `rawCodeSeen` · `stuckPointText`
- **Task 3** → `usedAccusationInsteadOfProcedure` · `pickedBackendTypeManually` · `rawCodeSeen` · `stuckPointText`
- **Task 4** → `branchPreservedMainline` · `rawCodeSeen` · `stuckPointText`
- **Task 5** → `refereeCardParaphraseMatched` · `mixedUpScoreHeatWithStanding` · `rawCodeSeen` · `suggestedCopyFix` · `stuckPointText`

Outcome is `pass` or `stuck`. Record the verbatim quote in the participant's exact words.

### Participant P1

| Task | Outcome (`pass` / `stuck`) | Verbatim quote (their words) | Capture fields (filled) |
|---|---|---|---|
| 1 — find the point under dispute | | "…" | `timeToFindDisputedPointSec`= · `rawCodeSeen`= · `stuckPointText`= |
| 2 — ask source/quote on target | | "…" | `askedSourceOnIntendedTarget`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 3 — claim-level critique, no person | | "…" | `usedAccusationInsteadOfProcedure`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 4 — branch a tangent, keep mainline | | "…" | `branchPreservedMainline`= · `rawCodeSeen`= · `stuckPointText`= |
| 5 — read the Referee Card back | | "…" | `refereeCardParaphraseMatched`= · `mixedUpScoreHeatWithStanding`= · `rawCodeSeen`= · `suggestedCopyFix`= · `stuckPointText`= |

### Participant P2

| Task | Outcome (`pass` / `stuck`) | Verbatim quote (their words) | Capture fields (filled) |
|---|---|---|---|
| 1 — find the point under dispute | | "…" | `timeToFindDisputedPointSec`= · `rawCodeSeen`= · `stuckPointText`= |
| 2 — ask source/quote on target | | "…" | `askedSourceOnIntendedTarget`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 3 — claim-level critique, no person | | "…" | `usedAccusationInsteadOfProcedure`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 4 — branch a tangent, keep mainline | | "…" | `branchPreservedMainline`= · `rawCodeSeen`= · `stuckPointText`= |
| 5 — read the Referee Card back | | "…" | `refereeCardParaphraseMatched`= · `mixedUpScoreHeatWithStanding`= · `rawCodeSeen`= · `suggestedCopyFix`= · `stuckPointText`= |

### Participant P3

| Task | Outcome (`pass` / `stuck`) | Verbatim quote (their words) | Capture fields (filled) |
|---|---|---|---|
| 1 — find the point under dispute | | "…" | `timeToFindDisputedPointSec`= · `rawCodeSeen`= · `stuckPointText`= |
| 2 — ask source/quote on target | | "…" | `askedSourceOnIntendedTarget`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 3 — claim-level critique, no person | | "…" | `usedAccusationInsteadOfProcedure`= · `pickedBackendTypeManually`= · `rawCodeSeen`= · `stuckPointText`= |
| 4 — branch a tangent, keep mainline | | "…" | `branchPreservedMainline`= · `rawCodeSeen`= · `stuckPointText`= |
| 5 — read the Referee Card back | | "…" | `refereeCardParaphraseMatched`= · `mixedUpScoreHeatWithStanding`= · `rawCodeSeen`= · `suggestedCopyFix`= · `stuckPointText`= |

> **Capture-field rename footnote (traceability back to the issue).** Three field names were renamed at design time for copy
> hygiene; intent is unchanged: `askedSourceOnCorrectTarget` → `askedSourceOnIntendedTarget`;
> `refereeCardParaphraseCorrect` → `refereeCardParaphraseMatched`; `confusedByScoreHeatOrTruth` →
> `mixedUpScoreHeatWithStanding`. See `docs/designs/REF-006.md` § "Capture-field hardening decision" for the full map.
> `rawCodeSeen` is a **failure capture**: any `snake_case` token, family ID, `rawKey`, or internal code reaching the
> participant fails that task.

---

## Stuck-point ledger

Flat, append-only — aggregate every stuck point across all participants. The right-most column is where a stuck point becomes
a **proposed future card** (the findings-become-cards rule); the operator files the actual issues.

| ID | Participant | Task | Verbatim stuck point | Suggested copy fix (if any) | Proposed new card (epic + one-line) |
|---|---|---|---|---|---|
| S1 | | | "…" | | |
| S2 | | | "…" | | |
| S3 | | | "…" | | |
| S4 | | | "…" | | |
| S5 | | | "…" | | |
| … | | | | | |

---

## "Their words vs our labels" vocabulary table — INPUT to META-1D (#79)

> *This table is offered as input to META-1D (#79). #79's current scope is the 26 META-001 codes; extending it to cover these
> REF rail/card labels is proposed on #79, not assumed here.*

Record what the participant **calls** each shipped label, in their own words. Seed rows are the labels most likely to be
renamed in participant language (from the reality audit); add rows for any other label a participant named.

| Our shipped label | Where it appears | Their word(s) (P1 / P2 / P3) | Friction note |
|---|---|---|---|
| `Point under dispute:` | Referee Card anchor (active node) | | |
| `Referee note:` | Referee Card zone 1 | | |
| `The open task is …` | Referee Card zone 2 | | |
| `Ask for a source` | Referee Card zone 3 / Act | | |
| `Open a side issue` | Referee Card zone 3 / Act | | |
| `Observe →` | Conversation Gallery card action | | |
| `Needs first rebuttal` | Conversation Gallery lane | | |
| `Jump in now` | Conversation Gallery lane | | |
| `Source trail fights` | Conversation Gallery lane | | |
| `Request review` | Bubble chip / Request-review composer | | |

---

## Closeout

- [ ] Every stuck point above filed as a **new GitHub issue** (a new card), against the right epic. REF-006 fixes nothing
  inline.
- [ ] Quotes anonymized; any volunteered identifying detail redacted before commit.
- [ ] The vocabulary table proposed as input on a **comment to #79** (scope extension is proposed there, never assumed here).
