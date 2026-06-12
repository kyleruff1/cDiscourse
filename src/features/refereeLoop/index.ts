/**
 * REF-002 — Referee Loop public surface.
 *
 * Pure TypeScript — no Supabase, no React, no network, no Edge Function, no
 * live provider. A strict pure consumer of the already-derived gameplay
 * seams. Re-exports the Open Issue model (`DisagreementContract`
 * derivation) for REF-003 (card surface), REF-004 (loop), and REF-005
 * (structured allegations).
 */

export * from './openIssueModel';
