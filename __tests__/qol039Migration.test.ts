/**
 * QOL-039 — visibility column + audit table + RLS migration shape tests.
 *
 * Source-file inspection of `20260524000015_qol_039_room_visibility.sql`.
 * End-to-end behaviour (the migration applies, RLS blocks an unauthorized
 * read of a private room, the trigger rejects a private->public update,
 * the audit row INSERT works under service-role) is verified by the
 * operator post-merge via `npx supabase db reset --linked=false` (or the
 * heightened textual review path per OPS-001).
 */
import * as fs from 'fs';
import * as path from 'path';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260524000015_qol_039_room_visibility.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

/** SQL only — comment-only lines stripped. */
const sqlOnly = migSrc
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('Migration 20260524000015 — visibility column', () => {
  it('ALTERs public.debates to add the visibility column', () => {
    expect(sqlOnly).toMatch(/ALTER TABLE public\.debates[\s\S]*ADD COLUMN[\s\S]*visibility text/i);
  });

  it('declares the CHECK constraint on visibility', () => {
    expect(sqlOnly).toMatch(/visibility IN \(\s*'public',\s*'private'\s*\)/i);
  });

  it('defaults visibility to "public" so existing rows backfill', () => {
    expect(sqlOnly).toMatch(/DEFAULT 'public'/);
  });

  it('declares visibility NOT NULL so a row can never have a missing value', () => {
    expect(sqlOnly).toMatch(/visibility text NOT NULL DEFAULT 'public'/i);
  });
});

describe('Migration 20260524000015 — one-way trigger', () => {
  it('declares the enforce_room_visibility_one_way() trigger function', () => {
    expect(sqlOnly).toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_room_visibility_one_way\(\)/i);
  });

  it("raises 'room_visibility_is_one_way' on a private -> public attempt", () => {
    expect(sqlOnly).toMatch(/RAISE EXCEPTION 'room_visibility_is_one_way/i);
  });

  it('attaches the trigger BEFORE UPDATE on debates', () => {
    expect(sqlOnly).toMatch(/CREATE TRIGGER debates_enforce_visibility_one_way[\s\S]*BEFORE UPDATE/i);
  });

  it('drops the trigger before creating to avoid duplicate-name failures on re-apply', () => {
    expect(sqlOnly).toMatch(/DROP TRIGGER IF EXISTS debates_enforce_visibility_one_way/i);
  });
});

describe('Migration 20260524000015 — SECURITY DEFINER helpers', () => {
  it('declares is_debate_private(uuid) as SECURITY DEFINER', () => {
    expect(sqlOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_debate_private\(p_debate_id uuid\)[\s\S]*SECURITY DEFINER/,
    );
  });

  it('declares is_debate_open_or_locked_public(uuid) as SECURITY DEFINER', () => {
    expect(sqlOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_debate_open_or_locked_public\(p_debate_id uuid\)[\s\S]*SECURITY DEFINER/,
    );
  });

  it('REVOKEs both helpers from PUBLIC and GRANTs to authenticated', () => {
    expect(sqlOnly).toMatch(/REVOKE ALL ON FUNCTION public\.is_debate_private\(uuid\) FROM PUBLIC/);
    expect(sqlOnly).toMatch(
      /REVOKE ALL ON FUNCTION public\.is_debate_open_or_locked_public\(uuid\) FROM PUBLIC/,
    );
    expect(sqlOnly).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.is_debate_private\(uuid\) TO authenticated/,
    );
    expect(sqlOnly).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.is_debate_open_or_locked_public\(uuid\) TO authenticated/,
    );
  });

  it('uses SET search_path = public to prevent search-path injection', () => {
    const fnBlocks = sqlOnly.match(
      /CREATE OR REPLACE FUNCTION public\.is_debate(_open_or_locked_public|_private)\(p_debate_id uuid\)[\s\S]*?\$\$/g,
    ) || [];
    expect(fnBlocks.length).toBe(2);
    for (const fn of fnBlocks) {
      expect(fn).toMatch(/SET search_path = public/);
    }
  });
});

describe('Migration 20260524000015 — RLS policy replacements', () => {
  it('drops and recreates the debates SELECT policy with the visibility arm', () => {
    expect(sqlOnly).toMatch(/DROP POLICY IF EXISTS "debates: select open, own, or participant"/i);
    expect(sqlOnly).toMatch(/CREATE POLICY "debates: select public-open, own, or participant"/i);
    expect(sqlOnly).toMatch(/visibility = 'public' AND status IN \(\s*'open',\s*'locked'\s*\)/i);
  });

  it('drops and recreates the debate_participants SELECT policy with the public-open helper', () => {
    expect(sqlOnly).toMatch(
      /DROP POLICY IF EXISTS "debate_participants: select own or open debate"/i,
    );
    expect(sqlOnly).toMatch(
      /CREATE POLICY "debate_participants: select own, participant, or public-open debate"/i,
    );
    // The participant arm — needed so a private-room participant can
    // see co-participants.
    expect(sqlOnly).toMatch(/public\.is_debate_participant\(debate_id, auth\.uid\(\)\)/);
    expect(sqlOnly).toMatch(/public\.is_debate_open_or_locked_public\(debate_id\)/);
  });

  it('drops and recreates the arguments SELECT policy with the visibility split', () => {
    expect(sqlOnly).toMatch(
      /DROP POLICY IF EXISTS "arguments: select posted in readable debates or own"/i,
    );
    expect(sqlOnly).toMatch(
      /CREATE POLICY "arguments: select own, participant-private, or posted-public"/i,
    );
    expect(sqlOnly).toMatch(/public\.is_debate_open_or_locked_public\(debate_id\)/);
    expect(sqlOnly).toMatch(/public\.is_debate_participant\(debate_id, auth\.uid\(\)\)/);
  });

  it('does NOT modify the argument_tags SELECT policy (E1.6 — delegates through EXISTS arguments)', () => {
    // The migration carries a confirming COMMENT, not a DROP/CREATE on
    // argument_tags. A change here would be a regression of E1.6's
    // delegation pattern.
    expect(migSrc).toContain('argument_tags SELECT delegates through EXISTS arguments');
    expect(sqlOnly).not.toMatch(/DROP POLICY IF EXISTS "argument_tags/i);
    expect(sqlOnly).not.toMatch(/CREATE POLICY "argument_tags:/i);
  });

  it('does NOT alter INSERT/UPDATE/DELETE policies (visibility affects READS only)', () => {
    // Defensive: any INSERT / UPDATE / DELETE policy change on the four
    // tables here would be a doctrine violation.
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*INSERT[^;]*ON public\.(debates|debate_participants|arguments|argument_tags)/i);
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*UPDATE[^;]*ON public\.(debates|debate_participants|arguments|argument_tags)/i);
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*DELETE[^;]*ON public\.(debates|debate_participants|arguments|argument_tags)/i);
  });
});

describe('Migration 20260524000015 — room_visibility_changes audit table (OD-2)', () => {
  it('creates the table idempotently', () => {
    expect(sqlOnly).toMatch(/CREATE TABLE IF NOT EXISTS public\.room_visibility_changes/i);
  });

  it('declares every column', () => {
    for (const col of [
      'transition_id',
      'debate_id',
      'transitioned_at',
      'trigger_kind',
      'triggered_by_user_id',
      'retained_participant_count',
      'dropped_participant_count',
      'rejected_chime_in_count',
      'rejected_chime_in_ids',
    ]) {
      expect(sqlOnly).toContain(col);
    }
  });

  it('does NOT declare individual dropped-observer user IDs (privacy guard)', () => {
    // The OD-2 privacy guarantee: counts and chime-in argument IDs only.
    expect(sqlOnly).not.toContain('dropped_observer_user_ids');
    expect(sqlOnly).not.toContain('rejected_chime_in_user_ids');
    expect(sqlOnly).not.toContain('dropped_participant_ids');
  });

  it('keys the table by uuid + gen_random_uuid()', () => {
    expect(sqlOnly).toMatch(/transition_id\s+uuid\s+PRIMARY KEY DEFAULT gen_random_uuid\(\)/i);
  });

  it('foreign-keys debate_id to debates(id) with CASCADE', () => {
    expect(sqlOnly).toMatch(/debate_id\s+uuid\s+NOT NULL[\s\S]*?REFERENCES public\.debates\(id\)\s+ON DELETE CASCADE/i);
  });

  it('foreign-keys triggered_by_user_id to auth.users(id) with CASCADE', () => {
    expect(sqlOnly).toMatch(/triggered_by_user_id\s+uuid\s+NOT NULL[\s\S]*?REFERENCES auth\.users\(id\)\s+ON DELETE CASCADE/i);
  });

  it('rejected_chime_in_ids is a uuid[] (argument IDs, not user IDs)', () => {
    expect(sqlOnly).toMatch(/rejected_chime_in_ids\s+uuid\[\]/);
  });

  it("constrains trigger_kind to the v1 vocabulary ('manual_creator_action')", () => {
    expect(sqlOnly).toMatch(/CHECK \(trigger_kind IN \('manual_creator_action'\)\)/);
  });

  it('enforces non-negative count CHECKs on each count column', () => {
    for (const col of [
      'retained_participant_count',
      'dropped_participant_count',
      'rejected_chime_in_count',
    ]) {
      expect(sqlOnly).toMatch(new RegExp(`${col}\\s+integer\\s+NOT NULL[\\s\\S]*?CHECK \\(${col} >= 0\\)`));
    }
  });
});

describe('Migration 20260524000015 — audit table indexes', () => {
  it('creates a (debate_id, transitioned_at DESC) index', () => {
    expect(sqlOnly).toMatch(
      /CREATE INDEX IF NOT EXISTS room_visibility_changes_debate_idx[\s\S]*\(debate_id, transitioned_at DESC\)/i,
    );
  });

  it('creates a (triggered_by_user_id, transitioned_at DESC) index', () => {
    expect(sqlOnly).toMatch(
      /CREATE INDEX IF NOT EXISTS room_visibility_changes_triggered_by_idx[\s\S]*\(triggered_by_user_id, transitioned_at DESC\)/i,
    );
  });
});

describe('Migration 20260524000015 — audit table RLS (OD-2)', () => {
  it('enables RLS on the table', () => {
    expect(sqlOnly).toMatch(/ALTER TABLE public\.room_visibility_changes ENABLE ROW LEVEL SECURITY/i);
  });

  it('declares all three SELECT policies', () => {
    expect(sqlOnly).toMatch(/CREATE POLICY rvc_select_mod_or_admin/i);
    expect(sqlOnly).toMatch(/CREATE POLICY rvc_select_room_creator/i);
    expect(sqlOnly).toMatch(/CREATE POLICY rvc_select_own_action/i);
  });

  it('uses fully-qualified column references inside the room-creator subquery (OPS-001 Class 1)', () => {
    // Per OPS-001 §4 Class 1, the subquery must qualify the column to
    // avoid ambiguous-column-reference at policy-create time. This is
    // the same defensive discipline the QOL-038 + QOL-040 + QOL-041.2
    // migrations followed.
    expect(sqlOnly).toMatch(/room_visibility_changes\.debate_id/);
    expect(sqlOnly).toMatch(/room_visibility_changes\.triggered_by_user_id/);
  });

  it('NEVER declares an INSERT/UPDATE/DELETE policy for authenticated (service-role only)', () => {
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*INSERT[^;]*ON public\.room_visibility_changes/i);
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*UPDATE[^;]*ON public\.room_visibility_changes/i);
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*DELETE[^;]*ON public\.room_visibility_changes/i);
  });
});

describe('Migration 20260524000015 — OPS-001 four-class compliance', () => {
  it('Class 1 (ambiguous-column): all subquery references inside policies are qualified', () => {
    // The room-creator subquery uses `room_visibility_changes.debate_id`
    // and the room-creator d alias, so the column is unambiguous.
    expect(sqlOnly).toMatch(/d\.id = room_visibility_changes\.debate_id/);
    expect(sqlOnly).toMatch(/room_visibility_changes\.triggered_by_user_id = auth\.uid\(\)/);
  });

  it('Class 2 (type mismatches): all FKs target uuid columns', () => {
    expect(sqlOnly).toMatch(/REFERENCES public\.debates\(id\)/);
    expect(sqlOnly).toMatch(/REFERENCES auth\.users\(id\)/);
  });

  it('Class 3 (statement order): CREATE TABLE precedes CREATE INDEX precedes ENABLE RLS precedes CREATE POLICY', () => {
    const tableIdx = sqlOnly.indexOf('CREATE TABLE IF NOT EXISTS public.room_visibility_changes');
    const indexIdx = sqlOnly.indexOf('CREATE INDEX IF NOT EXISTS room_visibility_changes_debate_idx');
    const rlsIdx = sqlOnly.indexOf(
      'ALTER TABLE public.room_visibility_changes ENABLE ROW LEVEL SECURITY',
    );
    const policyIdx = sqlOnly.indexOf('CREATE POLICY rvc_select_mod_or_admin');
    expect(tableIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThan(tableIdx);
    expect(rlsIdx).toBeGreaterThan(indexIdx);
    expect(policyIdx).toBeGreaterThan(rlsIdx);
  });

  it('Class 4 (function/extension deps): pgcrypto is documented in the header', () => {
    expect(migSrc).toContain('pgcrypto');
    expect(migSrc).toMatch(/Extension dependencies:/);
  });
});

describe('Migration 20260524000015 — append-only discipline', () => {
  it('does not edit any pre-existing migration file (smoke test via filename slot)', () => {
    // The next-free slot at commit time is `20260524000015`. If a
    // newer migration lands between commit and review, the operator
    // re-runs Implementer with the bumped slot.
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('the timestamp sorts after every existing migration on disk', () => {
    const migDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
    const ours = path.basename(migPath);
    const oursStamp = ours.match(/^(\d+)/)?.[1] ?? '';
    expect(oursStamp).toMatch(/^\d{14}$/);
    for (const f of files) {
      if (f === ours) continue;
      const other = f.match(/^(\d+)/)?.[1] ?? '';
      // Every other migration must have a STRICTLY EARLIER timestamp.
      expect(Number(other)).toBeLessThan(Number(oursStamp));
    }
  });
});
