/**
 * UX-MOBILE-001 — mobile hardening source guards.
 *
 * Source-scan tests (the repo idiom for token/copy contracts) for the
 * presentation-only mobile fixes that have no separate render seam:
 *  - TICKET-004 touch targets: timeline controls + info icon + move/axis chips
 *    reach a >= 44 effective tap target via TOUCH_TARGET hitSlop.
 *  - TICKET-006 account copy: no internal tooling names / repo paths leak;
 *    the role-help copy is user-facing; body help text is >= 14px.
 */
import fs from 'fs';
import path from 'path';

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('UX-MOBILE-001 TICKET-004 — timeline touch targets', () => {
  const src = read('src/features/arguments/ArgumentTimelineMap.tsx');

  it('no control keeps the sub-floor {left:4,right:4} hitSlop', () => {
    expect(src).not.toMatch(/left:\s*4,\s*right:\s*4/);
  });

  it('controls + info icon use the canonical TOUCH_TARGET hitSlop (>=6 sites)', () => {
    const count = (src.match(/TOUCH_TARGET\.hitSlopAll/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(6); // 5 controls + the info icon
  });

  it('the per-node info icon Pressable carries a hitSlop', () => {
    // The info icon block (testID timeline-node-info-...) now sets hitSlop.
    const infoBlock = src.slice(src.indexOf('timeline-node-info'));
    expect(infoBlock.slice(0, 400)).toMatch(/hitSlop=\{TOUCH_TARGET\.hitSlopAll\}/);
  });
});

describe('UX-MOBILE-001 TICKET-004 — move navigator chips', () => {
  const src = read('src/features/arguments/ConversationMoveNavigator.tsx');

  it('imports the touch-target token', () => {
    expect(src).toMatch(/TOUCH_TARGET/);
  });

  it('both chip Pressables carry a hitSlop (move + axis)', () => {
    const count = (src.match(/TOUCH_TARGET\.hitSlopCompact/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('UX-MOBILE-001 TICKET-006 — account internal-copy cleanup', () => {
  const src = read('src/features/account/AccountScreen.tsx');

  it('leaks no internal tooling name or repo path to end users', () => {
    expect(src).not.toMatch(/Supabase Dashboard/);
    expect(src).not.toMatch(/account-operations/);
    expect(src).not.toMatch(/docs\//);
    expect(src).not.toMatch(/backend ops/);
  });

  it('uses user-facing role-help copy', () => {
    expect(src).toMatch(/Contact support to change your role\./);
  });

  it('body help text is >= 14px (no 12px noteText / errorHint)', () => {
    // The two help strings were bumped from 12 -> 14 for mobile legibility.
    expect(src).toMatch(/noteText:\s*\{\s*fontSize:\s*14/);
    expect(src).toMatch(/errorHint:\s*\{\s*fontSize:\s*14/);
  });
});
