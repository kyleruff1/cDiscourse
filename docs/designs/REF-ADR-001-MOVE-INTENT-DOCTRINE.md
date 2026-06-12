# REF-ADR-001 — Move-intent doctrine: channels as the user-facing layer (Constitution v1.1 disposition)

**Status:** RATIFIED — operator ratification given 2026-06-12 (recorded below; the GATE-C merge of PR #598 executes it). This ADR ships no code and no copy; **the merge of this PR is itself the ratification act** (docs-only but operative-semantics → operator-gated merge per `docs/core/pipeline-governance-contract.md` §5). The operator ratification block at the foot of this doc records that act.
**Epic:** Rules UX · **Priority:** P2 · **Effort:** S · **Lane:** docs-only ADR (operator-ratified) · **Release:** —
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/590
**Card type:** doctrine decision record. This card writes exactly two files: this ADR and its pointer stub (`docs/designs/REF-ADR-001.md`). Zero production-file change, zero tests, no migration, no deploy.
**Baseline:** `main` @ `4882ebf` (the entire REF loop — REF-001 design ratified at PR #592, and the REF-002..004 implementation track — is in-tree at write; every `file:line` below re-resolved at this SHA).
**Structural model:** `docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md` (context → options with honest trade-offs → decision → consequences → re-open triggers).
**Doctrine anchors:** `cdiscourse-doctrine` §1 (score never blocks posting; a channel is structural purpose, never a verdict), §5 (the rules engine is sacred), §8 (Constitution versions written only by service role; never mutated after insert), §9 (plain language for users).

---

## The decision (one line)

Adopt **Option 0**: canonize the move-intent doctrine in this ADR **beside** the Constitution, with **no change to `docs/core/constitution-v1.md`**. The stored type system and the transition matrix stay the validation layer; RULE-005's channels are the user-facing move-intent vocabulary; the matrix becomes a hidden affordance plus recovery system. Reject Option 1 (amend `constitution-v1.md` with a v1.1 section) and Option 2 (defer entirely to REF-001's design doc) — for the reasons below.

---

## Goal (one paragraph)

A debater today never picks a Constitution type code. They act through **plain moves** — the one-box `respond` composite with Reply / Challenge / Concede as flash-menu entry points (`src/features/arguments/oneBox/boxModel.ts:37-39`, QOL-030), the Act flash menu's entries (`src/features/arguments/oneBox/actPopoutModel.ts`), the Referee Card's next-move buttons (REF-003 / REF-004), and recovery routes when a typed move would be engine-invalid (`src/features/arguments/oneBox/actPopoutModel.ts:140` — `branch_tangent` is never engine-filtered). Underneath, `CLM` / `RBT` / `CRB` / `EVD` / `CLR` / `CON` / `SYN` remain the **stored, validated** layer (`src/domain/constitution/engine.ts`; mirrored for the server at `supabase/functions/_shared/constitution/evaluateArgumentDraft.ts` at submit time). This split is now load-bearing across the shipped QOL-030/031 one-box, RULE-005's channel model, and the REF-001..004 referee loop, yet it has never been written down as a single product-doctrine record. REF-001 names the disposition as a **soft input** and proceeds; this ADR ratifies it in parallel (`docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:10,:614-617`). The doctrine constraints that shape the decision: §8 — the stored `constitution_versions` rows are immutable and `constitution-v1.md` is itself bound by its own front-matter to "a new version entry and a migration" for any change (`docs/core/constitution-v1.md:4`); §1 — channels are advisory and never block a post; §5 — the deterministic engine is the sole acceptance gate.

---

## What is already true (the facts this ADR rests on — it records, it does not invent)

This is not a proposal to build something new. Every claim below is **already shipped or already ratified**; the ADR canonizes the boundary they jointly imply.

| Already-true fact | Evidence (`file:line`) |
|---|---|
| Each stored argument declares **exactly one type** from a 7-code registry. | `docs/core/constitution-v1.md:18` (`CLM` / `RBT` / `CRB` / `EVD` / `CLR` / `CON` / `SYN`, `:20-28`) |
| The **transition matrix** is the hard validation table; any unlisted transition is rejected. | `docs/core/constitution-v1.md:34-46` |
| Users act through **plain channels**, not type codes — 12 active + 2 reserved, each a "structural purpose" never a verdict, and **advisory** (a mismatch produces a re-route suggestion, never a `structuralBlock`). | `docs/designs/RULE-005.md:55-66` (channels = structural purpose), `:70-74` (advisory; only `evaluateArgumentDraft` + the matrix can block), `:128-156` (the 12-active / 2-reserved vocabulary table) |
| Reply / Challenge / Concede are **flash-menu entry points into one `respond` box**, deliberately not separate stored types. | `src/features/arguments/oneBox/boxModel.ts:37-39` (QOL-030) |
| The Act flash menu and its recovery route are the user's move surface; `branch_tangent` carries no `argumentType` and is therefore **never engine-filtered** — the recovery affordance when a typed move is invalid here. | `src/features/arguments/oneBox/actPopoutModel.ts:102-143` (`ActEntryId`), `:140` (never engine-filtered) |
| The matrix-as-hidden-affordance + recovery pattern is precedent, not invention: RULE-004's pre-send review surfaces structural blocks as plain-language lines and advisories as transformation `Pressable`s, never a raw type code. | `docs/designs/RULE-004.md:423-440` |
| The deterministic engine is the sole submission gate; classifiers run after an argument is stored. | `docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:706-713` (acceptance-gate invariant, quoted verbatim below) |
| `replies` is ratified as the **internal fallback relation** — the 9th `relationToParent` value — never preferred over a specific procedural relation, never clearing debt by itself, never rendered as raw internal copy. | Issue #584 "GATE-A RATIFIED" operator decision 2; `docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:193,:234` |

**The boundary these jointly draw:** the type registry + matrix are *validation machinery the user never names*; channels are *the user-facing move-intent vocabulary*. That boundary is the thing this ADR canonizes. It is observable in code today; it has simply never been the subject of a single decision record.

---

## The decision space (verbatim from issue #590)

The issue names exactly three dispositions:

> **(0)** channel layer documented beside the Constitution (no Constitution text change) · **(1)** `constitution-v1.md` gains a v1.1 section describing the user-facing abstraction · **(2)** defer entirely to REF-001's design doc. If option (1) is chosen, the v1 text remains byte-unchanged; the v1.1 section is purely additive and clearly marked as a later amendment.

These are documentation dispositions. **None** of them mutates a stored `constitution_versions` row, changes a type, or changes the matrix — that is the non-goal stated in the issue and forbidden by §8. The only question is *where the move-intent doctrine is written down*.

---

## Options

### Option 0 — canonize the doctrine in this ADR, beside the Constitution; leave `constitution-v1.md` byte-unchanged (CHOSEN)

- **What it does:** this ADR becomes the named, discoverable home of the move-intent doctrine. `docs/core/constitution-v1.md` is touched not at all — it stays the frozen v1 spec of record for the stored semantics. The user-facing layer continues to live where it already lives (RULE-005 channels + the QOL-030/031 one-box + the Act menu + REF-001..004), now with a single decision record that states the boundary and what may rely on it.
- **Benefit — preserves the spec doc as a frozen historical artifact.** `constitution-v1.md` is the human-readable source for the machine-readable version `"1.0.0"` seeded into `constitution_versions` (`docs/core/constitution-v1.md:3`). Its own front-matter binds any change to "a new version entry and a migration" (`:4`). A purely-additive, non-normative "user-facing abstraction" section sits in genuine tension with that rule: either it pretends the front-matter does not apply to it, or it invites a spurious version-entry/migration expectation for a section that changes no stored semantics. Option 0 sidesteps the tension entirely — the doc keeps describing exactly the version it seeded, nothing more.
- **Benefit — the doctrine is already documented across RULE-005 + REF-001 + shipped code.** Option 0 does not under-record (the failure mode of Option 2); it adds the one missing artifact — a cross-cutting *decision record* — without duplicating the channel vocabulary (that stays RULE-005's) or the derivation contract (that stays REF-001's).
- **Benefit — zero churn, zero §8 risk.** No stored-version mutation, no migration, no edit to the canonical spec, no new user-facing string. The decision is pure doctrine.
- **Cost — discoverability is one hop removed from `constitution-v1.md`.** A future designer reading only the Constitution spec will not see a pointer to the channel layer. This is the real cost of Option 0, and it is mitigated, not eliminated: the "Consequences → for future card designers" section below names exactly where to look, RULE-005 already documents the channels, and this ADR carries a discoverable `REF-ADR-001` name in `docs/designs/`. If discoverability ever proves insufficient in practice, the response is a *separate, minimal* card adding one non-normative "see also" cross-reference — itself a deliberate Option-1-adjacent decision, never folded in silently here.

### Option 1 — amend `constitution-v1.md` with a purely-additive, clearly-marked v1.1 user-facing-abstraction section (REJECTED)

- **What it does:** leaves the v1 text byte-unchanged and appends a new, clearly-marked "v1.1 — user-facing abstraction" section describing channels as the move-intent layer over the type registry.
- **Benefit — centralizes discoverability.** The one doc a designer is most likely to open for "how moves work" would carry both layers in one place. This is the single honest advantage Option 1 has over Option 0, and it is real.
- **Cost — it touches the canonical spec doc, which its own front-matter governs.** `constitution-v1.md:4` states plainly: "Changes to this document must be accompanied by a new version entry and a migration." An additive non-normative section is still a change to the document. Honoring the front-matter literally would drag a pure-doctrine note into a version-entry + migration ceremony it does not warrant; ignoring the front-matter for "just this section" erodes the rule that keeps the spec doc trustworthy. Either reading is worse than not touching the file.
- **Cost — it blurs the frozen-spec boundary.** The value of `constitution-v1.md` is that it describes *exactly* the version it seeded and nothing else. A user-facing-abstraction section — which is product/UI doctrine, not stored semantics — mixes two registers in the one doc whose job is to be the unambiguous record of the stored layer. The mix is a small but permanent erosion of "this doc is the frozen v1 spec."
- **Cost — it would have to be maintained against a moving UI layer.** The channel vocabulary can change (RULE-005 §0 D4 reserves `evidence_interaction` for EV-005 and `mode_specific` for GAME-003; `docs/designs/RULE-005.md:148-149`). A v1.1 section inside the frozen spec would either go stale or force edits to the canonical doc every time the UI layer moves — re-incurring the front-matter tension repeatedly.
- **Verdict:** rejected. The centralized-discoverability benefit is real but is outweighed by the front-matter tension, the frozen-spec erosion, and the recurring-maintenance cost. The discoverability gap is better closed (if ever needed) by a one-line non-normative pointer in its own card than by amending the spec doc here.

### Option 2 — defer entirely to REF-001's design doc; write no ADR (REJECTED)

- **What it does:** treats REF-001's design doc as the sufficient home for the disposition; no separate decision record is written.
- **Benefit — least effort.** REF-001 already records the recommended disposition in prose (`docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:614-617`) and proceeds.
- **Cost — it under-records a doctrine now load-bearing across more cards than REF-001.** The move-intent boundary governs QOL-030/031 (the one-box), RULE-005 (channels), RULE-004 (pre-send review), and REF-001..004 (the referee loop). A design doc scoped to *one* card (REF-001's Disagreement Contract) is the wrong home for cross-cutting product doctrine: future designers of EV-005, GAME-003, or a Constitution v2 would have no reason to read REF-001, and the boundary would be invisible to them. REF-001 itself anticipates this — it names REF-ADR-001 as the parallel ratifier precisely so the disposition is not buried in a single card's design (`:10,:652`).
- **Cost — no operator ratification of the doctrine.** Deferring means the boundary is never put to an explicit operator GATE-C read. Given that it is now operative semantics (it shapes what every debater sees and what every future drafting card may assume), that is exactly the class of decision `pipeline-governance-contract.md` §5 wants ratified.
- **Verdict:** rejected. REF-001's prose recording is appropriate *as a soft input that lets REF-001 proceed*; it is not a substitute for a ratified, cross-cutting decision record.

---

## Decision

**Adopt Option 0.** Canonize the move-intent doctrine in this ADR, beside the Constitution. **Make no change to `docs/core/constitution-v1.md`.** Reject Option 1 (the front-matter tension and frozen-spec erosion outweigh centralized discoverability) and Option 2 (it under-records a doctrine load-bearing across four shipped tracks and skips operator ratification).

**The core argument, grounded in doctrine:**

1. **§8 + the spec doc's own front-matter make "do not touch `constitution-v1.md`" the conservative, correct default.** The stored versions are immutable by service-role + RLS; the markdown spec is immutable-by-convention (its front-matter binds changes to a version entry + migration, `:4`). A pure-doctrine note does not warrant either ceremony, and forcing it into the spec doc (Option 1) either violates or hollows the front-matter rule. Leaving the spec frozen is the doctrine-respecting choice.
2. **The doctrine is already true in code and already documented in the right places** (RULE-005 for the vocabulary, REF-001 for the derivation, the one-box + Act for the surface). The *only* missing artifact is a cross-cutting decision record — which is precisely what an ADR is. Option 0 supplies exactly that, no more.
3. **A decision record, not a spec amendment, is the right instrument for product/UI doctrine.** The Constitution spec governs stored semantics; this ADR governs how those semantics are *exposed*. Keeping the two registers in two documents is the cleaner architecture and matches how the repo already separates `constitution-v1.md` (spec) from RULE-005 (channel layer) from REF-001 (referee derivation).

**Strength of the recommendation:** strong. The single finding that would shift it toward Option 1 is **demonstrated discoverability failure** — evidence that designers repeatedly miss the channel layer because they read only the Constitution spec. Even then the first response is a one-line non-normative pointer card, not a v1.1 section inside the frozen spec. Option 2 stays rejected regardless: a load-bearing cross-cutting doctrine deserves its own ratified record.

---

## What is canonized

The following are now product doctrine, ratified by the merge of this ADR:

1. **The stored type system and the transition matrix stay the validation layer — UNCHANGED.** Verbatim: *the transition matrix (`docs/core/constitution-v1.md:34-46`) and the "exactly one type" persistence rule (`docs/core/constitution-v1.md:18`) are UNCHANGED.* This ADR mutates neither, and forbids any card from treating this disposition as license to mutate either. A change to the stored type registry or the matrix is a Constitution **version** change (a new `constitution_versions` row + migration), governed by §8 — never a docs/UI doctrine card.
2. **RULE-005 channels are the user-facing move-intent vocabulary.** A channel labels what a move *does* (its structural purpose); it is never a verdict, never a truth/standing/popularity claim (`docs/designs/RULE-005.md:55-66`). The 12 active channels are the drafting surface; the 2 reserved channels (`evidence_interaction`, `mode_specific`) are documented future members, not yet emitted (`docs/designs/RULE-005.md:148-149`).
3. **The transition matrix becomes a hidden affordance plus recovery system.** Users never read the matrix or the type codes while drafting; the engine applies it at submit time, and an engine-invalid typed move is surfaced as a *recovery route* (Branch / Narrow / Ask source), never as a raw rejection. Precedent: RULE-004's pre-send review (`docs/designs/RULE-004.md:423-440`) and REF-004's shipped recovery routes; mechanism: `branch_tangent` carries no `argumentType` and is never engine-filtered (`src/features/arguments/oneBox/actPopoutModel.ts:140`).
4. **`replies` is the internal fallback relation** (per issue #584 GATE-A operator decision 2): it is **never preferred** over a more specific procedural relation, **never clears** evidence / source / quote / clarification debt by itself, and **never appears as raw internal copy** on a user-facing surface.
5. **Type codes (`CLM` / `RBT` / `CRB` / `EVD` / `CLR` / `CON` / `SYN`) are validation machinery and stay out of drafting-flow copy.** Their human-readable names may appear in the spec doc and in admin/inspect diagnostic surfaces; they are **not** the words a debater drafts with.

---

## What REF-001 (and the shipped REF-002..004) may rely on once ratified

An explicit list, so the referee-loop implementers can treat these as binding inputs:

- **Channels are an authoritative relation source.** REF-001's `relationToParent` derivation may read the selected `MoveChannel` (`BuildOpenIssueInput.selectedChannel`, `docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:476`) above the stored `ArgumentType` — the channel is the user's stated move intent, the stored type is the fallback.
- **`replies` behaves as ratified.** REF-002's `deriveOpenIssueRelation` may rely on `replies` being neutral, never preferred over a specific relation, never debt-clearing, and never surfaced raw — exactly as the canonization above and #584 decision 2 state.
- **The matrix is a hidden affordance + recovery system, not a gate the card re-implements.** REF-001's `nextBestMoves` (the intersection of `deriveSuggestedMoves` with `buildActPopout` survivors) may treat an engine-invalid move as a recovery route and never render a button the engine would reject (`docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:252-295`). The card never re-validates or contradicts the engine.
- **Type codes never need to reach the Referee Card.** REF-003's surface may rely on the canonized rule that drafting-flow copy is plain moves only — the card's relation/burden/state/axis labels are the frozen plain-language set (`:236-245`), never a `CLM`/`RBT`/etc. badge.
- **The acceptance-gate invariant holds.** REF-001's consultative model never gates a post; the channel layer never blocks one. This ADR restates and protects that invariant (Doctrine self-check below).

REF-001 explicitly records this disposition as a soft input and proceeds in parallel (`docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md:10,:614-617`); no P0 card hard-depends on this P2 ADR. Ratification confirms the assumptions REF-001..004 already build on; it does not unblock them.

---

## Consequences

- **`docs/core/constitution-v1.md` stays byte-unchanged.** The frozen v1 spec keeps describing exactly the stored version `"1.0.0"` and nothing else. No version entry, no migration.
- **For future card designers — where to look first:**
  - *For drafting / UX / move surfaces:* RULE-005 channels (`docs/designs/RULE-005.md:128-156`), the Act flash menu (`src/features/arguments/oneBox/actPopoutModel.ts`), the one-box `respond` composite (`src/features/arguments/oneBox/boxModel.ts`), and the Referee Card next-move buttons (REF-003/REF-004). These are the user-facing layer.
  - *For validation:* the transition matrix (`docs/core/constitution-v1.md:34-46`), the engine (`src/domain/constitution/engine.ts`), and its server mirror (`supabase/functions/_shared/constitution/evaluateArgumentDraft.ts`). This is the layer that can block.
  - The two layers are connected by the channel→type mapping documented in RULE-005's vocabulary table — not by exposing type codes to users.
- **For copy:** plain moves only in drafting flows. Type codes (`CLM` / `RBT` / `CRB` / `EVD` / `CLR` / `CON` / `SYN`) and the internal `replies` relation are never user-facing drafting copy; every user-facing string routes through `gameCopy` plain-language (§9). A channel label is structural purpose, never a verdict.
- **For tests:** the enforcement already exists and does not change — the ban-list / plain-language suites are the guard (REF-002's `openIssueModel.banlist` scan, the `gameCopy` plain-language coverage test, and RULE-005's channel-model tests). This ADR ships **no** test (docs-only); it relies on the existing suites continuing to fail loudly if a drafting surface leaks a type code, a raw `replies`, or a verdict token.
- **No operator action beyond the ratifying merge.** No migration, no deploy, no env var, no code.

---

## What would reopen this decision (any one re-opens it)

1. **A Constitution v2 with a changed type registry.** A new stored `constitution_versions` row that adds, removes, or renames argument types forces a re-derivation of the channel→type mapping and a fresh evaluation of whether the doctrine and its documentation home still hold. (That work is itself a versioned migration governed by §8, not a docs card — but it re-opens *this* disposition.)
2. **A channel-vocabulary change.** Activating RULE-005 §0 D4's reserved channels (`evidence_interaction` for EV-005, `mode_specific` for GAME-003; `docs/designs/RULE-005.md:148-149`) or adding any new `MoveChannel` member changes the user-facing layer and requires re-confirming the boundary and the channel→type map.
3. **Persistence of the Open Issue object.** REF-001 is derived-only in v1; if a future card (the named `REF-002B` / a post-usability `REF-006`) persists `DisagreementContract` / `OpenIssue` state, a stored disagreement-state layer appears beside the stored type layer, and the move-intent boundary should be re-examined for that new persisted surface.
4. **Demonstrated discoverability failure.** Evidence that designers repeatedly miss the channel layer because they read only `constitution-v1.md`. Response: a separate, minimal card adding one non-normative "see also" pointer — re-opening the Option 0 / Option 1 trade-off for that one pointer only, never a full v1.1 section in the frozen spec.

---

## Doctrine self-check

**Acceptance-gate invariant (verbatim — the invariant this ADR protects):**
*AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine (`src/domain/constitution/engine.ts`, mirrored for the server at `supabase/functions/_shared/constitution/`) is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.*
→ **Respected.** The channel layer this ADR canonizes is advisory and post-time-derived; it never gates. Channels produce re-route *suggestions*, never a `structuralBlock` (`docs/designs/RULE-005.md:70-74`). The matrix-as-hidden-affordance + recovery framing keeps the engine as the only thing that can block, and converts an engine-invalid move into a recovery route rather than a rejection in the post path.

- **§1 (no truth labels; score never blocks).** A channel is structural purpose — what a move *does* — never a verdict and never a standing/popularity claim. The verdict/person tokens (winner, loser, correct, incorrect, true, false, liar, dishonest, bad faith, manipulative, extremist, propagandist, stupid, idiot) appear in this doc only in this prohibition framing. No emitted copy is shipped by this card. **Respected.**
- **§5 (the engine is sacred).** `src/domain/constitution/engine.ts` and its server mirror are untouched and unimported; this ADR adds no network call, no React, no mutation. The matrix it canonizes as the validation layer is exactly the engine's existing behavior. **Respected.**
- **§8 (Constitution immutability — restated and respected).** The stored `constitution_versions` rows are written only by service role and never mutated after insert; this ADR governs docs/UI doctrine only and performs **no** stored-version mutation, **no** migration, and **no** edit to the canonical `constitution-v1.md` spec (the chosen Option 0 leaves it byte-unchanged). A change to the stored type registry or the matrix is a versioned migration, never a docs card. **Respected — and protected: the decision exists in part to keep the spec frozen.**
- **§4 (AI moderator limits; server-side only).** This ADR introduces no classifier, no provider call, and no client AI. The channel suggestion it canonizes is deterministic (`suggestChannelFromDraft`, `docs/designs/RULE-005.md:75-78`), not an AI call. **Respected.**
- **§9 (plain language).** The canonized doctrine *requires* plain moves in drafting flows and keeps type codes + the internal `replies` relation out of user-facing strings; everything routes through `gameCopy`. **Respected.**
- **§10a (Observations vs Allegations).** Untouched — this ADR does not change any node label, Observation, or Allegation. It is named here only to assert no boundary was disturbed. **Respected.**
- **§10 (v1 scope guards).** No voting, no winner-producing scoring, no real-time co-editing, no OAuth, no public API, no push, no argument search. **Respected.**

---

## Operator ratification block

**Lane + gate.** Docs-only, but it **defines operative semantics** the operator must ratify → operator-gated merge (GATE-C read) per `docs/core/pipeline-governance-contract.md` §5. Not auto-merge eligible. Green gates: secret scan · ban-scan.

**Merging this PR ratifies:**

1. **Option 0** — the move-intent doctrine is canonized in this ADR, beside the Constitution; `docs/core/constitution-v1.md` stays byte-unchanged.
2. The five **canonized** items above — the type registry + matrix stay the validation layer (unchanged); channels are the user-facing move-intent vocabulary; the matrix is a hidden affordance + recovery system; `replies` is the internal fallback relation (never preferred, never debt-clearing, never raw copy); type codes stay out of drafting-flow copy.
3. The explicit list of what **REF-001..004 may rely on** once ratified.
4. The four **re-open triggers** as the conditions under which this disposition is revisited.

**Operator ratification (filled at the GATE-C merge):**

> Ratified by: operator (Kyler) · Date: 2026-06-12 · Merge: PR #598 (the GATE-C merge executing this ratification) · Notes: Operator confirms Option 0 — the move-intent doctrine lives beside the Constitution. Constitution v1 remains byte-unchanged; the stored type registry and transition matrix remain the validation layer; RULE-005 channels are canonized as the user-facing move-intent vocabulary; type codes stay out of drafting copy; `replies` remains an internal fallback relation; the matrix is hidden affordance + recovery, not the user's primary drafting model.

---

## Operator steps

**None — pure decision record.** No migration, no deploy, no env var, no code, no edit to any shipped file other than this ADR and its pointer stub. The ratifying act is the operator's GATE-C merge of this PR.
