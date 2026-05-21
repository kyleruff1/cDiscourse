/**
 * EV-001 — Evidence object model v1.
 *
 * Doctrine (verbatim from docs/designs/EV-001.md):
 *
 *   "Evidence is a first-class addressable gameplay object with a stable
 *    identity, a typed `kind`, a deterministic `sourceChainStatus`, an
 *    `EvidenceRisk` band, and a clear receipt-chip + timeline-node display
 *    contract.
 *
 *    Status fields describe the *trail*, not the *truth*. Popularity is not
 *    evidence — `EvidenceArtifactKind` does not include any popularity-shaped
 *    value (no likes, retweets, views, followers, verified, engagement,
 *    amplification, trending, virality). Missing evidence hard-blocks only
 *    `argument_type = 'evidence'` posts; ordinary replies stay postable —
 *    that contract is owned by `evaluateArgumentDraft.EVIDENCE_SOURCE_REQUIRED`
 *    and is asserted by EV-001 tests but not re-implemented here."
 *
 * Persistence path: (b) — pure TypeScript adapter. No schema change in v1.
 * The adapter normalises the existing `attached_evidence` payload into
 * `EvidenceArtifact[]` at read time; later persistence (path c) would store
 * rows of this shape and keep this module as the authoritative classifier.
 *
 * Pure TypeScript. No React. No Supabase. No network. No async.
 */

// ── Enumerations ──────────────────────────────────────────────

/**
 * The kind of inspectable artifact attached to a move. New kinds are added
 * here; no UI surface may invent its own. Popularity, author identity,
 * follower count, and "verified" status are deliberately NOT kinds — see
 * evidence-doctrine "What does NOT count as evidence."
 */
export type EvidenceArtifactKind =
  | 'url' // Inspectable web URL the user pasted.
  | 'quote' // Verbatim text excerpt; should match a linked source.
  | 'source_text' // Free-text excerpt of a source (no URL).
  | 'dataset' // Pointer to a dataset (URL or identifier).
  | 'screenshot_redacted' // Image artifact with PII / handles stripped.
  | 'manual_citation' // Bibliographic-style citation (book, paper, broadcast).
  | 'payment_screenshot'; // QOL-036 — a payment / transfer record. Carries a
//                          structured `payment` sub-object; proves at most
//                          that a payment object exists, never what it was for.

/**
 * Status of the chain from claim → cited evidence. Strictly advisory; the
 * UI uses it to pick the non-accusatory prompt, never to declare truth.
 *
 *   no_source          no artifact attached at all — aggregate-only status
 *                      (never returned by `deriveSourceChainStatus`; surfaced
 *                      by the chip / timeline helpers when artifacts.length
 *                      === 0). EV-002 reads this to render "Ask for source".
 *   unverified         user attached but nothing inspected yet
 *   source_no_quote    URL or citation present, but no quote / excerpt
 *   source_and_quote   URL/citation AND a quote / excerpt are both present
 *   broken             chain is dead (404, contradictory, circular) — set
 *                      manually or by a later admin check; EV-001 never
 *                      auto-decides this
 *   primary_present    chain reaches an inspectable primary record — set
 *                      manually by an admin or by a future automated check;
 *                      EV-001 NEVER auto-promotes to this value
 */
export type SourceChainStatus =
  | 'no_source'
  | 'unverified'
  | 'source_no_quote'
  | 'source_and_quote'
  | 'broken'
  | 'primary_present';

/**
 * How confidently the system treats this artifact's contribution to the
 * argument's standing. NOT a truth claim about the source — describes the
 * INSPECTABILITY of the artifact. Always advisory.
 */
export type EvidenceRisk = 'low' | 'medium' | 'high' | 'unknown';

/** Enumerations exposed for tests / docs. Frozen so callers cannot mutate. */
export const ALL_EVIDENCE_ARTIFACT_KINDS: ReadonlyArray<EvidenceArtifactKind> = Object.freeze([
  'url',
  'quote',
  'source_text',
  'dataset',
  'screenshot_redacted',
  'manual_citation',
  'payment_screenshot',
]);

export const ALL_SOURCE_CHAIN_STATUSES: ReadonlyArray<SourceChainStatus> = Object.freeze([
  'no_source',
  'unverified',
  'source_no_quote',
  'source_and_quote',
  'broken',
  'primary_present',
]);

export const ALL_EVIDENCE_RISKS: ReadonlyArray<EvidenceRisk> = Object.freeze([
  'low',
  'medium',
  'high',
  'unknown',
]);

// ── Artifact record ───────────────────────────────────────────

/**
 * The full artifact record. v1 produces this from the adapter; later
 * persistence (path c) would store rows of this shape.
 */
export interface EvidenceArtifact {
  /** Stable deterministic id. Adapter mints: `<argumentId>:evidence:<index>`. */
  id: string;
  /** FK back to public.arguments.id. */
  argumentId: string;
  kind: EvidenceArtifactKind;
  /** Plain-language label the user typed or the adapter derived. Max 120 chars. */
  label: string;
  /** Optional URL — present when kind = 'url' or 'dataset'. */
  url?: string;
  /** Optional source text excerpt — present when kind = 'source_text'. */
  sourceText?: string;
  /** Optional verbatim quote tied to the source. */
  quote?: string;
  sourceChainStatus: SourceChainStatus;
  risk: EvidenceRisk;
  /** The author of the parent argument. Adapter copies from arguments.author_id. */
  addedByUserId: string;
  /** ISO-8601. Adapter copies from arguments.created_at. */
  createdAt: string;
  /**
   * QOL-036 — structured payment / transfer metadata. Present ONLY when
   * `kind === 'payment_screenshot'`. Optional and additive: every existing
   * consumer that ignores this field behaves identically. A payment object is
   * INERT — it carries no truth value and emits no point-standing delta.
   */
  payment?: PaymentEvidenceMetadata;
}

// ── Adapter input shape ───────────────────────────────────────

/**
 * The raw shape the adapter accepts. Mirrors what we already store on the
 * ComposerDraft + what the Edge Function persists into the validation
 * snapshot. All fields optional so callers can pass minimal data.
 */
export interface EvidenceAttachmentInput {
  url?: string | null;
  label?: string | null;
  sourceText?: string | null;
  quote?: string | null;
  /** Optional explicit kind. When omitted, classifyEvidenceKind derives it. */
  kind?: EvidenceArtifactKind;
  /**
   * QOL-036 — optional structured payment metadata. When present, the adapter
   * classifies the kind as `payment_screenshot` (unless an explicit `kind`
   * wins) and runs the redaction guard before storing it.
   */
  payment?: PaymentEvidenceMetadata;
}

export interface BuildEvidenceArtifactsInput {
  argumentId: string;
  addedByUserId: string;
  createdAt: string;
  attachments: ReadonlyArray<EvidenceAttachmentInput>;
  /** Test / admin overrides. Production calls leave undefined. */
  overrides?: { [artifactId: string]: Partial<EvidenceArtifact> };
}

// ── Helpers ───────────────────────────────────────────────────

/** Treat null / undefined / whitespace-only as "not present". */
function isPresent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Short, conservative dataset host allowlist. Extending this is an EV-003
 * concern; today the list lives here so the adapter is fully deterministic.
 */
// TODO(EV-003): extend or move to constitution config.
const DATASET_HOST_ALLOWLIST: ReadonlyArray<string> = Object.freeze([
  'data.gov',
  'figshare.com',
  'zenodo.org',
]);

function hostnameOf(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) return null;
  try {
    const u = new URL(trimmed);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isDatasetUrl(rawUrl: string): boolean {
  const host = hostnameOf(rawUrl);
  if (host === null) return false;
  return DATASET_HOST_ALLOWLIST.some(
    (allow) => host === allow || host.endsWith(`.${allow}`),
  );
}

/**
 * Decide the kind from populated fields. Never returns `quote` alone — a
 * quote without any source pointer is downgraded to `source_text`.
 *
 * `screenshot_redacted` and `manual_citation` are reserved for future
 * ingestion paths and are emitted by this function only when the caller
 * passes `att.kind` explicitly. The all-blank case falls back to
 * `manual_citation` (not reachable from `buildEvidenceArtifacts`, which
 * drops blank entries).
 */
export function classifyEvidenceKind(att: EvidenceAttachmentInput): EvidenceArtifactKind {
  if (att.kind) return att.kind;
  // QOL-036 — a payment sub-object classifies the attachment as a payment
  // screenshot. A url / sourceText / quote on the SAME attachment is still
  // honoured by `buildEvidenceArtifacts` (the source-chain table runs over
  // them); the kind, however, names the payment record. An explicit
  // `att.kind` above still wins.
  if (att.payment) return 'payment_screenshot';
  if (isPresent(att.url)) {
    return isDatasetUrl(att.url) ? 'dataset' : 'url';
  }
  if (isPresent(att.sourceText)) return 'source_text';
  if (isPresent(att.quote)) return 'source_text';
  return 'manual_citation';
}

/**
 * Pure: run the decision table from the design against (url, sourceText,
 * quote). Never returns `no_source` (that is the aggregate-only state when
 * no artifact exists at all) and never returns `broken` / `primary_present`
 * (those are reserved for admin / future automated overrides).
 */
export function deriveSourceChainStatus(
  att: Pick<EvidenceAttachmentInput, 'url' | 'sourceText' | 'quote'>,
): SourceChainStatus {
  const hasUrl = isPresent(att.url);
  const hasSourceText = isPresent(att.sourceText);
  const hasQuote = isPresent(att.quote);

  // Quote alone (no url, no sourceText) — structurally weak, no source pointer.
  if (!hasUrl && !hasSourceText && hasQuote) return 'unverified';

  // Source pointer (url or sourceText) plus quote → source_and_quote.
  if ((hasUrl || hasSourceText) && hasQuote) return 'source_and_quote';

  // Source pointer without quote → source_no_quote.
  if (hasUrl || hasSourceText) return 'source_no_quote';

  // All fields absent. Unreachable from buildEvidenceArtifacts (the adapter
  // drops the entry); kept as a defensive default that still respects the
  // "never return no_source" invariant by surfacing the weakest "an artifact
  // exists" state.
  return 'unverified';
}

function truncateLabel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 120) return trimmed;
  // 119 chars + ellipsis = 120 total.
  return `${trimmed.slice(0, 119)}…`;
}

function deriveLabel(att: EvidenceAttachmentInput): string {
  if (isPresent(att.label)) return truncateLabel(att.label);
  if (isPresent(att.url)) {
    const host = hostnameOf(att.url);
    if (host !== null) return truncateLabel(host);
  }
  if (isPresent(att.sourceText)) {
    return truncateLabel(att.sourceText.trim().slice(0, 32));
  }
  return 'Attached evidence';
}

function isAttachmentEmpty(att: EvidenceAttachmentInput): boolean {
  // QOL-036 — a payment-only attachment (no url / sourceText / quote, but a
  // `payment` sub-object) is NOT empty. EV-001's first three fields plus
  // `payment` are the four that count.
  return (
    !isPresent(att.url) &&
    !isPresent(att.sourceText) &&
    !isPresent(att.quote) &&
    att.payment === undefined
  );
}

/**
 * Adapter: turn a raw attachment array into typed artifacts. Order is
 * preserved. Empty / all-null entries are dropped. Ids are deterministic
 * (`<argumentId>:evidence:<index>`) and stable across reads — dropped
 * entries do NOT renumber later entries.
 */
export function buildEvidenceArtifacts(
  input: BuildEvidenceArtifactsInput,
): EvidenceArtifact[] {
  const { argumentId, addedByUserId, createdAt, attachments, overrides } = input;
  const out: EvidenceArtifact[] = [];

  for (let index = 0; index < attachments.length; index += 1) {
    const att = attachments[index];
    if (isAttachmentEmpty(att)) continue;

    const id = `${argumentId}:evidence:${index}`;
    let kind = classifyEvidenceKind(att);

    // QOL-036 — payment handling. Decide BEFORE building `base` so the kind
    // reflects a redaction degradation. `prepareStoredPayment` returns the
    // cleaned, confidence-pinned, amount-normalised payment object — or null
    // when the redaction guard found raw account data (the artifact is still
    // emitted, downgraded to `screenshot_redacted`; a missing screenshot
    // beats a leaked account number). Throw-free, deterministic.
    let storedPayment: PaymentEvidenceMetadata | undefined;
    if (att.payment !== undefined) {
      const cleaned = prepareStoredPayment(att.payment);
      if (cleaned === null) {
        // Redaction degradation — strip the payment object. Only downgrade a
        // kind the payment branch itself produced; an explicit `att.kind`
        // (e.g. 'url') is left intact.
        if (kind === 'payment_screenshot') kind = 'screenshot_redacted';
      } else {
        storedPayment = cleaned;
      }
    }

    const base: EvidenceArtifact = {
      id,
      argumentId,
      kind,
      label: deriveLabel(att),
      sourceChainStatus: deriveSourceChainStatus(att),
      risk: 'unknown',
      addedByUserId,
      createdAt,
    };
    if (isPresent(att.url)) base.url = att.url.trim();
    if (isPresent(att.sourceText)) base.sourceText = att.sourceText.trim();
    if (isPresent(att.quote)) base.quote = att.quote.trim();
    if (storedPayment !== undefined) base.payment = storedPayment;

    const ov = overrides ? overrides[id] : undefined;
    if (ov) {
      // Shallow merge. Test / admin path only.
      out.push({ ...base, ...ov });
    } else {
      out.push(base);
    }
  }

  return out;
}

// ── Receipt-chip display contract ─────────────────────────────

export interface ReceiptChipContract {
  /** Pure label, plain English, max 32 chars. Never a snake_case code. */
  label: string;
  /** Plain-English helper, max 80 chars. Empty string if not applicable. */
  helper: string;
  /** Logical tone — renderers map this to a color token. NOT a truth label. */
  tone: 'neutral' | 'info' | 'attention' | 'muted';
  /** True when the user should be invited to ask for a quote / source.
   *  EV-002 uses this to decide whether to insert the popover trigger. */
  invitesFollowup: boolean;
  /** True when this should render with the dotted teal ring per VG-001 row
   *  "Source-chain demand". Hand to the timeline-node renderer. */
  showsSourceChainPressure: boolean;
  /** Underlying status — EV-002/EV-003 keep this around to drive their own
   *  branching without re-deriving it. NEVER rendered as a raw string. */
  status: SourceChainStatus;
  /** Per-kind aggregate, so chip can say e.g. "URL + quote attached". */
  kinds: ReadonlyArray<EvidenceArtifactKind>;
  /** Total artifact count. Used for "+N more" affordances. */
  count: number;
}

interface ChipCopyEntry {
  label: string;
  helper: string;
  tone: ReceiptChipContract['tone'];
  invitesFollowup: boolean;
  showsSourceChainPressure: boolean;
}

const RECEIPT_CHIP_COPY: Readonly<Record<SourceChainStatus, ChipCopyEntry>> = Object.freeze({
  no_source: {
    label: 'No source yet',
    helper: 'Nothing has been attached to back this move. Asking for a source is a good move.',
    tone: 'info',
    invitesFollowup: true,
    showsSourceChainPressure: true,
  },
  unverified: {
    label: 'Receipt attached',
    helper: 'An excerpt is attached. Pointing to a source would strengthen it.',
    tone: 'info',
    invitesFollowup: true,
    showsSourceChainPressure: true,
  },
  source_no_quote: {
    label: 'Source attached',
    helper: 'A source is attached. A quote from it would tighten the trail.',
    tone: 'info',
    invitesFollowup: true,
    showsSourceChainPressure: true,
  },
  source_and_quote: {
    label: 'Source and quote',
    helper: 'A source and a verbatim quote are attached.',
    tone: 'neutral',
    invitesFollowup: false,
    showsSourceChainPressure: false,
  },
  primary_present: {
    label: 'Primary source',
    helper: 'The trail reaches a primary record.',
    tone: 'neutral',
    invitesFollowup: false,
    showsSourceChainPressure: false,
  },
  broken: {
    label: 'Source trail is weak',
    helper: 'The chain dead-ends, cycles, or contradicts itself. Ask for a stronger source.',
    tone: 'attention',
    invitesFollowup: true,
    showsSourceChainPressure: true,
  },
});

/**
 * Worst-status ordering used when summarising a list of artifacts. The
 * ordering encodes "the chip should reflect the weakest link in the trail":
 * a broken artifact dominates an unverified one, which dominates a
 * source-only one, which dominates a fully-sourced+quoted one.
 *
 * `no_source` is NOT in this ordering — it is produced only when the input
 * array is empty (no per-artifact statuses to compare).
 */
const STATUS_SEVERITY: Readonly<Record<Exclude<SourceChainStatus, 'no_source'>, number>> = Object.freeze({
  broken: 5,
  unverified: 4,
  source_no_quote: 3,
  source_and_quote: 2,
  primary_present: 1,
});

function uniqueKinds(
  artifacts: ReadonlyArray<EvidenceArtifact>,
): ReadonlyArray<EvidenceArtifactKind> {
  const seen = new Set<EvidenceArtifactKind>();
  const out: EvidenceArtifactKind[] = [];
  for (const a of artifacts) {
    if (!seen.has(a.kind)) {
      seen.add(a.kind);
      out.push(a.kind);
    }
  }
  return out;
}

/**
 * Summarise the artifact list for a single move into one receipt-chip
 * contract. Empty array returns the `no_source` form.
 */
export function summarizeArtifactsForReceiptChip(
  artifacts: ReadonlyArray<EvidenceArtifact>,
): ReceiptChipContract {
  if (artifacts.length === 0) {
    const copy = RECEIPT_CHIP_COPY.no_source;
    return {
      label: copy.label,
      helper: copy.helper,
      tone: copy.tone,
      invitesFollowup: copy.invitesFollowup,
      showsSourceChainPressure: copy.showsSourceChainPressure,
      status: 'no_source',
      kinds: Object.freeze([]),
      count: 0,
    };
  }

  let worst: Exclude<SourceChainStatus, 'no_source'> = 'primary_present';
  let worstSeverity = STATUS_SEVERITY[worst];
  for (const a of artifacts) {
    // `a.sourceChainStatus` is one of the SourceChainStatus values; only
    // `no_source` is excluded by construction (adapter never emits it, and
    // overrides have to opt into a different value). Guard defensively.
    const status = a.sourceChainStatus as Exclude<SourceChainStatus, 'no_source'>;
    const severity = STATUS_SEVERITY[status];
    if (typeof severity !== 'number') continue;
    if (severity > worstSeverity) {
      worst = status;
      worstSeverity = severity;
    }
  }

  const copy = RECEIPT_CHIP_COPY[worst];
  return {
    label: copy.label,
    helper: copy.helper,
    tone: copy.tone,
    invitesFollowup: copy.invitesFollowup,
    showsSourceChainPressure: copy.showsSourceChainPressure,
    status: worst,
    kinds: uniqueKinds(artifacts),
    count: artifacts.length,
  };
}

// ── Timeline-node evidence contract ───────────────────────────

export interface TimelineEvidenceContract {
  /** True when the node should render with the hexagon shape from VG-001.
   *  False for ordinary claim / challenge nodes. */
  rendersAsEvidenceNode: boolean;
  /** True when a dotted ring should overlay the node (VG-001 source-chain
   *  demand row). */
  rendersSourceChainRing: boolean;
  /** Plain-English accessibility label suffix appended to the node's
   *  primary a11y label. Empty string when no evidence-related suffix
   *  is warranted. e.g. "with a source and a quote." */
  accessibilityLabelSuffix: string;
  /** The contract the receipt chip would render — exposed so node
   *  decorators don't re-call the summariser. */
  receiptChip: ReceiptChipContract;
}

function isEvidenceArgumentType(argumentType: string | null | undefined): boolean {
  return argumentType === 'evidence';
}

/**
 * Build the timeline-node evidence contract from an argument's type and
 * artifact list. Pure.
 */
export function getTimelineEvidenceContract(
  argumentType: string | null | undefined,
  artifacts: ReadonlyArray<EvidenceArtifact>,
): TimelineEvidenceContract {
  const chip = summarizeArtifactsForReceiptChip(artifacts);
  const isEvidence = isEvidenceArgumentType(argumentType);

  let rendersAsEvidenceNode = false;
  let rendersSourceChainRing = chip.showsSourceChainPressure;
  let accessibilityLabelSuffix = '';

  if (isEvidence) {
    rendersAsEvidenceNode = true;
    if (artifacts.length === 0) {
      accessibilityLabelSuffix = 'Evidence node, no source yet.';
    } else if (chip.status === 'source_and_quote' || chip.status === 'primary_present') {
      accessibilityLabelSuffix =
        chip.status === 'primary_present'
          ? 'Evidence node, primary source attached.'
          : 'Evidence node, source and quote attached.';
    } else {
      accessibilityLabelSuffix = `Evidence node, ${chip.label.toLowerCase()}.`;
    }
  } else if (artifacts.length > 0) {
    accessibilityLabelSuffix = `Has attached receipt: ${chip.label.toLowerCase()}.`;
  } else {
    // Non-evidence node with no artifacts: no decoration, no suffix.
    rendersSourceChainRing = false;
    accessibilityLabelSuffix = '';
  }

  return {
    rendersAsEvidenceNode,
    rendersSourceChainRing,
    accessibilityLabelSuffix,
    receiptChip: chip,
  };
}

// ══════════════════════════════════════════════════════════════
// EV-005 — Evidence-to-evidence interaction (annotations on evidence)
// ══════════════════════════════════════════════════════════════
//
// EV-005 adds a thin ANNOTATION layer on top of the EV-001 EvidenceArtifact.
// A participant or admin attaches a small, descriptive note to a specific
// artifact. Every value below describes the SOURCE or the RECORD — never a
// person, never a verdict.
//
// Doctrine (verbatim from docs/designs/EV-005.md):
//   - Annotations describe the source / record, never accuse a person.
//   - An annotation never converts popularity into factual standing
//     (anti-amplification): summariseAnnotations reads ONLY the annotation
//     set — no likes, views, follower counts, or author identity.
//   - An annotation has no path to a PointStandingDelta (this module imports
//     nothing from pointStanding / antiAmplification — a forbidden-imports
//     test enforces the structural gap).
//   - An annotation never blocks an ordinary post; AI never authors one.
//   - Annotations on annotations are capped at ONE level; beyond that the UI
//     replaces the picker with a "Summarise this evidence thread" prompt.
//
// Plain-language note: EV-005 introduces an annotation copy map LOCAL to this
// module (parallel to EV-001's RECEIPT_CHIP_COPY), NOT an addition to
// gameCopy.PLAIN_LANGUAGE_COPY. The 18 snake_case kind codes are NEVER
// rendered raw — only via getEvidenceAnnotationLabel / getEvidenceAnnotationHelper.
//
// Still pure TypeScript. No React. No Supabase. No network. No async.

// ── Annotation kind enum (18 kinds) ───────────────────────────

/**
 * EV-005 — Evidence-annotation kind. Every value describes the SOURCE or the
 * RECORD, never a person. No verdict, no person-attribution. Aligned with
 * META-001's manual-tag philosophy: a participant annotation, never a flag,
 * never a moderation action.
 */
export type EvidenceAnnotationKind =
  | 'primary_source' // the artifact is (or reaches) a primary record
  | 'secondary_analysis' // the artifact is secondary commentary on a source
  | 'quote_attached' // a verbatim quote is present alongside the source
  | 'source_missing_quote' // a source pointer with no quote excerpt
  | 'quote_disputed' // the quoted text may not match the linked source
  | 'context_requested' // more context is being asked for on this artifact
  | 'retraction_attached' // a retraction / correction notice is linked
  | 'source_later_updated' // the source was revised after it was first cited
  | 'satire_parody_context' // the source is satire / parody, not a literal report
  | 'screenshot_only_chain_weak' // only a screenshot exists; no inspectable chain
  | 'misreporting_alleged' // an alternate account of the same facts exists
  | 'translation_context_issue' // translation may affect the meaning of the source
  | 'outdated_source' // the source predates more current information
  | 'methodology_dispute' // the source's method/sampling is contested
  | 'broken_link' // the linked source no longer resolves
  | 'paywalled_source' // the source is behind a paywall / not freely open
  | 'conflicting_source' // another source disagrees with this one
  | 'source_chain_anchored'; // the chain reaches an inspectable anchor

/** Frozen array of every annotation kind. Exactly 18 entries. */
export const ALL_EVIDENCE_ANNOTATION_KINDS: ReadonlyArray<EvidenceAnnotationKind> = Object.freeze([
  'primary_source',
  'secondary_analysis',
  'quote_attached',
  'source_missing_quote',
  'quote_disputed',
  'context_requested',
  'retraction_attached',
  'source_later_updated',
  'satire_parody_context',
  'screenshot_only_chain_weak',
  'misreporting_alleged',
  'translation_context_issue',
  'outdated_source',
  'methodology_dispute',
  'broken_link',
  'paywalled_source',
  'conflicting_source',
  'source_chain_anchored',
]);

// ── Plain-language copy map ────────────────────────────────────

interface AnnotationCopyEntry {
  /** Picker option + chip label. Plain English, ≤ 32 chars, never a code. */
  label: string;
  /** Picker subtitle + chip detail. Plain English, ≤ 90 chars. */
  helper: string;
}

/**
 * The 18 plain-language strings the picker, chips, and stream render. The
 * snake_case codes are NEVER shown to a user.
 *
 * Three kinds (misreporting_alleged, quote_disputed, methodology_dispute)
 * have internal codes that read close to an accusation. Their labels/helpers
 * are deliberately written about the RECORD, not a person — see the
 * Non-accusatory copy contract in docs/designs/EV-005.md. Do not "improve"
 * this copy toward a verb about a person; the ban-list test is the guard.
 */
const EVIDENCE_ANNOTATION_COPY: Readonly<Record<EvidenceAnnotationKind, AnnotationCopyEntry>> =
  Object.freeze({
    primary_source: Object.freeze({
      label: 'Primary source',
      helper: 'This points to (or reaches) an original record.',
    }),
    secondary_analysis: Object.freeze({
      label: 'Secondary analysis',
      helper: 'This is commentary about a source, not the source itself.',
    }),
    quote_attached: Object.freeze({
      label: 'Quote attached',
      helper: 'A verbatim quote is included alongside the source.',
    }),
    source_missing_quote: Object.freeze({
      label: 'Source has no quote',
      helper: 'A source is linked but no quoted passage is shown.',
    }),
    quote_disputed: Object.freeze({
      label: 'Quote may not match',
      helper: 'The quoted text may not match what the linked source says.',
    }),
    context_requested: Object.freeze({
      label: 'More context asked for',
      helper: 'Someone has asked for more context on this source.',
    }),
    retraction_attached: Object.freeze({
      label: 'Retraction attached',
      helper: 'A retraction or correction notice is linked here.',
    }),
    source_later_updated: Object.freeze({
      label: 'Source was updated later',
      helper: 'The source was revised after it was first cited.',
    }),
    satire_parody_context: Object.freeze({
      label: 'Satire or parody',
      helper: 'This source is satire or parody, not a literal report.',
    }),
    screenshot_only_chain_weak: Object.freeze({
      label: 'Screenshot only',
      helper: 'Only a screenshot exists; there is no inspectable trail.',
    }),
    misreporting_alleged: Object.freeze({
      label: 'An alternate account exists',
      helper: 'A different account of the same facts has been put forward.',
    }),
    translation_context_issue: Object.freeze({
      label: 'Translation may affect meaning',
      helper: 'Translation could change how this source reads.',
    }),
    outdated_source: Object.freeze({
      label: 'Source may be outdated',
      helper: 'This source predates more current information.',
    }),
    methodology_dispute: Object.freeze({
      label: 'Method is contested',
      helper: "The source's method or sampling is being questioned.",
    }),
    broken_link: Object.freeze({
      label: 'Link no longer works',
      helper: 'The linked source no longer resolves.',
    }),
    paywalled_source: Object.freeze({
      label: 'Behind a paywall',
      helper: 'The source is not freely open to read.',
    }),
    conflicting_source: Object.freeze({
      label: 'Another source disagrees',
      helper: 'A different source disagrees with this one.',
    }),
    source_chain_anchored: Object.freeze({
      label: 'Source trail is anchored',
      helper: 'The trail reaches a record you can inspect.',
    }),
  });

/** Plain-English label for an annotation kind. Never a snake_case code. */
export function getEvidenceAnnotationLabel(kind: EvidenceAnnotationKind): string {
  return EVIDENCE_ANNOTATION_COPY[kind].label;
}

/** Plain-English helper for an annotation kind. Never a snake_case code. */
export function getEvidenceAnnotationHelper(kind: EvidenceAnnotationKind): string {
  return EVIDENCE_ANNOTATION_COPY[kind].helper;
}

// ── The annotation object ──────────────────────────────────────

/**
 * EV-005 — One annotation attached to one EV-001 EvidenceArtifact. Frozen at
 * construction. JSON-serializable. v1 persists inside the existing
 * client_validation jsonb on the argument (no DB migration).
 */
export type EvidenceAnnotation = Readonly<{
  /** Stable id. Adapter mints: `<evidenceArtifactId>:annotation:<index>`.
   *  The write path (Edge Function) mints the same shape on append. */
  id: string;
  /** FK back to the EV-001 EvidenceArtifact.id this annotation describes. */
  evidenceArtifactId: string;
  kind: EvidenceAnnotationKind;
  /** Optional ≤ 140-char free-text note. Describes the SOURCE; never a
   *  person. Rendered read-only beneath the chip. */
  note?: string;
  /** The participant/admin who added the annotation. Never AI. */
  addedByUserId: string;
  /** ISO-8601. */
  createdAt: string;
  /**
   * Annotation-nesting depth. 0 = annotation directly on an artifact.
   * 1 = annotation on an annotation (the one permitted nested level).
   * The model rejects/suppresses anything > 1 — see depth cap.
   */
  depth: 0 | 1;
  /** When depth === 1, the id of the depth-0 annotation it responds to.
   *  null/absent for depth 0. */
  parentAnnotationId?: string | null;
}>;

// ── Status chip + summary ──────────────────────────────────────

/** EV-005 — derived status chip. Describes the annotation set's shape,
 *  never a truth verdict. */
export type EvidenceAnnotationStatusChip =
  | 'anchored' // a primary_source / source_chain_anchored annotation present
  | 'conflict_open' // a conflicting/disputed/retraction/misreporting annotation present
  | 'context_open' // a context_requested annotation present, no conflict
  | 'paywalled' // a paywalled_source annotation present, no conflict/context
  | 'broken' // a broken_link / screenshot_only_chain_weak annotation present
  | 'unknown'; // no annotations, or none that map to a higher-priority chip

export interface EvidenceAnnotationSummary {
  /** primary_source + source_chain_anchored + quote_attached annotations. */
  primary: ReadonlyArray<EvidenceAnnotation>;
  /** conflicting_source + quote_disputed + retraction_attached +
   *  misreporting_alleged + methodology_dispute + outdated_source +
   *  source_later_updated + translation_context_issue annotations. */
  conflicts: ReadonlyArray<EvidenceAnnotation>;
  /** context_requested annotations. */
  contextRequests: ReadonlyArray<EvidenceAnnotation>;
  /** The single derived status chip (priority resolution — see below). */
  statusChip: EvidenceAnnotationStatusChip;
  /** Total annotation count (depth 0 + accepted depth 1). Drives the "+N"
   *  affordance and the timeline receipt-count reflection. */
  count: number;
  /** Plain-English label for statusChip. Max 32 chars. Never a code. */
  statusLabel: string;
  /** Plain-English helper for statusChip. Max 90 chars. */
  statusHelper: string;
  /** Logical tone for the chip renderer. NOT a truth label. */
  tone: 'neutral' | 'info' | 'attention' | 'muted';
}

interface StatusChipCopyEntry {
  statusLabel: string;
  statusHelper: string;
  tone: EvidenceAnnotationSummary['tone'];
}

/** Plain-language copy for each derived status chip. Ban-list-clean. */
const ANNOTATION_STATUS_CHIP_COPY: Readonly<
  Record<EvidenceAnnotationStatusChip, StatusChipCopyEntry>
> = Object.freeze({
  anchored: Object.freeze({
    statusLabel: 'Source trail is anchored',
    statusHelper: 'An annotation marks this source as reaching an inspectable record.',
    tone: 'neutral',
  }),
  conflict_open: Object.freeze({
    statusLabel: 'Open conflict',
    statusHelper: 'An annotation flags a conflicting, disputed, or retracted source.',
    tone: 'attention',
  }),
  context_open: Object.freeze({
    statusLabel: 'Context asked for',
    statusHelper: 'Someone has asked for more context on this source.',
    tone: 'info',
  }),
  paywalled: Object.freeze({
    statusLabel: 'Behind a paywall',
    statusHelper: 'An annotation notes this source is not freely open.',
    tone: 'info',
  }),
  broken: Object.freeze({
    statusLabel: 'Trail is weak',
    statusHelper: 'An annotation notes the trail is broken or screenshot-only.',
    tone: 'attention',
  }),
  unknown: Object.freeze({
    statusLabel: 'No annotations yet',
    statusHelper: 'No one has added context to this source.',
    tone: 'muted',
  }),
});

// ── Kind → summary bucket classification ──────────────────────

/** Kinds that route to the `primary` summary bucket. */
const PRIMARY_KINDS: ReadonlySet<EvidenceAnnotationKind> = new Set<EvidenceAnnotationKind>([
  'primary_source',
  'source_chain_anchored',
  'quote_attached',
]);

/** Kinds that route to the `conflicts` summary bucket. */
const CONFLICT_KINDS: ReadonlySet<EvidenceAnnotationKind> = new Set<EvidenceAnnotationKind>([
  'conflicting_source',
  'quote_disputed',
  'retraction_attached',
  'misreporting_alleged',
  'methodology_dispute',
  'outdated_source',
  'source_later_updated',
  'translation_context_issue',
]);

/** Kinds that map the status chip to `broken`. */
const BROKEN_KINDS: ReadonlySet<EvidenceAnnotationKind> = new Set<EvidenceAnnotationKind>([
  'broken_link',
  'screenshot_only_chain_weak',
]);

// ── Constructor ────────────────────────────────────────────────

/** Trim a note to ≤ 140 chars; whitespace-only → undefined. */
function normaliseNote(note: string | null | undefined): string | undefined {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length <= 140 ? trimmed : trimmed.slice(0, 140);
}

/** True when a value is one of the 18 known annotation kinds. */
export function isEvidenceAnnotationKind(value: unknown): value is EvidenceAnnotationKind {
  return (
    typeof value === 'string' &&
    (ALL_EVIDENCE_ANNOTATION_KINDS as ReadonlyArray<string>).includes(value)
  );
}

/**
 * Constructor — used by the Edge Function id-mint parity + tests. Trims the
 * note to 140 chars, drops a whitespace-only note, freezes the result, and
 * mints id = `<evidenceArtifactId>:annotation:<index>`.
 */
export function buildEvidenceAnnotation(input: {
  evidenceArtifactId: string;
  kind: EvidenceAnnotationKind;
  addedByUserId: string;
  createdAt: string;
  /** For the deterministic id. */
  index: number;
  note?: string | null;
  /** Defaults to 0. */
  depth?: 0 | 1;
  parentAnnotationId?: string | null;
}): EvidenceAnnotation {
  const depth: 0 | 1 = input.depth === 1 ? 1 : 0;
  const note = normaliseNote(input.note);
  const annotation: EvidenceAnnotation = {
    id: `${input.evidenceArtifactId}:annotation:${input.index}`,
    evidenceArtifactId: input.evidenceArtifactId,
    kind: input.kind,
    addedByUserId: input.addedByUserId,
    createdAt: input.createdAt,
    depth,
    ...(note !== undefined ? { note } : {}),
    ...(depth === 1 ? { parentAnnotationId: input.parentAnnotationId ?? null } : {}),
  };
  return Object.freeze(annotation);
}

// ── Adapter: raw payload array → typed, depth-capped annotations ──

/**
 * Adapter: turn a raw persisted annotation array into typed, depth-capped
 * annotations. Drops entries with an unknown kind. Preserves order. Runs
 * every entry through enforceAnnotationDepthCap before returning.
 */
export function buildEvidenceAnnotations(input: {
  evidenceArtifactId: string;
  raw: ReadonlyArray<{
    kind: EvidenceAnnotationKind;
    note?: string | null;
    addedByUserId: string;
    createdAt: string;
    depth?: number;
    parentAnnotationId?: string | null;
  }>;
}): ReadonlyArray<EvidenceAnnotation> {
  const built: EvidenceAnnotation[] = [];
  if (!Array.isArray(input.raw)) return Object.freeze([]);
  for (let index = 0; index < input.raw.length; index += 1) {
    const entry = input.raw[index];
    if (!entry || !isEvidenceAnnotationKind(entry.kind)) continue;
    if (typeof entry.addedByUserId !== 'string' || entry.addedByUserId.trim().length === 0) {
      continue;
    }
    if (typeof entry.createdAt !== 'string' || entry.createdAt.trim().length === 0) {
      continue;
    }
    const depth: 0 | 1 = entry.depth === 1 ? 1 : 0;
    built.push(
      buildEvidenceAnnotation({
        evidenceArtifactId: input.evidenceArtifactId,
        kind: entry.kind,
        addedByUserId: entry.addedByUserId,
        createdAt: entry.createdAt,
        index,
        note: entry.note ?? null,
        depth,
        parentAnnotationId: entry.parentAnnotationId ?? null,
      }),
    );
  }
  // Depth cap drops any depth >= 2 / orphan depth-1 entries.
  return enforceAnnotationDepthCap(built).accepted;
}

// ── Depth cap ─────────────────────────────────────────────────

/** EV-005 — the locked synthesis-prompt label. */
export const ANNOTATION_SYNTHESIS_PROMPT_LABEL = 'Summarise this evidence thread';

export interface AnnotationDepthCapResult {
  /** depth-0 + valid depth-1 annotations. */
  accepted: ReadonlyArray<EvidenceAnnotation>;
  /** depth >= 2, orphan depth-1, or depth-1-on-depth-1 annotations. */
  suppressed: ReadonlyArray<EvidenceAnnotation>;
  /** true when any depth-1 annotation is accepted (the next level is closed →
   *  the UI offers a synthesis move instead of a depth-2 annotation). */
  showsSynthesisPrompt: boolean;
  /** ANNOTATION_SYNTHESIS_PROMPT_LABEL when shown; '' otherwise. */
  synthesisPromptLabel: string;
}

/**
 * Enforce the one-level annotation-nesting cap.
 *
 *   depth 0 — always accepted.
 *   depth 1 — accepted IF parentAnnotationId resolves to an accepted depth-0
 *             annotation. Orphan depth-1, or depth-1 whose parent is itself
 *             depth-1, is suppressed.
 *   depth >= 2 — always suppressed.
 *
 * showsSynthesisPrompt is true whenever any depth-1 annotation is accepted:
 * the level is at the cap, so further disagreement converts into a synthesis
 * move rather than a depth-2 annotation.
 */
export function enforceAnnotationDepthCap(
  annotations: ReadonlyArray<EvidenceAnnotation>,
): AnnotationDepthCapResult {
  const accepted: EvidenceAnnotation[] = [];
  const suppressed: EvidenceAnnotation[] = [];

  // Pass 1: every depth-0 annotation is accepted; it is also the set of
  // valid parents for depth-1 annotations.
  const acceptedDepthZeroIds = new Set<string>();
  for (const a of annotations) {
    if (a.depth === 0) {
      accepted.push(a);
      acceptedDepthZeroIds.add(a.id);
    }
  }

  // Pass 2: depth-1 annotations are accepted only when their parent resolves
  // to an accepted depth-0 annotation. Anything else is suppressed.
  let anyDepthOneAccepted = false;
  for (const a of annotations) {
    if (a.depth === 0) continue;
    if (a.depth === 1) {
      const parentId = a.parentAnnotationId ?? null;
      if (parentId !== null && acceptedDepthZeroIds.has(parentId)) {
        accepted.push(a);
        anyDepthOneAccepted = true;
      } else {
        // orphan depth-1, or parent is itself depth-1 (not a depth-0 id).
        suppressed.push(a);
      }
    } else {
      // depth >= 2 — defensively suppressed (constructor caps depth to 0|1,
      // but stored data could carry a wider value before adaptation).
      suppressed.push(a);
    }
  }

  return {
    accepted: Object.freeze(accepted),
    suppressed: Object.freeze(suppressed),
    showsSynthesisPrompt: anyDepthOneAccepted,
    synthesisPromptLabel: anyDepthOneAccepted ? ANNOTATION_SYNTHESIS_PROMPT_LABEL : '',
  };
}

// ── Summary ────────────────────────────────────────────────────

/**
 * Summarise the annotation set into one status chip + bucketed lists.
 *
 * Pure. Reads ONLY the annotation set — never engagement, likes, view
 * counts, follower counts, or the artifact author's identity. Never upgrades
 * EvidenceArtifact.sourceChainStatus and never touches PointStandingDelta.
 *
 * Status-chip priority resolution (deterministic): when multiple kinds are
 * present the chip reflects the MOST action-worthy state, in this order:
 *   conflict_open > context_open > broken > paywalled > anchored > unknown
 * Rationale: a conflict/retraction is the state a reader most needs to see;
 * an anchored chip must never HIDE an open conflict. `broken` outranks
 * `paywalled` because a dead link is a harder failure than a paywall.
 * Empty annotation list → `unknown`.
 */
export function summariseAnnotations(
  annotations: ReadonlyArray<EvidenceAnnotation>,
): EvidenceAnnotationSummary {
  const safe = Array.isArray(annotations) ? annotations : [];

  const primary: EvidenceAnnotation[] = [];
  const conflicts: EvidenceAnnotation[] = [];
  const contextRequests: EvidenceAnnotation[] = [];

  let hasConflict = false;
  let hasContext = false;
  let hasBroken = false;
  let hasPaywalled = false;
  let hasAnchored = false;

  for (const a of safe) {
    if (PRIMARY_KINDS.has(a.kind)) primary.push(a);
    if (CONFLICT_KINDS.has(a.kind)) conflicts.push(a);
    if (a.kind === 'context_requested') contextRequests.push(a);

    if (CONFLICT_KINDS.has(a.kind)) hasConflict = true;
    if (a.kind === 'context_requested') hasContext = true;
    if (BROKEN_KINDS.has(a.kind)) hasBroken = true;
    if (a.kind === 'paywalled_source') hasPaywalled = true;
    if (a.kind === 'primary_source' || a.kind === 'source_chain_anchored') hasAnchored = true;
  }

  let statusChip: EvidenceAnnotationStatusChip;
  if (hasConflict) {
    statusChip = 'conflict_open';
  } else if (hasContext) {
    statusChip = 'context_open';
  } else if (hasBroken) {
    statusChip = 'broken';
  } else if (hasPaywalled) {
    statusChip = 'paywalled';
  } else if (hasAnchored) {
    statusChip = 'anchored';
  } else {
    statusChip = 'unknown';
  }

  const copy = ANNOTATION_STATUS_CHIP_COPY[statusChip];

  return {
    primary: Object.freeze(primary),
    conflicts: Object.freeze(conflicts),
    contextRequests: Object.freeze(contextRequests),
    statusChip,
    count: safe.length,
    statusLabel: copy.statusLabel,
    statusHelper: copy.statusHelper,
    tone: copy.tone,
  };
}

// ── Actor eligibility ──────────────────────────────────────────

export type EvidenceAnnotationActorRole =
  | 'participant_other_bubble'
  | 'participant_own_bubble'
  | 'observer'
  | 'admin';

export interface EvidenceAnnotationEligibilityContext {
  actorRole: EvidenceAnnotationActorRole;
  /** depth of the annotation being added: 0 (on artifact) or 1 (on annotation). */
  targetDepth: 0 | 1;
}

/**
 * The 3 self-descriptive kinds an own-bubble author may add. An author may
 * update their own source record (it was revised, a correction was issued,
 * they want more context) — but may not add the 15 kinds that read as a
 * peer's descriptive challenge of someone else's source.
 */
export const OWN_BUBBLE_ANNOTATION_KINDS: ReadonlyArray<EvidenceAnnotationKind> = Object.freeze([
  'source_later_updated',
  'retraction_attached',
  'context_requested',
]);

/**
 * Frozen table — actorRole → the kinds that actor may add. Observers add
 * nothing; own-bubble authors add only the 3 self-descriptive kinds;
 * other-bubble participants and admins add all 18.
 */
export const EVIDENCE_ANNOTATION_ELIGIBILITY: Readonly<
  Record<EvidenceAnnotationActorRole, ReadonlyArray<EvidenceAnnotationKind>>
> = Object.freeze({
  participant_other_bubble: ALL_EVIDENCE_ANNOTATION_KINDS,
  participant_own_bubble: OWN_BUBBLE_ANNOTATION_KINDS,
  observer: Object.freeze([]),
  admin: ALL_EVIDENCE_ANNOTATION_KINDS,
});

/**
 * Pure helper. Returns true when an annotation add would be allowed given
 * the actor role + target depth.
 *
 *   - Observers → always false.
 *   - targetDepth > 1 → always false (the depth cap).
 *   - own-bubble → only the 3 self-descriptive kinds.
 *   - other-bubble + admin → all 18.
 */
export function isAnnotationAllowed(
  kind: EvidenceAnnotationKind,
  ctx: EvidenceAnnotationEligibilityContext,
): boolean {
  if (ctx.actorRole === 'observer') return false;
  // The depth cap: nothing beyond one nested level may be added.
  if (ctx.targetDepth !== 0 && ctx.targetDepth !== 1) return false;
  const allowed = EVIDENCE_ANNOTATION_ELIGIBILITY[ctx.actorRole];
  if (!allowed) return false;
  return allowed.includes(kind);
}

/** Convenience: the eligible-kind list the picker should render. Pure. */
export function eligibleAnnotationKinds(
  ctx: EvidenceAnnotationEligibilityContext,
): ReadonlyArray<EvidenceAnnotationKind> {
  if (ctx.actorRole === 'observer') return Object.freeze([]);
  if (ctx.targetDepth !== 0 && ctx.targetDepth !== 1) return Object.freeze([]);
  return EVIDENCE_ANNOTATION_ELIGIBILITY[ctx.actorRole] ?? Object.freeze([]);
}

// ── Ban-list seam (test consumer) ─────────────────────────────

/**
 * The tokens the EV-005 ban-list test scans every app-authored annotation
 * string against. Three groups: verdict tokens, amplification tokens, and
 * person-attribution tokens. None of these may appear in any annotation
 * label, helper, status copy, synthesis prompt, or picker string.
 *
 * Exposed as a function (not a const) so the ban-list test can assert it is
 * non-empty and actually iterated — guarding against an empty-list false pass.
 */
export function _forbiddenAnnotationTokens(): ReadonlyArray<string> {
  return Object.freeze([
    // Verdict tokens.
    'winner',
    'loser',
    'correct',
    'incorrect',
    'liar',
    'dishonest',
    'fake',
    'fraud',
    'hoax',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'astroturfer',
    'proof',
    'proven',
    'verdict',
    'defeated',
    // Amplification tokens.
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'viral',
    'popular',
    // Person-attribution tokens.
    'lied',
    'deceived',
    'misleading reader',
  ]);
}

// ══════════════════════════════════════════════════════════════
// QOL-036 — Payment / screenshot evidence metadata object
// ══════════════════════════════════════════════════════════════
//
// QOL-036 is an ADDITIVE extension of the EV-001 EvidenceArtifact. It lets a
// payment / transfer screenshot be attached as a STRUCTURED object — an
// amount, a date, a REDACTED payer/payee, a note, a CLAIMED applicability,
// and a `confidence` field PINNED to 'user_asserted'.
//
// Doctrine (verbatim from docs/designs/QOL-036.md):
//   - "A payment screenshot proves at most that a payment object exists —
//      never automatically what it was for." `confidence` is pinned to
//      'user_asserted'; the model carries no `verified` / `proven` / `valid`
//      / `isTrue` field.
//   - Existence != applicability. `amount` / `paidAt` / `noteText` /
//     `claimedApplicability` are SEPARATE axes so a dispute (QOL-037) can be
//     precise. QOL-036 stores only the CLAIMED side; the disputed side + the
//     applicability status are QOL-037's, added additively on a dispute
//     record, never by mutating PaymentEvidenceMetadata.
//   - No raw financial account data — ever. payer/payee are PaymentParty
//     objects carrying only a redacted display token + an optional role
//     label. The adapter REJECTS a payment sub-object whose fields contain a
//     card / account / routing / IBAN digit shape — it strips the object and
//     downgrades the kind, it never silently stores raw account data.
//   - A payment object is INERT — no truth value, no PointStandingDelta.
//     This module imports nothing from src/features/pointStanding/.
//
// Still pure TypeScript. No React. No Supabase. No network. No async. No
// Date.now() / new Date() — the adapter copies timestamps from its input.

// ── Confidence enum ───────────────────────────────────────────

/**
 * QOL-036 — how confidently the SYSTEM treats the evidence's contribution.
 * For a payment object this is ALWAYS 'user_asserted' — a payment screenshot
 * is a user's assertion, never a system-proven fact. The type is a union so a
 * future card *could* add admin-confirmed states, but QOL-036 pins every
 * payment object to 'user_asserted' and `buildEvidenceArtifacts` + a test
 * enforce it.
 */
export type EvidenceConfidence = 'user_asserted';

/** Frozen, for exhaustive tests. Exactly one entry in QOL-036. */
export const ALL_EVIDENCE_CONFIDENCES: ReadonlyArray<EvidenceConfidence> = Object.freeze([
  'user_asserted',
]);

/** The single pinned confidence value. Exported so the adapter + box agree. */
export const PINNED_PAYMENT_CONFIDENCE: EvidenceConfidence = 'user_asserted';

// ── Payment sub-shapes ────────────────────────────────────────

/**
 * QOL-036 — a monetary amount. Structured so a challenger can dispute the
 * amount axis alone (QOL-037). `currency` is an ISO-4217-style code; free-form
 * is allowed for informal use ("USD", "GBP"). No field implies the amount is
 * verified — the amount is the submitter's assertion.
 */
export interface EvidenceAmount {
  /** The numeric amount. Non-negative after adapter normalisation. Stored as
   *  a number, not a string. */
  value: number;
  /** Currency code or short label. Max 8 chars after normalisation. */
  currency: string;
}

/**
 * QOL-036 — a redacted party on a payment record. Carries NO raw account
 * data. `displayToken` is a user-or-adapter-redacted string ("•••• 4821",
 * "the landlord", "me"); `roleLabel` is an optional plain-language role.
 * `findRawAccountDataFields` runs over both fields.
 */
export interface PaymentParty {
  /** Redacted, display-safe token. Max 48 chars. Never a raw account number. */
  displayToken: string;
  /** Optional plain-language role, e.g. "payer", "the landlord". Max 48 chars. */
  roleLabel?: string;
}

/**
 * QOL-036 — what the submitter ASSERTS the payment applies to. This is the
 * CLAIMED side only. QOL-037 adds the disputed side + the applicability
 * status as separate, additive fields on a dispute record — never by mutating
 * this object.
 */
export interface ClaimedApplicability {
  /** Free-text plain-language statement: "March practice-room rent". Max 160. */
  statement: string;
  /** Optional coarse period label the submitter asserts: "March 2026". Max 32.
   *  Advisory only — never parsed into a Date, never validated as "correct". */
  periodLabel?: string;
  /** Optional opaque reference to the obligation this is claimed to cover
   *  (e.g. a room-scoped obligation id minted by a future card). QOL-036 does
   *  not create obligations; the field is reserved so QOL-037 can link one. */
  obligationRef?: string;
}

/**
 * QOL-036 — structured metadata for a payment / transfer screenshot. Every
 * field is OPTIONAL except `confidence`, which is pinned to 'user_asserted'.
 * The object itself is optional on EvidenceArtifact — present only for
 * payment evidence.
 *
 * DOCTRINE: this object is INERT. It carries no truth value and emits no
 * point-standing delta. It is the data QOL-030's add_evidence box writes and
 * QOL-037's applicability dispute reads.
 */
export interface PaymentEvidenceMetadata {
  /** Always 'user_asserted'. Pinned. A test asserts no other value is stored. */
  confidence: EvidenceConfidence;
  /** Generic platform label: "a payment app". Never a required brand. Max 48. */
  platform?: string;
  /** ISO-8601 date (YYYY-MM-DD) the payment was made, as asserted. Optional.
   *  Stored verbatim — QOL-036 never parses or validates it into a Date. */
  paidAt?: string;
  /** The monetary amount, if any. */
  amount?: EvidenceAmount;
  /** Redacted payer. */
  payer?: PaymentParty;
  /** Redacted payee. */
  payee?: PaymentParty;
  /** The memo / note text on the record. Plain text. Max 280. */
  noteText?: string;
  /** What the submitter asserts the payment covers. */
  claimedApplicability?: ClaimedApplicability;
  /** True when an image artifact is attached. QOL-036 stores only that an
   *  image exists + its redaction state — NOT the binary. Upload is a
   *  deferred card. */
  hasScreenshotImage?: boolean;
  /** Confirms the submitter affirmed the screenshot/record is redacted of
   *  payer/payee account data before attaching. Defaults false. The box must
   *  set this true via an explicit user affirmation. */
  redactionConfirmed?: boolean;
}

// ── Raw-account-data detection ────────────────────────────────

/**
 * QOL-036 — account-data shapes the model refuses to store. Conservative
 * digit-run detection — NOT a Luhn check (false negatives are unacceptable
 * for PII, so the heuristic over-redacts; a false positive only over-masks a
 * benign long number, which is the safe direction). Detects:
 *   - a 12–19 digit run (card / account number), tolerating spaces / hyphens
 *     between digit groups;
 *   - an IBAN-shaped token (2 letters, 2 digits, then ≥10 alphanumerics);
 *   - a 9-digit run (routing-number shape) adjacent to a bank keyword
 *     ("routing", "aba", "account", "acct", "iban", "sort code").
 *
 * Exported for tests + the QOL-030 box's inline pre-post warning.
 */
export function detectRawAccountData(text: string): boolean {
  if (typeof text !== 'string' || text.trim().length === 0) return false;

  // Collapse spaces / hyphens that sit BETWEEN digits, so "4111 1111 1111
  // 1111" and "4111-1111-1111-1111" read as one 16-digit run. Other
  // characters are left so non-digit gaps still break a run.
  const joined = text.replace(/(\d)[\s-]+(?=\d)/g, '$1');

  // 12–19 consecutive digits → card / account-number shape.
  if (/\d{12,19}/.test(joined)) return true;

  // IBAN shape: 2 letters, 2 digits, then ≥10 alphanumerics (no separators —
  // IBAN groups have already been joined where they were digit-adjacent; we
  // also strip ALL whitespace for this single check).
  const ibanCandidate = text.replace(/\s+/g, '');
  if (/[A-Za-z]{2}\d{2}[A-Za-z0-9]{10,30}/.test(ibanCandidate)) return true;

  // Routing-number shape: a 9-digit run adjacent to a bank keyword.
  if (/\d{9}/.test(joined)) {
    if (/\b(routing|aba|account|acct|iban|sort\s*code|bank)\b/i.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * QOL-036 — throw-free guard. Returns the offending field path(s) when any
 * payment field contains raw account data; returns [] when clean. The adapter
 * calls this and DROPS the payment sub-object (keeping the artifact,
 * downgrading the kind) when it is non-empty — it never silently stores raw
 * account data, and never throws in production (a thrown error in a render
 * path is worse than a degraded artifact). The QOL-030 box calls it BEFORE
 * post to show an inline warning.
 *
 * Field paths use dotted notation so the box can point at the exact input:
 * `noteText`, `payer.displayToken`, `payer.roleLabel`, `payee.displayToken`,
 * `payee.roleLabel`, `platform`, `claimedApplicability.statement`,
 * `claimedApplicability.periodLabel`.
 */
export function findRawAccountDataFields(
  payment: PaymentEvidenceMetadata,
): ReadonlyArray<string> {
  const offenders: string[] = [];
  if (!payment || typeof payment !== 'object') return Object.freeze(offenders);

  const checkField = (value: string | undefined, path: string): void => {
    if (typeof value === 'string' && detectRawAccountData(value)) {
      offenders.push(path);
    }
  };

  checkField(payment.platform, 'platform');
  checkField(payment.noteText, 'noteText');
  if (payment.payer) {
    checkField(payment.payer.displayToken, 'payer.displayToken');
    checkField(payment.payer.roleLabel, 'payer.roleLabel');
  }
  if (payment.payee) {
    checkField(payment.payee.displayToken, 'payee.displayToken');
    checkField(payment.payee.roleLabel, 'payee.roleLabel');
  }
  if (payment.claimedApplicability) {
    checkField(payment.claimedApplicability.statement, 'claimedApplicability.statement');
    checkField(payment.claimedApplicability.periodLabel, 'claimedApplicability.periodLabel');
  }

  return Object.freeze(offenders);
}

// ── Redaction ─────────────────────────────────────────────────

/** Cap a string to a max length; trim first; whitespace-only → ''. */
function clampText(raw: string | undefined, max: number): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

/**
 * Mask every raw account-data run inside a string. A run of ≥12 digits
 * (tolerating spaces / hyphens between groups) is replaced with "•••• " +
 * its last 4 digits when it has ≥4 trailing digits, else fully masked with
 * "••••". Shorter digit runs (already-masked tails like "4821") are left
 * untouched. Pure.
 */
function maskRawAccountRuns(raw: string): string {
  // Match a 12+ digit run that may contain single spaces / hyphens between
  // digits. The capture keeps only the digits so we can take the last 4.
  return raw.replace(/\d(?:[\s-]?\d){11,}/g, (run) => {
    const digits = run.replace(/[^\d]/g, '');
    if (digits.length >= 4) {
      return `•••• ${digits.slice(-4)}`;
    }
    return '••••';
  });
}

/**
 * QOL-036 — redact a free-text party string into a PaymentParty. If the input
 * contains a raw account-data run, the run is masked to "•••• " + last 4 (or
 * fully masked when <4 trailing digits). Role-only inputs ("the landlord")
 * pass through unchanged. The result `displayToken` is clamped to 48 chars;
 * an empty input yields a displayToken of "" (the caller decides whether to
 * keep the party at all). The QOL-030 add_evidence box calls this on the
 * payer/payee text fields before it builds the PaymentEvidenceMetadata value.
 */
export function redactPaymentParty(rawText: string, roleLabel?: string): PaymentParty {
  const masked = typeof rawText === 'string' ? maskRawAccountRuns(rawText) : '';
  const displayToken = clampText(masked, 48);
  const role = clampText(roleLabel, 48);
  const party: PaymentParty = { displayToken };
  if (role.length > 0) party.roleLabel = role;
  return party;
}

// ── Amount normalisation ──────────────────────────────────────

/**
 * QOL-036 — normalise an EvidenceAmount for storage. A negative value is
 * clamped to 0; a NaN / non-finite value drops the whole amount (returns
 * null — the adapter treats `amount` as absent). `currency` is clamped to 8
 * chars; an empty currency falls back to a neutral label. Throw-free.
 */
function normalizeEvidenceAmount(amount: EvidenceAmount | undefined): EvidenceAmount | null {
  if (!amount || typeof amount !== 'object') return null;
  const rawValue = amount.value;
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return null;
  const value = rawValue < 0 ? 0 : rawValue;
  const currency = clampText(amount.currency, 8) || 'amount';
  return { value, currency };
}

// ── Stored-payment preparation (adapter helper) ───────────────

/**
 * QOL-036 — prepare a raw payment input for storage on an EvidenceArtifact.
 *
 *   - If `findRawAccountDataFields` flags any field → return null. The adapter
 *     drops the payment object and downgrades the kind. Raw account data is
 *     REJECTED at the model boundary, never masked-and-stored.
 *   - Otherwise → return a normalised copy: `confidence` pinned to
 *     'user_asserted', every text field clamped to its max, the amount
 *     normalised (negative → 0, NaN → absent), absent fields omitted.
 *
 * Pure, throw-free, deterministic. Not exported — the adapter is the only
 * caller; the box uses `findRawAccountDataFields` + `redactPaymentParty`
 * directly before it builds its input.
 */
function prepareStoredPayment(
  raw: PaymentEvidenceMetadata,
): PaymentEvidenceMetadata | null {
  if (!raw || typeof raw !== 'object') return null;

  // Redaction guard — the doctrine core. Any raw account data → reject.
  if (findRawAccountDataFields(raw).length > 0) return null;

  // confidence is always pinned — the input cannot smuggle a different value.
  const out: PaymentEvidenceMetadata = { confidence: PINNED_PAYMENT_CONFIDENCE };

  const platform = clampText(raw.platform, 48);
  if (platform.length > 0) out.platform = platform;

  if (typeof raw.paidAt === 'string' && raw.paidAt.trim().length > 0) {
    // Stored verbatim — never parsed into a Date (parsing would imply the
    // date is "verified"). Clamped defensively to a generous 64 chars.
    out.paidAt = clampText(raw.paidAt, 64);
  }

  const amount = normalizeEvidenceAmount(raw.amount);
  if (amount !== null) out.amount = amount;

  if (raw.payer) {
    const payer = normalizeStoredParty(raw.payer);
    if (payer !== null) out.payer = payer;
  }
  if (raw.payee) {
    const payee = normalizeStoredParty(raw.payee);
    if (payee !== null) out.payee = payee;
  }

  const noteText = clampText(raw.noteText, 280);
  if (noteText.length > 0) out.noteText = noteText;

  if (raw.claimedApplicability) {
    const applicability = normalizeStoredApplicability(raw.claimedApplicability);
    if (applicability !== null) out.claimedApplicability = applicability;
  }

  if (raw.hasScreenshotImage === true) out.hasScreenshotImage = true;
  if (raw.redactionConfirmed === true) out.redactionConfirmed = true;

  return out;
}

/** Clamp a stored PaymentParty's fields; null when it carries no display
 *  token and no role (nothing worth storing). */
function normalizeStoredParty(party: PaymentParty): PaymentParty | null {
  if (!party || typeof party !== 'object') return null;
  const displayToken = clampText(party.displayToken, 48);
  const roleLabel = clampText(party.roleLabel, 48);
  if (displayToken.length === 0 && roleLabel.length === 0) return null;
  const out: PaymentParty = { displayToken };
  if (roleLabel.length > 0) out.roleLabel = roleLabel;
  return out;
}

/** Clamp a stored ClaimedApplicability; null when the statement is empty. */
function normalizeStoredApplicability(
  applicability: ClaimedApplicability,
): ClaimedApplicability | null {
  if (!applicability || typeof applicability !== 'object') return null;
  const statement = clampText(applicability.statement, 160);
  const periodLabel = clampText(applicability.periodLabel, 32);
  const obligationRef = clampText(applicability.obligationRef, 120);
  // The statement is the required core; with no statement there is nothing to
  // claim. A period label / obligation ref alone is not a claim.
  if (statement.length === 0) return null;
  const out: ClaimedApplicability = { statement };
  if (periodLabel.length > 0) out.periodLabel = periodLabel;
  if (obligationRef.length > 0) out.obligationRef = obligationRef;
  return out;
}

// ── Display helpers ───────────────────────────────────────────

/** QOL-036 — the locked plain-language label for the payment kind. Used by
 *  the receipt chip + a11y. Never a snake_case code, never a verdict token. */
const PAYMENT_EVIDENCE_LABEL = 'Payment record';

/**
 * QOL-036 — plain-language label for the payment kind. Returns "Payment
 * record". NEVER returns a snake_case code, never a verdict token.
 */
export function getPaymentEvidenceLabel(): string {
  return PAYMENT_EVIDENCE_LABEL;
}

/**
 * QOL-036 — build a one-line, plain-language, redaction-safe summary of a
 * payment object for the receipt chip / side-panel header, e.g.
 *   "Payment record — $120 on 2026-03-03, noted "practice space""
 * Omits any absent field. NEVER includes a raw account-data run — even when
 * the input somehow does, the summary re-redacts as defence-in-depth. NEVER
 * a verdict token (the scaffold words are clean; a user `noteText` is quoted
 * verbatim and is the user's own free text, governed elsewhere).
 *
 * An empty-but-`confidence` payment returns just "Payment record".
 */
export function summarizePaymentEvidence(payment: PaymentEvidenceMetadata): string {
  if (!payment || typeof payment !== 'object') return PAYMENT_EVIDENCE_LABEL;

  const parts: string[] = [];

  // Amount — re-normalised so a stray negative / NaN never reaches the chip.
  const amount = normalizeEvidenceAmount(payment.amount);
  if (amount !== null) {
    parts.push(formatAmountForSummary(amount));
  }

  // Date — verbatim, re-redacted defensively.
  if (typeof payment.paidAt === 'string' && payment.paidAt.trim().length > 0) {
    const safeDate = maskRawAccountRuns(payment.paidAt.trim());
    parts.push(`on ${safeDate}`);
  }

  // Note — quoted, re-redacted defensively (the scaffold word "noted" is the
  // app's; the quoted text is the user's own free text).
  if (typeof payment.noteText === 'string' && payment.noteText.trim().length > 0) {
    const safeNote = maskRawAccountRuns(payment.noteText.trim());
    parts.push(`noted "${safeNote}"`);
  }

  // Claimed applicability — the submitter's assertion, prefixed so a reader
  // sees it is a claim, never a verified fact.
  const applicability = payment.claimedApplicability;
  if (
    applicability &&
    typeof applicability.statement === 'string' &&
    applicability.statement.trim().length > 0
  ) {
    const safeStatement = maskRawAccountRuns(applicability.statement.trim());
    parts.push(`claimed to cover ${safeStatement}`);
  }

  if (parts.length === 0) return PAYMENT_EVIDENCE_LABEL;
  return `${PAYMENT_EVIDENCE_LABEL} — ${parts.join(', ')}`;
}

/** Format an EvidenceAmount for the summary line. A bare currency code is
 *  rendered after the value ("120 USD"); a single-character symbol-like code
 *  is rendered before ("$120"). Pure. */
function formatAmountForSummary(amount: EvidenceAmount): string {
  const value = String(amount.value);
  const currency = amount.currency;
  // A 1-char non-alphanumeric code reads as a symbol → prefix it.
  if (currency.length === 1 && !/[A-Za-z0-9]/.test(currency)) {
    return `${currency}${value}`;
  }
  return `${value} ${currency}`;
}

// ── Ban-list seam (test consumer) ─────────────────────────────

/**
 * QOL-036 — the tokens the payment ban-list test scans every app-authored
 * payment string against (`getPaymentEvidenceLabel`, the `summarizePayment-
 * Evidence` scaffold words). Verdict, amplification, and person-attribution
 * groups — none may appear in any QOL-036 system-generated string.
 *
 * Exposed as a function (not a const) so the ban-list test can assert it is
 * non-empty and actually iterated.
 */
export function _forbiddenPaymentTokens(): ReadonlyArray<string> {
  return Object.freeze([
    // Verdict tokens.
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'bot',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'disproven',
    'case closed',
    // Amplification tokens.
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'virality',
    'viral',
    'trending',
  ]);
}
