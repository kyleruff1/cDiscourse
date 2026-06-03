/**
 * MCP-SERVER-007-FAMILY-F — Family F prompt construction.
 *
 * Single-prompt strategy per design §3: one Anthropic call covers all
 * 14 Family F rawKeys. Token budget ~85 tokens/key × 14 = ~1190 output;
 * MAX_TOKENS=1500 (matches Family A/B/C/E; NO bump per design §2; ~310
 * token headroom — comfortably wider than Family E's ~60 token headroom).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D/E system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the
 *     system prompt are doctrine-positive per the Family A-E precedent;
 *     the doctrine ban-list scan runs against the MODEL's RESPONSE, not
 *     the server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family F rawKey is structural-only; the user prompt instructs the
 *     model to flag CRITICAL QUESTIONS the move's reasoning has not yet
 *     answered, NEVER to adjudicate whether the reasoning is fallacious
 *     / weak / invalid. A critical question opens a productive inquiry;
 *     it never closes one with a verdict.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *
 * Doctrine risks (per design §3):
 *   - consequence_probability_unclear: HIGHEST RISK. Partners with Family
 *     E's slippery_slope_reasoning_present. NEVER framed as a verdict that
 *     the slippery-slope inference is a fallacy. The output evidenceSpan
 *     MUST be a verbatim quote anchoring the probability gap (which step
 *     of the chain lacks a probability anchor); MUST NOT contain
 *     "fallacy", "fallacious", "weak", "invalid", "flawed", "bad
 *     reasoning", "wrong", "proof of", "logical error", "informal
 *     fallacy", "unmet-means-fallacy", "proves wrong", "invalidates",
 *     "refutes". If the input text contains "fallacy", the model may
 *     still detect the unmet probability CQ but MUST NOT echo the
 *     fallacy framing in any output field.
 *   - analogy_mapping_missing: MEDIUM RISK. Partners with Family E's
 *     analogy_reasoning_present. NEVER framed as a fallacy.
 *   - alternative_explanation_available: MEDIUM RISK. Partners with
 *     Family E's abductive_explanation_present. NEVER framed as a
 *     fallacy.
 *   - causal_mechanism_missing: MEDIUM RISK. Partners with Family E's
 *     causal_reasoning_present. NEVER framed as a fallacy.
 *   - authority_basis_missing: MEDIUM RISK. Walton's expert-authority
 *     CQ. NEVER framed as a fallacy.
 *   - missing_warrant: MEDIUM RISK. Toulmin's warrant absence is
 *     sometimes literature-framed as "argument failure"; CDiscourse
 *     treats it as the productive question "what would warrant this
 *     claim?", NEVER as "this claim is unwarranted".
 */
import { FAMILY_F_PROMPT_ENTRIES, FAMILY_F_RAW_KEYS } from './familyFKeys.ts';

/** MAX_TOKENS for the Family F response. 14 keys × ~85 tokens + overhead. */
export const FAMILY_F_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D/E. */
export const FAMILY_F_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_F_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family F. Mirrors the Family A/B/C/D/E system
 * prompt's 7 absolute rules VERBATIM (byte-equal to familyAPrompt.ts /
 * familyBPrompt.ts / familyCPrompt.ts / familyDPrompt.ts /
 * familyEPrompt.ts:65-72), then adds Family-F-specific CQ-as-productive-
 * probe framing.
 *
 * Per design §3: the 7 absolute rules are byte-equal to Family A/B/C/D/E.
 *
 * Per design §3 BINDING: the system prompt explicitly forbids verdict
 * framing for CQs; states critical questions are PRODUCTIVE PROBES that
 * NEVER imply the argument scheme they probe is a fallacy; anchors
 * consequence_probability_unclear's E↔F partnership doctrine verbatim.
 */
export const FAMILY_F_SYSTEM_PROMPT =
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

You classify whether an argument MOVE has not yet answered one or more of 14 CRITICAL
QUESTIONS that productive inquiry would raise about the move's reasoning. Each question is
a structural observation about an ABSENCE or GAP — a warrant left implicit, an assumption
left unstated, an authority cited without basis, a cause asserted without mechanism, an
analogy used without mapping, an example offered without representativeness, a consequence
predicted without probability, a definition applied without boundary check, a criterion
invoked without weighting, an effect inferred without alternative explanations addressed,
a generalization made where counterexamples exist, a claim made without scope limits, a
claim made without modal qualification, a comparison made without baseline.

CRITICAL DOCTRINE — critical questions are PRODUCTIVE PROBES, never verdicts:
- A critical question flags a GAP the move has not yet filled. The gap MAY be filled by a
  follow-up clarification, a parent move's context, or a future reply. The CQ does NOT
  assert the gap is fatal, the inference is fallacious, the argument is weak, the reasoning
  is wrong, or the claim is invalidated. The CQ opens a productive inquiry; it never closes
  one with a verdict.
- A critical question NEVER implies the argument scheme it probes is a fallacy. Family E
  detects argument schemes (causal, analogy, example, authority, consequence, slippery-slope,
  etc.); Family F probes the critical questions associated with those schemes. The two are
  complementary, descriptive, and structurally independent. An unmet CQ does NOT mean E's
  scheme is fallacious. Per Walton (1995, 2008), every scheme has critical questions that
  PROBE without REJECTING the scheme.
- consequence_probability_unclear is the highest-doctrine-risk CQ. It partners with Family E's
  slippery_slope_reasoning_present (which E treats descriptively, never as a fallacy). When
  this CQ flags TRUE on a move that exhibits slippery-slope reasoning, the model's output
  MUST NOT call the slippery-slope inference a fallacy, fallacious, weak, invalid, bad
  reasoning, flawed, wrong, proves wrong, refutes, invalidates, an unmet-means-fallacy, or
  any verdict on argument quality. The output anchors the PROBABILITY GAP (which step of the
  chain lacks a probability anchor), never the conclusion that the chain is bad reasoning.

A move can simultaneously have multiple unmet CQs (e.g., causal_mechanism_missing AND
counterexample_available AND scope_limit_unstated). CQ positives are usually sparse — most
moves have 0 to 2 unmet CQs; few have more than 4.

For each requested rawKey you answer true (the CQ is unmet by this move) or false (the CQ is
either met OR not applicable to this move). Provide a short confidence band and an optional
evidenceSpan from the move body anchoring the gap. Return ONLY the JSON object the user
prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a CQ is genuinely unmet (rather than
addressed obliquely, addressed by the parent, or not applicable), answer false. CQ probes are
sparse — do NOT mark all rawKeys true. The CQ MUST be clearly absent or clearly inadequate
to answer true; partial answers count as answered.`;

/**
 * Validated Family F request input passed to buildFamilyFUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D/E
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyFRequest {
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
 * Builds the user prompt for Family F classification.
 *
 * Structure per design §3:
 *   1. Critical-question questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about CQ-as-productive-probe cross-key framing (doctrine anchors for
 *      consequence_probability_unclear / analogy_mapping_missing /
 *      alternative_explanation_available / causal_mechanism_missing /
 *      authority_basis_missing / missing_warrant)
 *   4. Response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (0 to 2 CQs)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 14 Family F keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyFUserPrompt(request: ValidatedFamilyFRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_F_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_F_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_F_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-f-v1"
  }
}`;

  return `Critical-question questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about critical questions as productive probes: each Family F rawKey is a structural
fact about which CRITICAL QUESTION the move's reasoning has not yet answered (warrant absence,
assumption absence, authority basis absence, causal mechanism absence, analogy mapping
absence, example representativeness gap, consequence probability gap, definition boundary
gap, criterion weighting gap, alternative explanation gap, counterexample absence, scope
limit absence, qualification absence, comparison baseline absence). NONE of these is a verdict
on the move's quality. Critical questions OPEN productive inquiry — they NEVER mean the
argument scheme is a fallacy, weak, invalid, flawed, wrong, bad reasoning, or refuted. Per
Walton (1995, 2008): every scheme has critical questions that PROBE without REJECTING the
scheme. consequence_probability_unclear is the highest-risk CQ — it partners with Family E's
slippery_slope_reasoning_present scheme; flagging the probability gap NEVER means the chain
inference is a fallacy. analogy_mapping_missing partners with Family E's
analogy_reasoning_present; flagging the mapping gap NEVER means analogy reasoning is
fallacious. alternative_explanation_available partners with Family E's
abductive_explanation_present (Peirce: inference to best explanation); flagging the
alternative gap NEVER means abductive reasoning is fallacious.

Answer each critical question above with true (CQ unmet by this move) or false (CQ met OR
not applicable to this move) for the move below. Return ONLY a single JSON object — no
prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

STRICT RESPONSE-SHAPE CONTRACT — the JSON object you return MUST satisfy every rule below.

1. KEY-SET EQUALITY. The four sets — checkedRawKeys (as a set), observations keys, confidence
   keys, and evidenceSpan keys — MUST be identical. Same exact rawKey strings, same count, no
   extras, no omissions, no duplicates. If these four sets differ by even one entry, the
   packet is rejected and the cell will retry or dead-letter.

2. INCLUDE EVERY REQUESTED RAWKEY EXACTLY ONCE. The critical-question questions block above
   lists the rawKeys you must probe. Each of those rawKeys MUST appear exactly once in
   checkedRawKeys, observations, confidence, AND evidenceSpan. Do NOT silently drop any
   requested rawKey — including alternative_explanation_available,
   consequence_probability_unclear, analogy_mapping_missing, missing_warrant, or any other
   critical question. Do NOT introduce a rawKey that was not in the requested set.

3. EVIDENCESPAN VALUE TYPE. Each evidenceSpan[rawKey] value is EITHER:
   (a) a short string copied or paraphrased from the supplied move/parent/thread-context text,
       up to 240 characters, OR
   (b) the JSON literal null.
   NEVER an object. NEVER an array. NEVER a boolean. NEVER a number. NEVER a missing entry
   (use null instead). This rule applies uniformly to EVERY rawKey — no critical question has
   a special nested or structured evidenceSpan shape. alternative_explanation_available uses
   the same string-or-null shape as every other CQ rawKey.

4. NULL EVIDENCESPAN FOR FALSE OBSERVATIONS. When observations[rawKey] is false, set
   evidenceSpan[rawKey] to null. A CQ that is met or not applicable does not need an
   anchoring quote. When observations[rawKey] is true, evidenceSpan[rawKey] SHOULD be a
   concise quote anchored on the structural gap in the input text; if no anchoring text
   actually exists in the input, set observations[rawKey] back to false and
   evidenceSpan[rawKey] to null rather than emitting an unanchored or fabricated quote.

5. SELF-CHECK BEFORE EMITTING. Before you return the JSON, verify all of:
   - The length of checkedRawKeys equals the key count of observations, of confidence, and of
     evidenceSpan.
   - The exact rawKey strings in checkedRawKeys appear as keys in observations, in confidence,
     and in evidenceSpan — no rename, no typo, no case drift.
   - Every evidenceSpan value is a string (≤ 240 chars) or null — no other type.
   - No requested rawKey has been silently dropped; no rawKey beyond the requested set has
     been introduced.
   If any check fails, regenerate the packet rather than emit it.

6. RAWKEY-SHAPE REINFORCEMENT — alternative_explanation_available.
   The evidenceSpan entry for alternative_explanation_available uses EXACTLY the same
   string-or-null shape as every other CQ rawKey. Allowed values for
   evidenceSpan.alternative_explanation_available:
   (a) a JSON string up to 240 characters quoting or paraphrasing the move text that
       anchors the alternative-explanation gap; OR
   (b) the JSON literal null.
   Not allowed: a nested JSON object such as { "quote": "…", "band": "high" }; an array
   such as [ "…", "…" ]; a boolean; a number; a missing entry. This shape rule holds whether
   observations.alternative_explanation_available is true or false. When false, the value
   MUST be null. When true, the value MUST be a single string ≤ 240 chars (or null if no
   anchor text exists, in which case set the observation back to false). The validator
   rejects every non-string non-null value at the exact path
   evidenceSpan.alternative_explanation_available.

7. RAWKEY-SHAPE REINFORCEMENT — unstated_assumption.
   The evidenceSpan entry for unstated_assumption uses EXACTLY the same
   string-or-null shape as every other CQ rawKey. Allowed values for
   evidenceSpan.unstated_assumption:
   (a) a JSON string up to 240 characters quoting or paraphrasing the move text that
       anchors the unstated-assumption gap; OR
   (b) the JSON literal null.
   Not allowed: a nested JSON object such as { "quote": "…", "band": "high" }; an array
   such as [ "…", "…" ]; a boolean; a number; a missing entry. This shape rule holds whether
   observations.unstated_assumption is true or false. When false, the value
   MUST be null. When true, the value MUST be a single string ≤ 240 chars (or null if no
   anchor text exists, in which case set the observation back to false). The validator
   rejects every non-string non-null value at the exact path
   evidenceSpan.unstated_assumption.

Conservative-positives bias: do NOT mark all rawKeys true. CQ probes are usually sparse —
most moves exhibit 0 to 2 unmet CQs; few exhibit more than 4. When unsure, answer false
with low or medium confidence. The CQ MUST be clearly absent or clearly inadequate to
answer true; partial answers count as answered.

If the move's text itself contains the word "fallacy" or any quality judgment about
reasoning, you MAY still detect the underlying CQ gap — but your output evidenceSpan
MUST NOT echo the fallacy framing. Anchor the evidenceSpan on the structural gap
(the missing warrant, the missing mechanism, the missing probability anchor, the
missing baseline) — never on the framing words.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
