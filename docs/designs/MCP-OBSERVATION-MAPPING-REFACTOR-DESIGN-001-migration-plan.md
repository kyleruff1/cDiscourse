# MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 — GATE-A migration plan

**Status:** Proposed — GATE A (plan for operator approval; authors/applies NOTHING)
**Date:** 2026-06-07
**Parent design:** `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md`
**Discovery STORAGE VERDICT:** `.claude-tmp/MCP-OBSERVATION-MAPPING-REFACTOR-discovery.md` §1

---

## Headline

**DDL needed: NO** — for boolean-answer storage in both tracks (existing-boolean mapping and new-boolean expansion).

The observation store is a **`raw_key`-row key-value model**. A new boolean is a new `raw_key` *string value* stored as a row, not a new column. The table already accepts any rawKey string; read-time gating is by registry membership in code, not by schema.

---

## 1. Why no DDL (verified)

Migration `20260526000018_mcp_021b_machine_observation_results.sql` defines:

```
public.argument_machine_observation_results (
  id uuid PK,
  run_id uuid FK → runs(id),
  debate_id uuid FK → debates(id),
  argument_id uuid FK → arguments(id),
  schema_version text NOT NULL,
  raw_key text NOT NULL,           -- ← the boolean identity lives HERE, as a value
  family text NOT NULL,
  confidence text CHECK (low|medium|high),
  evidence_span text,
  created_at timestamptz,
  CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)
)
```

- One row = one POSITIVE observation. A move's positive booleans are its set of `raw_key` rows. A negative is simply the absence of a row (no negative rows are stored).
- A column COMMENT in the migration states: *"One of the 172 MCP-021A MachineObservationDefinition rawKeys. Unknown rawKeys are silently dropped by the adapter — never echoed in UI, never logged."*
- The read adapter (`src/features/nodeLabels/machineObservationPersistenceAdapter.ts`) gates on `schema_version` match, **rawKey-registry membership**, and per-surface confidence floor — all in code. A rawKey the registry doesn't know is dropped silently.

**Consequence:** adding any boolean (new production-family booleans in Track 2, or any future boolean) requires no `ALTER TABLE`, no new column, no index change, no backfill. The schema already stores it.

The artifact's `schema_action = requires_sql_or_json_schema_extension` label is reconciled here: it means **the boolean itself is new** (needs a definition + an MCP-server prompt so the classifier can answer it), **not** that a DDL change is required. JSON-keys-first is **already realized** by the raw_key-row model — each rawKey is a key in a key-value store; no column promotion is needed now.

---

## 2. What each track actually changes (all code; no DDL)

### Track 1 — `MCP-OBSERVATION-MAPPING-EXPANSION-001` (Build 1)
- **DDL:** none.
- **Schema-version bump:** none (reads existing persisted booleans; no wire/shape change).
- **MCP-server prompts:** none (no new questions).
- **Code:** new pure-TS evaluator module + Edge mirror + checked-in reviewed registry data + presentation wiring + gameCopy label entries + tests.
- **Gate:** normal (no `supabase/**` migration, no `mcp-server/**`). No merge=deploy.

### Track 2 — `MCP-BOOLEAN-SCHEMA-EXPANSION-001` (Build 2)
- **DDL:** **none** for answer storage (the raw_key-row model stores any new boolean as a value).
- **Schema-version bump:** YES — `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant bumps from `mcp-021.machine-observations.boolean.v1` to the next version (e.g. `…boolean.v2`) in BOTH the client schema file and the Edge mirror. This is a **constant change in code**, not a migration. Old rows persist under their old `schema_version`; the read adapter's version-match filter means pre-bump rows still render under the matched version and post-bump rows render under the new version. (No backfill: existing rows keep their stored version string; the adapter compares against whichever version the reading surface pins.)
- **New `MachineObservationDefinition` entries:** the 21 adopted production-family booleans, added to BOTH mirror files (`familyA.ts … familyG.ts` client + Edge) + parity test.
- **MCP-server prompt expansion:** the MCP server (`mcp-server/**`) gains the new boolean questions so the classifier can answer them. This is the merge=deploy surface.
- **Gate:** merge=deploy GATE C (touches `supabase/**` definitions mirror + `mcp-server/**`). Heightened verification per roadmap-reviewer §"Migration-bearing card verification" applies to the deploy chain even though there is no DDL — the schema-version bump + MCP-prompt change are deploy-affecting.

### Track 3 — mapping extension (Build 3)
- **DDL:** none. **Schema-version bump:** none. **MCP prompts:** none.
- **Code:** registry rows + evaluator rules for the new booleans + tests. Normal gate.

### Build 4 — HiTODS family (`MCP-FAMILY-HITODS-DESIGN-001`)
- **DDL:** none (same raw_key-row model; the family's booleans are rawKey values).
- **Schema-version bump:** YES (its build bumps the constant for the new family's booleans), in code.
- **New family entry:** an 11th `FAMILY_REGISTRY` entry `{ family: 'disagreement_strategy_hitods', productionEnabled: false, adminValidationEnabled: true }` — code only.
- **New `familyK.ts`** in BOTH mirrors + parity test; MCP-prompt expansion for the 18 questions.
- **Gate:** P4 doctrine design first, then a merge=deploy GATE C build, then a STILL-separate operator-gated enablement card to ever flip `productionEnabled:true` (never by this chain).

---

## 3. Migration filename(s)

**None.** No `supabase/migrations/<timestamp>_*.sql` file is created by any build in this chain for boolean-answer storage.

**Conditional future migration (NOT this card, NOT these builds):** if a named query/filter/report workload later requires promoting a specific rawKey to a typed boolean column (e.g. a high-volume admin report filtering by one boolean), THAT would be:
- a new, separate, operator-gated card;
- a single additive migration `supabase/migrations/<UTC-timestamp>_<snake_case>.sql`;
- **additive** (new nullable column), **no backfill** (the rawKey-row data remains the source of truth; the column is a derived projection), **RLS unchanged**;
- reviewed under migration-bearing-card heightened verification.

No such workload exists today. This is documented only to bound the "if you ever need a column" path.

---

## 4. Additive / nullable / no-backfill posture

- Because there is **no DDL** in this chain, the additive/nullable/no-backfill posture is **vacuously satisfied** for boolean storage.
- The schema-version-bump (Builds 2 and 4) is **non-destructive**: it changes a constant; it does not rewrite, drop, or backfill any persisted row. Old rows keep their stored `schema_version`; the adapter's version-match filter handles coexistence.
- RLS is **untouched**. The existing read-only client RLS (`amor_runs_select_via_argument`, `amor_results_select_via_run`) and the no-client-write posture are preserved. MCP writes stay service-role-in-Edge.

---

## 5. MCP-prompt expansion (Builds 2 and 4)

- The MCP server must be taught to answer each new boolean as a crisp yes/no about the move. This is a `mcp-server/**` change (prompt/question-set expansion), not a DB change.
- Each new question must produce a verdict-free, move-level answer (the classifier answers "did the reply do X?", never "is the author X?").
- The new questions ship behind the family's `productionEnabled` posture: Track 2's production-family booleans flow to production once Build 2 lands (their families are already `productionEnabled:true`); HiTODS booleans flow only in `admin_validation` mode (family frozen) until a separate enablement card.

---

## 6. Rollback

- **Track 1 / Build 3 (code-only, no deploy-affecting change):** revert the PR. No data migration to undo; no persisted rows changed. The richer labels simply stop rendering; the existing 1:1 marks remain.
- **Track 2 / Build 4 (schema-version bump + MCP prompts):** revert the PR to restore the prior `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant and remove the new definitions/prompts. Rows written under the bumped version remain in the table harmlessly (the prior-version adapter filter simply won't read them; they are not deleted — consistent with the never-hard-delete posture). Redeploy the prior Edge/MCP-server state. No `ALTER TABLE` to reverse because none was added.
- No rollback touches `public.arguments` or any user content.

---

## 7. Operator step (merge = deploy)

**This design card requires NO operator deploy step** — it is three docs.

When **Build 2** lands (and likewise Build 4's build), the deploy chain applies:
- The Supabase GitHub integration auto-applies migrations and redeploys **config.toml-registered** Edge Functions on merge to main. Since this chain adds **no migration**, there is nothing for the DB-push step to do. The Edge-side definition mirror + any registered classifier function redeploy automatically on merge **if** the touched function is registered in `config.toml`.
- The **MCP server** (`mcp-server/**`) prompt expansion deploys per the MCP server's own deploy path — confirm at Build 2 authoring time whether that is auto-on-merge or an explicit operator step (`mcp-server` deploy), and write the explicit operator line into Build 2's design doc.
- If any new/changed Edge Function directory is **not** registered in `config.toml`, it will silently never deploy (the #509 network_error class). Build 2 must verify registration or add the explicit `npx supabase functions deploy <name> --linked` operator line.

**Operator note for Build 2 (to be restated in Build 2's design):** *"DB push: nothing to apply (no migration). Confirm the classifier Edge function + the MCP server pick up the schema-version bump + new boolean prompts on merge; if the function dir is not config.toml-registered, run `npx supabase functions deploy <name> --linked` explicitly."*

---

## 8. Summary table

| Build | DDL | Schema-version bump | MCP prompts | New family entry | Migration file | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Build 1 (mapping over existing) | No | No | No | No | None | normal |
| Build 2 (new prod booleans) | **No** | Yes (constant) | Yes | No | None | merge=deploy GATE C |
| Build 3 (mapping extension) | No | No | No | No | None | normal |
| Build 4 (HiTODS family) | No | Yes (constant) | Yes | Yes (`productionEnabled:false`) | None | P4 doctrine + GATE C (+ separate enable card) |

**Bottom line: no migration file is authored anywhere in this chain for boolean storage.** The only deploy-affecting changes are code (schema-version constant, definitions, MCP prompts).
