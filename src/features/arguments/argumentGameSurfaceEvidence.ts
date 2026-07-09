/**
 * EV-002 — Pure helper for building the per-message artifact map
 * consumed by `ArgumentGameSurface` and threaded into the timeline
 * popover wiring.
 *
 * Lives outside the component so unit tests can exercise it directly
 * without a React renderer. No React, no Supabase, no network.
 */
import {
  buildEvidenceArtifacts,
  type EvidenceArtifact,
  type EvidenceAttachmentInput,
} from '../evidence';
import { proofItemRowToEvidenceArtifact, type ProofItemRow } from '../proof/proofDrawerModel';
import type { ArgumentMessageInput } from './argumentGameSurfaceModel';

/**
 * For each message, build the typed `EvidenceArtifact[]` list.
 *
 * PROOF-002 (#889) read-path flip — ROWS-FIRST with a JSONB FALLBACK: when a
 * message has `proof_items` rows (from `proofItemsByMessageId`), those are the
 * source of truth and map via `proofItemRowToEvidenceArtifact`; otherwise the
 * message falls back to the EV-001 JSONB path (`buildEvidenceArtifacts` over
 * `attachedEvidence`). Because PROOF-001 back-fill mirrors JSONB into rows and
 * the inverse fold is faithful on every copy/doctrine field, a back-filled move
 * renders byte-identically either way (proofReadPathParity contract snapshot).
 *
 * The second argument is OPTIONAL: absent / empty (the flag-off path) resolves
 * BYTE-IDENTICALLY to the pre-PROOF-002 JSONB-only behaviour. Every downstream
 * consumer of the returned map (timeline map, moveMetadataLedger,
 * pointLifecycleModel, railSegmentModel, evidenceDebtModel) is transparently
 * correct — they receive equivalent `EvidenceArtifact[]` either way.
 *
 * The `attachedEvidence` field is optional on `ArgumentMessageInput` — callers
 * populate it from `row.clientValidation.attachedEvidence` at the room loader.
 * Missing / malformed JSONB safely resolves to `[]`.
 */
export function buildArtifactsByMessageId(
  messages: ReadonlyArray<ArgumentMessageInput>,
  proofItemsByMessageId?: Record<string, ReadonlyArray<ProofItemRow>>,
): Record<string, ReadonlyArray<EvidenceArtifact>> {
  const out: Record<string, ReadonlyArray<EvidenceArtifact>> = {};
  for (const m of messages) {
    const rows = proofItemsByMessageId?.[m.id];
    if (rows && rows.length > 0) {
      out[m.id] = rows.map(proofItemRowToEvidenceArtifact);
      continue;
    }
    const raw = (m.attachedEvidence ?? []) as ReadonlyArray<EvidenceAttachmentInput>;
    if (raw.length === 0) {
      out[m.id] = [];
      continue;
    }
    out[m.id] = buildEvidenceArtifacts({
      argumentId: m.id,
      addedByUserId: m.authorId || 'unknown',
      createdAt: m.createdAt,
      attachments: raw,
    });
  }
  return out;
}
