/**
 * MCP-SERVER-011-FAMILY-J — Family J (sensitive_composer) 5-key
 * semantic_referee SOURCE-UNIFORM constant + prompt entries.
 *
 * Server-side MIRROR of the upstream Family J registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. Parity is enforced by
 * `tests/familyJKeysParity.test.ts` (reads BOTH files as source text and
 * fails the build on drift).
 *
 * SOURCE-UNIFORM semantic_referee path: per MCP-SERVER-011-FAMILY-J design
 * §1 + the MCP-J-001 scoping doctrine, the upstream `familyJ.ts` taxonomy
 * declares 5 rawKey entries with uniform `source: 'semantic_referee'`
 * (the 5 existing UX-001.5A sensitive keys — no new entries). No
 * `auto_metadata` or `lifecycle` entries. **No
 * FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS constant** (no exclusions;
 * uniform source mirrors the Family E/F/H precedent — the inverse of the
 * mixed-source D/G/I families which each carry an excluded-deterministic
 * list). All 5 keys are classified; there is nothing to exclude.
 *
 * NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` ENTRY (design §7.1 / HALT-14):
 * source-uniform → full registry passthrough; the Edge
 * `booleanObservationRequestBuilder.ts` mixed-source entries (D + G + I)
 * remain byte-equal and no new entry is needed. Adding a
 * `sensitive_composer` entry would be the HALT-13-class defect.
 *
 * The 5 rawKeys are the binding contract per design §1 + the MCP-J-001 §2
 * key table. Verbatim, in declaration order matching the upstream
 * `semantic_referee`-source entries of `familyJ.ts`:
 *
 *   1. shifts_to_person_or_intent     (HIGHEST — axis-partner; person/intent-directed; maximal guard)
 *   2. contains_unplayable_insult_only (HIGH — verdict-adjacent "insult"/"troll" drift)
 *   3. needs_pre_send_pause           (HIGH — verdict-adjacent emotional-state-label drift)
 *   4. uses_popularity_as_evidence    (§3 anti-amplification — popularity ≠ evidence)
 *   5. uses_satire_as_evidence        (HIGH — verdict-adjacent truth-verdict "fake" drift)
 *
 * Doctrine-risk = HIGH (higher than I's LOW; at least H's level). Four of
 * the five keys are verdict-adjacent and three are person/intent-directed.
 * Unlike Family I (whose verdict-adjacent candidate `repeats_prior_point`
 * was pruned upstream), J has NO pruned key — the sensitive vocabulary IS
 * the family. The prompt + ban-list treatment therefore mirrors Family H's
 * strongest profile, scaled to person/intent risk, with
 * `shifts_to_person_or_intent` as the axis-partner carrying the maximal
 * guard (the J analog of H's `claim_specificity_low`).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every entry is a MACHINE OBSERVATION,
 *     structural-only, never a verdict about a person or intent. A
 *     sensitive-composer observation describes a STRUCTURAL FEATURE OF THE
 *     MOVE'S OWN TEXT (its focus, its claim-content, its reactive markers,
 *     the form of support it leans on) — never a characterization of the
 *     author. Composer-only routing (keys 1-3) / inspect-only routing
 *     (keys 4-5) is enforced DOWNSTREAM by the three concentric Edge gates;
 *     the server only detects whether the text exhibits each feature.
 *   - cdiscourse-doctrine §1 — sensitive features are DESCRIPTIVE STRUCTURE,
 *     never verdicts. The classifier NEVER labels the author a "troll",
 *     "bot", "toxic", "hostile", "abusive", "aggressive", "uncivil",
 *     "gullible", "unhinged", a "bad actor", or as acting in bad faith.
 *   - cdiscourse-doctrine §3 — popularity / satire are NOT evidence.
 *     uses_popularity_as_evidence + uses_satire_as_evidence carry the §3
 *     boundary forward as structural information; never credit engagement,
 *     never assign a truth value (src/features/pointStanding/antiAmplification.ts —
 *     engagement credit and factual-standing eligibility are SEPARATE scores).
 *   - cdiscourse-doctrine §4 — the AI does not moderate; the observation is
 *     advisory and never blocks posting.
 *   - point-standing-economy — sensitive nudges sit OUTSIDE the scoring
 *     economy; J emits no standing delta.
 *
 * NOTE: confidenceEligibility (timeline/selected/inspect floors) +
 * defaultSurface/disposition routing live on the upstream taxonomy and are
 * applied by the Edge Function's sanitizer + presentation layer. This
 * server-side keys file mirrors only the rawKey + source + disposition +
 * prompt-entry slice, matching the Family A/B/C/D/E/F/G/H/I pattern. The
 * server does NOT route by disposition — that is the client presentation
 * layer's job; carrying the metadata lets the parity test pin the
 * 3 composer_only + 2 inspect_only split against upstream.
 */

/**
 * The 5 Family J semantic_referee rawKeys, frozen in declaration order
 * matching upstream. Used by:
 *   - validateFamilyBooleanRequest (rejects unknown rawKeys with
 *     unsupported_rawKey error envelope; routes via familyRegistry)
 *   - validateMcpBooleanObservationResponse (rejects checkedRawKeys
 *     entries outside this set when family-scoped)
 *   - the parity test (asserts every literal is present in upstream
 *     `familyJ.ts` as a string literal with source: 'semantic_referee' AND
 *     that upstream has zero auto_metadata + zero lifecycle entries — J is
 *     source-uniform)
 */
export const FAMILY_J_RAW_KEYS: readonly string[] = Object.freeze([
  'shifts_to_person_or_intent',
  'contains_unplayable_insult_only',
  'needs_pre_send_pause',
  'uses_popularity_as_evidence',
  'uses_satire_as_evidence',
]);

/** Classifier-set version emitted in modelInfo.classifierSetVersion. */
export const FAMILY_J_CLASSIFIER_SET_VERSION = 'family-j-v1' as const;

/**
 * One prompt-block entry per rawKey. The model receives this verbose slice
 * in the user prompt — definitions + 1 positive example + 1 negative
 * example + joined false-positive guards. Mirrored from upstream verbose
 * definitions; parity test enforces rawKey presence + the source +
 * disposition metadata split.
 *
 * Per design §5.2, the per-key falsePositiveGuards for the 4 verdict-adjacent
 * keys (shifts_to_person_or_intent, contains_unplayable_insult_only,
 * needs_pre_send_pause, uses_satire_as_evidence) carry verbatim DOCTRINE
 * paragraphs forbidding the output from characterizing the author. The
 * axis-partner key — J's analog to H's `claim_specificity_low` — is
 * `shifts_to_person_or_intent` (the person/intent-shift key). It carries the
 * strongest verbatim guard, including the existential constraint that even
 * when the input move text contains a slur ("troll"/"you're toxic"), the
 * output evidence_span must NOT echo it. uses_popularity_as_evidence carries
 * the §3 anti-amplification guard.
 *
 * The `source` + `disposition` fields are documentation/parity anchors only
 * — the server does NOT route by disposition.
 */
export interface FamilyJPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly source: 'semantic_referee';
  readonly disposition: 'composer_only' | 'inspect_only';
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;
}

export const FAMILY_J_PROMPT_ENTRIES: readonly FamilyJPromptEntry[] = Object.freeze([
  Object.freeze({
    rawKey: 'shifts_to_person_or_intent',
    label: 'Person or intent shift',
    source: 'semantic_referee',
    disposition: 'composer_only',
    booleanQuestion:
      "Does this move shift focus from the parent's claim to the parent's poster (their identity, motive, character, or intent) rather than addressing the substantive claim?",
    positiveDefinition:
      "The move's primary content is about the parent's poster — their motives, their character, their identity-group membership, their intentions — rather than the substantive claim the parent made.",
    negativeDefinition:
      "The move addresses the substantive claim. The move may critique the claim's evidence, scope, definitions, or reasoning — none of those are person-shifts. A move that ALSO mentions a person in service of a claim-based point is not a person-shift.",
    positiveExample:
      "Parent: 'EVs reduce pollution.' Move: 'You only believe that because you work for an EV company.' (shifts from claim to poster's motive)",
    negativeExample:
      "Parent: 'EVs reduce pollution.' Move: 'The study you cite is by EV-industry researchers — that is a conflict of interest.' (challenges source quality, not person)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that question a SOURCE's credibility (that is evidence quality, not person-shift on the poster). Do NOT mark TRUE for moves that mention a person in service of a substantive claim ('the 2020 Jones study found...'). Do NOT mark TRUE for moves where the poster's identity is the SUBJECT of the claim being discussed. DOCTRINE (MAXIMAL — axis-partner): shifts_to_person_or_intent is a structural focus observation (the move's content addresses the parent's poster — motive, character, identity, intent — rather than the substantive claim). It is NEVER an \"ad hominem\" verdict, NEVER a \"personal attack\" label, and NEVER a claim the author is attacking anyone. The evidence_span MUST anchor the move's own verbatim focus-shift wording (e.g. \"because you work for…\") and MUST NOT echo any slur the move itself contains. If the move's own text calls someone a \"troll\"/\"toxic\"/\"bad actor\", the model MAY still detect the focus-shift but its output evidence_span MUST NOT echo those words. The output MUST NOT contain: troll, toxic, hostile, abusive, ad hominem, personal attack, bad actor.",
  }),
  Object.freeze({
    rawKey: 'contains_unplayable_insult_only',
    label: 'No playable claim',
    source: 'semantic_referee',
    disposition: 'composer_only',
    booleanQuestion:
      'Does this move consist ONLY of an insult or putdown, with no playable claim attached that another participant could engage with?',
    positiveDefinition:
      'The move contains an insult or putdown directed at another participant or at a group, and contains NO substantive claim that another participant could respond to. The body has zero claim-content (no proposition, no question, no quote-with-engagement).',
    negativeDefinition:
      'The move contains a substantive claim, question, quote, or reasoning — even if framed sharply or critically. Strong language alongside a substantive claim is NOT this rawKey; sharp tone on a real claim is still playable.',
    positiveExample: "Move: 'That is dumb.' (only a putdown; no playable claim)",
    negativeExample: "Move: 'I find this baffling — what is your source?' (asks for evidence; playable)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that contain ANY substantive content beyond the putdown — a claim plus an insult is still playable. Do NOT mark TRUE for short questions ('what?', 'why?') that genuinely seek clarification — that is requests_clarification. Do NOT mark TRUE for moves that quote the parent with disagreement — quoting + reacting is engagement. DOCTRINE: contains_unplayable_insult_only records the structural ABSENCE OF A PLAYABLE CLAIM. It NEVER labels the move \"an insult\", \"toxic\", or \"abusive\", and NEVER calls the author a \"troll\". The evidence_span MUST anchor the verbatim move wording that shows no claim is attached — NOT a characterization of the author. The output MUST NOT contain: troll, toxic, abusive, name calling.",
  }),
  Object.freeze({
    rawKey: 'needs_pre_send_pause',
    label: 'Pause suggested',
    source: 'semantic_referee',
    disposition: 'composer_only',
    booleanQuestion:
      'Would this move benefit from a brief pause before sending, based on signals that the move is reactive, escalatory, or written under high emotional load?',
    positiveDefinition:
      'The move shows reactive / escalatory features: ALL CAPS bursts, repeated punctuation patterns, name-calling tendencies, replies that respond purely to tone rather than content, or replies that immediately follow a sharp parent move within a short reply window.',
    negativeDefinition:
      'The move shows reflective features: cites parent specifics, addresses substantive points, uses qualifying language where appropriate, or is the product of multiple drafts. Calm replies do not need pause; reflective replies do not need pause.',
    positiveExample: "Move (typed in 8 seconds after parent posted): 'NO YOU ARE WRONG WRONG WRONG!!!'",
    negativeExample:
      "Move: 'I disagree because the 2020 study you cited has been challenged on methodology — see [link].' (substantive)",
    falsePositiveGuards:
      "Do NOT mark TRUE based on word count alone — short reflective replies exist. Do NOT mark TRUE based on tone alone — a substantive sharp reply is still playable. Do NOT mark TRUE for legitimate emphasis (a single emphasized word for clarity is fine). DOCTRINE: needs_pre_send_pause records reactive/escalatory STRUCTURAL MARKERS (all-caps bursts, repeated punctuation, tone-only reply). It NEVER labels the author \"angry\", \"unhinged\", \"hostile\", \"aggressive\", or \"losing it\" — it is a private suggestion to pause, never a diagnosis of the writer. The evidence_span MUST anchor the verbatim reactive markers — NOT a judgment of the writer's emotional state. The output MUST NOT contain: unhinged, hostile, aggressive, losing it.",
  }),
  Object.freeze({
    rawKey: 'uses_popularity_as_evidence',
    label: 'Popularity used as support',
    source: 'semantic_referee',
    disposition: 'inspect_only',
    booleanQuestion:
      'Does this move offer popularity, virality, view count, follower count, or engagement metrics as SUPPORT for a substantive claim?',
    positiveDefinition:
      "The move treats popularity signals (likes, retweets, view count, follower count, 'everyone says', 'trending') as if they grant the claim factual standing. The move offers no other support beyond the popularity signal.",
    negativeDefinition:
      "The move offers a claim with actual evidence (citation, source, quote, data) — even if popularity is mentioned as a side observation. A move that says 'this argument is widespread AND also supported by [citation]' is NOT this rawKey.",
    positiveExample: "Move: 'Everyone knows this is true.' (popularity as support)",
    negativeExample:
      "Move: 'This claim is widely circulated, but the underlying study is the 2020 Pittsburgh data showing X.' (citation provided)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that mention popularity as one fact among others. Do NOT mark TRUE for moves that critique popularity as evidence (those are aligned with this doctrine). Do NOT mark TRUE for descriptive observations about engagement that do not claim factual standing. DOCTRINE (§3 anti-amplification): uses_popularity_as_evidence records that the text leans on how widely an idea is shared as support. It NEVER credits the engagement, NEVER quantifies or ranks it as if more sharing made the point stronger, and NEVER assigns the claim a truth value — engagement credit and factual-standing eligibility are SEPARATE scores (src/features/pointStanding/antiAmplification.ts). The evidence_span MUST anchor the verbatim popularity-leaning wording (e.g. \"everyone knows this\") — NOT an endorsement of its weight or a verdict on the claim.",
  }),
  Object.freeze({
    rawKey: 'uses_satire_as_evidence',
    label: 'Satire used as support',
    source: 'semantic_referee',
    disposition: 'inspect_only',
    booleanQuestion:
      'Does this move cite a satire piece, parody article, or comedy bit as if it were factual support for a substantive claim?',
    positiveDefinition:
      'The move references a satire source (The Onion, Reductress, Babylon Bee, comedy sketch, parody account) as evidence for a non-satirical claim. The move treats the satire as if it documented a real event or fact.',
    negativeDefinition:
      'The move references satire AS satire (acknowledging the comedic frame), OR references actual journalism / studies / primary sources, OR references satire to make a point ABOUT satire (e.g., analyzing what the satire mocks).',
    positiveExample: "Move: 'See, The Onion confirmed this last week.' (treats satire as confirmation)",
    negativeExample:
      "Move: 'The Onion piece this week parodied this exact dynamic — funny how comedy can pin it.' (treats satire AS satire)",
    falsePositiveGuards:
      "Do NOT mark TRUE for moves that explicitly acknowledge satire as satire. Do NOT mark TRUE for moves about satire as a phenomenon. Do NOT mark TRUE for satire critique or analysis. DOCTRINE: uses_satire_as_evidence records that the text cites a satire/parody source as if it documented a real event. It NEVER calls the claim \"false\", \"fake\", \"untrue\", or the author \"gullible\" — satire's value as commentary is preserved; only the evidentiary misuse is the structural fact. The evidence_span MUST anchor the verbatim satire-as-fact citation — NOT a truth verdict on the claim. The output MUST NOT contain: fake news, gullible.",
  }),
]);
