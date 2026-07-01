/**
 * UX-FLAGS-001 — Friendly feedback flags: public surface.
 *
 * The translation/mapping layer that turns a `(family, rawKey)` machine
 * observation into at most one friendly, plain-language, advisory
 * `FriendlyFlag` descriptor (or `null`). Pure TypeScript — no React, no
 * Supabase, no network, no side effects. The flag UI (#834) and the 1–3 cap /
 * priority ranking (#835) add sibling files in this dir and consume this
 * barrel.
 */

export * from './friendlyFlagMap';
export * from './pointFeedbackFlagsModel';
export * from './feedbackFlagPriority';
export { PointFeedbackFlagPill } from './PointFeedbackFlagPill';
export { PointFeedbackFlagsRow } from './PointFeedbackFlagsRow';
