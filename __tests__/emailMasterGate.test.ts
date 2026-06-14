/**
 * EMAIL-TRANSPORT-001 — test class 2 + 10: the master gate ladder + the
 * provider-failure neutral-state mapping in `sendTransactionalEmail`.
 *
 * `sendTransactionalEmail.ts` reads the Deno global + imports the provider chain
 * with `.ts` specifiers, so (per the established Deno-Edge testing constraint)
 * it is source-scanned for the gate ladder ORDER + the short-circuit returns.
 * The pure ban-list engine it calls is runtime-tested in
 * emailSafetySanitizers.test.ts.
 *
 * Ordering checks run against the COMMENT-STRIPPED source so the docstring's
 * gate-ladder pseudocode (which names the same identifiers) cannot be mistaken
 * for executable code.
 */
import fs from 'fs';
import path from 'path';

const RAW = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'sendTransactionalEmail.ts'),
  'utf8',
);
// Executable code only — strip block + line comments.
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('sendTransactionalEmail — gate ladder (order is load-bearing)', () => {
  it('step 1: the master gate short-circuits to skipped_gate_off BEFORE any provider/network', () => {
    expect(SRC).toMatch(/if \(!isTransportMasterEnabled\(env\)\) \{[\s\S]{0,80}?return \{ status: 'skipped_gate_off' \};/);
    const masterIdx = SRC.indexOf('isTransportMasterEnabled(env)');
    const providerIdx = SRC.indexOf('getEmailProvider(env)');
    const sendIdx = SRC.indexOf('provider.send(');
    expect(masterIdx).toBeGreaterThan(-1);
    expect(masterIdx).toBeLessThan(providerIdx);
    expect(masterIdx).toBeLessThan(sendIdx);
  });

  it('the master gate predicate requires the literal string "true"', () => {
    const fn = SRC.slice(SRC.indexOf('function isTransportMasterEnabled'), SRC.indexOf('function isTransportMasterEnabled') + 200);
    expect(fn).toContain('CDISCOURSE_EMAIL_TRANSPORT_ENABLED');
    expect(fn).toMatch(/\.trim\(\)\.toLowerCase\(\) === 'true'/);
  });

  it('step 2: missing provider OR CDISCOURSE_EMAIL_FROM → not_configured (no send)', () => {
    expect(SRC).toMatch(/if \(!provider \|\| !from\) \{[\s\S]{0,80}?return \{ status: 'not_configured' \};/);
    expect(SRC).toContain("env.CDISCOURSE_EMAIL_FROM");
    const fromIdx = SRC.indexOf('!provider || !from');
    const sendIdx = SRC.indexOf('provider.send(');
    expect(fromIdx).toBeLessThan(sendIdx);
  });

  it('step 3: an implausible recipient → not_configured (no send)', () => {
    expect(SRC).toMatch(/if \(!isPlausibleEmail\(to\)\) \{[\s\S]{0,80}?return \{ status: 'not_configured' \};/);
    const toIdx = SRC.indexOf('isPlausibleEmail(to)');
    const sendIdx = SRC.indexOf('provider.send(');
    expect(toIdx).toBeLessThan(sendIdx);
  });

  it('step 4: banned copy → blocked_banned_copy (no send), via the runtime ban-list', () => {
    expect(SRC).toMatch(/if \(!assertNoBannedTokens\(subject, html, text\)\) \{[\s\S]{0,80}?return \{ status: 'blocked_banned_copy' \};/);
    const banIdx = SRC.indexOf('assertNoBannedTokens(subject');
    const sendIdx = SRC.indexOf('provider.send(');
    expect(banIdx).toBeLessThan(sendIdx);
  });

  it('step 5: only after every gate passes does it call provider.send', () => {
    expect(SRC).toContain('return provider.send(message);');
  });
});

describe('sendTransactionalEmail — sender identity resolved server-side', () => {
  it('reads CDISCOURSE_EMAIL_FROM + CDISCOURSE_EMAIL_REPLY_TO from env, not from the caller', () => {
    expect(SRC).toContain('CDISCOURSE_EMAIL_FROM');
    expect(SRC).toContain('CDISCOURSE_EMAIL_REPLY_TO');
    // The caller input shape is only { to, rendered } — no from/replyTo.
    const inputIface = SRC.slice(SRC.indexOf('interface SendTransactionalEmailInput'), SRC.indexOf('interface SendTransactionalEmailInput') + 200);
    expect(inputIface).toContain('to:');
    expect(inputIface).toContain('rendered:');
    expect(inputIface).not.toMatch(/\bfrom:/);
    expect(inputIface).not.toMatch(/replyTo/);
  });

  it('omits replyTo from the message when unset (conditional spread)', () => {
    expect(SRC).toMatch(/\.\.\.\(replyTo \? \{ replyTo \} : \{\}\)/);
  });
});

describe('sendTransactionalEmail — returns the provider result verbatim (neutral state, test class 10)', () => {
  it('the final return is the provider send result (failed_sanitized + class flow through)', () => {
    // No re-wrapping of the provider failure — the audit-safe status flows up.
    expect(SRC).toContain('return provider.send(message);');
    // It does not synthesize a 'sent' on failure or swallow the class.
    expect(SRC).not.toMatch(/catch[\s\S]{0,40}return \{ status: 'sent'/);
  });

  it('reads only the five relevant env keys into the bag (no secret echo)', () => {
    const bag = SRC.slice(SRC.indexOf('function denoEnvBag'));
    for (const k of [
      'CDISCOURSE_EMAIL_TRANSPORT_ENABLED',
      'CDISCOURSE_EMAIL_PROVIDER',
      'CDISCOURSE_EMAIL_FROM',
      'CDISCOURSE_EMAIL_REPLY_TO',
      'RESEND_API_KEY',
    ]) {
      expect(bag).toContain(k);
    }
    // No console.* of the bag.
    expect(bag).not.toMatch(/console\./);
  });
});
