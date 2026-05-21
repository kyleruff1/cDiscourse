# GAME-003 — Argument mode setup for 1v1 PvP (design + 4 templates)

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (game-rules / mode layer)
**Release:** Roadmap (filed by the 2026-05-19 product audit; runner-suitable as design + 4-template card; depends on GAME-002 / RULE-004 / RULE-005 / BR-003 / RULE-006 — all merged)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/119

---

## Goal (one paragraph)

GAME-003 introduces **argument modes** — a consented, visible strictness profile that
both parties choose at room setup before a 1v1 PvP argument becomes interactive. A
mode bundles a small set of room-rule fields (tone strictness, evidence strictness,
turn pacing, allowed informality, branch encouragement, source-request centrality,
synthesis expectation, permanent-record warning, semantic-classification level,
cooldown, observer access, invite-only) plus an optional plain-language disclaimer.
Modes let a "court of law" room be strict and a "friends arguing" room stay loose and
forgiving of slang and "you had to be there" context — *without ever declaring a
winner*. The doctrine that shapes the whole design: **a mode is a consented room
rule, never a verdict; it can change friction, never truth; and it must never block
posting on its own** (validation blocks, modes never do). The mode `semanticClassification`
field defaults to `'off'` — the safe default consistent with the MCP-012…MCP-016
semantic-referee fail-closed posture. v1 ships **the pure-TS model + 4 MVP mode
templates as data + 9 design-only stubs + 3 test files + this design doc**. The mode
**setup screen** is fully documented here but its component implementation is a named
follow-up card — the issue's acceptance criteria explicitly permit this split
("Mode setup screen design documented; first implementation may be a future card").

---

## Scope split (read first — resolved, do not re-litigate)

This card has a deliberate two-part split. The implementer ships **part A only**; part B
is a named follow-up.

**Part A — BUILD this card (the implementer's deliverable):**
1. Pure-TS model `src/features/modes/argumentModeModel.ts` — `ArgumentMode` enum (13 modes),
   `ArgumentModeDefinition` type, `ArgumentModeTemplate` wrapper type, the 4 MVP template
   definitions as fully-specified data, the 9 design-only stub definitions with
   `status: 'design_only'`, and the public accessor functions.
2. Barrel export additions in `src/features/modes/index.ts`.
3. Copy block `ARGUMENT_MODE_COPY` added to `src/features/arguments/gameCopy.ts`
   (mode display names, one-line descriptions, disclaimers, helper strings).
4. 3 test files: `argumentModeModel.test.ts`, `argumentModeBanList.test.ts`,
   `argumentModeNoLegalAdvice.test.ts`.
5. This design doc.

**Part B — DOCUMENTED here, NOT built this card (named follow-up card "GAME-003B —
Argument mode setup screen"):**
- `ModeSetupScreen.tsx` (the two-column compare + both-parties-accept gate component).
- `useModeSetup.ts` hook.
- DB persistence of the chosen mode (the issue's Non-scope explicitly defers this).
- Wiring `pacingRule` / `semanticClassification` / `allowedInformality` into the live
  composer/dock/PreSendReviewSheet (the consuming surfaces already accept these as
  forward-compat parameters per their designs — see "Dependencies").

The setup-screen section below (§"Mode setup screen design") is a complete spec so the
follow-up card needs no redesign.

---

## Pre-flight findings (repo reality check)

1. **`src/features/modes/` already exists.** GAME-002 created it and shipped
   `pacingModel.ts` + `PacingChip.tsx` + `index.ts`. GAME-003 ADDS `argumentModeModel.ts`
   to that directory — it does not create the directory and does not modify
   `pacingModel.ts`.
2. **`PacingRule` is real and must be consumed, not re-invented.** `pacingModel.ts`
   exports `PacingRule`, `DEFAULT_CASUAL_PACING_RULE`, and `createPacingRule(partial?)`.
   The `ArgumentModeDefinition.pacing` field is exactly `PacingRule`. Every mode template
   builds its `pacing` value via `createPacingRule(...)` — never an object literal — so
   clamping / freezing stays centralized. `PacingRule` itself carries a
   `permanentRecordWarning: 'on' | 'off'` field; see §"Edge cases" #7 for how
   `ArgumentModeDefinition.permanentRecordWarning` reconciles with it.
3. **`semanticClassification`'s union already exists.** MCP-012's
   `triggerGates.ts` declares `SemanticClassificationMode = 'off' | 'metadata_only' |
   'metadata_and_chip'` and its doc comment says *"GAME-003 owns the canonical type."*
   GAME-003 therefore DEFINES the canonical `SemanticClassificationMode` in
   `argumentModeModel.ts` and re-exports it; MCP-012 keeps its local copy for now
   (changing MCP-012's import is out of scope — the values are identical and the gate
   logic `off → no call` is stable regardless). This is noted so the implementer does
   not try to delete MCP-012's local type.
4. **`ReviewMode` / `ChannelSuggestionMode` are `'casual' | 'strict'` placeholders.**
   RULE-004 (`preSendReviewModel.ts`) and RULE-005 (`channelModel.ts`) both already
   carry a `mode` parameter typed `'casual' | 'strict'` and documented "v1: always
   'casual'. Stable for GAME-003." GAME-003 does NOT change those signatures or those
   types this card — wiring the real mode into them is part B. The mapping from
   `ArgumentModeDefinition.allowedInformality` to that `'casual' | 'strict'` value is
   specified in §"API / interface contracts" so part B is mechanical.
5. **No existing `ArgumentMode` type, no `argumentModeModel.ts`.** A repo search for
   `ArgumentMode` returns only this card's references in MCP docs and `pacingModel.ts`
   comments. No collision.

---

## Data model

All types live in `src/features/modes/argumentModeModel.ts`. Pure TypeScript — no React,
no Supabase, no network. No DB table, no migration (persistence is part B / a later card).

### `ArgumentMode` — the 13-mode enum

```ts
/**
 * GAME-003 — the closed vocabulary of argument modes. 4 ship as live
 * templates this card; 9 ship as design-only stubs. The string values are
 * stable identifiers — they will become the persisted `debates.mode`
 * column value in a later card, so they must never change.
 */
export type ArgumentMode =
  | 'casual_disagreement'      // friends arguing                       — MVP template
  | 'court_record_strict'      // court-of-record strictness            — MVP template
  | 'internet_fact_check'      // claim-by-claim source check           — MVP template
  | 'debate_club'              // structured formal debate              — MVP template
  | 'domestic_bickering'       // household dispute                     — design_only
  | 'co_parenting_custody'     // co-parenting dispute (non-legal)      — design_only + disclaimer
  | 'political_debate'         // political-issue argument              — design_only
  | 'historical_debate'        // disputed historical question          — design_only
  | 'recollection_disconnect'  // "you had to be there" memory clash    — design_only
  | 'workplace_decision'       // workplace decision dispute            — design_only
  | 'research_evidence_review' // evidence-review / lit-review style     — design_only
  | 'relationship_repair'      // relationship dispute (non-therapy)    — design_only + disclaimer
  | 'negotiation_tradeoff';    // negotiation / trade-off framing        — design_only

/** Frozen ordered list of every mode. Tests iterate this. */
export const ALL_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> = Object.freeze([
  'casual_disagreement',
  'court_record_strict',
  'internet_fact_check',
  'debate_club',
  'domestic_bickering',
  'co_parenting_custody',
  'political_debate',
  'historical_debate',
  'recollection_disconnect',
  'workplace_decision',
  'research_evidence_review',
  'relationship_repair',
  'negotiation_tradeoff',
]);

/** The 4 modes that ship as live, fully-specified templates this card. */
export const MVP_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> = Object.freeze([
  'casual_disagreement',
  'court_record_strict',
  'internet_fact_check',
  'debate_club',
]);

/** The 9 modes that ship as design-only stubs this card. */
export const DESIGN_ONLY_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> = Object.freeze([
  'domestic_bickering',
  'co_parenting_custody',
  'political_debate',
  'historical_debate',
  'recollection_disconnect',
  'workplace_decision',
  'research_evidence_review',
  'relationship_repair',
  'negotiation_tradeoff',
]);

/**
 * The default mode for a brand-new 1v1 PvP room. Doctrine: the gentlest,
 * lowest-friction mode is the default — false positives are catastrophic in
 * casual modes, so the safe default is the most forgiving one.
 */
export const DEFAULT_ARGUMENT_MODE: ArgumentMode = 'casual_disagreement';
```

### `SemanticClassificationMode` — canonical here (re-used by MCP-012)

```ts
/**
 * GAME-003 owns the canonical semantic-classification level. 'off' is the
 * fail-closed default — consistent with the MCP-012…MCP-016 semantic-referee
 * posture. MCP-012's triggerGates.ts keeps a local copy with identical
 * values; reconciling the import is out of this card's scope.
 *
 *  - 'off'               — no semantic-referee call originates from this room.
 *  - 'metadata_only'     — semantic referee may run; its output is advisory
 *                          metadata only, never surfaced as a chip.
 *  - 'metadata_and_chip' — semantic referee may run; its advisory output may
 *                          additionally render as a non-blocking chip.
 */
export type SemanticClassificationMode = 'off' | 'metadata_only' | 'metadata_and_chip';
```

### `ArgumentModeDefinition` — the per-mode design fields

This is exactly the issue's field list. Every field is `Readonly`; the whole object is
`Object.freeze`d.

```ts
/**
 * GAME-003 — the consented room-rule profile for one argument mode. Both
 * parties see and accept this (rendered in plain language) at room setup.
 * Immutable once a room is created. NEVER produces a winner/loser; NEVER
 * blocks a post on its own (validation blocks, modes do not).
 */
export type ArgumentModeDefinition = Readonly<{
  /** How strict tone expectations are. Affects helper copy only, never a block. */
  toneStrictness: 'loose' | 'normal' | 'strict';
  /** How strict source/evidence expectations are. Advisory strength, never a block. */
  evidenceStrictness: 'loose' | 'normal' | 'strict';
  /** GAME-002 turn-pacing rule. Built via createPacingRule() — see §pre-flight #2. */
  pacing: PacingRule;
  /** How permissive of slang / informal / "you had to be there" speech. */
  allowedInformality: 'permissive' | 'normal' | 'restricted';
  /** When true, side branches (BR-003) are encouraged rather than discouraged. */
  branchesEncouraged: boolean;
  /** When true, asking for a source is a first-class, foregrounded move. */
  sourceRequestsCentral: boolean;
  /** When true, the room nudges toward an explicit synthesis at the end. */
  finalSynthesisExpected: boolean;
  /** Mirrors a 'permanent record' advisory toggle (see §edge cases #7). */
  permanentRecordWarning: 'on' | 'off';
  /** Semantic-AI gating level — gates RULE-006 / MCP-012. Default 'off'. */
  semanticClassification: SemanticClassificationMode;
  /** When true, the room's PacingRule carries a non-zero cooldown. */
  cooldownEnabled: boolean;
  /** When true, observers may watch the room (Stage 6.4 observer model). */
  observerModeAllowed: boolean;
  /** When true, the room is invite-only (no public/gallery seat). */
  inviteOnly: boolean;
  /**
   * Optional plain-language NON-legal / NON-therapy / NON-medical disclaimer.
   * Present on sensitive modes. NEVER contains advice; only states the app
   * gives none. Read from ARGUMENT_MODE_COPY — never authored inline.
   */
  disclaimer?: string;
}>;
```

### `ArgumentModeTemplate` — the wrapper that distinguishes shipped vs stub

The issue requires that the 9 non-MVP modes "ship as design-only stubs (`status:
'design_only'`) so the runner does not paper over the missing fields." A stub still has
a *fully-typed* `definition` — "design-only" means **not yet selectable in the live
setup screen**, not "fields are missing." The status flag is what the setup screen and
the runner read to decide selectability.

```ts
/** Whether a mode is live-selectable or a documented-only stub. */
export type ArgumentModeStatus = 'shipped' | 'design_only';

/**
 * The full record for one mode: its stable id, its lifecycle status, its
 * (always fully-typed) definition, and whether it is a sensitive mode that
 * MUST carry a disclaimer.
 */
export type ArgumentModeTemplate = Readonly<{
  mode: ArgumentMode;
  /** 'shipped' = the 4 MVP modes; 'design_only' = the other 9. */
  status: ArgumentModeStatus;
  /**
   * True for modes whose subject matter touches legal / custody / therapy /
   * relationship territory. A sensitive mode MUST have a non-empty
   * `definition.disclaimer`. Enforced by argumentModeNoLegalAdvice.test.ts.
   */
  sensitive: boolean;
  /** The complete, fully-typed per-mode design fields. */
  definition: ArgumentModeDefinition;
}>;
```

> **Why `status` lives on the wrapper, not inside `ArgumentModeDefinition`:** the issue's
> field list for `ArgumentModeDefinition` is closed and does not include `status`. A
> stub's *definition* is complete and real — it is the *template* that is design-only.
> Keeping `status` on `ArgumentModeTemplate` keeps `ArgumentModeDefinition` byte-identical
> to the issue spec and means the 9 stubs are not "papered over" — every field has a
> doctrine-justified value, the template is simply flagged not-yet-selectable.

### No new data model beyond the above

No SQL, no migration, no table this card. Persisting the chosen mode on `debates` is
explicitly deferred by the issue's Non-scope and is a later card.

---

## File changes

**New files (Part A — built this card):**

- `src/features/modes/argumentModeModel.ts` — the whole model: enum, types, 4 MVP
  template definitions, 9 stub definitions, accessor functions, ban-list helper.
  **~360–420 lines** (13 mode definitions are the bulk; each is ~14 field lines plus a
  doctrine-justifying comment).
- `__tests__/argumentModeModel.test.ts` — shape + accessor + determinism tests.
  **~180–230 lines.**
- `__tests__/argumentModeBanList.test.ts` — verdict / amplification / person-token scan
  across every mode label, description, helper, and disclaimer. **~90–120 lines.**
- `__tests__/argumentModeNoLegalAdvice.test.ts` — sensitive-mode disclaimer presence +
  no-advice-token assertions. **~90–120 lines.**

**Modified files (Part A — built this card):**

- `src/features/modes/index.ts` — add the `argumentModeModel` type + function re-exports
  to the existing barrel. **~+20 lines.** Existing pacing exports unchanged.
- `src/features/arguments/gameCopy.ts` — add a frozen `ARGUMENT_MODE_COPY` block (mode
  display names, one-line plain-language descriptions, the disclaimers, the rules-row
  helper strings) and register it in `ALL_COPY`. **~+70–90 lines.** No existing copy
  block changes.

**Deleted files:** none.

**Named follow-up files (Part B — NOT this card; listed so scope is unambiguous):**

- `src/features/modes/ModeSetupScreen.tsx` — the two-column compare + accept-gate component.
- `src/features/modes/ModeRulesColumn.tsx` — the "the rules" rendered-rules column piece.
- `src/features/modes/useModeSetup.ts` — the accept-state hook.
- A migration adding `debates.mode text` + the related RLS — a later card.
- Edits wiring `pacing` / `semanticClassification` / `allowedInformality` into the live
  composer/dock/PreSendReviewSheet — a later card.

---

## API / interface contracts

All exported from `src/features/modes/argumentModeModel.ts` and re-exported via
`src/features/modes/index.ts`.

### Accessors

```ts
/**
 * The frozen registry of all 13 mode templates, keyed by mode id. The
 * single source of truth — every other accessor reads from this.
 */
export const ARGUMENT_MODE_TEMPLATES: Readonly<Record<ArgumentMode, ArgumentModeTemplate>>;

/**
 * Returns the full template for a mode. Pure O(1) lookup. Throws on an
 * unknown mode value — the union makes that unreachable from typed callers;
 * the throw guards untyped (e.g. DB-string) boundaries.
 */
export function argumentModeTemplate(mode: ArgumentMode): ArgumentModeTemplate;

/**
 * Returns just the per-mode design fields (the issue's `argumentModeDefinition(mode)`).
 * Sugar over `argumentModeTemplate(mode).definition`.
 */
export function argumentModeDefinition(mode: ArgumentMode): ArgumentModeDefinition;

/** True when the mode is one of the 4 live MVP templates. */
export function isShippedMode(mode: ArgumentMode): boolean;

/** True when the mode is a sensitive (legal/custody/therapy-adjacent) mode. */
export function isSensitiveMode(mode: ArgumentMode): boolean;

/**
 * Narrows an arbitrary string (e.g. a DB column value, or a deep-link param)
 * to an ArgumentMode, falling back to DEFAULT_ARGUMENT_MODE for any unknown
 * or non-string input. Fail-safe — never throws.
 */
export function coerceArgumentMode(value: unknown): ArgumentMode;
```

### Setup-screen support (model-side only — the screen is part B)

These pure functions are built this card so the part-B screen is mechanical.

```ts
/** One row of the "the rules" column — a plain-language rule statement. */
export type ModeRuleRow = Readonly<{
  /** Stable row id (e.g. 'tone', 'evidence', 'pacing'). For testIDs / keys. */
  id: string;
  /** Plain-language label, e.g. "Tone". Read from ARGUMENT_MODE_COPY. */
  label: string;
  /** Plain-language value, e.g. "Relaxed — slang and jokes are fine." */
  value: string;
}>;

/**
 * Builds the ordered, plain-language rule rows for the "the rules" column of
 * the mode setup screen. Pure. Reads only ARGUMENT_MODE_COPY + the mode's
 * definition. No verdict tokens; no internal codes leak (every enum value is
 * mapped to prose). This is the data the part-B screen renders.
 */
export function buildModeRuleRows(mode: ArgumentMode): ReadonlyArray<ModeRuleRow>;

/**
 * The mode's plain-language display name (e.g. "Friendly disagreement").
 * Read from ARGUMENT_MODE_COPY.
 */
export function argumentModeDisplayName(mode: ArgumentMode): string;

/** The mode's one-line plain-language description for the picker. */
export function argumentModeDescription(mode: ArgumentMode): string;
```

### Mapping to RULE-004 / RULE-005's `'casual' | 'strict'` placeholder

Part B wires the real mode into RULE-004/RULE-005, whose `mode` parameter is still typed
`'casual' | 'strict'`. The mapping is specified now so part B needs no judgement call:

```ts
/**
 * Collapses a mode's `allowedInformality` to the legacy 'casual' | 'strict'
 * value RULE-004 (PreSendReviewSheet) and RULE-005 (channel model) still
 * accept. 'restricted' informality → 'strict'; 'permissive' and 'normal' →
 * 'casual'. Part B uses this to pass the real mode through the existing
 * RULE-004/RULE-005 signatures without changing their types.
 */
export function reviewModeForArgumentMode(mode: ArgumentMode): 'casual' | 'strict';
```

Rationale for `'normal' → 'casual'`: RULE-004's only mode-sensitive behaviour is
upgrading `permanent_record_warning` from `info` to `soft` in strict mode. We only want
that upgrade for genuinely formal/court modes (`restricted` informality), not for
`debate_club`'s `normal` informality — `debate_club` already turns
`permanentRecordWarning: 'on'` independently, so it gets the honest advisory copy
without the severity bump.

### No Edge Function, no RLS this card

GAME-003 part A is a pure-TS model. No `supabase/` change. Part B's persistence card
will own the migration + RLS.

---

## The four MVP mode templates (full field values, doctrine-justified)

Every `pacing` value is constructed with `createPacingRule(...)`. `cooldownEnabled` is
**derived to match** the pacing rule (`cooldownAfterSendSec > 0`) — see §edge cases #6.
`permanentRecordWarning` on the definition is kept in sync with the pacing rule's own
`permanentRecordWarning` — see §edge cases #7.

### 1. `casual_disagreement` — "Friendly disagreement" (status: shipped, sensitive: false)

The default mode. Friends arguing. The doctrine "false positives are catastrophic in
casual modes" drives every value toward the gentlest setting.

| Field | Value | Why |
|---|---|---|
| `toneStrictness` | `'loose'` | Friends speak loosely; tone helper copy stays minimal. |
| `evidenceStrictness` | `'loose'` | "I just think so" is a fine move here; no source pressure. |
| `pacing` | `createPacingRule()` (= `DEFAULT_CASUAL_PACING_RULE`) | No cap, no cooldown, no window — a provable no-op. Casual conversation must not feel rate-limited. |
| `allowedInformality` | `'permissive'` | Slang, jokes, "you had to be there" all welcome. |
| `branchesEncouraged` | `true` | Casual chats wander; branching is natural, not a fault. |
| `sourceRequestsCentral` | `false` | Asking for receipts mid-banter would feel hostile. |
| `finalSynthesisExpected` | `false` | Friends rarely need a formal wrap-up. |
| `permanentRecordWarning` | `'off'` | A casual chat is not a record; no looming-permanence copy. |
| `semanticClassification` | `'off'` | Safe default; no AI advisory needed for low-stakes chat. |
| `cooldownEnabled` | `false` | Matches the no-cooldown pacing rule. |
| `observerModeAllowed` | `true` | Friends may have an audience; observers are read-only. |
| `inviteOnly` | `false` | Casual rooms can be public/gallery-visible. |
| `disclaimer` | *(omitted)* | Not a sensitive mode. |

### 2. `court_record_strict` — "Court-of-record style" (status: shipped, sensitive: false)

Strict, formal, on-the-record. The doctrine "court-of-law mode can be strict; strict
modes tolerate more friction" drives the strict settings. **Important:** this mode is
*style* — a strict, careful, record-keeping argument format. It is **not** a sensitive
mode (it gives no legal advice and is not about a real legal matter), so it carries
**no disclaimer** and needs no operator copy approval.

| Field | Value | Why |
|---|---|---|
| `toneStrictness` | `'strict'` | Formal register expected; helper copy nudges measured tone. |
| `evidenceStrictness` | `'strict'` | Claims are expected to be sourced; advisory strength is high. |
| `pacing` | `createPacingRule({ cooldownAfterSendSec: 120, responseWindowSec: 86400, weightedByCooldown: true, permanentRecordWarning: 'on' })` | A 2-min cooldown buys framing time + cooldown weight (the GAME-002 "clear payoff" doctrine); a 24h response window structures turns. No daily cap — the room is deliberate, not throttled. |
| `allowedInformality` | `'restricted'` | A record values precise language; slang is discouraged (advisory, never blocked). |
| `branchesEncouraged` | `false` | A record stays on the question; tangents are routed but not encouraged. |
| `sourceRequestsCentral` | `true` | Asking for the source/citation is a foregrounded first-class move. |
| `finalSynthesisExpected` | `true` | A record ends with an explicit summary of where things stand. |
| `permanentRecordWarning` | `'on'` | The "this becomes a lasting part of the record" advisory is honest and apt here. |
| `semanticClassification` | `'metadata_only'` | Advisory metadata helps a strict room; it stays metadata, not a chip, to avoid clutter. Still never blocks. |
| `cooldownEnabled` | `true` | Matches the 120s cooldown in the pacing rule. |
| `observerModeAllowed` | `true` | A record can be observed; observers stay read-only. |
| `inviteOnly` | `true` | A formal record room is set up deliberately between two named parties. |
| `disclaimer` | *(omitted)* | Style mode, not a real legal matter — no legal advice given, none implied. |

### 3. `internet_fact_check` — "Fact-check this claim" (status: shipped, sensitive: false)

Claim-by-claim source checking. Evidence is central; pacing stays light so a quick
back-and-forth of "source?" / "here it is" flows. The anti-amplification doctrine is
load-bearing here: this mode foregrounds *evidence*, and "popularity is not evidence" —
the mode never rewards virality, view counts, or engagement.

| Field | Value | Why |
|---|---|---|
| `toneStrictness` | `'normal'` | Neither formal nor loose; the focus is sources, not register. |
| `evidenceStrictness` | `'strict'` | The whole point of the mode — claims want a source. |
| `pacing` | `createPacingRule()` (no pacing) | A fact-check is a fast volley; throttling it would kill the loop. Evidence rigor comes from `evidenceStrictness` + `sourceRequestsCentral`, not from pacing. |
| `allowedInformality` | `'normal'` | Internet-native phrasing is fine; the rigor is on sources, not tone. |
| `branchesEncouraged` | `true` | A claim often spawns sub-claims, each separately checkable — branching helps. |
| `sourceRequestsCentral` | `true` | "Ask for a source" is *the* central move of this mode. |
| `finalSynthesisExpected` | `false` | A fact-check resolves claim-by-claim; no single wrap-up is forced. |
| `permanentRecordWarning` | `'off'` | A fact-check thread is not a formal record. |
| `semanticClassification` | `'metadata_and_chip'` | The one mode where a non-blocking advisory chip (e.g. "this claim has no source attached yet") genuinely helps — it is still advisory, never a block, never a truth verdict. |
| `cooldownEnabled` | `false` | Matches the no-cooldown pacing rule. |
| `observerModeAllowed` | `true` | Fact-checks are usefully public; observers read-only. |
| `inviteOnly` | `false` | Open to gallery seats — a fact-check can invite chime-in. |
| `disclaimer` | *(omitted)* | Not a sensitive mode. |

### 4. `debate_club` — "Debate club" (status: shipped, sensitive: false)

Structured formal debate practice. Turn-taking and synthesis matter; it is rigorous but
friendly — practice, not a real-stakes record.

| Field | Value | Why |
|---|---|---|
| `toneStrictness` | `'normal'` | Formal *structure* without a formal *register* — it is practice. |
| `evidenceStrictness` | `'normal'` | Sourcing is encouraged but a well-reasoned point is also valid. |
| `pacing` | `createPacingRule({ cooldownAfterSendSec: 30, responseWindowSec: 43200, weightedByCooldown: false })` | A short 30s cooldown enforces gentle turn-taking; a 12h response window keeps the round moving. No daily cap. No cooldown weighting — debate club rewards the argument, not the wait. |
| `allowedInformality` | `'normal'` | Practice debate allows natural speech; it is not a courtroom. |
| `branchesEncouraged` | `true` | Exploring sub-points is good debate practice; branches are encouraged. |
| `sourceRequestsCentral` | `false` | Source requests are allowed but not the central move — reasoning is. |
| `finalSynthesisExpected` | `true` | A debate-club round ends with an explicit synthesis of the exchange. |
| `permanentRecordWarning` | `'on'` | Practice rounds are reviewed afterward — an honest "this is kept" note fits. |
| `semanticClassification` | `'metadata_only'` | Advisory metadata helps practice review; stays metadata, never a chip, never a block. |
| `cooldownEnabled` | `true` | Matches the 30s cooldown in the pacing rule. |
| `observerModeAllowed` | `true` | Debate club is observed by definition; observers read-only. |
| `inviteOnly` | `false` | Open — anyone can spectate or be invited to spar. |
| `disclaimer` | *(omitted)* | Not a sensitive mode. |

---

## The nine design-only stub templates (full field values)

Each stub has a **complete, doctrine-justified** definition — `status: 'design_only'`
means *not yet selectable in the live setup screen*, not "fields are missing." The 2
sensitive stubs (`co_parenting_custody`, `relationship_repair`) carry a fully-drafted
disclaimer; that disclaimer copy is in §"Sensitive-mode disclaimer copy" and is marked
clearly as design-only.

| Mode | tone | evidence | pacing (createPacingRule args) | informality | branches | sourceCentral | synthesis | permRecord | semantic | cooldown | observer | inviteOnly | sensitive | disclaimer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `domestic_bickering` | loose | loose | `{}` (none) | permissive | true | false | false | off | off | false | false | false | false | — |
| `co_parenting_custody` | normal | normal | `{ cooldownAfterSendSec: 300 }` | normal | false | true | true | on | off | true | false | true | **true** | non-legal (see below) |
| `political_debate` | normal | strict | `{ cooldownAfterSendSec: 60 }` | normal | true | true | false | on | metadata_only | true | true | false | false | — |
| `historical_debate` | normal | strict | `{}` (none) | normal | true | true | true | off | metadata_only | false | true | false | false | — |
| `recollection_disconnect` | loose | loose | `{}` (none) | permissive | true | false | true | off | off | false | false | true | false | — |
| `workplace_decision` | normal | normal | `{ cooldownAfterSendSec: 60, responseWindowSec: 86400 }` | normal | false | true | true | on | metadata_only | true | false | true | false | — |
| `research_evidence_review` | strict | strict | `{ responseWindowSec: 172800 }` | restricted | true | true | true | on | metadata_and_chip | false | true | true | false | — |
| `relationship_repair` | normal | loose | `{ cooldownAfterSendSec: 600 }` | permissive | false | false | true | on | off | true | false | true | **true** | non-therapy (see below) |
| `negotiation_tradeoff` | normal | normal | `{ cooldownAfterSendSec: 120 }` | normal | true | true | true | on | metadata_only | true | false | true | false | — |

Design rationale for the noteworthy stub choices (the implementer transcribes these
into the per-stub comments so the stubs are not "papered over"):

- **`domestic_bickering`** — like `casual_disagreement` but the parties are co-resident;
  still loose/permissive, still no pacing. Kept distinct from `casual_disagreement` only
  so the setup-screen description can name the household context.
- **`co_parenting_custody`** — *sensitive*. A real, high-stakes interpersonal dispute. A
  5-min cooldown lowers heat; `permanentRecordWarning: 'on'` is honest; `inviteOnly:
  true` keeps it private; `branchesEncouraged: false` keeps it on the one decision.
  `semanticClassification: 'off'` — never run AI advisories on a custody dispute.
  **Carries the non-legal disclaimer.**
- **`political_debate`** — `evidenceStrictness: 'strict'` because the anti-amplification
  doctrine matters most here (popularity/virality is not evidence); a 60s cooldown
  cools reactivity. `semanticClassification: 'metadata_only'` — advisory, never a chip,
  never a verdict on a political claim. This mode is design-only specifically because it
  needs careful disclaimer/operator review before going live (per the scope decision).
- **`recollection_disconnect`** — the "you had to be there" memory clash. `loose` /
  `permissive` by design: the doctrine explicitly protects natural recollection speech.
  `evidenceStrictness: 'loose'` — you cannot source a memory. `finalSynthesisExpected:
  true` because the useful end-state is "we remember it differently, here is what we
  agree on."
- **`research_evidence_review`** — the strictest evidence posture; a 48h response window
  for considered replies; `metadata_and_chip` semantic level because evidence chips
  genuinely help a lit-review-style room.
- **`relationship_repair`** — *sensitive*. `permissive` informality (people repair
  relationships in their own words), `evidenceStrictness: 'loose'` (feelings are not
  sourced), a long 10-min cooldown to lower heat, `finalSynthesisExpected: true` (the
  point is a shared understanding). **Carries the non-therapy disclaimer.**
- **`negotiation_tradeoff`** — `finalSynthesisExpected: true` (a negotiation ends in an
  agreed trade-off), `branchesEncouraged: true` (trade-offs branch into sub-terms).

---

## Per-mode taxonomy table (all 13)

| Mode | Display name | Status | Sensitive | tone | evidence | informality | pacing | branches | sourceCentral | synthesis | permRecord | semantic | observer | inviteOnly |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `casual_disagreement` | Friendly disagreement | shipped | no | loose | loose | permissive | none | yes | no | no | off | off | yes | no |
| `court_record_strict` | Court-of-record style | shipped | no | strict | strict | restricted | 120s cd + 24h win + weighted | no | yes | yes | on | metadata_only | yes | yes |
| `internet_fact_check` | Fact-check this claim | shipped | no | normal | strict | normal | none | yes | yes | no | off | metadata_and_chip | yes | no |
| `debate_club` | Debate club | shipped | no | normal | normal | normal | 30s cd + 12h win | yes | no | yes | on | metadata_only | yes | no |
| `domestic_bickering` | Household disagreement | design_only | no | loose | loose | permissive | none | yes | no | no | off | off | no | no |
| `co_parenting_custody` | Co-parenting discussion | design_only | **yes** | normal | normal | normal | 5m cd | no | yes | yes | on | off | no | yes |
| `political_debate` | Political-issue argument | design_only | no | normal | strict | normal | 60s cd | yes | yes | no | on | metadata_only | yes | no |
| `historical_debate` | Historical question | design_only | no | normal | strict | normal | none | yes | yes | yes | off | metadata_only | yes | no |
| `recollection_disconnect` | Different memories | design_only | no | loose | loose | permissive | none | yes | no | yes | off | off | no | yes |
| `workplace_decision` | Workplace decision | design_only | no | normal | normal | normal | 60s cd + 24h win | no | yes | yes | on | metadata_only | no | yes |
| `research_evidence_review` | Evidence review | design_only | no | strict | strict | restricted | 48h win | yes | yes | yes | on | metadata_and_chip | yes | yes |
| `relationship_repair` | Relationship discussion | design_only | **yes** | normal | loose | permissive | 10m cd | no | no | yes | on | off | no | yes |
| `negotiation_tradeoff` | Negotiation / trade-offs | design_only | no | normal | normal | normal | 2m cd | yes | yes | yes | on | metadata_only | no | yes |

Doctrine note on the table: **no column is a verdict.** `evidenceStrictness: 'strict'`
means "this room foregrounds source requests," not "claims here are true." Pacing is a
consented rule, not a penalty. `semanticClassification` gates an *advisory*; it never
gates posting. None of these fields can produce a winner/loser.

---

## Dependency map

```
                         ┌──────────────────────────────────────────┐
                         │  GAME-003  ArgumentModeDefinition          │
                         │  (this card — pure-TS model, 4 templates)  │
                         └────────┬───────────┬──────────┬──────────┘
                  pacing: PacingRule          │          │
                          │                   │          │
         ┌────────────────▼──────┐   semanticClassification│
         │ GAME-002 (DONE)        │            │           │
         │ pacingModel.ts         │   ┌────────▼────────┐  │ allowedInformality
         │ createPacingRule()     │   │ RULE-006 / MCP- │  │  + sourceRequestsCentral
         │ PacingRule type        │   │ 012 triggerGates│  │  + branchesEncouraged
         │ DEFAULT_CASUAL_PACING  │   │ SemanticClass-  │  │
         └────────────────────────┘   │ ificationMode   │  │
                                       │ (off→no call)   │  │
         consumed: GAME-003 builds      └─────────────────┘  │
         every mode's `pacing` via                           │
         createPacingRule(); never an    GAME-003 OWNS the    │
         object literal.                 canonical Semantic-  │
                                         ClassificationMode.  │
                                         Default 'off' = the  │
                                         fail-closed value    │
                                         MCP-012 already      │
                                         assumes when absent. │
                                                              │
   ┌──────────────────────────────────┐                       │
   │ RULE-004 (DONE) preSendReviewModel│◄──────────────────────┤
   │ `mode: 'casual' | 'strict'` param │  reviewModeForArgument-│
   │ permanent_record_warning severity │  Mode() maps           │
   │ upgrades in 'strict'.             │  allowedInformality →  │
   └──────────────────────────────────┘  'casual'|'strict'.    │
                                          (wiring = Part B)     │
   ┌──────────────────────────────────┐                        │
   │ RULE-005 (DONE) channelModel.ts   │◄───────────────────────┤
   │ `ChannelSuggestionMode` param.    │  same mapping. v1 logic │
   │ `mode_specific` reserved channel. │  ignores mode value;    │
   └──────────────────────────────────┘  Part B may use it.     │
                                                                │
   ┌──────────────────────────────────┐                        │
   │ BR-003 (DONE) tangentRoutingModel │◄───────────────────────┘
   │ tangent redirect advisory.        │  branchesEncouraged tunes
   │ assessTangentRisk().              │  whether redirect copy nudges
   └──────────────────────────────────┘  toward or away from branching.
                                          (tuning = Part B)
```

**Dependency statements:**

- **GAME-002 (done) — hard dependency, consumed this card.** GAME-003 imports
  `PacingRule`, `createPacingRule`, `DEFAULT_CASUAL_PACING_RULE` from
  `src/features/modes/pacingModel.ts`. Every mode's `pacing` field is the output of
  `createPacingRule(...)`. GAME-003 does **not** modify `pacingModel.ts`.
- **RULE-006 / MCP-012 (done) — type ownership, no code change this card.** MCP-012's
  `triggerGates.ts` declares `SemanticClassificationMode` locally and its comment cedes
  ownership to GAME-003. GAME-003 declares the canonical type; MCP-012's local copy is
  left as-is (identical values; reconciling the import is a future cleanup, not this
  card). `semanticClassification: 'off'` is the default and is what MCP-012 already
  assumes when the field is absent.
- **RULE-004 (done) — wiring is Part B.** `preSendReviewModel.ts` already has a
  `mode: 'casual' | 'strict'` parameter. GAME-003 part A ships
  `reviewModeForArgumentMode()` so part B can pass the real mode through without
  changing RULE-004's type. No RULE-004 file changes this card.
- **RULE-005 (done) — wiring is Part B.** `channelModel.ts` has a
  `ChannelSuggestionMode` parameter and a reserved `mode_specific` channel. GAME-003
  does not touch `channelModel.ts`. Part B may later use `mode_specific` for
  mode-specific channels; out of scope here.
- **BR-003 (done) — tuning is Part B.** `branchesEncouraged` will tune whether the
  `tangent_redirect` advisory copy nudges toward or away from branching. GAME-003 part A
  ships the `branchesEncouraged` field; the BR-003 copy tuning is part B.

---

## Mode setup screen design (DOCUMENTED — built in follow-up card GAME-003B)

This is the complete spec for the setup screen so the follow-up card needs no redesign.
**It is not built this card.**

### Purpose

Before a 1v1 PvP room becomes interactive, both participants must (a) see the chosen
mode's rules in plain language and (b) explicitly accept them. Modes are *consented* —
the room is not interactive until both parties accept.

### Layout — two-column compare

A single screen, `ModeSetupScreen.tsx`, shown after room creation and before the
argument surface mounts. On narrow viewports the two columns stack vertically (the
"compare" relationship is preserved by section headers, not by side-by-side layout).

```
┌─────────────────────────────────────────────────────────┐
│  Set up this argument                                     │
│  Mode:  [ Friendly disagreement  ▾ ]   ← picker, room     │
│                                          creator only     │
├───────────────────────────┬───────────────────────────────┤
│  YOUR VIEW                 │  THE RULES                    │
│  (what you'll experience)  │  (how this room works)        │
│                            │                               │
│  • Speak naturally —       │  Tone:        Relaxed         │
│    slang and jokes are     │  Evidence:    Optional        │
│    fine here.              │  Pacing:      No time limits  │
│  • No time limits between  │  Side issues: Encouraged      │
│    moves.                  │  Source asks: Not central     │
│  • Side tangents are fine. │  Wrap-up:     Not required    │
│  • This is a casual chat,  │  Observers:   Allowed          │
│    not a permanent record. │  Invite-only: No              │
│                            │                               │
│  [ disclaimer card here    │                               │
│    IF a sensitive mode ]   │                               │
├───────────────────────────┴───────────────────────────────┤
│  ☐  I've read the rules and I'm ready to start.            │
│      (you)                                                 │
│  ☐  Waiting for the other person to accept…                │
│      (opponent — read-only mirror)                         │
│                                                            │
│  [ Start the argument ]   ← disabled until BOTH accept     │
└────────────────────────────────────────────────────────────┘
```

- **"Your view" column** — a friendly, second-person rephrasing of what the participant
  will *experience* (built from the same `ArgumentModeDefinition`, different copy
  register). Reads from `ARGUMENT_MODE_COPY` "your view" lines.
- **"The rules" column** — the neutral, factual rule rows from `buildModeRuleRows(mode)`
  (built this card — part A). One row per rule, plain-language label + value.
- **Disclaimer card** — when `isSensitiveMode(mode)` is true, a visually distinct
  (bordered, neutral-tone) card renders `definition.disclaimer` above the accept gate.
  Never alarming styling; plain and calm.

### Both-parties-accept gate

- Two checkboxes: the participant's own "I've read the rules…" (a real, toggleable
  `accessibilityRole="checkbox"` control) and a read-only mirror of the opponent's
  acceptance state.
- "Start the argument" button is `disabled` (and `accessibilityState={{ disabled: true }}`)
  until **both** acceptances are true.
- The room's argument surface does not mount until both accept — the model exposes a pure
  `bothPartiesAccepted(stateA, stateB): boolean` helper (part B; trivial — `a && b`).
- In v1 there is no DB table for acceptance state; part B will decide whether acceptance
  is in-memory-per-session or persisted with the mode (a later persistence card).

### Mode picker — room creator only

Only the room creator picks the mode; the opponent sees it and accepts (or, if the
product later wants negotiation, declines — out of scope for v1). The picker lists only
`status: 'shipped'` modes (the 4 MVP modes). `design_only` modes are **not** shown in
the live picker — `isShippedMode(mode)` is the filter.

### DEV-only bot bypass

For bot fixtures / test rooms (`scripts/bot-fixtures/`), the both-parties-accept gate is
bypassed in DEV only. Mirror the exact pattern `pacingModel.ts` already uses for
`getDevPacingOverride` / `setDevPacingOverride`:

```ts
// Part B — DEV-ONLY. Guarded by __DEV__ so it is dead-code-eliminated from
// production bundles. NEVER surfaced in any user-facing UI. A bot/test
// harness sets this so the setup screen auto-accepts both sides.
let devBotAutoAccept = false;
export function getDevBotAutoAccept(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  return devBotAutoAccept;
}
export function setDevBotAutoAccept(value: boolean): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  devBotAutoAccept = value;
}
```

> The bot-bypass functions are **part B** (they belong with the screen). They are
> documented here, not built this card. They never bypass anything in a production
> build — the `__DEV__` guard makes them no-ops and dead-code-eliminates them.

### Accessibility (from `accessibility-targets`)

- Both checkboxes: `accessibilityRole="checkbox"`, `accessibilityState={{ checked }}`,
  44×44 hit target (or `hitSlop`).
- The mode picker: `accessibilityRole="button"` / `"combobox"`; each option a `"radio"`.
- "Start the argument" button: `accessibilityRole="button"`,
  `accessibilityState={{ disabled }}`, `accessibilityHint` explaining it unlocks when
  both accept.
- The two columns are real `<Text>`-wrapped content; column meaning is carried by the
  section headers ("Your view" / "The rules"), not by side-by-side position — so the
  stacked narrow-viewport layout is fully equivalent.
- Disclaimer card uses border + heading, not color alone, to read as distinct in
  grayscale.
- These are part-B implementation requirements; restated here so the follow-up card
  inherits them.

---

## Sensitive-mode disclaimer copy

Two of the 13 modes are sensitive and MUST carry a disclaimer. The disclaimers below are
**design-only** for the two stub modes — they are committed in `ARGUMENT_MODE_COPY` this
card (so `argumentModeNoLegalAdvice.test.ts` can assert their presence and the stub
definitions can reference them), but the modes themselves stay `design_only` until a
later card makes them live. The disclaimers state, in plain language, that the app gives
**no** legal / therapy / medical advice. They contain **no advice** of any kind — only
the statement that none is given. No verdict tokens, no alarming language.

**`co_parenting_custody` — non-legal disclaimer (DESIGN-ONLY copy):**

> This space is for talking through a co-parenting question together. CDiscourse is not a
> law firm and does not give legal advice. Nothing here is a legal opinion, a custody
> recommendation, or a substitute for talking with a qualified family-law professional.
> For anything with legal weight, please speak with a licensed attorney in your area.

**`relationship_repair` — non-therapy disclaimer (DESIGN-ONLY copy):**

> This space is for talking through a disagreement in your own words. CDiscourse is not a
> counseling or therapy service and does not give therapeutic, medical, or mental-health
> advice. Nothing here is a substitute for talking with a qualified counselor or
> therapist. If a conversation feels like more than this tool is for, please reach out
> to a licensed professional.

Notes:
- Both are written in calm, plain second person. No "warning," no alarm styling implied.
- Both describe what the app *is not* and explicitly state no advice is given — they do
  not themselves offer guidance, steps, or recommendations.
- `court_record_strict` is **not** sensitive and carries **no** disclaimer — it is a
  *style* mode (a strict, careful format), not a real legal matter, and the issue's
  scope decision keeps the 4 MVP modes all non-sensitive precisely so no disclaimer
  operator-approval is needed for this card's shipped set.
- When a later card promotes `co_parenting_custody` / `relationship_repair` to
  `shipped`, that card must route this disclaimer copy through operator copy review. The
  copy is committed now only so tests can assert it and the design is complete.

---

## "First three implementation slices" plan

The build of part A in three reviewable slices, in order:

**Slice 1 — types + enum + accessors (no template data yet).**
- Add `argumentModeModel.ts` with: `ArgumentMode` union + `ALL_ARGUMENT_MODES` +
  `MVP_ARGUMENT_MODES` + `DESIGN_ONLY_ARGUMENT_MODES` + `DEFAULT_ARGUMENT_MODE`;
  `SemanticClassificationMode`; `ArgumentModeDefinition`; `ArgumentModeStatus`;
  `ArgumentModeTemplate`; `ModeRuleRow`.
- Stub `ARGUMENT_MODE_TEMPLATES` as an empty-typed placeholder and the accessor
  signatures (`argumentModeTemplate`, `argumentModeDefinition`, `isShippedMode`,
  `isSensitiveMode`, `coerceArgumentMode`, `reviewModeForArgumentMode`).
- `npm run typecheck` passes; no test yet.

**Slice 2 — the 13 template definitions + copy block.**
- Add `ARGUMENT_MODE_COPY` to `gameCopy.ts` (display names, descriptions, rule-row
  labels + values, the 2 disclaimers, "your view" lines) and register it in `ALL_COPY`.
- Fill `ARGUMENT_MODE_TEMPLATES` with all 13 definitions — 4 MVP (full, exactly the
  values in this doc), 9 stubs (full, `status: 'design_only'`, exactly the table
  values). Build every `pacing` via `createPacingRule(...)`.
- Implement `buildModeRuleRows`, `argumentModeDisplayName`, `argumentModeDescription`.
- Add the `_forbiddenArgumentModeTokens()` ban-list helper.
- Update `src/features/modes/index.ts` barrel.
- `npm run typecheck` + `npm run lint` pass.

**Slice 3 — the 3 test files.**
- `argumentModeModel.test.ts`, `argumentModeBanList.test.ts`,
  `argumentModeNoLegalAdvice.test.ts` (see §"Test plan").
- `npm run test` passes; capture the new count; update `docs/current-status.md`.

The setup-screen component (`ModeSetupScreen.tsx` etc.) is **not** in any of these three
slices — it is the named follow-up card GAME-003B.

---

## Edge cases

The implementer must handle each:

1. **Unknown mode string from an untyped boundary.** `argumentModeTemplate` /
   `argumentModeDefinition` throw on an unknown mode (typed callers can't reach it).
   `coerceArgumentMode` is the fail-safe entry point for DB strings / deep-link params —
   it returns `DEFAULT_ARGUMENT_MODE` for anything unrecognized and never throws. A
   future `debates.mode` column read goes through `coerceArgumentMode`.
2. **Empty / null / non-string input to `coerceArgumentMode`.** Returns
   `DEFAULT_ARGUMENT_MODE`. Tested explicitly.
3. **A design-only mode reaching the live picker.** The picker filters by
   `isShippedMode`. If a stub mode is somehow passed to the setup screen anyway (bad
   deep link), part B falls back to `DEFAULT_ARGUMENT_MODE`. Part A guarantees the
   definition is still fully-typed and renderable, so even an accidental render is safe.
4. **Sensitive mode missing a disclaimer.** `argumentModeNoLegalAdvice.test.ts` asserts
   that for every mode where `template.sensitive === true`, `definition.disclaimer` is a
   non-empty string. A future sensitive mode added without a disclaimer fails the test —
   this is the intended guard.
5. **A non-sensitive mode carrying a disclaimer.** Allowed by the type (`disclaimer?` is
   optional) but the 4 MVP + non-sensitive stubs deliberately omit it. The ban-list test
   still scans any disclaimer that *is* present.
6. **`cooldownEnabled` drifting out of sync with the pacing rule.** `cooldownEnabled`
   must equal `definition.pacing.cooldownAfterSendSec > 0`. `argumentModeModel.test.ts`
   asserts this invariant for all 13 modes. The implementer should derive
   `cooldownEnabled` from the constructed pacing rule rather than hand-typing it, so it
   cannot drift.
7. **`permanentRecordWarning` appears in two places.** It is a field on
   `ArgumentModeDefinition` *and* on `PacingRule` (GAME-002 put it there). They must
   agree: `definition.permanentRecordWarning === definition.pacing.permanentRecordWarning`.
   The implementer builds the pacing rule with the matching
   `permanentRecordWarning` arg. `argumentModeModel.test.ts` asserts the equality for all
   13 modes. (Rationale for not deleting one: GAME-002 already shipped the `PacingRule`
   field and `describePermanentRecord`; the issue's field list also requires it on
   `ArgumentModeDefinition`. Keeping both, with an enforced-equal invariant, satisfies
   both contracts without editing GAME-002.)
8. **No mode may make `evidenceStrictness` block a post.** `evidenceStrictness` is a
   data field consumed only as *advisory* strength by RULE-004/evidence surfaces. The
   model exposes no function that turns a mode field into a blocking result. Tested by
   the absence of any block-producing export (and asserted in the doctrine self-check).
9. **Frozen-object mutation attempt.** `ARGUMENT_MODE_TEMPLATES`, every template, every
   definition, every `pacing` rule, and the rule-row arrays are `Object.freeze`d.
   `argumentModeModel.test.ts` asserts `Object.isFrozen` on a sample.
10. **`semanticClassification` default.** Any mode whose subject is sensitive or
    low-stakes uses `'off'`. The test asserts `casual_disagreement`,
    `domestic_bickering`, `co_parenting_custody`, `recollection_disconnect`, and
    `relationship_repair` are all `'off'` — the safe default per the MCP fail-closed
    posture.
11. **No concurrent-edit / offline / permission-denied cases this card.** Part A is a
    pure-TS data model with no I/O. Those cases belong to part B's screen + the later
    persistence card, and are noted in the part-B spec.

---

## Test plan

Three new test files under `__tests__/`. Pure-model tests — no React, no Supabase, no
fetch. Aim for full branch coverage of every public function (the bar for pure-TS models
per `test-discipline`).

**`__tests__/argumentModeModel.test.ts` — shape, accessors, invariants:**
- `ALL_ARGUMENT_MODES` has exactly 13 entries; `MVP_ARGUMENT_MODES` has exactly 4;
  `DESIGN_ONLY_ARGUMENT_MODES` has exactly 9; the two are disjoint and their union is
  `ALL_ARGUMENT_MODES`.
- For every mode in `ALL_ARGUMENT_MODES`: `argumentModeTemplate(mode)` returns a template
  whose `.mode` matches, whose `.status` is `'shipped'` iff the mode is in
  `MVP_ARGUMENT_MODES`, and whose `.definition` has all 13 required fields with values
  of the correct enum/type.
- `argumentModeDefinition(mode)` equals `argumentModeTemplate(mode).definition` for all
  13 modes.
- `argumentModeTemplate` / `argumentModeDefinition` throw on `'not_a_mode'`.
- `coerceArgumentMode`: returns the mode for each valid id; returns
  `DEFAULT_ARGUMENT_MODE` for `''`, `null`, `undefined`, `42`, `{}`, `'COURT'`,
  `'casual disagreement'` (space, not underscore).
- `isShippedMode` true for the 4 MVP, false for the 9 stubs.
- `isSensitiveMode` true only for `co_parenting_custody` and `relationship_repair`.
- **Invariant (edge case 6):** for all 13 modes,
  `definition.cooldownEnabled === (definition.pacing.cooldownAfterSendSec > 0)`.
- **Invariant (edge case 7):** for all 13 modes,
  `definition.permanentRecordWarning === definition.pacing.permanentRecordWarning`.
- `pacing` of every mode is a frozen object (it came from `createPacingRule`);
  `casual_disagreement`, `internet_fact_check`, `domestic_bickering`,
  `historical_debate`, `recollection_disconnect` have `isNoPacingRule(pacing) === true`.
- `semanticClassification` is `'off'` for the 5 modes named in edge case 10.
- `buildModeRuleRows(mode)` returns a non-empty frozen array; every row's `label` and
  `value` are non-empty strings and contain no underscore (no internal-code leak); the
  row `id` set is identical across all 13 modes (stable row schema).
- `argumentModeDisplayName` / `argumentModeDescription` return non-empty strings for all
  13 modes; display names are unique across the 13.
- `reviewModeForArgumentMode`: `'restricted'`-informality modes
  (`court_record_strict`, `research_evidence_review`) → `'strict'`; all others →
  `'casual'`.
- `Object.isFrozen(ARGUMENT_MODE_TEMPLATES)` and `Object.isFrozen` of a sample template
  + definition + pacing rule + a rule-row array.
- Determinism: calling `buildModeRuleRows`/`argumentModeDefinition` twice yields
  deeply-equal results.

**`__tests__/argumentModeBanList.test.ts` — doctrine ban-list:**
- Collect every user-facing string: all `argumentModeDisplayName`, all
  `argumentModeDescription`, every `buildModeRuleRows` label + value, every
  `definition.disclaimer` that is present, and every value in `ARGUMENT_MODE_COPY`.
- Assert none (case-insensitive) contains any token from `_forbiddenArgumentModeTokens()`
  — the verdict set (`winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `liar`,
  `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `troll`, `bot`,
  `astroturfer`, `verdict`, `proof`, `proven`, `won`, `lost`, `defeated`, `right`,
  `wrong`, `validated`), the amplification set (`likes`, `retweets`, `shares`, `views`,
  `followers`, `verified`, `engagement`, `amplification`, `trending`, `virality`,
  `popular`, `viral`), the block set (`block`, `prevent`, `reject`, `forbid`,
  `disallow`, `denied`), and the person-attribution / punitive set (`dodge`, `evade`,
  `evasion`, `avoiding`). Mirror `_forbiddenChannelTokens` / `_forbiddenPreSendTokens`
  for consistency.
- Assert no user-facing string contains a raw `ArgumentMode` id (no `casual_disagreement`
  snake_case leaking into UI copy).
- Assert every internal enum value used by a mode field (`'loose'`, `'permissive'`,
  `'metadata_and_chip'`, etc.) is mapped to non-snake_case prose by `buildModeRuleRows`
  — no internal code reaches a `ModeRuleRow.value`.

**`__tests__/argumentModeNoLegalAdvice.test.ts` — sensitive-mode disclaimer guard:**
- For every mode where `argumentModeTemplate(mode).sensitive === true`: assert
  `definition.disclaimer` is a non-empty string of reasonable length (e.g. ≥ 80 chars).
- Assert exactly 2 modes are sensitive (`co_parenting_custody`, `relationship_repair`)
  and exactly those 2 carry a disclaimer in the design-only set.
- Assert each sensitive disclaimer **states no advice is given**: contains a
  plain-language negation phrase (e.g. matches `/does not give .* advice/i` and names
  `legal` for custody / `therap` for relationship).
- Assert no disclaimer contains an *advice-giving* verb pattern that would imply the app
  is advising — e.g. it must not read like instructions (`/^you should/i`,
  `/we recommend you/i`). (A light heuristic guard — the real safeguard is operator copy
  review at promotion time, noted in the disclaimer section.)
- Assert `court_record_strict` is **not** sensitive and has **no** disclaimer (the MVP
  set is deliberately disclaimer-free).
- Assert all 4 MVP modes have `sensitive === false`.
- Re-scan the 2 disclaimers through the ban-list (no verdict / alarm tokens) — overlaps
  with the ban-list test intentionally; defence in depth.

Expected: roughly **55–75 new tests** across the three files. Test count goes up; update
`docs/current-status.md` after `npm run test` confirms the number.

---

## Dependencies (cards / docs / files)

- **Assumes GAME-002 is complete** — `src/features/modes/pacingModel.ts` exists and
  exports `PacingRule`, `createPacingRule`, `DEFAULT_CASUAL_PACING_RULE`,
  `isNoPacingRule`. Confirmed present in the repo. GAME-003 imports these; it does not
  modify `pacingModel.ts`.
- **Assumes RULE-006 / MCP-012 is complete** — `src/features/semanticReferee/triggerGates.ts`
  exists and declares a local `SemanticClassificationMode` whose comment cedes ownership
  to GAME-003. GAME-003 declares the canonical type; MCP-012's file is not edited.
- **Reads `src/features/modes/index.ts`** — adds re-exports; the existing pacing
  re-exports stay.
- **Reads `src/features/arguments/gameCopy.ts`** at `ALL_COPY` — adds `ARGUMENT_MODE_COPY`
  and registers it. No existing copy block changes.
- **RULE-004 (`preSendReviewModel.ts`) and RULE-005 (`channelModel.ts`)** are read for
  their `mode` parameter shape only — not modified this card.
- **BR-003 (`tangentRoutingModel.ts`)** read for context — not modified this card.
- **Blocks the follow-up card "GAME-003B — Argument mode setup screen"** — that card
  builds `ModeSetupScreen.tsx` and consumes `buildModeRuleRows`, `argumentModeTemplate`,
  `isShippedMode`, `isSensitiveMode`, `reviewModeForArgumentMode` from this card.
- **Blocks the later "mode persistence" card** — a `debates.mode` column + RLS;
  `coerceArgumentMode` is the safe reader that card will use.
- **Blocks any later card that wires `pacing` / `semanticClassification` /
  `allowedInformality` into the live composer / dock / PreSendReviewSheet** — the field
  values are defined here; the wiring is downstream.

---

## Risks

- **Two-place `permanentRecordWarning` (definition + PacingRule).** The biggest drift
  risk. Mitigated by: building the pacing rule with the matching arg, deriving nothing
  by hand, and an explicit equality invariant test (edge case 7). If a future change
  edits one without the other, `argumentModeModel.test.ts` fails.
- **`cooldownEnabled` redundancy.** It restates `pacing.cooldownAfterSendSec > 0`. Kept
  because the issue's field list requires it. Mitigated by deriving it from the
  constructed pacing rule and an invariant test (edge case 6).
- **`SemanticClassificationMode` declared in two files.** GAME-003 declares the
  canonical one; MCP-012 keeps its identical local copy. No runtime risk (values match);
  a future cleanup card can make MCP-012 import from GAME-003. Documented so the
  implementer does not "fix" it mid-card and widen scope.
- **Disclaimer copy for design-only modes is committed but the modes are not live.** A
  reviewer might think the disclaimers are unused. They are referenced by the stub
  definitions and asserted by tests — they are intentionally present. The disclaimer
  section states clearly they are design-only and need operator copy review at
  promotion.
- **Scope creep toward the setup screen.** The screen is fully specified here, which can
  tempt an implementer to build it. The "Scope split" section and the "first three
  slices" plan explicitly exclude `ModeSetupScreen.tsx` — the build is the model + copy
  + 3 tests + this doc, full stop.
- **`gameCopy.ts` is a large shared file.** Adding `ARGUMENT_MODE_COPY` + registering it
  in `ALL_COPY` is additive and low-risk, but the implementer must run the existing
  `gameCopy` / plain-language tests to confirm nothing else regressed.
- **No existing tests need updating.** GAME-003 adds files and adds one copy block; it
  changes no existing model behaviour. If `npm run test` shows a *changed* (not just
  *added*) test, that is unexpected — investigate before proceeding.

---

## Out of scope

- The mode setup **screen component** (`ModeSetupScreen.tsx` and friends) — named
  follow-up card GAME-003B. Fully specified in §"Mode setup screen design" but not built.
- **Persisting the chosen mode** in the database (`debates.mode` column, migration,
  RLS) — the issue's Non-scope explicitly defers this to a later card.
- **Wiring** `pacing` / `semanticClassification` / `allowedInformality` into the live
  composer, dock, `PacingChip`, `PreSendReviewSheet`, or BR-003 tangent copy — a later
  card. Part A only *defines* the field values.
- **Cross-mode migration of an in-progress room** — the issue's Non-scope; modes are
  immutable once a room is created.
- **Implementing all 13 modes as live** — only the 4 MVP modes ship `status: 'shipped'`;
  the other 9 are `design_only`.
- **Promoting `co_parenting_custody` / `political_debate` / `relationship_repair` to
  live** — needs operator disclaimer/copy approval; a later card.
- **Mode negotiation between the two parties** (opponent counter-proposing a mode) —
  v1 has the creator pick, the opponent accept/decline only; counter-proposal is a v2
  idea, not built.
- **Any AI call** — GAME-003 makes none. `semanticClassification` is just a data field
  that *gates* a downstream advisory; it triggers nothing itself.
- **Any new dependency** — none needed; pure TS over existing primitives.

---

## Doctrine self-check

**cdiscourse-doctrine:**
- §1 *No truth labels; score never blocks posting.* No mode field, no copy string, no
  helper produces "winner/loser/true/false/correct". `evidenceStrictness: 'strict'`
  means "this room foregrounds source requests," never "claims here are true."
  `argumentModeBanList.test.ts` scans every user-facing string for the verdict set. No
  GAME-003 export turns a mode field into a blocking result — modes change *friction*,
  never permission to post. Edge case 8 + this section assert it.
- §2 *Heat is activity, not truth.* No mode field reads or sets heat. Modes are static
  config; nothing in `ArgumentModeDefinition` is a heat input or output.
- §3 *Popularity is not evidence.* No mode field reads engagement / view count /
  virality. `internet_fact_check` and `political_debate` foreground *evidence*, and
  their copy is ban-list-scanned for amplification tokens (`viral`, `popular`,
  `trending`, `engagement`, …) — they must not appear.
- §4 *AI moderator hard limits.* GAME-003 makes no AI call. `semanticClassification` is
  a data field that *gates* the (already advisory, already non-authoritative)
  semantic-referee downstream. Default `'off'` = fail-closed, consistent with
  MCP-012…MCP-016. No mode can make AI authoritative or blocking.
- §5 *Rules engine is sacred.* GAME-003 does not touch `src/lib/constitution/engine.ts`
  or any engine file. `argumentModeModel.ts` is pure TS — no React, no Supabase, no
  network, no async, no mutation; JSON-serializable output.
- §6 *Secrets policy.* No keys, no `.env`, no service-role anywhere. `grep` for
  `ANTHROPIC_API_KEY` / `SERVICE_ROLE` in `src/` stays at zero matches.
- §7 *No AI calls from the production app.* None made. The model is inert data + pure
  functions.
- §8 *Supabase conventions.* No table, no migration, no RLS this card — persistence is
  explicitly deferred. Nothing to violate.
- §9 *Plain language for users.* Every internal enum value (`loose`, `restricted`,
  `metadata_and_chip`, …) is mapped to prose by `buildModeRuleRows` / `ARGUMENT_MODE_COPY`;
  `argumentModeBanList.test.ts` asserts no snake_case and no raw mode id reaches a
  user-facing string.
- §10 *v1 scope guards.* Modes never declare a winner (no voting/scoring-to-a-winner
  system). No real-time editing, no OAuth, no public API, no push, no search introduced.
  The setup screen is documented, not built; persistence is deferred.

**point-standing-economy:**
- *Concession is a repair, not a defeat; no mode penalizes silence.* GAME-003 adds no
  scoring logic and no auto-concession. `finalSynthesisExpected` is a *nudge* (a setup
  expectation), never an inferred concession and never a score event. Modes do not write
  to point standing; they do not touch `antiAmplification.ts`. A mode cannot "win" a
  point for anyone.

**accessibility-targets (applies to the documented part-B screen):**
- The setup-screen spec requires 44×44 hit targets on both checkboxes and the picker,
  `accessibilityRole`/`State` on every interactive element, `<Text>`-wrapped content,
  column meaning carried by headers (so the narrow-viewport stacked layout is
  equivalent), and the disclaimer card distinguished by border + heading (legible in
  grayscale, color is not the only signal). Restated in §"Mode setup screen design" so
  the follow-up card inherits the bar.

**expo-rn-patterns:**
- `argumentModeModel.ts` is a `*Model.ts` pure-TS file — no React, no Supabase imports,
  matching the repo's model-file convention. No new dependency (the issue forbids it and
  none is needed). The part-B screen, when built, uses RN primitives (`<View>`,
  `<Text>`, `<Pressable>`) only — no Bootstrap, no icon lib, no gradient lib.

**test-discipline:**
- Three test files ship *with* the model — tests are part of this card's deliverable,
  not a follow-up. Each public function is unit-tested including failure cases
  (`coerceArgumentMode` nulls, `argumentModeTemplate` throw). Ban-list and
  no-legal-advice safety tests follow the established repo pattern. Test count goes up;
  `docs/current-status.md` updated only after `npm run test` confirms the new number.

---

## Operator steps (if any)

**None — pure code change.** GAME-003 part A is a pure-TS model + a copy block + 3
tests + this design doc. No migration (`npx supabase db push` not needed), no Edge
Function deploy, no env var, no secret. The 2 sensitive-mode disclaimers are committed
as **design-only** copy and need operator copy review **only when a later card promotes
those modes to live** — that review is that card's operator step, not this one.
