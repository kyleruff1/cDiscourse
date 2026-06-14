/**
 * EMAIL-TRANSPORT-001 — test class 12 (schemas): the importable Jest mirror
 * matches the Deno `emailSchemas.ts` shapes.
 *
 * Mirrors `inviteSchemas.test.ts`: the Deno schema file imports `npm:zod@4`
 * (unloadable in Jest), so the importable `src/features/email/emailSchemasMirror.ts`
 * twin uses the Node-installed zod. This test:
 *   1. exercises the mirror's validators (accept/reject cases), and
 *   2. asserts byte-equal field/regex/length parity with the Deno source so the
 *      two cannot drift.
 */
import fs from 'fs';
import path from 'path';
import {
  ArgumentRoomInviteEmailInputSchema,
  SendTransactionalEmailInputSchema,
  TransactionalEmailMessageSchema,
} from '../src/features/email/emailSchemasMirror';

const DENO_SRC = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'functions', '_shared', 'email', 'emailSchemas.ts'),
  'utf8',
);
const MIRROR_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'email', 'emailSchemasMirror.ts'),
  'utf8',
);

describe('emailSchemasMirror — ArgumentRoomInviteEmailInputSchema', () => {
  it('accepts a well-formed input', () => {
    const parsed = ArgumentRoomInviteEmailInputSchema.parse({
      roomTitle: 'Should cities ban cars?',
      roomVisibility: 'private',
      inviterDisplayName: 'Dana',
      redemptionUrl: 'https://dev-cdiscourse.netlify.app/invite/aB12345678901234567890123456789012',
    });
    expect(parsed.roomVisibility).toBe('private');
  });

  it('accepts a null / absent inviterDisplayName', () => {
    expect(() =>
      ArgumentRoomInviteEmailInputSchema.parse({
        roomTitle: 'X',
        roomVisibility: 'public',
        inviterDisplayName: null,
        redemptionUrl: 'https://x/invite/abc',
      }),
    ).not.toThrow();
    expect(() =>
      ArgumentRoomInviteEmailInputSchema.parse({
        roomTitle: 'X',
        roomVisibility: 'public',
        redemptionUrl: 'https://x/invite/abc',
      }),
    ).not.toThrow();
  });

  it('rejects an unknown visibility', () => {
    expect(() =>
      ArgumentRoomInviteEmailInputSchema.parse({
        roomTitle: 'X',
        roomVisibility: 'secret',
        redemptionUrl: 'https://x/invite/abc',
      }),
    ).toThrow();
  });

  it('rejects an empty redemptionUrl', () => {
    expect(() =>
      ArgumentRoomInviteEmailInputSchema.parse({
        roomTitle: 'X',
        roomVisibility: 'public',
        redemptionUrl: '',
      }),
    ).toThrow();
  });
});

describe('emailSchemasMirror — SendTransactionalEmailInputSchema', () => {
  it('accepts a valid email + rendered shape', () => {
    expect(() =>
      SendTransactionalEmailInputSchema.parse({
        to: 'invitee@example.com',
        rendered: { subject: 's', html: '<p>h</p>', text: 't' },
      }),
    ).not.toThrow();
  });

  it('rejects an invalid recipient email', () => {
    expect(() =>
      SendTransactionalEmailInputSchema.parse({
        to: 'not-an-email',
        rendered: { subject: 's', html: 'h', text: 't' },
      }),
    ).toThrow();
  });

  it('rejects a rendered with an empty subject/html/text', () => {
    expect(() =>
      SendTransactionalEmailInputSchema.parse({
        to: 'a@b.com',
        rendered: { subject: '', html: 'h', text: 't' },
      }),
    ).toThrow();
  });
});

describe('emailSchemasMirror — TransactionalEmailMessageSchema', () => {
  it('accepts a full message', () => {
    expect(() =>
      TransactionalEmailMessageSchema.parse({
        to: 'a@b.com',
        from: 'CDiscourse <x@y.z>',
        replyTo: 'support@cdiscourse.com',
        subject: 's',
        html: 'h',
        text: 't',
      }),
    ).not.toThrow();
  });

  it('replyTo is optional', () => {
    expect(() =>
      TransactionalEmailMessageSchema.parse({
        to: 'a@b.com',
        from: 'CDiscourse <x@y.z>',
        subject: 's',
        html: 'h',
        text: 't',
      }),
    ).not.toThrow();
  });
});

describe('emailSchemasMirror — byte-equal parity with the Deno emailSchemas.ts', () => {
  // Normalize each source to the schema-defining lines (drop imports + comments)
  // and assert the field/zod-builder contract is identical.
  function schemaContract(src: string): string[] {
    return src
      .split('\n')
      .map((l) => l.trim())
      .filter((l) =>
        /z\.(string|object|enum|email|min|max|regex|optional|nullish)/.test(l) ||
        /^(roomTitle|roomVisibility|inviterDisplayName|redemptionUrl|to|from|replyTo|subject|html|text|rendered):/.test(l),
      )
      // Strip the `npm:zod@4` vs `zod` import difference is already excluded
      // (imports filtered out); normalize any residual whitespace.
      .map((l) => l.replace(/\s+/g, ' '));
  }

  it('the const declarations (Email / SenderAddress / RedemptionUrl) match', () => {
    for (const decl of [
      "const Email = z.string().email().max(320);",
      "const SenderAddress = z.string().min(3).max(320);",
      "const RedemptionUrl = z.string().min(1).max(2048);",
    ]) {
      expect(DENO_SRC).toContain(decl);
      expect(MIRROR_SRC).toContain(decl);
    }
  });

  it('the three exported schema bodies are field-for-field identical', () => {
    expect(schemaContract(DENO_SRC)).toEqual(schemaContract(MIRROR_SRC));
  });

  it('the Deno source imports npm:zod@4 and the mirror imports the Node zod', () => {
    expect(DENO_SRC).toContain("from 'npm:zod@4'");
    expect(MIRROR_SRC).toContain("from 'zod'");
    expect(MIRROR_SRC).not.toContain('npm:zod');
  });
});
