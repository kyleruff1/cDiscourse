/**
 * MCP-SERVER-010-FAMILY-I — Family I prompt construction.
 *
 * Single-prompt strategy per design §A.3: one Anthropic call covers all 6
 * Family I ai_classifier rawKeys. Token budget ~85 tokens/key × 6 = ~510
 * naive; the conservative-positives bias (topology positives are sparse —
 * most moves have 0 to 2) keeps realistic output far under the budget.
 * MAX_TOKENS=1500 (matches Family A/B/C/E/F/G/H; NO bump per design §A.2 — I
 * has ~990 token headroom, the LARGEST absolute headroom of any family A-I to
 * date).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D/E/F/G/H system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the system
 *     prompt are doctrine-positive per the Family A-H precedent; the doctrine
 *     ban-list scan runs against the MODEL's RESPONSE, not the
 *     server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every Family I
 *     rawKey is structural-only; the user prompt instructs the model to flag
 *     a DESCRIPTIVE THREAD-TOPOLOGY relation the move exhibits, NEVER to
 *     adjudicate whether the move is on-topic / off-topic / derailing /
 *     evasive / scattered / rehashing / repetitive. A thread-topology
 *     observation describes HOW A MOVE RELATES TO THE CONVERSATION GRAPH —
 *     whether it opens a new issue, cites common ground, narrows into a
 *     sub-axis, returns to a parked topic, reaches outside the room, or
 *     weighs options.
 *   - cdiscourse-doctrine §3 (popularity ≠ evidence): the
 *     references_external_context key NEVER treats an external reference as
 *     granting factual standing.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this module
 *     is server-side only; never imported into src/ or app/.
 *   - point-standing-economy: topology relations are SHAPES in the
 *     conversation graph, not standing penalties; I emits no standing delta.
 *
 * Doctrine risks (per design §A.3) — doctrine-risk = LOW; the 2 misreadable
 * keys:
 *   - introduces_new_issue: the one key a careless reader could mis-frame as
 *     "off-topic" / "derailing" / "evasive". A new issue is a structural
 *     BRANCHING event, not a derailment. If the input move text says "I'm
 *     changing the subject" / "off-topic", the model may still detect the new
 *     issue but MUST NOT echo "off-topic"/"derailing"/"evasive".
 *   - returns_to_prior_issue: the one key a careless reader could mis-frame
 *     as "rehashing" / "repetitive" / "going in circles". Re-engagement is
 *     often productive when it brings new evidence; the absence is never
 *     framed as a verdict on the move's quality.
 *   (No HIGHEST-risk axis-partner key — the upstream taxonomy DROPPED the one
 *   verdict-adjacent candidate `repeats_prior_point` before this card.)
 */
import { FAMILY_I_PROMPT_ENTRIES, FAMILY_I_RAW_KEYS } from './familyIKeys.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from './modelInfoEmissionDirective.ts';

/** MAX_TOKENS for the Family I response. 6 keys; positives are sparse. */
export const FAMILY_I_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D/E/F/G/H. */
export const FAMILY_I_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_I_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family I. Mirrors the Family A/B/C/D/E/F/G/H system
 * prompt's 7 absolute rules VERBATIM (byte-equal to familyHPrompt.ts:86-92),
 * then adds Family-I-specific descriptive-topology framing.
 *
 * Per design §A.3.1: the 7 absolute rules are byte-equal to Family A-H.
 *
 * Per design §A.3.1 BINDING: the system prompt explicitly forbids verdict
 * framing for thread-topology relations; states thread-topology observations
 * are DESCRIPTIVE STRUCTURE that NEVER assert whether the move is on-topic /
 * off-topic, whether the speaker is derailing / evasive / scattered /
 * rehashing, or whether introducing / returning to an issue is good or bad;
 * anchors the new-issue-as-branching, return-as-re-engagement,
 * external-reference-as-structural-not-evidence, comparison-as-structure-not-
 * adjudication doctrine verbatim.
 */
export const FAMILY_I_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits one or more THREAD-TOPOLOGY structural
relations to the conversation graph — whether the move introduces a new issue distinct from
the parent's topic, references a prior agreement established earlier, opens a sub-axis within
the parent's topic, returns to a previously-parked issue, references external context (a URL /
document / event from outside the room), or compares two or more options against stated
criteria.

CRITICAL DOCTRINE — thread-topology relations are DESCRIPTIVE STRUCTURE, never verdicts:
- A thread-topology observation describes HOW A MOVE RELATES TO THE CONVERSATION GRAPH —
  whether it opens a new issue, cites common ground, narrows into a sub-axis, returns to a
  parked topic, reaches outside the room, or weighs options. It NEVER asserts whether the move
  is "on-topic" or "off-topic" as a quality verdict, whether the speaker is "derailing",
  "evasive", "scattered", or "dodging", or whether returning to / introducing an issue is good
  or bad.
- A new issue is not a derailment. When a move is detected as introduces_new_issue, the
  observation records that the move opens a topic distinct from the parent's subject. It NEVER
  frames this as "off-topic", "derailing", "evasive", "changing the subject to avoid", or any
  judgment of the speaker's motive. Introducing a new issue is a structural branching event,
  not a fault.
- Returning to a prior issue is not repetition. When a move is detected as
  returns_to_prior_issue, the observation records that the move re-engages an earlier-parked
  topic. It NEVER frames this as "rehashing", "going in circles", "beating a dead horse", or
  "repetitive" — returning to a parked issue is often productive when it brings new evidence.
- Referencing external context is not authority by popularity. When a move is detected as
  references_external_context, the observation records that the move reaches outside the room
  (a URL, document, event). It NEVER treats the external reference as automatically granting
  the claim factual standing — popularity / virality / engagement of an external source is NOT
  evidence (cdiscourse-doctrine §3). The observation is the structural fact of the reference,
  not an endorsement of its weight.
- Comparing options is not picking a winner. When a move is detected as compares_options, the
  observation records that the move weighs two or more options. It NEVER asserts which option
  is "correct", "better", or "wins" as a verdict — even when the move's own text concludes one
  option wins, the observation records the STRUCTURE of the comparison, not an adjudication.
- The output MUST NOT contain the words: off-topic, derailing, derail, evasive, evading,
  dodging, dodge, scattered, rambling, rehashing, repetitive, "going in circles", "changing
  the subject", "beating a dead horse", "off the rails", "winner", "loser", "the right
  option", "the correct choice". If the input move text itself contains such words, the model
  MAY still detect the underlying topology relation, but its own output evidence_span MUST
  anchor the structural relation (the new topic opened, the prior agreement cited, the
  sub-axis, the parked issue returned to, the external reference, the compared options), never
  echo the verdict framing.

A move can simultaneously exhibit multiple thread-topology relations (e.g., introduces_sub_axis
AND compares_options). Thread-topology signals are usually sparse — most moves have 0 to 2
positives; many moves stay on the parent's topic and exhibit none.

For each requested rawKey you answer true (the move exhibits the relation) or false (the
relation is absent OR not applicable to this move). Provide a short confidence band and an
optional evidenceSpan from the move body anchoring the structural relation. Return ONLY the
JSON object the user prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a thread-topology relation is genuinely
exhibited (rather than merely tonally adjacent, or addressed obliquely, or not applicable),
answer false. Thread-topology signals are sparse — do NOT mark all rawKeys true. The relation
MUST be clearly present to answer true.`;

/**
 * Validated Family I request input passed to buildFamilyIUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D/E/F/G/H
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyIRequest {
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
 * Builds the user prompt for Family I classification.
 *
 * Structure per design §A.3:
 *   1. Thread-topology questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about thread-topology-as-descriptive-structure cross-key framing
 *      (the topology↔verdict doctrine anchors)
 *   4. Shared modelInfo emission directive, then the response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (0 to 2 relations)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 6 Family I keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyIUserPrompt(request: ValidatedFamilyIRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_I_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_I_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_I_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-i-v1"
  }
}`;

  return `Thread-topology questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about thread-topology relations as DESCRIPTIVE STRUCTURE: each Family I rawKey is a
structural fact about HOW THE MOVE RELATES TO THE CONVERSATION GRAPH (a new issue opened, a
prior agreement cited, a sub-axis opened within the topic, a previously-parked issue returned
to, external context referenced, two or more options compared). NONE of these is a verdict on
the move's quality or the speaker's motive. A thread-topology observation OPENS a description
of how the move connects to the conversation structure — it NEVER asserts the move is
on-topic / off-topic / derailing / evasive / scattered / rehashing / repetitive. A new issue
is not a derailment: introducing a new topic is a structural BRANCHING event, never an
off-topic verdict. Returning to a prior issue is not repetition: re-engaging a parked topic is
often productive, never "going in circles". Referencing external context is not authority by
popularity: an external reference is a structural fact, never automatic factual standing.
Comparing options is not picking a winner: a comparison records STRUCTURE, never an
adjudication of which option wins.

Answer each thread-topology question above with true (the move exhibits the relation) or false
(the relation is absent OR not applicable to this move) for the move below. Return ONLY a
single JSON object — no prose, no markdown, no code fence, no chain-of-thought.

${MODEL_INFO_EMISSION_DIRECTIVE}

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Thread-topology signals are usually
sparse — most moves exhibit 0 to 2 relations; many moves stay on the parent's topic and exhibit
none. When unsure, answer false with low or medium confidence. The relation MUST be clearly
present to answer true; tonal similarity alone is not enough.

If the move's text itself contains verdict words ("off-topic", "you keep dodging", "rehashing",
"going in circles") or any judgment about the speaker, you MAY still detect the underlying
thread-topology relation — but your output evidenceSpan MUST NOT echo the verdict framing.
Anchor the evidenceSpan on the structural relation (the new topic opened, the prior agreement
cited, the sub-axis, the parked issue returned to, the external reference, the compared
options) — never on the verdict words.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
