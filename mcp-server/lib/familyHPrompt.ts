/**
 * MCP-SERVER-009-FAMILY-H — Family H prompt construction.
 *
 * Single-prompt strategy per design §A.3: one Anthropic call covers all
 * 12 Family H ai_classifier rawKeys. Token budget ~85 tokens/key × 12 =
 * ~1020 naive; the conservative-positives bias (positives are sparse —
 * most moves have 1 to 3) keeps realistic output far under the budget.
 * MAX_TOKENS=1500 (matches Family A/B/C/E/F/G; NO bump per design §A.2 — H
 * has ~480 token headroom, the largest absolute headroom of any family
 * A-H to date).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D/E/F/G system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the
 *     system prompt are doctrine-positive per the Family A-G precedent;
 *     the doctrine ban-list scan runs against the MODEL's RESPONSE, not
 *     the server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family H rawKey is structural-only; the user prompt instructs the
 *     model to flag a DESCRIPTIVE FORMULATION-STATE the move exhibits,
 *     NEVER to adjudicate whether the move is weak / strong / bad / good
 *     / sloppy / sound / valid / invalid / complete / incomplete /
 *     supported / unsupported. A claim-clarity observation describes the
 *     SURFACE FORMULATION of a move — whether a claim is stated, whether
 *     a reason is attached, whether the claim is scoped narrowly or
 *     broadly, whether a referent is unambiguous, whether a temporal
 *     scope is attached.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *   - point-standing-economy: broad scope and reason absence are SHAPES,
 *     not standing penalties; H emits no standing delta.
 *
 * Doctrine risks (per design §A.3) — the 4 HIGHEST-risk keys:
 *   - claim_specificity_low: HIGHEST RISK (the axis-partner). A broad
 *     claim is the single key most likely to be mis-framed as "weak/
 *     vague/lazy/sloppy". The output evidence_span MUST anchor the
 *     verbatim broad-scoped wording; MUST NOT contain weak / sloppy /
 *     lazy / careless / confused / unsound / unsupported / incoherent /
 *     illogical. If the input move text says "I wrote a weak argument" /
 *     "my claim was vague", the model may still detect the broad scope
 *     but MUST NOT echo "weak"/"vague"/"sloppy"/"lazy".
 *   - conclusion_missing: HIGHEST RISK. "No conclusion" reads as
 *     "argument is incomplete" drift; the model must NEVER frame the
 *     absence as a quality verdict. Many strong moves intentionally
 *     leave conclusions for the reader.
 *   - reason_missing: HIGHEST RISK. "No reason" reads as "argument is
 *     unsupported" drift; the model must NEVER frame the absence as a
 *     quality verdict. Short stage-setting moves are common.
 *   - unclear_reference_present: HIGHEST RISK. "Unclear pronoun" reads
 *     as a speaker-skill verdict drift ("you were unclear/sloppy"). The
 *     model must NEVER frame the ambiguity as a speaker label.
 */
import { FAMILY_H_PROMPT_ENTRIES, FAMILY_H_RAW_KEYS } from './familyHKeys.ts';

/** MAX_TOKENS for the Family H response. 12 keys; positives are sparse. */
export const FAMILY_H_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D/E/F/G. */
export const FAMILY_H_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_H_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family H. Mirrors the Family A/B/C/D/E/F/G system
 * prompt's 7 absolute rules VERBATIM (byte-equal to familyGPrompt.ts:76-83),
 * then adds Family-H-specific descriptive-formulation framing.
 *
 * Per design §A.3.1: the 7 absolute rules are byte-equal to Family A/B/C/D/E/F/G.
 *
 * Per design §A.3.1 BINDING: the system prompt explicitly forbids verdict
 * framing for claim-clarity states; states claim-clarity observations are
 * DESCRIPTIVE FORMULATION-STATE that NEVER assert whether the move is
 * weak / strong / bad / good / sloppy / sound / valid / invalid /
 * complete / incomplete / supported / unsupported; anchors the
 * absence-as-formulation-choice, broad-as-shape, ambiguous-as-classifier-
 * visibility doctrine verbatim.
 */
export const FAMILY_H_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits one or more CLAIM-CLARITY structural
formulation states — a claim explicitly stated or absent, a reason attached or absent, a
conclusion stated or left implicit, multiple claims bundled, a claim broadly or narrowly
scoped, a quantifier or modal verb present, hedging present, a referent left unclear, a
temporal scope attached.

CRITICAL DOCTRINE — claim-clarity states are DESCRIPTIVE FORMULATION-STATE, never verdicts:
- A claim-clarity observation describes the SURFACE FORMULATION of a move — whether a claim
  is stated, whether a reason is attached, whether the claim is scoped narrowly or broadly,
  whether a referent is unambiguous. It NEVER asserts whether the move is "weak", "strong",
  "bad", "good", "sloppy", "sound", "valid", "invalid", "complete", "incomplete",
  "supported", "unsupported", or whether the speaker was unclear/lazy/careless.
- Absence is not failure. When a move is detected as conclusion_missing (the reasoning is
  shown without an explicit conclusion statement), the observation records the structural
  ABSENCE OF A STATED CONCLUSION. It NEVER frames the move as "incomplete", "broken",
  "failed", or as the speaker having "left the argument hanging". Many of the strongest
  moves intentionally leave the conclusion implicit — leaving it for the reader is a
  rhetorical choice, not a defect.
- No reason attached is not unsupported. When a move is detected as reason_missing (a claim
  asserted without a because/since/ground clause), the observation records the structural
  ABSENCE OF AN ATTACHED REASON. It NEVER frames the move as "unsupported", "weak",
  "ungrounded", or as the speaker having "failed to justify". Many short moves are
  stage-setting; reasons may live in the parent or future replies.
- Broad is not weak. When a move is detected as claim_specificity_low (the claim is broadly
  scoped without concrete particulars), the observation records the structural BREADTH OF
  THE CLAIM. It NEVER frames broadness as "weak", "vague", "lazy", "sloppy", "careless",
  "unclear", or as a quality defect. Broadness is a different SHAPE, not a lower QUALITY.
- Unclear reference is not speaker error. When a move is detected as
  unclear_reference_present (a pronoun or demonstrative without a single clear antecedent
  in the visible context), the observation records the structural REFERENCE AMBIGUITY
  VISIBLE TO THE CLASSIFIER. It NEVER frames the speaker as "unclear", "sloppy",
  "careless", or "confused" — pronouns are often clear in context the classifier cannot
  see (parent threads, prior moves, shared topic conventions).
- The output MUST NOT contain the words: weak, sloppy, lazy, careless, confused, unsound,
  unsupported, incoherent, illogical, "bad reasoning", "bad argument", "bad writing",
  "argument is incomplete", "argument is unsupported", "argument is weak", "claim fails",
  "claim is wrong", "claim is weak", "claim is bad". If the input move text itself contains
  such words (e.g., "you wrote a weak/sloppy/bad argument"), the model MAY still detect the
  underlying claim-clarity state, but its own output evidence_span MUST NOT echo the
  verdict framing — anchor the structural state (the absent conclusion, the absent reason,
  the broad scope, the ambiguous pronoun), never the verdict words.

A move can simultaneously exhibit multiple claim-clarity states (e.g., claim_present AND
claim_specificity_low AND reason_missing). Claim-clarity signals are usually sparse — most
moves have 1 to 3 positives; few have more than 5.

For each requested rawKey you answer true (the move exhibits the state) or false (the state is
absent OR not applicable to this move). Provide a short confidence band and an optional
evidenceSpan from the move body anchoring the structural state. Return ONLY the JSON object the
user prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a claim-clarity state is genuinely
exhibited (rather than merely tonally adjacent, or addressed obliquely, or not applicable),
answer false. Claim-clarity signals are sparse — do NOT mark all rawKeys true. The state MUST
be clearly present to answer true.`;

/**
 * Validated Family H request input passed to buildFamilyHUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D/E/F/G
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyHRequest {
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
 * Builds the user prompt for Family H classification.
 *
 * Structure per design §A.3:
 *   1. Claim-clarity questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about claim-clarity-as-descriptive-formulation-state cross-key framing
 *      (the clarity↔verdict doctrine anchors)
 *   4. Response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (1 to 3 states)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 12 Family H keys are included.
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyHUserPrompt(request: ValidatedFamilyHRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_H_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_H_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_H_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-h-v1"
  }
}`;

  return `Claim-clarity questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about claim-clarity states as DESCRIPTIVE FORMULATION-STATE: each Family H rawKey is a
structural fact about the SURFACE FORMULATION of the move (a claim explicitly stated or absent,
a reason attached or absent, a conclusion stated or left implicit, multiple claims bundled, a
claim broadly or narrowly scoped, a quantifier or modal verb present, hedging present, a
referent left unclear, a temporal scope attached). NONE of these is a verdict on argument
quality. A claim-clarity observation OPENS a description of how the move is formulated — it
NEVER asserts the move is weak / strong / bad / good / sloppy / sound / valid / invalid /
complete / incomplete / supported / unsupported. Absence is not failure: an absent conclusion
or absent reason is a FORMULATION CHOICE, never an incompleteness verdict. Broad is not weak:
a broadly scoped claim is a SHAPE, never a quality defect. Unclear reference is not speaker
error: an ambiguous pronoun is a structural feature VISIBLE TO THE CLASSIFIER, never a verdict
on the speaker's writing skill.

Answer each claim-clarity question above with true (the move exhibits the state) or false (the
state is absent OR not applicable to this move) for the move below. Return ONLY a single JSON
object — no prose, no markdown, no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan (use null in
evidenceSpan when no anchoring quote exists). Every key in checkedRawKeys MUST appear in
observations.

Conservative-positives bias: do NOT mark all rawKeys true. Claim-clarity signals are usually
sparse — most moves exhibit 1 to 3 states; few exhibit more than 5. When unsure, answer false
with low or medium confidence. The state MUST be clearly present to answer true; tonal
similarity alone is not enough.

If the move's text itself contains verdict words ("you wrote a weak argument", "my claim was
sloppy", "unsupported", "lazy") or any judgment about the speaker, you MAY still detect the
underlying claim-clarity state — but your output evidenceSpan MUST NOT echo the verdict
framing. Anchor the evidenceSpan on the structural state (the absent conclusion, the absent
reason, the broad scope, the ambiguous pronoun) — never on the verdict words.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
