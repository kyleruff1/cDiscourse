/**
 * Stage 6.1.8 — Debate title update API tests.
 */
import { validateDebateTitle, pickDisplayTitle, MAX_DEBATE_TITLE_CHARS } from '../src/features/debates/debateTitleHelpers';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(process.cwd(), 'src/features/debates/debateTitleApi.ts'), 'utf8');
const helpersSrc = fs.readFileSync(path.join(process.cwd(), 'src/features/debates/debateTitleHelpers.ts'), 'utf8');

describe('validateDebateTitle', () => {
  it('accepts empty / null titles (empty means "fall back to root excerpt")', () => {
    expect(validateDebateTitle(null)).toEqual({ ok: true, title: '' });
    expect(validateDebateTitle('')).toEqual({ ok: true, title: '' });
    expect(validateDebateTitle('   ')).toEqual({ ok: true, title: '' });
  });

  it('trims whitespace', () => {
    const r = validateDebateTitle('  hello  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.title).toBe('hello');
  });

  it('rejects titles longer than 120 characters', () => {
    const long = 'x'.repeat(MAX_DEBATE_TITLE_CHARS + 1);
    const r = validateDebateTitle(long);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/120 characters/);
  });

  it('strips control characters', () => {
    const r = validateDebateTitle('Hello\x00World\x07');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.title).toBe('HelloWorld');
  });
});

describe('pickDisplayTitle', () => {
  it('prefers explicit debate title', () => {
    expect(pickDisplayTitle({ debateTitle: 'Bike lanes', rootBody: 'Different body' })).toBe('Bike lanes');
  });

  it('falls back to root body excerpt when debateTitle is empty', () => {
    expect(pickDisplayTitle({ debateTitle: '', rootBody: 'A root claim' })).toBe('A root claim');
    expect(pickDisplayTitle({ debateTitle: null, rootBody: 'A root claim' })).toBe('A root claim');
  });

  it('falls back to "Untitled argument" when both empty', () => {
    expect(pickDisplayTitle({ debateTitle: '', rootBody: '' })).toBe('Untitled argument');
  });

  it('clamps long titles to maxChars with ellipsis', () => {
    const long = 'x'.repeat(200);
    expect(pickDisplayTitle({ debateTitle: long, maxChars: 30 })).toHaveLength(30);
    expect(pickDisplayTitle({ debateTitle: long, maxChars: 30 }).endsWith('…')).toBe(true);
  });
});

describe('debateTitleApi — file-level safety', () => {
  it('updates only the title column, never public.arguments.body', () => {
    expect(src).toMatch(/\.from\('debates'\)\s*\n?\s*\.update\(\{\s*title:\s*validated\.title\s*\}\)/);
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)/);
  });

  it('never imports a service-role client', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/createServiceClient/);
    expect(helpersSrc).not.toMatch(/SUPABASE_SERVICE_ROLE/);
  });

  it('documents that RLS handles authorization (not the client)', () => {
    expect(src).toMatch(/RLS on .public\.debates. is the authorization layer/);
  });
});
