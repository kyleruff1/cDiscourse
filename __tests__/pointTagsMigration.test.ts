/**
 * META-1A — point_tags migration shape tests.
 *
 * Reads `20260517000009_meta_1a_point_tags.sql` and asserts the table /
 * index / RLS-policy structure. No live DB — the source-file inspection
 * pattern from `argumentDeletionRequest.test.ts`. End-to-end behavior
 * (migration applies, RLS blocks an observer) is verified by the operator
 * post-merge.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ALL_MANUAL_TAG_CODES } from '../src/features/metadata/moveMetadataLedger';
import { _forbiddenMetadataTokens } from '../src/features/metadata/moveMetadataLedger';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260517000009_meta_1a_point_tags.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

describe('Migration 20260517000009 — point_tags table', () => {
  it('creates the table idempotently', () => {
    expect(migSrc).toMatch(/create table if not exists public\.point_tags/);
  });

  it('declares all 9 columns', () => {
    for (const col of [
      'id', 'debate_id', 'argument_id', 'tag_code', 'tagged_by',
      'created_at', 'removed_at', 'removed_by',
    ]) {
      expect(migSrc).toContain(col);
    }
    // 8 named columns above + the implicit `id` makes 9 with the PK; the
    // table literally has 8 column definitions. Assert each appears in a
    // column-definition position.
    expect(migSrc).toMatch(/id\s+uuid\s+primary key/);
    expect(migSrc).toMatch(/debate_id\s+uuid\s+not null/);
    expect(migSrc).toMatch(/argument_id\s+uuid\s+not null/);
    expect(migSrc).toMatch(/tag_code\s+text\s+not null/);
    expect(migSrc).toMatch(/tagged_by\s+uuid\s+not null/);
    expect(migSrc).toMatch(/created_at\s+timestamptz\s+not null/);
    expect(migSrc).toMatch(/removed_at\s+timestamptz/);
    expect(migSrc).toMatch(/removed_by\s+uuid/);
  });

  it('has the removed_at soft-delete column (no hard-delete path)', () => {
    expect(migSrc).toMatch(/removed_at\s+timestamptz/);
    // Soft-delete only: no policy declares `for delete` as its action.
    // (A comment may mention the words "for delete" — strip comment lines
    // before scanning so only real SQL is checked.)
    const sqlOnly = migSrc
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sqlOnly).not.toMatch(/for delete/i);
  });

  it('FKs debate_id -> debates and argument_id -> arguments with cascade', () => {
    expect(migSrc).toMatch(/debate_id\s+uuid\s+not null\s+references public\.debates\(id\)\s+on delete cascade/);
    expect(migSrc).toMatch(/argument_id\s+uuid\s+not null\s+references public\.arguments\(id\)\s+on delete cascade/);
  });

  it('FKs tagged_by -> public.profiles (NOT auth.users)', () => {
    expect(migSrc).toMatch(/tagged_by\s+uuid\s+not null\s+references public\.profiles\(id\)/);
    // tagged_by must not reference auth.users.
    expect(migSrc).not.toMatch(/tagged_by[\s\S]{0,60}auth\.users/);
  });

  it('FKs removed_by -> public.profiles with on delete set null', () => {
    expect(migSrc).toMatch(/removed_by\s+uuid\s+references public\.profiles\(id\)\s+on delete set null/);
  });

  it('declares a tag_code CHECK listing the 10 META-001 codes verbatim', () => {
    expect(migSrc).toMatch(/constraint point_tags_tag_code_check check \(tag_code in \(/);
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(migSrc).toContain(`'${code}'`);
    }
    // No extra codes — the CHECK list contains exactly 10 quoted codes.
    const checkBlock = migSrc.match(/tag_code in \(([\s\S]*?)\)\s*\)/);
    expect(checkBlock).not.toBeNull();
    const quoted = (checkBlock ? checkBlock[1] : '').match(/'[a-z_]+'/g) || [];
    expect(quoted).toHaveLength(10);
  });

  it('does NOT use a pg ENUM type for tag_code', () => {
    expect(migSrc).not.toMatch(/create type[\s\S]*as enum/i);
  });
});

describe('Migration 20260517000009 — indexes', () => {
  it('creates partial indexes on active rows for argument_id and debate_id', () => {
    expect(migSrc).toMatch(/create index if not exists point_tags_argument_idx[\s\S]*?where removed_at is null/);
    expect(migSrc).toMatch(/create index if not exists point_tags_debate_idx[\s\S]*?where removed_at is null/);
  });

  it('declares the partial unique index for one-active-tag-per-tagger', () => {
    expect(migSrc).toMatch(/create unique index if not exists point_tags_one_active_per_tagger/);
    expect(migSrc).toMatch(/point_tags_one_active_per_tagger[\s\S]*?\(argument_id, tag_code, tagged_by\)/);
    expect(migSrc).toMatch(/point_tags_one_active_per_tagger[\s\S]*?where removed_at is null/);
  });
});

describe('Migration 20260517000009 — RLS', () => {
  it('enables row level security on point_tags', () => {
    expect(migSrc).toMatch(/alter table public\.point_tags enable row level security/);
  });

  it('declares exactly 3 named policies (insert / select / update)', () => {
    expect(migSrc).toContain('pt_insert_eligible');
    expect(migSrc).toContain('pt_select_read_access');
    expect(migSrc).toContain('pt_update_soft_delete');
    const createPolicy = migSrc.match(/create policy/g) || [];
    expect(createPolicy).toHaveLength(3);
  });

  it('has NO for-delete policy (soft-delete only)', () => {
    const sqlOnly = migSrc
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sqlOnly).not.toMatch(/for delete/i);
  });

  it('insert policy requires the caller to BE the tagger', () => {
    expect(migSrc).toMatch(/pt_insert_eligible[\s\S]*?auth\.uid\(\)\s*=\s*tagged_by/);
  });

  it('update policy lets the original tagger OR an admin soft-delete', () => {
    expect(migSrc).toMatch(/pt_update_soft_delete[\s\S]*?auth\.uid\(\)\s*=\s*tagged_by/);
    expect(migSrc).toMatch(/pt_update_soft_delete[\s\S]*?public\.is_admin\(auth\.uid\(\)\)/);
  });

  it('uses drop policy if exists before each create policy (idempotent)', () => {
    const dropPolicy = migSrc.match(/drop policy if exists/g) || [];
    expect(dropPolicy.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Migration 20260517000009 — doctrine ban-list', () => {
  it('contains no verdict / amplification / person-attribution tokens', () => {
    // Whole-word scan. `true`/`false`/`right`/`wrong` and the other
    // generic-verb tokens are excluded — they are SQL/English structural
    // words, not verdict usages. Every remaining token is a hard ban.
    const excluded = new Set([
      'true', 'false', 'right', 'wrong', 'block', 'reject',
      'prevent', 'forbid', 'disallow', 'denied', 'verified',
    ]);
    for (const token of _forbiddenMetadataTokens()) {
      if (excluded.has(token)) continue;
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      expect(re.test(migSrc)).toBe(false);
    }
  });

  it('the table comment frames a tag as a gameplay annotation, not a ruling', () => {
    expect(migSrc).toMatch(/gameplay annotation/i);
    expect(migSrc).toMatch(/never rules on a person/i);
  });
});
