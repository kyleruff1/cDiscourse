# CDiscourse Pipeline Governance Contract — v1

**Status:** governance contract (binding for every CC card run after 2026-06-02).
**Owner / sole approver:** Kyler (operator).
**Companion:** the `cdiscourse-prompt-standard` skill (this contract is the *gating layer* on top of that authoring standard — it does not replace §1–§10 of the skill).
**Scope:** every Claude Code card on `C:\Users\kyler\cdiscourse\debate-constitution-app` that mutates the repo, the database, env/secrets, or any deployed surface. Read-only research/audit workflows inherit only §3 (HALT) and §4 (never-self-approve), not the stage gates.

> **Provenance note (this draft):** §0–§2 below are transcribed verbatim from the operator's authoring context. §3–§8 were **drafted by Claude Code** from the card's references, §0–§2's own forward-references, and the demonstrated governance behavior of the 2026-06-02/03 cutover cards. This file is a **draft for operator review** — it has not been committed. See the open questions surfaced at hand-off.

> **Why this exists.** The recent dependency sweep shipped correctly, but two moves inside it are the exact shape this contract governs: an agent **relaxed a boundary test (RO-36/RO-37) to make a PR pass**, and the chain auto-merged PRs whose only blocker was a guard the agent itself decided to change. Both were defensible and were approved inline — but "a check failed, so the agent changed the check" and "merge is a deploy" must never be an agent's unilateral mid-run decision. This contract makes those a hard stop with an explicit human yes, while still letting the design→implement→review loop run forward on a green light. It is a *gated continue*, not a dead stop.

---

## 0. How a card references this contract

Every executable prompt adds one line under its Global Execution Contract:

> **Governance:** this card runs under the *CDiscourse Pipeline Governance Contract v1*. The stage gates (§2), HALT conditions (§3), and the never-self-approve list (§4) are binding. On any §3 trigger or any §4 action, STOP at the top of the current output, surface the exact finding, and wait for an explicit operator decision — never work around it.

Nothing else in the card overrides this contract. If a card body and this contract conflict, this contract wins, and the agent surfaces the conflict rather than guessing.

---

## 1. Inherited non-negotiables (unchanged, restated for the gate)

These are the `cdiscourse-prompt-standard` §1 floor; the gates below assume them.

- **Acceptance-gate invariant.** AI/MCP classifiers are never the submission acceptance gate; the pure rules engine (`src/lib/constitution/engine.ts`) is the sole gate; classifiers run *after* an argument is stored. No card may make a classifier/queue/routing change that can block, route, or delay an ordinary post.
- **Boundary line.** Every card carries its verbatim `NO … by Claude` block. The agent does only what that block's single tailored exception permits.
- **Provider spend is operator-run; secrets never touch files or logs.**
- **Preservation + migration discipline.** Name what stays byte-equal; never edit an applied migration; keep the dual-copy mirrors in sync by hand.
- **Cite state to `file:line` + HEAD.** Git + the file tree are ground truth when `current-status.md` disagrees.

---

## 2. The stage machine (gated continue)

```
  Phase 0 ─▶ DESIGN ──▶ [GATE A] ──▶ IMPLEMENT ──▶ [GATE B] ──▶ REVIEW ──▶ [GATE C] ──▶ done
  preflight  (read)     approve      (main-thread   stop-at-PR   (read)      merge /
   (HALT      design     design       mutation)      approve      verdict     deploy
    on red)                                          the diff                 decision
```

The agent runs each stage to completion, then **stops at the gate and surfaces**. The operator's explicit approval is what advances the machine to the next stage. With approval, the loop continues; without it, the machine holds. No stage may begin before its predecessor's gate is cleared.

| Stage | Agent (isolation=worktree) | Produces | The gate that follows | What the operator approves at the gate |
|---|---|---|---|---|
| **Phase 0** | main | preflight + state-verification block | *(HALT-only — see §3)* | nothing; a non-green baseline or a failed state assertion is a HALT, not a gate |
| **DESIGN** | `roadmap-designer` (read-only) | `docs/designs/<code>.md` | **GATE A** | the design doc — scope, the chosen approach, the open questions, the boundary. *No code exists yet.* |
| **IMPLEMENT** | main-thread only (subagents read-only) | code + tests + `current-status.md` entry, committed on `feat/<code>-<slug>`, **PR opened, STOP at PR** | **GATE B** | the committed diff + the green-gate evidence (typecheck/lint/test counts, leak scans, diff-stat) + the PR body. **The agent never merges as part of IMPLEMENT (Gate B)** — see §5/§6 for when a green non-deploy PR may auto-merge *after* the review/verification path; otherwise the merge waits for the operator. |
| **REVIEW** | `roadmap-reviewer` (read-only) | `docs/reviews/<code>.md` (Approve / Changes-requested / Block) + the ≥5 adversarial checks | **GATE C** | the verdict, and the **merge / deploy decision** (§4 makes the merge itself operator-only when merge = deploy). |

**Stage rules (from the house standard, enforced here):**
- DESIGN never writes production code, deps, or pushes. IMPLEMENT never redesigns, deploys, or pushes. REVIEW never modifies code, pushes, or opens a PR.
- IMPLEMENT is **single-track through the main agent**; read-only `Workflow(...)` fan-out is the only parallelism (required-reading, state checks, citation mapping, diff inspection).
- A fresh worktree legitimately shows an empty `git status` + a setup `reset --hard` reflog entry — normal, not data loss.

**What does NOT require a gate (autonomous, so the loop stays fast):** completing each stage's own artifact; opening (not merging) a PR; a *green* squash-merge **only** for cards whose merge is **not** a deploy, touches **no** §4 surface, introduces **no** new operative semantics, and that **explicitly allow green auto-merge** (docs-only, dev-tooling-only, test-only). Everything a gate covers, and everything in §4, is not autonomous.

---

## 3. HALT conditions

A HALT is **stop at the top of the current output, surface the exact finding with its `file:line` + HEAD evidence, and wait for an explicit operator decision.** A HALT is never worked around, never "noted and continued past," and never resolved by the agent changing the thing that tripped it. The loop resumes only on the operator's word.

HALT triggers (any one):

1. **Non-green Phase-0 baseline** — `typecheck` / `lint` / the relevant `test` slice is not exit 0 before any mutation, or a required tool/credential/worktree is missing.
2. **Failed state assertion** — a load-bearing precondition the card asserts does not hold (e.g. routing not at baseline, queue not inert, a required artifact absent or a stub, HEAD materially different from the card's cited HEAD).
3. **A §4 (never-self-approve) action becomes necessary mid-run** — the only way forward crosses an operator-only line. Surface it; do not cross it.
4. **A guard / test / boundary / bar would have to change to make a check pass** — see §4. "The check failed, so I'll change the check" is the canonical forbidden move (the RO-36/RO-37 incident). HALT and let the operator decide whether the guard is wrong or the code is.
5. **A bar/threshold would be lowered** (§4-T) — any normalization, edit, or "fix" that loosens a pass/load/ramp/dead-letter/cluster threshold, or reclassifies a previously non-passing run as passing. Keep the stricter reading and HALT for the operator; never silently adopt the looser one.
6. **Merge would be a deploy** and the operator has not approved that specific merge (§5).
7. **Boundary-line violation would be required** — the card's `NO … by Claude` block forbids the only available path (a provider call, a secret/env mutation, a runtime edit outside the tailored exception).
8. **Secret / leak risk** — a secret value, JWT, bearer, service-role key, or user PII would land in a file, log, commit, or PR. Stop before it does.
9. **Ambiguity that is an operator policy call** — a contradiction or scope question that can only be resolved by an operator decision (not by code or sensible defaults). Surface the options; do not pick the looser/riskier one.
10. **Card ⨯ contract conflict** — the card body instructs something this contract forbids. This contract wins; surface the conflict.

On resume after a HALT, re-verify the state that tripped it (state can move while halted) before continuing.

---

## 4. Never-self-approve (operator-only actions)

The agent **never approves its own work for a gate, and never performs any action on this list.** Each requires an explicit, specific operator "yes" — a blanket or prior approval does not carry to the next instance.

**A. The integrity moves (the reason this contract exists).**
- **Changing a failed guard, test, boundary check, lint rule, or assertion to make a PR/CI pass.** If a check fails, the agent surfaces it and the operator decides whether the check is wrong (operator authorizes the relaxation, ideally in its own card) or the code is wrong (the agent fixes the code). The agent never relaxes the thing that is failing it. *(RO-36/RO-37.)*
- **Lowering a bar / loosening a threshold / reclassifying a non-passing run as passing** (§4-T). Consolidation/normalization may tighten/preserve/clarify a bar, never lower one.
- **Self-approving a design, diff, or review at its gate.** GATE A/B/C are operator decisions; the agent produces the artifact and stops. An agent-authored review verdict is input to the operator's decision, not the decision.

**B. Merge-as-deploy and shared-surface mutations.**
- **Merging a PR whose merge is a deploy** (see §5) — operator-only.
- **Deploying** anything: `npx supabase functions deploy`, a Deno Deploy **push / promote / app-settings mutation** (for `mcp-server/`), `npx supabase db push` / migration apply, or any push to a production surface.
- **Arming / mutating routing, env, or secrets:** `supabase secrets set`, `CLASSIFIER_QUEUE_ROUTING_ENABLED`/`_PERCENTAGE`, cron (`cron.job`) schedule changes, any `.env*` write.
- **Provider spend** — running a smoke / canary / N-burst that triggers Anthropic/xAI/X calls, or any direct provider call.

**C. The frozen product surfaces.**
- **H/I/J production enablement** — flipping `familyRegistry.ts` `productionEnabled:false → true` for `claim_clarity` / `thread_topology` / `sensitive_composer`.
- **Percentage-ramp authorization** — advancing `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` (1% → 5% → …); each step is its own operator card (see the canonical gate doc).
- **Editing an applied migration**, disabling RLS, or hard-deleting `arguments` / deleting `flags` rows.

If any of A–C is the only way forward, that is a §3 HALT.

---

## 5. Merge / deploy decision rules

**The principle: a merge is a deploy when merging changes a running, shared, or production surface. A merge-as-deploy is operator-only (§4-B). The only autonomous merge is a green squash-merge of a PR that is *not* a deploy, touches *no* §4 surface, introduces *no* new operative semantics, and that the card explicitly allows to green-auto-merge.**

**Merge IS a deploy (operator-gated — never autonomous):**
- The PR changes `supabase/functions/**` or `supabase/migrations/**`. The Supabase GitHub integration **auto-applies migrations and redeploys Edge Functions on merge to `main`** — so **merging to `main` is deploy-like and operator-gated.**
- The PR touches any §4 surface (routing/secret/cron config in repo, `familyRegistry`, validators, ban-lists, retry policy, prompts).
- The PR is a **docs change that *defines* operative semantics** an operator must ratify — e.g. ramp-authorization / gate-threshold semantics. Such a docs PR is operator-gated for an explicit GATE-C read even though it ships no code (the consolidation card is the precedent).

**Merge lands runtime code but is NOT itself a deploy — `mcp-server/**`:**
- A `mcp-server/**` merge to `main` **lands code only; in this project the merge is not itself a deploy.** `mcp-server/` is **not** auto-deployed on merge — the change goes live only on a **separate Deno Deploy push / promote**, which is **operator-only (§4-B)**.
- A `mcp-server/**` PR **may still be Gate-C reviewed** because it touches runtime code — but the **merge is not described as the live deploy unless the card explicitly says it is.** When unsure, route it through Gate C and let the operator decide the merge.
- **Any Deno Deploy push, promote, or app-settings mutation remains operator-only**, regardless of how the merge was handled.

**Merge is NOT a deploy (autonomous green squash-merge permitted):**
- **Docs-only** PRs that add/clarify/record without defining new operative semantics (status ledgers, audits, design notes, pointer banners, recording an operator decision already made).
- **Dev-tooling-only** or **test-only** PRs that touch no runtime path and no §4 surface.
- Autonomous **only** when §5's principle holds (non-deploy · no §4 surface · no new operative semantics) **and the card explicitly allows green auto-merge**; otherwise the merge waits for operator approval.

Decision procedure at GATE C: *Does merging this PR change a running/shared/production surface, or define semantics the operator must ratify?* If yes → operator-gated (surface the merge/deploy decision and wait). If no, the gates are green, **and the card allows green auto-merge** → autonomous squash-merge, then sync `main`. When in doubt, treat it as a deploy and ask.

---

## 6. Autonomous action boundaries

**Autonomous (no gate — keeps the loop fast):**
- Completing each stage's own artifact (the design doc, the implementation diff + tests, the review verdict, an audit).
- Read-only research/verification: metadata-only SQL state checks, `git`/file reads, read-only `Workflow(...)` fan-out (required-reading, state checks, citation mapping, diff inspection).
- Opening (not merging) a PR.
- A green squash-merge of a PR that §5 classifies as **non-deploy · no §4 surface · no new operative semantics** AND that the card **explicitly allows to green-auto-merge** — performed only *after* the appropriate review/verification path, then sync `main`. The agent never merges as part of IMPLEMENT (Gate B); any merge not meeting all of these waits for operator approval.
- Creating branches, committing to a `feat/<code>-<slug>` or `docs/<slug>` branch (never to `main` directly), and pushing that branch.
- Removing the agent's own scratch files (e.g. `.claude-tmp/**`) when their content is preserved elsewhere.

**Not autonomous (gate or §4):**
- Everything a gate covers (advancing the stage machine past GATE A/B/C).
- Everything on the §4 never-self-approve list.
- Any merge that is a deploy or touches a §4 surface (§5).
- Any provider spend, deploy, routing/env/secret/cron mutation, or frozen-surface change.

**Read-only research/audit workflows** (no mutation at the boundary) inherit only §3 (HALT) and §4 (never-self-approve) — they do not run the full stage machine, but they still never lower a bar, never relax a failing guard, and never cross a §4 line.

---

## 7. Relationship to `cdiscourse-prompt-standard`

This contract is the **gating layer on top of** the `cdiscourse-prompt-standard` skill, not a replacement for it.

- The **skill (§1–§10)** governs *how a card is authored*: the boundary line, preservation discipline, right-sizing (§10 — small cards stay hand-orchestrated, no ceremony swarm), the design→implement→review structure, secret/leak hygiene, and citation discipline.
- This **contract** governs *what may advance without a human* once a card is running: the stage gates (§2), the HALT conditions (§3), the never-self-approve list (§4), and the merge/deploy rules (§5).
- Where the skill describes the *shape* of good work and the contract describes the *gate*, both apply. Where a specific card body conflicts with this contract, **the contract wins** and the agent surfaces the conflict (§0).
- The canonical *domain* references the contract assumes are unchanged and remain authoritative: `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (gate/pass/ramp semantics, operator-ratified), `CLAUDE.md` (project floor), and the `cdiscourse-doctrine` / `supabase-edge-contract` / `test-discipline` skills.

---

## 8. One-screen quick reference

```
STAGE MACHINE (gated continue):
  Phase 0 → DESIGN → [GATE A] → IMPLEMENT → [GATE B] → REVIEW → [GATE C] → done
  run each stage to completion, STOP at the gate, surface, wait for operator "yes".

GATES (operator approves):
  A = the design doc        B = the committed diff + green evidence + PR (agent never merges)
  C = the review verdict + the merge/deploy decision

AUTONOMOUS (no gate):  stage artifacts · read-only research/Workflow · open a PR ·
  green squash-merge of a NON-deploy, NO-§4-surface, NO-new-semantics PR the card allows (docs/tooling/test) · branch+commit+push ·
  remove own scratch.

NEVER SELF-APPROVE (operator-only — §4):
  • change a failing guard/test/bar/lint to make a PR pass   ← the reason this exists (RO-36/37)
  • lower a bar / loosen a threshold / reclassify a non-pass as pass (§4-T)
  • self-approve a design/diff/review at its gate
  • merge-as-deploy · deploy (Edge/migration/Deno) · arm routing · secrets set · cron change · provider spend
  • H/I/J productionEnabled flip · 5%/ramp authorization · edit an applied migration · disable RLS

MERGE = DEPLOY?  yes → operator-gated.  Merge changes supabase/functions or migrations (auto-deploys
  on merge), touches a §4 surface, or defines operative semantics to ratify → operator.
  mcp-server merge = lands code only (NOT a deploy); the Deno Deploy push/promote is operator-only.
  Docs/tooling/test, no §4 surface, no new semantics, card allows it → autonomous green merge.

HALT (stop + surface + wait; never work around):
  non-green baseline · failed state assertion · a §4 action needed · a guard/test/bar would change ·
  a bar would be lowered · merge-as-deploy unapproved · boundary-line violation · secret/leak risk ·
  operator-policy ambiguity · card⨯contract conflict (contract wins).

Companion: cdiscourse-prompt-standard skill (authoring §1–§10). Contract wins on conflict.
Owner / sole approver: Kyler.
```
