// HOST-SIMPLE-001 — Sanity tests for the Netlify deploy config.
//
// We don't fully parse TOML (no new dep) — we assert the strings the
// runbook + Netlify both depend on, and that no secret-shaped string,
// no service-role reference, and no real Supabase URL leaks into the
// committed config file.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..');
const NETLIFY_TOML = join(REPO_ROOT, 'netlify.toml');
const RUNBOOK = join(REPO_ROOT, 'docs', 'deployment', 'host-simple-001-netlify-runbook.md');
const PACKAGE_JSON = join(REPO_ROOT, 'package.json');

function readToml(): string {
  return readFileSync(NETLIFY_TOML, 'utf8');
}

function readRunbook(): string {
  return readFileSync(RUNBOOK, 'utf8');
}

describe('HOST-SIMPLE-001 netlify.toml', () => {
  it('exists at the repo root', () => {
    expect(existsSync(NETLIFY_TOML)).toBe(true);
  });

  it('declares the build command as `npm ci && npm run web:build`', () => {
    expect(readToml()).toMatch(/command\s*=\s*"npm ci && npm run web:build"/);
  });

  it('declares the publish directory as `dist`', () => {
    expect(readToml()).toMatch(/publish\s*=\s*"dist"/);
  });

  it('pins Node 22 (matches HOST-001 Dockerfile builder)', () => {
    expect(readToml()).toMatch(/NODE_VERSION\s*=\s*"22"/);
  });

  it('declares an SPA fallback redirect to /index.html with status 200', () => {
    const toml = readToml();
    expect(toml).toMatch(/\[\[redirects\]\]/);
    expect(toml).toMatch(/from\s*=\s*"\/\*"/);
    expect(toml).toMatch(/to\s*=\s*"\/index\.html"/);
    expect(toml).toMatch(/status\s*=\s*200/);
  });

  it('sets baseline security headers', () => {
    const toml = readToml();
    expect(toml).toMatch(/X-Content-Type-Options\s*=\s*"nosniff"/);
    expect(toml).toMatch(/X-Frame-Options\s*=\s*"DENY"/);
    expect(toml).toMatch(/Referrer-Policy/);
  });

  it('caches /static/* aggressively and /index.html not at all', () => {
    const toml = readToml();
    expect(toml).toMatch(/for\s*=\s*"\/static\/\*"[\s\S]*?max-age=31536000/);
    expect(toml).toMatch(/for\s*=\s*"\/index\.html"[\s\S]*?no-cache, no-store, must-revalidate/);
  });

  it('omits the two EXPO_PUBLIC_ Supabase keys from secrets scan (publishable key is safe by design)', () => {
    const toml = readToml();
    expect(toml).toMatch(
      /SECRETS_SCAN_OMIT_KEYS\s*=\s*"EXPO_PUBLIC_SUPABASE_URL,EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"/
    );
  });

  describe('safety: no secrets or value-shaped strings in the file', () => {
    const FORBIDDEN_VALUE_SHAPES: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Anthropic key', pattern: /sk-ant-[A-Za-z0-9_-]{12,}/ },
      { name: 'xAI key', pattern: /xai-[A-Za-z0-9_-]{20,}/ },
      { name: 'Supabase secret key prefix', pattern: /sb_secret_[A-Za-z0-9_-]+/ },
      { name: 'Bearer token', pattern: /Bearer [A-Za-z0-9._-]{16,}/ },
      { name: 'JWT-shape', pattern: /eyJ[A-Za-z0-9_-]{20,}\./ },
      { name: 'Supabase service-role assignment', pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=/ },
      { name: 'Anthropic API key assignment', pattern: /ANTHROPIC_API_KEY\s*=/ },
      { name: 'Resend API key assignment', pattern: /RESEND_API_KEY\s*=/ },
      { name: 'xAI API key assignment', pattern: /XAI_API_KEY\s*=/ },
      { name: 'X Bearer token assignment', pattern: /X_BEARER_TOKEN\s*=/ },
    ];

    it.each(FORBIDDEN_VALUE_SHAPES)('does not contain $name', ({ pattern }) => {
      expect(readToml()).not.toMatch(pattern);
    });

    it('does not contain any literal supabase.co URL (real project ref leak guard)', () => {
      // The runbook describes the URL shape with <project-ref>; the toml itself
      // must not reference any literal supabase.co host.
      expect(readToml()).not.toMatch(/[a-z0-9-]+\.supabase\.co/);
    });

    it('does not set SUPABASE_SERVICE_ROLE_KEY as an env var (mention in doctrine comments is fine)', () => {
      // We allow the word "service-role" in comments that warn against using it.
      // What we forbid is an actual TOML key assignment that would push it into Cloud Run env.
      // The earlier FORBIDDEN_VALUE_SHAPES test already covers `SUPABASE_SERVICE_ROLE_KEY =`,
      // but we add the stricter `*SERVICE_ROLE*` catch-all here too.
      const toml = readToml();
      // Match a TOML assignment of any service-role-shaped key.
      expect(toml).not.toMatch(/^\s*[A-Z_]*SERVICE[_-]ROLE[A-Z_]*\s*=/m);
    });
  });
});

describe('HOST-SIMPLE-001 runbook', () => {
  it('exists', () => {
    expect(existsSync(RUNBOOK)).toBe(true);
  });

  it('warns explicitly against adding service-role / Anthropic / xAI / Resend keys to Netlify', () => {
    const md = readRunbook();
    expect(md).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(md).toMatch(/ANTHROPIC_API_KEY/);
    expect(md).toMatch(/XAI_API_KEY|X_BEARER_TOKEN/);
    expect(md).toMatch(/RESEND_API_KEY/);
    expect(md).toMatch(/Do not add|Do NOT add|never|Never/);
  });

  it('tells the operator NOT to paste secret values into Claude or any agent', () => {
    expect(readRunbook()).toMatch(/Do NOT paste those values into Claude|do not paste them anywhere/i);
  });

  it('names a smoke check for SPA refresh', () => {
    expect(readRunbook()).toMatch(/SPA refresh|browser refresh|hit browser refresh/i);
  });

  it('names a smoke check that the bundle has no service-role / no token-shaped strings', () => {
    const md = readRunbook();
    expect(md).toMatch(/service_role/);
    expect(md).toMatch(/sk-ant-|sb_secret_|xai-|Bearer/);
  });

  it('references the HOST-001 / HOST-006 / HOST-007 long-term path so this card is explicitly a stopgap', () => {
    const md = readRunbook();
    expect(md).toMatch(/HOST-001/);
    expect(md).toMatch(/HOST-006/);
    expect(md).toMatch(/HOST-007/);
    expect(md).toMatch(/stopgap|temporary|deferred|long-term/i);
  });

  it('does not embed any literal supabase.co URL or any value-shaped secret', () => {
    const md = readRunbook();
    expect(md).not.toMatch(/sk-ant-[A-Za-z0-9_-]{12,}/);
    expect(md).not.toMatch(/xai-[A-Za-z0-9_-]{20,}/);
    expect(md).not.toMatch(/sb_secret_[A-Za-z0-9_-]+/);
    expect(md).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./);
    // Allow doc-style placeholder hosts but no real one.
    const supabaseHostMatches = md.match(/[a-z0-9-]+\.supabase\.co/g) ?? [];
    for (const host of supabaseHostMatches) {
      // The only allowed match is the literal example shown to the operator: <project-ref>.supabase.co
      expect(host).toMatch(/^<.*>\.supabase\.co$|^[a-z]+-ref.supabase\.co$/);
    }
  });
});

describe('HOST-SIMPLE-001 cross-card invariants', () => {
  it('package.json still has the web:build script (HOST-001 contract)', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
    expect(pkg.scripts['web:build']).toBe('expo export --platform web --output-dir dist');
  });

  it('netlify build, package.json web:build, and Dockerfile all run the same Expo Web export', () => {
    // The Dockerfile runs `npx expo export --platform web --output-dir dist` directly
    // (HOST-001 line 51), while package.json `web:build` and netlify.toml both invoke
    // it through npm. All three paths must produce the same `dist/` so a regression in
    // any one is caught here.
    const toml = readToml();
    const dockerfile = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf8');
    expect(toml).toMatch(/npm run web:build/);
    expect(dockerfile).toMatch(/expo export --platform web/);
    expect(dockerfile).toMatch(/--output-dir dist/);
  });

  it('netlify publish dir matches the Expo web export output dir (Dockerfile + web:build)', () => {
    // All three must agree on `dist`. If one changes, this test fails loud.
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
    const dockerfile = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf8');
    expect(pkg.scripts['web:build']).toMatch(/--output-dir dist/);
    expect(dockerfile).toMatch(/--output-dir dist/);
    expect(readToml()).toMatch(/publish\s*=\s*"dist"/);
  });
});
