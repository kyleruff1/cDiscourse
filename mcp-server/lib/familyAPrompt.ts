/**
 * MCP-SERVER-002 — Family A prompt construction.
 *
 * Single-prompt strategy per design §2.1: one Anthropic call covers all
 * 16 Family A rawKeys. Token budget ~4-5k input, MAX_TOKENS=1500 output
 * (16 keys × ~60-90 tokens each plus structured-output overhead). See
 * design doc §2.2 for budget math.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the semantic-move system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the
 *     system prompt are doctrine-positive per the MCP-SERVER-001
 *     precedent; the doctrine ban-list scan runs against the MODEL's
 *     RESPONSE, not the server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family A rawKey is structural-only; the user prompt instructs the
 *     model to classify the move's STRUCTURE toward its PARENT, never
 *     who is right.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 */
import { FAMILY_A_PROMPT_ENTRIES, FAMILY_A_RAW_KEYS } from './familyAKeys.ts';

/** MAX_TOKENS for the Family A response. 16 keys × ~80 tokens + overhead. */
export const FAMILY_A_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors the semantic-move tool. */
export const FAMILY_A_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_A_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family A. Mirrors the semantic-move system prompt's
 * 7 absolute rules VERBATIM, then adds Family-A-specific structural framing.
 *
 * Per design §2.3: the 7 absolute rules are byte-equal to seedPrompt.ts.
 * Per design §2.7: doctrine ban-list scan on the literal text returns
 *   0 hits — the `winner` / `truth` etc. tokens appear only as NEGATIONS
 *   ("You do NOT decide the winner"), which is doctrine-positive. The
 *   doctrine ban-list scan runs against the model's RESPONSE, not the
 *   server-constructed prompt.
 */
export const FAMILY_A_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits structural relationships toward its PARENT
move. Each question is an observation about the move's STRUCTURE, not a judgement about who
is right. A move can simultaneously challenge and refine; a move can support without making
a factual standing claim; a move can question without disagreeing.

For each requested rawKey you answer true or false with a short confidence band and an
optional evidenceSpan from the move body. Return ONLY the JSON object the user prompt
describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a structural relationship is
present, answer false. Most moves exhibit 2 to 4 of the requested relationships; few exhibit
more than 6. Do NOT mark all rawKeys true. Do NOT mark a relationship true based on tone,
politeness, or surface-level affirmation — substantive content is required for every positive.`;

/**
 * Validated Family A request input passed to buildFamilyAUserPrompt.
 * Mirror of the wire shape per MCP-021A; see familyABooleanRequestSchema.ts.
 */
export interface ValidatedFamilyARequest {
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
 * Builds the user prompt for Family A classification.
 *
 * Structure per design §2.4:
 *   1. Structural questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about has_rebuttal / has_counter_rebuttal / rebutted limitations
 *   4. Response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 16 Family A keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyAUserPrompt(request: ValidatedFamilyARequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_A_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_A_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_A_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-a-v1"
  }
}`;

  return `Structural questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about has_rebuttal, has_counter_rebuttal, and rebutted: these three rawKeys describe
structural facts derivable from the argument tree (whether the move has child / grandchild
moves of specific types, whether a cluster is in a particular lifecycle state). When you
receive only the move text and parent text — without the full argument tree — answer FALSE
with low confidence unless the move's text itself contains evidence of these structural
relationships. The Edge Function caller may compute these three keys deterministically and
skip your judgement.

Answer each structural question above with true or false for the move below.
Return ONLY a single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Most moves exhibit 2 to 4
positive structural relationships. When unsure, answer false with low or medium confidence.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
