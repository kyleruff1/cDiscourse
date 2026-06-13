/**
 * AUTH-INVITE-BRANDED-SMOKE-2026-06-13 — branded invite email template guards.
 *
 * The Supabase "Invite user" email body is supabase/templates/invite.html. These
 * tests pin the doctrine + deliverability contract: brand, CTA, exactly one
 * invite-link variable, a plain fallback link, accessible structure, no
 * verdict/person copy, and that supabase/config.toml actually points the invite
 * template at the file.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..');
const TEMPLATE = readFileSync(join(REPO_ROOT, 'supabase/templates/invite.html'), 'utf8');
const CONFIG = readFileSync(join(REPO_ROOT, 'supabase/config.toml'), 'utf8');

/** Strip HTML comments so doctrine scans see only rendered copy. */
const RENDERED = TEMPLATE.replace(/<!--[\s\S]*?-->/g, '');

// Verdict / person tokens forbidden in any user-facing copy (cdiscourse-doctrine §1).
const FORBIDDEN_TOKENS = [
  'winner', 'loser', 'correct', 'incorrect', 'truth', 'untrue', 'dishonest',
  'liar', 'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
  'verdict', 'bad faith',
];

describe('branded invite template — brand + purpose + value prop', () => {
  it('names the CDiscourse brand', () => {
    expect(RENDERED).toContain('CDiscourse');
  });

  it('states the invite purpose (a structured-disagreement workspace)', () => {
    expect(RENDERED.toLowerCase()).toContain('invited to join');
    expect(RENDERED.toLowerCase()).toContain('structured disagreement');
  });

  it('carries the claim/source/quote/scope/next-move value proposition', () => {
    const lower = RENDERED.toLowerCase();
    expect(lower).toContain('claim');
    expect(lower).toContain('source');
    expect(lower).toContain('quote');
    expect(lower).toContain('scope');
    expect(lower).toContain('next move');
  });
});

describe('branded invite template — CTA + invite link', () => {
  it('has an "Accept invite" CTA', () => {
    expect(RENDERED).toContain('Accept invite');
  });

  it('uses the Supabase invite-link variable {{ .ConfirmationURL }} as the link target', () => {
    expect(TEMPLATE).toContain('{{ .ConfirmationURL }}');
  });

  it('does NOT construct a competing custom confirm URL ({{ .TokenHash }}) — that path needs an unbuilt /auth/callback consumer', () => {
    expect(TEMPLATE).not.toContain('{{ .TokenHash }}');
  });

  it('the only auth-link variable is ConfirmationURL (no standalone {{ .RedirectTo }} link)', () => {
    // RedirectTo is already baked into ConfirmationURL by Supabase; a standalone
    // {{ .RedirectTo }} link would be a second, unverified target.
    expect(TEMPLATE).not.toContain('href="{{ .RedirectTo }}"');
  });

  it('provides a plain fallback link for clients that strip the button', () => {
    expect(RENDERED.toLowerCase()).toContain('copy and paste this link');
    // ConfirmationURL appears as both the button href and the visible fallback.
    const occurrences = (TEMPLATE.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('shows a safety note scoped to the invited recipient', () => {
    expect(TEMPLATE).toContain('{{ .Email }}');
    expect(RENDERED.toLowerCase()).toContain('meant only for you');
  });
});

describe('branded invite template — doctrine + copy hygiene', () => {
  it('contains no verdict / person-judgment tokens in rendered copy', () => {
    const lower = RENDERED.toLowerCase();
    for (const token of FORBIDDEN_TOKENS) {
      expect(lower).not.toContain(token);
    }
  });

  it('contains no raw snake_case internal codes in rendered copy', () => {
    // Allow CSS/attribute names; scan only visible text nodes for snake_case words.
    const visibleText = RENDERED.replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]+\}\}/g, ' ');
    expect(visibleText).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
  });

  it('uses no manipulative-urgency language', () => {
    const lower = RENDERED.toLowerCase();
    for (const urgent of ['act now', 'expires in', 'last chance', 'hurry', 'urgent', "don't miss"]) {
      expect(lower).not.toContain(urgent);
    }
  });
});

describe('branded invite template — email-client accessibility/structure', () => {
  it('declares a language and a responsive viewport', () => {
    expect(TEMPLATE).toContain('lang="en"');
    expect(TEMPLATE).toContain('name="viewport"');
  });

  it('uses a max-width container (email-safe table layout)', () => {
    expect(TEMPLATE).toContain('max-width:600px');
    expect(TEMPLATE.toLowerCase()).toContain('role="presentation"');
  });

  it('gives the CTA a large tap target (>=44px effective height via padding)', () => {
    // 14px top+bottom padding + 24px line-height = 52px effective.
    expect(TEMPLATE).toMatch(/padding:14px 28px/);
  });
});

describe('invite template wiring — supabase/config.toml', () => {
  it('activates the invite template block (uncommented)', () => {
    expect(CONFIG).toMatch(/^\[auth\.email\.template\.invite\]/m);
  });

  it('points content_path at the branded template file', () => {
    expect(CONFIG).toContain('content_path = "./supabase/templates/invite.html"');
  });

  it('sets a branded subject', () => {
    expect(CONFIG).toMatch(/^subject = "You're invited to CDiscourse"/m);
  });
});

// ── Malformed-markup guards (AUTH-INVITE-TEMPLATE-GUARDS-2026-06-13) ──
// These pin the mechanical integrity of the rendered HTML so a future edit that
// corrupts a container attribute, an href, or a template variable is caught by
// jest rather than only in a live email client.
describe('branded invite template — malformed-markup guards', () => {
  const OPEN_TAGS = TEMPLATE.match(/<[a-zA-Z][^>]*>/g) ?? [];

  it('the main 600px container table is intact (clean border="0" + max-width, no corrupted attribute)', () => {
    const containerLine = TEMPLATE.split('\n').find((l) => l.includes('class="cd-container"'));
    expect(containerLine).toBeDefined();
    // Each attribute is well-formed: name="value" with a closing quote.
    expect(containerLine).toMatch(/border="0"/);
    expect(containerLine).toMatch(/max-width:600px/);
    // No corrupted border attribute, e.g. border="0th… (digit/quote then junk).
    expect(containerLine).not.toMatch(/border="0[^"]/);
  });

  it('contains no unterminated/corrupted attribute quotes in any open tag', () => {
    for (const tag of OPEN_TAGS) {
      // Strip the leading "<name" and trailing ">"; every remaining double-quote
      // must pair up (even count) so no attribute value is left unterminated.
      const quoteCount = (tag.match(/"/g) ?? []).length;
      expect(quoteCount % 2).toBe(0);
    }
  });

  it('every href in the template is exactly the ConfirmationURL variable (no malformed or stray link target)', () => {
    const hrefs = TEMPLATE.match(/href="[^"]*"/g) ?? [];
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toBe('href="{{ .ConfirmationURL }}"');
    }
  });

  it('every {{ … }} template variable is one of the allowed, correctly-spelled set', () => {
    // Catches typos (e.g. {{ .ConfirmationUrl }}), unsupported variables
    // ({{ .TokenHash }}, {{ .RedirectTo }}), and malformed brace/space forms.
    const ALLOWED = new Set(['{{ .ConfirmationURL }}', '{{ .Email }}']);
    const vars = TEMPLATE.match(/\{\{[^}]*\}\}/g) ?? [];
    expect(vars.length).toBeGreaterThan(0);
    for (const v of vars) {
      expect(ALLOWED.has(v)).toBe(true);
    }
  });

  it('every Supabase variable name uses the canonical {{ .X }} wrapper (catches single-brace/zero-space typos)', () => {
    // After removing the canonical forms, the Supabase variable NAMES must not
    // appear anywhere — a leftover `.ConfirmationURL` / `.Email` would mean a
    // mis-wrapped form like `{ .ConfirmationURL }` or `{{.ConfirmationURL}}`.
    // (This is name-scoped so legitimate CSS braces — e.g. `{ .cd-container` —
    // never trip it.)
    const stripped = TEMPLATE.replace(/\{\{ \.(?:ConfirmationURL|Email) \}\}/g, '');
    expect(stripped).not.toMatch(/\.ConfirmationURL/);
    expect(stripped).not.toMatch(/\.Email/);
  });

  it('the CTA anchor and the visible fallback link both resolve to ConfirmationURL', () => {
    // CTA button anchor.
    expect(TEMPLATE).toMatch(/<a[^>]+class="cd-cta"[^>]+href="\{\{ \.ConfirmationURL \}\}"/);
    // Visible fallback: an anchor whose href AND text are the ConfirmationURL.
    expect(TEMPLATE).toMatch(/<a href="\{\{ \.ConfirmationURL \}\}"[^>]*>\{\{ \.ConfirmationURL \}\}<\/a>/);
  });

  it('has balanced <table> open/close tags (no truncated container)', () => {
    const opens = (TEMPLATE.match(/<table\b/g) ?? []).length;
    const closes = (TEMPLATE.match(/<\/table>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});
