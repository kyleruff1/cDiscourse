/**
 * MCP-SERVER-005-FAMILY-D + MCP-BUILD2d — Family D prompt construction.
 *
 * Per-batch prompt strategy: the prompt builder filters to the requested
 * rawKey slice, so each call covers the BATCH's keys, not the full Subset.
 * MCP-BUILD2d takes the Family D Subset 19 → 22 (Build-2 manifest §3). 22 >
 * the per-response cap (20), so the Edge chunker (MCP-BOOLEAN-BATCHING-
 * INFRA-001) splits the 22-key set into 2 batches (16 + 6); this builder
 * receives each batch's requestedRawKeys and emits a <= 16-key prompt per
 * call (NO builder change — it already filters to requestedRawKeys). Token
 * budget MAX_TOKENS=1800 output comfortably covers a 16-key batch (it was
 * sized for 19). Per Stage 2B operator decision the MAX_TOKENS bump from
 * Family A/B/C's 1500 baseline to 1800 is approved (unchanged this card).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 (Score is gameplay, not truth): the system
 *     prompt's absolute rules mirror the Family A/B/C system prompt VERBATIM
 *     for the 7 absolute rules (winner / truth / popularity / person /
 *     hiding / blocking). Negations of banned tokens in the system prompt
 *     are doctrine-positive per the MCP-SERVER-002/003/004 precedent; the
 *     doctrine ban-list scan runs against the MODEL's RESPONSE, not the
 *     server-constructed prompt.
 *   - cdiscourse-doctrine §3 (Popularity is not evidence):
 *     `evidence_gap_present` carries the anti-amplification anchor —
 *     popularity / repetition / engagement is NOT evidence; a commonly-
 *     asserted claim with no source is an evidence gap regardless of how
 *     often it has been said elsewhere.
 *   - cdiscourse-doctrine §10a (Observations vs Allegations): every
 *     Family D rawKey is structural-only; the user prompt instructs the
 *     model to classify the move's EVIDENCE-SOURCE-CHAIN signal toward
 *     its PARENT and the cluster, never who is right about evidence or
 *     who bears the burden.
 *   - cdiscourse-doctrine §7 (No AI calls from production app): this
 *     module is server-side only; never imported into src/ or app/.
 *   - evidence-doctrine: evidence presence opens factual-standing
 *     eligibility but does not grant it; evidence-quality challenge
 *     reduces standing weight; anecdote is legitimate evidence in some
 *     contexts.
 *   - point-standing-economy: evidence_gap_present is a structural
 *     observation, not an automatic standing drop; standing changes when
 *     challenged and the gap persists.
 *
 * Doctrine risks (per design §4 + intent brief §4):
 *   - anecdote_used: NOT framed as weakness. Anecdote is legitimate
 *     evidence in some contexts (existence claims, mechanism examples,
 *     lived-experience domains).
 *   - burden_request_present: NOT framed as a verdict on which side
 *     bears the burden. Burden assignment is debated philosophical
 *     territory CDiscourse does not adjudicate.
 *   - evidence_gap_present: NOT framed as failure. A structural gap is
 *     advisory; popularity / engagement is NOT evidence.
 */
import { FAMILY_D_PROMPT_ENTRIES, FAMILY_D_RAW_KEYS } from './familyDKeys.ts';

/**
 * MAX_TOKENS for the Family D response. Per Stage 2B operator decision:
 * 1800 (bumped from the Family A/B/C 1500 baseline). MCP-BUILD2d takes the
 * Subset to 22 keys but they are served in 2 batches (16 + 6) — each batch
 * response is <= 16 keys, comfortably within 1800 (was sized for 19). NO
 * bump this card. HALT if 1800 proves insufficient — do not silently bump.
 */
export const FAMILY_D_MAX_TOKENS = 1800;

/** Deterministic decoding. Mirrors Family A/B/C. */
export const FAMILY_D_TEMPERATURE = 0;

/** Bound for the moveBody / parentBody fields in the user prompt. */
export const FAMILY_D_MAX_BODY_FIELD_LEN = 8000;

/**
 * The system prompt for Family D. Mirrors the Family A/B/C system prompt's
 * 7 absolute rules VERBATIM (byte-equal to familyAPrompt.ts:50-57,
 * familyBPrompt.ts:65-72, familyCPrompt.ts:72-79), then adds Family-D-specific
 * evidence-source-chain doctrine framing including the anti-amplification
 * anchor.
 *
 * Per Stage 2B + design §4: the doctrine-risk anchors for `anecdote_used`,
 * `burden_request_present`, and `evidence_gap_present` appear here in the
 * system prompt AND verbatim in the per-key `falsePositiveGuards` strings
 * inside FAMILY_D_PROMPT_ENTRIES.
 */
export const FAMILY_D_SYSTEM_PROMPT =
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

You classify whether an argument MOVE exhibits structural EVIDENCE-SOURCE-CHAIN
signals toward its PARENT move and the cluster. Each question is a structural
observation about an evidence request, an evidence provision, an evidence gap,
or a source-chain repair — never a judgement about who is right about the
evidence or who must produce it. Evidence presence and source-chain repair
are collaborative grounding moves; evidence gaps and quality challenges are
structural states, never failures or accusations.

Three doctrine-load-bearing keys require special framing:
- anecdote_used is a STRUCTURAL form of evidence, not a weakness. Anecdote
  is legitimate evidence in some contexts (existence claims, mechanism
  examples, lived-experience domains); do NOT mark TRUE in a way that
  implies low quality.
- burden_request_present indicates a STRUCTURAL request that the other side
  produce evidence; it does NOT determine which side actually bears the
  burden of demonstration — that is debated philosophical territory
  CDiscourse does not adjudicate.
- evidence_gap_present indicates a STRUCTURAL state (a factual / empirical
  / statistical claim made without attached evidence). It does NOT imply dishonest, low-quality, or manipulative authorship.
  Popularity / repetition / engagement are NOT evidence: a commonly-asserted
  claim with no source is an evidence gap regardless of how often it has
  been said elsewhere.

A move can simultaneously exhibit multiple evidence-source signals (e.g.,
providing a source AND citing a statistic AND closing a prior evidence
debt); a move can supply evidence without closing any prior debt. Evidence-
source signals are usually sparse — most moves exhibit 0 to 3 evidence
signals; few exhibit more than 5.

For each requested rawKey you answer true or false with a short confidence
band and an optional evidenceSpan from the move body. Return ONLY the JSON
object the user prompt describes — no prose, no markdown, no chain-of-thought.

Conservative-positives bias: when you are not confident an evidence-source
signal is present, answer false. Evidence-source signals are sparse; do NOT
mark all rawKeys true. Tone of confidence alone is not evidence; an actual
citation, quote, data point, source name, example, statistic, or
burden-of-demonstration framing is required for every positive.`;

/**
 * Validated Family D request input passed to buildFamilyDUserPrompt.
 * Mirror of the wire shape per MCP-021A; same shape as Family A's
 * ValidatedFamilyARequest and Family B/C, but kept distinct so future
 * Family-specific field additions don't cross-pollinate.
 */
export interface ValidatedFamilyDRequest {
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
 * Builds the user prompt for Family D classification.
 *
 * Structure per design §2:
 *   1. Evidence-source-chain questions block (rawKey: booleanQuestion for each requested key)
 *   2. Definitions + examples + false-positive guards block (one per requested key)
 *   3. Note about Subset path (8 deterministic keys excluded; classifier does NOT see them)
 *   4. Note about anti-amplification anchor and doctrine-risk keys
 *   5. Response-shape instruction (verbatim JSON example)
 *   6. Conservative-positives bias reminder (0 to 3 evidence signals)
 *   7. The input (move text, parent text, thread context)
 *
 * When requestedRawKeys is empty, all 22 Family D Subset keys are included
 * (in practice the Edge always passes a per-batch slice of <= 16 keys for
 * Family D, since 22 > the 20-key cap forces batching).
 *
 * Returns a string — pure, no I/O. The string contains the verbatim
 * caller-redacted move/parent/thread text fields; the caller has already
 * sanitized those at the Edge Function boundary (MCP-021C).
 */
export function buildFamilyDUserPrompt(request: ValidatedFamilyDRequest): string {
  const requestedKeys =
    request.requestedRawKeys.length === 0
      ? FAMILY_D_RAW_KEYS
      : request.requestedRawKeys.filter((k) => FAMILY_D_RAW_KEYS.includes(k));

  const requestedEntries = FAMILY_D_PROMPT_ENTRIES.filter((entry) =>
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
    "classifierSetVersion": "family-d-v1"
  }
}`;

  return `Evidence-source-chain questions for this move:
${questionsBlock}

Definitions and examples for each rawKey:

${definitionsBlock}

Note about the Subset path: this server processes only the 22 ai-classifier
Family D rawKeys above. The 8 deterministic Family D rawKeys (has_evidence,
source_requested, quote_requested, source_attached, quote_attached, sourced,
plus lifecycle quote_requested / source_requested) are computed by other
layers from auto-metadata and cluster state; do NOT infer or emit those
keys. If a request would benefit from any of those facts, answer the
ai-classifier rawKeys above and rely on the structured-data layer for the
deterministic facts.

Note about anti-amplification and doctrine-risk keys: each Family D rawKey
is a structural evidence-source-chain signal. anecdote_used describes a
structural feature (the author cites a personal or single-case story); do
NOT mark TRUE in a way that implies the move is weak — anecdote is
legitimate evidence in some contexts. burden_request_present indicates a
structural request for the other party to produce evidence; it does NOT
determine which side actually bears the burden of demonstration.
evidence_gap_present indicates a structural state of the move (a factual
claim made without attached evidence). It does NOT imply dishonest, low-quality, or manipulative authorship.
Popularity / repetition / engagement are NOT evidence: a commonly-asserted
claim with no source is an evidence gap regardless of how often it has
been said elsewhere. None of these is a verdict on either participant.

Answer each evidence-source-chain question above with true or false for
the move below. Return ONLY a single JSON object — no prose, no markdown,
no code fence, no chain-of-thought.

The object MUST conform to this shape:
${responseShape}

Every key in observations MUST also appear in confidence and evidenceSpan
(use null in evidenceSpan when no anchoring quote exists). Every key in
checkedRawKeys MUST appear in observations.

Conservative-positives bias: do NOT mark all rawKeys true. Evidence-source
signals are usually sparse — most moves exhibit 0 to 3 signals; few exhibit
more than 5. When unsure, answer false with low or medium confidence.

Input to classify:
Node id: ${request.nodeId}
Move text: ${request.currentText}
Parent text: ${parentTextRendered}
Thread context: ${request.threadContextExcerpt}`;
}
