/**
 * MCP-SERVER-011-FAMILY-J — Family J prompt construction.
 *
 * Single-prompt strategy per design §5: one Anthropic call covers all 5
 * Family J sensitive_composer rawKeys. Token budget ~85 tokens/key × 5 =
 * ~425 naive; the conservative-positives bias (sensitive features are
 * sparse — most moves have 0 positives) keeps realistic output far under
 * the budget. MAX_TOKENS=1500 (matches Family A/B/C/E/F/G/H/I; NO bump per
 * design §4 — J has the largest absolute headroom of any family to date on
 * 5 keys).
 *
 * THIS IS THE MOST SENSITIVE PROMPT IN THE SYSTEM. Four of the five keys
 * are verdict-adjacent and three are person/intent-directed. The prompt is
 * engineered so the model output DETECTS WHETHER THE TEXT EXHIBITS A
 * STRUCTURAL FEATURE and NEVER CHARACTERIZES THE AUTHOR ("you are…", "this
 * person is…", "the author is…"). Per MCP-J-001 §8: the classifier detects;
 * the §8 display COPY stays in the client layer and never enters the server.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D/E/F/G/H/I system
 *     prompt VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the system
 *     prompt are doctrine-positive per the Family A-I precedent; the doctrine
 *     ban-list scan runs against the MODEL's RESPONSE, not the
 *     server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every Family J
 *     rawKey is structural-only; the user prompt instructs the model to flag
 *     a STRUCTURAL FEATURE OF THE MOVE'S OWN TEXT, NEVER to characterize the
 *     author. Sensitive Observations route composer-only (keys 1-3) /
 *     inspect-only (keys 4-5) DOWNSTREAM; the server only detects.
 *   - cdiscourse-doctrine §3 (popularity / satire ≠ evidence): the
 *     uses_popularity_as_evidence + uses_satire_as_evidence keys NEVER credit
 *     engagement and NEVER assign a truth value.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this module
 *     is server-side only; never imported into src/ or app/.
 *   - point-standing-economy: sensitive nudges sit OUTSIDE the scoring
 *     economy; J emits no standing delta.
 *
 * Doctrine risks (per design §5.2) — the 4 verdict-adjacent keys + the §3 key:
 *   - shifts_to_person_or_intent: HIGHEST RISK (the axis-partner). The single
 *     key most likely to be mis-framed as "ad hominem"/"personal attack". The
 *     output evidence_span MUST anchor the verbatim focus-shift wording; MUST
 *     NOT echo any slur the move contains. If the input move text says
 *     "you're such a troll", the model may still detect the focus-shift but
 *     MUST NOT echo "troll".
 *   - contains_unplayable_insult_only: records ABSENCE OF A PLAYABLE CLAIM;
 *     never "insult"/"toxic"/"troll".
 *   - needs_pre_send_pause: records reactive structural markers; never
 *     "angry"/"unhinged"/emotional-state label.
 *   - uses_satire_as_evidence: records satire-cited-as-fact; never
 *     "false"/"fake"/"gullible".
 *   - uses_popularity_as_evidence: §3 — records popularity-leaned-on; never
 *     credits engagement, never assigns truth value.
 */
import { FAMILY_J_PROMPT_ENTRIES, FAMILY_J_RAW_KEYS } from './familyJKeys.ts';

/** MAX_TOKENS for the Family J response. 5 keys; positives are sparse. */
export const FAMILY_J_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D/E/F/G/H/I. */
export const FAMILY_J_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_J_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family J. Mirrors the Family A/B/C/D/E/F/G/H/I system
 * prompt's 7 absolute rules VERBATIM (byte-equal to familyHPrompt.ts:86-92 /
 * familyIPrompt.ts:83-89), then adds the §10a sensitive-composer doctrine block.
 *
 * Per design §5.1: the 7 absolute rules are byte-equal to Family A-I. Rule #5
 * ("You do NOT describe, judge, or label the person — only the move's
 * structure.") is load-bearing for J and is NOT reworded.
 *
 * Per design §5.1 BINDING: the system prompt explicitly forbids the model
 * from characterizing the author; states sensitive-composer observations are
 * PRIVATE STRUCTURAL NUDGES that describe a STRUCTURAL FEATURE OF THE MOVE'S
 * OWN TEXT; anchors the person-shift-as-focus, insult-only-as-absence-of-claim,
 * pause-as-reactive-markers, satire-as-misuse, popularity-as-§3 doctrine
 * verbatim; and closes with a terminal ban-token negation line (§6).
 */
export const FAMILY_J_SYSTEM_PROMPT =
  `You are a CDiscourse argument-move structural classifier for a structured debate application.
Return strict JSON only.

Absolute rules:
- You do NOT decide who is right in a debate.
- You do NOT decide the winner of any debate.
- You do NOT assign a truth value to any claim.
- You do NOT treat popularity, engagement, or virality as evidence.
- You do NOT describe, judge, or label the person — only the move's structure.
- You do NOT recommend hiding, deleting, or modifying any content.
- You do NOT block an ordinary post — your output is advisory metadata only.

You classify whether an argument MOVE exhibits one or more SENSITIVE-COMPOSER structural
features — whether the move shifts focus from the parent's claim to the parent's poster (their
motive / character / identity / intent), whether it consists only of a putdown with no playable
claim attached, whether it shows reactive / escalatory markers that suggest a brief pause before
sending, whether it leans on popularity as support for a claim, or whether it cites a satire /
parody source as if it documented a real event.

CRITICAL DOCTRINE — sensitive-composer observations are PRIVATE STRUCTURAL NUDGES, never
characterizations of the person:
- A sensitive-composer observation describes a STRUCTURAL FEATURE of the move's own text (its
  focus, its claim-content, its reactive markers, the form of support it leans on). It is shown
  only to the author in their own composer or to an admin reviewing the text. It NEVER asserts
  that the author is a troll, a bot, a bad actor, toxic, hostile, abusive, aggressive, uncivil,
  acting in bad faith, or any judgment of the person or their intent.
- shifts_to_person_or_intent records that the move's CONTENT addresses the parent's poster
  (motive / character / identity / intent) rather than the substantive claim. It is a structural
  focus observation, and is NEVER an "ad hominem" verdict, NEVER a "personal attack" label, and
  NEVER a claim the author is attacking anyone. The evidence_span anchors the move's own verbatim
  wording that shows the focus-shift (e.g. "because you work for…"), and MUST NOT echo any slur
  the move itself contains.
- contains_unplayable_insult_only records the structural ABSENCE OF A PLAYABLE CLAIM. It NEVER
  labels the move "an insult", "toxic", or "abusive", and NEVER calls the author a "troll".
- needs_pre_send_pause records reactive / escalatory STRUCTURAL MARKERS (all-caps bursts,
  repeated punctuation, tone-only reply). It NEVER labels the author "angry", "unhinged",
  "hostile", or "losing it" — it is a private suggestion to pause, never a diagnosis of the writer.
- uses_satire_as_evidence records that the text cites a satire / parody source as if it
  documented a real event. It NEVER calls the claim "false", "fake", or "untrue", and NEVER calls
  the author "gullible" — satire's value as commentary is preserved; only the evidentiary misuse
  is the structural fact.
- uses_popularity_as_evidence records that the text leans on how widely an idea is shared as
  support. It NEVER credits the engagement, NEVER quantifies or ranks it as if more sharing made
  the point stronger, and NEVER assigns the claim a truth value (cdiscourse-doctrine §3 —
  engagement credit and factual-standing eligibility are SEPARATE scores).
- The output MUST NOT contain the words: troll, bot, astroturfer, toxic, hostile, abusive,
  aggressive, uncivil, gullible, unhinged, "ad hominem", "personal attack", "bad actor", "name
  calling", "fake news", "losing it". If the input move's own text contains a slur or person
  label, the model MAY still detect the underlying sensitive feature, but its own output
  evidence_span MUST anchor the structural feature (the focus-shift wording, the absent claim,
  the reactive markers, the popularity-leaning wording, the satire-as-fact citation), never echo
  the slur or person label.

A move can simultaneously exhibit multiple sensitive-composer features (e.g.,
shifts_to_person_or_intent AND needs_pre_send_pause). Sensitive features are usually sparse —
most moves have 0 positives; few have more than 1.

For each requested rawKey you answer true (the move exhibits the feature) or false (the feature
is absent OR not applicable to this move). Provide a short confidence band and an optional
evidenceSpan from the move body anchoring the structural feature. Return ONLY the JSON object the
user prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a sensitive-composer feature is genuinely
exhibited (rather than merely tonally adjacent, or addressed obliquely, or not applicable), answer
false. Sensitive features are sparse — do NOT mark all rawKeys true. The feature MUST be clearly
present to answer true.`;

/**
 * Validated Family J request input passed to buildFamilyJUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D/E/F/G/H/I
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyJRequest {
  readonly schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  readonly nodeId: string;
  readonly parentNodeId: string | null;
  readonly currentText: string;
  readonly parentText: string | null;
  readonly threadContextExcerpt: string;
  readonly requestedFamilies: readonly string[];
  readonly requestedRawKeys: readonly string[];
  readonly timeoutMs: number;
  readonly serverName?: string;
}

/**
 * Builds the user prompt for Family J classification.
 *
 * Structure per design §5.2:
 *   1. Sensitive-composer questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about sensitive-composer-as-structure cross-key framing
 *      (the structural-feature↔characterization doctrine anchors)
 *   4. Response-shape instruction (verbatim JSON example, classifierSetVersion family-j-v1)
 *   5. Conservative-positives bias reminder (0 to 1 features)
 *   6. The slur-in-input handling instruction (detect the feature, never echo the slur)
 *   7. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 5 Family J keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyJUserPrompt(request: ValidatedFamilyJRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_J_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_J_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_J_PROMPT_ENTRIES.filter((entry) =>
    requestedKeys.includes(entry.rawKey),
  );

  const questionsBlock = requestedEntries
    .map((entry) => `- ${entry.rawKey}: ${entry.booleanQuestion}`)
    .join('\n');

  const definitionsBlock = requestedEntries
    .map((entry) =>
      [
        `rawKey: ${entry.rawKey}`,
        `positiveDefinition: ${entry.positiveDefinition}`,
        `negativeDefinition: ${entry.negativeDefinition}`,
        `positive example: ${entry.positiveExample}`,
        `negative example: ${entry.negativeExample}`,
        `false-positive guards: ${entry.falsePositiveGuards}`,
      ].join('\n'),
    )
    .join('\n\n');

  const parentTextRendered =
    request.parentText === null || request.parentText.length === 0
      ? 'none — this is a root move.'
      : request.parentText;

  const responseShape = `{
  "schemaVersion": "mcp-021.machine-observations.boolean.v1",
  "nodeId": "<echo the nodeId from the input>",
  "checkedRawKeys": ["<each rawKey you considered>"],
  "observations": {
    "<rawKey>": <true|false>,
    ...
  },
  "confidence": {
    "<rawKey>": "<low|medium|high>",
    ...
  },
  "evidenceSpan": {
    "<rawKey>": "<short verbatim quote from the move body, max 240 chars, or null if no anchoring span>",
    ...
  },
  "modelInfo": {
    "provider": "mcp",
    "serverName": "<server identifier>",
    "classifierSetVersion": "family-j-v1"
  }
}`;

  return `Sensitive-composer questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about sensitive-composer observations as DESCRIPTIVE STRUCTURE: each Family J rawKey is a
structural fact about the MOVE'S OWN TEXT (its focus shifting to the poster, the absence of a
playable claim, reactive / escalatory markers, popularity leaned on as support, a satire source
cited as fact). NONE of these is a verdict on the person or their intent. A sensitive-composer
observation OPENS a description of a structural feature of the text — it NEVER asserts the author
is a troll / bot / bad actor / toxic / hostile / aggressive / uncivil, or acting in bad faith. A
person-shift is not a personal-attack verdict: it records that the move's content addresses the
poster, never that the author is attacking anyone. An insult-only move is the absence of a
playable claim, never a label that the move "is an insult". A pause suggestion records reactive
markers, never a diagnosis that the author is "angry" or "unhinged". Popularity leaned on as
support is a §3 structural fact, never credit for the engagement and never a truth value. Satire
cited as fact is the evidentiary misuse, never a verdict that the claim is "false" or "fake".

Answer each sensitive-composer question above with true (the move exhibits the feature) or false
(the feature is absent OR not applicable to this move) for the move below. Return ONLY a single
JSON object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Sensitive features are usually sparse —
most moves exhibit 0 features; few exhibit more than 1. When unsure, answer false with low or
medium confidence. The feature MUST be clearly present to answer true; tonal similarity alone is
not enough.

If the move's own text itself contains a slur or person label ("you're such a troll", "you're
toxic", "bad actor", "name calling") or any judgment about the person, you MAY still detect the
underlying sensitive-composer feature — but your output evidenceSpan MUST NOT echo the slur or
person label. Anchor the evidenceSpan on the structural feature (the focus-shift wording, the
absent claim, the reactive markers, the popularity-leaning wording, the satire-as-fact citation)
— never on the slur or person label.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
