/**
 * OPS-MCP-IDEMPOTENCY-HARDENING — Q9 classification semantics safety.
 *
 * Per the operator's Stage 2B binding decision (Cause-C-only path),
 * this card is an RCA-backed observability refinement: Q9 now
 * classifies each duplicate-pair into one of four categories so the
 * report distinguishes documented audit/smoke re-fires from
 * organically-duplicating runtime risk. This file is a pure-Jest
 * file-content scan against `scripts/ops/sql/09-duplicate-runs.sql`
 * and a small cross-check against the runner library
 * `scripts/ops/mcp-observability-report-lib.cjs`.
 *
 * The tests verify:
 *
 *   1. All four classification categories are emitted by the SQL.
 *   2. The runner's column contract carries the new `classification`
 *      column AND preserves all pre-existing Q9 columns.
 *   3. The conservative default — `organic_duplicate_candidate` — is
 *      present so real duplicate risk is never hidden.
 *   4. The header comment documents the heuristic + RCA findings
 *      + Stage 2B re-scope.
 *   5. No DB constraint / migration / Edge runtime change is part of
 *      the SQL (defense-in-depth against the binding NO-GO list).
 *   6. Doctrine ban-list scan on SQL comments and body.
 *
 * Source-of-truth: docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md
 * (post Stage-2B re-scope section at top of the design doc) +
 * docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING-intent.md (operator brief).
 *
 * Pattern: pure Jest, `fs.readFileSync`, regex/substring assertions.
 * No live DB call; the live verification lives in the post-merge
 * smoke audit, not here.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const Q9_PATH = path.join(
  REPO,
  'scripts',
  'ops',
  'sql',
  '09-duplicate-runs.sql',
);
const LIB_PATH = path.join(
  REPO,
  'scripts',
  'ops',
  'mcp-observability-report-lib.cjs',
);

function readQ9(): string {
  return fs.readFileSync(Q9_PATH, 'utf8');
}

function stripSqlComments(src: string): string {
  // Strip `-- line comments` and `/* block */` comments so executable-
  // SQL scans do not trip on commentary. Mirror of the helper in
  // `opsMcpObservabilitySqlSafety.test.ts` and
  // `opsMcpObservabilityQ12SemanticTightening.test.ts`.
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function extractHeaderBlock(src: string): string {
  // Header = everything before the first `WITH` keyword that opens
  // the executable CTE block. We anchor on a `with` that appears at
  // the start of a line (or after only whitespace) — this skips
  // occurrences of the word "with" inside comment prose.
  const lines = src.split(/\r?\n/);
  let runningOffset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^with\s/i.test(trimmed)) {
      return src.slice(0, runningOffset);
    }
    runningOffset += line.length + 1; // +1 for the newline.
  }
  throw new Error('No leading `with` keyword found at start of a line in Q9 SQL');
}

describe('OPS-MCP-IDEMPOTENCY-HARDENING — Q9 classification semantics', () => {
  /* ----------------------------------------------------------------- */
  /* Group A — all four classification categories present              */
  /* ----------------------------------------------------------------- */

  describe('classification categories', () => {
    it('emits the `audit_or_smoke_rerun` category', () => {
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The CASE clause must contain the literal string in a `then`
      // branch (so it is what is emitted, not just a comment).
      expect(
        /then\s+'audit_or_smoke_rerun'/i.test(stripped),
      ).toBe(true);
    });

    it('emits the `synthetic_test_data` category', () => {
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(
        /then\s+'synthetic_test_data'/i.test(stripped),
      ).toBe(true);
    });

    it('emits the `needs_investigation` category', () => {
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(
        /then\s+'needs_investigation'/i.test(stripped),
      ).toBe(true);
    });

    it('emits the `organic_duplicate_candidate` category as the conservative default', () => {
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The default must be reached via an `else` branch (the
      // conservative default; any pair not provably otherwise
      // classified falls here so real risk is never hidden).
      expect(
        /else\s+'organic_duplicate_candidate'/i.test(stripped),
      ).toBe(true);
    });

    it('emits exactly the four categories — no extras leak in', () => {
      // Defense-in-depth: a future implementer must not silently add
      // a fifth category (which would dilute the report's grammar).
      // Categories are detected by `'<name>'` literals that are
      // produced from CASE branches.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The four expected categories.
      const expected = [
        'audit_or_smoke_rerun',
        'synthetic_test_data',
        'needs_investigation',
        'organic_duplicate_candidate',
      ];
      for (const cat of expected) {
        const re = new RegExp(`'${cat}'`);
        expect(re.test(stripped)).toBe(true);
      }
      // Sanity: scan for any string literal whose body matches the
      // `^[a-z_]+$` snake-case shape AND ends in one of the
      // category-suffix patterns we use (_rerun / _data / _investigation /
      // _candidate). Anything that matches the shape must be one of
      // the four expected categories. This catches a future drift like
      // 'audit_only_rerun' or 'organic_high_risk_candidate'.
      const literalRe = /'([a-z_]+)'/g;
      let m;
      const seen = new Set<string>();
      while ((m = literalRe.exec(stripped)) !== null) {
        const lit = m[1];
        if (
          lit.endsWith('_rerun') ||
          lit.endsWith('_data') ||
          lit.endsWith('_investigation') ||
          lit.endsWith('_candidate')
        ) {
          seen.add(lit);
        }
      }
      // Every category-shaped literal must be in the expected set.
      const expectedSet = new Set(expected);
      for (const s of seen) {
        expect(expectedSet.has(s)).toBe(true);
      }
    });
  });

  /* ----------------------------------------------------------------- */
  /* Group B — runner column contract preserved + extended             */
  /* ----------------------------------------------------------------- */

  describe('runner column contract', () => {
    it('preserves all 7 pre-existing Q9 columns AND adds `classification`', () => {
      // Cross-check the SQL emits `as <name>` aliases for every
      // column the runner library declares for Q9. Failure here would
      // mean the lib + SQL drift apart (the runner would show empty
      // cells for a column the SQL never aliases).
      const src = readQ9();
      const stripped = stripSqlComments(src);
      const lib = require(LIB_PATH);
      const q9Section = (
        lib.SECTIONS as Array<{ id: string; columns: string[] }>
      ).find((s) => s.id === 'q09-duplicate-runs');
      expect(q9Section).toBeDefined();
      const cols = q9Section?.columns ?? [];
      // The contract: 7 original + 1 new = 8 columns.
      expect(cols).toEqual([
        'argument_id',
        'family',
        'run_mode',
        'schema_version',
        'provider_key',
        'model_name',
        'duplicate_successful_runs',
        'classification',
      ]);
      // Some columns appear naturally in the SELECT list without an
      // `as` alias because the source column shares the same name.
      // The renamed columns (count → duplicate_successful_runs,
      // CASE → classification) MUST appear with explicit `as`.
      expect(/\bas\s+duplicate_successful_runs\b/i.test(stripped)).toBe(true);
      expect(/\bas\s+classification\b/i.test(stripped)).toBe(true);
    });

    it('runner library Q9 section question references classification', () => {
      // The renamed Q9 question must surface the new classification
      // grammar so a report reader understands the four categories.
      const lib = require(LIB_PATH);
      const q9Section = (
        lib.SECTIONS as Array<{
          id: string;
          question: string;
          title: string;
        }>
      ).find((s) => s.id === 'q09-duplicate-runs');
      expect(q9Section).toBeDefined();
      const q = q9Section?.question ?? '';
      expect(q.toLowerCase()).toContain('classif');
      // The title also conveys the change (markdown TOC + headings).
      expect((q9Section?.title ?? '').toLowerCase()).toContain('classif');
    });
  });

  /* ----------------------------------------------------------------- */
  /* Group C — conservative default + heuristic correctness            */
  /* ----------------------------------------------------------------- */

  describe('classification logic — conservative + data-derived', () => {
    it('uses CASE with `else` for the default classification', () => {
      // Defensive: a future implementer must not replace the CASE
      // with an IF / WHERE-filtered subquery — the CASE-with-else
      // pattern is what guarantees every duplicate-pair gets exactly
      // one classification.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(/\bcase\b[\s\S]+\belse\b[\s\S]+\bend\s+as\s+classification\b/i.test(stripped)).toBe(true);
    });

    it('classifies admin_validation duplicates with >=1h gap as audit_or_smoke_rerun (Signal 1)', () => {
      // The data-derived time-gap heuristic.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // Pattern: WHEN run_mode = 'admin_validation' AND ... interval '1 hour'
      // (tolerant of whitespace + minor ordering).
      const hasAdminValidationCheck =
        /run_mode\s*=\s*'admin_validation'/i.test(stripped);
      expect(hasAdminValidationCheck).toBe(true);
      // The 1-hour threshold MUST be present as a tolerant interval
      // literal. Postgres accepts `interval '1 hour'`.
      const hasIntervalOneHour = /interval\s+'1\s+hour'/i.test(stripped);
      expect(hasIntervalOneHour).toBe(true);
    });

    it('classifies very-short gaps (< 30s) as needs_investigation', () => {
      // The conservative race/retry detection threshold.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // Pattern: < interval '30 seconds'
      expect(/interval\s+'30\s+seconds'/i.test(stripped)).toBe(true);
    });

    it('includes the synthetic-provider predicate (LIKE smoke-%) — defensive even though current state is empty', () => {
      // Per intent brief §8 the cleanup at b8ce07b removed all 11
      // synthetic rows. The predicate is kept defensively so a
      // future test-seed leak surfaces as synthetic_test_data, not
      // organic_duplicate_candidate. This matches the design pattern
      // already used in Q12 (post Q12-SEMANTIC-TIGHTENING).
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(/provider_key\s+like\s+'smoke-%'/i.test(stripped)).toBe(true);
    });

    it('uses run_id allowlist as a defensive fallback (Signal 2)', () => {
      // Pair 3 (production, 2m 11s gap) would otherwise classify as
      // needs_investigation; the run_id allowlist catches it as the
      // documented Phase 6 idempotency smoke instead.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The three pairs' six run_ids must appear in the executable
      // SQL (not just in commentary).
      const ALLOWLIST_RUN_IDS = [
        '67431fe3-5e29-4c38-8fc3-96c6f59467fa', // Pair 1 run 1
        'c8f09f4d-8cb5-44df-b925-1d428f73d24f', // Pair 1 run 2
        'f370e813-1f80-4b40-8bc1-7a4d71c59489', // Pair 2 run 1
        '0263205e-cc71-4116-bbf0-7d19b86d75c5', // Pair 2 run 2
        'a416c21a-bc06-4446-9902-7112ff59ff37', // Pair 3 run 1
        '7ea35268-4caf-4621-b8a5-65e99f8aaa9a', // Pair 3 run 2
      ];
      for (const id of ALLOWLIST_RUN_IDS) {
        expect(stripped.includes(id)).toBe(true);
      }
      // The allowlist must be applied via a Postgres array-overlap
      // (`&&`) operator against the aggregated run_ids column.
      expect(/run_ids\s*&&\s*array\s*\[/i.test(stripped)).toBe(true);
    });

    it('the conservative-default branch is the FINAL else of the CASE (not a WHEN with hardcoded condition)', () => {
      // The conservative default is the test the operator most
      // cares about: ANY duplicate-pair not provably classified into
      // the three categories above MUST fall to
      // organic_duplicate_candidate. A `when … then
      // 'organic_duplicate_candidate'` (with a specific condition)
      // would be a hidden filter — a future organic duplicate that
      // does not match the condition would be silently dropped.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The pattern `else 'organic_duplicate_candidate'` must appear;
      // the pattern `when ... then 'organic_duplicate_candidate'`
      // must NOT appear.
      expect(/else\s+'organic_duplicate_candidate'/i.test(stripped)).toBe(true);
      expect(
        /when[\s\S]*?then\s+'organic_duplicate_candidate'/i.test(stripped),
      ).toBe(false);
    });
  });

  /* ----------------------------------------------------------------- */
  /* Group D — header documents the heuristic + RCA + Stage 2B         */
  /* ----------------------------------------------------------------- */

  describe('header documentation', () => {
    it('header is a comment block referencing OPS-MCP-OBSERVABILITY (existing invariant)', () => {
      const src = readQ9();
      // Mirror of the existing opsMcpObservabilitySqlSafety
      // invariant: first non-empty line starts with `--` and the
      // file contains the literal `OPS-MCP-OBSERVABILITY`.
      const firstNonEmpty = src
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      expect(firstNonEmpty).toBeDefined();
      expect(firstNonEmpty?.startsWith('--')).toBe(true);
      expect(src).toContain('OPS-MCP-OBSERVABILITY');
    });

    it('header documents Stage 2B re-scope + RCA finding (Cause-C-only path)', () => {
      // The header MUST surface the binding-decision context so a
      // future operator reading the SQL understands WHY the
      // classification exists.
      const src = readQ9();
      const header = extractHeaderBlock(src);
      // 'Stage 2B' phrase OR 'OPS-MCP-IDEMPOTENCY-HARDENING' card
      // name in the header documents the re-scope provenance.
      const mentionsCard =
        /OPS-MCP-IDEMPOTENCY-HARDENING/.test(header) ||
        /Stage\s*2B/i.test(header);
      expect(mentionsCard).toBe(true);
      // The RCA finding (no current runtime defect) is what makes
      // the classified report defensible. The header must surface
      // this either by mentioning 'RCA' or 'audit re-fire' or
      // 'documented' as the rationale for not flagging.
      const mentionsRcaRationale =
        /\bRCA\b/.test(header) ||
        /audit\s*\/?\s*smoke\s+re-?fire/i.test(header) ||
        /\bdocumented\b.*\bre-?fire/i.test(header) ||
        /\bre-?fire\b.*\bdocumented\b/i.test(header);
      expect(mentionsRcaRationale).toBe(true);
    });

    it('header enumerates all four classification categories with descriptions', () => {
      // Operator scanning the SQL must see what each category means
      // without leaving the file.
      const src = readQ9();
      const header = extractHeaderBlock(src);
      const categories = [
        'audit_or_smoke_rerun',
        'synthetic_test_data',
        'needs_investigation',
        'organic_duplicate_candidate',
      ];
      for (const cat of categories) {
        expect(header).toContain(cat);
      }
    });

    it('header documents the conservative-default semantics', () => {
      // The single most important property: "default is
      // organic_duplicate_candidate so real risk is never hidden".
      const src = readQ9();
      const header = extractHeaderBlock(src);
      // 'conservative' OR 'default' OR 'never hidden' phrasing.
      const mentionsConservativeness =
        /\bconservative\b/i.test(header) ||
        /never\s+hidden/i.test(header) ||
        /DEFAULT\b/.test(header);
      expect(mentionsConservativeness).toBe(true);
    });

    it('header documents the two-signal audit_or_smoke_rerun heuristic', () => {
      const src = readQ9();
      const header = extractHeaderBlock(src);
      // Signal 1 (time-gap) — 1 hour threshold.
      expect(/1\s*hour/i.test(header)).toBe(true);
      // Signal 2 (run_id allowlist) — at least one of the three
      // pairs' run_id prefixes mentioned for the allowlist
      // justification.
      const mentionsAllowlist =
        /allowlist/i.test(header) ||
        /67431fe3/.test(header) ||
        /a416c21a/.test(header);
      expect(mentionsAllowlist).toBe(true);
    });

    it('header references the binding audit document(s) (RCA evidence)', () => {
      // The RCA evidence is in committed audit files. The SQL
      // header references at least one of them so the
      // classification's grounding is auditable.
      const src = readQ9();
      const header = extractHeaderBlock(src);
      const auditReferenced =
        /MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE/.test(header) ||
        /MCP-021C-EDGE-SMOKE/.test(header) ||
        /OPS-MCP-FAMILY-VALIDATOR-REFACTOR-SMOKE/.test(header);
      expect(auditReferenced).toBe(true);
    });
  });

  /* ----------------------------------------------------------------- */
  /* Group E — defense-in-depth against the binding NO-GO list          */
  /* ----------------------------------------------------------------- */

  describe('binding NO-GO defense', () => {
    it('SQL is read-only — no DDL keywords', () => {
      // OPS-MCP-IDEMPOTENCY-HARDENING (Stage 2B) is explicitly
      // forbidden from adding a migration / DB constraint / Edge
      // change. This SQL is read-only.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      const DDL = [
        'INSERT',
        'UPDATE',
        'DELETE',
        'ALTER',
        'CREATE',
        'DROP',
        'TRUNCATE',
        'GRANT',
        'REVOKE',
      ];
      for (const kw of DDL) {
        const re = new RegExp('\\b' + kw + '\\b', 'i');
        expect(re.test(stripped)).toBe(false);
      }
    });

    it('SQL does not reference admin_force_rerun (the rejected runtime fix column)', () => {
      // The original (rejected) design proposed a new column
      // `admin_force_rerun boolean` on the runs table. The Stage 2B
      // decision rejected that column. The SQL must not reference
      // it; doing so would imply the column exists, which would
      // mislead a future implementer.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(/\badmin_force_rerun\b/i.test(stripped)).toBe(false);
    });

    it('SQL does not reference forceRerun (the rejected runtime fix request param)', () => {
      // Defense-in-depth against the rejected Edge Function param.
      const src = readQ9();
      // Even in commentary — the SQL never has a reason to mention
      // a request-body parameter. A reference here would be a stale
      // doctrine-leak from the rejected design.
      expect(/\bforceRerun\b/i.test(src)).toBe(false);
    });

    it('SQL does not reference unique index / partial unique (the rejected DB constraint)', () => {
      // Defense-in-depth: the SQL is a read query, not a DDL
      // counterpart of a partial-UNIQUE constraint. The rejected
      // design proposed `CREATE UNIQUE INDEX … WHERE …`. No such
      // mention should leak into this read-only Q9.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      expect(/unique\s+index/i.test(stripped)).toBe(false);
    });

    it('SQL only touches read-only observability sources (runs + results tables)', () => {
      // The query must only read from the existing observability
      // tables. No reference to other tables (a defensive bound
      // against scope creep).
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // The query references these two FROM/JOIN targets.
      expect(
        /public\.argument_machine_observation_runs/i.test(stripped),
      ).toBe(true);
      expect(
        /public\.argument_machine_observation_results/i.test(stripped),
      ).toBe(true);
      // It must NOT reference the arguments table or auth tables.
      expect(/\bpublic\.arguments\b/i.test(stripped)).toBe(false);
      expect(/\bauth\./i.test(stripped)).toBe(false);
      expect(/\bstorage\./i.test(stripped)).toBe(false);
    });
  });

  /* ----------------------------------------------------------------- */
  /* Group F — doctrine ban-list + safety                              */
  /* ----------------------------------------------------------------- */

  describe('doctrine ban-list + safety', () => {
    it('no verdict tokens in the SQL (cdiscourse-doctrine §1)', () => {
      // Mirror of the ban-list applied by the existing
      // opsMcpObservabilityDoctrineBanList test, applied to the
      // file's full body (comments + executable SQL).
      const src = readQ9();
      const lower = src.toLowerCase();
      const banned = [
        'winner',
        'loser',
        'fallacy',
        'bad faith',
        'manipulative',
        'extremist',
        'propagandist',
        'liar',
        'dishonest',
        // From the BANNED_VERDICT_TOKENS list.
        'correct',
        'incorrect',
      ];
      for (const tok of banned) {
        expect(lower.includes(tok)).toBe(false);
      }
    });

    it('no raw body / evidence content references — aggregate only', () => {
      // Defense-in-depth: the SQL must never pull body text or
      // evidence-span content. Mirror of the
      // opsMcpObservabilitySqlSafety invariant.
      const src = readQ9();
      const stripped = stripSqlComments(src);
      // No `arguments.body` reference at all (Q9 does not need it).
      expect(/arguments\.body/i.test(stripped)).toBe(false);
      // No `evidence_span` reference.
      expect(/\bevidence_span\b/i.test(stripped)).toBe(false);
    });

    it('no service-role / secret leak in comments or executable SQL', () => {
      // Mirror of the opsMcpObservabilityNoServiceRoleNoSecrets
      // invariant.
      const src = readQ9();
      const lower = src.toLowerCase();
      // Service role / api key references must not appear.
      expect(lower).not.toContain('service_role');
      expect(lower).not.toContain('service-role');
      expect(lower).not.toContain('anthropic_api_key');
      expect(lower).not.toContain('supabase_service_role_key');
      // No JWT-shape literal (defensive).
      expect(/\beyJ[A-Za-z0-9_-]{20,}/.test(src)).toBe(false);
    });

    it('SQL file ends with a single terminating semicolon (existing invariant)', () => {
      // Mirror of the opsMcpObservabilitySqlSafety invariant.
      const src = readQ9();
      const stripped = stripSqlComments(src).trim();
      expect(stripped.endsWith(';')).toBe(true);
    });
  });
});
