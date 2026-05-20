/**
 * MCP-015 — Semantic override UX model: public surface.
 *
 * Implements MCP-010 §5.2 — the override / appeal state model. Pure
 * TypeScript — no Supabase, no React, no network, no Edge Function, no live
 * provider. A strict consumer of `src/features/semanticReferee/`,
 * `src/features/refereeLedger/`, and `src/features/metadata/`; none of those
 * import from `semanticOverride/`.
 *
 * The React choice surface (`SemanticOverrideChoiceSheet`) is deferred to a
 * scoped follow-up card — MCP-015 ships the pure model + tests only.
 */

export * from './types';
export * from './overrideTriggerModel';
export * from './overrideRecordModel';
