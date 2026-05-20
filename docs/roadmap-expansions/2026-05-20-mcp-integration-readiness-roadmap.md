# CDiscourse — MCP integration-readiness roadmap (2026-05-20)

**Type:** Design-only readiness roadmap. No production code, no implementation, no live services, no provider keys read, no Supabase mutation, no migration, no Edge Function deploy.
**Purpose:** Convert the completed MCP semantic-referee **design slate** into a safe, staged **implementation sequence** — and put structural guardrails in place so a future agent cannot accidentally build live AI too early.

**Companion docs:**
- [`docs/roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md`](2026-05-20-mcp-semantic-referee-roadmap.md) — the originating MCP design roadmap (the slate this readiness pass operationalizes).
- [`docs/designs/MCP-001.md`](../designs/MCP-001.md) — the anchor: `SemanticRefereePacket` / `SemanticBinarySample` contract.
- [`docs/designs/MCP-003.md`](../designs/MCP-003.md), [`MCP-004.md`](../designs/MCP-004.md), [`MCP-008.md`](../designs/MCP-008.md), [`MCP-009.md`](../designs/MCP-009.md), [`MCP-010.md`](../designs/MCP-010.md) — the rest of the design slate.
- [`docs/semantic-prompts/mcp-semantic-referee-prompt-bank.md`](../semantic-prompts/mcp-semantic-referee-prompt-bank.md) — the MCP-002 seed bank.
- [`docs/designs/MCP-011.md`](../designs/MCP-011.md) — the first implementation-readiness card, designed alongside this roadmap.
- [`docs/designs/RULE-006.md`](../designs/RULE-006.md) — the RULE-006 consolidation index produced by this pass.

**Board:** GitHub Project #1.
**Issues filed (new this pass):** MCP-011 (#178), MCP-012 (#179), MCP-013 (#180), MCP-014 (#181), MCP-015 (#182), MCP-016 (#183).
**Issues inspected:** RULE-006 (#116), RULE-007 (#145).

---

## 1. Executive summary

The MCP semantic-referee **design slate is complete**. Seven design cards — MCP-001, MCP-002, MCP-003, MCP-004, MCP-008, MCP-009, MCP-010 — are merged, reviewed `Approve`, and closed. Three proposed cards (MCP-005/006/007) were deduped into existing roadmap work and never filed. The slate locks the packet contract, the prompt seed bank, the referee ledger, the trigger/cost plan, the Edge Function boundary, the banner library, and the override UX.

**What does not yet exist: a single line of MCP implementation code.** Every MCP card to date has been design-only. There is no `src/features/semanticReferee/`, no validator, no fixtures, no ledger adapter, no Edge Function. The risk this readiness pass addresses is the gap between "the design is done" and "someone builds the wrong thing first" — specifically, building a live provider call before the safe deterministic foundation, the strict packet validator, and the mock-default boundary exist.

This roadmap files **six implementation cards (MCP-011 … MCP-016)** and orders them so that:

1. the **pure-TypeScript, fixture-only foundation** is built first (MCP-011) — types, a strict packet validator, an adversarial fixture set, a cache-key helper — with zero network and zero Edge Function;
2. the **pure-TS consumers** (the router MCP-012, the ledger MCP-013) are built second, against a proven contract;
3. the **server boundary** (MCP-016) is built third, in **mock mode only**, with no provider key;
4. the **presentation layer** (banners MCP-014, override UX MCP-015) is built last;
5. the **live-provider pilot is a separate, explicitly operator-approved card that is deliberately NOT filed here.**

No card in this roadmap calls a live provider. The mock provider is the default at every layer. Live AI is gated behind an operator decision, an Edge Function deploy, and a feature flag — all of which stay outside the agent build loop.

## 2. Verified MCP state

Verified against GitHub issues, `docs/designs/`, `docs/reviews/`, and git history on `main` (HEAD `54b017c`).

### 2.1 Completed MCP design cards (all merged + `Approve` + closed)

| Card | Issue | Design doc | Review verdict | What it locked |
|---|---|---|---|---|
| **MCP-001** | [#154](https://github.com/kyleruff1/cDiscourse/issues/154) | `docs/designs/MCP-001.md` | merged (`579e889`) | `SemanticRefereePacket` / `SemanticBinarySample` contract; the 23-id catalog v0; 3-layer architecture |
| **MCP-002** | [#155](https://github.com/kyleruff1/cDiscourse/issues/155) | `docs/semantic-prompts/mcp-semantic-referee-prompt-bank.md` | merged (`579e889`) | the 90-seed prompt-library bank; `promptVersion` `mcp-semantic-referee-prompt-v0` |
| **MCP-003** | [#156](https://github.com/kyleruff1/cDiscourse/issues/156) | `docs/designs/MCP-003.md` | `Approve` (`a5a1b26`) | the deterministic referee ledger; 14 point categories; reconciliation rules |
| **MCP-004** | [#157](https://github.com/kyleruff1/cDiscourse/issues/157) | `docs/designs/MCP-004.md` | `Approve` (`7006dcc`) | trigger gates, caching, batching (≤5/call), retry, token budget |
| **MCP-008** | [#158](https://github.com/kyleruff1/cDiscourse/issues/158) | `docs/designs/MCP-008.md` | `Approve` (`docs/reviews/MCP-008.md`) | the ≥100-string referee banner library; tone bands |
| **MCP-009** | [#159](https://github.com/kyleruff1/cDiscourse/issues/159) | `docs/designs/MCP-009.md` | `Approve` (`9aaa2d1`) | the `semantic-referee` Edge Function boundary; mock-default registry |
| **MCP-010** | [#160](https://github.com/kyleruff1/cDiscourse/issues/160) | `docs/designs/MCP-010.md` | `Approve` (`d3a593c`) | the semantic override / appeal UX; `semantic_override` metadata event |

**MCP-005 / MCP-006 / MCP-007 were never filed** — deduped into GAME-003 (#119), BR-003/BR-004/GAME-005/GAME-006, and RULE-004 (#114) respectively (see the originating roadmap §10). The MCP-** numbering gaps at 005/006/007 are intentional and documented.

### 2.2 What is NOT done

- **No MCP implementation card existed before this pass.** Every MCP card to date is design-only.
- **No `src/features/semanticReferee/` directory exists.** Verified: the path is absent on `main`.
- **No semantic test files exist.** Verified: `__tests__/` has zero `semantic*` files.
- **BR-004 already hit the missing-foundation problem.** `docs/current-status.md` records that BR-004's implementer had to define `SemanticOverrideLane` as a *local mirror* because "MCP-010 (#165) is a design-only card — no `SemanticOverrideLane` exists in `src/`." That local mirror is live drift pressure: the MCP foundation types do not exist, so downstream cards are forced to copy them. This is concrete evidence that the foundation card (MCP-011) is overdue.

### 2.3 Open issues inspected

| Issue | State | Disposition |
|---|---|---|
| **RULE-006** [#116](https://github.com/kyleruff1/cDiscourse/issues/116) | Open, Todo/Backlog, Release 6.7 | **Superseded by the MCP slate.** See §3. Recommendation: consolidate + close. |
| **RULE-007** [#145](https://github.com/kyleruff1/cDiscourse/issues/145) | Open, Release 6.6 | **Adjacent, not MCP.** RULE-007 owns the doctrine decision on resolution / who-is-right language and the user-facing winner outcome. Every MCP design doc explicitly defers the winner/resolution surface to RULE-007 / GAME-007. No MCP card touches it; no action required from this pass beyond noting the boundary. |

No other open issue is obsoleted, blocked, or made ready by the MCP slate.

## 3. RULE-006 disposition — recommendation

**RULE-006 (#116) is superseded by the MCP-001 … MCP-010 family.** RULE-006 asked the research question *whether and how* CDiscourse should use a semantic AI metadata layer; the MCP slate answered *how*, in a more specific and more doctrine-hardened form (binary `0/1` classifiers, bounded enums, `authoritative: false`, mock-default, operator-gated).

Every RULE-006 acceptance criterion is now satisfied by an MCP doc — **except one**: RULE-006's named deliverable is the file `docs/designs/RULE-006.md`, which was never written (the #116 comment thread says so explicitly: "The RULE-006 deliverable `docs/designs/RULE-006.md` is **not** written; `docs/designs/MCP-001.md` carries that design intent").

| RULE-006 acceptance criterion | Satisfied by |
|---|---|
| Master design doc `docs/designs/RULE-006.md` produced | **This pass** — produced as a consolidation index (Option B below). |
| Cost-control plan documented | MCP-004 (trigger gates, caching, batching, token budget). |
| Prompt + schema + version-tracking plan documented | MCP-001 §7 (schema), §18 (versioning); MCP-002 seed bank. |
| Mocked test plan documented | MCP-001 §19; MCP-003 §15; MCP-004, MCP-008, MCP-009, MCP-010 test plans. |
| Manual override flow documented | MCP-010. |
| "AI does not decide who is right; ordinary posts are not blocked solely by semantic AI" | Stated in every MCP doc's doctrine section. |
| Provider-choice operator decision flagged | MCP-001 §23.1; MCP-009 operator decisions. |
| Doctrine self-check completed | Every MCP doc carries one. |

**Three options were considered:**

- **A — close-as-superseded with a comment.** Clean, but leaves RULE-006's literally-named deliverable (`docs/designs/RULE-006.md`) unwritten forever, and leaves a dangling acceptance criterion.
- **B — short consolidation doc, then close. ✅ RECOMMENDED.** Write `docs/designs/RULE-006.md` as a thin **index** that maps each RULE-006 acceptance criterion to the MCP doc that satisfies it. It adds **no new architecture and no duplicate prompt library** — it points at the MCP slate. This satisfies the last open acceptance criterion, gives the operator a clean audit trail, and makes the close decision unambiguous.
- **C — keep open.** Rejected: RULE-006 has no unique scope the MCP slate does not cover.

**Recommendation: Option B.** `docs/designs/RULE-006.md` is produced by this pass as a consolidation index. It recommends the operator **close RULE-006 (#116) as superseded** once they accept the consolidation. This roadmap does **not** close the issue automatically — a GitHub comment on #116 links the consolidation doc and this roadmap and leaves the close action to the operator.

## 4. The implementation card slate (MCP-011 … MCP-016)

Six implementation cards, all Release 6.8, all `epic:rules-ux`, all filed on Project #1.

| Card | Issue | Title | Priority | Effort | First-pass kind |
|---|---|---|---|---|---|
| **MCP-011** | [#178](https://github.com/kyleruff1/cDiscourse/issues/178) | Mock semantic-referee packet validator and fixture provider | P1 | M | Pure TS + fixtures. No network, no Edge Function. |
| **MCP-012** | [#179](https://github.com/kyleruff1/cDiscourse/issues/179) | Semantic call router implementation (mock-only) | P1 | M | Pure TS. No network, no Edge Function. |
| **MCP-013** | [#180](https://github.com/kyleruff1/cDiscourse/issues/180) | Referee ledger adapter (deterministic + mock semantic) | P1 | M–L | Pure TS. No network. |
| **MCP-014** | [#181](https://github.com/kyleruff1/cDiscourse/issues/181) | Referee banner library implementation | P2 | M | Pure TS + thin component. No network. |
| **MCP-015** | [#182](https://github.com/kyleruff1/cDiscourse/issues/182) | Semantic override UX model (no live provider) | P2 | M | Pure TS + thin component. No network. |
| **MCP-016** | [#183](https://github.com/kyleruff1/cDiscourse/issues/183) | Edge Function mock boundary scaffold | P2 | M | Edge Function — **mock mode only, no provider key.** |

**The live-provider pilot is intentionally NOT in this slate.** It is a separate, explicitly operator-approved card that is filed only after MCP-011 … MCP-016 land and the operator confirms the provider strategy (§7, §9). Filing it now would invite an agent to build it.

### 4.1 First implementation-ready card

**MCP-011 — Mock semantic-referee packet validator and fixture provider.** It is the smallest, safest, most foundational card: pure TypeScript, fixture-only, zero network, zero Edge Function, zero provider, zero user-facing UI. Its detailed design doc — [`docs/designs/MCP-011.md`](../designs/MCP-011.md) — is produced alongside this roadmap. It is ready to enter the standard Design → Build → Review pipeline immediately; its design phase is complete.

## 5. Smallest safe implementation order

The cards are ordered so each is built against a contract the previous card already proved, and so the first card that introduces a server component (MCP-016) is built last among the structural cards and runs only on the mock provider.

```
   Phase A — pure-TS foundation (no network, no Edge Function)
   ┌────────────────────────────────────────────────┐
   │ MCP-011  types · strict validator · fixtures ·  │
   │          cache-key helper                      │
   └───────────────┬────────────────────────────────┘
                   │  (canonical src/features/semanticReferee/ contract)
        ┌──────────┼───────────────────────┐
        ▼          ▼                       ▼
   Phase B — pure-TS consumers (no network)
   ┌──────────────────┐   ┌────────────────────────────┐
   │ MCP-012  router  │   │ MCP-013  referee ledger     │
   │ trigger gates,   │   │ adapter (consumes mock      │
   │ batching, cache  │   │ packets + point-standing)   │
   └──────────────────┘   └───────────┬────────────────┘
                   │                  │
                   ▼                  │
   Phase C — server boundary (MOCK ONLY, no provider key)
   ┌────────────────────────────────────────────────┐
   │ MCP-016  semantic-referee Edge Function —       │
   │          mock + fixture providers wired;        │
   │          anthropic / mcp slots stubbed off      │
   └────────────────────────────────────────────────┘
                   │                  │
                   ▼                  ▼
   Phase D — presentation / UX (no network)
   ┌──────────────────┐   ┌────────────────────────────┐
   │ MCP-014  banners │   │ MCP-015  override UX model  │
   └──────────────────┘   └────────────────────────────┘
                   │
                   ▼
   Phase E — live-provider pilot  ✋ SEPARATE OPERATOR-APPROVED CARD
             (NOT filed here — see §7, §9)
```

**Critical path:** MCP-011 → MCP-013 → (MCP-014 ∥ MCP-015). MCP-012 and MCP-016 can run in parallel with MCP-013 once MCP-011 lands.

**Recommended cadence:** MCP-011 first (design complete — go straight to Build). Then MCP-012 and MCP-013 in parallel. Then MCP-016. Then MCP-014 and MCP-015. Each card runs the standard `roadmap-designer` → `roadmap-implementer` → `roadmap-reviewer` loop; MCP-011's designer step is already done by this pass.

### 5.1 Why MCP-016 (the Edge Function) is built third, not first

The Edge Function is the only card that introduces a server component and the only place a live provider could ever physically be wired. Building it **after** the pure-TS validator (MCP-011) and the pure-TS consumers means:

- the boundary is built against a contract that already has a strict, adversarially-tested validator;
- the boundary's outbound schema can be proven equivalent to MCP-011's Node-side validator (a parity test);
- the boundary is wired **mock-only** — the `anthropic` / `mcp` provider slots are present but stubbed to `{ enabled: false, reason: 'not_configured' }`; turning them on is the separate Phase-E pilot card.

There is never a point in Phases A–D where an agent is one edit away from a live call.

## 6. File-surface ownership map (`src/features/semanticReferee/`)

The MCP-004 and MCP-009 design docs both proposed files under `src/features/semanticReferee/` using **placeholder names** (`types.ts`, `semanticCache.ts`) written before a foundation card existed. To prevent two cards minting divergent type files, **MCP-011 is the foundation owner** of that directory. Later cards **consume** MCP-011's modules; they do not re-create them.

| File | Owner card | Consumed by |
|---|---|---|
| `src/features/semanticReferee/semanticRefereeTypes.ts` | **MCP-011** | MCP-012, MCP-013, MCP-014, MCP-015, MCP-016 |
| `src/features/semanticReferee/semanticRefereeValidator.ts` | **MCP-011** | MCP-013, MCP-016 |
| `src/features/semanticReferee/semanticRefereeFixtures.ts` | **MCP-011** | MCP-012, MCP-013, MCP-014, MCP-015, MCP-016 (tests) |
| `src/features/semanticReferee/semanticRefereeCacheKey.ts` | **MCP-011** | MCP-012 (its `semanticCache.ts` imports the key helper) |
| `src/features/semanticReferee/index.ts` | **MCP-011** (created), extended additively by later cards | all |
| `src/features/semanticReferee/triggerGates.ts` · `classifierBatching.ts` · `semanticCache.ts` (store) · `tokenBudget.ts` · `retryPolicy.ts` | **MCP-012** | MCP-016 |
| `src/features/refereeLedger/*` | **MCP-013** | MCP-014, MCP-015 |
| `src/features/refereeBanners/*` | **MCP-014** | — |
| `src/features/semanticOverride/*` | **MCP-015** | — |
| `supabase/functions/semantic-referee/*` · `supabase/functions/_shared/semanticReferee/*` | **MCP-016** | — |

**Two reconciliations the implementation cards must honor (not a redesign — a naming alignment):**

1. **`types.ts` → `semanticRefereeTypes.ts`.** MCP-009's design names the Node mirror `src/features/semanticReferee/types.ts`. MCP-011 owns it as `semanticRefereeTypes.ts`. MCP-016 (which implements MCP-009) imports MCP-011's `semanticRefereeTypes.ts` for the Node side and keeps the Deno-side `supabase/functions/_shared/semanticReferee/types.ts` as a documented mirror with a parity test. MCP-016 does **not** create a second Node `types.ts`.
2. **`semanticCache.ts` cache key → `semanticRefereeCacheKey.ts`.** MCP-004's design puts both the cache *key* and the in-memory *store* in `semanticCache.ts`. MCP-011 owns the **key** (`semanticRefereeCacheKey.ts`); MCP-012's `semanticCache.ts` owns only the in-memory **store** and imports the key helper from MCP-011. This shrinks MCP-012's surface and removes the duplication.

These are documented so the MCP-012 / MCP-016 `roadmap-designer` passes apply them rather than re-deriving divergent files. See [`docs/designs/MCP-011.md`](../designs/MCP-011.md) §6 for the full MCP-011 footprint and §11 for the cache-key reconciliation detail.

## 7. What must stay operator-gated

Nothing in MCP-011 … MCP-016 calls a live provider. The following are **structurally outside the agent build loop** and require an explicit operator action:

- **The live-provider pilot card.** Not filed in this roadmap. The operator files it only after MCP-011 … MCP-016 land and the provider strategy is confirmed.
- **The provider choice itself** — MCP-hosted vs Anthropic-via-Edge-Function vs provider-agnostic-no-default (MCP-001 §23.1, MCP-009 operator decisions).
- **`SEMANTIC_REFEREE_ENABLED`** — the feature flag. Until the operator runs `npx supabase secrets set SEMANTIC_REFEREE_ENABLED=true`, the boundary returns `{ enabled: false }` and every consumer falls back to deterministic layer 1.
- **`SEMANTIC_REFEREE_PROVIDER`** — defaults to `mock`. Even with the flag on, an unset provider picks `mock`, never a live provider (MCP-009 §"Provider registry").
- **Any Edge Function deploy** — `npx supabase functions deploy semantic-referee --linked`. Claude never deploys; the operator runs it.
- **Any provider key** — `ANTHROPIC_API_KEY`, `SEMANTIC_REFEREE_MCP_TOKEN`, etc. Read only via `Deno.env.get()` inside the deployed function; never in `app/` / `src/` / git / `.env`.
- **Per-room enablement** — GAME-003's `semanticClassification` mode (`off` / `metadata_only` / `metadata_and_chip`); a room set to `off` makes zero calls.

The mock provider is the default at every layer. A reviewer who sees a live provider call, a provider key read, or an Edge Function deploy step in any of MCP-011 … MCP-016 must **block the card** — that work belongs to the separate Phase-E pilot.

## 8. Tests and safety scans every MCP implementation card must include

This is the shared "definition of done" checklist. Every `roadmap-reviewer` pass on an MCP implementation card verifies all of it.

### 8.1 Tests (mock/fixture-driven — no test makes a live call)

- **Happy-path + failure-case unit tests for every public function** of every new pure-TS model (`test-discipline` bar for `src/features/<x>/`).
- **A doctrine ban-list test** scanning every produced user-reachable string and every internal reason/feedback/banner code for verdict + person tokens: `winner · loser · won · lost · right · wrong · true · false · correct · incorrect · proven · defeated · liar · lying · dishonest · bad faith · manipulative · troll · propagandist · extremist · stupid · idiot · dumb · smart`.
- **A forbidden-imports test** asserting the pure-TS model imports nothing from Supabase, React, a provider SDK, or a network library.
- **A no-live-call test** asserting the mock provider is the default and no code path reaches a network call (assert via an injected provider spy where a provider seam exists).
- **A plain-language-coverage test** for any card that adds a `gameCopy` code: every new code maps through `toPlainLanguage`; no `snake_case` leak.
- **Edge Function cards additionally** (MCP-016): disabled-by-default path, auth-refused path, invalid-input path, mock-provider-default path, outbound-schema rejects-`authoritative:true` path.

### 8.2 Safety scans (run on the diff, before commit)

- `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` → **zero matches** (a source-scan test enforces it).
- Secret-shape scan on the diff — no `sk-ant-*` / `xai-*` / `sb_secret_*` / JWT-shape / `Bearer ` / `Authorization:` literals.
- X-shape scan — no `x.com/.../status` / `twitter.com/.../status` / `t.co/` literals.
- Verdict-token scan — every hit is inside a ban-list definition or a doctrine clause, never a UI string.
- Forbidden-path scan — no `.env*`, `logs/`, `artifacts/diagnostics/`, `node_modules`, `.expo` staged.
- No `.skip` / `.only` / `xit` / `xdescribe`; no committed `console.log`.

### 8.3 Verification gates

`npm run skills:validate`, `npm run typecheck`, `npm run lint`, `npm run test` — all clean. Test count rises; `docs/current-status.md` updated with the new count.

## 9. Operator decisions

Carried forward from MCP-001 §23 / MCP-009 / the originating roadmap §14, plus new ones from this pass:

1. **Live-provider strategy.** MCP-hosted vs Anthropic-via-Edge-Function vs provider-agnostic-no-default. Recommendation (unchanged): provider-agnostic, `mock` default, live provider chosen only at the separate Phase-E pilot card. **No decision is needed to start MCP-011 … MCP-016** — they are all mock-default.
2. **RULE-006 disposition.** Recommendation: accept the `docs/designs/RULE-006.md` consolidation index produced this pass and **close RULE-006 (#116) as superseded.** This pass does not close it automatically.
3. **Whether MCP-011 proceeds to Build now.** Its design is complete (`docs/designs/MCP-011.md`). Recommendation: yes — it is pure-TS, fixture-only, and unblocks every other MCP card.
4. **Cache-key shape.** MCP-011's `SemanticCacheKey` refines MCP-004's tuple — it keeps `roomId` for MCP-004 compatibility and adds `roomMode` + `selectedAction` (prompt inputs MCP-004's key omitted) and a `classifierSetHash`. Recommendation: accept the superset. If the operator wants the MCP-004 tuple verbatim, that is a one-field edit in MCP-011's design — flagged, not assumed. See MCP-011 §11.
5. **Per-packet token budget number** (`SEMANTIC_PACKET_TOKEN_BUDGET`, MCP-004 recommended 1,500) — still open; needed only at MCP-012/MCP-016, not MCP-011.
6. **Scoreboard framing word** — "referee" / "moderator" / "scorekeeper" / "coach". Affects MCP-013/MCP-014 copy only; the docs use "referee" as a placeholder.
7. **Epic label.** All MCP cards stay under `epic:rules-ux` (the safe default). Creating a dedicated `epic:mcp-semantic` option is a one-line Project field edit if the operator prefers it.

## 10. What not to build yet

- **No live Anthropic / xAI / OpenAI / MCP provider call** from anything in MCP-011 … MCP-016. The live pilot is a separate operator-approved card.
- **No client-side AI call, ever.**
- **No MCP server started, hosted, or scaffolded.** MCP-016 builds the Edge Function in mock mode; the `mcp` provider slot is stubbed off.
- **No provider key read**, no `.env*` edit, no service-role introduction, no direct `public.arguments` insert.
- **No migration.** None of MCP-011 … MCP-016 needs one — the v0 cache is in-memory (MCP-004 §"Data model"), the ledger is in-memory (MCP-003 §10), the override record is in-memory (MCP-010 §4).
- **No winner / resolution / who-is-right surface** — that is RULE-007 / GAME-007, doctrine-gated and separate.
- **No new dependency** — `zod@4` is already a dependency and may be reused; nothing else is added.

## 11. Doctrine hard lines (restated — binding on every MCP implementation card)

- AI never decides who is right.
- AI never declares a winner or loser.
- AI never decides truth or falsity.
- AI never labels a person.
- AI never blocks ordinary posting by itself — only deterministic structural validation blocks.
- AI never runs on the client — provider calls live only in an Edge Function.
- Live provider calls are operator-gated; the mock provider is the default.
- Tests use fixtures, not live calls.
- No service-role in client code; no direct insert into `public.arguments`.
- No `.env*` touched.
- Popularity / virality / heat are not evidence; engagement credit and factual-standing credit stay on separate axes.
- Feedback describes the move, point, branch, evidence, source-chain, or game state — never the person.
- `authoritative` is the literal `false` on every packet and every binary sample.

## 12. Next recommended card

**MCP-011 — Mock semantic-referee packet validator and fixture provider** ([#178](https://github.com/kyleruff1/cDiscourse/issues/178)).

Its design is complete: [`docs/designs/MCP-011.md`](../designs/MCP-011.md). It is pure TypeScript, fixture-only, makes no live call, adds no Edge Function, and unblocks every other MCP card. Recommend it proceeds straight to **Build**:

```powershell
.\.claude\scripts\spawn-card.ps1 MCP-011 -Phase Build
```

Then MCP-012 and MCP-013 in parallel, then MCP-016, then MCP-014 and MCP-015. The live-provider pilot is filed by the operator only after all six land.

**Ready for operator review — no implementation performed, no live API call made, no `.env*` read, no Supabase mutation.**
