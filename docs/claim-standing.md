# CDiscourse — Claim Standing Model

_Stage 6.1.0 — 2026-05-16_

## What Is Claim Standing?

Claim standing describes **where an argument currently rests** in the exchange. It is derived deterministically from the argument's children and flags.

It does NOT declare objective truth or a winner. It uses language like:
- "currently more supported"
- "partially supported"
- "settled for now"
- "claim standing"

---

## ClaimStanding Values

| Standing | Label | Can declare resting? | Can request judge? |
|---|---|---|---|
| not_started | Not started | no | no |
| under_challenge | Under challenge | no | no |
| needs_receipts | Needs receipts | no | no |
| receipts_added | Receipts added | no | no |
| partially_supported | Partially supported | no | no |
| stronger_than_counter | Currently more supported | no | no |
| counter_currently_stronger | Counter currently stronger | no | no |
| both_wrong_possible | Both sides may need revision | no | yes |
| conceded | Conceded | yes | no |
| narrowed | Narrowed | yes | no |
| unresolved | Unresolved | no | yes |
| branch_needed | Branch needed | no | yes |
| settled_for_now | Settled for now | yes | no |

---

## Derivation Logic

Priority order:
1. Off-track flag + 2+ children → `branch_needed`
2. Concession + synthesis → `settled_for_now`
3. Concession → `conceded`
4. Synthesis (no concession) → `narrowed`
5. Weak topic + rebuttal → `both_wrong_possible`
6. Rebuttal + evidence → `stronger_than_counter`
7. Rebuttal, no evidence → `counter_currently_stronger`
8. Evidence, no rebuttal → `receipts_added`
9. Clarification, no evidence → `needs_receipts`
10. Has parent, no children → `under_challenge`
11. Has children (unclassified) → `unresolved`
12. Default → `not_started`

---

## Allowed Next Moves Per Standing

| Standing | Allowed moves |
|---|---|
| not_started | start_thesis, make_claim |
| under_challenge | challenge_parent, add_evidence, ask_clarification, concede_or_narrow |
| needs_receipts | add_evidence, concede_or_narrow, ask_clarification |
| receipts_added | challenge_parent, concede_or_narrow, synthesize_thread |
| partially_supported | add_evidence, challenge_parent, concede_or_narrow |
| stronger_than_counter | challenge_parent, concede_or_narrow, synthesize_thread |
| counter_currently_stronger | add_evidence, challenge_parent, concede_or_narrow |
| both_wrong_possible | ask_clarification, concede_or_narrow, synthesize_thread |
| conceded | synthesize_thread |
| narrowed | challenge_parent, add_evidence, synthesize_thread |
| unresolved | challenge_parent, add_evidence, ask_clarification, concede_or_narrow |
| branch_needed | synthesize_thread |
| settled_for_now | synthesize_thread, challenge_parent |

---

## Source File

`src/features/arguments/claimStanding.ts`
