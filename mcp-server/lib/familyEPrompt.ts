/**
 * MCP-SERVER-006-FAMILY-E + MCP-BUILD2e — Family E prompt construction.
 *
 * Single-prompt strategy per design §1: one Anthropic call covers all
 * 19 Family E rawKeys (16 MCP-SERVER-006-FAMILY-E + 3 MCP-BUILD2e). Token
 * budget ~85 tokens/key × 19 = ~1615 output; MAX_TOKENS=1500 (matches
 * Family A/B/C; NO bump — the model returns compact booleans + sparse
 * evidenceSpans, well under the cap in practice, as for Family C's 20 keys).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the
 *     system prompt are doctrine-positive per the MCP-SERVER-002/003/004
 *     precedent; the doctrine ban-list scan runs against the MODEL's
 *     RESPONSE, not the server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family E rawKey is structural-only; the user prompt instructs the
 *     model to classify which inferential PATTERN the move uses, never
 *     to adjudicate whether the pattern is fallacious / weak / invalid.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *
 * Doctrine risks (per design §3):
 *   - slippery_slope_reasoning_present: HIGHEST RISK. NEVER framed as a
 *     fallacy. The output evidenceSpan MUST be a verbatim quote anchoring
 *     the chain-of-consequences pattern; MUST NOT contain "fallacy",
 *     "fallacious", "weak", "invalid", "flawed", "bad reasoning", "wrong",
 *     "proof of", "logical error". If the input text contains "fallacy",
 *     the model may still detect the pattern but MUST NOT echo the
 *     fallacy framing in any output field.
 *   - abductive_explanation_present: NOT framed as a fallacy. Peirce's
 *     inference-to-best-explanation is a normal scheme in scientific argument.
 *   - analogy_reasoning_present: NOT framed as a fallacy. Walton's analogy
 *     scheme; critical question lives in Family F.
 */
import { FAMILY_E_PROMPT_ENTRIES, FAMILY_E_RAW_KEYS } from './familyEKeys.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from './modelInfoEmissionDirective.ts';

/** MAX_TOKENS for the Family E response. 19 keys × ~85 tokens + overhead. */
export const FAMILY_E_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D. */
export const FAMILY_E_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_E_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family E. Mirrors the Family A/B/C/D system prompt's
 * 7 absolute rules VERBATIM (byte-equal to familyAPrompt.ts:50-57 /
 * familyBPrompt.ts:65-72 / familyCPrompt.ts:73-79 / familyDPrompt.ts:80-87),
 * then adds Family-E-specific scheme-as-descriptive framing.
 *
 * Per design §3: the 7 absolute rules are byte-equal to Family A/B/C/D.
 *
 * Per design §3 + amendment §3 BINDING: the system prompt explicitly states
 * critical questions live in Family F, not Family E; Family E only detects
 * the PATTERN. Three schemes carry doctrine risk and get explicit anchors
 * in the system prompt: slippery_slope / abductive / analogy.
 */
export const FAMILY_E_SYSTEM_PROMPT =
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

You classify whether an argument MOVE uses one or more of 16 Walton (1995, 2008) argumentation
SCHEMES as its primary inferential support, plus 3 inference-structure observations (linked vs.
convergent premise structure, and whether the move relies on an unstated load-bearing premise)
— 19 argument-structure observations in total. Each question is a structural observation about
the form of the move's reasoning — not a judgment about whether that reasoning is fallacious,
weak, valid, invalid, sound, unsound, or bad. Schemes are descriptive shape facts. Every
scheme has a corresponding CRITICAL QUESTION (these live in Family F, not here); detecting a
scheme NEVER means the scheme's critical questions are unmet. The inference-structure
observations are descriptive shape facts too: detecting an unstated-premise gap is an
invitation to state the premise; you MUST NOT call this gap weak, wrong, flawed, or invalid.

CRITICAL DOCTRINE — three schemes carry special framing risk because the literature sometimes
frames them as fallacies:
- slippery_slope_reasoning_present is a SCHEME. CDiscourse treats it descriptively — the
  move uses a chain-of-consequences inference pattern. The output MUST NOT call this a
  fallacy, fallacious, weak, invalid, bad reasoning, a logical error, flawed, wrong,
  or proof of anything. The corresponding critical question (consequence_probability_unclear,
  Family F) is the place where chain-step probability is probed; this family only detects the
  PATTERN, never adjudicates it.
- abductive_explanation_present is a SCHEME (Peirce: inference to best explanation). It is
  not a fallacy; it is a normal pattern in scientific argument. Detecting it does NOT mean
  the inference is sound.
- analogy_reasoning_present is a SCHEME (Walton: analogy scheme). It is not a fallacy; the
  critical question (analogy_mapping_missing, Family F) probes the mapping; this family only
  detects the PATTERN.

A move can simultaneously exhibit multiple schemes (e.g., causal AND consequence AND
slippery-slope when reasoning chains causes into a multi-step bad outcome). Schemes are
usually sparse — most moves exhibit 0 to 2 schemes; few exhibit more than 4.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a scheme is the move's PRIMARY
inferential support (not merely incidental), answer false. Schemes are sparse — do NOT mark
all rawKeys true. Tone alone is not a scheme; substantive inferential weight on the scheme's
pattern is required for every positive.`;

/**
 * Validated Family E request input passed to buildFamilyEUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyERequest {
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
 * Builds the user prompt for Family E classification.
 *
 * Structure per design §3:
 *   1. Argument-scheme questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about scheme-as-descriptive cross-key framing (doctrine anchors for
 *      slippery_slope / abductive / analogy)
 *   4. Shared modelInfo emission directive, then the response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (0 to 2 schemes)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 19 Family E keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyEUserPrompt(request: ValidatedFamilyERequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_E_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_E_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_E_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-e-v1"
  }
}`;

  return `Argument-scheme questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about schemes as descriptive patterns: each Family E rawKey is a structural
fact about which inferential PATTERN the move uses (causal chain, analogy mapping,
example generalization, authority appeal, consequence prediction, principle
application, definition application, classification, precedent, means-end, tradeoff
balance, abductive inference, exception identification, chain-of-consequences,
cost-benefit, risk). NONE of these is a verdict on the move's quality. Schemes have
critical questions (Family F counterparts) that probe whether each scheme's preconditions
are met — but those questions live in Family F, not here. Detecting a scheme NEVER means
the scheme's critical questions are unmet. slippery_slope_reasoning_present is a SCHEME,
never a fallacy. abductive_explanation_present (Peirce: inference to best explanation) is
a SCHEME, not a fallacy. analogy_reasoning_present is a SCHEME (Walton), not a fallacy.

Answer each argument-scheme question above with true or false for the move below.
Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

${MODEL_INFO_EMISSION_DIRECTIVE}

The object MUST conform to this shape:
${responseShape}

STRICT RESPONSE-SHAPE CONTRACT — the JSON object you return MUST satisfy every rule below.

1. KEY-SET EQUALITY. The four sets — checkedRawKeys (as a set), observations keys, confidence
   keys, and evidenceSpan keys — MUST be identical. Same exact rawKey strings, same count, no
   extras, no omissions, no duplicates. If these four sets differ by even one entry, the
   packet is rejected and the cell will retry or dead-letter.

2. INCLUDE EVERY REQUESTED RAWKEY EXACTLY ONCE. The argument-scheme questions block above lists
   the rawKeys you must evaluate. Each of those rawKeys MUST appear exactly once in
   checkedRawKeys, observations, confidence, AND evidenceSpan. Do NOT silently drop any
   requested rawKey — including abductive_explanation_present, slippery_slope_reasoning_present,
   analogy_reasoning_present, or any other scheme. Do NOT introduce a rawKey that was not in
   the requested set.

3. EVIDENCESPAN VALUE TYPE. Each evidenceSpan[rawKey] value is EITHER:
   (a) a short string copied or paraphrased from the supplied move/parent/thread-context text,
       up to 240 characters, OR
   (b) the JSON literal null.
   NEVER an object. NEVER an array. NEVER a boolean. NEVER a number. NEVER a missing entry
   (use null instead). This rule applies uniformly to EVERY rawKey — no scheme has a special
   nested or structured evidenceSpan shape. abductive_explanation_present uses the same
   string-or-null shape as every other scheme key.

4. NULL EVIDENCESPAN FOR FALSE OBSERVATIONS. When observations[rawKey] is false, set
   evidenceSpan[rawKey] to null. A negative observation does not need an anchoring quote.
   When observations[rawKey] is true, evidenceSpan[rawKey] SHOULD be a concise quote anchored
   in the input text; if no anchoring text actually exists in the input, set
   observations[rawKey] back to false and evidenceSpan[rawKey] to null rather than emitting
   an unanchored or fabricated quote.

5. SELF-CHECK BEFORE EMITTING. Before you return the JSON, verify all of:
   - The length of checkedRawKeys equals the key count of observations, of confidence, and of
     evidenceSpan.
   - The exact rawKey strings in checkedRawKeys appear as keys in observations, in confidence,
     and in evidenceSpan — no rename, no typo, no case drift.
   - Every evidenceSpan value is a string (≤ 240 chars) or null — no other type.
   - No requested rawKey has been silently dropped; no rawKey beyond the requested set has
     been introduced.
   If any check fails, regenerate the packet rather than emit it.

6. RAWKEY-SHAPE REINFORCEMENT — abductive_explanation_present.
   The evidenceSpan entry for abductive_explanation_present uses EXACTLY the same
   string-or-null shape as every other rawKey. Allowed values for
   evidenceSpan.abductive_explanation_present:
   (a) a JSON string up to 240 characters quoting or paraphrasing the move text that
       anchors the inferred best explanation pattern; OR
   (b) the JSON literal null.
   Not allowed: a nested JSON object such as { "quote": "…", "band": "high" }; an array
   such as [ "…", "…" ]; a boolean; a number; a missing entry. This shape rule holds whether
   observations.abductive_explanation_present is true or false. When false, the value MUST be
   null. When true, the value MUST be a single string ≤ 240 chars (or null if no anchor text
   exists, in which case set the observation back to false). The validator rejects every
   non-string non-null value at the exact path evidenceSpan.abductive_explanation_present.

7. RAWKEY-SHAPE REINFORCEMENT — convergent_premise_structure.
   convergent_premise_structure is the SCHEME where premises each INDEPENDENTLY support
   the conclusion. The shape of that inference is multi-premise by definition, BUT the
   evidenceSpan entry is NOT a per-premise structure. The evidenceSpan entry uses the
   exact same string-or-null shape as every other rawKey. Allowed values for
   evidenceSpan.convergent_premise_structure:
   (a) a single JSON string up to 240 characters that anchors the convergent-premise
       pattern in the move (a concise paraphrase of one anchoring phrase from the move,
       not the whole list of premises); OR
   (b) the JSON literal null.
   Not allowed: a JSON array such as [ "premise 1", "premise 2", "premise 3" ]; a JSON
   object such as { "premise_a": "…", "premise_b": "…" }; a boolean; a number; a missing
   entry; a string longer than 240 characters. If the move's anchoring text would exceed
   240 characters, choose a concise sub-span or paraphrase rather than truncating
   mid-sentence; if no single anchor span fits, set the value to null. When
   observations.convergent_premise_structure is false, the value MUST be null. The
   validator rejects every non-string non-null value at the exact path
   evidenceSpan.convergent_premise_structure.

8. RAWKEY-SHAPE REINFORCEMENT — tradeoff_reasoning_present.
   tradeoff_reasoning_present is the SCHEME where the move weighs tradeoffs across two
   or more considerations. Even though the underlying pattern has multiple sides, the
   evidenceSpan entry uses the exact same string-or-null shape as every other rawKey.
   Allowed values for evidenceSpan.tradeoff_reasoning_present:
   (a) a single JSON string up to 240 characters that anchors the tradeoff-weighing
       pattern in the move (a concise paraphrase, not a pro/con table); OR
   (b) the JSON literal null.
   Not allowed: a JSON object such as { "pro": "…", "con": "…" } or { "benefit": "…",
       "cost": "…" }; a JSON array such as [ "pro side", "con side" ]; a boolean; a number;
   a missing entry; a string longer than 240 characters. If the anchoring text would
   exceed 240 characters, choose a concise sub-span or paraphrase rather than truncating
   mid-sentence; if no single anchor span fits, set the value to null. When
   observations.tradeoff_reasoning_present is false, the value MUST be null. The
   validator rejects every non-string non-null value at the exact path
   evidenceSpan.tradeoff_reasoning_present.

Conservative-positives bias: do NOT mark all rawKeys true. Schemes are usually sparse —
most moves exhibit 0 to 2 schemes; few exhibit more than 4. When unsure, answer false
with low or medium confidence. Tone alone is not a scheme; substantive inferential weight
on the scheme's pattern is required for every positive.

If the move's text itself contains the word "fallacy" or any quality judgment about
reasoning, you MAY still detect the underlying scheme PATTERN — but your output evidenceSpan
MUST NOT echo the fallacy framing. Anchor the evidenceSpan on the structural pattern
(the chain, the analogy, the causal claim) — never on the framing words.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
