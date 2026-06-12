/**
 * OPS-MCP-OBSERVABILITY-002 — metadata-only CSV builder.
 *
 * The CSV is the SAME aggregate verdict serialized to CSV — identical field
 * allow-list as the JSON response (group axis, internal key, plain-language
 * label, count). It carries NO raw row, NO body, NO evidence_span, NO payload,
 * NO secret. The builder is pure TS so it is unit-testable and ban-list /
 * leak scannable (cdiscourse-doctrine §6).
 *
 * Columns:
 *   group         — the grouping axis (status / state / failure_reason / …)
 *   internal_key  — the raw code (admin-only); empty for a NULL column
 *   plain_label   — the operator-facing plain-language label; empty when the
 *                   code is unknown (SUPPRESSED, §9) or the axis is not a reason
 *   count         — the row count
 *
 * Pure TS — no React, no Supabase, no fetch, no Deno. Jest-loadable.
 */
import type { ClassifierHealthVerdict, ClassifierHealthCountBucket } from './types';

const CSV_HEADER = ['group', 'internal_key', 'plain_label', 'count'] as const;

/** RFC-4180 field escaping: wrap in quotes + double internal quotes when needed. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** One CSV data line from a count bucket. */
function bucketLine(bucket: ClassifierHealthCountBucket): string {
  return [
    csvCell(bucket.groupKey),
    csvCell(bucket.rawKey ?? ''),
    csvCell(bucket.plainLanguage ?? ''),
    csvCell(String(bucket.count)),
  ].join(',');
}

/**
 * Build the metadata-only CSV string from a classifier-health verdict. The
 * provider-error cluster and the frozen-family tripwire are appended as their
 * own synthetic groups (`provider_error_cluster`, `frozen_family_tripwire`) so
 * the operator sees them in the export too.
 */
export function buildClassifierHealthCsv(verdict: ClassifierHealthVerdict): string {
  const lines: string[] = [CSV_HEADER.join(',')];

  const axes: ClassifierHealthCountBucket[][] = [
    verdict.byStatus,
    verdict.byState,
    verdict.byFailureReason,
    verdict.byFailureSubReason,
    verdict.byDeadLetterReason,
    verdict.byRunMode,
    verdict.byFamily,
    verdict.byFailureDetailReason,
    // OPS-MCP-KEY-LEVEL-FAIL-CLOSED — per-rawKey unclean-span drop counts
    // (group `unclean_span_key_drop`). NAMES + counts only; never a span.
    verdict.byUncleanSpanKeyDrop,
  ];
  for (const axis of axes) {
    for (const bucket of axis) {
      lines.push(bucketLine(bucket));
    }
  }

  // Provider-error cluster — one summary line + per-reason lines.
  lines.push(
    [
      csvCell('provider_error_cluster'),
      csvCell('total'),
      csvCell('Provider-error cluster total'),
      csvCell(String(verdict.providerErrorCluster.count)),
    ].join(','),
  );
  for (const bucket of verdict.providerErrorCluster.byReason) {
    lines.push(
      [
        csvCell('provider_error_cluster'),
        csvCell(bucket.rawKey ?? ''),
        csvCell(bucket.plainLanguage ?? ''),
        csvCell(String(bucket.count)),
      ].join(','),
    );
  }

  // Frozen-family tripwire — one summary line + per-family lines (SHOULD be 0).
  lines.push(
    [
      csvCell('frozen_family_tripwire'),
      csvCell('total'),
      csvCell('H/I/J leakage tripwire total (should be 0)'),
      csvCell(String(verdict.frozenFamilyTripwire.count)),
    ].join(','),
  );
  for (const fam of verdict.frozenFamilyTripwire.byFamily) {
    lines.push(
      [
        csvCell('frozen_family_tripwire'),
        csvCell(fam.family),
        csvCell(''),
        csvCell(String(fam.count)),
      ].join(','),
    );
  }

  // Total rows footer.
  lines.push(
    [csvCell('total_rows'), csvCell(''), csvCell(''), csvCell(String(verdict.totalRows))].join(','),
  );

  return lines.join('\n');
}

/** The CSV header columns (for tests). */
export const CLASSIFIER_HEALTH_CSV_HEADER: ReadonlyArray<string> = Object.freeze([...CSV_HEADER]);
