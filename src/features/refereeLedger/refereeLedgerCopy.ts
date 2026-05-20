/**
 * MCP-013 — Referee ledger: feedbackCode → plain-language copy table.
 *
 * The single canonical `RefereeFeedbackCode` → plain-language map. The strings
 * themselves are stored ONCE in `gameCopy.PLAIN_LANGUAGE_COPY`; this module
 * re-exports them by `RefereeFeedbackCode` key so callers — MCP-008 (banners),
 * the ledger tests — get a typed lookup against the closed feedback-code
 * union.
 *
 * `feedbackCodeToPlainLanguage` delegates to `gameCopy.toPlainLanguage` so the
 * snake_case-suppression doctrine is enforced through the same helper every
 * other surface uses; an unmapped code returns `null`.
 *
 * Pure TypeScript. No network. No Supabase. No React.
 */

import { PLAIN_LANGUAGE_COPY, toPlainLanguage } from '../arguments/gameCopy';
import { ALL_REFEREE_FEEDBACK_CODES } from './types';
import type { RefereeFeedbackCode } from './types';

/**
 * The `RefereeFeedbackCode` → plain-language string table. Every value is read
 * straight from `gameCopy.PLAIN_LANGUAGE_COPY` — this module does NOT author
 * copy inline (mirrors `channelModel.ts` reading the `CHANNEL_*` blocks).
 *
 * `source_attached` reuses the existing META-001 `PLAIN_LANGUAGE_COPY` entry —
 * the ledger's `source_attached` feedback code and META-001's `source_attached`
 * metadata describe the same observation (MCP-013 design key-collision check).
 */
export const REFEREE_FEEDBACK_COPY: Readonly<Record<RefereeFeedbackCode, string>> = Object.freeze(
  ALL_REFEREE_FEEDBACK_CODES.reduce((acc, code) => {
    acc[code] = PLAIN_LANGUAGE_COPY[code];
    return acc;
  }, {} as Record<RefereeFeedbackCode, string>),
);

/**
 * Plain-language lookup for one `RefereeFeedbackCode`. Delegates to
 * `gameCopy.toPlainLanguage` so the snake_case-suppression doctrine is
 * enforced uniformly. Returns `null` for an unmapped code (doctrine
 * constraint 10).
 */
export function feedbackCodeToPlainLanguage(code: RefereeFeedbackCode): string | null {
  return toPlainLanguage(code);
}
