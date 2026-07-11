/**
 * ASP-FLAGS-001 (#873) — static-env source guard (the web-bundle-safety proof).
 *
 * Jest runs on Node, which has a real process.env, so a behavioral test cannot
 * catch the actual defect: babel-preset-expo inlines EXPO_PUBLIC_* values ONLY
 * for STATIC member expressions (a dot access). A DYNAMIC computed read
 * (bracket-indexed by a variable) is left un-inlined and resolves to undefined in
 * the deployed web bundle, which would silently force every flag OFF in
 * production while all CI stays green.
 *
 * This is therefore a SOURCE-SCAN guard (mirrors
 * __tests__/googleAuthGateStaticEnv.test.ts for the assertion idiom and
 * __tests__/adminSemanticConfigSecretScan.test.ts for the recursive src/ walk):
 *  - each of the seven static EXPO_PUBLIC_ dot-read literals is present in the
 *    registry source (the presence of the static literal is what guarantees
 *    Metro inlining, which is invisible to jest runtime);
 *  - NO dynamic env-index read remains anywhere under src/;
 *  - the ban regex demonstrably fires on the dynamic form (not a vacuous
 *    always-green assertion);
 *  - no production surface component imports the registry in this slice (the
 *    zero-consumers contract for slice 02b).
 *
 * The banned dynamic-read substring is assembled from fragments so THIS test file
 * never contains the raw literal it scans for.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const REGISTRY_REL = path.join('src', 'lib', 'featureFlags.ts');
const REGISTRY_SOURCE = fs.readFileSync(path.join(ROOT, REGISTRY_REL), 'utf8');

// Assembled from parts so this file carries no raw dynamic-read literal.
const DYNAMIC_ENV = new RegExp('process\\.env' + '\\[');

const STATIC_FLAG_LITERALS = [
  'process.env.EXPO_PUBLIC_HOME_V2',
  'process.env.EXPO_PUBLIC_ROOM_EXCHANGE_V2',
  'process.env.EXPO_PUBLIC_PROOF_DRAWER',
  'process.env.EXPO_PUBLIC_VOICE_ENTRIES',
  'process.env.EXPO_PUBLIC_TIMESTAMP_REBUTTALS',
  'process.env.EXPO_PUBLIC_ONE_TIME_PLAYBACK',
  'process.env.EXPO_PUBLIC_MOVE_MARKS',
  // FEEDBACK-002 (#899) — the 8th ASP flag; static dot read for web inlining.
  'process.env.EXPO_PUBLIC_DERIVED_SIGNALS',
  // UX-COMPOSER-005 (#831) / QUOTE-FORGE-002 (#842) — the 9th ASP flag.
  'process.env.EXPO_PUBLIC_QUOTE_FORGE',
  // UX-FLAGS-004 (#836) — the 10th ASP flag; static dot read for web inlining.
  'process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS',
];

/** Recursively collect all `.ts` / `.tsx` source under a directory. */
function readTree(dir: string): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
        out.push({ rel: path.relative(ROOT, p), src: fs.readFileSync(p, 'utf8') });
      }
    }
  }
  walk(dir);
  return out;
}

describe('ASP-FLAGS-001 (#873) — featureFlags static env access', () => {
  it.each(STATIC_FLAG_LITERALS)(
    'reads %s via STATIC dot access (so Expo/Metro inlines it on web)',
    (literal) => {
      expect(REGISTRY_SOURCE).toContain(literal);
    },
  );

  it('the registry source contains no dynamic env-index read (the #776 defect form)', () => {
    expect(DYNAMIC_ENV.test(REGISTRY_SOURCE)).toBe(false);
  });
});

describe('ASP-FLAGS-001 (#873) — no dynamic env-index read anywhere under src/', () => {
  it('bans the dynamic env-index form across all .ts/.tsx under src/', () => {
    const offenders = readTree(path.join(ROOT, 'src'))
      .filter((f) => DYNAMIC_ENV.test(f.src))
      .map((f) => f.rel.replace(/\\/g, '/'));
    expect(offenders).toEqual([]);
  });

  it('the ban regex fires on the dynamic form (red-on-violation self-test)', () => {
    // Fixture built from fragments so this file carries no raw dynamic-read literal.
    const fixture = 'const flag = process.env' + '[name];';
    expect(DYNAMIC_ENV.test(fixture)).toBe(true);
  });
});

describe('ASP-FLAGS-001 (#873) / HOME-001 (#874) — feature-flag consumer allowlist', () => {
  // NOTE: HOME-001 (#874) is the first legitimate consumer of the flag
  // registry. The nav seam (App.tsx, repo root) owns the landing choice, so the
  // flag read lives there and NOWHERE in the feature/component tree. This guard
  // is relaxed from the slice-02b "zero consumers" assertion into a POSITIVE
  // allowlist: the feature/component tree must stay clean (a presentational
  // component must never couple to global env state), and App.tsx is the sole
  // allowlisted importer.
  it('no file under src/features or src/components imports featureFlags (guard preserved)', () => {
    const dirs = [path.join(ROOT, 'src', 'features'), path.join(ROOT, 'src', 'components')];
    const importers: string[] = [];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const { rel, src } of readTree(dir)) {
        if (/from\s+['"][^'"]*featureFlags['"]/.test(src)) {
          importers.push(rel.replace(/\\/g, '/'));
        }
      }
    }
    expect(importers).toEqual([]);
  });

  it('App.tsx is the sole allowlisted production consumer of the flag registry', () => {
    const appSource = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    // App.tsx reads exactly the HOME-001 accessor from the registry.
    expect(appSource).toMatch(/import\s+\{\s*isHomeV2Enabled\s*\}\s+from\s+['"]\.\/src\/lib\/featureFlags['"]/);
    expect(appSource).toContain('isHomeV2Enabled()');
  });
});
