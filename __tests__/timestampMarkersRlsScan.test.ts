/**
 * MARK-001 (#893) — timestamp_markers + proof_items.marker_id RLS text-scan
 * (Docker-less lane).
 *
 * The migration 20260711000001 creates ONE new RLS-enabled table under the
 * MAXIMALLY-CONSERVATIVE / SELECT-only posture (the circles #859 + PROOF-001
 * #888 precedent): the table gets exactly ONE policy (SELECT to authenticated,
 * room-visible via the single is_argument_visible_in_circle helper). ALL writes
 * (insert, soft-delete/retract) belong to the MARK-002 service-role Edge, which
 * snapshots quoted_text VERBATIM from arguments.body server-side so the quote
 * cannot be client-forged (the Output 13 Q5 misrepresentation mitigation) — so
 * this migration ships NO write policy, NO write-gate helper, NO write-guard
 * trigger. It also ALTERs public.proof_items to ADD the PROOF-001-deferred
 * marker_id FK (nullable, on delete set null), with NO proof_items.kind widening.
 *
 * Docker db reset is unavailable in CI, so the migration text is the single
 * chokepoint contract and this suite is the fs.readFileSync scan over it (the
 * #882 / #888 lane, mirroring proofItemsRlsScan.test.ts). The load-bearing
 * properties are:
 *   1. SELECT-ONLY: no INSERT/UPDATE/DELETE policy on the new table.
 *   2. RLS enabled, never disabled; strictly additive (no drop/alter-away of a
 *      pre-existing object); the only schema-mutating ALTER is the additive
 *      proof_items.marker_id ADD COLUMN.
 *   3. The SELECT body reads cross-table state ONLY through the pre-applied
 *      definer helper is_argument_visible_in_circle (no raw arguments/debates
 *      subquery).
 *   4. Span shape: span_unit CHECK is exactly ('chars') — the P5 voice ('ms')
 *      lane is deferred; recording_id is absent; quoted_text is NOT NULL.
 *   5. kind CHECK is exactly ('rebuttal_anchor','note') — proof_excerpt deferred.
 *   6. proof_items.marker_id ships as an additive nullable FK with NO kind widening.
 * Every safety scan is paired with a NEGATIVE CONTROL that plants the violation
 * and asserts the same scan fires — a scan that cannot fail is not a test.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260711000001_mark_001_timestamp_markers.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

const MARKER_SELECT = 'timestamp_markers_select_room_visible';

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

// ── pure scan helpers (shared by real-text assertions AND negative controls) ──

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The migration with SQL line-comments (`-- ...`) stripped, so a whole-text
 *  scan tests the executable SQL and not the explanatory prose. (The header
 *  comment names recording_id when it documents the P5 deferral, so a raw
 *  whole-text scan would false-fire on the prose that proves it is deferred.) */
function stripSqlComments(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
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
 * `<table>:<first one-or-two verb words>`. Distinguishes the RLS-lifecycle ALTER
 * (enable row) from the schema-mutating one (add column).
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
  return /(?<!\.)\b(deleted_at|target_argument_id|debate_id)\b/.test(body);
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

describe('MARK-001 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the PROOF-001 migration (20260710000001)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260710000001);
  });
});

// ── RLS enabled + additive ───────────────────────────────────

describe('MARK-001 — RLS enabled, never disabled, strictly additive', () => {
  it('enables RLS on the new timestamp_markers table', () => {
    expect(migrationText).toMatch(
      /alter table public\.timestamp_markers\s+enable row level security/i,
    );
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

  it('the only schema-mutating ALTER TABLE is the additive proof_items ADD COLUMN marker_id', () => {
    // Two ALTER TABLE statements exist: the RLS-lifecycle enable on the new
    // table, and the additive column add on proof_items. Neither is a drop.
    expect(alterTableVerbs(migrationText)).toEqual([
      'timestamp_markers:enable row',
      'proof_items:add column',
    ]);
    expect(migrationText).toMatch(
      /alter table public\.proof_items\s+add column if not exists marker_id/i,
    );
  });

  it('the ONLY DROP POLICY statement targets the new SELECT name on public.timestamp_markers', () => {
    expect(dropPolicyTargets(migrationText)).toEqual([
      { name: MARKER_SELECT, table: 'public.timestamp_markers' },
    ]);
  });

  it('NEGATIVE CONTROL: the additive scan fires when a drop column is planted', () => {
    const planted = `${migrationText}\nalter table public.timestamp_markers drop column quoted_text;\n`;
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(migrationText)).toBe(false);
    expect(/alter\s+table\s+\S+\s+drop\b/i.test(planted)).toBe(true);
  });
});

// ── SELECT-ONLY (THE load-bearing safety property) ───────────

describe('MARK-001 — SELECT-only: no write policy on the new table', () => {
  it('creates exactly ONE policy, FOR SELECT', () => {
    expect(createdPolicies(migrationText)).toEqual([{ name: MARKER_SELECT, cmd: 'select' }]);
  });

  it('contains NO for-insert / for-update / for-delete policy', () => {
    expect(migrationText).not.toMatch(/for\s+insert/i);
    expect(migrationText).not.toMatch(/for\s+update/i);
    expect(migrationText).not.toMatch(/for\s+delete/i);
  });

  it('the SELECT policy is TO authenticated', () => {
    expect(migrationText).toMatch(
      /create policy timestamp_markers_select_room_visible\s+on public\.timestamp_markers\s+for select\s+to authenticated/i,
    );
  });

  it('ships NO write-gate helper, NO write-guard trigger, NO grant (all writes -> MARK-002 Edge)', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migrationText).not.toMatch(/create\s+trigger/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
  });

  it('NEGATIVE CONTROL: the SELECT-only scan fires when a write policy is planted', () => {
    const planted = `${migrationText}\ncreate policy timestamp_markers_insert_x on public.timestamp_markers for insert to authenticated with check (true);\n`;
    expect(/for\s+insert/i.test(migrationText)).toBe(false);
    expect(/for\s+insert/i.test(planted)).toBe(true);
    expect(createdPolicies(planted).some((p) => p.cmd === 'insert')).toBe(true);
  });
});

// ── SELECT body routes through the single composite helper ──

describe('MARK-001 — SELECT body uses is_argument_visible_in_circle only (no raw subquery)', () => {
  it('the SELECT body filters deleted_at + calls is_argument_visible_in_circle(target_argument_id)', () => {
    const body = usingBody(migrationText, MARKER_SELECT);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /timestamp_markers\.deleted_at is null[\s\S]*?and\s+public\.is_argument_visible_in_circle\(timestamp_markers\.target_argument_id, auth\.uid\(\)\)/i,
    );
  });

  it('the SELECT body contains no raw select ... from public.arguments/debates subquery', () => {
    const body = usingBody(migrationText, MARKER_SELECT);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.arguments/i);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.debates/i);
  });

  it('NEGATIVE CONTROL: the no-inline scan fires when a raw arguments subquery is planted', () => {
    const real = usingBody(migrationText, MARKER_SELECT);
    const planted = `${real}\n    and exists (select 1 from public.arguments a where a.id = timestamp_markers.target_argument_id)`;
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(real)).toBe(false);
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(planted)).toBe(true);
  });
});

// ── span shape (span_unit chars-only, span_end > span_start, quoted_text NOT NULL) ──

describe('MARK-001 — span shape (text-first; P5 voice lane deferred)', () => {
  it('the span_unit CHECK set is exactly (chars)', () => {
    const set = checkInSet(migrationText, 'span_unit');
    expect(set.replace(/\s/g, '')).toBe("'chars'");
  });

  it('the span_unit CHECK omits the deferred voice ms value', () => {
    expect(checkInSet(migrationText, 'span_unit')).not.toContain("'ms'");
  });

  it('NEGATIVE CONTROL: the chars-only scan fires when ms is planted into the span_unit CHECK', () => {
    const realSet = checkInSet(migrationText, 'span_unit');
    const plantedSet = realSet.replace("'chars'", "'chars','ms'");
    expect(realSet.includes("'ms'")).toBe(false);
    expect(plantedSet.includes("'ms'")).toBe(true);
  });

  it('declares the non-empty-span CHECK (span_end > span_start)', () => {
    expect(migrationText).toMatch(/check \(span_end > span_start\)/i);
  });

  it('declares quoted_text NOT NULL (the durable verbatim artifact)', () => {
    expect(migrationText).toMatch(/quoted_text\s+text\s+not null/i);
  });

  it('does NOT ship the P5-deferred recording_id column (absent from the executable SQL)', () => {
    // recording_id is named in the header comment (documenting the P5 deferral),
    // so the meaningful scan is over the comment-stripped SQL: no column exists.
    expect(stripSqlComments(migrationText)).not.toMatch(/recording_id/i);
  });

  it('NEGATIVE CONTROL: the recording_id-absent scan fires when the column is planted', () => {
    const code = stripSqlComments(migrationText);
    const planted = `${code}\n  recording_id uuid references public.audio_submissions(id),`;
    expect(/recording_id/i.test(code)).toBe(false);
    expect(/recording_id/i.test(planted)).toBe(true);
  });
});

// ── kind vocabulary (rebuttal_anchor/note; proof_excerpt deferred) ──

describe('MARK-001 — kind CHECK set', () => {
  it('the kind CHECK is exactly (rebuttal_anchor, note)', () => {
    const set = checkInSet(migrationText, 'kind');
    expect(set.replace(/\s/g, '')).toBe("'rebuttal_anchor','note'");
  });

  it('the kind CHECK omits the deferred proof_excerpt value', () => {
    expect(checkInSet(migrationText, 'kind')).not.toContain("'proof_excerpt'");
  });

  it('NEGATIVE CONTROL: the deferred-kind scan fires when proof_excerpt is planted', () => {
    const realSet = checkInSet(migrationText, 'kind');
    const plantedSet = realSet.replace("'note'", "'note','proof_excerpt'");
    expect(realSet.includes("'proof_excerpt'")).toBe(false);
    expect(plantedSet.includes("'proof_excerpt'")).toBe(true);
  });
});

// ── proof_items.marker_id ALTER (the PROOF-001 deferral; no kind widening) ──

describe('MARK-001 — proof_items.marker_id additive FK, no kind widening', () => {
  it('adds marker_id uuid referencing public.timestamp_markers(id) on delete set null', () => {
    expect(migrationText).toMatch(
      /alter table public\.proof_items\s+add column if not exists marker_id uuid references public\.timestamp_markers\(id\) on delete set null/i,
    );
  });

  it('adds the partial index proof_items_marker (marker_id is not null)', () => {
    expect(migrationText).toMatch(
      /create index if not exists proof_items_marker\s+on public\.proof_items \(marker_id\) where marker_id is not null/i,
    );
  });

  it('does NOT widen the proof_items.kind CHECK (no voice-proof / storage kinds; no second kind CHECK)', () => {
    // The only `check (kind in ...)` in the file is the timestamp_markers one.
    const kindChecks = migrationText.match(/check \(kind in/gi) ?? [];
    expect(kindChecks).toHaveLength(1);
    // The deferred proof kinds never appear as CHECK literals anywhere.
    expect(migrationText).not.toContain("'voice_excerpt'");
    expect(migrationText).not.toContain("'timestamp'");
    expect(migrationText).not.toContain("'screenshot'");
  });

  it('NEGATIVE CONTROL: the no-kind-widening scan fires when a voice-proof kind is planted', () => {
    const planted = `${migrationText}\nalter table public.proof_items drop constraint proof_items_kind_check, add check (kind in ('url','voice_excerpt'));\n`;
    expect(migrationText.includes("'voice_excerpt'")).toBe(false);
    expect(planted.includes("'voice_excerpt'")).toBe(true);
    expect((planted.match(/check \(kind in/gi) ?? []).length).toBeGreaterThan(1);
  });
});

// ── Class-1 qualification ────────────────────────────────────

describe('MARK-001 — Class 1: every column ref in the USING body is table-qualified', () => {
  it('the SELECT body references no sensitive column without a table qualifier', () => {
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, MARKER_SELECT))).toBe(false);
  });

  it('NEGATIVE CONTROL: the qualification scan fires on a planted bare column', () => {
    expect(hasUnqualifiedSensitiveColumn('timestamp_markers.deleted_at is null')).toBe(false);
    expect(hasUnqualifiedSensitiveColumn('and deleted_at is null')).toBe(true);
    expect(hasUnqualifiedSensitiveColumn('and target_argument_id = x')).toBe(true);
  });
});

// ── Class-4: pre-applied helper referenced, never redefined; no extension ──

describe('MARK-001 — Class 4: references the pre-applied helper, defines nothing new', () => {
  it('does not redefine is_argument_visible_in_circle and creates no extension, but does reference the helper', () => {
    expect(migrationText).not.toMatch(
      /create\s+(or\s+replace\s+)?function\s+public\.is_argument_visible_in_circle/i,
    );
    expect(migrationText).not.toMatch(/create\s+extension/i);
    expect(migrationText).toMatch(/public\.is_argument_visible_in_circle\(/i);
  });
});

// ── doctrine ban-list ────────────────────────────────────────

describe('MARK-001 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('the SELECT policy body contains no boolean/technical verdict token', () => {
    expect(containsAnyToken(usingBody(migrationText, MARKER_SELECT), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(
      false,
    );
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('room-visible read access', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
    expect(containsAnyToken("and timestamp_markers.kind = 'false'", BOOLEAN_AMBIGUOUS_TOKENS)).toBe(
      true,
    );
  });
});
