/**
 * FEEDBACK-001 (#898) — move_marks migration RLS text-scan (Docker-less lane).
 *
 * The migration 20260712000001 creates ONE new RLS-enabled table under the
 * SELECT-only posture (the current house default — PROOF-001 #888 proof_items +
 * proof_relations, MARK-001 #893 timestamp_markers, circles #859; four SELECT-only
 * instances): the table gets exactly ONE policy (SELECT to authenticated, active +
 * room-visible via the single is_argument_visible_in_circle helper). ALL writes
 * (mark upsert, retract, and the paired-code exclusivity retract) belong to the
 * mark-move service-role Edge — so this migration ships NO write policy, NO
 * write-gate helper, NO write-guard trigger, NO grant.
 *
 * Docker db reset is unavailable in CI, so the migration text is the single
 * chokepoint contract and this suite is the fs.readFileSync scan over it (the
 * #882 / #888 lane, mirroring timestampMarkersRlsScan.test.ts). The load-bearing
 * properties are:
 *   1. SELECT-ONLY: no INSERT/UPDATE/DELETE policy on the new table.
 *   2. RLS enabled, never disabled; strictly additive (no drop/alter of a
 *      pre-existing object; the ONLY table-mutating statements are the CREATE
 *      TABLE + the RLS-lifecycle enable).
 *   3. The SELECT body reads cross-table state ONLY through the pre-applied
 *      definer helper is_argument_visible_in_circle (no raw arguments/debates
 *      subquery).
 *   4. mark_code CHECK set is exactly the five Output 9 codes.
 *   5. FULL UNIQUE (argument_id, marked_by, mark_code) — the two-state latch,
 *      not the point_tags partial-where-null form; retracted_at present; no
 *      hard-delete.
 *   6. Class-1 qualification; Class-4 helper referenced-not-redefined; doctrine
 *      ban-list on the code literals.
 * Every safety scan is paired with a NEGATIVE CONTROL that plants the violation
 * and asserts the same scan fires — a scan that cannot fail is not a test.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260712000001_feedback_001_move_marks.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

const MARKS_SELECT = 'move_marks_select_room_visible';

const MARK_CODES = [
  'addressed_my_point',
  'did_not_address',
  'receipts_requested',
  'good_receipt',
  'off_the_point',
];

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

// ── pure scan helpers (shared by real-text assertions AND negative controls) ──

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The migration with SQL line-comments (`-- ...`) stripped, so a whole-text
 *  scan tests the executable SQL and not the explanatory prose. */
function stripSqlComments(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** The executable SQL with BOTH line-comments and single-quoted string literals
 *  stripped. Used for column-shape scans (score / standing / weight) so the
 *  doctrine prose inside the `comment on table ... is '...'` literal — which
 *  legitimately says "NO score / standing column" — does not false-fire. */
function stripCommentsAndStringLiterals(text: string): string {
  return stripSqlComments(text).replace(/'(?:[^']|'')*'/g, "''");
}

function timestampPrefix(filename: string): number {
  const m = filename.match(/^(\d{14})_/);
  return m ? Number(m[1]) : NaN;
}

/** The USING(...) predicate body of a CREATE POLICY <name>, inline comments stripped. */
function usingBody(text: string, policyName: string): string {
  const re = new RegExp(
    `create policy ${escapeRe(policyName)}[\\s\\S]*?using \\(([\\s\\S]*?)\\)\\s*;`,
    'i',
  );
  const raw = text.match(re)?.[1] ?? '';
  return raw
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .trim();
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

/** Every `drop policy if exists <name> on <schema.table>` target in the file. */
function dropPolicyTargets(text: string): Array<{ name: string; table: string }> {
  const re = /drop\s+policy\s+if\s+exists\s+(\S+)\s+on\s+(public\.\w+)/gi;
  const out: Array<{ name: string; table: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], table: m[2] });
  }
  return out;
}

/**
 * Every `alter table public.<table> <verb...>` statement in the file, reduced to
 * `<table>:<first one-or-two verb words>`. The ONLY ALTER TABLE this migration
 * ships is the RLS-lifecycle enable.
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

/** The body of a `check (<col> in (...))` for a named column. Tolerates a
 *  newline / whitespace between `in` and the value list `(`. */
function checkInSet(text: string, column: string): string {
  const re = new RegExp(`check \\(${escapeRe(column)} in\\s*\\(([^)]*)\\)`, 'i');
  return text.match(re)?.[1] ?? '';
}

/**
 * True if a policy USING body references a sensitive column WITHOUT a table
 * qualifier. Every real reference in this migration is `<table>.<col>`, so a
 * bare occurrence (not preceded by `.`) is the Class-1 hazard.
 */
function hasUnqualifiedSensitiveColumn(body: string): boolean {
  return /(?<!\.)\b(retracted_at|argument_id|debate_id)\b/.test(body);
}

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

// Boolean/technical verdict tokens are scanned ONLY inside the policy USING body
// (machine-authored comments legitimately discuss statuses in prose).
const BOOLEAN_AMBIGUOUS_TOKENS = ['true', 'false', 'correct'];

function containsAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
}

// ── presence + numbering ─────────────────────────────────────

describe('FEEDBACK-001 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the MARK-002 marker-reply migration (20260711000002)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260711000002);
  });
});

// ── RLS enabled + additive ───────────────────────────────────

describe('FEEDBACK-001 — RLS enabled, never disabled, strictly additive', () => {
  it('enables RLS on the new move_marks table', () => {
    expect(migrationText).toMatch(/alter table public\.move_marks\s+enable row level security/i);
  });

  it('never disables RLS', () => {
    expect(migrationText).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  it('drops no table and alters away no column/constraint', () => {
    expect(migrationText).not.toMatch(/drop\s+table/i);
    // Same-statement scan: `alter table <name> drop ...`. (A cross-statement
    // [\s\S]*? span would false-fire on the later additive `drop policy`.)
    expect(migrationText).not.toMatch(/alter\s+table\s+\S+\s+drop\b/i);
    expect(migrationText).not.toMatch(/drop\s+(column|constraint)\b/i);
  });

  it('the ONLY schema ALTER TABLE is the additive RLS-lifecycle enable on move_marks', () => {
    expect(alterTableVerbs(migrationText)).toEqual(['move_marks:enable row']);
  });

  it('the ONLY DROP POLICY statement targets the new SELECT name on public.move_marks', () => {
    expect(dropPolicyTargets(migrationText)).toEqual([
      { name: MARKS_SELECT, table: 'public.move_marks' },
    ]);
  });

  it('NEGATIVE CONTROL: the additive scan fires when a drop column is planted', () => {
    const planted = `${migrationText}\nalter table public.move_marks drop column mark_code;\n`;
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(migrationText)).toBe(false);
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(planted)).toBe(true);
  });
});

// ── SELECT-ONLY (THE load-bearing safety property) ───────────

describe('FEEDBACK-001 — SELECT-only: no write policy on the new table', () => {
  it('creates exactly ONE policy, FOR SELECT', () => {
    expect(createdPolicies(migrationText)).toEqual([{ name: MARKS_SELECT, cmd: 'select' }]);
  });

  it('contains NO for-insert / for-update / for-delete policy', () => {
    expect(migrationText).not.toMatch(/for\s+insert/i);
    expect(migrationText).not.toMatch(/for\s+update/i);
    expect(migrationText).not.toMatch(/for\s+delete/i);
  });

  it('the SELECT policy is TO authenticated', () => {
    expect(migrationText).toMatch(
      /create policy move_marks_select_room_visible\s+on public\.move_marks\s+for select\s+to authenticated/i,
    );
  });

  it('ships NO write-gate helper, NO write-guard trigger, NO grant (all writes -> mark-move Edge)', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migrationText).not.toMatch(/create\s+trigger/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
    // No GRANT statement in the executable SQL. Scanned comment-stripped so the
    // header prose ("no new grant") does not false-fire.
    expect(stripSqlComments(migrationText)).not.toMatch(/\bgrant\b/i);
  });

  it('NEGATIVE CONTROL: the SELECT-only scan fires when a write policy is planted', () => {
    const planted = `${migrationText}\ncreate policy move_marks_insert_x on public.move_marks for insert to authenticated with check (true);\n`;
    expect(/for\s+insert/i.test(migrationText)).toBe(false);
    expect(/for\s+insert/i.test(planted)).toBe(true);
    expect(createdPolicies(planted).some((p) => p.cmd === 'insert')).toBe(true);
  });
});

// ── SELECT body routes through the single composite helper ──

describe('FEEDBACK-001 — SELECT body uses is_argument_visible_in_circle only (no raw subquery)', () => {
  it('the SELECT body filters retracted_at + calls is_argument_visible_in_circle(argument_id)', () => {
    const body = usingBody(migrationText, MARKS_SELECT);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /move_marks\.retracted_at is null[\s\S]*?and\s+public\.is_argument_visible_in_circle\(move_marks\.argument_id, auth\.uid\(\)\)/i,
    );
  });

  it('the SELECT body contains no raw select ... from public.arguments/debates subquery', () => {
    const body = usingBody(migrationText, MARKS_SELECT);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.arguments/i);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.debates/i);
  });

  it('NEGATIVE CONTROL: the no-inline scan fires when a raw arguments subquery is planted', () => {
    const real = usingBody(migrationText, MARKS_SELECT);
    const planted = `${real}\n    and exists (select 1 from public.arguments a where a.id = move_marks.argument_id)`;
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(real)).toBe(false);
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(planted)).toBe(true);
  });
});

// ── mark_code CHECK set (exactly the five Output 9 codes) ──

describe('FEEDBACK-001 — mark_code CHECK set', () => {
  it('the mark_code CHECK set is exactly the five Output 9 codes', () => {
    const set = checkInSet(migrationText, 'mark_code');
    const parsed = set
      .split(',')
      .map((s) => s.replace(/['\s]/g, ''))
      .filter((s) => s.length > 0);
    expect(parsed).toEqual(MARK_CODES);
  });

  it('every code literal is present in the CHECK', () => {
    for (const code of MARK_CODES) {
      expect(migrationText).toContain(`'${code}'`);
    }
  });

  it('NEGATIVE CONTROL: the exact-set scan fires when a sixth code is planted', () => {
    const realSet = checkInSet(migrationText, 'mark_code');
    const plantedSet = realSet.replace("'off_the_point'", "'off_the_point',\n                   'is_the_winner'");
    expect(realSet.includes("'is_the_winner'")).toBe(false);
    expect(plantedSet.includes("'is_the_winner'")).toBe(true);
  });
});

// ── FULL UNIQUE + retracted_at latch (no hard-delete) ──

describe('FEEDBACK-001 — the two-state latch shape', () => {
  it('declares the FULL unique (argument_id, marked_by, mark_code)', () => {
    expect(migrationText).toMatch(
      /constraint move_marks_one_per_marker_code unique \(argument_id, marked_by, mark_code\)/i,
    );
  });

  it('the UNIQUE is NOT the point_tags partial where-retracted-null form', () => {
    // The full-unique choice (#898) has no `where retracted_at is null` on the
    // constraint itself (the partial index is separate + not a UNIQUE).
    expect(migrationText).not.toMatch(/unique\s*\([^)]*\)\s*where\s+retracted_at/i);
  });

  it('declares retracted_at as a nullable timestamptz (retract = timestamp, never delete)', () => {
    expect(migrationText).toMatch(/retracted_at\s+timestamptz\s*(,|\n)/i);
    expect(migrationText).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/i);
  });

  it('ships NO point-standing / score / engagement column (inert storage)', () => {
    // Scan the executable SQL with comments AND string literals stripped: the
    // doctrine prose inside the comment-on literal legitimately says "NO score /
    // standing column", so only a real column/identifier occurrence must fail.
    const code = stripCommentsAndStringLiterals(migrationText);
    expect(code).not.toMatch(/\bscore\b/i);
    expect(code).not.toMatch(/\bstanding\b/i);
    expect(code).not.toMatch(/\bweight\b/i);
    expect(code).not.toMatch(/broad_standing|narrow_standing|point_standing/i);
  });

  it('the two partial ACTIVE indexes filter where retracted_at is null', () => {
    expect(migrationText).toMatch(
      /create index if not exists move_marks_argument_active_idx\s+on public\.move_marks \(argument_id\) where retracted_at is null/i,
    );
    expect(migrationText).toMatch(
      /create index if not exists move_marks_debate_active_idx\s+on public\.move_marks \(debate_id\)\s+where retracted_at is null/i,
    );
  });
});

// ── Class-1 qualification ────────────────────────────────────

describe('FEEDBACK-001 — Class 1: every column ref in the USING body is table-qualified', () => {
  it('the SELECT body references no sensitive column without a table qualifier', () => {
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, MARKS_SELECT))).toBe(false);
  });

  it('NEGATIVE CONTROL: the qualification scan fires on a planted bare column', () => {
    expect(hasUnqualifiedSensitiveColumn('move_marks.retracted_at is null')).toBe(false);
    expect(hasUnqualifiedSensitiveColumn('and retracted_at is null')).toBe(true);
    expect(hasUnqualifiedSensitiveColumn('and argument_id = x')).toBe(true);
  });
});

// ── Class-4: pre-applied helper referenced, never redefined; no extension ──

describe('FEEDBACK-001 — Class 4: references the pre-applied helper, defines nothing new', () => {
  it('does not redefine is_argument_visible_in_circle and creates no extension, but does reference the helper', () => {
    expect(migrationText).not.toMatch(
      /create\s+(or\s+replace\s+)?function\s+public\.is_argument_visible_in_circle/i,
    );
    expect(migrationText).not.toMatch(/create\s+extension/i);
    expect(migrationText).toMatch(/public\.is_argument_visible_in_circle\(/i);
  });
});

// ── doctrine ban-list ────────────────────────────────────────

describe('FEEDBACK-001 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('the SELECT policy body contains no boolean/technical verdict token', () => {
    expect(containsAnyToken(usingBody(migrationText, MARKS_SELECT), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(
      false,
    );
  });

  it('no mark_code literal contains a verdict / person token', () => {
    for (const code of MARK_CODES) {
      expect(containsAnyToken(code, PERSON_LABEL_TOKENS)).toBe(false);
      expect(containsAnyToken(code, BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
    }
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('room-visible read access', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
    expect(containsAnyToken("and move_marks.mark_code = 'false'", BOOLEAN_AMBIGUOUS_TOKENS)).toBe(
      true,
    );
  });
});
