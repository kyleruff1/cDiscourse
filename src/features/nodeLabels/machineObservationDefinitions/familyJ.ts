/**
 * MCP-021A — Family J (sensitive_composer) definitions.
 *
 * Per Trigger 10 (binding): 5 entries — UNCHANGED. No new sensitive
 * entries beyond the existing UX-001.5A vocabulary. Family J brief
 * extras were DROPPED per §2.2.10 (hostile_generalization_present,
 * identity_group_reference_present, sarcasm_or_mockery_present,
 * excessive_heat_present, moderation_boundary_near — all flagged for
 * sequel-audit consideration outside MCP-021A scope).
 *
 * This file carries the RETROACTIVE verbose-definition backfill for
 * the 5 existing sensitive entries (per design §2.4 + §6.10).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — SENSITIVE; composer-only / inspect-only
 *     surfaces; NEVER appears on a target's node (would read as accusation).
 *   - cdiscourse-doctrine §1 — never implies the author is bad-faith.
 *   - cdiscourse-doctrine §3 — popularity / satire are not evidence.
 *   - cdiscourse-doctrine §4 — AI does not moderate (chip is advisory).
 *   - point-standing-economy — sensitive nudges sit OUTSIDE the scoring
 *     economy; they advise revision before posting.
 */

import type { MachineObservationDefinition } from '../nodeLabelTypes';

const SHARED_HIGH_CONFIDENCE_ELIGIBILITY: MachineObservationDefinition['confidenceEligibility'] = {
  timelineMinConfidence: 'high',
  selectedContextMinConfidence: 'high',
  inspectMinConfidence: 'high',
};

export const FAMILY_J_DEFINITIONS: ReadonlyArray<MachineObservationDefinition> = Object.freeze([
  // 1. shifts_to_person_or_intent (existing #61, composer_only)
  Object.freeze({
    id: 'registry:machine_observation:semantic_referee:shifts_to_person_or_intent',
    rawKey: 'shifts_to_person_or_intent',
    kind: 'machine_observation',
    source: 'semantic_referee',
    family: 'sensitive_composer',
    label: 'Person or intent shift',
    shortLabel: 'Pers shift',
    description: 'The move shifts focus from the claim to the person or intent.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 5,
    visibleByDefault: false,

    booleanQuestion:
      "Does this move shift focus from the parent's claim to the parent's poster (their identity, motive, character, or intent) rather than addressing the substantive claim?",
    positiveDefinition:
      "The move's primary content is about the parent's poster — their motives, their character, their identity-group membership, their intentions — rather than the substantive claim the parent made.",
    negativeDefinition:
      "The move addresses the substantive claim. The move may critique the claim's evidence, scope, definitions, or reasoning — none of those are person-shifts. A move that ALSO mentions a person in service of a claim-based point is not a person-shift.",
    positiveExamples: Object.freeze([
      "Parent: 'EVs reduce pollution.' Move: 'You only believe that because you work for an EV company.' (shifts from claim to poster's motive)",
      "Parent: 'Carbon taxes work.' Move: 'You environmentalists always say that.' (shifts to identity-group membership)",
      "Parent: 'Library funding matters.' Move: 'That is just what librarians want.' (shifts to poster's role)",
    ]),
    negativeExamples: Object.freeze([
      "Parent: 'EVs reduce pollution.' Move: 'The study you cite is by EV-industry researchers — that is a conflict of interest.' (challenges source quality, not person)",
      "Parent: 'Carbon taxes work.' Move: 'In a 2020 study, jurisdictions with carbon taxes had 8% lower emissions.' (substantive, not person)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that question a SOURCE's credibility (that is evidence quality, not person-shift on the poster).",
      "Do NOT mark TRUE for moves that mention a person in service of a substantive claim ('the 2020 Jones study found...').",
      "Do NOT mark TRUE for moves where the poster's identity is the SUBJECT of the claim being discussed.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: SENSITIVE; composer-only. NEVER surfaces on the target node — that would read as accusation.',
      "cdiscourse-doctrine §1: NEVER implies the author is acting in poor faith. The chip is a private nudge to revise BEFORE posting.",
      "UX-001.5A: per audit verdict, the composer banner is the ONLY surface; node-mount and Timeline NEVER receive this rawKey.",
      'MCP-020 audit §Rejected labels: this is the structural sibling of ad_hominem_present (rejected as a node-mount label); the composer-only path is what makes the surface safe.',
    ]),
    confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY,
  }),

  // 2. contains_unplayable_insult_only (existing #62, composer_only)
  Object.freeze({
    id: 'registry:machine_observation:semantic_referee:contains_unplayable_insult_only',
    rawKey: 'contains_unplayable_insult_only',
    kind: 'machine_observation',
    source: 'semantic_referee',
    family: 'sensitive_composer',
    label: 'No playable claim',
    shortLabel: 'No claim',
    description: 'No playable claim is included — only an insult.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 6,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move consist ONLY of an insult or putdown, with no playable claim attached that another participant could engage with?',
    positiveDefinition:
      'The move contains an insult or putdown directed at another participant or at a group, and contains NO substantive claim that another participant could respond to. The body has zero claim-content (no proposition, no question, no quote-with-engagement).',
    negativeDefinition:
      'The move contains a substantive claim, question, quote, or reasoning — even if framed sharply or critically. Strong language alongside a substantive claim is NOT this rawKey; sharp tone on a real claim is still playable.',
    positiveExamples: Object.freeze([
      "Move: 'That is dumb.' (only a putdown; no playable claim)",
      "Move: 'You people are clueless.' (only an insult; no claim to engage with)",
      "Move: 'lol' (no claim, no engagement, just dismissal)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'That argument is weak because it ignores the 2020 data showing the opposite trend.' (sharp tone, but substantive claim attached)",
      "Move: 'I find this baffling — what is your source?' (asks for evidence; playable)",
      "Move: 'This is wrong because of X, Y, Z.' (substantive disagreement)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that contain ANY substantive content beyond the putdown — a claim plus an insult is still playable.",
      "Do NOT mark TRUE for short questions ('what?', 'why?') that genuinely seek clarification — that is requests_clarification.",
      "Do NOT mark TRUE for moves that quote the parent with disagreement — quoting + reacting is engagement.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: SENSITIVE; composer-only. Surfacing on a target node would read as accusation.',
      "cdiscourse-doctrine §1: NEVER implies the author is a 'troll' or acting in bad faith. The chip surfaces ONLY in the composer to nudge revision before posting.",
      "cdiscourse-doctrine §4: the AI does not delete or hide the move; it advises the author privately. Publication remains the author's decision.",
    ]),
    confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY,
  }),

  // 3. needs_pre_send_pause (existing #63, composer_only)
  Object.freeze({
    id: 'registry:machine_observation:semantic_referee:needs_pre_send_pause',
    rawKey: 'needs_pre_send_pause',
    kind: 'machine_observation',
    source: 'semantic_referee',
    family: 'sensitive_composer',
    label: 'Pause suggested',
    shortLabel: 'Pause',
    description: 'A pause before sending is suggested.',
    defaultSurface: 'composer',
    disposition: 'composer_only',
    priority: 7,
    visibleByDefault: false,

    booleanQuestion:
      'Would this move benefit from a brief pause before sending, based on signals that the move is reactive, escalatory, or written under high emotional load?',
    positiveDefinition:
      'The move shows reactive / escalatory features: ALL CAPS bursts, repeated punctuation patterns, name-calling tendencies, replies that respond purely to tone rather than content, or replies that immediately follow a sharp parent move within a short reply window.',
    negativeDefinition:
      'The move shows reflective features: cites parent specifics, addresses substantive points, uses qualifying language where appropriate, or is the product of multiple drafts. Calm replies do not need pause; reflective replies do not need pause.',
    positiveExamples: Object.freeze([
      "Move (typed in 8 seconds after parent posted): 'NO YOU ARE WRONG WRONG WRONG!!!'",
      "Move: 'oh sure, of COURSE you would say that, you ALWAYS do' (no substantive content, escalatory tone, addresses tone-as-pattern)",
      "Move: 'wow just wow. unbelievable. cant even.' (no engagement, pure reactive expression)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'I disagree because the 2020 study you cited has been challenged on methodology — see [link].' (substantive)",
      "Move: 'Hmm, I had not considered the rural infrastructure point. Let me think about this and respond later.' (reflective)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE based on word count alone — short reflective replies exist.",
      "Do NOT mark TRUE based on tone alone — a substantive sharp reply is still playable.",
      "Do NOT mark TRUE for legitimate emphasis (a single emphasized word for clarity is fine).",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §10a: SENSITIVE; composer-only. Never surfaces on the target node.',
      "cdiscourse-doctrine §1: never implies the author is 'wrong' or 'losing it'. The chip is a private nudge to take a breath.",
      "cdiscourse-doctrine §4: the AI does not delete, hide, or delay the move; it suggests pause and lets the author decide.",
    ]),
    confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY,
  }),

  // 4. uses_popularity_as_evidence (existing #64, inspect_only)
  Object.freeze({
    id: 'registry:machine_observation:semantic_referee:uses_popularity_as_evidence',
    rawKey: 'uses_popularity_as_evidence',
    kind: 'machine_observation',
    source: 'semantic_referee',
    family: 'sensitive_composer',
    label: 'Popularity used as support',
    shortLabel: 'Pop-evidence',
    description: 'Popularity is used as support for the claim. Popularity is not proof.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 53,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move offer popularity, virality, view count, follower count, or engagement metrics as SUPPORT for a substantive claim?',
    positiveDefinition:
      "The move treats popularity signals (likes, retweets, view count, follower count, 'everyone says', 'trending') as if they grant the claim factual standing. The move offers no other support beyond the popularity signal.",
    negativeDefinition:
      "The move offers a claim with actual evidence (citation, source, quote, data) — even if popularity is mentioned as a side observation. A move that says 'this argument is widespread AND also supported by [citation]' is NOT this rawKey.",
    positiveExamples: Object.freeze([
      "Move: 'Everyone knows this is true.' (popularity as support)",
      "Move: '500 million people retweeted this; it must be right.' (engagement as support)",
      "Move: 'This is trending in 12 countries; that proves it.' (virality as support)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'This claim is widely circulated, but the underlying study is the 2020 Pittsburgh data showing X.' (citation provided)",
      "Move: 'Lots of people think this; let me explain why I do too: [reasons].' (reasons provided)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that mention popularity as one fact among others.",
      "Do NOT mark TRUE for moves that critique popularity as evidence (those are aligned with this doctrine).",
      "Do NOT mark TRUE for descriptive observations about engagement that do not claim factual standing.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §3: popularity / repetition / engagement velocity / political identity are NOT evidence. This rawKey is the surface anchor for that doctrine.',
      'anti-amplification module (src/features/pointStanding/antiAmplification.ts): engagement credit and factual-standing eligibility are SEPARATE scores. This observation suppresses factual-standing credit until evidence arrives.',
      'cdiscourse-doctrine §10a: inspect-only sensitive; the chip is informational and never blocks publication.',
    ]),
    confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY,
  }),

  // 5. uses_satire_as_evidence (existing #65, inspect_only)
  Object.freeze({
    id: 'registry:machine_observation:semantic_referee:uses_satire_as_evidence',
    rawKey: 'uses_satire_as_evidence',
    kind: 'machine_observation',
    source: 'semantic_referee',
    family: 'sensitive_composer',
    label: 'Satire used as support',
    shortLabel: 'Satire',
    description: 'Satire is used as support for the claim.',
    defaultSurface: 'inspect',
    disposition: 'inspect_only',
    priority: 54,
    visibleByDefault: false,

    booleanQuestion:
      'Does this move cite a satire piece, parody article, or comedy bit as if it were factual support for a substantive claim?',
    positiveDefinition:
      'The move references a satire source (The Onion, Reductress, Babylon Bee, comedy sketch, parody account) as evidence for a non-satirical claim. The move treats the satire as if it documented a real event or fact.',
    negativeDefinition:
      'The move references satire AS satire (acknowledging the comedic frame), OR references actual journalism / studies / primary sources, OR references satire to make a point ABOUT satire (e.g., analyzing what the satire mocks).',
    positiveExamples: Object.freeze([
      "Move: 'See, The Onion confirmed this last week.' (treats satire as confirmation)",
      "Move: 'According to Babylon Bee, the policy has already failed.' (treats parody as report)",
    ]),
    negativeExamples: Object.freeze([
      "Move: 'The Onion piece this week parodied this exact dynamic — funny how comedy can pin it.' (treats satire AS satire)",
      "Move: 'Per the Pittsburgh Post-Gazette 2024 data, X happened.' (real journalism)",
    ]),
    falsePositiveGuards: Object.freeze([
      "Do NOT mark TRUE for moves that explicitly acknowledge satire as satire.",
      "Do NOT mark TRUE for moves about satire as a phenomenon.",
      "Do NOT mark TRUE for satire critique or analysis.",
    ]),
    doctrineNotes: Object.freeze([
      'cdiscourse-doctrine §3: satire is not evidence for non-satirical claims. This rawKey surfaces the same boundary that uses_popularity_as_evidence enforces.',
      'evidence-doctrine: satire as a cited source for a factual claim opens evidence debt without closing it.',
      "cdiscourse-doctrine §10a: inspect-only sensitive; informational, never blocking. Satire's value as commentary is preserved; only its factual-evidence misuse is flagged.",
    ]),
    confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY,
  }),
]);
