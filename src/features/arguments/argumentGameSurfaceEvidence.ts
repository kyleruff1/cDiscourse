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
import type { ArgumentMessageInput } from './argumentGameSurfaceModel';

/**
 * For each message, build the typed `EvidenceArtifact[]` list via EV-001's
 * `buildEvidenceArtifacts`. Messages with no `attachedEvidence` payload
 * yield an empty array (the chip/popover render the `no_source` form).
 *
 * The `attachedEvidence` field is optional on `ArgumentMessageInput` —
 * callers populate it from `row.clientValidation.attachedEvidence` at the
 * room loader. Missing / malformed JSONB safely resolves to `[]`.
 */
export function buildArtifactsByMessageId(
  messages: ReadonlyArray<ArgumentMessageInput>,
): Record<string, ReadonlyArray<EvidenceArtifact>> {
  const out: Record<string, ReadonlyArray<EvidenceArtifact>> = {};
  for (const m of messages) {
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
