/**
 * EMAIL-TRANSPORT-001 — test class 4: renderArgumentRoomInviteEmail.
 *
 * `emailTemplates.ts` imports `./safety.ts` (a Deno `.ts`-extension specifier),
 * so the module is not loadable into a tsc-checked test. We source-scan the
 * render fn for: the neutral subject, the brand, the CTA route + copy, the
 * public/private indicator + capacity copy, the inviter-optional path, the
 * empty-title neutral fallback, the HTML/escape hardening, and the >=44px CTA.
 */
import fs from 'fs';
import path from 'path';

const TPL_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'emailTemplates.ts'),
  'utf8',
);

describe('renderArgumentRoomInviteEmail — subject + brand + CTA', () => {
  it('uses the neutral invite subject', () => {
    expect(TPL_SRC).toContain('const subject = "You\'ve been invited to an argument";');
  });

  it('names the CDiscourse brand in both html and text', () => {
    // Brand header in html + a brand line in the text body.
    expect(TPL_SRC).toContain('>CDiscourse<');
    expect(TPL_SRC).toContain('CDiscourse — structured disagreement, focused on the claim.');
  });

  it('the CTA is "Open invitation" and its href is the redemption route (token only inside the href)', () => {
    expect(TPL_SRC).toContain('Open invitation');
    expect(TPL_SRC).toContain('href="${hrefSafe}"');
    expect(TPL_SRC).toContain('`Open invitation: ${url}`');
    // hrefSafe derives from the input redemptionUrl (the token lives inside it).
    expect(TPL_SRC).toContain('const hrefSafe = escapeHref(url);');
    expect(TPL_SRC).toContain('const url = typeof input.redemptionUrl === \'string\' ? input.redemptionUrl : \'\';');
  });
});

describe('renderArgumentRoomInviteEmail — public/private indicator + capacity copy', () => {
  it('private copy: states private + 1v1 by invitation', () => {
    expect(TPL_SRC).toContain('This is a private argument.');
    expect(TPL_SRC).toContain('Private rooms are 1v1 by invitation.');
  });

  it('public copy: states public + up-to-5 + uncapped observers', () => {
    expect(TPL_SRC).toContain('This is a public argument.');
    expect(TPL_SRC).toContain('Public rooms allow up to 5 active participants; observers are uncapped.');
  });

  it('the visibility copy is keyed by the sanitized visibility', () => {
    expect(TPL_SRC).toContain('VISIBILITY_COPY[ctx.roomVisibility]');
  });
});

describe('renderArgumentRoomInviteEmail — optional / fallback paths', () => {
  it('absent inviter name → neutral "You have been invited" (no "Someone undefined")', () => {
    expect(TPL_SRC).toContain("'You have been invited to an argument on CDiscourse.'");
    expect(TPL_SRC).toMatch(/inviter\s*\n?\s*\?\s*`\$\{inviter\} invited you to an argument on CDiscourse\.`/);
  });

  it('sanitizes the room context (empty title → "an argument"; HTML stripped) before render', () => {
    expect(TPL_SRC).toContain('sanitizeRoomContext({');
    // The neutral fallback lives in the sanitizer; the template consumes ctx.
    expect(TPL_SRC).toContain('const room = ctx.roomTitle;');
    expect(TPL_SRC).toContain('const inviter = ctx.inviterDisplayName;');
  });

  it('HTML-escapes every interpolated user value (defense-in-depth)', () => {
    expect(TPL_SRC).toContain('const introHtml = escapeHtml(introText);');
    expect(TPL_SRC).toContain('const roomHtml = escapeHtml(room);');
    // The href is attribute-escaped.
    expect(TPL_SRC).toContain('function escapeHref(');
  });
});

describe('renderArgumentRoomInviteEmail — email-client structure', () => {
  it('declares lang, viewport, a 600px max-width container, and a >=44px CTA', () => {
    expect(TPL_SRC).toContain('lang="en"');
    expect(TPL_SRC).toContain('name="viewport"');
    expect(TPL_SRC).toContain('max-width:600px');
    expect(TPL_SRC).toMatch(/padding:14px 28px/);
    expect(TPL_SRC.toLowerCase()).toContain('role="presentation"');
  });

  it('always renders a plain-text fallback (never HTML-only)', () => {
    // The function returns { subject, html, text } and builds a `text` array.
    expect(TPL_SRC).toContain('const text = [');
    expect(TPL_SRC).toContain('return { subject, html, text };');
  });
});
