import { assertEquals } from 'std/assert/mod.ts';
import { parseAllowedOrigins, validateOrigin } from '../lib/origin.ts';

Deno.test('parseAllowedOrigins handles empty string', () => {
  assertEquals(parseAllowedOrigins(''), []);
});

Deno.test('parseAllowedOrigins handles undefined', () => {
  assertEquals(parseAllowedOrigins(undefined), []);
});

Deno.test('parseAllowedOrigins parses comma-separated values', () => {
  const out = parseAllowedOrigins('https://a.example.com,https://b.example.com');
  assertEquals(out.length, 2);
  assertEquals(out[0], 'https://a.example.com');
  assertEquals(out[1], 'https://b.example.com');
});

Deno.test('parseAllowedOrigins trims whitespace and drops empties', () => {
  const out = parseAllowedOrigins(' https://a.example.com , , https://b.example.com ');
  assertEquals(out.length, 2);
});

Deno.test('validateOrigin allows when header absent', () => {
  const r = validateOrigin(null, ['https://a.example.com']);
  if (!r.ok) throw new Error('expected ok');
});

Deno.test('validateOrigin allows when allow-list empty (open mode)', () => {
  const r = validateOrigin('https://anywhere.example.com', []);
  if (!r.ok) throw new Error('expected ok');
});

Deno.test('validateOrigin rejects when header present but not in allow-list', () => {
  const r = validateOrigin('https://evil.example.com', ['https://allowed.example.com']);
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'origin_not_allowed');
});

Deno.test('validateOrigin allows when header matches an allowed entry', () => {
  const r = validateOrigin('https://allowed.example.com', ['https://allowed.example.com']);
  if (!r.ok) throw new Error('expected ok');
});
