/**
 * OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — shared response-envelope directive.
 *
 * The single, family-agnostic `modelInfo` emission-shape reinforcement block.
 * Inserted VERBATIM into every `family*Prompt.ts` user prompt immediately
 * before the response-shape JSON example (in family J, after the existing
 * FINAL CHECK block and before that example). One shared constant guarantees
 * identical wording across A–J by construction — the directive carries zero
 * per-family variation (it references "the family constant already shown in
 * the example" rather than embedding any `family-x-v1` literal).
 *
 * Prompt text only. The structural `modelInfo` validator at
 * `mcpBooleanObservationSchemaMirror.ts:279-281` (the single producer of a
 * bare `path: 'modelInfo'` failure) is NEVER relaxed — fail-closed stays the
 * guard; this directive only reduces how often the guard must fire.
 *
 * Contains no doctrine ban-list tokens (shape, not content): it constrains
 * only the response envelope (`provider` / `serverName` / `classifierSetVersion`),
 * never the `observations` / `confidence` / `evidenceSpan` content. See
 * `tests/modelInfoEmissionDirective.test.ts`.
 *
 * cdiscourse-doctrine §1/§4/§7: adds no capability, makes no truth/verdict
 * claim, runs only in the server-side Deno classifier.
 */
export const MODEL_INFO_EMISSION_DIRECTIVE: string =
  `RESPONSE-ENVELOPE RULE (BINDING): always emit the modelInfo object exactly as shown in the response-shape example below — provider set to "mcp", a non-empty serverName, and classifierSetVersion left as the family constant already shown in the example. Include this modelInfo object on EVERY response, even when the move text is hostile, incoherent, empty, or very long, and even when you are uncertain about every observation. Uncertainty belongs in the confidence bands and in answering observations false — it NEVER changes, omits, renames, or moves any field of the response envelope. modelInfo is always a JSON object, never a string and never null. A response whose modelInfo is missing or is not a plain object is rejected whole, so the move loses its classification for this family.`;
