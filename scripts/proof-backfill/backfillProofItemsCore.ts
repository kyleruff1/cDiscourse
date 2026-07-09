/**
 * PROOF-001 (#888) — back-fill CORE (pure engine).
 *
 * Reads argument rows carrying a JSONB evidence snapshot
 * (arguments.client_validation->'attachedEvidence'), classifies each via the
 * REAL authoritative classifier `buildEvidenceArtifacts`
 * (src/features/evidence/evidenceModel.ts — never a re-implementation), folds
 * each artifact to a proof_items row via the SHARED fold
 * (proofItemRowFromArtifact.ts), and builds a dry-run report + the emitted
 * INSERT SQL. `payment_screenshot` artifacts are excluded (no path-c column
 * this card) and counted separately.
 *
 * This module is PURE: no Supabase, no network, no fs, no console, no secret.
 * The CLI (backfillProofItems.ts) does the I/O; this engine + the fold module
 * are what the jest tests exercise. The live write is operator-gated (the CLI's
 * --apply + PROOF_BACKFILL_APPLY=true gate); this engine never writes.
 *
 * Pure TypeScript. No React. No async.
 */

import {
  buildEvidenceArtifacts,
  type EvidenceArtifact,
  type EvidenceArtifactKind,
  type EvidenceAttachmentInput,
} from '../../src/features/evidence/evidenceModel';
import {
  foldArtifactsToProofItemRows,
  type ProofItemRow,
} from './proofItemRowFromArtifact';

// ── Input shape (what the CLI reads from public.arguments) ────

/**
 * One argument row carrying a non-empty attachedEvidence snapshot. `debate_id`
 * and `author_id` come from the row; `attachedEvidence` is the raw JSONB value
 * at client_validation->'attachedEvidence' (expected to be an array).
 */
export interface AttachedEvidenceArgumentRow {
  id: string;
  debate_id: string;
  author_id: string;
  created_at: string;
  attachedEvidence: unknown;
}

// ── Raw JSONB attachment -> EvidenceAttachmentInput ───────────

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Map one raw JSONB attachment entry to an EvidenceAttachmentInput. A non-object
 * entry becomes an empty attachment (the adapter drops it). We forward `kind`
 * and `payment` verbatim so `buildEvidenceArtifacts` classifies exactly as it
 * would at write time; the adapter owns all validation/redaction.
 */
export function toAttachmentInput(raw: unknown): EvidenceAttachmentInput {
  if (raw === null || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const input: EvidenceAttachmentInput = {
    url: asOptionalString(rec.url) ?? null,
    label: asOptionalString(rec.label) ?? null,
    sourceText: asOptionalString(rec.sourceText) ?? asOptionalString(rec.source_text) ?? null,
    quote: asOptionalString(rec.quote) ?? null,
  };
  const kind = asOptionalString(rec.kind);
  if (kind !== undefined) input.kind = kind as EvidenceArtifactKind;
  if (rec.payment !== undefined && rec.payment !== null && typeof rec.payment === 'object') {
    // Forward verbatim; buildEvidenceArtifacts runs its own redaction guard.
    input.payment = rec.payment as EvidenceAttachmentInput['payment'];
  }
  return input;
}

// ── Per-row classification ────────────────────────────────────

export interface RowClassification {
  artifacts: EvidenceArtifact[];
  rows: ProofItemRow[];
  deferred: EvidenceArtifact[];
  /** attachedEvidence was not an array — the row is skipped, never thrown on. */
  malformed: boolean;
}

/**
 * Classify one argument row: parse -> real buildEvidenceArtifacts -> shared
 * fold. A malformed attachedEvidence (not an array) yields an empty, malformed
 * classification (skipped, never throws).
 */
export function classifyArgumentRow(row: AttachedEvidenceArgumentRow): RowClassification {
  if (!Array.isArray(row.attachedEvidence)) {
    return { artifacts: [], rows: [], deferred: [], malformed: true };
  }
  const attachments = row.attachedEvidence.map(toAttachmentInput);
  const artifacts = buildEvidenceArtifacts({
    argumentId: row.id,
    addedByUserId: row.author_id,
    createdAt: row.created_at,
    attachments,
  });
  const { rows, deferred } = foldArtifactsToProofItemRows(artifacts, { debateId: row.debate_id });
  return { artifacts, rows, deferred, malformed: false };
}

// ── SQL emit ──────────────────────────────────────────────────

const SQL_COLUMNS =
  'debate_id, argument_id, added_by, kind, label, url, source_text, quote, referenced_argument_id, source_chain_status, risk';

function sqlLiteral(value: string | null): string {
  if (value === null) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

/** One reviewable INSERT statement for a proof_items row. */
export function renderInsertSql(row: ProofItemRow): string {
  const values = [
    sqlLiteral(row.debate_id),
    sqlLiteral(row.argument_id),
    sqlLiteral(row.added_by),
    sqlLiteral(row.kind),
    sqlLiteral(row.label),
    sqlLiteral(row.url),
    sqlLiteral(row.source_text),
    sqlLiteral(row.quote),
    sqlLiteral(row.referenced_argument_id),
    sqlLiteral(row.source_chain_status),
    sqlLiteral(row.risk),
  ].join(', ');
  return `insert into public.proof_items (${SQL_COLUMNS}) values (${values});`;
}

// ── Report ────────────────────────────────────────────────────

export interface BackfillReport {
  argumentsScanned: number;
  argumentsWithArtifacts: number;
  argumentsSkippedMalformed: number;
  attachmentsFound: number;
  artifactsClassified: number;
  /** pre-fold EvidenceArtifactKind -> count. */
  bySourceKind: Record<string, number>;
  /** post-fold proof_items.kind -> count (deferred artifacts excluded). */
  byFoldedKind: Record<string, number>;
  /** source_chain_status -> count (over written rows). */
  bySourceChainStatus: Record<string, number>;
  /** payment_screenshot artifacts deferred (not written). */
  paymentScreenshotDeferred: number;
  proofItemRowsToWrite: number;
  /** Up to SAMPLE_INSERT_CAP reviewable INSERT statements. */
  sampleInserts: string[];
  /** Dry-run report always reports zero writes. The live write is CLI/operator-gated. */
  writesPerformed: 0;
}

const SAMPLE_INSERT_CAP = 5;

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Build the dry-run report over a set of argument rows. Never writes. Never
 * throws on a malformed row (it is skipped + counted). `writesPerformed` is the
 * literal 0 — this engine performs no writes under any input.
 */
export function buildBackfillReport(rows: ReadonlyArray<AttachedEvidenceArgumentRow>): BackfillReport {
  const report: BackfillReport = {
    argumentsScanned: rows.length,
    argumentsWithArtifacts: 0,
    argumentsSkippedMalformed: 0,
    attachmentsFound: 0,
    artifactsClassified: 0,
    bySourceKind: {},
    byFoldedKind: {},
    bySourceChainStatus: {},
    paymentScreenshotDeferred: 0,
    proofItemRowsToWrite: 0,
    sampleInserts: [],
    writesPerformed: 0,
  };

  for (const row of rows) {
    if (Array.isArray(row.attachedEvidence)) {
      report.attachmentsFound += row.attachedEvidence.length;
    }
    const c = classifyArgumentRow(row);
    if (c.malformed) {
      report.argumentsSkippedMalformed += 1;
      continue;
    }
    if (c.artifacts.length > 0) report.argumentsWithArtifacts += 1;
    report.artifactsClassified += c.artifacts.length;
    for (const a of c.artifacts) bump(report.bySourceKind, a.kind);
    report.paymentScreenshotDeferred += c.deferred.length;
    for (const r of c.rows) {
      bump(report.byFoldedKind, r.kind);
      bump(report.bySourceChainStatus, r.source_chain_status);
      report.proofItemRowsToWrite += 1;
      if (report.sampleInserts.length < SAMPLE_INSERT_CAP) {
        report.sampleInserts.push(renderInsertSql(r));
      }
    }
  }

  return report;
}

// ── Markdown render (operator-facing, produced by the CLI) ────

function renderCounter(counter: Record<string, number>): string {
  const keys = Object.keys(counter).sort();
  if (keys.length === 0) return '  (none)';
  return keys.map((k) => `  - ${k}: ${counter[k]}`).join('\n');
}

/** Render the dry-run report as committable Markdown. Pure (returns a string). */
export function renderReportMarkdown(report: BackfillReport, meta: { mode: string; generatedAtLabel: string }): string {
  return [
    `# PROOF-001 back-fill dry-run report`,
    ``,
    `- Mode: ${meta.mode}`,
    `- Generated: ${meta.generatedAtLabel}`,
    `- Arguments scanned: ${report.argumentsScanned}`,
    `- Arguments carrying artifacts: ${report.argumentsWithArtifacts}`,
    `- Arguments skipped (malformed attachedEvidence): ${report.argumentsSkippedMalformed}`,
    `- Attachments found (raw): ${report.attachmentsFound}`,
    `- Artifacts classified: ${report.artifactsClassified}`,
    `- proof_items rows that WOULD be written: ${report.proofItemRowsToWrite}`,
    `- payment_screenshot artifacts DEFERRED (left in JSONB): ${report.paymentScreenshotDeferred}`,
    `- Writes performed: ${report.writesPerformed}`,
    ``,
    `## By source EvidenceArtifactKind (pre-fold)`,
    renderCounter(report.bySourceKind),
    ``,
    `## By folded proof_items.kind (post-fold)`,
    renderCounter(report.byFoldedKind),
    ``,
    `## By source_chain_status (written rows)`,
    renderCounter(report.bySourceChainStatus),
    ``,
    `## Sample INSERT statements (first ${SAMPLE_INSERT_CAP})`,
    report.sampleInserts.length === 0 ? '  (none)' : '```sql\n' + report.sampleInserts.join('\n') + '\n```',
    ``,
  ].join('\n');
}

/** Render the full emitted SQL (all rows) for review under out/. Pure. */
export function renderAllInsertSql(rows: ReadonlyArray<AttachedEvidenceArgumentRow>): string {
  const out: string[] = [
    '-- PROOF-001 back-fill — reviewed INSERT statements (dry-run emit).',
    '-- Apply ONLY via the operator-gated lane (service-role / supabase db query --linked).',
    '',
  ];
  for (const row of rows) {
    const c = classifyArgumentRow(row);
    for (const r of c.rows) out.push(renderInsertSql(r));
  }
  return out.join('\n') + '\n';
}

// ── CLI arg parsing + fail-closed apply gate (pure, testable) ──

export interface CliArgs {
  apply: boolean;
  demo: boolean;
}

export function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  return {
    apply: argv.includes('--apply'),
    demo: argv.includes('--demo'),
  };
}

export interface ApplyGateEnv {
  PROOF_BACKFILL_APPLY?: string | undefined;
}

export interface ApplyDecision {
  apply: boolean;
  reason: string;
}

/**
 * Fail-closed apply gate. A live write requires BOTH `--apply` on the CLI AND
 * `PROOF_BACKFILL_APPLY=true` in the environment (the .env + --pilot idiom).
 * Absent either, the decision is dry-run.
 */
export function resolveApplyGate(args: { apply: boolean }, env: ApplyGateEnv): ApplyDecision {
  if (!args.apply) {
    return { apply: false, reason: 'dry-run (default): no --apply flag' };
  }
  if (env.PROOF_BACKFILL_APPLY !== 'true') {
    return {
      apply: false,
      reason: 'dry-run (fail-closed): --apply present but PROOF_BACKFILL_APPLY env is not "true"',
    };
  }
  return { apply: true, reason: 'live apply: --apply AND PROOF_BACKFILL_APPLY=true' };
}

// ── Built-in synthetic demo rows (for --demo; no network) ─────

/**
 * A small synthetic sample that exercises every fold path + the payment
 * deferral + a malformed row. Used ONLY by the CLI `--demo` mode so the runner
 * is self-demonstrating with zero network. NOT scraped corpus data.
 */
export const DEMO_ARGUMENT_ROWS: ReadonlyArray<AttachedEvidenceArgumentRow> = Object.freeze([
  {
    id: '00000000-0000-4000-8000-000000000001',
    debate_id: '00000000-0000-4000-8000-0000000000d1',
    author_id: '00000000-0000-4000-8000-0000000000a1',
    created_at: '2026-01-01T00:00:00.000Z',
    attachedEvidence: [
      { kind: 'url', url: 'https://example.org/report', label: 'Example report' },
      { kind: 'source_text', sourceText: 'Excerpt from a cited source.', quote: 'the cited passage' },
      // No explicit kind + a dataset-host URL: the classifier detects 'dataset',
      // which the fold maps to 'url' (a dataset is an inspectable URL).
      { url: 'https://data.gov/dataset/xyz', label: 'A dataset' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    debate_id: '00000000-0000-4000-8000-0000000000d1',
    author_id: '00000000-0000-4000-8000-0000000000a2',
    created_at: '2026-01-02T00:00:00.000Z',
    attachedEvidence: [
      { kind: 'screenshot_redacted', label: 'A redacted screenshot note', sourceText: 'redaction note' },
      { kind: 'manual_citation', sourceText: 'Author (2026). A Title. Publisher.' },
      // A payment_screenshot artifact — DEFERRED (no path-c column this card),
      // left in JSONB, reported separately.
      { kind: 'payment_screenshot', label: 'A payment record', sourceText: 'payment note' },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    debate_id: '00000000-0000-4000-8000-0000000000d2',
    author_id: '00000000-0000-4000-8000-0000000000a3',
    created_at: '2026-01-03T00:00:00.000Z',
    // A malformed snapshot (not an array) — skipped, never throws.
    attachedEvidence: { not: 'an array' },
  },
]);
