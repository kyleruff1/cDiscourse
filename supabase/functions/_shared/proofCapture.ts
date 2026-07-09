/**
 * PROOF-003 (#890) orchestrator ruling R2 — first-attach JSONB capture (Deno mirror).
 *
 * On attach to a move that (a) carries a JSONB evidence snapshot and (b) has
 * ZERO non-deleted proof_items rows, the Edge folds the pre-existing JSONB
 * artifacts into proof_items rows FIRST, then inserts the new item. That makes
 * the PROOF-002 rows-first read adapter honest (no mixed JSONB+rows state can
 * persist on a move once any row exists). Idempotent: once rows exist a
 * subsequent attach sees them and skips capture.
 *
 * DENO-BOUNDARY DECISION (R2 sanctioned fallback): Edge Functions run on Deno
 * with a separate module graph and cannot import from src/ or scripts/. The
 * shipped fold (scripts/proof-backfill/proofItemRowFromArtifact.ts) type-imports
 * from src/features/evidence/evidenceModel and so is unreachable here. Rather
 * than a source-text byte-equal twin (impossible across the boundary), this file
 * is a BEHAVIOURAL twin of the shipped back-fill pipeline
 *   toAttachmentInput -> buildEvidenceArtifacts -> foldArtifactsToProofItemRows
 * (scripts/proof-backfill/backfillProofItemsCore.ts + proofItemRowFromArtifact.ts),
 * pinned by __tests__/proofCaptureParity.test.ts which runs the SAME fixtures
 * through the real classifyArgumentRow and this mirror and asserts identical
 * rows. The two files are equal by proven row-output, which is stronger than
 * source-text equality.
 *
 * ONE documented divergence: the QOL-036 payment redaction DOWNGRADE
 * (a payment sub-object whose redaction guard finds raw account data is
 * downgraded to screenshot_redacted and captured as a note by the back-fill).
 * Mirroring the full QOL-036 redaction engine into Deno is disproportionate for
 * a path that, in the capture window (a legacy JSONB move that gets a NEW drawer
 * attach, before the operator back-fill, with the flag OFF at merge), is
 * vanishingly rare. A CLEAN payment attachment folds to null (no row) in BOTH
 * the back-fill and this mirror; only the raw-account-data downgrade differs,
 * and such an attachment simply stays in JSONB rather than capturing as a note.
 *
 * Pure TypeScript. No Deno API, no Supabase, no network, no async, no mutation,
 * no console. Comments are apostrophe-free for scanner safety.
 */

/** The 6 CHECK-valid proof_items.kind values (migration 20260710000001). */
export type ProofItemKind = 'url' | 'quote' | 'source_text' | 'note' | 'prior_move' | 'external_ref';

/** The writable columns of a proof_items INSERT. Mirrors ProofItemRow in the shipped fold. */
export interface CapturedProofRow {
  debate_id: string;
  argument_id: string;
  added_by: string;
  kind: ProofItemKind;
  label: string;
  url: string | null;
  source_text: string | null;
  quote: string | null;
  referenced_argument_id: string | null;
  source_chain_status: 'unverified' | 'source_no_quote' | 'source_and_quote';
  risk: 'unknown';
}

export interface CaptureContext {
  argumentId: string;
  debateId: string;
  authorId: string;
}

// ── helpers mirrored verbatim from evidenceModel ────────────────

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Mirror of evidenceModel DATASET_HOST_ALLOWLIST. */
const DATASET_HOST_ALLOWLIST: ReadonlyArray<string> = ['data.gov', 'figshare.com', 'zenodo.org'];

function hostnameOf(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isDatasetUrl(rawUrl: string): boolean {
  const host = hostnameOf(rawUrl);
  if (host === null) return false;
  return DATASET_HOST_ALLOWLIST.some((allow) => host === allow || host.endsWith(`.${allow}`));
}

function truncateLabel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 119)}…`;
}

/** The intermediate attachment shape (mirror of EvidenceAttachmentInput, no payment fields honoured). */
interface AttachmentInput {
  url: string | null;
  label: string | null;
  sourceText: string | null;
  quote: string | null;
  kind?: string;
  hasPayment: boolean;
}

/** Mirror of backfillProofItemsCore toAttachmentInput. */
function toAttachmentInput(raw: unknown): AttachmentInput {
  if (raw === null || typeof raw !== 'object') {
    return { url: null, label: null, sourceText: null, quote: null, hasPayment: false };
  }
  const rec = raw as Record<string, unknown>;
  const input: AttachmentInput = {
    url: asOptionalString(rec.url) ?? null,
    label: asOptionalString(rec.label) ?? null,
    sourceText: asOptionalString(rec.sourceText) ?? asOptionalString(rec.source_text) ?? null,
    quote: asOptionalString(rec.quote) ?? null,
    hasPayment: rec.payment !== undefined && rec.payment !== null && typeof rec.payment === 'object',
  };
  const kind = asOptionalString(rec.kind);
  if (kind !== undefined) input.kind = kind;
  return input;
}

function isAttachmentEmpty(att: AttachmentInput): boolean {
  return !present(att.url) && !present(att.sourceText) && !present(att.quote) && !att.hasPayment;
}

/** Mirror of evidenceModel classifyEvidenceKind, WITHOUT the payment redaction path (see header). */
function classifyKind(att: AttachmentInput): string {
  if (att.kind) return att.kind;
  if (att.hasPayment) return 'payment_screenshot';
  if (present(att.url)) return isDatasetUrl(att.url as string) ? 'dataset' : 'url';
  if (present(att.sourceText)) return 'source_text';
  if (present(att.quote)) return 'source_text';
  return 'manual_citation';
}

/** Mirror of evidenceModel deriveSourceChainStatus (the three derivable values). */
function deriveStatus(att: AttachmentInput): 'unverified' | 'source_no_quote' | 'source_and_quote' {
  const hasUrl = present(att.url);
  const hasSourceText = present(att.sourceText);
  const hasQuote = present(att.quote);
  if (!hasUrl && !hasSourceText && hasQuote) return 'unverified';
  if ((hasUrl || hasSourceText) && hasQuote) return 'source_and_quote';
  if (hasUrl || hasSourceText) return 'source_no_quote';
  return 'unverified';
}

/** Mirror of evidenceModel deriveLabel. */
function deriveLabel(att: AttachmentInput): string {
  if (present(att.label)) return truncateLabel(att.label as string);
  if (present(att.url)) {
    const host = hostnameOf(att.url as string);
    if (host !== null) return truncateLabel(host);
  }
  if (present(att.sourceText)) return truncateLabel((att.sourceText as string).trim().slice(0, 32));
  return 'Attached evidence';
}

/** Mirror of proofItemRowFromArtifact PROOF_ITEM_KIND_FOLD. */
function foldKind(kind: string): ProofItemKind | null {
  switch (kind) {
    case 'url':
      return 'url';
    case 'quote':
      return 'quote';
    case 'source_text':
      return 'source_text';
    case 'dataset':
      return 'url';
    case 'screenshot_redacted':
      return 'note';
    case 'manual_citation':
      return 'note';
    case 'note':
      return 'note';
    case 'prior_move':
      return 'prior_move';
    case 'external_ref':
      return 'external_ref';
    case 'payment_screenshot':
      return null; // deferred (no path-c column this card) — stays in JSONB
    default:
      return null;
  }
}

/**
 * Fold a move JSONB evidence snapshot into proof_items rows. Deterministic and
 * total. A malformed snapshot (not an array) yields []. Empty + deferred
 * attachments are dropped, order preserved — byte-equal to the back-fill.
 */
export function captureRowsFromJsonb(
  attachedEvidence: unknown,
  ctx: CaptureContext,
): CapturedProofRow[] {
  if (!Array.isArray(attachedEvidence)) return [];
  const rows: CapturedProofRow[] = [];
  for (const raw of attachedEvidence) {
    const att = toAttachmentInput(raw);
    if (isAttachmentEmpty(att)) continue;
    const foldedKind = foldKind(classifyKind(att));
    if (foldedKind === null) continue; // deferred (payment_screenshot) or unknown
    rows.push({
      debate_id: ctx.debateId,
      argument_id: ctx.argumentId,
      added_by: ctx.authorId,
      kind: foldedKind,
      label: deriveLabel(att),
      url: present(att.url) ? (att.url as string).trim() : null,
      source_text: present(att.sourceText) ? (att.sourceText as string).trim() : null,
      quote: present(att.quote) ? (att.quote as string).trim() : null,
      referenced_argument_id: null,
      source_chain_status: deriveStatus(att),
      risk: 'unknown',
    });
  }
  return rows;
}
