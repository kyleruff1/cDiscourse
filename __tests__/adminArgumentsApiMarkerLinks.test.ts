/**
 * INTEL-002 (#901) — adminArgumentsApi marker-links + parent_id safety contract.
 *
 * Source-scan (the repo convention for the admin loader; no live Supabase in CI):
 *  - loadRoomMarkerReplyLinks is a batched `.in('debate_id', ids)` +
 *    `.is('deleted_at', null)` SELECT on timestamp_markers;
 *  - the row select adds `parent_id`; AdminArgumentRow maps `parentId`;
 *  - no service-role / no secret literal; the marker read never throws (returns
 *    [] on error) and reads NO person field (created_by).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const API_SRC = fs.readFileSync(path.join(ROOT, 'src/features/admin/adminArgumentsApi.ts'), 'utf8');
const TYPES_SRC = fs.readFileSync(path.join(ROOT, 'src/features/admin/types.ts'), 'utf8');

describe('INTEL-002 — loadRoomMarkerReplyLinks shape', () => {
  it('exports loadRoomMarkerReplyLinks', () => {
    expect(API_SRC).toMatch(/export\s+async\s+function\s+loadRoomMarkerReplyLinks/);
  });

  it('reads timestamp_markers with a batched .in and a .is(deleted_at, null)', () => {
    expect(API_SRC).toContain("from('timestamp_markers')");
    expect(API_SRC).toMatch(/\.in\(\s*['"]debate_id['"]/);
    expect(API_SRC).toMatch(/\.is\(\s*['"]deleted_at['"]\s*,\s*null\s*\)/);
  });

  it('selects only the structural columns (never a person field)', () => {
    expect(API_SRC).toContain('reply_argument_id');
    expect(API_SRC).not.toMatch(/timestamp_markers[\s\S]{0,120}created_by/);
  });

  it('returns [] on error (never throws) + guards on empty ids / no config', () => {
    expect(API_SRC).toMatch(/if\s*\(\s*error\s*\)\s*return\s*\[\]/);
    expect(API_SRC).toMatch(/debateIds\.length\s*===\s*0/);
  });
});

describe('INTEL-002 — parent_id wiring', () => {
  it('the row select includes parent_id', () => {
    expect(API_SRC).toContain("'parent_id'");
  });

  it('AdminArgumentRow gains parentId; the loader maps r.parent_id', () => {
    expect(TYPES_SRC).toMatch(/parentId:\s*string\s*\|\s*null/);
    expect(API_SRC).toMatch(/parentId:\s*r\.parent_id/);
  });
});

describe('INTEL-002 — loader safety', () => {
  it('uses the shared supabase client (no service-role construction, no secret)', () => {
    expect(API_SRC).toContain("from '../../lib/supabase'");
    expect(API_SRC).not.toMatch(/createClient\(/);
    expect(API_SRC).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(API_SRC).not.toMatch(/serviceRoleKey/);
  });
});
