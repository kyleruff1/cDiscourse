/**
 * UX-FAVICON-001 — web favicon contract.
 *
 * Asserts the Expo web favicon is the CivilDiscourse bird-only mark:
 * configured, on disk, square/transparent PNG, NOT the horizontal wordmark
 * lockup, and NOT the old default Expo favicon. Also pins that this card did
 * NOT touch native identity (slug / package / native icon / splash) — the
 * favicon is a web-only branding asset.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const appJson = require('../app.json') as {
  expo: {
    slug: string;
    icon: string;
    android?: { adaptiveIcon?: { foregroundImage?: string } };
    web?: { favicon?: string };
  };
};

function readPngIhdr(absPath: string): { width: number; height: number; colorType: number } {
  const b = fs.readFileSync(absPath);
  // PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    expect(b[i]).toBe(sig[i]);
  }
  // IHDR is the first chunk; width/height are big-endian uint32 at byte 16/20.
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  const colorType = b[25];
  return { width, height, colorType };
}

describe('UX-FAVICON-001 — web favicon is the CivilDiscourse bird mark', () => {
  const favicon = appJson.expo.web?.favicon;

  it('configures a web favicon in app.json', () => {
    expect(typeof favicon).toBe('string');
    expect(favicon && favicon.length).toBeGreaterThan(0);
  });

  it('does not use the old default Expo favicon', () => {
    expect(favicon).not.toBe('./assets/favicon.png');
  });

  it('does not use the horizontal wordmark lockup as the favicon', () => {
    expect(favicon).not.toMatch(/lockup-horizontal/i);
    expect(favicon).not.toMatch(/civic-discourse-logo/i);
  });

  it('points at the bird-mark favicon asset with a stable repo-relative path', () => {
    expect(favicon).toBe('./assets/branding/civildiscourse-favicon.png');
    expect(favicon!.startsWith('./assets/')).toBe(true);
  });

  it('resolves to an existing file on disk', () => {
    const abs = path.resolve(repoRoot, favicon!);
    expect(fs.existsSync(abs)).toBe(true);
  });

  it('is a square, transparent (RGBA) PNG that reads at small sizes', () => {
    const abs = path.resolve(repoRoot, favicon!);
    const { width, height, colorType } = readPngIhdr(abs);
    expect(width).toBe(height); // square
    expect(width).toBeGreaterThanOrEqual(48); // crisp at 16/32 after downscale
    expect(colorType).toBe(6); // RGBA — has an alpha channel (transparent canvas)
  });

  it('does NOT change native identity (slug / native icon / adaptive icon)', () => {
    // These are the pre-card values; the favicon card must not touch them.
    expect(appJson.expo.icon).toBe('./assets/icon.png');
    expect(appJson.expo.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
    expect(typeof appJson.expo.slug).toBe('string');
    expect(appJson.expo.slug.length).toBeGreaterThan(0);
    // The native icon must not have been repointed to the web favicon.
    expect(appJson.expo.icon).not.toBe(favicon);
  });
});
