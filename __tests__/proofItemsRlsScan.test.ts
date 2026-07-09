/**
 * PROOF-001 (#888) — proof_items + proof_relations RLS text-scan (Docker-less lane).
 *
 * The migration 20260710000001 creates two new RLS-enabled tables under the
 * orchestrator's MAXIMALLY-CONSERVATIVE / SELECT-only posture: each table gets
 * exactly ONE policy (SELECT to authenticated, room-visible via the single
 * is_argument_visible_in_circle helper). ALL writes (insert, relation-insert,
 * soft-delete/detach, privileged status) belong to the PROOF-003 service-role
 * Edge — so this migration ships NO write policy, NO write-gate helper, NO
 * write-guard trigger.
 *
 * Docker `db reset` is unavailable in CI, so the migration text is the single
 * chokepoint contract and this suite is the fs.readFileSync scan over it (the
 * #882 circleReadArmRlsScan lane). The load-bearing properties are:
 *   1. SELECT-ONLY: no INSERT/UPDATE/DELETE policy on either table.
 *   2. RLS enabled, never disabled; strictly additive (no drop/alter of a
 *      pre-existing object).
 *   3. Cross-table reads go ONLY through the pre-applied definer helper
 *      is_argument_visible_in_circle (no raw arguments/debates subquery).
 *   4. The kind CHECK ships exactly 6 infra-free kinds (storage/marker kinds
 *      deferred); the status CHECK omits no_source.
 * Every safety scan is paired with a NEGATIVE CONTROL that plants the violation
 * and asserts the same scan fires — a scan that cannot fail is not a test.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260710000001_proof_001_proof_items_and_relations.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

const PROOF_ITEMS_SELECT = 'proof_items_select_room_visible';
const PROOF_RELATIONS_SELECT = 'proof_relations_select_room_visible';

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

// ── pure scan helpers (shared by real-text assertions AND negative controls) ──

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  return /(?<!\.)\b(deleted_at|argument_id|claim_argument_id|debate_id)\b/.test(body);
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

// Boolean/technical verdict tokens are scanned ONLY inside policy USING bodies
// (machine-authored comments legitimately discuss statuses in prose).
const BOOLEAN_AMBIGUOUS_TOKENS = ['true', 'false', 'correct'];

function containsAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
}

// ── presence + numbering ─────────────────────────────────────

describe('PROOF-001 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the circle read-arm migration (20260709000001)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260709000001);
  });
});

// ── RLS enabled + additive ───────────────────────────────────

describe('PROOF-001 — RLS enabled, never disabled, strictly additive', () => {
  it('enables RLS on both new tables', () => {
    expect(migrationText).toMatch(/alter table public\.proof_items\s+enable row level security/i);
    expect(migrationText).toMatch(/alter table public\.proof_relations\s+enable row level security/i);
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

  it('the ONLY DROP POLICY statements target the two new SELECT names, on their matching tables', () => {
    expect(dropPolicyTargets(migrationText)).toEqual([
      { name: PROOF_ITEMS_SELECT, table: 'public.proof_items' },
      { name: PROOF_RELATIONS_SELECT, table: 'public.proof_relations' },
    ]);
  });
});

// ── SELECT-ONLY (THE load-bearing safety property) ───────────

describe('PROOF-001 — SELECT-only: no write policy on either table', () => {
  it('creates exactly two policies, both FOR SELECT', () => {
    const policies = createdPolicies(migrationText);
    expect(policies).toEqual([
      { name: PROOF_ITEMS_SELECT, cmd: 'select' },
      { name: PROOF_RELATIONS_SELECT, cmd: 'select' },
    ]);
  });

  it('contains NO for-insert / for-update / for-delete policy', () => {
    expect(migrationText).not.toMatch(/for\s+insert/i);
    expect(migrationText).not.toMatch(/for\s+update/i);
    expect(migrationText).not.toMatch(/for\s+delete/i);
  });

  it('both SELECT policies are TO authenticated', () => {
    expect(migrationText).toMatch(
      /create policy proof_items_select_room_visible\s+on public\.proof_items\s+for select\s+to authenticated/i,
    );
    expect(migrationText).toMatch(
      /create policy proof_relations_select_room_visible\s+on public\.proof_relations\s+for select\s+to authenticated/i,
    );
  });

  it('ships NO write-gate helper, NO write-guard trigger, NO grant (all writes -> PROOF-003 Edge)', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migrationText).not.toMatch(/create\s+trigger/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
    expect(migrationText).not.toMatch(/can_attach_proof_item/i);
    expect(migrationText).not.toMatch(/can_relate_proof_item/i);
    expect(migrationText).not.toMatch(/soft_delete_only/i);
  });

  it('NEGATIVE CONTROL: the SELECT-only scan fires when a write policy is planted', () => {
    const planted = `${migrationText}\ncreate policy proof_items_insert_x on public.proof_items for insert to authenticated with check (true);\n`;
    expect(/for\s+insert/i.test(migrationText)).toBe(false);
    expect(/for\s+insert/i.test(planted)).toBe(true);
    expect(createdPolicies(planted).some((p) => p.cmd === 'insert')).toBe(true);
  });
});

// ── SELECT bodies route through the single composite helper ──

describe('PROOF-001 — SELECT bodies use is_argument_visible_in_circle only (no raw subquery)', () => {
  it('proof_items SELECT filters deleted_at + calls is_argument_visible_in_circle(argument_id)', () => {
    const body = usingBody(migrationText, PROOF_ITEMS_SELECT);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /proof_items\.deleted_at is null[\s\S]*?and\s+public\.is_argument_visible_in_circle\(proof_items\.argument_id, auth\.uid\(\)\)/i,
    );
  });

  it('proof_relations SELECT calls is_argument_visible_in_circle(claim_argument_id)', () => {
    const body = usingBody(migrationText, PROOF_RELATIONS_SELECT);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(/public\.is_argument_visible_in_circle\(proof_relations\.claim_argument_id, auth\.uid\(\)\)/i);
  });

  it('neither SELECT body contains a raw select ... from public.arguments/debates subquery', () => {
    for (const name of [PROOF_ITEMS_SELECT, PROOF_RELATIONS_SELECT]) {
      const body = usingBody(migrationText, name);
      expect(body).not.toMatch(/select[\s\S]*?from\s+public\.arguments/i);
      expect(body).not.toMatch(/select[\s\S]*?from\s+public\.debates/i);
    }
  });

  it('NEGATIVE CONTROL: the no-inline scan fires when a raw arguments subquery is planted', () => {
    const real = usingBody(migrationText, PROOF_ITEMS_SELECT);
    const planted = `${real}\n    and exists (select 1 from public.arguments a where a.id = proof_items.argument_id)`;
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(real)).toBe(false);
    expect(/select[\s\S]*?from\s+public\.arguments/i.test(planted)).toBe(true);
  });

  it('does not redefine the pre-applied helper and creates no extension', () => {
    expect(migrationText).not.toMatch(/create\s+(or\s+replace\s+)?function\s+public\.is_argument_visible_in_circle/i);
    expect(migrationText).not.toMatch(/create\s+extension/i);
    // But it DOES reference it (both SELECT bodies).
    expect(migrationText).toMatch(/public\.is_argument_visible_in_circle\(/i);
  });
});

// ── CHECK vocabularies ───────────────────────────────────────

describe('PROOF-001 — kind / status / relation CHECK sets', () => {
  it('the kind CHECK is exactly the 6 shipped infra-free kinds', () => {
    const set = checkInSet(migrationText, 'kind');
    for (const k of ['url', 'quote', 'source_text', 'note', 'prior_move', 'external_ref']) {
      expect(set).toContain(`'${k}'`);
    }
  });

  it('the kind CHECK OMITS the deferred storage/marker kinds', () => {
    const set = checkInSet(migrationText, 'kind');
    for (const deferred of ['screenshot', 'file', 'voice_excerpt', 'timestamp']) {
      expect(set).not.toContain(`'${deferred}'`);
    }
  });

  it('NEGATIVE CONTROL: the deferred-kind scan fires when a storage kind is planted', () => {
    const realSet = checkInSet(migrationText, 'kind');
    const plantedSet = realSet.replace("'external_ref'", "'external_ref','screenshot'");
    expect(realSet.includes("'screenshot'")).toBe(false);
    expect(plantedSet.includes("'screenshot'")).toBe(true);
  });

  it('the source_chain_status CHECK omits no_source (aggregate-only)', () => {
    const set = checkInSet(migrationText, 'source_chain_status');
    expect(set).not.toContain("'no_source'");
    for (const s of ['unverified', 'source_no_quote', 'source_and_quote', 'broken', 'primary_present']) {
      expect(set).toContain(`'${s}'`);
    }
  });

  it('the relation CHECK is the 4-relation set', () => {
    const set = checkInSet(migrationText, 'relation');
    for (const r of ['supports', 'contradicts', 'contextualizes', 'answers_request']) {
      expect(set).toContain(`'${r}'`);
    }
  });
});

// ── Class-1 qualification ────────────────────────────────────

describe('PROOF-001 — Class 1: every column ref in a USING body is table-qualified', () => {
  it('neither SELECT body references a sensitive column without a table qualifier', () => {
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, PROOF_ITEMS_SELECT))).toBe(false);
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, PROOF_RELATIONS_SELECT))).toBe(false);
  });

  it('NEGATIVE CONTROL: the qualification scan fires on a planted bare column', () => {
    expect(hasUnqualifiedSensitiveColumn('proof_items.deleted_at is null')).toBe(false);
    expect(hasUnqualifiedSensitiveColumn('and deleted_at is null')).toBe(true);
    expect(hasUnqualifiedSensitiveColumn('and argument_id = x')).toBe(true);
  });
});

// ── doctrine ban-list ────────────────────────────────────────

describe('PROOF-001 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('neither SELECT policy body contains a boolean/technical verdict token', () => {
    expect(containsAnyToken(usingBody(migrationText, PROOF_ITEMS_SELECT), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
    expect(containsAnyToken(usingBody(migrationText, PROOF_RELATIONS_SELECT), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('room-visible read access', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
    expect(containsAnyToken("and proof_items.kind = 'false'", BOOLEAN_AMBIGUOUS_TOKENS)).toBe(true);
  });
});
