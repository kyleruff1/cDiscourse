# OPS-MCP-AUDIT-LINT-RULES-FAMILY-J-DOCTRINE-RISK — Design

**Status:** Design draft — GATE-A
**Epic:** Epic 12 — MCP / semantic-referee track (OPS audit-lint sub-track)
**Release:** OPS hardening (audit-lint RULES, data-and-tests)
**Issue:** MCP-SERVER-011-FAMILY-J Card 2 (umbrella #388 / J-chain)
**Card type:** audit-lint RULES — **DATA-only** (Set append), NOT logic-and-runtime
**Template (mirrored exactly):** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK.md` (PR #549, commit `0e7dfd6`)
**Branch:** `feat/ops-audit-lint-family-j-l5`
**Date:** 2026-06-11
**Prerequisites:**
- Card 1 ship: `MCP-SERVER-011-FAMILY-J` (PR #567, merge `446c3f2`)
- Family I doctrine-risk chain shipped (`0e7dfd6`/#549) — `DOCTRINE_RISK_FAMILIES` already carries E (2) + F (3) + G (3) + H (3) + I (3) = 14 entries on disk
- Families A–I MCP production; Family J admin_validation shipped (10th family, `productionEnabled:false`)

This card is a faithful replica of the already-shipped Family I doctrine-risk
card (`0e7dfd6`/#549), applied to Family J, with the substitutions
`family_i → family_j`, `thread_topology → sensitive_composer`, and
`compares_options → shifts_to_person_or_intent`. It adds Family J to L5
doctrine-risk enforcement exactly as the I card added Family I.

> This is a `docs/designs/` artifact — the audit-lint CI workflow only scans
> `docs/audits/**SMOKE*.md`, so this doc is never linted. It carries no operative
> phase semantics.

---

## Binding-decision recital (from the two merged docs)

The decision to file and execute this card is BINDING, recited verbatim from the
two merged J docs:

1. **`docs/designs/MCP-SERVER-011-FAMILY-J-intent.md` §11** ("L5 audit-lint
   question"): "Because J's doctrine-risk is HIGH, the L5 entry is warranted …
   **Follow-up card (not this one): MCP-SERVER-011-FAMILY-J Card 2 — L5
   doctrine-risk mechanization.** Add `'sensitive_composer'`, `'family_j'`, and
   the axis-partner `'shifts_to_person_or_intent'` to `DOCTRINE_RISK_FAMILIES`
   (`audit-lint-rules.cjs`), with the doctrine-risk comment block mirroring the
   H/I entries."
2. **`docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-template.md`** ("Card 2 … is
   WARRANTED" block + Gate A): "Card 2 (L5 mechanization — adding
   `sensitive_composer`, `family_j`, and the axis-partner
   `shifts_to_person_or_intent` to `DOCTRINE_RISK_FAMILIES` …) is **WARRANTED**
   (HIGH doctrine-risk)." The E3 smoke (`MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md`)
   recorded Gate A = doctrine-risk HIGH and listed Card 2 as a separate follow-up.

### Why J is HIGH (the inverse of I's LOW)

Family J is doctrine-risk = **HIGH by construction** — this is **the MOST
sensitive prompt in the system**. Four of the five `semantic_referee` keys are
verdict-adjacent and three are person/intent-directed:

| rawKey | risk |
|---|---|
| `shifts_to_person_or_intent` | **HIGHEST — axis-partner** (person/intent shift; maximal §10a guard) |
| `contains_unplayable_insult_only` | verdict-adjacent ("insult"/"troll" drift) |
| `needs_pre_send_pause` | verdict-adjacent (emotional-state-label drift) |
| `uses_satire_as_evidence` | verdict-adjacent (truth-verdict "fake" drift) |
| `uses_popularity_as_evidence` | §3 anti-amplification (popularity ≠ evidence) |

Unlike Family I (whose only verdict-adjacent candidate `repeats_prior_point` was
pruned upstream, leaving NO axis-partner — so its L5 entry was an operator
belt-and-suspenders override of a LOW grade), **J has NO pruned key — the
sensitive vocabulary IS the family.** `shifts_to_person_or_intent` is the single
key `cdiscourse-doctrine` §10a (Observations vs Allegations) exists to constrain.

---

## The 3 entries (as committed)

Appended to the `DOCTRINE_RISK_FAMILIES` Set in `scripts/ops/audit-lint-rules.cjs`
**after the I block** (after `'compares_options'`), with the comment block
mirroring H/I in shape:

```js
  // Family J (sensitive_composer). `family_j` is the string detectFamily()
  // actually emits for a `MCP-SERVER-NNN-FAMILY-J` title (mapFamilyLetterToName
  // has no J case → default branch → `family_j`); it is the load-bearing alias.
  // `sensitive_composer` is the canonical key name (also covers any doc that
  // declares `Family: sensitive_composer`). Unlike Family I (Card 1 graded I's
  // doctrine-risk LOW, so its L5 entry was an operator belt-and-suspenders
  // override), Family J is doctrine-risk = HIGH BY CONSTRUCTION
  // (MCP-SERVER-011-FAMILY-J §1 / §5 / §13; the SMOKE-template "MOST sensitive
  // prompt in the system" framing): four of the five `semantic_referee` keys are
  // verdict-adjacent and three are person/intent-directed, and J has NO pruned
  // key — the sensitive vocabulary IS the family (the inverse of I, whose
  // verdict-adjacent candidate `repeats_prior_point` was pruned upstream).
  // `shifts_to_person_or_intent` is the J doctrinal-axis partner key — the J
  // analog of E's `slippery_slope` / F's `consequence_probability_unclear` / G's
  // `concedes_broader_point` / H's `claim_specificity_low` / I's
  // `compares_options`, but STRONGER: it carries the MAXIMAL guard and is the
  // single highest verdict-adjacency key in the entire system — it is the key
  // that `cdiscourse-doctrine` §10a (Observations vs Allegations) exists to
  // constrain (the person/intent focus-shift that must never become an
  // "ad hominem" / "personal attack" verdict). Reachable via a `Family:`
  // declaration.
  'sensitive_composer',
  'family_j',
  'shifts_to_person_or_intent',
```

- `family_j` is the **load-bearing** alias: `detectFamily()` maps a canonical
  `MCP-SERVER-NNN-FAMILY-J` title via `mapFamilyLetterToName('J')`, which has no
  `J` case and falls to the default branch → `family_j`. Adding only
  `sensitive_composer` would be a silent no-op for canonical-titled J docs.
- `sensitive_composer` is the canonical key name (covers any doc declaring
  `Family: sensitive_composer`).
- `shifts_to_person_or_intent` is the §10a axis-partner — the highest
  verdict-adjacency key in the system; reachable only via a `Family:` declaration.

**No logic change.** `audit-lint.mjs`, `audit-lint-lib.cjs` (incl.
`mapFamilyLetterToName`), and the A–I Set entries stay byte-equal. Post-J set
size = **17** (was 14 after I; +3).

---

## Fixture matrix (fixtures 17 + 18 + 19)

Three HAND-AUTHORED synthetic fixtures under `__tests__/fixtures/audit-lint/`
(no on-main build-only J smoke shaped as consistent-PARTIAL / amendment to
byte-copy; the real merged E3 smoke is an `Audit-type: ops` PASS that already
carries the `evidence_span` readback). Each begins with the
`<!-- AUDIT-LINT-FIXTURE: … exclude from doctrine/verdict scans -->` marker.

| # | fixture | exit | detects | rules |
|---|---|---|---|---|
| 17 | `family-j-consistent-PARTIAL.md` | 0 | `family_j` / family-ship / PARTIAL | (none) — names `evidence_span` as the deferred Phase 4b obligation → `hasInspection` true → L5 silent |
| 18 | `family-j-amendment-PASS.md` | 0 | `family_j` / amendment / PASS | (none) — persisted `evidence_span` readback present; synthetic spans anchor the STRUCTURAL focus-shift wording and never echo a person/intent label (§10a); L6 provenance intact |
| 19 | `family-j-IMPROPER-PASS-no-evidence-span.md` | 1 | `family_j` / amendment / PASS | **[L5] ONLY** — doctrine-risk J + verdict PASS + ZERO `evidence_span` inspection (the teeth; amendment-typed + intact L6 → L1/L2/L6 do NOT fire) |

Fixtures are **doctrine-clean themselves**: synthetic spans only, no real spans,
no banned person/intent tokens outside scanner-context enumeration (mirrors how
the I fixtures enumerated verdict words in scanner-context).

---

## Test plan (`__tests__/opsAuditLint.test.ts`, +11 → 191)

Mirror the I block (15e) as a new J block (15f):

- 3 membership pins: `sensitive_composer`; `family_j` (the HALT-11 chain-binding
  pin); `shifts_to_person_or_intent` (the §10a axis-partner).
- `preserves E+F+G+H+I` guard pinning `DOCTRINE_RISK_FAMILIES.size === 17` (the
  stale `size === 14` pin on the I "preserves" test is retired — the canonical
  size pin moves to the J guard; no test removed).
- detectFamily A.1-trap pin: `MCP-SERVER-011-FAMILY-J` title → `family_j`.
- L5 fires (no `evidence_span`) / does NOT fire (with `evidence_span`) /
  consistent-PASS regression (PASS naming `evidence_span` does not false-fail L5).
- 3 fixture self-validations (PARTIAL → 0, amendment → 0, IMPROPER → 1 L5-only).
- `FIXTURE_FILES` 16 → 19; the fixture-count assertion 16 → 19.

`__tests__/fixtures/audit-lint/README.md` gains the J hand-authored note + 3
expected-outcome rows + the count 16 → 19.

---

## Critical regression (CONFIRMED CLEAN)

The merged `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` is now an
L5-subject `family_j` doctrine-risk audit (title `MCP-SERVER-011-FAMILY-J-SMOKE`
→ `detectFamily` → `family_j`; `Audit-type: ops`). It carries the persisted
`evidence_span` inspection SQL + table, so `hasInspection` is true and L5 stays
silent: **0 findings / exit 0** after the rules change. The fix for any future
trip lives in the rules/comment shaping, NEVER in weakening L5 and NEVER in
editing the merged audit. The H/I server + EDGE-FAMILY E–I 2026-06-1* smoke
audits re-lint exit 0 (the one EDGE-FAMILY-D `[L4]` finding is PRE-EXISTING on
main — L4 never consults `DOCTRINE_RISK_FAMILIES`, proven by re-lint with the J
change stashed).

---

## Doctrine self-check

- **§1 (no truth/verdict labels):** this card mechanizes the L5 doctrine GUARD
  that forces J doctrine-risk audits to inspect persisted `evidence_span`. It
  adds no verdict label anywhere. RESPECTED.
- **§10a (Observations vs Allegations) — LOAD-BEARING:** `shifts_to_person_or_intent`
  is enrolled precisely because §10a constrains it; the L5 teeth force any J PASS
  audit to prove its persisted spans never characterize the author. RESPECTED.
- **§3 (popularity / satire are not evidence):** unaffected — this is audit-lint
  tooling, no scoring/standing surface. RESPECTED.
- **§4 / §5 (AI moderator advisory; engine sacred):** no `engine.ts` change, no
  AI call, no runtime surface. RESPECTED.
- **§6 / §7 (secrets; no AI from app):** no secret, no provider call; fixtures
  are synthetic. RESPECTED.
- **§8 (RLS + append-only migrations):** no migration, no RLS, no DB surface.
  RESPECTED.
- **v1 scope / no service-role:** DATA-only Set append + tests + docs.
  RESPECTED.

---

## Out of scope (explicit)

- Any change to `audit-lint.mjs` / `audit-lint-lib.cjs` logic (byte-equal).
- Any change to the A–I `DOCTRINE_RISK_FAMILIES` entries (byte-equal).
- Any mcp-server / Edge / migration / `src/` change.
- Editing the merged `MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` (it lints clean).
- A J production-enable flip (E4 ceiling; a fresh §10a review is required).
