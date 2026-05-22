/**
 * MCP-019 — Packet → `BannerSelectionInput` adapter.
 *
 * `buildBannerSelectionInputFromPacket(packet, ledgerResult?)` turns a
 * `SemanticRefereePacket` (MCP-011) — and, forward-compatibly, an optional
 * `LedgerResult` (MCP-013) — into the `BannerSelectionInput` MCP-014's
 * `selectBanner` consumes. It is the room-wiring builder MCP-014 §"Out of
 * scope" explicitly named as a downstream concern.
 *
 * This module is PURE TYPESCRIPT — no network, no React, no Supabase, no
 * `Deno`, no env, no `async`. It imports types only.
 *
 * Doctrine (MCP-019 §0 Defect 1, §1):
 *   - MCP-019 does NOT run the economy-driven `reconcileMove` ledger. In the
 *     v1 reality `ledgerResult` is `undefined`, so `categoryReadings` is `[]`
 *     and the banner is driven purely by the packet's positive binaries.
 *   - The `ledgerResult` parameter exists so the future "referee-ledger room
 *     wiring" card passes a real `LedgerResult.categoryReadings` into the
 *     SAME builder with no rework — it is a forward-compatible seam.
 */

import type { BannerSelectionInput } from './types';
import type { SemanticRefereePacket } from '../semanticReferee/semanticRefereeTypes';
import type { LedgerResult } from '../refereeLedger/types';

/**
 * Build a `BannerSelectionInput` from a packet (and an optional ledger result).
 *
 * - `positiveBinaries` = the packet's binaries that read `value === 1`, in
 *   packet order, each projected to `{ classifierId, confidence }`.
 * - `categoryReadings` = the ledger's readings 1:1 when a `LedgerResult` is
 *   supplied; `[]` otherwise (the v1 reality — MCP-019 §0 Defect 1).
 *
 * Pure and total: a malformed / null packet yields the empty input shape
 * rather than throwing, so `selectBanner` always receives a valid object.
 */
export function buildBannerSelectionInputFromPacket(
  packet: SemanticRefereePacket | null | undefined,
  ledgerResult?: LedgerResult,
): BannerSelectionInput {
  const positiveBinaries: BannerSelectionInput['positiveBinaries'] =
    packet && Array.isArray(packet.binaries)
      ? packet.binaries
          .filter((b) => b.value === 1)
          .map((b) => ({ classifierId: b.classifierId, confidence: b.confidence }))
      : [];

  // Forward-compatible: when the future economy-ledger card supplies a real
  // LedgerResult, its categoryReadings flow straight through. Until then the
  // room has no ledger result and this is [].
  const categoryReadings: BannerSelectionInput['categoryReadings'] =
    ledgerResult && Array.isArray(ledgerResult.categoryReadings)
      ? ledgerResult.categoryReadings.map((r) => ({
          feedbackCode: r.feedbackCode,
          confidence: r.confidence,
          outcome: r.outcome,
          requiresUserChoice: r.requiresUserChoice,
        }))
      : [];

  return { positiveBinaries, categoryReadings };
}
