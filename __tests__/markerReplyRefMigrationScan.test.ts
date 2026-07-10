/**
 * MARK-002 (#894) — timestamp_markers.reply_argument_id migration text-scan
 * (Docker-less lane).
 *
 * The migration 20260711000002 is a SINGLE additive ALTER on the SELECT-only
 * timestamp_markers table (MARK-001): it ADDs one nullable FK column
 * reply_argument_id (marker-side reply linkage) plus a partial index and a
 * column comment. No RLS change, no policy, no trigger, no function, no
 * arguments-table ALTER. The write posture stays SELECT-only (all writes go
 * through the create-marker service-role Edge).
 *
 * Docker db reset is unavailable in CI, so the migration text is the single
 * chokepoint contract and this suite is the fs.readFileSync scan over it (the
 * timestampMarkersRlsScan.test.ts lane). The load-bearing properties are:
 *   1. Presence + numbering (strictly greater than 20260711000001, MARK-001).
 *   2. Strictly additive: the ONLY alter table is the reply_argument_id ADD
 *      COLUMN; no drop table/column/constraint, no disable RLS.
 *   3. SELECT-only preserved: NO new policy / trigger / function / grant.
 *   4. reply_argument_id is uuid references public.arguments(id) on delete set
 *      null, nullable; the partial index is present.
 *   5. Still deferred: no ms span_unit change, no recording_id, no
 *      proof_items.kind widening, no arguments-table ALTER.
 *   6. OPS-001 four-class assertions + doctrine ban-list.
 * Every safety scan is paired with a NEGATIVE CONTROL that plants the violation
 * and asserts the same scan fires — a scan that cannot fail is not a test.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260711000002_mark_002_marker_reply_ref.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

// ── pure scan helpers (shared by real-text assertions AND negative controls) ──

function timestampPrefix(filename: string): number {
  const m = filename.match(/^(\d{14})_/);
  return m ? Number(m[1]) : NaN;
}

/** The migration with SQL line-comments (`-- ...`) stripped. */
function stripSqlComments(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/**
 * Every `alter table public.<table> <verb...>` statement, reduced to
 * `<table>:<first one-or-two verb words>`.
 */
function alterTableVerbs(text: string): string[] {
  const re = /alter table public\.(\w+)\s+(\w+(?:\s+\w+)?)/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[1]}:${m[2].toLowerCase()}`);
  }
  return out;
}

/** Every `create policy <name> ... for <cmd>` in the file. */
function createdPolicies(text: string): Array<{ name: string; cmd: string }> {
  const re = /create policy (\w+)\s+on public\.\w+\s+for (select|insert|update|delete)/gi;
  const out: Array<{ name: string; cmd: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], cmd: m[2].toLowerCase() });
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PERSON_LABEL_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
];

// Boolean/technical verdict tokens scanned ONLY over the executable SQL (the
// machine-authored comments legitimately discuss statuses in prose).
const BOOLEAN_AMBIGUOUS_TOKENS = ['winner', 'loser', 'correct'];

function containsAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
}

// ── presence + numbering ─────────────────────────────────────

describe('MARK-002 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the MARK-001 migration (20260711000001)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260711000001);
  });
});

// ── strictly additive (THE load-bearing safety property) ─────

describe('MARK-002 — strictly additive: one ALTER ADD COLUMN, nothing dropped', () => {
  it('the ONLY schema-mutating ALTER TABLE is the additive timestamp_markers ADD COLUMN reply_argument_id', () => {
    expect(alterTableVerbs(migrationText)).toEqual(['timestamp_markers:add column']);
    expect(migrationText).toMatch(
      /alter table public\.timestamp_markers\s+add column if not exists reply_argument_id/i,
    );
  });

  it('drops no table and alters away no column/constraint', () => {
    expect(migrationText).not.toMatch(/drop\s+table/i);
    expect(migrationText).not.toMatch(/alter\s+table\s+\S+\s+drop\b/i);
    expect(migrationText).not.toMatch(/drop\s+(column|constraint)\b/i);
  });

  it('never disables RLS', () => {
    expect(migrationText).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  it('NEGATIVE CONTROL: the additive scan fires when a drop column is planted', () => {
    const planted = `${migrationText}\nalter table public.timestamp_markers drop column reply_argument_id;\n`;
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(migrationText)).toBe(false);
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(planted)).toBe(true);
  });

  it('NEGATIVE CONTROL: the single-ALTER scan fires when a second alter target is planted', () => {
    const planted = `${migrationText}\nalter table public.arguments add column target_marker_id uuid;\n`;
    expect(alterTableVerbs(migrationText)).toEqual(['timestamp_markers:add column']);
    expect(alterTableVerbs(planted)).toContain('arguments:add column');
  });
});

// ── SELECT-only posture preserved: no policy / trigger / function ──

describe('MARK-002 — SELECT-only posture preserved (no write machinery, no RLS change)', () => {
  it('creates NO policy of any kind (the marker SELECT policy is untouched)', () => {
    expect(createdPolicies(migrationText)).toEqual([]);
    expect(migrationText).not.toMatch(/create policy/i);
    expect(migrationText).not.toMatch(/drop policy/i);
  });

  it('contains NO for-insert / for-update / for-delete policy', () => {
    expect(migrationText).not.toMatch(/for\s+insert/i);
    expect(migrationText).not.toMatch(/for\s+update/i);
    expect(migrationText).not.toMatch(/for\s+delete/i);
  });

  it('ships NO trigger, NO function, NO grant (all writes -> create-marker Edge)', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migrationText).not.toMatch(/create\s+trigger/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
  });

  it('NEGATIVE CONTROL: the no-policy scan fires when a write policy is planted', () => {
    const planted = `${migrationText}\ncreate policy timestamp_markers_insert_x on public.timestamp_markers for insert to authenticated with check (true);\n`;
    expect(createdPolicies(migrationText)).toEqual([]);
    expect(createdPolicies(planted).some((p) => p.cmd === 'insert')).toBe(true);
  });
});

// ── reply_argument_id column shape ───────────────────────────

describe('MARK-002 — reply_argument_id additive nullable FK + partial index', () => {
  it('adds reply_argument_id uuid referencing public.arguments(id) on delete set null', () => {
    expect(migrationText).toMatch(
      /add column if not exists reply_argument_id uuid references public\.arguments\(id\) on delete set null/i,
    );
  });

  it('the reply_argument_id column carries no NOT NULL constraint (nullable)', () => {
    // The ADD COLUMN statement (comment-stripped) must not carry `not null`.
    const code = stripSqlComments(migrationText);
    const addStmt = code.match(/add column if not exists reply_argument_id[\s\S]*?;/i)?.[0] ?? '';
    expect(addStmt.length).toBeGreaterThan(0);
    expect(addStmt).not.toMatch(/not\s+null/i);
  });

  it('adds the partial index timestamp_markers_reply_argument (reply_argument_id is not null and deleted_at is null)', () => {
    expect(migrationText).toMatch(
      /create index if not exists timestamp_markers_reply_argument\s+on public\.timestamp_markers \(reply_argument_id\)\s+where reply_argument_id is not null and deleted_at is null/i,
    );
  });

  it('NEGATIVE CONTROL: the on-delete-set-null scan fires when a cascade is planted', () => {
    const real = migrationText;
    // Target the unique FK phrase in the ALTER statement, not the earlier
    // header-comment mention of the same words.
    const planted = real.replace(
      'reply_argument_id uuid references public.arguments(id) on delete set null',
      'reply_argument_id uuid references public.arguments(id) on delete cascade',
    );
    expect(/reply_argument_id uuid references public\.arguments\(id\) on delete set null/i.test(real)).toBe(
      true,
    );
    expect(/reply_argument_id uuid references public\.arguments\(id\) on delete set null/i.test(planted)).toBe(
      false,
    );
  });
});

// ── still deferred: no voice lane, no arguments ALTER, no proof kind widening ──

describe('MARK-002 — deferred surfaces stay deferred (executable SQL)', () => {
  it('makes NO span_unit change (the P5 voice ms lane stays deferred)', () => {
    const code = stripSqlComments(migrationText);
    expect(code).not.toMatch(/span_unit/i);
    expect(code).not.toContain("'ms'");
  });

  it('ships NO recording_id column (executable SQL)', () => {
    expect(stripSqlComments(migrationText)).not.toMatch(/recording_id/i);
  });

  it('does NOT ALTER public.arguments (marker-side linkage; submit-argument stays pinned)', () => {
    const code = stripSqlComments(migrationText);
    expect(code).not.toMatch(/alter table public\.arguments/i);
    expect(code).not.toMatch(/target_marker_id/i);
  });

  it('does NOT widen proof_items.kind (no voice-proof / storage kinds)', () => {
    const code = stripSqlComments(migrationText);
    expect(code).not.toMatch(/check \(kind in/i);
    expect(code).not.toContain("'voice_excerpt'");
    expect(code).not.toContain("'timestamp'");
    expect(code).not.toContain("'proof_excerpt'");
  });

  it('NEGATIVE CONTROL: the no-arguments-ALTER scan fires when an arguments ALTER is planted', () => {
    const code = stripSqlComments(migrationText);
    const planted = `${code}\nalter table public.arguments add column target_marker_id uuid;\n`;
    expect(/alter table public\.arguments/i.test(code)).toBe(false);
    expect(/alter table public\.arguments/i.test(planted)).toBe(true);
  });

  it('NEGATIVE CONTROL: the no-span_unit-change scan fires when a span_unit widen is planted', () => {
    const code = stripSqlComments(migrationText);
    const planted = `${code}\nalter table public.timestamp_markers drop constraint x, add check (span_unit in ('chars','ms'));\n`;
    expect(/span_unit/i.test(code)).toBe(false);
    expect(/span_unit/i.test(planted)).toBe(true);
  });
});

// ── OPS-001 four-class compliance ────────────────────────────

describe('MARK-002 — OPS-001 four-class compliance', () => {
  it('Class 2: reply_argument_id is uuid referencing a uuid PK (no text<->uuid mismatch)', () => {
    expect(migrationText).toMatch(/reply_argument_id uuid references public\.arguments\(id\)/i);
    expect(migrationText).not.toMatch(/reply_argument_id\s+text/i);
  });

  it('Class 3: the FK target public.arguments is referenced but never created/altered here', () => {
    const code = stripSqlComments(migrationText);
    expect(code).toMatch(/references public\.arguments\(id\)/i);
    expect(code).not.toMatch(/create table public\.arguments/i);
  });

  it('Class 4: creates no extension and no function', () => {
    expect(migrationText).not.toMatch(/create\s+extension/i);
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
  });
});

// ── doctrine ban-list ────────────────────────────────────────

describe('MARK-002 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('the executable SQL contains no verdict token', () => {
    expect(containsAnyToken(stripSqlComments(migrationText), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('marker-side reply reference', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
  });
});
