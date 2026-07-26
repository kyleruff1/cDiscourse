/**
 * UX-MOTION-TOKENS (issue 944) — motion-duration linkage ratchet.
 *
 * PR-E authored the MOTION scale in designTokens.ts (fastMs 140, baseMs 160,
 * slowMs 180) as inert data. This card links the six Animated.timing duration
 * literals in the room surface to that scale so the durations have a single
 * source of truth. Each swap is value-identical, so behavior is byte-identical.
 *
 * This guard is a RATCHET, not a whole-tree ban: it scans ONLY the six
 * enumerated site paths and asserts each no longer holds a raw animation
 * duration literal (140 / 160 / 180 preceded by `duration:`) and that the
 * MOTION linkage is present. Other files elsewhere in the tree may legitimately
 * hold such literals; tokenizing them is out of scope, so they are not scanned.
 *
 * Mirrors cohesionPrinciple2Guard.test.ts: an explicit SCAN_SET, a pure
 * scanner, a firing negative control, and a must-NOT-fire control.
 *
 * Scanner hazard: the regex requires `duration:` immediately before the digits,
 * so a hex-shaped issue-ref comment or the Popout JSDoc band note ("120-160")
 * cannot false-fire — those numbers are not preceded by `duration:`. The guard
 * never scans the __tests__ dir, so its own inline fixtures are not self-scanned.
 *
 * Pure-TS, no React, no Supabase, no import from src.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

// A raw animation-duration literal: `duration:` then optional whitespace then
// exactly one of the three canonical millisecond values with a word boundary.
// After the swap the only `duration:` occurrences in the six files are
// `duration: MOTION.<key>` and `duration: POPOUT_FLASH_DURATION_MS` (no digit),
// so a match means a literal survived (or was re-introduced).
const RAW_DURATION = /duration:\s*(?:140|160|180)\b/;

function hasRawDuration(source: string): boolean {
  return RAW_DURATION.test(source);
}

// The six sites. Five link the duration directly (`MOTION.` at the swap site);
// Popout repoints its exported const, so its linkage marker is the const head.
type MotionSite = { path: string; linkage: string };

const SCAN_SET: readonly MotionSite[] = [
  { path: 'src/features/arguments/ArgumentComposerDock.tsx', linkage: 'MOTION.' },
  { path: 'src/features/arguments/ArgumentSideActionRail.tsx', linkage: 'MOTION.' },
  { path: 'src/features/arguments/openIssuesRail/OpenIssuesRail.tsx', linkage: 'MOTION.' },
  { path: 'src/features/mediator/DisagreementPointsRail.tsx', linkage: 'MOTION.' },
  { path: 'src/features/arguments/TimelineMiniMap.tsx', linkage: 'MOTION.' },
  {
    path: 'src/features/arguments/oneBox/Popout.tsx',
    linkage: 'POPOUT_FLASH_DURATION_MS = MOTION.',
  },
];

describe('UX-MOTION-TOKENS — room-surface durations linked to the MOTION scale', () => {
  it('the scan set covers exactly the six enumerated Animated.timing sites', () => {
    expect(SCAN_SET.map((s) => s.path)).toEqual([
      'src/features/arguments/ArgumentComposerDock.tsx',
      'src/features/arguments/ArgumentSideActionRail.tsx',
      'src/features/arguments/openIssuesRail/OpenIssuesRail.tsx',
      'src/features/mediator/DisagreementPointsRail.tsx',
      'src/features/arguments/TimelineMiniMap.tsx',
      'src/features/arguments/oneBox/Popout.tsx',
    ]);
    expect(SCAN_SET).toHaveLength(6);
  });

  it.each(SCAN_SET.map((s) => [s.path, s.linkage] as const))(
    '%s holds no raw duration literal and carries the MOTION linkage',
    (relPath, linkage) => {
      const source = fs.readFileSync(path.join(REPO, relPath), 'utf8');
      expect(hasRawDuration(source)).toBe(false);
      expect(source).toContain(linkage);
    },
  );
});

// ── Firing control — the guard actually bites (not vacuously green) ──

describe('UX-MOTION-TOKENS guard — firing negative control', () => {
  it('flags a re-introduced raw duration literal for each canonical value', () => {
    expect(hasRawDuration('duration: 140,')).toBe(true);
    expect(hasRawDuration('duration: 160,')).toBe(true);
    expect(hasRawDuration('duration: 180,')).toBe(true);
    expect(hasRawDuration('duration:180')).toBe(true);
  });
});

// ── Must-NOT-fire control — no false positives on clean input ──

describe('UX-MOTION-TOKENS guard — must-NOT-fire control (no false positives)', () => {
  it('does not flag a token reference at the duration site', () => {
    expect(hasRawDuration('duration: MOTION.baseMs,')).toBe(false);
    expect(hasRawDuration('duration: MOTION.fastMs,')).toBe(false);
    expect(hasRawDuration('duration: MOTION.slowMs,')).toBe(false);
    expect(hasRawDuration('duration: POPOUT_FLASH_DURATION_MS,')).toBe(false);
  });

  it('does not flag the Popout JSDoc band note (numbers not preceded by duration:)', () => {
    expect(hasRawDuration('Flash open/close duration (logical ms) - inside the 120-160 band.')).toBe(
      false,
    );
  });

  it('does not flag a non-canonical duration or a longer number run', () => {
    expect(hasRawDuration('duration: 200,')).toBe(false);
    expect(hasRawDuration('duration: 1600,')).toBe(false);
  });
});
