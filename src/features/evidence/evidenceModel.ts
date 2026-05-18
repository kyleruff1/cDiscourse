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
  | 'manual_citation'; // Bibliographic-style citation (book, paper, broadcast).

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
  return !isPresent(att.url) && !isPresent(att.sourceText) && !isPresent(att.quote);
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
    const base: EvidenceArtifact = {
      id,
      argumentId,
      kind: classifyEvidenceKind(att),
      label: deriveLabel(att),
      sourceChainStatus: deriveSourceChainStatus(att),
      risk: 'unknown',
      addedByUserId,
      createdAt,
    };
    if (isPresent(att.url)) base.url = att.url.trim();
    if (isPresent(att.sourceText)) base.sourceText = att.sourceText.trim();
    if (isPresent(att.quote)) base.quote = att.quote.trim();

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
