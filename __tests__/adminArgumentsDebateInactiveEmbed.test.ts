/**
 * ADMIN-CONV-INACTIVE-001 — loader embed contract (DEBATE-level inactive_at).
 *
 * The room-group header derives `isDebateInactive` from the parent debate's
 * DEBATE-level `inactive_at` (the #514 conversation-inactivation column). The
 * loader must therefore SELECT `debates(title, inactive_at)` — and it must
 * NEVER select `debates.inactive_reason` / `debates.inactive_by` (doctrine
 * §10a: the badge shows WHAT is inactive via `inactive_at`, never WHY).
 *
 * Source-scan only (no DB). Asserts the embed shape + the §10a forbidden-field
 * guard at the loader boundary.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/adminArgumentsApi.ts'),
  'utf8',
);

describe('adminArgumentsApi — debates embed selects DEBATE-level inactive_at', () => {
  it('the select string embeds debates(title, inactive_at)', () => {
    expect(src).toMatch(/debates\(title,\s*inactive_at\)/);
  });

  it('threads debateInactiveAt onto the returned row', () => {
    expect(src).toMatch(/debateInactiveAt:\s*asDebateInactiveAt\(r\.debates\)/);
  });

  it('projects inactive_at via a dedicated helper that reads only inactive_at', () => {
    expect(src).toContain('function asDebateInactiveAt');
    // The helper returns the embed's inactive_at (object or array form).
    expect(src).toMatch(/inactive_at\s*\?\?\s*null/);
  });
});

describe('adminArgumentsApi — §10a: never selects the debate reason / inactivator', () => {
  it('does NOT embed debates.inactive_reason', () => {
    // The forbidden pattern would be a debates(...) embed widened to include
    // inactive_reason. The argument-level inactive_reason column IS selected
    // (that is the #480 argument card and is admin-row-detail-only), so we scan
    // specifically for the DEBATE embed shape being widened.
    expect(src).not.toMatch(/debates\([^)]*inactive_reason[^)]*\)/);
  });

  it('does NOT embed debates.inactive_by', () => {
    expect(src).not.toMatch(/debates\([^)]*inactive_by[^)]*\)/);
  });

  it('does NOT thread a debateInactiveReason / debateInactiveBy field', () => {
    expect(src).not.toMatch(/debateInactiveReason/);
    expect(src).not.toMatch(/debateInactiveBy/);
  });
});
