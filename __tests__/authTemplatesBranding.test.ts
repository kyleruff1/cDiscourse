/**
 * EMAIL-TRANSPORT-001 — test class 12 (Auth templates): branding contract over
 * EVERY supabase/templates/*.html Auth template.
 *
 * Extends authBrandedInviteTemplate.test.ts to a directory-wide invariant so a
 * future Auth template (recovery / magic-link / confirmation / email-change —
 * the documented follow-up) cannot ship un-branded or with a disallowed
 * Supabase variable. Today only invite.html exists; this suite scales as the
 * follow-up templates land.
 *
 * Each template must: name CDiscourse, show NO visible "Supabase", use ONLY the
 * allowed Supabase variables, be ban-list clean, have a >=44px CTA, and be
 * registered in config.toml with a content_path.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();
const TEMPLATES_DIR = path.join(REPO_ROOT, 'supabase', 'templates');
const CONFIG = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8');

const TEMPLATE_FILES = fs
  .readdirSync(TEMPLATES_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

// Allowed Supabase template variables (the only link variable is ConfirmationURL).
const ALLOWED_VARS = new Set(['{{ .ConfirmationURL }}', '{{ .Email }}', '{{ .RedirectTo }}']);
const ALLOWED_VAR_PREFIX = '{{ .Data.'; // sanitized non-secret metadata only

const FORBIDDEN_TOKENS = [
  'winner', 'loser', 'correct', 'incorrect', 'truth', 'untrue', 'dishonest',
  'liar', 'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
  'verdict', 'bad faith', 'challenger', 'opponent',
];

describe('auth templates — at least the branded invite template exists', () => {
  it('supabase/templates contains invite.html (the shipped branded pattern)', () => {
    expect(TEMPLATE_FILES).toContain('invite.html');
  });
});

describe.each(TEMPLATE_FILES)('auth template %s — branding + doctrine contract', (file) => {
  const TEMPLATE = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
  const RENDERED = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '');

  it('names the CDiscourse brand', () => {
    expect(RENDERED).toContain('CDiscourse');
  });

  it('shows NO visible "Supabase" in rendered copy', () => {
    // Strip tags + template vars; the visible text must never read "Supabase".
    const visible = RENDERED.replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]+\}\}/g, ' ');
    expect(visible).not.toMatch(/Supabase/i);
  });

  it('uses ONLY allowed Supabase template variables', () => {
    const vars = TEMPLATE.match(/\{\{[^}]*\}\}/g) ?? [];
    for (const v of vars) {
      const allowed = ALLOWED_VARS.has(v) || v.startsWith(ALLOWED_VAR_PREFIX);
      expect({ file, v, allowed }).toMatchObject({ allowed: true });
    }
  });

  it('the only auth-link variable is {{ .ConfirmationURL }} (no hand-built links / TokenHash)', () => {
    expect(TEMPLATE).not.toContain('{{ .TokenHash }}');
    const hrefs = TEMPLATE.match(/href="[^"]*"/g) ?? [];
    for (const href of hrefs) {
      // Every href is either the ConfirmationURL variable or a mailto/no link.
      expect(href === 'href="{{ .ConfirmationURL }}"' || href.startsWith('href="mailto:')).toBe(true);
    }
  });

  it('is ban-list clean (no verdict / person-judgment tokens)', () => {
    const lower = RENDERED.toLowerCase();
    for (const token of FORBIDDEN_TOKENS) {
      const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`);
      expect({ file, token, hit: re.test(lower) }).toMatchObject({ hit: false });
    }
  });

  it('has HTML structure + a >=44px CTA tap target + a viewport', () => {
    expect(TEMPLATE).toContain('name="viewport"');
    expect(TEMPLATE).toContain('max-width:600px');
    // >=44px effective height via 14px top/bottom padding + line-height.
    expect(TEMPLATE).toMatch(/padding:14px 28px/);
  });

  it('is registered in config.toml with a content_path', () => {
    // Each shipped template file must be referenced by a content_path entry so
    // local dev loads the branded version (the hosted push stays operator-gated).
    expect(CONFIG).toContain(`content_path = "./supabase/templates/${file}"`);
  });
});

describe('auth invite template — config.toml registration', () => {
  it('the invite template block is active + branded subject', () => {
    expect(CONFIG).toMatch(/^\[auth\.email\.template\.invite\]/m);
    expect(CONFIG).toContain('content_path = "./supabase/templates/invite.html"');
    expect(CONFIG).toMatch(/^subject = "You're invited to CDiscourse"/m);
  });
});
