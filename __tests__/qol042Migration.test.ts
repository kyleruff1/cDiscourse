/**
 * QOL-042 — argument_room_links migration shape tests.
 *
 * Source-file inspection of `20260521000010_qol042_argument_room_links.sql`
 * (the pattern from `pointTagsMigration.test.ts`). End-to-end behaviour
 * (the migration applies, RLS blocks an unauthorized read, the triggers
 * reject a non-locked target / a column edit) is verified by the operator
 * post-merge.
 */
import * as fs from 'fs';
import * as path from 'path';
import { _forbiddenLinkedPriorTokens } from '../src/features/arguments/crossRoom/linkedPriorArgumentCopy';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260521000010_qol042_argument_room_links.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

/** The migration with `--` comment-only lines stripped — for SQL scans. */
const sqlOnly = migSrc
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

/**
 * The structural DDL only — `sqlOnly` with the `comment on … is '…';`
 * statements removed. A `COMMENT ON TABLE/FUNCTION` carries descriptive
 * prose (e.g. "the link is never a verdict … carries no score field");
 * that prose is doctrine being STATED, not a column / value declaration.
 * Column-name, CHECK-value, policy, and trigger scans run over this.
 */
const ddlOnly = sqlOnly.replace(/comment on [\s\S]*?;/gi, '');

describe('Migration 20260521000010 — argument_room_links table', () => {
  it('creates the table idempotently', () => {
    expect(migSrc).toMatch(/create table if not exists public\.argument_room_links/i);
  });

  it('declares every column', () => {
    for (const col of [
      'id',
      'source_debate_id',
      'target_debate_id',
      'created_by',
      'target_title_snapshot',
      'note',
      'is_removed',
      'created_at',
    ]) {
      expect(migSrc).toContain(col);
    }
  });

  it('includes the target_title_snapshot column with a 200-char CHECK', () => {
    expect(migSrc).toMatch(/target_title_snapshot\s+text\s+not null/i);
    expect(migSrc).toMatch(/char_length\(target_title_snapshot\)\s*<=\s*200/i);
  });

  it('source_debate_id FK -> debates ON DELETE CASCADE', () => {
    expect(migSrc).toMatch(
      /source_debate_id\s+uuid\s+not null\s+references public\.debates\(id\)\s+on delete cascade/i,
    );
  });

  it('target_debate_id FK -> debates ON DELETE RESTRICT', () => {
    expect(migSrc).toMatch(
      /target_debate_id\s+uuid\s+not null\s+references public\.debates\(id\)\s+on delete restrict/i,
    );
  });

  it('created_by FK -> public.profiles (NOT auth.users)', () => {
    expect(migSrc).toMatch(/created_by\s+uuid\s+not null\s+references public\.profiles\(id\)/i);
    expect(migSrc).not.toMatch(/created_by[\s\S]{0,60}auth\.users/i);
  });

  it('note column has a 280-char CHECK', () => {
    expect(migSrc).toMatch(/char_length\(note\)\s*<=\s*280/i);
  });

  it('has the is_removed soft-remove column (no hard-delete path)', () => {
    expect(migSrc).toMatch(/is_removed\s+boolean\s+not null\s+default false/i);
  });

  it('declares the no_self_link CHECK constraint', () => {
    expect(migSrc).toMatch(/argument_room_links_no_self_link/i);
    expect(migSrc).toMatch(/source_debate_id\s*<>\s*target_debate_id/i);
  });

  it('declares the one_link_per_pair UNIQUE constraint', () => {
    expect(migSrc).toMatch(/argument_room_links_one_link_per_pair/i);
    expect(migSrc).toMatch(/unique\s*\(source_debate_id,\s*target_debate_id\)/i);
  });

  it('does NOT declare a status, updated_at, score, or relationship_type column', () => {
    // Scan the structural DDL (COMMENT ON statements removed): a
    // column/field by these names must not exist. The migration's doc
    // comments and COMMENT ON prose legitimately say "no score field" /
    // "no relationship-type enum" — doctrine stated, not a declaration.
    expect(ddlOnly).not.toMatch(/\bupdated_at\b/i);
    expect(ddlOnly).not.toMatch(/\brelationship_type\b/i);
    expect(ddlOnly).not.toMatch(/\bscore\b/i);
  });
});

describe('Migration 20260521000010 — indexes', () => {
  it('creates the two partial indexes on active rows (source + target)', () => {
    expect(migSrc).toMatch(
      /create index if not exists idx_arg_room_links_source[\s\S]*?where is_removed = false/i,
    );
    expect(migSrc).toMatch(
      /create index if not exists idx_arg_room_links_target[\s\S]*?where is_removed = false/i,
    );
  });
});

describe('Migration 20260521000010 — RLS', () => {
  it('enables row level security on argument_room_links', () => {
    expect(migSrc).toMatch(
      /alter table public\.argument_room_links enable row level security/i,
    );
  });

  it('declares exactly 3 policies (select / insert / update) — no DELETE policy', () => {
    const createPolicy = migSrc.match(/create policy/gi) || [];
    expect(createPolicy).toHaveLength(3);
    expect(migSrc).toContain('argument_room_links: select if source room visible');
    expect(migSrc).toContain('argument_room_links: insert by source room participant');
    expect(migSrc).toContain('argument_room_links: soft-remove by author or admin');
  });

  it('has NO for-delete policy (soft-remove only)', () => {
    expect(sqlOnly).not.toMatch(/for delete/i);
  });

  it('the SELECT policy gates on SOURCE-room visibility and hides removed rows', () => {
    expect(migSrc).toMatch(
      /select if source room visible[\s\S]*?is_removed = false/i,
    );
    expect(migSrc).toMatch(
      /select if source room visible[\s\S]*?is_debate_open_or_locked\(source_debate_id\)/i,
    );
  });

  it('the INSERT policy requires created_by = auth.uid() AND source-room participation', () => {
    expect(migSrc).toMatch(
      /insert by source room participant[\s\S]*?created_by = auth\.uid\(\)/i,
    );
    expect(migSrc).toMatch(
      /insert by source room participant[\s\S]*?is_debate_participant\(source_debate_id, auth\.uid\(\)\)/i,
    );
  });

  it('the UPDATE policy allows the link author OR an admin', () => {
    expect(migSrc).toMatch(
      /soft-remove by author or admin[\s\S]*?created_by = auth\.uid\(\) or public\.is_moderator_or_admin\(\)/i,
    );
  });

  it('uses drop policy if exists before each create policy (idempotent)', () => {
    const dropPolicy = migSrc.match(/drop policy if exists/gi) || [];
    expect(dropPolicy.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Migration 20260521000010 — triggers', () => {
  it('declares the link_target_must_be_locked BEFORE INSERT trigger + function', () => {
    expect(migSrc).toMatch(
      /create or replace function public\.link_target_must_be_locked\(\)/i,
    );
    expect(migSrc).toMatch(
      /create trigger trg_link_target_must_be_locked[\s\S]*?before insert on public\.argument_room_links/i,
    );
  });

  it('the locked-target trigger rejects a non-locked target', () => {
    expect(migSrc).toMatch(/v_status\s*<>\s*'locked'/i);
  });

  it('the locked-target trigger checks the inserting user can read the target', () => {
    expect(migSrc).toMatch(/is_debate_open_or_locked\(new\.target_debate_id\)/i);
    expect(migSrc).toMatch(
      /is_debate_participant\(new\.target_debate_id, new\.created_by\)/i,
    );
  });

  it('declares the link_columns_immutable BEFORE UPDATE trigger + function', () => {
    expect(migSrc).toMatch(/create or replace function public\.link_columns_immutable\(\)/i);
    expect(migSrc).toMatch(
      /create trigger trg_link_columns_immutable[\s\S]*?before update on public\.argument_room_links/i,
    );
  });

  it('the immutability trigger guards every column except is_removed', () => {
    for (const col of [
      'source_debate_id',
      'target_debate_id',
      'created_by',
      'target_title_snapshot',
      'note',
      'created_at',
    ]) {
      expect(migSrc).toMatch(
        new RegExp(`new\\.${col} is distinct from old\\.${col}`, 'i'),
      );
    }
  });

  it('uses drop trigger if exists before each create trigger (idempotent)', () => {
    const dropTrigger = migSrc.match(/drop trigger if exists/gi) || [];
    expect(dropTrigger.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Migration 20260521000010 — never mutates debates or arguments', () => {
  it('contains no UPDATE / INSERT / DELETE against public.debates or public.arguments', () => {
    // The link only ever writes its own argument_room_links row. A SELECT
    // into debates inside a trigger is fine (read-only); a write is not.
    expect(sqlOnly).not.toMatch(/update\s+public\.debates/i);
    expect(sqlOnly).not.toMatch(/insert\s+into\s+public\.debates/i);
    expect(sqlOnly).not.toMatch(/delete\s+from\s+public\.debates/i);
    expect(sqlOnly).not.toMatch(/update\s+public\.arguments/i);
    expect(sqlOnly).not.toMatch(/insert\s+into\s+public\.arguments/i);
    expect(sqlOnly).not.toMatch(/delete\s+from\s+public\.arguments/i);
  });

  it('never disables row level security', () => {
    expect(migSrc).not.toMatch(/disable row level security/i);
  });
});

describe('Migration 20260521000010 — doctrine ban-list', () => {
  it('declares no verdict / amplification token as a column, value, or behaviour', () => {
    // The scan runs over the structural DDL (COMMENT ON statements
    // removed). The migration's doc comments and COMMENT ON prose
    // deliberately say the link is "not a verdict", carries "no score
    // field", "never says won / proved" — that prose is doctrine being
    // stated, not a violation. The DDL itself (columns, CHECKs, policies,
    // triggers, function bodies) must carry none of the banned tokens.
    //
    // `true` / `false` are SQL structural words (`default false`);
    // excluded. Every other token is a hard ban in the DDL.
    const excluded = new Set(['true', 'false']);
    for (const token of _forbiddenLinkedPriorTokens()) {
      if (excluded.has(token)) continue;
      if (token.includes(' ')) {
        expect(ddlOnly.toLowerCase()).not.toContain(token);
      } else {
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(ddlOnly)).toBe(false);
      }
    }
  });

  it('the table comment frames the link as context, not a verdict', () => {
    expect(migSrc).toMatch(/never a verdict|read-only context/i);
  });
});
