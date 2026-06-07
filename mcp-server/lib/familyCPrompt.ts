/**
 * MCP-SERVER-004-FAMILY-C — Family C prompt construction.
 *
 * Single-prompt strategy per design §2: one Anthropic call covers all
 * 20 Family C rawKeys (17 MCP-SERVER-004-FAMILY-C + 3 MCP-BUILD2c). Token
 * budget ~1-2k input, MAX_TOKENS=1500 output (20 keys × ~85 tokens each plus
 * structured-output overhead).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B system prompt VERBATIM
 *     for the 7 absolute rules (winner / truth / popularity / person /
 *     hiding / blocking). Negations of banned tokens in the system prompt
 *     are doctrine-positive per the MCP-SERVER-002/003 precedent; the
 *     doctrine ban-list scan runs against the MODEL's RESPONSE, not the
 *     server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family C rawKey is structural-only; the user prompt instructs the
 *     model to classify the move's REPAIR / GROUNDING signal toward its
 *     PARENT, never who was unclear or wrong.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *
 * Doctrine risks (per design §4):
 *   - rejects_candidate_understanding: NOT framed as "wrong". The rejector
 *     is saying "that is not what I meant," not "you are wrong." Symmetric
 *     to confirms_understanding.
 *   - acknowledges_misread: NOT framed as a failure of the original author.
 *     Acknowledging a misread is constructive repair work for the
 *     acknowledger.
 *   - flags_term_ambiguity: NOT framed as accusing the parent author of
 *     ambiguous writing. Flagging opens shared understanding.
 *   - clarified (lifecycle): tree-dependent. When only move text is visible
 *     (not the full cluster), answer FALSE with low confidence. Mirrors
 *     Family A's has_rebuttal/has_counter_rebuttal/rebutted lifecycle
 *     handling at familyAPrompt.ts:169-175.
 */
import { FAMILY_C_PROMPT_ENTRIES, FAMILY_C_RAW_KEYS } from './familyCKeys.ts';

/** MAX_TOKENS for the Family C response. 20 keys × ~85 tokens + overhead. */
export const FAMILY_C_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B. */
export const FAMILY_C_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_C_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family C. Mirrors the Family A/B system prompt's
 * 7 absolute rules VERBATIM (byte-equal to familyAPrompt.ts:50-57 and
 * familyBPrompt.ts:65-72), then adds Family-C-specific
 * collaborative-grounding framing.
 *
 * Per design §2: the 7 absolute rules are byte-equal to Family A's system
 * prompt (which is byte-equal to seedPrompt.ts and familyBPrompt.ts).
 *
 * Per design §2 + §4: the collaborative-grounding framing line "Repair is
 * collaborative grounding work; both sides remain valid contributors to
 * the discussion" is the system-prompt-level reinforcement of the
 * rejects_candidate_understanding + acknowledges_misread + flags_term_ambiguity
 * doctrine guards.
 *
 * Per design §2 cross-key handling: the system prompt names the
 * grounding-cycle relationships (offers→confirms/rejects; proposes→confirms)
 * but does NOT auto-cascade; the model answers each rawKey independently
 * with conservative-positives bias.
 */
export const FAMILY_C_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits structural REPAIR or GROUNDING relationships
toward its PARENT move (or toward the cluster). Each question is a structural observation
about a repair or grounding signal, not a judgement about which side is unclear or wrong.
Repair is collaborative grounding work; both sides remain valid contributors to the
discussion. A request for clarification, a candidate-understanding offer, a corrected
paraphrase, an acknowledged misread, an ambiguity flag, a proposed shared definition —
each is a grounding move that opens or closes a shared-understanding cycle. None of these
is a verdict on either participant.

A move can simultaneously exhibit multiple repair/grounding signals (e.g., asking for
clarification AND flagging a term ambiguity); a move can ground without explicitly closing
a cycle. Repair moves are usually sparse — most moves exhibit 0 to 2 repair signals; few
exhibit more than 4.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a repair signal is present, answer
false. Repair moves are sparse; do NOT mark all rawKeys true. Tone alone is not repair;
substantive grounding content (a question, a paraphrase, a definition proposal, an
acknowledged misread, an ambiguity flag) is required for every positive.`;

/**
 * Validated Family C request input passed to buildFamilyCUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A's
 * ValidatedFamilyARequest and Family B's ValidatedFamilyBRequest, but
 * kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyCRequest {
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
 * Builds the user prompt for Family C classification.
 *
 * Structure per design §2:
 *   1. Repair-grounding questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about clarified lifecycle (tree-dependent; FALSE-low when no cluster context)
 *   4. Note about repair-positive cross-key framing (4 doctrine-risk anchors)
 *   5. Response-shape instruction (verbatim JSON example)
 *   6. Conservative-positives bias reminder (0 to 2 repair signals)
 *   7. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 20 Family C keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyCUserPrompt(request: ValidatedFamilyCRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_C_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_C_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_C_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-c-v1"
  }
}`;

  return `Repair and grounding questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about clarified: this rawKey is a cluster-level lifecycle state — a
clarification request was answered with a clarifying response. When you receive only
the move text and parent text — without the full cluster lifecycle — answer FALSE
with low confidence unless the move text itself contains evidence of the closed
clarification cycle. The Edge Function caller may compute this lifecycle key
deterministically and skip your judgement.

Note about repair as collaborative grounding: each Family C rawKey is a structural
repair or grounding signal — a question, a paraphrase, an acknowledged misread, a
definition proposal, an ambiguity flag, a scope-mismatch observation. None of these
is a verdict on either participant. rejects_candidate_understanding is a normal
grounding signal symmetric to confirms_understanding (the rejector is saying "that
is not what I meant," not "you are wrong"). acknowledges_misread is the author's
own constructive repair of a prior misread, not a failure. flags_term_ambiguity
opens shared understanding; it does NOT imply the parent wrote ambiguously.
scope_mismatch_identified is descriptive — both participants may be operating at
different scopes, which is a structural fact, not a fault.

Answer each repair-grounding question above with true or false for the move below.
Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Repair moves are usually sparse
— most moves exhibit 0 to 2 repair signals; few exhibit more than 4. When unsure, answer
false with low or medium confidence.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
