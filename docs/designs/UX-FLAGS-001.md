# UX-FLAGS-001 — MCP family to friendly feedback flag mapping

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 (#826)
**Release:** PRODUCT-REDIRECT (post-Stage-6.4)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/833

## Goal (one paragraph)

The nine-family machine-observation layer (A–I production, J non-production) is
copy-safe but over-exposed: the active-card hub renders the entire A–I grid,
uncapped. This card builds the **translation/mapping layer only** — a new pure-TS
module that turns a `(family, rawKey)` observation into at most one friendly,
plain-language, advisory `FriendlyFlag` descriptor (or `null` = suppressed). It
does **not** build the flag UI (#834) and does **not** build the 1–3 cap /
priority ranking (#835). The module composes with the existing plain-language
funnels (`gameCopy.toPlainLanguage`, `standingBandCopy`, `messageQualifiers`,
referee banners) rather than re-implementing them, and encodes every doctrine
suppression rule (§1 no verdict tokens, §3 anti-amplification for Family D, §9
unknown→null, §10a J-exclusion + own-bubble challenge suppression).

## Scope-reality audit (pre-launch, mandatory per POSTRUN-UX001)

Two brief assumptions were checked against `main @ 6d8e316` source and one is
inaccurate; the design corrects for it rather than papering over it.

1. **Family I client-suppression — brief is STALE.** The brief and design-doc
   §7.1 both say "Family I is client-render-suppressed via
   `argumentDetailModel.ts:670` (`HUB_NON_PRODUCTION_FAMILIES`)". The actual
   constant at `src/features/arguments/detail/argumentDetailModel.ts:670` is:
   ```ts
   export const HUB_NON_PRODUCTION_FAMILIES = Object.freeze(['sensitive_composer']);
   ```
   i.e. **only Family J is suppressed at the hub today; Family I (`thread_topology`)
   is production-enabled AND client-rendered** (PR #562 enabled it; the code
   comment explicitly says "after the H/I enables"). The `familyRegistry.ts`
   Deno mirror agrees: `thread_topology.productionEnabled: true`.
   **Design decision:** the module does NOT hard-code `I → clientSuppressed:true`.
   Instead it derives `clientSuppressed` from a single mirror constant
   `CLIENT_SUPPRESSED_FLAG_FAMILIES` that is, at ship, `[]` (empty) — matching the
   live `HUB_NON_PRODUCTION_FAMILIES` complement — so the descriptor tells the
   truth about what the client actually renders. J is excluded entirely (never
   produced), which is a stronger gate than `clientSuppressed`. A `notes` field
   on the I flags records "available server-side; if a future re-scope re-adds I
   to the client-suppress set, flip the mirror constant." This keeps the module
   honest and lets #834 honor the *real* gate, per the brief's own instruction
   ("the module must expose that it is currently client-suppressed"). See
   **Decisions/Risks** for why we expose the mechanism even though the set is
   empty today.

2. **rawKey vocabulary is large and per-family.** Families carry 12–30 rawKeys
   each (`getDefinitionsfor Family` in `machineObservationDefinitions.ts`). The
   friendly mapping is deliberately **coarse**: it maps at the *family +
   observation-intent* grain (a small closed set of `FriendlyFlagKey`s per
   family), NOT one flag per rawKey. rawKeys route to a flag via a per-family
   classifier that reads the rawKey string; unmatched rawKeys inside a mapped
   family fall through to that family's default descriptive flag or to `null`.
   This is the only way to hit "a *few* friendly flags" (design §7 north star)
   without a 171-row table.

## Data model

New pure-TS types in the new module (no React, no Supabase, no network,
JSON-serializable, deterministic — same constraints as `messageQualifiers.ts`
and `refereeBannerLibrary.ts`):

```ts
/** Tone band — shape/word-carried, never color-only (accessibility-targets). */
export type FriendlyFlagTone = 'positive' | 'prompt' | 'descriptive';

/** Stable internal key for a friendly flag. snake_case, NEVER user-visible. */
export type FriendlyFlagKey =
  // Family A — parent_relation
  | 'nice_bridge' | 'direct_challenge' | 'builds_on_point' | 'callback_material'
  // Family B — disagreement_axis
  | 'disagrees_on_scope' | 'disagrees_on_facts' | 'clean_disagreement'
  // Family C — misunderstanding_repair
  | 'asks_for_clarification' | 'cleared_that_up'
  // Family D — evidence_source_chain
  | 'needs_a_receipt' | 'brought_receipts' | 'open_receipt' | 'complete_the_chain'
  // Family E — argument_scheme
  | 'strong_comparison' | 'cause_and_effect_claim' | 'names_the_pattern'
  // Family F — critical_question
  | 'unanswered_question' | 'names_the_uncertainty'
  // Family G — resolution_progress
  | 'clean_concession' | 'found_common_ground' | 'narrowed_the_claim' | 'synthesis_on_the_table'
  // Family H — claim_clarity
  | 'clear_claim' | 'could_be_more_specific' | 'reads_as_hedged'
  // Family I — thread_topology
  | 'new_issue' | 'back_to_earlier_point' | 'brings_in_outside_context';

/**
 * DESCRIPTOR ONLY — no priority, no rank, no cap, no React. (#835 owns
 * ranking; #834 owns rendering.)
 */
export interface FriendlyFlag {
  /** The production family this flag translates. Never user-facing. */
  family: MachineObservationFamily;          // 'parent_relation' | … | 'thread_topology'
  /** Stable internal key. Never user-facing. */
  key: FriendlyFlagKey;
  /** The friendly, plain-language chip label. Ban-list clean. <= 40 chars. */
  label: string;
  /** Optional one-line helper ("why?" / what to do next). Ban-list clean. <= 80 chars. */
  helper?: string;
  /** Tone band (drives icon/word prefix in #834; never color-only). */
  tone: FriendlyFlagTone;
  /**
   * True when tapping the flag should pre-fill the composer with a matching
   * intent (#834 wires the composer; this only DECLARES the affordance exists).
   * The composer intent code, if any, is `composerIntent`.
   */
  actionable: boolean;
  /** Composer preset intent code when actionable, else null. Never user-facing. */
  composerIntent: string | null;
  /**
   * True when this flag is challenge/verdict-adjacent and must be SUPPRESSED on
   * the flag-owner's own bubble (mirrors the own-bubble rail restriction).
   */
  ownBubbleSuppressed: boolean;
  /**
   * True when the family is currently client-render-suppressed (mirrors
   * `HUB_NON_PRODUCTION_FAMILIES` complement). At ship this is `false` for all
   * A–I because the live suppress-set is J-only; the field + mirror constant
   * exist so #834 honors the real gate and a future I re-scope is a one-line flip.
   */
  clientSuppressed: boolean;
  /**
   * Family D descriptors ONLY: always `true`. A hard, test-asserted invariant
   * that this flag is descriptive of the evidence dynamic and NEVER grants or
   * denies factual standing (anti-amplification, cdiscourse-doctrine §3).
   */
  neverGrantsStanding?: boolean;
  /** Optional non-user-facing engineering note (I re-scope, D fence, etc.). */
  notes?: string;
}
```

Two supporting frozen constants (mirrors, single source of truth):

```ts
/** Families NEVER mapped into a product flag. J by design (§10a). */
export const FRIENDLY_FLAG_EXCLUDED_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze(['sensitive_composer']);

/**
 * Families whose flags are client-render-suppressed today. Mirrors the live
 * `HUB_NON_PRODUCTION_FAMILIES` complement at the flag layer. EMPTY at ship
 * (only J is suppressed at the hub, and J is already excluded above). A future
 * Family I re-scope adds 'thread_topology' here — a one-line change.
 */
export const CLIENT_SUPPRESSED_FLAG_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([]);
```

## File changes

- **new file:** `src/features/feedbackFlags/friendlyFlagMap.ts` — the module.
  Types + the per-family friendly-flag descriptor table + the pure mapping
  functions + the two mirror constants + the `_forbiddenVerdictTokens()` helper
  (mirrors `messageQualifiers._forbiddenVerdictTokens`). Est. **~320–380 lines**
  (table is the bulk; logic is ~80 lines).
  - *Rationale for `src/features/feedbackFlags/`:* this is a net-new product
    concern (friendly flags), sibling to `nodeLabels/`, `refereeBanners/`,
    `refereeLoop/`. It is NOT argument-detail-specific (both Timeline and Cards
    surfaces will consume it), so it does not belong under `arguments/detail/`.
    A new top-level feature dir matches how `refereeBanners/` and `refereeLoop/`
    were introduced. #834/#835 will add sibling files in the same dir.
- **new file:** `src/features/feedbackFlags/index.ts` — barrel re-export of the
  public surface (types + functions + constants), mirroring
  `refereeBanners/index.ts`. Est. **~15 lines**.
- **new file:** `__tests__/friendlyFlagMap.test.ts` — coverage + shape +
  determinism (see Test plan). Est. **~180 lines**.
- **new file:** `__tests__/friendlyFlagMapBanList.test.ts` — the doctrine
  ban-list, structurally cloned from `__tests__/refereeBannerBanList.test.ts`.
  Est. **~140 lines**.
- **modified file:** none in `src/` production code outside the new dir. The
  module *imports* from `gameCopy.ts`, `standingBandCopy.ts`,
  `messageQualifiers.ts`, `nodeLabelTypes.ts`, `machineObservationDefinitions.ts`
  but changes none of them.
- **deleted files:** none.

## API / interface contracts

```ts
// src/features/feedbackFlags/friendlyFlagMap.ts

/**
 * The primary mapping. Given a production family and a boolean-observation
 * rawKey, return the single FriendlyFlag descriptor, or null (suppressed).
 *
 * Suppression (returns null) when ANY of:
 *   - family is in FRIENDLY_FLAG_EXCLUDED_FAMILIES (J), OR
 *   - family/rawKey is unknown / unmapped, OR
 *   - the rawKey maps to a family whose flag intent has no positive reading
 *     (e.g. a *_false rawKey with no descriptive flag).
 * The returned descriptor's `clientSuppressed` reflects
 * CLIENT_SUPPRESSED_FLAG_FAMILIES membership; the CALLER (#834) decides whether
 * to render a clientSuppressed flag — this function still returns it so the
 * mapping stays inspectable.
 */
export function friendlyFlagFor(
  family: MachineObservationFamily | string,
  rawKey: string,
): FriendlyFlag | null;

/**
 * Convenience: map a batch of positive (family, rawKey) observations to their
 * FriendlyFlag descriptors, dropping nulls and de-duping by `key`. Order is
 * input order (stable). NO cap, NO ranking (that is #835) — this is a pure
 * pass-through fan-out used by #834's data layer + tests.
 */
export function friendlyFlagsFor(
  observations: ReadonlyArray<{ family: MachineObservationFamily | string; rawKey: string }>,
): ReadonlyArray<FriendlyFlag>;

/**
 * The full descriptor table, frozen. Keyed by FriendlyFlagKey. Exposed so #835
 * can rank and #834 can render without re-deriving, and so the coverage test
 * can assert every production family has >= 1 descriptor.
 */
export const FRIENDLY_FLAG_DESCRIPTORS: Readonly<Record<FriendlyFlagKey, FriendlyFlag>>;

/** Every FriendlyFlagKey, frozen — for test enumeration. */
export const ALL_FRIENDLY_FLAG_KEYS: ReadonlyArray<FriendlyFlagKey>;

/** Verdict tokens that must never appear in any label/helper. Test helper. */
export function _forbiddenVerdictTokens(): string[];
```

**Delegation / reuse (the module composes, never re-implements):**
- Labels are authored in-module (the friendly copy is a *product* voice distinct
  from the referee banners), but each label MUST be verified to already exist in
  or be consistent with the plain-language vocabulary. Where a friendly label is
  identical to an existing plain-language string, the implementer imports the
  constant rather than re-typing it:
  - `open_receipt` / `needs_a_receipt` reuse the `source_chain_gap_*` and
    `evidence_debt_*` vocabulary in `gameCopy.PLAIN_LANGUAGE_COPY` — the helper
    lines SHOULD delegate to `toPlainLanguage('evidence_debt_open_still')` etc.
    rather than duplicating the sentence.
  - `clean_concession` / `narrowed_the_claim` / `synthesis_on_the_table` reuse
    the `synthesis_*` and `concession_noted` vocabulary in `gameCopy`.
  - Tone/label discipline mirrors `messageQualifiers` (`QUALIFIER_LABELS` +
    `QUALIFIER_NUDGES` + `_forbiddenVerdictTokens`).
- `MachineObservationFamily` + `ALL_MACHINE_OBSERVATION_FAMILIES` imported from
  `src/features/nodeLabels/nodeLabelTypes.ts` (single family taxonomy).
- The coverage test enumerates rawKeys per family via
  `getDefinitionsForFamily(family)` from
  `src/features/nodeLabels/machineObservationDefinitions.ts`.
- `looksLikeInternalCode` imported from `gameCopy.ts` for the no-raw-leak test
  (same as `refereeBannerBanList.test.ts`).

## Family → friendly-flag mapping (full A–I; J excluded)

Reconciled against §7.1 and the real rawKey categories in
`machineObservationDefinitions/family{A..I}.ts` + `gameCopy` vocabulary.
`tone` ∈ {positive, prompt, descriptive}. `own?` = `ownBubbleSuppressed`.
`act?` = `actionable` (+ composerIntent). All A–I `clientSuppressed:false` at
ship (mirror empty). Every label is verdict-free.

| Family | Key | Label | Helper | Tone | own? | act? (intent) | Representative positive rawKeys | Notes |
|---|---|---|---|---|---|---|---|---|
| **A** parent_relation | `nice_bridge` | Nice bridge | Ties cleanly to the point above. | positive | no | no | `acknowledges_parent_strength`, `refines_parent`, `quote_anchors_parent` (bridge sense) | descriptive of the relation; never good/bad |
| **A** | `direct_challenge` | Direct challenge | Pushes back on the point above. | descriptive | **yes** | no | `challenges_parent`, `identifies_parent_scope_limit` | own-bubble suppressed (challenge-adjacent) |
| **A** | `builds_on_point` | Builds on the point | Extends the parent instead of opposing it. | positive | no | no | `refines_parent`, `compares_parent_to_sibling_branch` | |
| **A** | `callback_material` | Callback material | Anchors to a quoted line — good lore/callback fodder. | positive | no | no | `quote_anchors_parent` | feeds Quote Forge / Lore |
| **B** disagreement_axis | `disagrees_on_scope` | Disagrees on scope | The dispute is about how broad the claim is. | descriptive | **yes** | no | axis=scope: `isolates_main_disagreement` (+scope), `identifies_parent_scope_limit` | axis is descriptive; never "you're wrong" |
| **B** | `disagrees_on_facts` | Disagrees on the facts | The dispute is about a factual point. | descriptive | **yes** | no | `distinguishes_fact_value_disagreement` (fact side) | own-bubble suppressed |
| **B** | `clean_disagreement` | Clean disagreement | Disagrees while keeping it about the argument. | positive | no | no | `preserves_face_while_disagreeing` | positive framing of a disagreement |
| **C** misunderstanding_repair | `asks_for_clarification` | Asks for clarification | Wants the term or reference pinned down. | prompt | no | **yes** (`ask_clarify`) | `names_ambiguity_source`, `offers_repair_path` (ask sense) | repair is positive; never "confused" |
| **C** | `cleared_that_up` | Cleared that up | Resolves a misunderstanding — the thread can move on. | positive | no | no | `accepts_correction`, `offers_repair_path` (resolve sense), lifecycle `clarified` | |
| **D** evidence_source_chain | `needs_a_receipt` | Needs a receipt | A source would carry this point further. | prompt | no | **yes** (`ask_for_source`) | `asks_for_evidence`, `evidence_gap_present`, `creates_source_chain_gap` | **neverGrantsStanding:true**; anti-amplification fence |
| **D** | `brought_receipts` | Brought receipts | A source is attached to this claim. | positive | no | no | `provides_evidence`, `source_attached`, `source_provided`, `quote_attached` | **neverGrantsStanding:true**; "attached", NOT "proven" |
| **D** | `open_receipt` | Open receipt | A source request is still open on this point. | prompt | no | **yes** (`ask_for_source`) | `opens_evidence_debt_marker`, `source_requested` | **neverGrantsStanding:true** |
| **D** | `complete_the_chain` | Complete the source chain | One more link would close the source trail. | prompt | no | **yes** (`ask_for_source`) | `creates_source_chain_gap`, `evidence_applicability_questioned`, `flags_context_limit` | **neverGrantsStanding:true**; popularity ≠ evidence |
| **E** argument_scheme | `strong_comparison` | Strong comparison | Uses an analogy or comparison to make the point. | descriptive | no | no | `linked_premise_structure` (analogy sense), scheme=analogy | detects the *pattern* only |
| **E** | `cause_and_effect_claim` | Cause-and-effect claim | Makes a claim about what causes what. | descriptive | no | no | scheme=causal, `convergent_premise_structure` (causal sense) | never a fallacy call-out |
| **E** | `names_the_pattern` | Names a reasoning pattern | Points at the shape of the reasoning. | descriptive | no | no | `enthymeme_gap_detected` (as invitation), `appeals_to_authority` | **NO fallacy framing**; "invitation to state it", per gameCopy fence |
| **F** critical_question | `unanswered_question` | Unanswered question | A question on the table is still waiting. | prompt | no | **yes** (`answer_question`) | `question_names_uncertainty`, `question_still_open`, lifecycle `question_still_open` | opens inquiry; no gotcha framing |
| **F** | `names_the_uncertainty` | Names the uncertainty | Points at exactly what's unclear. | descriptive | no | no | `question_names_uncertainty`, `question_separates_claim_evidence`, `question_invites_revision` | |
| **G** resolution_progress | `clean_concession` | Clean concession | A narrow point conceded — the broad point still stands. | positive | no | no | `concedes_narrow_point`, `concession_noted`, lifecycle `conceded` | **concession is a repair, not a defeat** |
| **G** | `found_common_ground` | Found common ground | Names shared ground between the sides. | positive | no | no | `separates_normative_from_empirical`, `synthesis_named` | |
| **G** | `narrowed_the_claim` | Narrowed the claim | Tightens the claim to what's defensible. | positive | no | no | `narrows_claim`, `records_remaining_disagreement` | |
| **G** | `synthesis_on_the_table` | Synthesis on the table | A resolution or settlement is proposed. | positive | no | **yes** (`propose_synthesis`) | `defines_next_evidence_needed`, `settlement_proposed`, lifecycle `synthesis_ready` | |
| **H** claim_clarity | `clear_claim` | Clear claim | The claim is stated plainly. | positive | no | no | claim_clarity positive rawKeys (`states_claim_plainly`) | descriptive formulation-state |
| **H** | `could_be_more_specific` | Could be more specific | A little more detail would sharpen this. | prompt | **yes** | **yes** (`sharpen_claim`) | `claim_underspecified`, `vague_reference_present` | never a quality verdict; own-bubble self-nudge OK but treat as challenge-adjacent when on another's bubble → suppress on own |
| **H** | `reads_as_hedged` | Reads as hedged | The claim is stated tentatively. | descriptive | no | no | `hedged_formulation_present` | descriptive; never "weak" |
| **I** thread_topology | `new_issue` | New issue | Opens a new point in the thread. | descriptive | no | no | `introduces_new_issue`, `opens_sub_axis` | "New issue" ≠ derailment; `clientSuppressed:false` at ship (mirror empty) |
| **I** | `back_to_earlier_point` | Back to an earlier point | Returns to a point raised earlier. | descriptive | no | no | `returns_to_earlier_point`, `repeated_axis_pressure` | |
| **I** | `brings_in_outside_context` | Brings in outside context | Pulls in context from outside this thread. | descriptive | no | no | `brings_in_outside_context`, `cross_room_reference_present` | feeds Memory Lane / callbacks |

**J (`sensitive_composer`) — EXCLUDED.** No descriptor. `friendlyFlagFor('sensitive_composer', …)`
returns `null` unconditionally (guarded by `FRIENDLY_FLAG_EXCLUDED_FAMILIES`
before any rawKey lookup). Non-production by design; a flip needs a fresh
cdiscourse-doctrine §10a review. The composer-only "maybe pause before sending?"
idea in §7.1 is explicitly NOT built here.

> **Implementer note on rawKey lists.** The "Representative positive rawKeys"
> column is the *intent* grouping, not an exhaustive enumeration. The per-family
> classifier reads the rawKey string and routes it to a key; author the routing
> by cross-checking `getDefinitionsForFamily(family)` at build time. A rawKey
> inside a mapped family that matches no key routes to that family's most
> descriptive flag ONLY if it is a positive/`single_true` reading; a `*_false` /
> `no_*` reading returns `null` (no "absence" flag in product UI). When in doubt,
> return `null` — under-flagging is doctrine-safe, over-flagging is not.

## Exclusion / suppression rules (concrete, encoded in the module)

1. **J-exclusion.** `friendlyFlagFor` returns `null` immediately when
   `FRIENDLY_FLAG_EXCLUDED_FAMILIES.includes(family)`. J never produces a
   descriptor and has no entry in `FRIENDLY_FLAG_DESCRIPTORS`. (Test-asserted.)
2. **Client-suppression (Family I mechanism).** A descriptor's
   `clientSuppressed = CLIENT_SUPPRESSED_FLAG_FAMILIES.includes(family)`. At ship
   this is `false` for all A–I (the mirror is empty, matching the live
   `HUB_NON_PRODUCTION_FAMILIES = ['sensitive_composer']`). The field + mirror
   exist so #834 honors the real client gate and a future I re-scope is a
   one-line change to the mirror constant. `friendlyFlagFor` still RETURNS a
   clientSuppressed descriptor (the caller decides render); it is not a `null`
   path. (Test-asserted the mechanism works by a fixture flip in the test only.)
3. **Own-bubble suppression.** Descriptors with `ownBubbleSuppressed:true` are
   challenge/verdict-adjacent (Family A `direct_challenge`, Family B axis flags,
   Family H `could_be_more_specific`). `friendlyFlagFor` DOES return them; a
   thin caller helper `isOwnBubbleEligible(flag): boolean => !flag.ownBubbleSuppressed`
   is exported so #834 filters own-bubble flags exactly as the existing rail does
   (own bubble → `Qualifiers · Request deletion` only). The module never itself
   knows whose bubble it is — it only labels eligibility. (Test-asserted the flag
   is set on the challenge-adjacent keys and clear on the positive ones.)
4. **Unknown → null.** Unknown family OR unknown rawKey OR a mapped family with a
   non-positive rawKey reading → `null`, mirroring `toPlainLanguage`'s
   null-on-unknown. (Test-asserted with a garbage family and a garbage rawKey.)
5. **Family D no-standing invariant.** Every Family D descriptor carries
   `neverGrantsStanding:true`; no Family D label/helper contains a
   standing-granting word (`proven`, `proof`, `true`, `confirmed`, `fact` as a
   verdict, `wins`, `settles it`). The anti-amplification module
   (`src/features/pointStanding/antiAmplification.ts`) is NOT imported and NOT
   touched — the flag is descriptive only. (Test-asserted: (a) all D descriptors
   have the flag true, (b) no D string contains a standing token.)

## Edge cases

- **Empty inputs:** `friendlyFlagsFor([])` → `[]`. `friendlyFlagFor('', '')` → `null`.
  `friendlyFlagFor(family, '')` → `null`.
- **Null/undefined:** `friendlyFlagFor(null as any, null as any)` → `null` (guard
  first line, like `toPlainLanguage`).
- **Case / whitespace:** normalize family + rawKey with the same
  `trim().toLowerCase().replace(/[\s-]+/g,'_')` transform `toPlainLanguage` uses,
  so `'Evidence_Source_Chain'` and `'evidence source chain'` both resolve.
- **Duplicate observations:** `friendlyFlagsFor` de-dupes by `key` (a move can
  emit `source_attached` + `quote_attached`, both → `brought_receipts`; surface
  once).
- **`*_false` / `no_*` rawKeys:** return `null` — product UI never shows "did NOT
  do X" as a flag (those are internal `single_false` diagnostics).
- **Family I re-scope (future):** if the operator re-adds I to the client-suppress
  set, only `CLIENT_SUPPRESSED_FLAG_FAMILIES` changes; every I descriptor then
  reports `clientSuppressed:true` and #834 hides them. No other change.
- **cross_family observations:** out of scope — `friendlyFlagFor` takes ONE
  family. A `cross_family` key like `disagreement_axis+evidence_source_chain` is
  not a `MachineObservationFamily`, so it normalizes to unknown → `null`.
- **Doctrine edge:** "what if a Family D flag tried to lift the strength band? —
  it can't." The descriptor has no score/standing field and `neverGrantsStanding`
  is a hard invariant; the module is display-only.

## Test plan

- `__tests__/friendlyFlagMap.test.ts`
  - **Coverage:** every production family A–I (`ALL_MACHINE_OBSERVATION_FAMILIES`
    minus `FRIENDLY_FLAG_EXCLUDED_FAMILIES`) has ≥1 descriptor in
    `FRIENDLY_FLAG_DESCRIPTORS` (group descriptors by `family`, assert 9 families
    present, assert J absent).
  - **J-exclusion:** `friendlyFlagFor('sensitive_composer', anyRawKey)` → `null`
    for a sample of J rawKeys from `getDefinitionsForFamily('sensitive_composer')`.
  - **Happy path per family:** for each of A–I, one representative positive rawKey
    → a non-null `FriendlyFlag` whose `family` matches and whose `label` is
    non-empty and snake-free.
  - **Unknown → null:** garbage family, garbage rawKey, empty strings, null.
  - **Normalization:** `'Evidence Source Chain'` + a real D rawKey resolves same
    as `'evidence_source_chain'`.
  - **De-dupe:** `friendlyFlagsFor` with two D rawKeys that both map to
    `brought_receipts` returns exactly one descriptor.
  - **`*_false` suppression:** a `single_false`/`no_*` rawKey → `null`.
  - **clientSuppressed default:** every A–I descriptor has `clientSuppressed:false`
    at ship (asserts the mirror is empty and the field is wired).
  - **clientSuppressed mechanism:** a local test double that adds `thread_topology`
    to a copy of the mirror flips I descriptors to `true` (proves the derivation,
    not a hard-code). (If the mirror is a module const, assert instead that
    `friendlyFlagFor('thread_topology', k).clientSuppressed ===
    CLIENT_SUPPRESSED_FLAG_FAMILIES.includes('thread_topology')`.)
  - **ownBubbleSuppressed:** `direct_challenge`, `disagrees_on_scope`,
    `disagrees_on_facts`, `could_be_more_specific` → `true`; `nice_bridge`,
    `brought_receipts`, `clean_concession` → `false`. `isOwnBubbleEligible`
    inverts it.
  - **actionable ↔ composerIntent:** every `actionable:true` descriptor has a
    non-null `composerIntent`; every `actionable:false` has `composerIntent:null`.
  - **Determinism:** `friendlyFlagFor(f, k)` called twice returns deep-equal;
    `FRIENDLY_FLAG_DESCRIPTORS` is frozen (Object.isFrozen).
- `__tests__/friendlyFlagMapBanList.test.ts` (cloned from
  `refereeBannerBanList.test.ts`)
  - **Verdict ban-list:** scan every `label` + `helper` across
    `FRIENDLY_FLAG_DESCRIPTORS` (whole-word, case-insensitive) against the banned
    set (below). No hit.
  - **Key ban-list:** no `FriendlyFlagKey` string carries a banned token.
  - **No raw leak:** no `label`/`helper` passes `looksLikeInternalCode`; no
    family letter/name, rawKey, snake_case, or classifier jargon appears in any
    label/helper (assert no `_` and no `.` in labels; assert no
    `MachineObservationFamily` value appears verbatim in any label/helper).
  - **Popularity fence:** any label/helper naming popularity also names "not
    proof / not evidence / what's the source" (same rule as
    `refereeBannerBanList`) — realistically none name popularity, so this passes
    vacuously; keep the guard.
  - **No fallacy call-out:** the token `fallacy` (and `linked`, `convergent`,
    `enthymeme` argumentation-theory raw terms) appears in NO Family E
    label/helper.
  - **Family D no-standing:** every Family D descriptor has
    `neverGrantsStanding === true`; no Family D `label`/`helper` contains any of
    `proven|proof|true|false|confirmed|wins|settles it|is a fact`.
  - **Schema has no verdict surface:** a sampled `FriendlyFlag` has no
    `score|block|winner|loser|truthValue|authoritative|verdict|rank|priority`
    key (the last two enforce "descriptor only, ranking is #835").
  - **anti-amplification import guard:** the module source does not import
    `antiAmplification` (a source-scan string assertion, like the OPS ban-list
    tests do for `SERVICE_ROLE`).

**Banned verdict set (enumerated, superset of `_forbiddenVerdictTokens()`):**
`winner, loser, won, lost, win, lose, right, wrong, true, false, correct,
incorrect, proven, disproven, fallacy, liar, lying, dishonest, bad faith,
manipulative, propagandist, extremist, troll, bot, stupid, idiot, truth,
verdict`. (`right`/`wrong` are whole-word scanned so `outright` etc. never trip;
none of the authored labels use them.)

## Dependencies (cards / docs / files)

- Assumes families A–I are production-enabled — confirmed live in
  `familyRegistry.ts` (`productionEnabled:true` for the first 9; J `false`).
- Reads `ALL_MACHINE_OBSERVATION_FAMILIES` + `MachineObservationFamily` from
  `nodeLabels/nodeLabelTypes.ts`.
- Reads `getDefinitionsForFamily` from `nodeLabels/machineObservationDefinitions.ts`
  (tests only, to enumerate rawKeys).
- Reuses `toPlainLanguage` / `looksLikeInternalCode` from `arguments/gameCopy.ts`.
- **Blocks #834 (flag UI)** — it renders `FriendlyFlag` descriptors and honors
  `clientSuppressed` + `ownBubbleSuppressed`.
- **Blocks #835 (cap + priority)** — it ranks `FriendlyFlag` by `tone` +
  `actionable` and caps to 1–3.
- **Blocks EVIDENCE-ECHO-*, CONCESSION-REMIX-*** — they consume the D and G
  flags respectively.

## Risks

- **rawKey routing drift.** The mapping table groups rawKeys by *intent*; the
  implementer must cross-check the ACTUAL rawKey strings in
  `machineObservationDefinitions/family{A..I}.ts` while authoring the classifier,
  because some §7.1 example names (e.g. `asks_for_evidence`) are real and some
  (e.g. a bare "analogy") are scheme *values*, not rawKeys. Under-flag on
  uncertainty. The coverage test guards "≥1 per family", not "every rawKey
  routed" — a rawKey with no route safely yields `null`.
- **Family I brief/reality mismatch (surfaced in the audit).** The brief says I
  is client-suppressed; the code says only J is. The design resolves this by
  deriving `clientSuppressed` from a mirror constant that is empty at ship. If
  the reviewer or operator BELIEVES I should be suppressed on the client, that is
  a **one-line change** to `CLIENT_SUPPRESSED_FLAG_FAMILIES` (add
  `'thread_topology'`) — but per current code it should ship empty. **Operator
  decision flagged below.**
- **Label voice vs. existing vocabulary.** Some friendly labels are new product
  copy (not verbatim `gameCopy`), which is intentional (§7.2 vocabulary) but
  means the ban-list test is the only guard — keep it strict.
- **No migration, no Edge, no provider spend** — pure code, low blast radius.

## Out of scope

- The flag UI component / chip rendering / "why?" expansion — **#834**.
- The 1–3 visible-flag cap and the priority/suppression ranking algorithm —
  **#835**.
- Any change to the machine-observation production layer, `familyRegistry.ts`,
  `HUB_NON_PRODUCTION_FAMILIES`, or the classifier pipeline.
- Composer wiring for actionable flags (the descriptor only *declares*
  `actionable` + `composerIntent`; #834 wires the composer preset).
- Family J product surface (excluded by design).
- Async/pending/dead-letter flag states (§7.4) — that is a #834 render concern;
  this module maps a *known* observation only.
- Cross-family (`famA+famB`) observations.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels):** the ban-list test scans
  every label + helper + key; the schema carries no score/block/winner/verdict
  key; `tone` is {positive, prompt, descriptive}, none a verdict.
- **§1 (score never blocks posting):** module is display-only, returns
  descriptors, has no gate/route/block field.
- **§3 (popularity is not evidence / anti-amplification):** Family D descriptors
  all carry `neverGrantsStanding:true`; no D string grants standing; the
  `antiAmplification` module is neither imported nor touched (source-scan test).
- **§4 (AI advisory, authoritative:false in spirit):** every flag is advisory; no
  `authoritative:true`; no flag decides who is right.
- **§9 (plain language, unknown suppressed):** unknown family/rawKey → `null`,
  mirroring `toPlainLanguage`; no raw code in any label (`looksLikeInternalCode`
  test).
- **§10a (Observations vs Allegations; J is composer-only/non-production):**
  Family J excluded entirely; own-bubble challenge-adjacent flags carry
  `ownBubbleSuppressed:true` so #834 mirrors the own-bubble rail restriction;
  Family I `clientSuppressed` mechanism preserves the client-render gate.
- **evidence-doctrine:** Family D flags surface evidence *dynamics* (needs /
  brought / open / complete-the-chain) and never assert factual standing;
  "brought receipts" means "a source is attached", never "proven".
- **point-standing-economy:** Family G `clean_concession` framing is "a repair,
  not a defeat"; no G label frames concession as loss.

## Operator steps (if any)

None — pure code change (new module + two test files). No migration, no Edge
deploy, no env var, no provider spend.

**Operator decision requested (non-blocking for implementation):** the brief
states Family I is client-render-suppressed, but `HUB_NON_PRODUCTION_FAMILIES`
today suppresses only J, and PR #562 explicitly enabled I on the client. The
design ships `CLIENT_SUPPRESSED_FLAG_FAMILIES = []` to match the live code. If
you intend I to be hidden from the friendly-flag surface until a re-scope, add
`'thread_topology'` to that one constant — confirm which posture you want before
#834 renders I flags.
