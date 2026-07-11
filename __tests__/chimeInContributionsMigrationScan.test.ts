/**
 * CHIMEIN-P8 Round 2 (#761) — chime_in_contributions migration RLS text-scan
 * (Docker-less heightened-review lane, OPS-001 four classes).
 *
 * The migration 20260713000001 creates ONE new RLS-enabled table under the
 * SELECT-only posture (the house default — PROOF-001 #888 proof_items, MARK-001
 * #893 timestamp_markers, FEEDBACK-001 #898 move_marks): the table gets exactly
 * ONE policy (SELECT to authenticated, active + room-visible via the single
 * is_argument_visible_in_circle helper). ALL writes (attach, retract) belong to
 * the chime-in service-role Edge, so this migration ships NO write policy, NO
 * write-gate helper, NO write-guard trigger, NO grant.
 *
 * Docker db reset is unavailable in CI, so the migration text is the single
 * chokepoint contract and this suite is the fs.readFileSync scan over it
 * (mirroring moveMarksMigrationScan.test.ts). The load-bearing properties:
 *   1. SELECT-ONLY: no INSERT/UPDATE/DELETE policy on the new table.
 *   2. RLS enabled, never disabled; strictly additive (no drop/alter of a
 *      pre-existing object; the ONLY table-mutating statements are the CREATE
 *      TABLE + the RLS-lifecycle enable).
 *   3. The SELECT body reads cross-table state ONLY through the pre-applied
 *      definer helper is_argument_visible_in_circle (no raw arguments/debates
 *      subquery) — Class 1.
 *   4. The atomic cap guard is the PARTIAL UNIQUE (debate_id, seat_index) WHERE
 *      retracted_at is null (the move_marks UNIQUE-as-atomic-guard idiom), plus a
 *      one-active-per-argument partial UNIQUE. seat_index CHECK 1..3 is the
 *      ceiling.
 *   5. Inert storage: no principal-seat / score / standing / node-state column,
 *      no trigger — the anti-amplification separation.
 *   6. Class 4 helper referenced-not-redefined + no extension; doctrine ban-list.
 * Every safety scan is paired with a NEGATIVE CONTROL that plants the violation
 * and asserts the same scan fires — a scan that cannot fail is not a test.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260713000001_chimein_001_chime_in_contributions.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

const CHIME_SELECT = 'chime_in_contributions_select_room_visible';

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
 *  stripped. Used for column-shape scans (score / standing / node-state) so the
 *  doctrine prose inside the `comment on table ... is '...'` literal — which
 *  legitimately says "NO score / standing / node-state column" — does not
 *  false-fire. */
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

describe('CHIMEIN-P8 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the FEEDBACK-001 move_marks migration (20260712000001)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260712000001);
  });

  it('creates the chime_in_contributions table', () => {
    expect(migrationText).toMatch(
      /create table if not exists public\.chime_in_contributions/i,
    );
  });
});

// ── RLS enabled + additive ───────────────────────────────────

describe('CHIMEIN-P8 — RLS enabled, never disabled, strictly additive', () => {
  it('enables RLS on the new chime_in_contributions table', () => {
    expect(migrationText).toMatch(
      /alter table public\.chime_in_contributions\s+enable row level security/i,
    );
  });

  it('never disables RLS', () => {
    expect(migrationText).not.toMatch(/disable\s+row\s+level\s+security/i);
  });

  it('drops no table and alters away no column/constraint', () => {
    expect(migrationText).not.toMatch(/drop\s+table/i);
    expect(migrationText).not.toMatch(/alter\s+table\s+\S+\s+drop\b/i);
    expect(migrationText).not.toMatch(/drop\s+(column|constraint)\b/i);
  });

  it('the ONLY schema ALTER TABLE is the additive RLS-lifecycle enable on chime_in_contributions', () => {
    expect(alterTableVerbs(migrationText)).toEqual(['chime_in_contributions:enable row']);
  });

  it('the ONLY DROP POLICY statement targets the new SELECT name on public.chime_in_contributions', () => {
    expect(dropPolicyTargets(migrationText)).toEqual([
      { name: CHIME_SELECT, table: 'public.chime_in_contributions' },
    ]);
  });

  it('NEGATIVE CONTROL: the additive scan fires when a drop column is planted', () => {
    const planted = `${migrationText}\nalter table public.chime_in_contributions drop column seat_index;\n`;
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(migrationText)).toBe(false);
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(planted)).toBe(true);
  });
});

// ── SELECT-ONLY (THE load-bearing safety property) ───────────

describe('CHIMEIN-P8 — SELECT-only: no write policy on the new table', () => {
  it('creates exactly ONE policy, FOR SELECT', () => {
    expect(createdPolicies(migrationText)).toEqual([{ name: CHIME_SELECT, cmd: 'select' }]);
  });

  it('contains NO for-insert / for-update / for-delete policy', () => {
    expect(migrationText).not.toMatch(/for\s+insert/i);
    expect(migrationText).not.toMatch(/for\s+update/i);
    expect(migrationText).not.toMatch(/for\s+delete/i);
  });

  it('the SELECT policy is TO authenticated', () => {
    expect(migrationText).toMatch(
      /create policy chime_in_contributions_select_room_visible\s+on\s+public\.chime_in_contributions\s+for select\s+to authenticated/i,
    );
  });

  it('ships NO write-gate helper, NO write-guard trigger, NO grant (all writes -> chime-in Edge)', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migrationText).not.toMatch(/create\s+trigger/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
    // No GRANT statement in the executable SQL. Scanned comment-stripped so the
    // header prose ("CREATES no new grant") does not false-fire.
    expect(stripSqlComments(migrationText)).not.toMatch(/\bgrant\b/i);
  });

  it('NEGATIVE CONTROL: the SELECT-only scan fires when a write policy is planted', () => {
    const planted = `${migrationText}\ncreate policy chime_in_contributions_insert_x on public.chime_in_contributions for insert to authenticated with check (true);\n`;
    expect(/for\s+insert/i.test(migrationText)).toBe(false);
    expect(/for\s+insert/i.test(planted)).toBe(true);
    expect(createdPolicies(planted).some((p) => p.cmd === 'insert')).toBe(true);
  });
});

// ── SELECT body routes through the single composite helper (Class 1) ──

describe('CHIMEIN-P8 — SELECT body uses is_argument_visible_in_circle only (no raw subquery)', () => {
  it('the SELECT body filters retracted_at + calls is_argument_visible_in_circle(argument_id)', () => {
    const body = usingBody(migrationText, CHIME_SELECT);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /chime_in_contributions\.retracted_at is null[\s\S]*?and\s+public\.is_argument_visible_in_circle\(chime_in_contributions\.argument_id, auth\.uid\(\)\)/i,
    );
  });

  it('the SELECT body contains no raw select ... from public.arguments/debates subquery', () => {
    const body = usingBody(migrationText, CHIME_SELECT);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.arguments/i);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.debates/i);
  });

  it('every column ref in the USING body is table-qualified (Class 1)', () => {
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, CHIME_SELECT))).toBe(false);
  });

  it('NEGATIVE CONTROL: the no-inline + qualification scans fire when planted', () => {
    const real = usingBody(migrationText, CHIME_SELECT);
    const planted = `${real}\n    and exists (select 1 from public.arguments a where a.id = chime_in_contributions.argument_id)`;
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(real)).toBe(false);
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(planted)).toBe(true);
    expect(hasUnqualifiedSensitiveColumn('chime_in_contributions.retracted_at is null')).toBe(false);
    expect(hasUnqualifiedSensitiveColumn('and retracted_at is null')).toBe(true);
  });
});

// ── seat_index CHECK 1..3 (the cap ceiling) ──────────────────

describe('CHIMEIN-P8 — seat_index cap ceiling', () => {
  it('declares seat_index as smallint with CHECK between 1 and 3 (Class 2)', () => {
    expect(migrationText).toMatch(
      /seat_index\s+smallint\s+not null\s+check \(seat_index between 1 and 3\)/i,
    );
  });

  it('NEGATIVE CONTROL: the cap-ceiling scan fires when the bound is widened', () => {
    const widened = migrationText.replace(
      'check (seat_index between 1 and 3)',
      'check (seat_index between 1 and 9)',
    );
    expect(/check \(seat_index between 1 and 3\)/i.test(migrationText)).toBe(true);
    expect(/check \(seat_index between 1 and 3\)/i.test(widened)).toBe(false);
  });
});

// ── the PARTIAL UNIQUE atomic cap guard (move_marks idiom) ───

describe('CHIMEIN-P8 — the atomic cap guard is a partial UNIQUE on active rows', () => {
  it('declares the partial UNIQUE (debate_id, seat_index) WHERE retracted_at is null (room-scope cap)', () => {
    expect(migrationText).toMatch(
      /create unique index if not exists chime_in_contributions_one_active_seat\s+on public\.chime_in_contributions \(debate_id, seat_index\)\s+where retracted_at is null/i,
    );
  });

  it('declares the one-active-per-argument partial UNIQUE (argument marked at most once)', () => {
    expect(migrationText).toMatch(
      /create unique index if not exists chime_in_contributions_one_active_per_argument\s+on public\.chime_in_contributions \(argument_id\)\s+where retracted_at is null/i,
    );
  });

  it('declares the two active partial + one argument index every reader filters on', () => {
    expect(migrationText).toMatch(
      /create index if not exists chime_in_contributions_debate_active_idx\s+on public\.chime_in_contributions \(debate_id\)\s+where retracted_at is null/i,
    );
    expect(migrationText).toMatch(
      /create index if not exists chime_in_contributions_target_active_idx\s+on public\.chime_in_contributions \(target_argument_id\)\s+where retracted_at is null/i,
    );
    expect(migrationText).toMatch(
      /create index if not exists chime_in_contributions_argument_idx\s+on public\.chime_in_contributions \(argument_id\)/i,
    );
  });

  it('NEGATIVE CONTROL: the room-scope cap scan fires if the UNIQUE key is changed to point-scope', () => {
    const pointScoped = migrationText.replace(
      'chime_in_contributions_one_active_seat\n  on public.chime_in_contributions (debate_id, seat_index)',
      'chime_in_contributions_one_active_seat\n  on public.chime_in_contributions (target_argument_id, seat_index)',
    );
    expect(
      /chime_in_contributions_one_active_seat\s+on public\.chime_in_contributions \(debate_id, seat_index\)/i.test(
        migrationText,
      ),
    ).toBe(true);
    expect(
      /chime_in_contributions_one_active_seat\s+on public\.chime_in_contributions \(debate_id, seat_index\)/i.test(
        pointScoped,
      ),
    ).toBe(false);
  });
});

// ── retracted_at latch (no hard-delete) + inert storage ──────

describe('CHIMEIN-P8 — retract-is-a-timestamp latch + inert storage', () => {
  it('declares retracted_at as a nullable timestamptz (retract = timestamp, never delete)', () => {
    expect(migrationText).toMatch(/retracted_at\s+timestamptz\s*(,|\n|\))/i);
    expect(migrationText).toMatch(/created_at\s+timestamptz\s+not null\s+default now\(\)/i);
  });

  it('ships NO point-standing / score / standing / node-state column (inert storage, anti-amplification)', () => {
    // Scan the executable SQL with comments AND string literals stripped: the
    // doctrine prose inside the comment-on literal legitimately says "NO score /
    // standing / node-state column", so only a real column occurrence must fail.
    const code = stripCommentsAndStringLiterals(migrationText);
    expect(code).not.toMatch(/\bscore\b/i);
    expect(code).not.toMatch(/\bstanding\b/i);
    expect(code).not.toMatch(/\bweight\b/i);
    expect(code).not.toMatch(/\bargument_type\b/i);
    expect(code).not.toMatch(/\bstatus\b/i);
    expect(code).not.toMatch(/broad_standing|narrow_standing|point_standing/i);
  });

  it('the four FK columns reference uuid PKs (Class 2 type parity)', () => {
    expect(migrationText).toMatch(/debate_id\s+uuid\s+not null references public\.debates\(id\)/i);
    expect(migrationText).toMatch(/argument_id\s+uuid\s+not null references public\.arguments\(id\)/i);
    expect(migrationText).toMatch(
      /target_argument_id\s+uuid\s+not null references public\.arguments\(id\)/i,
    );
    expect(migrationText).toMatch(/author_id\s+uuid\s+not null references public\.profiles\(id\)/i);
  });
});

// ── Class-4: pre-applied helper referenced, never redefined; no extension ──

describe('CHIMEIN-P8 — Class 4: references the pre-applied helper, defines nothing new', () => {
  it('does not redefine is_argument_visible_in_circle and creates no extension, but does reference the helper', () => {
    expect(migrationText).not.toMatch(
      /create\s+(or\s+replace\s+)?function\s+public\.is_argument_visible_in_circle/i,
    );
    expect(migrationText).not.toMatch(/create\s+extension/i);
    expect(migrationText).toMatch(/public\.is_argument_visible_in_circle\(/i);
  });
});

// ── doctrine ban-list ────────────────────────────────────────

describe('CHIMEIN-P8 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('the SELECT policy body contains no boolean/technical verdict token', () => {
    expect(containsAnyToken(usingBody(migrationText, CHIME_SELECT), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(
      false,
    );
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('room-visible read access', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
  });
});
