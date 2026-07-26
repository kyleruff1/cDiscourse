/**
 * UX-P2-12 (issue 941) — reduce-motion threading regression matrix.
 *
 * A11Y-693 shipped ONE shared reduce-motion primitive
 * (`src/features/preferences/useReduceMotion.ts`) with a single consumer
 * (DisagreementPointsRail). This card threads that hook through the five other
 * Animated.timing sites in the room so every site consults ONE reduce-motion
 * source. Four of the five previously hand-rolled the raw
 * AccessibilityInfo.isReduceMotionEnabled + reduceMotionChanged effect; the
 * fifth (TimelineMiniMap) read only a prop with no OS self-read.
 *
 * This is the primary guard (source-scan discipline, matching the repo pattern
 * and the a11y693ReduceMotionPrimitive dedupe proof). It asserts, per site:
 *   - the file exists (a rename surfaces as a presence failure);
 *   - it imports useReduceMotion from the correct relative path;
 *   - it calls useReduceMotion(<the prop the component already exposes>);
 *   - it derives / uses effectiveReducedMotion;
 *   - it NO LONGER hand-rolls the OS read (no AccessibilityInfo,
 *     isReduceMotionEnabled, or reduceMotionChanged — the dedupe proof);
 *   - it still gates an Animated.timing with a snap branch (setValue present).
 *
 * Comments here are apostrophe-free for the naive doctrine quote-parity scanner.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

interface Site {
  label: string;
  rel: string[];
  /** Relative import specifier the file must use for the shared hook. */
  importPath: string;
  /** The prop the component threads into useReduceMotion(...). */
  hookArg: 'reduceMotionOverride' | 'reduceMotion';
}

// The five Animated.timing sites this card threads the shared hook through.
// DisagreementPointsRail is intentionally NOT here — A11Y-693 already covered it.
const SITES: Site[] = [
  {
    label: 'ArgumentComposerDock',
    rel: ['src', 'features', 'arguments', 'ArgumentComposerDock.tsx'],
    importPath: '../preferences/useReduceMotion',
    hookArg: 'reduceMotionOverride',
  },
  {
    label: 'ArgumentSideActionRail',
    rel: ['src', 'features', 'arguments', 'ArgumentSideActionRail.tsx'],
    importPath: '../preferences/useReduceMotion',
    hookArg: 'reduceMotionOverride',
  },
  {
    label: 'TimelineMiniMap',
    rel: ['src', 'features', 'arguments', 'TimelineMiniMap.tsx'],
    importPath: '../preferences/useReduceMotion',
    hookArg: 'reduceMotion',
  },
  {
    label: 'Popout',
    rel: ['src', 'features', 'arguments', 'oneBox', 'Popout.tsx'],
    importPath: '../../preferences/useReduceMotion',
    hookArg: 'reduceMotionOverride',
  },
  {
    label: 'OpenIssuesRail',
    rel: ['src', 'features', 'arguments', 'openIssuesRail', 'OpenIssuesRail.tsx'],
    importPath: '../../preferences/useReduceMotion',
    hookArg: 'reduceMotionOverride',
  },
];

function readSite(site: Site): string {
  return fs.readFileSync(path.join(ROOT, ...site.rel), 'utf8');
}

describe('UX-P2-12 — every uncovered Animated.timing site adopts the shared hook', () => {
  for (const site of SITES) {
    describe(site.label, () => {
      it('the source file exists at the expected path', () => {
        expect(fs.existsSync(path.join(ROOT, ...site.rel))).toBe(true);
      });

      it('imports useReduceMotion from the correct relative path', () => {
        const src = readSite(site);
        expect(src).toContain(`import { useReduceMotion } from '${site.importPath}';`);
      });

      it('calls useReduceMotion with the prop the component already exposes', () => {
        const src = readSite(site);
        expect(src).toContain(`useReduceMotion(${site.hookArg})`);
      });

      it('derives an effectiveReducedMotion value from the hook', () => {
        const src = readSite(site);
        expect(src).toMatch(
          new RegExp(`const effectiveReducedMotion = useReduceMotion\\(${site.hookArg}\\)`),
        );
      });

      it('no longer hand-rolls the OS reduce-motion read (dedupe proof)', () => {
        const src = readSite(site);
        expect(src).not.toMatch(/AccessibilityInfo/);
        expect(src).not.toMatch(/isReduceMotionEnabled/);
        expect(src).not.toMatch(/reduceMotionChanged/);
      });

      it('still gates an Animated.timing with a snap (setValue) branch', () => {
        const src = readSite(site);
        expect(src).toMatch(/Animated\.timing/);
        expect(src).toMatch(/\.setValue\(/);
        // The snap branch keys off the derived value, never a stale inline read.
        expect(src).toMatch(/effectiveReducedMotion/);
      });
    });
  }
});
