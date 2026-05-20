/**
 * MCP-014 — Referee feedback banner library: public surface.
 *
 * Layer 4 of the semantic-referee architecture. Pure TypeScript — no Supabase,
 * no React, no network, no Edge Function, no live provider. A strict pure
 * consumer of `src/features/semanticReferee/` and `src/features/refereeLedger/`
 * type contracts, plus the runtime `gameCopy.ts` plain-language map (consumed
 * by the deferred render component, not by this model directly).
 *
 * The render component (a thin `<View>`/`<Text>` card) is deliberately
 * DEFERRED (MCP-008 §15). MCP-014 ships the string library, the selection
 * model, the tone-band model, the confidence rule, and the ready-to-render
 * `accessibilityLabel` / `toneGlyph` — everything that card consumes.
 */

export * from './types';
export * from './accessibilityLabel';
export * from './refereeBannerLibrary';
export * from './classifierBannerMap';
export * from './selectBanner';
