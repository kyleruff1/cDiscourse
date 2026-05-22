/**
 * MCP-011 — Semantic referee public surface.
 *
 * Re-exports the canonical types, the validator, the fixtures, and the
 * cache-key helper for consumption by later MCP cards (MCP-012 … MCP-016) and
 * tests. Exporting a pure function is not wiring a provider — MCP-011 wires
 * nothing into a running surface (MCP-011 §14).
 */

// ── MCP-011 (existing — do not touch) ──
export * from './semanticRefereeTypes';
export * from './semanticRefereeValidator';
export * from './semanticRefereeCacheKey';
export * from './semanticRefereeFixtures';
// ── MCP-012 (appended — semantic call router, mock-only) ──
export * from './triggerGates';
export * from './classifierBatching';
export * from './semanticCache';
export * from './tokenBudget';
export * from './retryPolicy';
// ── MCP-019 (appended — room-wiring: client redaction + trigger input) ──
// NOTE: the MCP-019 room hook (useSemanticReferee) is intentionally NOT
// re-exported here. It lives in the room layer (src/features/arguments/)
// because it consumes higher layers + the Supabase Edge wrapper; exporting
// it from this foundation barrel would pull the Supabase client into every
// pure-TS consumer. Import the hook directly from its room-layer path.
// (MCP-019 §5 implementer deviation — see the design doc addendum.)
export * from './clientRedaction';
export * from './semanticTriggerInput';
