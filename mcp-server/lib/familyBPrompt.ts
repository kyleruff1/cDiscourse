/**
 * MCP-SERVER-003-FAMILY-B — Family B prompt construction.
 *
 * Single-prompt strategy per design §4: one Anthropic call covers all
 * 17 Family B rawKeys (14 MCP-SERVER-003-FAMILY-B + 3 MCP-BUILD2a). Token
 * budget ~1-2k input, MAX_TOKENS=1500 output (17 keys × ~80 tokens each
 * plus structured-output overhead).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A system prompt VERBATIM
 *     for the 7 absolute rules (winner / truth / popularity / person /
 *     hiding / blocking). Negations of banned tokens in the system prompt
 *     are doctrine-positive per the MCP-SERVER-002 precedent; the doctrine
 *     ban-list scan runs against the MODEL's RESPONSE, not the
 *     server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family B rawKey is structural-only; the user prompt instructs the
 *     model to classify the move's DISAGREEMENT axis toward its PARENT,
 *     never who is right.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *
 * Doctrine risks (per design §5):
 *   - disputes_value_weighting: source `falsePositiveGuards` includes the
 *     verbatim binding "copy MUST NOT imply one value is 'right'. The
 *     disagreement is genuine; both values are real." Surfaced in the
 *     per-rawKey prompt entry's `falsePositiveGuards` field.
 *   - disputes_relevance: source `falsePositiveGuards` includes the
 *     verbatim binding "Do NOT mark TRUE for dismissive moves with no
 *     argument; relevance dispute requires a reason." Surfaced in the
 *     per-rawKey prompt entry's `falsePositiveGuards` field.
 */
import { FAMILY_B_PROMPT_ENTRIES, FAMILY_B_RAW_KEYS } from './familyBKeys.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from './modelInfoEmissionDirective.ts';

/** MAX_TOKENS for the Family B response. 17 keys × ~80 tokens + overhead. */
export const FAMILY_B_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A. */
export const FAMILY_B_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_B_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family B. Mirrors the Family A system prompt's
 * 7 absolute rules VERBATIM (byte-equal to familyAPrompt.ts:50-57), then
 * adds Family-B-specific disagreement-axis framing.
 *
 * Per design §4: the 7 absolute rules are byte-equal to Family A's system
 * prompt (which is byte-equal to seedPrompt.ts).
 *
 * Per design §5.3: the descriptive framing line "Disagreement is productive
 * and structural; both sides remain valid contributions to the debate" is
 * the system-prompt-level reinforcement of the disputes_value_weighting +
 * disputes_relevance doctrine guards.
 *
 * Per design §4 umbrella/subtype handling: the system prompt describes the
 * umbrella/subtype relationship but does NOT auto-cascade; the model
 * answers each rawKey independently with conservative-positives bias.
 */
export const FAMILY_B_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits structural DISAGREEMENT relationships
toward its PARENT move. Each question is a structural observation about an axis of
disagreement, not a judgement about which side is right. Disagreement is productive and
structural; both sides remain valid contributions to the debate.

A move can simultaneously disagree on multiple sub-axes (e.g., factual + scope + analogy);
a move can express the umbrella disagreement (disagreement_present) without any specific
sub-axis being clearly positive. The umbrella key disagreement_present should be marked
true whenever ANY substantive disagreement is present; it is the binary "is there a
disagreement at all" structural fact.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a disagreement sub-axis is
present, answer false. Most moves exhibit 0 to 3 disagreement sub-axes; few exhibit more
than 5. Do NOT mark all rawKeys true. Tone alone is not disagreement; substantive
disagreement content is required for every positive.`;

/**
 * Validated Family B request input passed to buildFamilyBUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A's
 * ValidatedFamilyARequest, but kept distinct so future Family-specific
 * field additions don't cross-pollinate.
 */
export interface ValidatedFamilyBRequest {
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
 * Builds the user prompt for Family B classification.
 *
 * Structure per design §4:
 *   1. Disagreement-axis questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about umbrella + 13 sub-axes (replaces Family A's auto_metadata note)
 *   4. Shared modelInfo emission directive, then the response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (0 to 3 disagreement sub-axes)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 17 Family B keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyBUserPrompt(request: ValidatedFamilyBRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_B_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_B_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_B_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-b-v1"
  }
}`;

  return `Disagreement-axis questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about disagreement_present, the 13 disagreement sub-axes, and the 3 disagreement-quality observations:
disagreement_present is the umbrella key for "does this move express ANY substantive
disagreement with its parent". The 13 sub-axes (disputes_definition, disputes_scope,
disputes_fact, disputes_causal_link, disputes_value_weighting,
disputes_decision_criterion, disputes_generalization, disputes_analogy,
disputes_interpretation, disputes_priority_order, disputes_remedy_or_solution,
disputes_relevance, disputes_evidence_applicability) classify WHICH AXIS the
disagreement targets. The 3 disagreement-quality observations (isolates_main_disagreement,
distinguishes_fact_value_disagreement, preserves_face_while_disagreeing) describe HOW the
move carries its disagreement — whether it pins the specific point, separates fact from
value, and keeps the other party's standing intact. They are structural observations about
the move, never judgements of the author. Mark disagreement_present true whenever ANY
substantive disagreement is present; mark each sub-axis or quality observation true ONLY
when it genuinely applies. Answer each independently — do not auto-cascade.

Answer each disagreement-axis question above with true or false for the move below.
Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

${MODEL_INFO_EMISSION_DIRECTIVE}

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Most moves exhibit 0 to 3
disagreement sub-axes; few exhibit more than 5. When unsure, answer false with low or
medium confidence.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
