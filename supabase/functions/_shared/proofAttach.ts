/**
 * PROOF-003 (#890) — attach-proof pure contract module.
 *
 * The single source of truth shared by the attach-proof Edge Function AND the
 * jest contract test (__tests__/attachProofContract.test.ts imports THIS file
 * directly, the _shared/evidenceAnnotationEligibility.ts precedent). It carries
 * the attachable kind vocabulary, the derivable source-chain status set, the
 * caps, the per-kind field validation, the server-side status derivation, and
 * the natural-content idempotency key.
 *
 * Why this file exists: Edge Functions run on Deno with a separate module graph
 * and cannot import from src/. This module mirrors the two authoritative src
 * rules it depends on:
 *   - deriveProofSourceChainStatus MIRRORS
 *     src/features/evidence/evidenceModel.ts deriveSourceChainStatus. It returns
 *     ONLY the three client-derivable values (never broken / primary_present),
 *     which is condition (ii) of the PROOF-001 heightened review: the client can
 *     never mint a privileged status.
 *   - ATTACHABLE_PROOF_KINDS mirrors the six CHECK-valid proof_items.kind values
 *     shipped by migration 20260710000001 (storage + marker kinds deferred).
 *
 * Pure TypeScript. No Deno API, no Supabase, no network, no async, no mutation,
 * no console. Comments are apostrophe-free for scanner safety.
 */

// ── Attachable kind vocabulary (6 kinds; storage + marker deferred) ──

export const ATTACHABLE_PROOF_KINDS = [
  'url',
  'quote',
  'source_text',
  'note',
  'prior_move',
  'external_ref',
] as const;
export type AttachableProofKind = (typeof ATTACHABLE_PROOF_KINDS)[number];

/**
 * Kinds the request schema PARSES but the guard ladder REJECTS with a distinct
 * 400 kind_not_supported (not a 422 bad-enum). Storage kinds defer to
 * SEC-PROOF-001; marker kinds defer to MARK-001. Widening ATTACHABLE_PROOF_KINDS
 * to include one of these is that card's job, WITH the column it needs.
 */
export const DEFERRED_PROOF_KINDS = ['screenshot', 'file', 'voice_excerpt', 'timestamp'] as const;
export type DeferredProofKind = (typeof DEFERRED_PROOF_KINDS)[number];

/** Every kind the attach schema will parse (attachable + deferred). A kind outside this set is a 422 bad-enum. */
export const KNOWN_REQUEST_KINDS = [
  ...ATTACHABLE_PROOF_KINDS,
  ...DEFERRED_PROOF_KINDS,
] as const;
export type KnownRequestKind = (typeof KNOWN_REQUEST_KINDS)[number];

/** True iff kind is one of the six kinds this card can actually persist. */
export function isAttachableKind(kind: string): kind is AttachableProofKind {
  return (ATTACHABLE_PROOF_KINDS as ReadonlyArray<string>).includes(kind);
}

/** The three statuses the Edge may derive. broken / primary_present are admin-only. */
export const DERIVABLE_SOURCE_CHAIN_STATUSES = [
  'unverified',
  'source_no_quote',
  'source_and_quote',
] as const;
export type DerivableSourceChainStatus = (typeof DERIVABLE_SOURCE_CHAIN_STATUSES)[number];

/** The four relation kinds proof_relations admits (migration 20260710000001). */
export const PROOF_RELATION_KINDS = [
  'supports',
  'contradicts',
  'contextualizes',
  'answers_request',
] as const;
export type ProofRelationKind = (typeof PROOF_RELATION_KINDS)[number];

// ── Caps (Design Pass Q9 + body-size) ──────────────────────────

/** Non-deleted proofs per move. Advisory UX cap, not a security boundary. */
export const MAX_PROOFS_PER_MOVE = 8;
export const PROOF_LABEL_MAX = 120;
export const PROOF_URL_MAX = 2048;
export const PROOF_QUOTE_MAX = 4000;
export const PROOF_SOURCE_TEXT_MAX = 8000;

// ── Per-kind field validation ──────────────────────────────────

export interface ProofAttachFields {
  kind: AttachableProofKind;
  label: string;
  url?: string | null;
  sourceText?: string | null;
  quote?: string | null;
  referencedArgumentId?: string | null;
}

function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed);
}

/**
 * True + null issue when the per-kind required fields are present and valid;
 * else a stable issue code. Mirrors the zod .refine() ladder in the Edge so the
 * pure test carries real branch coverage for every kind.
 *
 *   url / external_ref -> url required, http/https only
 *   quote             -> quote required
 *   source_text       -> sourceText required
 *   note              -> label OR sourceText (some content); no dangling empty note
 *   prior_move        -> referencedArgumentId required
 */
export function validateKindFields(
  f: ProofAttachFields,
): { ok: true } | { ok: false; issue: string } {
  switch (f.kind) {
    case 'url':
    case 'external_ref':
      if (!present(f.url)) return { ok: false, issue: 'url_required' };
      if (!isHttpUrl(f.url)) return { ok: false, issue: 'url_invalid_scheme' };
      return { ok: true };
    case 'quote':
      if (!present(f.quote)) return { ok: false, issue: 'quote_required' };
      return { ok: true };
    case 'source_text':
      if (!present(f.sourceText)) return { ok: false, issue: 'source_text_required' };
      return { ok: true };
    case 'note':
      if (!present(f.label) && !present(f.sourceText)) {
        return { ok: false, issue: 'note_content_required' };
      }
      return { ok: true };
    case 'prior_move':
      if (!present(f.referencedArgumentId)) {
        return { ok: false, issue: 'referenced_argument_required' };
      }
      return { ok: true };
    default: {
      // Exhaustiveness guard for the six-value union.
      const never: never = f.kind;
      return { ok: false, issue: `unsupported_kind_${String(never)}` };
    }
  }
}

// ── Server-side status derivation (condition (ii)) ─────────────

/**
 * Mirror of src/features/evidence/evidenceModel.ts deriveSourceChainStatus.
 * Returns ONLY unverified | source_no_quote | source_and_quote. It can never
 * return broken / primary_present, so a client can never mint a privileged
 * status through this function (condition (ii) of the PROOF-001 review).
 *
 *   quote alone (no url, no sourceText)        -> unverified
 *   (url OR sourceText) AND quote              -> source_and_quote
 *   url OR sourceText (no quote)               -> source_no_quote
 *   none of the three                          -> unverified (weakest an-artifact-exists state)
 *
 * Note: for kind === note the note body lives in sourceText, so a note with a
 * body derives source_no_quote (it folds to manual_citation on the read side,
 * which discharges a source debt). A prior_move with only a referenced argument
 * (no url / sourceText / quote) derives unverified.
 */
export function deriveProofSourceChainStatus(f: ProofAttachFields): DerivableSourceChainStatus {
  const hasUrl = present(f.url);
  const hasSourceText = present(f.sourceText);
  const hasQuote = present(f.quote);

  if (!hasUrl && !hasSourceText && hasQuote) return 'unverified';
  if ((hasUrl || hasSourceText) && hasQuote) return 'source_and_quote';
  if (hasUrl || hasSourceText) return 'source_no_quote';
  return 'unverified';
}

// ── Natural-content idempotency key (Design decision 5) ────────

/**
 * Deterministic + total natural-content idempotency key. Identical fields on the
 * same (argumentId, addedBy) yield an identical key; any changed field yields a
 * different key. Used to collapse a double-attach of the identical receipt to
 * the same move (which IS a duplicate) without a migration. Never reads
 * deleted state (the caller only dedupes among non-deleted rows).
 */
export function proofIdempotencyKey(
  argumentId: string,
  addedBy: string,
  f: ProofAttachFields,
): string {
  return JSON.stringify([
    argumentId,
    addedBy,
    f.kind,
    f.url ?? '',
    f.sourceText ?? '',
    f.quote ?? '',
    f.referencedArgumentId ?? '',
    f.label ?? '',
  ]);
}
