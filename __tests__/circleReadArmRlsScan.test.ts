/**
 * ASP-CIRCLES-RLS-001 (#882) — circle read-arm RLS text-scan (Docker-less lane).
 *
 * The migration wires the shipped-but-dormant SECURITY DEFINER helpers
 * (is_circle_member, is_argument_visible_in_circle from 20260702000001) into
 * the debates + arguments SELECT policies as two NEW permissive arms that
 * OR-compose with the canonical policies. Docker `db reset` is unavailable in
 * CI, so the migration text is the single chokepoint contract and this suite is
 * the fs.readFileSync scan over it (per docs/designs/ASP-CIRCLES-RLS-001.md §8).
 *
 * The load-bearing property is ADDITIVE-ONLY: the canonical policies must be
 * neither dropped nor re-created (Postgres unions permissive policies with OR,
 * so a new permissive arm can only WIDEN access), and the new arms must be
 * provably non-narrowing (debates: circle_id short-circuit first; arguments:
 * routes through the single composite helper, never re-inlined). Every scan
 * that guards a safety property is paired with a NEGATIVE CONTROL that plants
 * the violation and asserts the same scan fires — a scan that cannot fail is
 * not a test.
 *
 * Anchors left untouched (they scan OTHER, unmodified migrations):
 *   __tests__/circleRlsScan.test.ts, circleVisibilityCompositionRlsScan.test.ts,
 *   circleMigration.test.ts, debateInactiveCascadeRlsScan.test.ts.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const MIGRATION_FILENAME = '20260709000001_asp_circles_rls_001_circle_read_arm.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILENAME);

/** The net-live canonical SELECT policies (20260606000001) this card must NOT touch. */
const CANONICAL_DEBATES_POLICY =
  'debates: select active public-open, own, or participant; admins read all';
const CANONICAL_ARGUMENTS_POLICY =
  'arguments: select active for own/participant/public; active debate; admins read all';

const NEW_DEBATES_POLICY = 'debates_select_circle_member';
const NEW_ARGUMENTS_POLICY = 'arguments_select_circle_member';

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

// ── pure scan helpers (shared by real-text assertions AND negative controls) ──

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Numeric timestamp prefix of a `<ts>_<slug>.sql` migration filename. */
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

/** True if `text` DROPs one of the two canonical (pre-existing) SELECT policies. */
function dropsACanonicalPolicy(text: string): boolean {
  return (
    new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${escapeRe(CANONICAL_DEBATES_POLICY)}"`, 'i').test(text) ||
    new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${escapeRe(CANONICAL_ARGUMENTS_POLICY)}"`, 'i').test(text)
  );
}

/** True if `text` re-CREATEs one of the two canonical (pre-existing) SELECT policies. */
function recreatesACanonicalPolicy(text: string): boolean {
  return (
    new RegExp(`create\\s+policy\\s+"${escapeRe(CANONICAL_DEBATES_POLICY)}"`, 'i').test(text) ||
    new RegExp(`create\\s+policy\\s+"${escapeRe(CANONICAL_ARGUMENTS_POLICY)}"`, 'i').test(text)
  );
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
 * True if a policy USING body references a sensitive column WITHOUT a table
 * qualifier (`debates.` / `arguments.` / `d.` / `a.`). We detect qualification
 * by the leading `.`: every real reference in this migration is `<table>.<col>`,
 * so a bare occurrence (preceded by whitespace / operator) is the Class-1 hazard.
 */
function hasUnqualifiedSensitiveColumn(body: string): boolean {
  return /(?<!\.)\b(status|inactive_at|circle_id|visibility|debate_id)\b/.test(body);
}

// Person-labeling verdict tokens: NEVER legitimately present — full-text scan.
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

// Boolean/technical-ambiguous verdict tokens. The migration's safety-proof
// comments legitimately use boolean "FALSE" ("the arm is FALSE"), so a full-text
// scan for these would false-fire on machine-authored logic prose. Per doctrine
// the concern is user content / verdict LABELS, which can only enter via the
// policy predicate; we therefore scan these tokens ONLY inside the USING bodies.
const BOOLEAN_AMBIGUOUS_TOKENS = ['true', 'false', 'correct'];

function containsAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text));
}

// ── presence + numbering ─────────────────────────────────────

describe('ASP-CIRCLES-RLS-001 — file presence + numbering', () => {
  it('the migration exists at its locked path with non-empty content', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('its timestamp prefix is strictly greater than the circles migration (20260702000001)', () => {
    expect(timestampPrefix(MIGRATION_FILENAME)).toBeGreaterThan(20260702000001);
  });
});

describe('ASP-CIRCLES-RLS-001 — both new policies are SELECT-to-authenticated', () => {
  it('debates_select_circle_member is created FOR SELECT TO authenticated on public.debates', () => {
    expect(migrationText).toMatch(
      /create policy debates_select_circle_member\s+on public\.debates\s+for select\s+to authenticated/i,
    );
  });

  it('arguments_select_circle_member is created FOR SELECT TO authenticated on public.arguments', () => {
    expect(migrationText).toMatch(
      /create policy arguments_select_circle_member\s+on public\.arguments\s+for select\s+to authenticated/i,
    );
  });
});

// ── additive-only (THE load-bearing safety scan) ─────────────

describe('ASP-CIRCLES-RLS-001 — additive-only: canonical policies untouched', () => {
  it('does NOT drop the canonical debates SELECT policy', () => {
    expect(migrationText).not.toContain(`DROP POLICY IF EXISTS "${CANONICAL_DEBATES_POLICY}"`);
    expect(dropsACanonicalPolicy(migrationText)).toBe(false);
  });

  it('does NOT drop the canonical arguments SELECT policy', () => {
    expect(migrationText).not.toContain(`DROP POLICY IF EXISTS "${CANONICAL_ARGUMENTS_POLICY}"`);
    expect(dropsACanonicalPolicy(migrationText)).toBe(false);
  });

  it('does NOT re-create either canonical policy name', () => {
    expect(recreatesACanonicalPolicy(migrationText)).toBe(false);
  });

  it('the ONLY DROP POLICY statements target the two new names, on their matching tables', () => {
    const targets = dropPolicyTargets(migrationText);
    expect(targets).toEqual([
      { name: NEW_DEBATES_POLICY, table: 'public.debates' },
      { name: NEW_ARGUMENTS_POLICY, table: 'public.arguments' },
    ]);
  });

  it('NEGATIVE CONTROL: the additive-only scan fires when a canonical DROP is planted', () => {
    const planted = `${migrationText}\nDROP POLICY IF EXISTS "${CANONICAL_DEBATES_POLICY}" ON public.debates;\n`;
    expect(dropsACanonicalPolicy(migrationText)).toBe(false);
    expect(dropsACanonicalPolicy(planted)).toBe(true);
  });
});

// ── debates arm shape + short-circuit invariance ─────────────

describe('ASP-CIRCLES-RLS-001 — debates arm shape (happy path)', () => {
  it('the USING body matches the four ordered predicates from §3', () => {
    const body = usingBody(migrationText, NEW_DEBATES_POLICY);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /debates\.circle_id is not null[\s\S]*?and\s+debates\.visibility = 'private'[\s\S]*?and\s+debates\.inactive_at is null[\s\S]*?and\s+public\.is_circle_member\(debates\.circle_id, auth\.uid\(\)\)/i,
    );
  });

  it('the FIRST predicate is the circle_id short-circuit (precedes the is_circle_member call)', () => {
    const body = usingBody(migrationText, NEW_DEBATES_POLICY);
    const shortCircuitIdx = body.search(/debates\.circle_id is not null/i);
    const helperIdx = body.search(/public\.is_circle_member\(/i);
    expect(shortCircuitIdx).toBeGreaterThan(-1);
    expect(helperIdx).toBeGreaterThan(-1);
    expect(shortCircuitIdx).toBeLessThan(helperIdx);
  });

  it('NEGATIVE CONTROL: the short-circuit ordering scan fires when the order is reversed', () => {
    const reversed =
      "public.is_circle_member(debates.circle_id, auth.uid())\n    and debates.circle_id is not null";
    const scIdx = reversed.search(/debates\.circle_id is not null/i);
    const hIdx = reversed.search(/public\.is_circle_member\(/i);
    // In the reversed body the short-circuit no longer precedes the helper call.
    expect(scIdx).toBeGreaterThan(hIdx);
  });
});

// ── arguments arm shape + single-composition-point (no re-inline) ──

describe('ASP-CIRCLES-RLS-001 — arguments arm shape + no re-inline', () => {
  it('the USING body matches the four ordered predicates from §3', () => {
    const body = usingBody(migrationText, NEW_ARGUMENTS_POLICY);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toMatch(
      /arguments\.status = 'posted'[\s\S]*?and\s+arguments\.inactive_at is null[\s\S]*?and\s+not\s+public\.is_debate_inactive\(arguments\.debate_id\)[\s\S]*?and\s+public\.is_argument_visible_in_circle\(arguments\.id, auth\.uid\(\)\)/i,
    );
  });

  it('routes circle visibility through the composite helper: no direct is_circle_member, no raw debates subquery', () => {
    const body = usingBody(migrationText, NEW_ARGUMENTS_POLICY);
    expect(body).toMatch(/public\.is_argument_visible_in_circle\(/i);
    expect(body).not.toMatch(/is_circle_member/i);
    expect(body).not.toMatch(/select[\s\S]*?from\s+public\.debates/i);
  });

  it('NEGATIVE CONTROL: the no-inline scan fires when a raw `select ... from public.debates` is planted', () => {
    const real = usingBody(migrationText, NEW_ARGUMENTS_POLICY);
    const planted = `${real}\n    and exists (select 1 from public.debates d where d.id = arguments.debate_id)`;
    expect(/select[\s\S]*?from\s+public\.debates/i.test(real)).toBe(false);
    expect(/select[\s\S]*?from\s+public\.debates/i.test(planted)).toBe(true);
  });
});

// ── helper-reference correctness ─────────────────────────────

describe('ASP-CIRCLES-RLS-001 — helper reference correctness (all pre-applied, granted)', () => {
  it('debates arm references public.is_circle_member(debates.circle_id, auth.uid())', () => {
    expect(usingBody(migrationText, NEW_DEBATES_POLICY)).toMatch(
      /public\.is_circle_member\(debates\.circle_id, auth\.uid\(\)\)/i,
    );
  });

  it('arguments arm references public.is_debate_inactive + public.is_argument_visible_in_circle', () => {
    const body = usingBody(migrationText, NEW_ARGUMENTS_POLICY);
    expect(body).toMatch(/not public\.is_debate_inactive\(arguments\.debate_id\)/i);
    expect(body).toMatch(/public\.is_argument_visible_in_circle\(arguments\.id, auth\.uid\(\)\)/i);
  });
});

// ── OPS-001 four-class + doctrine pins ───────────────────────

describe('ASP-CIRCLES-RLS-001 — Class 1: every column ref is table-qualified', () => {
  it('neither USING body references a sensitive column without a table qualifier', () => {
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, NEW_DEBATES_POLICY))).toBe(false);
    expect(hasUnqualifiedSensitiveColumn(usingBody(migrationText, NEW_ARGUMENTS_POLICY))).toBe(false);
  });

  it('NEGATIVE CONTROL: the qualification scan fires on a planted bare column', () => {
    expect(hasUnqualifiedSensitiveColumn("arguments.status = 'posted'")).toBe(false);
    expect(hasUnqualifiedSensitiveColumn("and status = 'posted'")).toBe(true);
    expect(hasUnqualifiedSensitiveColumn('and circle_id is not null')).toBe(true);
  });
});

describe('ASP-CIRCLES-RLS-001 — Class 4 / D5: no helper edit, no new grant, no extension', () => {
  it('contains no create-or-replace function, no grant execute, no create extension', () => {
    expect(migrationText).not.toMatch(/create\s+or\s+replace\s+function/i);
    expect(migrationText).not.toMatch(/grant\s+execute/i);
    expect(migrationText).not.toMatch(/create\s+extension/i);
  });
});

describe('ASP-CIRCLES-RLS-001 — RLS-on + read-only invariance', () => {
  it('never disables RLS and adds no write-path policy', () => {
    expect(migrationText).not.toMatch(/disable\s+row\s+level\s+security/i);
    expect(migrationText).not.toMatch(/for\s+(insert|update|delete)/i);
  });

  it('drops no table and alters away no column', () => {
    expect(migrationText).not.toMatch(/drop\s+table/i);
    expect(migrationText).not.toMatch(/alter\s+table[\s\S]*?drop\b/i);
  });
});

describe('ASP-CIRCLES-RLS-001 — doctrine ban-list (no verdict labels)', () => {
  it('contains no person-labeling verdict token anywhere in the migration text', () => {
    expect(containsAnyToken(migrationText, PERSON_LABEL_TOKENS)).toBe(false);
  });

  it('neither USING policy body contains a boolean/technical verdict token', () => {
    // "FALSE" appears legitimately in the machine-authored safety-proof comments;
    // the doctrinally meaningful surface is the predicate body, which is clean.
    expect(containsAnyToken(usingBody(migrationText, NEW_DEBATES_POLICY), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
    expect(containsAnyToken(usingBody(migrationText, NEW_ARGUMENTS_POLICY), BOOLEAN_AMBIGUOUS_TOKENS)).toBe(false);
  });

  it('NEGATIVE CONTROL: the ban-list scan fires when a verdict token is planted', () => {
    expect(containsAnyToken('read access for members', PERSON_LABEL_TOKENS)).toBe(false);
    expect(containsAnyToken('marks the manipulative party', PERSON_LABEL_TOKENS)).toBe(true);
    expect(containsAnyToken("and arguments.status = 'false'", BOOLEAN_AMBIGUOUS_TOKENS)).toBe(true);
  });
});
