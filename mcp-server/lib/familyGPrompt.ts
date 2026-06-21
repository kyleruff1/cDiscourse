/**
 * MCP-SERVER-008-FAMILY-G — Family G prompt construction.
 *
 * Single-prompt strategy per design §A.3: one Anthropic call covers each
 * batch of Family G ai_classifier rawKeys. MCP-BUILD2g takes the Subset 18 →
 * 21; 21 > the 20-key per-response cap, so the Edge chunker serves G in 2
 * batches (16 + 5) and the mcp-server answers each batch as a normal <= 16-key
 * single-family request — it never sees the full 21-key set. Token budget ~85
 * tokens/key keeps each batch far under budget; the conservative-positives
 * bias (positives are sparse — most moves have 0 to 2) keeps realistic output
 * lower still. MAX_TOKENS=1500 (matches Family A/B/C/D/E/F; NO bump per design
 * §A.2 — D already ships 22 ai_classifier keys (batched) at 1500 with no
 * truncation).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C/D/E/F system prompt
 *     VERBATIM for the 7 absolute rules (winner / truth / popularity /
 *     person / hiding / blocking). Negations of banned tokens in the
 *     system prompt are doctrine-positive per the Family A-F precedent;
 *     the doctrine ban-list scan runs against the MODEL's RESPONSE, not
 *     the server-constructed prompt.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family G rawKey is structural-only; the user prompt instructs the
 *     model to flag a DESCRIPTIVE CONVERGENCE-STATE the move exhibits,
 *     NEVER to adjudicate who is winning / losing / conceding-and-therefore-
 *     losing / settled-in-favor. A resolution-progress observation describes
 *     the SHAPE of the exchange's movement; it never closes a dispute with a
 *     verdict.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *   - point-standing-economy: concession is a SCORING REPAIR, not a defeat;
 *     synthesis is a GAMEPLAY move, not a verdict; G emits no standing delta.
 *
 * Doctrine risks (per design §A.3):
 *   - concedes_broader_point: HIGHEST RISK (the axis-partner). A broad
 *     relinquishment is the single key most likely to be mis-framed as
 *     "this side lost". The output evidence_span MUST anchor the verbatim
 *     relinquishment; MUST NOT contain won / lost / winner / loser /
 *     defeated / prevailed / capitulated / ahead / behind / "settled in
 *     favor". If the input move text says "you win" / "I lost" / "you beat
 *     me", the model may still detect the concession but MUST NOT echo it.
 *   - concedes_narrow_point / concedes_with_new_dispute: MEDIUM RISK
 *     (concession axis). NEVER framed as defeat.
 *   - synthesis_proposed: MEDIUM RISK. Synthesis is a GAMEPLAY move, not a
 *     verdict about who won — both sides retain standing.
 *   - proposes_settlement_terms / accepts_settlement_terms /
 *     issue_closed_by_participant: MEDIUM RISK (settlement / closure axis).
 *     Procedural closure, NEVER adjudication or "settled in X's favor".
 */
import { FAMILY_G_PROMPT_ENTRIES, FAMILY_G_RAW_KEYS } from './familyGKeys.ts';
import { MODEL_INFO_EMISSION_DIRECTIVE } from './modelInfoEmissionDirective.ts';

/** MAX_TOKENS for the Family G response. 21-key Subset served in 2 batches (16 + 5); positives are sparse. */
export const FAMILY_G_MAX_TOKENS = 1500;

/** Deterministic decoding. Mirrors Family A/B/C/D/E/F. */
export const FAMILY_G_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_G_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family G. Mirrors the Family A/B/C/D/E/F system
 * prompt's 7 absolute rules VERBATIM (byte-equal to familyFPrompt.ts:81-88),
 * then adds Family-G-specific descriptive-convergence framing.
 *
 * Per design §A.3.1: the 7 absolute rules are byte-equal to Family A/B/C/D/E/F.
 *
 * Per design §A.3.1 BINDING: the system prompt explicitly forbids verdict
 * framing for resolution-progress states; states resolution-progress
 * observations are DESCRIPTIVE CONVERGENCE-STATE that NEVER assert who is
 * ahead / behind / won / lost / prevailed / capitulated / settled-in-favor;
 * anchors the concession-as-repair, synthesis-as-gameplay, and
 * settlement-as-procedural doctrine verbatim.
 */
export const FAMILY_G_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits one or more RESOLUTION-PROGRESS structural
states — a claim narrowed, a narrow point conceded, a broader point relinquished, common
ground identified, an unresolved point isolated, a synthesis proposed, settlement terms
proposed or accepted, an issue closed by a participant, a point set aside, a decision
criterion / action item / follow-up question proposed, a side branch or tangent suggested.

CRITICAL DOCTRINE — resolution-progress states are DESCRIPTIVE CONVERGENCE-STATE, never verdicts:
- A resolution-progress observation describes the SHAPE of the exchange's movement toward (or
  away from) shared understanding. It NEVER asserts who is ahead, who is behind, who won, who
  lost, who prevailed, who capitulated, or that a dispute was settled IN ONE SIDE'S FAVOR. Both
  sides retain their standing regardless of which resolution-progress state the move exhibits.
- Concession is a SCORING REPAIR, not a defeat. When a move concedes a narrow point
  (concedes_narrow_point) or relinquishes the broader claim (concedes_broader_point), the
  observation records the structural RELINQUISHMENT. It NEVER frames the conceding participant
  as "wrong", "the loser", "defeated", or as having "lost the argument". A broad concession is
  the highest-cost repair move; it resets standing for future rebuilding — it is NOT a verdict.
- Synthesis is a GAMEPLAY move, not a verdict about who won. When a move proposes a synthesis
  (synthesis_proposed) or signals readiness (ready_for_synthesis), the observation records that
  BOTH sides' elements are being combined. It NEVER implies one side's position prevailed.
- Settlement / closure is procedural, not adjudication. proposes_settlement_terms /
  accepts_settlement_terms / issue_closed_by_participant record that participants are CLOSING
  engagement on a point. They NEVER imply the point was "decided", "settled in X's favor", or
  that one side is "ahead".
- The output MUST NOT contain the words: won, lost, winner, loser, defeated, prevailed,
  capitulated, ahead, behind, "settled in favor", "won the argument", "conceded the loss",
  "lost the point". If the input move text itself contains such words (e.g., "you basically
  lost this point"), the model MAY still detect the underlying resolution-progress state, but
  its own output evidence_span MUST NOT echo the verdict framing — anchor the structural state
  (the relinquished claim, the proposed synthesis, the accepted terms), never the verdict words.

A move can simultaneously exhibit multiple resolution-progress states (e.g.,
common_ground_identified AND unresolved_point_isolated AND synthesis_proposed). Resolution-progress
signals are usually sparse — most moves have 0 to 2 positives; few have more than 4.

For each requested rawKey you answer true (the move exhibits the state) or false (the state is
absent OR not applicable to this move). Provide a short confidence band and an optional
evidenceSpan from the move body anchoring the structural state. Return ONLY the JSON object the
user prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident a resolution-progress state is genuinely
exhibited (rather than merely conciliatory in tone, or addressed obliquely, or not applicable),
answer false. Resolution-progress signals are sparse — do NOT mark all rawKeys true. The state
MUST be clearly present to answer true.`;

/**
 * Validated Family G request input passed to buildFamilyGUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A/B/C/D/E/F
 * but kept distinct so future Family-specific field additions don't
 * cross-pollinate.
 */
export interface ValidatedFamilyGRequest {
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
 * Builds the user prompt for Family G classification.
 *
 * Structure per design §A.3:
 *   1. Resolution-progress questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about resolution-progress-as-descriptive-convergence-state cross-key framing
 *      (the resolution<->verdict doctrine anchors)
 *   4. Shared modelInfo emission directive, then the response-shape instruction (verbatim JSON example)
 *   5. Conservative-positives bias reminder (0 to 2 states)
 *   6. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 21 Family G keys are included (in
 * production the Edge passes a batched <= 16-key requestedRawKeys subset).
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyGUserPrompt(request: ValidatedFamilyGRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_G_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_G_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_G_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-g-v1"
  }
}`;

  return `Resolution-progress questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about resolution-progress states as DESCRIPTIVE CONVERGENCE-STATE: each Family G rawKey is a
structural fact about the SHAPE of the exchange's movement toward (or away from) shared
understanding (claim narrowed, narrow point conceded, broader point relinquished, common ground
identified, unresolved point isolated, synthesis proposed, settlement terms proposed or accepted,
issue closed by a participant, point set aside, decision criterion / action item / follow-up
question proposed, side branch or tangent suggested). NONE of these is a verdict on who won. A
resolution-progress observation OPENS a description of the exchange's movement — it NEVER asserts
one side is ahead, behind, won, lost, prevailed, capitulated, or that a dispute was settled in one
side's favor. Concession is a SCORING REPAIR, never a defeat: when a move relinquishes the broader
point (concedes_broader_point), the observation anchors the verbatim relinquishment, NEVER "this
side lost". Synthesis is a GAMEPLAY move, not a verdict: flagging synthesis_proposed NEVER means
one side's position prevailed; both sides retain standing. Settlement / closure is procedural:
flagging accepts_settlement_terms or issue_closed_by_participant NEVER means the point was settled
in X's favor.

Answer each resolution-progress question above with true (the move exhibits the state) or false
(the state is absent OR not applicable to this move) for the move below. Return ONLY a single JSON
object — no prose, no markdown, no code fence, no chain-of-thought.

${MODEL_INFO_EMISSION_DIRECTIVE}

The object MUST conform to this shape:
${responseShape}

STRICT RESPONSE-SHAPE CONTRACT — the JSON object you return MUST satisfy every rule below.

1. KEY-SET EQUALITY. The four sets — checkedRawKeys (as a set), observations keys, confidence
   keys, and evidenceSpan keys — MUST be identical. Same exact rawKey strings, same count, no
   extras, no omissions, no duplicates. If these four sets differ by even one entry, the
   packet is rejected and the cell will retry or dead-letter.

2. INCLUDE EVERY REQUESTED RAWKEY EXACTLY ONCE. The resolution-progress questions block above
   lists the rawKeys you must evaluate. Each of those rawKeys MUST appear exactly once in
   checkedRawKeys, observations, confidence, AND evidenceSpan. Do NOT silently drop any
   requested rawKey — including synthesis_proposed, common_ground_identified,
   concedes_broader_point, or any other resolution-progress state. Do NOT introduce a rawKey
   that was not in the requested set.

3. EVIDENCESPAN VALUE TYPE. Each evidenceSpan[rawKey] value is EITHER:
   (a) a short string copied or paraphrased from the supplied move/parent/thread-context text,
       up to 240 characters, OR
   (b) the JSON literal null.
   NEVER an object. NEVER an array. NEVER a boolean. NEVER a number. NEVER a missing entry
   (use null instead). This rule applies uniformly to EVERY rawKey — no resolution-progress
   state has a special nested or structured evidenceSpan shape. synthesis_proposed uses the
   same string-or-null shape as every other resolution-progress key.

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

6. RAWKEY-SHAPE REINFORCEMENT — synthesis_proposed.
   synthesis_proposed records that the move proposes combining BOTH sides' elements. Even
   though the underlying structural state references multiple sides, the evidenceSpan entry
   for synthesis_proposed uses the exact same string-or-null shape as every other rawKey.
   Allowed values for evidenceSpan.synthesis_proposed:
   (a) a single JSON string up to 240 characters that anchors the synthesis-proposal pattern
       in the move (a concise paraphrase, not a structured by-side breakdown); OR
   (b) the JSON literal null.
   Not allowed: a JSON object such as { "sideA": "…", "sideB": "…" } or { "from_X": "…",
       "from_Y": "…" }; a JSON array such as [ "side a position", "side b position" ]; a
   boolean; a number; a missing entry; a string longer than 240 characters. If the
   anchoring text would exceed 240 characters, choose a concise sub-span or paraphrase rather
   than truncating mid-sentence; if no single anchor span fits, set the value to null. When
   observations.synthesis_proposed is false, the value MUST be null. The validator rejects
   every non-string non-null value at the exact path evidenceSpan.synthesis_proposed.

Conservative-positives bias: do NOT mark all rawKeys true. Resolution-progress signals are usually
sparse — most moves exhibit 0 to 2 states; few exhibit more than 4. When unsure, answer false with
low or medium confidence. The state MUST be clearly present to answer true; conciliatory tone alone
is not enough.

If the move's text itself contains verdict words ("you won", "I lost", "you beat me", "settled in
your favor") or any judgment about who is winning, you MAY still detect the underlying
resolution-progress state — but your output evidenceSpan MUST NOT echo the verdict framing. Anchor
the evidenceSpan on the structural state (the relinquished claim, the proposed synthesis, the
accepted terms, the set-aside request) — never on the verdict words.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
