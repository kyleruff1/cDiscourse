# MCP-J-001 — Family J sensitive_composer scoping extension (design only)

Audit-type: design
Family: sensitive_composer

**Status:** Design draft (GATE-A). DOCS-ONLY. Enables no family. Proposes no production flip.
**Epic:** 12 (Rules UX / MCP semantic-referee track) — observability + doctrine scoping
**Release:** MCP H/I/J integration program (post-#559 / #562 / #564 live context)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/473

> `Audit-type: design` on line 3 is a linter directive (precedent:
> `docs/designs/MCP-I-SCOPE-001.md:3`). It marks this artifact as a design
> intent doc, not a smoke audit, so `audit-lint` does not apply the
> production-enable / family-ship phase machinery to it. It carries no
> operative semantics.

---

## 0. Reframe — this card DEEPENS a ratified N=0 verdict; it does NOT enable Family J

The sprint-backlog slot "MCP-J-001" was filed as if Family J (`sensitive_composer`)
were the next family in the H → I → J production-enable chain. That framing is
mistaken. Family J's formal scoping audit —
`docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` — returned the ratified
verdict **`N = 0` production-enable cards needed** (audit §12, lines 247-253;
final verdict §15, lines 279-285). That audit was closed as **issue #398 / merged
PR #406** on 2026-05-31, and its recommendation §13 (lines 257-263) states plainly:
*"Do not file a Family J production-enable card unless a future doctrine change
requires it. The existing gating is sufficient and the inspect-only / composer-only
routing IS the boundary."*

This card therefore **reframes the slot as a scoping EXTENSION (design only)**. It
does not reopen, contradict, or replace #398 / PR #406 — the `N = 0` verdict
stands. It DEEPENS that disposition by writing down, for the first time as an
operator-facing design record: (a) which scopings of J would even be
*doctrine-candidate* in a hypothetical future, (b) which UI consumers can carry
such Observations without sliding from Observation into Allegation per
`cdiscourse-doctrine` §10a / §1, and (c) what display wording deepens the §10a
stance rather than weakening it. The deliverable is this one markdown file. There
is no code, no test, no migration, no Edge Function, and no registry change.

The card proposes **NO production flip.** Family J stays `productionEnabled: false`.

---

## 1. The load-bearing doctrine clause (§10a, verbatim)

The binding clause is `cdiscourse-doctrine` §10a (Observations vs Allegations).
Quoted verbatim:

> Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render composer-only — never on the target's node — because surfacing them publicly reads as accusation.

Two corollaries from §10a bind every decision below:

- **Machine-generated labels are Observations** — they originate from system code
  (here, the semantic referee), never from a person. **User-generated labels are
  Allegations.** The schema boundary is `source: 'machine' | 'user'`. J's five keys
  are all `source: semantic_referee` → Observations, never Allegations.
- **No Observation may imply a truth value, an outcome, or the poster's intent** —
  §10a inherits the §1 / §2 / §3 forbidden-verdict-token bans in full (see that list;
  this doc does not re-enumerate it). A sensitive Observation that reaches a *public*
  node stops being an Observation about the text and reads as an Allegation about the
  person. That is the line this card refuses to cross.

---

## 2. Family J source of truth — the 5 keys and their ratified disposition

Read verbatim from `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts`
(HEAD of this branch). All five carry `kind: 'machine_observation'`,
`source: 'semantic_referee'`, `family: 'sensitive_composer'`, and
`confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY`.

| # | rawKey | source | current disposition | defaultSurface | familyJ.ts | audit citation |
|---|---|---|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `semantic_referee` | **`composer_only`** | `composer` | :34-75 | audit §2 line 31; §7 line 182 |
| 2 | `contains_unplayable_insult_only` | `semantic_referee` | **`composer_only`** | `composer` | :78-119 | audit §2 line 32; §7 line 183 |
| 3 | `needs_pre_send_pause` | `semantic_referee` | **`composer_only`** | `composer` | :122-162 | audit §2 line 33; §7 line 184 |
| 4 | `uses_popularity_as_evidence` | `semantic_referee` | **`inspect_only`** | `inspect` | :165-205 | audit §2 line 34; §7 line 185 |
| 5 | `uses_satire_as_evidence` | `semantic_referee` | **`inspect_only`** | `inspect` | :208-247 | audit §2 line 35; §7 line 186 |

Three composer-only + two inspect-only. The audit's per-key gate walk
(`OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` §7, lines 176-188) verified **20 / 20
surface × disposition cells correctly routed**: each composer-only key reaches the
composer and nothing else; each inspect-only key reaches inspect and nothing else.

### The three concentric gates (verified current — file:line truth)

1. **Edge production-enable gate** —
   `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118`
   holds the J entry with `productionEnabled: false` (line **116**),
   `adminValidationEnabled: true` (line 117). The auto-trigger dispatcher derives
   its production family list from this registry, so J never runs under
   `run_mode = 'production'`.
2. **Persistence-adapter surface acceptlist** —
   `src/features/nodeLabels/machineObservationPersistenceAdapter.ts:127-134` rejects
   any caller whose `targetSurface` is not one of `timeline_node` /
   `selected_context` / `inspect`. Defense-in-depth: even a programmer error that
   asked for `'composer'` via the adapter returns `[]`.
3. **Presentation-layer disposition gate** —
   `src/features/nodeLabels/nodeLabelPresentationModel.ts:158-183`
   (`isDispositionEligible`, exhaustive `switch` with a `never` guard):
   `composer_only` is eligible **only** when `targetSurface === 'composer'`;
   `inspect_only` is eligible **only** when `targetSurface === 'inspect'`. All other
   surface combinations return `false`.

This card loosens **none** of these three gates. See §7.

---

## 3. Live-context delta — what changed since #473 was filed

The issue body predates PRs #559 / #562 / #564. The current codebase truth differs
from several of the issue's file:line recitals; this section records the deltas so
no reader designs against a stale map.

| Issue recital | Current truth (verified this branch) | Impact |
|---|---|---|
| "H → I → J production-enable chain" frames J as next | **H (`claim_clarity`) and I (`thread_topology`) are now BOTH `productionEnabled: true`** (`familyRegistry.ts:104-112`, PRs #559 / #562). The frozen set is **{J} alone**. | J is the *last and only* held-out family. The chain framing is fully resolved; there is no "next" — J's resting state is the finished state. |
| `booleanObservationRequestBuilder.ts:68-78`, "only Family D and Family G entries" | The `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` map now spans **lines 68-89** and carries **three** entries: `evidence_source_chain` (D, :71), `resolution_progress` (G, :81), `thread_topology` (I, :82-88). | The recital is stale on two counts (range + entry count). **J is still correctly ABSENT** — J is source-uniform `semantic_referee`, not mixed-source, so it must never get a subset entry (adding one would be a HALT-13-class defect). |
| `familyRegistry.ts:114-118` for the J entry | Still **114-118** (productionEnabled:false at **:116**). | No drift; the issue's J-entry citation is accurate. |
| Admin H/I/J leakage tripwire watches {H, I, J} | The tripwire now watches **{J} only**: `FROZEN_NON_PRODUCTION_FAMILIES = ['sensitive_composer']` (`src/features/adminClassifierHealth/classifierHealthModel.ts:46-47`, re-scoped after #564). | A production-mode SUCCESS row referencing `sensitive_composer` is now a TRUE leak signal — the tripwire is a precise J detector, no longer diluted by H/I held-out noise. |

Net: the surrounding family registry advanced, but **J's disposition, gating, and
doctrine posture are unchanged.** The `N = 0` verdict is undisturbed.

---

## 4. The four candidate dispositions — ruled IN / OUT / DEFERRED

Each candidate is judged against `cdiscourse-doctrine` §10a (Observations vs
Allegations), §1 (no truth/verdict labels), and §4 (AI moderator is advisory, never
a moderation gate).

### 4.1 Composer-only — **IN** (deepens the current ratified disposition for keys 1-3)

The three composer-only keys (`shifts_to_person_or_intent`,
`contains_unplayable_insult_only`, `needs_pre_send_pause`) surface **only** in the
author's own composer, before posting. This is the ratified disposition and it is
the **only safe carrier** for these keys, because:

- The composer is **private to the author**. A nudge shown only to the writer,
  about their own draft, is an Observation about *that draft's text* — never a
  public statement about the writer. The moment the same signal appears on a node
  another participant can see, §10a says it "reads as accusation."
- The signal is **pre-send and advisory** (§4): the referee does not delete, hide,
  delay, or block the move. Publication remains the author's decision. The composer
  is the one surface where "suggest a revision before you post" is coherent; on a
  posted node there is nothing left to revise privately.
- The doctrine boundary is *the surface routing itself*. There is no wording that
  makes `shifts_to_person_or_intent` safe on a target's public node — the safety is
  structural (composer-only), not lexical.

**Deepening note:** the audit proved the gate routes these correctly; this card
adds the *why* — composer-only is not one option among several, it is the only
disposition under which keys 1-3 remain Observations at all.

### 4.2 Post-hoc personal-observation — **DEFERRED-V2** (explicit §10a reasoning)

Candidate: surface a composer-only key to the *argument author only*, after submit
(e.g. a private "for your eyes only" note attached to your own posted move).

**Ruled DEFERRED-V2, not IN, with the following §10a reasoning:**

- A post-hoc surface is **not the composer** — it is a new persisted surface that
  does not exist today. None of the three concentric gates contemplate an
  "author-private post-hoc" target; `NodeLabelSurface` has no such value
  (`timeline_node | selected_context | inspect | composer | hidden`). Building it is
  net-new schema + UI + a fresh disposition value, which is precisely the
  "NEW CARD with new design + new tests + new smoke" the audit (§12, line 253) and
  the H-I-J roadmap (§5.3, lines 176-177) reserve for a future doctrine change.
- The §10a risk is **leakage-by-proximity**: a post-hoc note rendered near a posted
  node is one CSS/visibility bug away from being visible to non-authors, at which
  point it reads as accusation. The composer-only disposition has no such failure
  mode because the composer is never co-rendered with another participant's view.
- Two further §10a risks survive even perfect gating (doctrine-review addition):
  **self-accusation / chilling** — a retrospective sensitive note on the author's
  own already-posted move arrives when no revision is actionable, so it can only
  read as a standing mark against the move's character rather than a usable nudge;
  and **screenshot-amplification** — an author-private note can be captured and
  re-shared off-platform, where it reads as the platform accusing the author,
  regardless of any in-app visibility gating.
- There is **no demonstrated product need** today. The composer-pre-send nudge
  already serves the author at the only moment a revision is actionable. A post-hoc
  note adds doctrine risk without a closing benefit.

**Deferred, not OUT:** if a future operator doctrine change introduces a genuine
"author-private retrospective" need, it is *admissible in principle* — but only as a
fresh, doctrine-reviewed card (see §7), never as a scope creep of this one.

### 4.3 Admin-only inspect — **IN** (deepens the current ratified disposition for keys 4-5)

The two inspect-only keys (`uses_popularity_as_evidence`, `uses_satire_as_evidence`)
advise on *evidentiary form of the text*, not on poster intent. They are
less acutely sensitive than keys 1-3 (audit §10, line 231), and they are correctly
routed to the `inspect` surface only. This card rules admin-only inspect **IN** and
names the surface (§5.2) because:

- An inspect-only Observation about *how a claim is supported* ("this point leans on
  how widely shared an idea is") is an Observation about the **text's evidentiary
  shape**, not a verdict on the person. It carries `cdiscourse-doctrine` §3
  (popularity is not evidence) forward as information, never as a score or a block.
- Confining it to an **admin-gated inspect surface** keeps it off every public node
  and off the Timeline, so it cannot read as a Timeline-level verdict (audit §10,
  line 231). An admin reviewing a specific argument's text is the audience for whom
  "this point cites satire as if it were a factual source" is actionable context,
  not an allegation.

**Deepening note:** the audit established the inspect-only routing; this card names
*which admin surface* (open operator decision per #473 blockers) and *why that
surface is not allegation* — see §5.2.

### 4.4 Public timeline-node / selected-context surfacing — **OUT** (forbidden by §10a and by the gate)

Surfacing **any** Family J key on `timeline_node` or `selected_context` is
**forbidden, full stop.** This is not a deferral and not an open question. The
rationale is written out explicitly in §6 so that no future engineer reading this
design can infer permission. In short: a public node is visible to other
participants; a sensitive Observation rendered there is read as a human accusing
another human, which §10a prohibits and which `isDispositionEligible`
(`nodeLabelPresentationModel.ts:169-172`) structurally blocks.

| Disposition | Verdict | Governing clause |
|---|---|---|
| Composer-only (keys 1-3) | **IN** | §10a (composer is private to author) + §4 (advisory, pre-send) |
| Post-hoc personal-observation | **DEFERRED-V2** | §10a (no such gated surface exists; leakage-by-proximity risk) |
| Admin-only inspect (keys 4-5) | **IN** | §10a + §3 (evidentiary form, admin-gated, never public) |
| Public timeline-node / selected-context | **OUT (forbidden)** | §10a (reads as accusation) + §1 (no verdict) — see §6 |

---

## 5. Safe UI consumers per disposition

### 5.1 Composer-only keys (1-3) → the composer pre-send rail

The safe consumer is the **existing composer pre-send rail / banner** — the same
composer-side chip pipeline that UX-001.5A established and that the audit describes
(`OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` §8, lines 200-202). It requests
composer-side marks only; it never queries timeline / selected / inspect marks. No
new public surface is proposed. The pre-send rail is the one surface where a
"revise before sending" nudge is coherent.

### 5.2 Inspect-only keys (4-5) → recommended admin home: `AdminArgumentsTab`

**Code-grounded survey of who consumes the `inspect` surface today.** The single
canonical `inspect`-surface consumer is `NodeLabelInspectGroups`
(`src/features/nodeLabels/NodeLabelInspectGroups.tsx:110`), which calls
`filterMarksBySurface(combined, 'inspect')`. That component is currently mounted in
the **user-facing** argument game surface
(`src/features/arguments/ArgumentGameSurface.tsx:1915`), i.e. the in-app Inspect
popout a participant opens on a selected move. Because J is
`productionEnabled: false`, no production row ever carries a J key, so that
user-facing popout never shows J in production today.

**Designer's recommendation (pending operator confirmation at GATE-A):** the admin
home for the two inspect-only J keys is **`AdminArgumentsTab`**
(`src/features/admin/AdminArgumentsTab.tsx`), rendering through the existing
`NodeLabelInspectGroups` consumer (surface `'inspect'`) inside an admin-gated
per-argument inspect affordance. Rationale, grounded in code:

- `AdminArgumentsTab` is **already the per-argument admin review surface**. It joins
  `public.arguments` with `debates(title)` and `profiles(display_name)` and is
  gated by `is_moderator_or_admin()` RLS. It already renders advisory per-argument
  signals **without verdicts** (category + qualifier badges via
  `deriveMessageCategory` / `derivePrimaryQualifier` from
  `src/features/arguments/messageQualifiers.ts`, plus evidence / flags / topic
  chips). Adding an inspect-observations affordance reuses an established,
  doctrine-clean pattern of describing the *argument's structure*, not the author.
- Reusing `NodeLabelInspectGroups` (surface `'inspect'`) means the **inspect-only
  disposition gate is honored automatically**: `isDispositionEligible('inspect_only',
  'inspect') === true` and every other surface returns `false`. No gate change is
  required to add this admin affordance later.
- It is **admin-scoped**, so the Observation never reaches a public node — preserving
  §10a. The admin is reviewing one argument's text, the exact audience for whom
  "this point cites satire as if it were a factual source" is context, not accusation.
- What makes admin viewing observation-not-allegation is the **operator duty-of-care
  frame** (doctrine-review addition): the admin reads these marks as stewardship
  signals about the evidentiary form of a text under review — never as findings
  about the poster — and the surface carries no affordance to forward, badge, or
  publish the mark toward any participant-facing node.

**Contrast (why NOT these):**
- `AdminClassifierHealthTab` (`src/features/admin/AdminClassifierHealthTab.tsx`) is a
  **counts-only** operational diagnostic — its binding invariant is COUNTS ONLY
  (status / state / family / failure_reason / run_mode), plus the J leakage tripwire
  row (`classifierHealthModel.ts:46`). It is the appropriate surface to *monitor that
  J exists in admin-validation and never leaks to production*, but it is not the
  surface to *display the per-argument observation content* — it has no per-argument
  text view.
- The user-facing Inspect popout in `ArgumentGameSurface` is **not admin** and is
  out of bounds for J: J inspect-only keys must remain admin-only by disposition.

This recommendation resolves the #473 open blocker "Confirm safe inspect-only UI
consumer." No code is written here; this card only names the surface and the
rendering path so a future card (if ever authorized) starts from a doctrine-clean
plan.

---

## 6. Forbidden surfaces — `timeline_node` and `selected_context` (explicit §10a rationale)

This section exists so that no future reader can infer permission to surface a
Family J key publicly.

- **`timeline_node` is forbidden for all 5 J keys.** The Timeline node is visible to
  every participant in the room. A composer-only key there
  (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`,
  `needs_pre_send_pause`) reads exactly as §10a warns: "surfacing them publicly reads
  as accusation" — a machine signal becomes a public charge *about this person*
  rather than a private note about their own draft. An inspect-only key there
  (`uses_popularity_as_evidence`, `uses_satire_as_evidence`) reads as a
  Timeline-level judgment on the contribution (audit §10, line 231). Both violate
  §10a and §1.
- **`selected_context` is forbidden for all 5 J keys.** Selected-context is the
  overlay shown when a node is selected for focus — still a participant-visible
  surface, not a private composer. Every argument that forbids `timeline_node`
  applies identically.
- **Structural enforcement (not just policy).** `isDispositionEligible`
  (`nodeLabelPresentationModel.ts:169-172`) returns `false` for `composer_only` and
  `inspect_only` against `timeline_node` and `selected_context`. The
  persistence-adapter acceptlist
  (`machineObservationPersistenceAdapter.ts:127-134`) plus
  `productionEnabled: false` (`familyRegistry.ts:116`) are the second and third
  walls. This card **forbids widening any of the three** to admit a J key onto a
  public surface.
- **No wording fixes this.** There is no plain-language phrasing that makes a J key
  safe on a public node. The safety is the surface routing. Any proposal that says
  "we can show it publicly if we word it carefully" is rejected by §10a on its face.

---

## 7. No production flip proposed — gates by file:line + fresh-doctrine-review requirement

**No file in this card enables any family. No doc, audit, or roadmap auto-advances a
family to production.** (H-I-J integration roadmap §7 HARD RULE,
`docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:196-202`.)

Family J remains held out by three concentric gates, none of which this card
touches:

1. `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118` —
   `productionEnabled: false` (line **116**). **Not flipped.**
2. `src/features/nodeLabels/machineObservationPersistenceAdapter.ts:127-134` —
   surface acceptlist. **Not widened.**
3. `src/features/nodeLabels/nodeLabelPresentationModel.ts:158-183` —
   `isDispositionEligible` exhaustive switch. **Not widened.**

Additionally, `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`
(`booleanObservationRequestBuilder.ts:68-89`) is **not** given a `sensitive_composer`
entry — J is source-uniform `semantic_referee`, and a subset entry would be a
HALT-13-class defect.

**Any future J production proposal must go through a fresh `cdiscourse-doctrine`
§10a doctrine review and a roadmap-architecture decision — NOT a normal-card
workflow, NOT a registry-flip card.** This is the explicit condition the audit
(§12, line 253) and the roadmap (§5.3, lines 176-177) attach to any J work: a new
J surface (e.g. a persisted private pre-send "doctrine summary") would be a NEW card
with its own design, tests, smoke, and a P4 doctrine review proving it keeps
composer-only keys composer-only and inspect-only keys inspect-only. Until then, J is
intentionally OFF, and OFF is the finished state — not a backlog item.

---

## 8. Plain-language display wording for the 5 J keys (§9; pre-cleared against the ban list)

Per `cdiscourse-doctrine` §9, internal rawKeys never appear in user-facing strings;
each maps through `gameCopy.toPlainLanguage`. The wording below **describes the TEXT,
never the person**, and is pre-cleared against the doctrine ban list (the §1
forbidden-verdict-token set encoded in
`src/features/metadata/moveMetadataLedger.ts:_forbiddenMetadataTokens` and mirrored
in the strength/lifecycle/evidence models). No banned token from that list appears in
any string below, and none implies a judgment on, or the intent of, the person.

**This wording is a designer proposal; the operator approves it at GATE-A** (per the
#473 blocker "Confirm plain-language wording approver" and §9, which makes J copy
operator-approved because it interacts with §10a sensitivity).

| rawKey | disposition / surface | proposed plain-language wording |
|---|---|---|
| `shifts_to_person_or_intent` | composer-only / pre-send rail | "This reply reads as being more about the other participant than about their point. Bringing it back to the claim keeps it something others can engage with." |
| `contains_unplayable_insult_only` | composer-only / pre-send rail | "There's no claim here yet for anyone to take up. Add the point you want to make so the thread can keep going." |
| `needs_pre_send_pause` | composer-only / pre-send rail | "This one is moving fast. Taking a short pause before you send is always an option — there's no rush." |
| `uses_popularity_as_evidence` | inspect-only / admin inspect | "This point leans on how widely an idea is shared. How many people hold a view doesn't, on its own, give it support — a source or a reason would." |
| `uses_satire_as_evidence` | inspect-only / admin inspect | "This point cites a comedy or parody piece as if it documented a real event. Satire is valuable as commentary, but a factual claim needs a factual source." |

**§3 anti-amplification note for `uses_popularity_as_evidence`:** the wording carries
the popularity-isn't-evidence boundary forward *without looping back into
engagement-as-evidence framing*. It deliberately speaks of "how widely an idea is
shared" and "how many people hold a view" as the thing the text leans on, then says
that does not *grant support* — it never quantifies, ranks, or credits the
engagement itself, and never implies that more sharing would make the point
stronger. This mirrors the doctrine that engagement credit and factual-standing
eligibility are SEPARATE scores (`src/features/pointStanding/antiAmplification.ts`;
`cdiscourse-doctrine` §3).

---

## 9. Data model / file changes / contracts

- **Data model:** no new data model. No schema, no migration, no new type. The
  `NodeLabelSurface` and `NodeLabelDisposition` unions are unchanged; no new
  disposition value is introduced (the DEFERRED-V2 post-hoc surface would require
  one — out of scope here).
- **File changes:** **one new file** — this design doc
  (`docs/designs/MCP-J-001-FAMILY-J-SCOPING-EXTENSION-intent.md`). Zero modified
  files. Zero deleted files. No file change outside `docs/designs/`.
- **API / interface contracts:** none changed. This card defines no function
  signatures, props, Edge request/response shapes, or RLS policies. The §5.2 admin
  recommendation describes a *reuse* of the existing `NodeLabelInspectGroups`
  consumer and `filterMarksBySurface(marks, 'inspect')` contract — it adds nothing.

---

## 10. Test plan — future-card callouts only (this card adds NO tests; +0 delta)

This is a design-only doc PR; there is no executable code change. Per
`Skill(test-discipline)` the plan is:

1. **Ban-list scan of this design doc** at GATE-B: confirm zero doctrine-ban tokens
   in the plain-language wording (§8) and no person-verdict label anywhere. Reuses
   the existing repo ban-list discipline at review time; no new test file.
2. **No regression** in the existing baseline (CLAUDE.md current-stage line). Expected
   test-count delta: **+0**.
3. **Phase-0 readiness check** (run, not added): confirm the existing J gating tests
   still pass —
   - `__tests__/nodeLabelPresentationModel.test.ts` (the `isDispositionEligible`
     switch incl. `composer_only → composer` and `inspect_only → inspect`; the audit
     cites lines 175 / 182 / 189 / 210).
   - `__tests__/familyRegistry.test.ts` (`productionEnabled: false` for
     `sensitive_composer`).
   - any audit-lint doctrine-risk test under `__tests__/auditLintRules*.test.ts`.

**Future-card test placeholders (CALLOUTS ONLY — NOT added by this card).** A
hypothetical, separately-authorized, doctrine-reviewed future J surface would
require:

- `__tests__/sensitiveComposerKeys.test.ts` — asserts the 5 J keys keep
  `source: 'semantic_referee'`, `family: 'sensitive_composer'`, and their
  3-composer-only / 2-inspect-only disposition split; asserts no new sensitive key
  is added silently.
- `__tests__/sensitiveComposerSurfaceGating.test.ts` — asserts all three concentric
  gates hold: registry `productionEnabled` state, persistence-adapter acceptlist
  rejection of non-render surfaces, and `isDispositionEligible` routing for each J
  key × every `NodeLabelSurface` (the 20-cell walk, pinned).
- `__tests__/gameCopyToPlainLanguageSensitiveJ.test.ts` — asserts every J rawKey maps
  to a plain-language string, no snake_case leak, and a ban-list assertion that no
  string contains a person-verdict token.

These are documented so a future implementer inherits the coverage contract; this
card writes none of them.

---

## 11. Dependencies

- **None (code).** This is a docs-only design extension over a ratified `N = 0`
  audit. It does not depend on the Family H (`MCP-H-001`) or Family I production work
  — it proposes no flip and does not interact with the H → I chain.
- **Doctrine ancestors (not code deps):** `cdiscourse-doctrine` §10a (binding); the
  closed `OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31` audit (issue #398 / PR #406); the
  H-I-J integration roadmap §5.3 + §6 + §7.
- **Reads (verification only):** `familyJ.ts`, `familyRegistry.ts`,
  `machineObservationPersistenceAdapter.ts`, `nodeLabelPresentationModel.ts`,
  `booleanObservationRequestBuilder.ts`, `classifierHealthModel.ts`,
  `NodeLabelInspectGroups.tsx`, `AdminArgumentsTab.tsx`.

---

## 12. Risks

- **Misread as an enable card.** The slot name "MCP-J-001" invites the assumption
  that J is being turned on. Mitigation: the reframe (§0), the "No production flip"
  section (§7), and the OFF-is-finished framing throughout.
- **Stale file:line drift.** The issue body's recitals had already drifted before
  this card was filed (§3). Mitigation: §3 records the current truth; all citations
  in this doc were re-verified against HEAD of this branch. A future reader should
  re-verify before quoting any line number.
- **Scope creep toward the DEFERRED-V2 post-hoc surface.** The temptation is to
  "just add a private note." Mitigation: §4.2 makes it a fresh-doctrine-review
  requirement, not a follow-on of this card.
- **Operator wording revision.** The §8 wording is a proposal; the operator may
  revise it at GATE-A. That is expected and non-blocking — the wording is data, not
  a gate.

---

## 13. Out of scope (explicit)

- Flipping `productionEnabled` for `sensitive_composer` (`familyRegistry.ts:116`).
- Adding `sensitive_composer` to `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`
  (`booleanObservationRequestBuilder.ts:68-89`).
- Widening `isDispositionEligible` (`nodeLabelPresentationModel.ts:158-183`) or the
  persistence-adapter acceptlist (`machineObservationPersistenceAdapter.ts:127-134`).
- Building the DEFERRED-V2 post-hoc personal-observation surface (a new
  `NodeLabelSurface` value + schema + UI).
- Any change under `supabase/functions/**` or `supabase/migrations/**`.
- Any runtime-state, secrets, routing, or registry change.
- Reopening / contradicting closed issue #398 / PR #406.
- Any AI-from-production-app surface — J's semantic-referee evaluation stays in the
  Edge path, gated `productionEnabled: false` (`cdiscourse-doctrine` §7).
- Writing the future-card tests in §10 (callouts only).

---

## 14. Doctrine self-check

- **§10a (Observations vs Allegations) — LOAD-BEARING:** the §10a sentence is quoted
  verbatim (§1). Composer-only is ruled the only safe carrier for keys 1-3 (§4.1);
  admin-only inspect is the safe carrier for keys 4-5 (§4.3 / §5.2); public surfaces
  are forbidden with explicit rationale (§6). No J key is promoted to an Allegation
  on a public node. RESPECTED.
- **§1 (no truth/verdict labels):** the §8 wording describes the TEXT, never the
  person; pre-cleared against the ban list; no banned token appears. RESPECTED.
- **§3 (popularity is not evidence):** `uses_popularity_as_evidence` wording carries
  the anti-amplification boundary forward without looping into engagement-as-evidence
  (§8 note). RESPECTED.
- **§4 (AI moderator advisory-only):** J keys via `semantic_referee` stay advisory;
  this card proposes no acceptance-gating on any J key; the referee never blocks
  posting. RESPECTED.
- **§7 (no AI from production app):** any future J evaluation stays in the Edge
  Function path; this card moves no J logic into `src/`. RESPECTED.
- **§8 (RLS + soft-delete + append-only migrations):** no migration, no RLS change,
  no row-mutation surface in this card. RESPECTED.
- **§9 (plain-language mapping):** §8 provides plain-language mappings for all 5
  keys; no internal rawKey appears in any proposed user-facing string. RESPECTED.
- **score never blocks posting / no service-role:** this card touches neither score
  nor any service-role path. RESPECTED.

---

## 15. Operator steps

**None — pure design doc.** No `db push`, no `functions deploy`, no env var, no
routing arm. After GATE-A approval the only action is the docs-only PR merge (which
the card explicitly allows to auto-merge per pipeline-governance-contract §10b,
because it carries zero operative semantics and zero §4 surface; GATE-C operator
approval still required).

Two operator decisions are surfaced for GATE-A (neither blocks the design):
1. Confirm the reframe (slot is a scoping extension, not a production flip).
2. Confirm `AdminArgumentsTab` as the inspect-only admin home (§5.2 recommendation).
3. Approve the §8 plain-language wording (or revise).
