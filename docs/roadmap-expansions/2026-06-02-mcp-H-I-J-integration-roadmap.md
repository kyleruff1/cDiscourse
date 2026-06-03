# CDiscourse — MCP Families H / I / J production-integration roadmap (2026-06-02)

> **Superseded for gate/pass/ramp semantics (2026-06-03).** The canonical reference for every pass / PASS-LOAD / PASS-LOAD-CONFIRM / Stage-1 / plumbing-vs-organic / ramp / dead-letter / cluster definition is `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (operator-ratified). Any pass/load/ramp/threshold language below is historical; where it differs from the canonical doc, the canonical doc governs.

**Type:** Design-only roadmap. No production code, no migration, no Edge Function deploy, no provider/MCP/network call, no Supabase mutation, no secret read, no registry flip.
**Authoring card:** OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP.
**Purpose:** Document the path to productionize the three Machine-Observation families that are currently dormant — **H (`claim_clarity`)**, **I (`thread_topology`)**, **J (`sensitive_composer`)** — and to make plain the prerequisites, the per-family sequence, and the hard rule that all three stay OFF until each is explicitly operator-gated.

> **This card does NOT enable Families H, I, or J.** Every enablement step below is a **PROPOSAL that requires separate operator authorization.** No doc, audit, or roadmap auto-advances a family to production. The family registry on `main` is unchanged by this card; H / I / J remain `productionEnabled: false`.

---

## 0. Where this sits relative to the Stage-1 cutover

This roadmap is a **forward-looking proposal track**. It is gated *behind* the in-progress provider-reliability cutover, not parallel to it.

- The classifier-queue routing cutover is at **Stage 1 (1%)**, armed `2026-06-02T07:50:54Z`, with a 24h observation window that is **still open** as of this writing. No step in this document closes that window, issues a Stage-1 pass verdict, or advances the routing percentage above 1%. Those are separate operator-gated steps owned by the cutover track (`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`, status OBSERVING).
- Production routing today covers **Families A–G only** (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`). H / I / J are excluded from production auto-trigger because the family registry marks them `productionEnabled: false`.
- The percentage cutover (1% → 5% → higher) and the family roster expansion (A–G → +H → +I) are **two independent dials.** This roadmap concerns only the second dial, and only as a proposal. The first dial is the cutover track's business.

---

## 1. Executive summary

Three families exist in code, are fully exercised in `admin_validation` mode on the hosted MCP server, and are **deliberately excluded from production routing**:

| Family | rawKey family id | Keys | Source mix | Production status | Why dormant |
|---|---|---|---|---|---|
| **H** | `claim_clarity` | 12 | uniform `ai_classifier` | `productionEnabled: false` | Production-enable was attempted, smoke FAILED on provider reliability at the 8-family load, **rolled back** to admin-only |
| **I** | `thread_topology` | 21 | mixed (8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`) | `productionEnabled: false` | Never enabled; chain authorized only after H ships; needs a mixed-source Edge subset entry |
| **J** | `sensitive_composer` | 5 | uniform `semantic_referee` (3 `composer_only` + 2 `inspect_only`) | `productionEnabled: false` | **By design** — scoping audit concluded N=0 production-enable cards under the current composer-only / inspect-only disposition |

The registry source of truth is `supabase/functions/_shared/booleanObservations/familyRegistry.ts`. The three relevant entries:

```ts
{ family: 'claim_clarity',      productionEnabled: false, adminValidationEnabled: true },  // lines 104-108
{ family: 'thread_topology',    productionEnabled: false, adminValidationEnabled: true },  // lines 109-113
{ family: 'sensitive_composer', productionEnabled: false, adminValidationEnabled: true },  // lines 114-118
```

**The path to production is not symmetric across the three.** H and I follow the established `MCP-021C-EDGE-FAMILY-X-ENABLE` one-character-flip ship pattern (each its own ship + production-enable audit). J is different: a dedicated scoping audit already concluded it needs **zero** production-enable cards under its current disposition, because its observations are composer-only / inspect-only and surfacing them publicly would read as an accusation. Any future J production surface is a NEW doctrine-reviewed card, not a registry flip.

This roadmap describes each path as a **PROPOSAL.** It changes no source, no test, no migration, no validator, no prompt, no registry, no secret.

---

## 2. Verified state (read from `main`, this card)

### 2.1 The family registry (source of truth for production eligibility)

`supabase/functions/_shared/booleanObservations/familyRegistry.ts` (read this card):
- `FAMILY_REGISTRY` is a frozen array of 10 entries. The **first 7 (A–G)** carry `productionEnabled: true`. The **last 3 (H, I, J)** carry `productionEnabled: false` and `adminValidationEnabled: true`.
- The header comment (lines 19-24) states the enablement model: *"Future family enablement is a small surgical card: flip the `productionEnabled` flag for the target family + add a test asserting the flip + ship. No Edge Function code change required — the auto-trigger dispatcher derives the production family list from this registry at runtime, so flipping a boolean here automatically extends auto-trigger."*
- `productionEnabledFamilies()` (lines 162-166) is the runtime helper the dispatcher reads. With H/I/J false, it returns the A–G set.

### 2.2 The mixed-source Edge subset (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`)

`supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` lines 68-78 hold the per-family source allowlist:

```ts
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES = Object.freeze({
  evidence_source_chain: Object.freeze(new Set(['ai_classifier'])),   // Family D
  resolution_progress:   Object.freeze(new Set(['ai_classifier'])),   // Family G
});
```

This constant is the **binding boundary** between the Edge taxonomy (which enumerates every rawKey across every source for a family) and the MCP server's classifier scope (which, for a **mixed-source** family, supports only the `ai_classifier` subset). When a family's registry enumerates deterministic keys (`auto_metadata` / `lifecycle`) **and** `ai_classifier` keys, sending the deterministic keys to the MCP server triggers `unsupported_rawKey` → `mcp_validation_failed` at the Edge. The fix is to add a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry that scopes the family to `ai_classifier`. The builder loop honors it at lines 147-148.

The header comment at lines 60-62 is explicit: *"Future families with similar source-mix complexity (E/F/G/H/I/J) add an entry here keyed on their family identifier when their Stage 2B decision lands; absence = full registry passthrough."* This is the live-only gap that the `MEMORY.md` note "MCP mixed-source family Edge subset" records: a mixed-source family that ships **without** this entry passes Deno/Jest but fails `admin_validation`/production with `mcp_validation_failed`, because the failure only manifests against the real hosted MCP server.

### 2.3 Family H — uniform `ai_classifier` (no subset entry needed)

`supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyH.ts` (read this card): all 12 entries carry `source: 'ai_classifier'`. Because the family is source-uniform, the MCP server supports every key it enumerates; **no** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry is required (adding one would be a defect, per the H-enable intent's HALT 13). The 12 keys: `provides_temporal_constraint`, `claim_present`, `reason_present`, `conclusion_missing`, `reason_missing`, `multiple_claims_present`, `claim_specificity_high`, `claim_specificity_low`, `quantifier_present`, `modal_language_present`, `hedging_present`, `unclear_reference_present`. All carry `disposition: 'future_source'`, default surface `inspect` (the existing `provides_temporal_constraint` is `timeline_node`), `visibleByDefault: false`.

### 2.4 Family I — mixed-source (subset entry REQUIRED)

`supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyI.ts` (read this card): 21 entries split across three sources:
- **8 `auto_metadata`** — deterministically derivable from tree shape (`has_reply`, `participant_skipped_node`, `no_response_after_n_turns`, `repeated_axis_pressure`, plus the 4 Decision-7 new keys `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node`).
- **7 `lifecycle`** — derived from lifecycle state (`open`, `answered`, `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`, `ignored_by_negative`, `ignored_by_both`).
- **6 `ai_classifier`** — require content classification (`introduces_new_issue`, `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`, `compares_options`).

Because I is mixed-source, its production-enable card MUST add (and keep present) a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = new Set(['ai_classifier'])` entry — scoping the MCP path to the 6 `ai_classifier` keys. The 8 `auto_metadata` + 7 `lifecycle` keys are routed through their NON-MCP deriver paths. This is the **inverse** of H: H must NOT have an entry (uniform); I MUST have one (mixed). The `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md` brief records this as HALT-13-inverse.

### 2.5 Family J — sensitive, composer-only / inspect-only, N=0 production cards

`supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyJ.ts` (read this card): 5 entries, all `source: 'semantic_referee'`, all `family: 'sensitive_composer'`:

| rawKey | disposition | default surface |
|---|---|---|
| `shifts_to_person_or_intent` | `composer_only` | `composer` |
| `contains_unplayable_insult_only` | `composer_only` | `composer` |
| `needs_pre_send_pause` | `composer_only` | `composer` |
| `uses_popularity_as_evidence` | `inspect_only` | `inspect` |
| `uses_satire_as_evidence` | `inspect_only` | `inspect` |

The `OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` formal verdict is **N = 0**: Family J needs zero production-enable cards under its current 5-key set + 4-surface set + current disposition. The composer-only / inspect-only disposition gate (with defense-in-depth at the Source-6 persistence-adapter surface acceptlist and the `productionEnabled: false` Edge flag) fully enforces the surface routing. See §6 below for why this is doctrinally load-bearing, not a convenience.

---

## 3. Why H / I / J are dormant today

### 3.1 Family H — attempted, FAILED smoke, rolled back

Family H is **not** dormant for lack of work. It went through the full chain:
- **Card 1** (`MCP-SERVER-009-FAMILY-H`): server-side classifier shipped; smoke PASS; H operational on the hosted MCP server in `admin_validation` mode.
- **Card 2** (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK`): L5 CI-mechanical doctrine-risk enforcement added (`family_h` in the `DOCTRINE_RISK_FAMILIES` set); smoke PASS.
- **Card 3** (`MCP-021C-EDGE-FAMILY-H-ENABLE`): the production flip merged, then its **post-merge smoke FAILED** — terminal provider holes (`mcp_api_error`) spread across **four** families (`argument_scheme`, `critical_question`, `disagreement_axis`, `claim_clarity`) at the 8-family load profile. The failure was **not H-specific**; it read as provider/server reliability resurfacing under the higher concurrent load. HALT 15 fired.
- **Rollback** (`REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE`): `claim_clarity` was flipped back to `productionEnabled: false`, restoring the A–G production roster. The H `admin_validation` path, the Card-1 server files, and the Card-2 L5 entries were all preserved.

So H is **FROZEN for production until provider/server reliability is demonstrated stable at the higher load**, and its Card-3 smoke is re-run cleanly. The synthetic launch-qualification work and the provider-reliability cutover (the `#421/#423` STRICT RESPONSE-SHAPE CONTRACT mitigation, the bounded-concurrency drainer, the Deno Deploy reliability build) are the prerequisite track that has to land first. The current branch (`feat/MCP-021C-EDGE-FAMILY-H-ENABLE`) carries the historical attempt; this roadmap does not re-attempt it.

### 3.2 Family I — never enabled; gated behind H

Family I has its design + intent brief (`MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md`) but no enablement has been attempted. The intent brief explicitly chains it: *"Family I chain becomes authorized [only after] H smoke PASS (separate planning decision)."* I is mixed-source, so it carries the additional mixed-source subset-entry requirement (§2.4) that H does not. Enabling I before H is stable would (a) violate the documented chain ordering and (b) re-expose the same provider-reliability surface at a 9-family load — strictly worse than the 8-family load that already failed.

### 3.3 Family J — dormant BY DESIGN

Family J is dormant because the scoping audit concluded it **should be** (N=0). Its observations are sensitive: surfacing `shifts_to_person_or_intent` / `contains_unplayable_insult_only` / `needs_pre_send_pause` on a target's public node would read as an allegation of bad faith. The composer-only routing — the chip surfaces privately in the author's own composer, never on anyone else's node — is the doctrine boundary that makes the surface safe. `productionEnabled: false` plus the disposition gate is the correct resting state, not a temporary one. See §6.

---

## 4. Prerequisites (PROPOSAL — required before ANY enablement)

All of the following are **prerequisites**, every one of them operator-gated. None is satisfied by this card.

**P1 — A–G stable at a higher percentage with real organic evidence.**
The H smoke failed because of provider reliability at load, not because of H. The proven fix has to be demonstrated under **real organic traffic** at a meaningfully higher routing percentage than 1% — not just synthetic burst harnesses. Concretely (proposal): the cutover track advances 1% → 5% → higher (each its own operator-gated step), the 24h+ observation windows close clean at each step, and the production A–G families show zero terminal-provider-hole clusters under genuine organic load. Until A–G is demonstrably reliable at a higher percentage with organic evidence, no family is added to the production roster. **The percentage dial is owned by the cutover track; this roadmap consumes its result, it does not drive it.**

**P2 — Each family ships its own production-enable audit, following the existing `MCP-SERVER-NNN-FAMILY-X` + `MCP-021C-EDGE-FAMILY-X-ENABLE` family-ship pattern.**
The pattern is established (D, E, F, G all shipped this way; H attempted it). For each new family: (1) the server classifier ships and smokes PASS in `admin_validation`; (2) any doctrine-risk L5 enforcement card ships if the family carries doctrine-risk keys; (3) the Edge production-enable card flips the one boolean, re-baselines the sibling count tests, adds an `edgeFamilyXProductionEnable.test.ts`, and adds an 8-phase (now 9-phase) smoke template; (4) the operator runs the post-merge smoke and authors the dated smoke audit. A family is production-enabled only on its own smoke PASS.

**P3 — Mixed-source families need their `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Edge entry (Family I, specifically).**
Any family whose registry enumerates `auto_metadata` and/or `lifecycle` keys alongside `ai_classifier` keys MUST add (and keep) a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry scoping the MCP path to `ai_classifier`. Family I needs this (8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`). Family H does NOT (uniform `ai_classifier`). Omitting the entry for a mixed-source family is the live-only `mcp_validation_failed` gap (`MEMORY.md` § "MCP mixed-source family Edge subset"): it passes Deno/Jest and fails only against the real hosted MCP server, so the smoke phase that exercises the hosted classifier is the gate that catches it.

**P4 — A doctrine review for `sensitive_composer` (Family J) before ANY public-surface enablement.**
Family J's keys are composer-only / inspect-only by doctrine. Before any J production surface could be considered, a doctrine review must confirm the surface does not place a sensitive Observation on a target's node. The existing scoping audit's verdict (N=0) is the current authority; a future change to J's disposition or surface set re-opens this review as a NEW doctrine-reviewed card. See §6.

**P5 — Provider concurrency / capacity headroom verified at the target family count.**
The failure mode that sank H was concurrency-correlated (`mcp_validation_failed` under burst, plus terminal `mcp_api_error` at the 8-family load). The provider/MCP capacity at the **target** family count (8 for +H, 9 for +I) must be verified to have headroom under the per-isolate concurrent-call ceiling (MCP cap = 5) before the flip. The bounded-parallel auto-trigger work (limit 2) and the drainer's bounded concurrency (C=3, MAX_ATTEMPTS=4, backoff [30,120]s) are the load-shaping levers; the smoke's load-delta phase is the gate.

---

## 5. Per-family enablement sequence (PROPOSAL — operator-gated, one family at a time)

> Each sub-section is a PROPOSAL. None is authorized by this card. The HARD RULE (§7) is that H / I / J stay OFF until each is explicitly operator-gated.

### 5.1 Family H (`claim_clarity`) — re-attempt after provider reliability is proven

**Precondition:** P1 + P5 satisfied (A–G stable at a higher percentage with organic evidence; provider headroom verified at the 8-family target). H's Card-1 server path and Card-2 L5 enforcement are already on `main`.

**Proposed sequence:**
1. Confirm the provider-reliability prerequisite is met (cutover track sign-off + organic evidence). **Operator gate.**
2. Re-run the existing `MCP-021C-EDGE-FAMILY-H-ENABLE` flip on a fresh branch: one boolean character (`claim_clarity` `productionEnabled: false → true`), re-baseline the sibling count tests (the `SEVEN → EIGHT` production-count pattern), restore `edgeFamilyHProductionEnable.test.ts`. **No** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry (H is uniform `ai_classifier`; adding one is a defect).
3. **Canary-then-burst smoke** (proposal): a single canary submit confirming 8 production families dispatch + at least one H key surfaces on a designed-positive H input + 0 terminal provider holes; then a bounded burst confirming the 8-family load stays within the per-isolate MCP cap (5) and produces zero `mcp_api_error` clusters across A–H. Doctrine Phase: `evidence_span` scan on the burst H rows with the L5 CI-mechanical enforcement (Card 2 already armed `family_h` in `DOCTRINE_RISK_FAMILIES`); 0 banned verdict tokens; per-key `falsePositiveGuards` hold.
4. **Its own observation window** (proposal): after the flip, an observation window (sized by the operator, mirroring the cutover windows) confirming A–H run clean under organic traffic before I is considered.
5. On smoke PASS + window clean: production roster is A–H. **Operator gate** authorizes considering I.
6. On smoke FAIL: roll back per the existing `REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE` pattern; H returns to admin-only; the prerequisite track absorbs the follow-up.

### 5.2 Family I (`thread_topology`) — only after H is stable in production

**Precondition:** Family H production-enabled and stable under its own observation window (§5.1). I's server card (`MCP-SERVER-010-FAMILY-I`) and any doctrine-risk L5 card ship first in `admin_validation` per the family-ship pattern.

**Proposed sequence:**
1. Confirm H is stable in production (its window closed clean). **Operator gate.**
2. Ship I's server classifier + smoke PASS in `admin_validation` (Card 1). Ship the I doctrine-risk L5 card if I carries doctrine-risk keys (Card 2, conditional).
3. Run `MCP-021C-EDGE-FAMILY-I-ENABLE` (Card 3): one boolean character (`thread_topology` `productionEnabled: false → true`), re-baseline the sibling count tests (`EIGHT → NINE`), add `edgeFamilyIProductionEnable.test.ts`. **MUST add and keep** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = new Set(['ai_classifier'])` (mixed-source; the 6 `ai_classifier` keys route through MCP, the 8 `auto_metadata` + 7 `lifecycle` keys route through their NON-MCP deriver paths). Removing or omitting this entry is HALT-13-inverse for I.
4. **Canary-then-burst smoke** (proposal): confirm 9 production families dispatch; the mixed-source subset filter holds (zero deterministic-key leak into the MCP path; zero `mcp_validation_failed` from `unsupported_rawKey`); at least one I `ai_classifier` key surfaces on a designed-positive input; the 9-family load stays within the per-isolate MCP cap (5) with zero `mcp_api_error` clusters across A–I.
5. **Its own observation window** (proposal) confirming A–I run clean under organic traffic.
6. On smoke PASS + window clean: production roster is A–I. On FAIL: roll back per the H-revert pattern; I returns to admin-only.

### 5.3 Family J (`sensitive_composer`) — NO production-enable card under current disposition

**Precondition:** none — J stays at its correct resting state.

**Proposal:** **Do not file a J production-enable card.** The `OPS-FAMILY-J-SCOPING-AUDIT` verdict (N=0) is the authority. The composer-only + inspect-only disposition gate, plus the Source-6 persistence-adapter surface acceptlist, plus `productionEnabled: false`, fully enforce J's surface routing today. Auto-trigger never runs J under production; the three concentric gates ensure no J key surfaces on a wrong surface.

The **only** circumstance under which J work would be authorized is a future operator doctrine change that introduces a NEW J surface (for example, a private pre-send "doctrine summary" surface that needs persisted history). That would be a NEW card with its own design + tests + smoke **and** a fresh doctrine review (P4) — not a registry flip. Until then, J is intentionally OFF, and that is the finished state, not a backlog item.

---

## 6. Doctrine — `sensitive_composer` (Family J) deserves special care

This section is the doctrine anchor the card's brief calls for. It applies `cdiscourse-doctrine` §1, §3, §4, and especially **§10a (Observations vs Allegations)**.

- **Machine outputs are Observations, never Allegations.** Family J's keys originate from system code (the semantic referee), not from a person. They must never be rendered in a way that implies a human is accusing another participant. The schema boundary is `source: 'machine'` — an Observation about the text, not an Allegation about the author.
- **Sensitive Observations render composer-only — never on the target's node.** Per §10a verbatim: *"Sensitive Observations (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`) render composer-only — never on the target's node — because surfacing them publicly reads as accusation."* The chip is a **private nudge to the author, in the author's own composer, before posting** — not a public label on anyone's contribution.
- **No verdict, no truth value, no intent claim.** None of J's five keys may imply the author is a "troll", "bad faith", "dishonest", "manipulative", "losing it", or "wrong". `needs_pre_send_pause` is a suggestion to take a breath, not a verdict that the author lost their temper. `contains_unplayable_insult_only` means "no playable claim is attached for another participant to engage", not "this person is an insulter".
- **The AI does not moderate.** Per §4: the referee does not delete, hide, modify, or delay the move. J chips are advisory; publication remains the author's decision. The chip surfaces a suggested revision; it never blocks posting.
- **Popularity and satire are not evidence.** The two `inspect_only` keys (`uses_popularity_as_evidence`, `uses_satire_as_evidence`) anchor §3: engagement/virality/follower-count and satire do not grant a claim factual standing. These surface on `inspect` as informational, never on the Timeline as a verdict, and never block.
- **Why this gates any future enablement.** Because J's safety is the surface routing itself, any future J production surface MUST pass a doctrine review (P4) proving it keeps composer-only keys composer-only and inspect-only keys inspect-only. A J key reaching a target's public node is a doctrine violation, full stop — that is precisely why the scoping audit concluded N=0 and why the disposition gate is pinned by regression tests.

The same doctrine discipline applies, at lower intensity, to H and I: every H/I key is a **structural Observation**, never a verdict. `claim_specificity_low` ("broad claim") is not "weak"; `conclusion_missing` ("no explicit conclusion") is not "incomplete argument"; `ignored_by_both` is a topology fact about reply state, not a verdict on the contribution. Heat / activity / friction are not truth, popularity is not evidence, and machine outputs are Observations — these hold for the whole H/I/J set, and the per-key `falsePositiveGuards` + `doctrineNotes` in the family definition files are the enforcement surface the smoke Doctrine Phase scans.

---

## 7. HARD RULE — H / I / J stay OFF until each is explicitly operator-gated

- **No file in this card enables any family.** The family registry on `main` is unchanged. H / I / J remain `productionEnabled: false`.
- **No doc, audit, or roadmap auto-advances a family to production.** Each enablement is a discrete operator-gated step with its own ship, its own smoke, its own observation window, and its own PASS verdict. A roadmap describing a future step does not authorize it.
- **The percentage dial and the family dial are separate.** Advancing routing above 1% is the cutover track's operator-gated decision. Adding a family to the production roster is this track's operator-gated decision. Neither implies the other.
- **One family at a time.** H before I (chain ordering); J not at all under current disposition. No batch enablement.
- **Failure rolls back.** Any family whose post-flip smoke fails returns to admin-only via the established revert pattern, and the provider-reliability prerequisite absorbs the follow-up.

---

## 8. Read-only observation tooling for this track

The Stage-1 observation suite already provides the read-only gauges that a future enablement step would consult to confirm "no H/I/J rows in production" and "A–G clean under load". These are committed under the sibling SQL directory and are read-only (no `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP`):

- `scripts/ops-stage1-sql/stage1-snapshot.sql` — one-row Stage-1 health snapshot, including `hij_rows_since_arm` (routed rows since arm in a non-production family — expected `0` while H/I/J are `productionEnabled: false`).
- `scripts/ops-stage1-sql/stage1-routed-volume.sql` — routed-argument volume since arm, split smoke vs non-smoke.
- `scripts/ops/stage1/verify-crons-and-queue.sh` + `arm-stage1-1pct.sh` + `disarm-stage1.sh` + `check-operator-secrets.sh` — the existing Stage-1 operator scripts (read-only verification; project-linked auth for queries).

These run via `npx supabase db query --linked --file scripts/ops-stage1-sql/<name>.sql`, authenticate via the project link, and never read or print any secret value. They are observation-only; none of them flips a registry flag or advances a percentage. A future per-family enablement step would consult `hij_rows_since_arm` to confirm the target family appears in production exactly when (and only when) its flip lands.

---

## 9. Proposal index (every item below requires separate operator authorization)

| # | Proposal | Gate | Pattern to follow |
|---|---|---|---|
| 1 | A–G stable at a higher percentage with organic evidence (P1) | Cutover-track operator gate | Existing Stage-1 → Stage-2 cutover process |
| 2 | Provider/MCP capacity headroom verified at 8- and 9-family load (P5) | Operator gate | Smoke load-delta phase |
| 3 | Re-attempt Family H production-enable (§5.1) | Operator gate, after #1 + #2 | `MCP-021C-EDGE-FAMILY-H-ENABLE` (one-char flip; no subset entry) |
| 4 | Family I server ship + L5 (if doctrine-risk) in `admin_validation` | Operator gate, after #3 stable | `MCP-SERVER-010-FAMILY-I` + family-ship pattern |
| 5 | Family I production-enable (§5.2) | Operator gate, after #4 | `MCP-021C-EDGE-FAMILY-I-ENABLE` (one-char flip; **MUST** add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']`) |
| 6 | Family J production surface | NOT proposed; only on a future doctrine change | NEW doctrine-reviewed card (P4); never a registry flip |

**None of the above is done, none is auto-advancing, and none is authorized by this card.** This roadmap is the map; the operator drives.

---

## 10. What this card explicitly does NOT do

- Does NOT enable Families H, I, or J (registry unchanged; all three stay `productionEnabled: false`).
- Does NOT close the Stage-1 observation window or issue any Stage-1 pass verdict.
- Does NOT advance routing above 1%.
- Does NOT change any source, migration, validator, prompt, registry, or secret.
- Does NOT call any provider, MCP, or network endpoint; runs no DB query; mutates no env or cron.
- Authors only documentation (this file). The read-only SQL + shell observation tooling referenced in §8 already exists on the tree.
