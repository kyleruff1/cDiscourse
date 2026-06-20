/**
 * UX-BRAND-ASSETS-001 — CivilDiscourse horizontal lockup on the Sign In
 * hero (header untouched).
 *
 * Pure source/config + asset scan (repo idiom — "render tests aren't set
 * up project-wide", per appHeader.test.ts). Guards:
 *   (a) the Sign In hero renders the lockup Image from
 *       `assets/branding/lockup-horizontal.png`;
 *   (b) the lockup Image carries accessibilityLabel / role so screen
 *       readers still get the brand name;
 *   (c) the standalone VISIBLE "CivilDiscourse" TEXT wordmark is gone
 *       from the hero (no duplicate visible wordmark — the image is the
 *       wordmark);
 *   (d) the tagline + three-beat value line are still rendered as TEXT;
 *   (f) no stale visible "CDiscourse";
 *   (g) the masthead/header (`AppHeader.tsx`) and the 2.3 MB header logo
 *       (`civic-discourse-logo.png`) are NOT in this card's diff;
 *   (h) the committed lockup asset exists and is the ~129 KB cream
 *       horizontal lockup (NOT the 2.3 MB header scene, NOT the ink
 *       variant).
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const AUTH_SRC = read('src/features/auth/AuthScreen.tsx');

/**
 * Strip comment lines + comment-block continuations so the "visible
 * wordmark" assertions scan actual JSX/code, not the doc comments that
 * legitimately name the brand and describe the change.
 */
function codeOnly(src: string): string {
  const out: string[] = [];
  let inBlock = false;
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*') && !t.includes('*/')) {
      inBlock = true;
      continue;
    }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    if (t.includes('*/') || t.includes('*/}')) continue;
    out.push(line);
  }
  return out.join('\n');
}

const AUTH_CODE = codeOnly(AUTH_SRC);

describe('UX-BRAND-ASSETS-001 (a) — Sign In hero renders the lockup Image', () => {
  it('requires the committed lockup asset (not the header logo, not the ink variant)', () => {
    expect(AUTH_CODE).toContain("require('../../../assets/branding/lockup-horizontal.png')");
    expect(AUTH_CODE).not.toContain('civic-discourse-logo.png');
    expect(AUTH_CODE).not.toContain('lockup-horizontal-ink.png');
    expect(AUTH_CODE).not.toContain('civildiscourse-mark.png');
  });

  it('renders the lockup as an Image with a stable testID', () => {
    expect(AUTH_CODE).toContain('<Image');
    expect(AUTH_CODE).toContain('testID="auth-brand-lockup"');
    expect(AUTH_CODE).toContain('source={SIGNIN_LOCKUP}');
  });

  it('sizes the lockup responsively via the clamping helper + EXPLICIT height', () => {
    expect(AUTH_CODE).toContain('resolveSignInLockupWidthPx');
    // The height is set EXPLICITLY (width / aspect) rather than via an
    // `aspectRatio` style: React Native Web does NOT honor `aspectRatio` to
    // derive an Image's height from its width, which stranded the cream art
    // in a box sized to the PNG's intrinsic 388px height. The fix computes
    // the height from the width via resolveSignInLockupHeightPx and assigns
    // it to the Image's `height` style; the `aspectRatio` style is gone.
    expect(AUTH_CODE).toContain('resolveSignInLockupHeightPx');
    expect(AUTH_CODE).toMatch(/height:\s*lockupHeightPx/);
    expect(AUTH_CODE).not.toMatch(/aspectRatio:/);
    expect(AUTH_CODE).toContain('resizeMode="contain"');
    // A hard maxWidth cap so the Image can never exceed its container.
    expect(AUTH_CODE).toMatch(/maxWidth:\s*'100%'/);
  });
});

describe('UX-BRAND-ASSETS-001 (b) — lockup is accessible as the brand name', () => {
  it('the lockup Image has accessibilityLabel fed from the brand copy', () => {
    expect(AUTH_CODE).toContain('accessibilityLabel={AUTH_FIRST_RUN_COPY.brand}');
    expect(AUTH_CODE).toContain('accessibilityRole="image"');
  });
});

describe('UX-BRAND-ASSETS-001 (c) — no duplicate VISIBLE text wordmark in the hero', () => {
  it('removed the standalone visible brand-name <Text> element', () => {
    // The old visible wordmark was a <Text> rendering AUTH_FIRST_RUN_COPY.brand.
    // It is now the Image; the brand string must NOT be rendered as visible text.
    expect(AUTH_CODE).not.toMatch(/<Text[^>]*>\s*\{?\s*AUTH_FIRST_RUN_COPY\.brand/);
    // The retired testID/style for the visible wordmark must be gone.
    expect(AUTH_SRC).not.toContain('auth-value-prop-brand');
    expect(AUTH_SRC).not.toContain('valuePropBrand');
  });

  it('the literal "CivilDiscourse" never appears as rendered visible text', () => {
    // The brand string is only the Image aria label + the doc comments; it is
    // never a JSX text child. (Doc comments are stripped by codeOnly.)
    expect(AUTH_CODE).not.toMatch(/>\s*CivilDiscourse\s*</);
  });
});

describe('UX-BRAND-ASSETS-001 (d) — tagline remains as text', () => {
  it('keeps the tagline lead rendered as Text', () => {
    expect(AUTH_CODE).toContain('AUTH_FIRST_RUN_COPY.tagline');
    expect(AUTH_CODE).toContain('testID="auth-value-prop-lead"');
  });

  // QUICK-COPY-001 — the three-beat sub-explanation was removed (not hidden)
  // and its reserved space collapsed. The subline Text + testID are gone.
  it('no longer renders the three-beat sub-explanation', () => {
    expect(AUTH_CODE).not.toContain('AUTH_FIRST_RUN_COPY.subline');
    expect(AUTH_SRC).not.toContain('testID="auth-value-prop-subline"');
  });
});

describe('UX-BRAND-ASSETS-001 (e) — lockup sits on a dark brand-field backing', () => {
  it('wraps the cream lockup in a dark backing band (surface.app)', () => {
    expect(AUTH_CODE).toContain('testID="auth-brand-lockup-backing"');
    // The backing band paints BRAND.surface.app.bg (#08060F) so the cream art
    // reads like the on-black reference.
    expect(AUTH_SRC).toMatch(/backgroundColor:\s*BRAND\.surface\.app\.bg/);
  });
});

describe('UX-BRAND-ASSETS-001 (f) — no stale visible "CDiscourse"', () => {
  it('AuthScreen carries no standalone legacy "CDiscourse" wordmark', () => {
    const offenders = AUTH_CODE.match(/(?<!Civil)\bCDiscourse\b(?!Runtime|RuntimeEnv)/g) ?? [];
    expect(offenders).toEqual([]);
  });
});

describe('UX-BRAND-ASSETS-001 (g) — useHeaderBreakpoint NOT in this card diff', () => {
  // UX-BRAND-ASSETS-002 — `src/components/AppHeader.tsx` and
  // `assets/branding/civic-discourse-logo.png` were REMOVED from this
  // zero-diff guard: UX-BRAND-ASSETS-002 deliberately swaps the masthead
  // logo to the gold lockup and width-guards the masthead sizing for the
  // wider 2.807 aspect (the gold lockup overflows otherwise). Those edits
  // are pinned by appHeader.test.ts / appHeaderResponsiveLogo.test.ts /
  // uxMobile003 / uxMobile004 / uxBrandAssets002GoldLockup.test.ts. The
  // breakpoint hook stays untouched (the band resolution is unchanged).
  function diffAgainstMain(filePath: string): string {
    try {
      return execSync(`git diff main -- "${filePath}"`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (error) {
      return `<git diff failed: ${(error as Error).message}>`;
    }
  }

  const READ_ONLY_PATHS: ReadonlyArray<string> = Object.freeze([
    'src/hooks/useHeaderBreakpoint.ts',
  ]);

  for (const rel of READ_ONLY_PATHS) {
    it(`${rel} is unchanged by UX-BRAND-ASSETS-001/002`, () => {
      expect(diffAgainstMain(rel)).toBe('');
    });
  }
});

describe('UX-BRAND-ASSETS-001 (h) — committed asset is the gold lockup', () => {
  // QUICK-BRAND-LOCKUP-002 — the Sign In lockup is now the gold/cream
  // duotone 960×342 lockup (was the gold 800×260, originally the grey
  // 1499×388 / 128,937-byte lockup). It is still a small editorial PNG
  // (< 200 KB), NOT the prior 2.3 MB scene.
  it('the lockup asset exists and is the trimmed gold horizontal lockup', () => {
    const lockupPath = path.join(ROOT, 'assets', 'branding', 'lockup-horizontal.png');
    expect(fs.existsSync(lockupPath)).toBe(true);
    const size = fs.statSync(lockupPath).size;
    // A small editorial brand PNG, comfortably under the 200 KB editorial
    // ceiling (it is NOT the prior 2.3 MB header scene).
    expect(size).toBeGreaterThan(10_000);
    expect(size).toBeLessThan(200_000);
  });

  it('it is a PNG (magic bytes)', () => {
    const lockupPath = path.join(ROOT, 'assets', 'branding', 'lockup-horizontal.png');
    const head = fs.readFileSync(lockupPath).subarray(0, 8);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('the lockup PNG is the gold 960×342 art (aspect ≈ 2.807)', () => {
    const lockupPath = path.join(ROOT, 'assets', 'branding', 'lockup-horizontal.png');
    const buf = fs.readFileSync(lockupPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(960);
    expect(height).toBe(342);
  });

  it('the masthead header logo is now the small gold lockup (no longer the 2.3 MB scene)', () => {
    // UX-BRAND-ASSETS-002 — the operator decision: the app masthead now
    // shows the gold lockup, so civic-discourse-logo.png is the same small
    // gold art, NOT the prior 2.3 MB grey water-scene.
    const headerLogo = path.join(ROOT, 'assets', 'branding', 'civic-discourse-logo.png');
    expect(fs.existsSync(headerLogo)).toBe(true);
    const size = fs.statSync(headerLogo).size;
    expect(size).toBeGreaterThan(10_000);
    expect(size).toBeLessThan(200_000);
    const buf = fs.readFileSync(headerLogo);
    expect(buf.readUInt32BE(16)).toBe(960);
    expect(buf.readUInt32BE(20)).toBe(342);
  });

  it('the new gold bird mark asset is committed (420×315)', () => {
    // UX-BRAND-ASSETS-002 — new tracked asset for "logo by itself" uses.
    const markPath = path.join(ROOT, 'assets', 'branding', 'civildiscourse-mark.png');
    expect(fs.existsSync(markPath)).toBe(true);
    const buf = fs.readFileSync(markPath);
    expect(Array.from(buf.subarray(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(buf.readUInt32BE(16)).toBe(420);
    expect(buf.readUInt32BE(20)).toBe(315);
  });
});
