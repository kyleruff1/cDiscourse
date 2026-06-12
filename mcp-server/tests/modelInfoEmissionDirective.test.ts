/**
 * OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT — shared response-envelope directive tests.
 *
 * The directive is interpolated VERBATIM into all ten family*Prompt.ts user
 * prompts. These tests pin its load-bearing content, prove it carries zero
 * doctrine ban-list tokens (the test-discipline doctrine ban-scan), and prove
 * it is envelope-SHAPE text (not content / non-echo text) and family-agnostic.
 *
 * Prompt text is model-facing, so no gameCopy.toPlainLanguage mapping applies.
 */
import { MODEL_INFO_EMISSION_DIRECTIVE } from '../lib/modelInfoEmissionDirective.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';

Deno.test('modelInfoEmissionDirective: contains the load-bearing fragments', () => {
  const fragments = [
    'modelInfo',
    'exactly as shown',
    'EVERY response',
    'hostile',
    'uncertain',
    'confidence',
    'NEVER changes, omits, renames, or moves',
    'never a string and never null',
    'rejected whole',
  ];
  for (const fragment of fragments) {
    if (!MODEL_INFO_EMISSION_DIRECTIVE.includes(fragment)) {
      throw new Error(`directive missing load-bearing fragment: "${fragment}"`);
    }
  }
});

Deno.test('modelInfoEmissionDirective: carries ZERO doctrine ban-list tokens', () => {
  // The required test-discipline doctrine ban-scan. DOCTRINE_BAN_PATTERNS are
  // non-global regexes, so .test() is stateless here.
  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    if (pattern.test(MODEL_INFO_EMISSION_DIRECTIVE)) {
      throw new Error(`the modelInfo emission directive matched doctrine ban pattern ${pattern}`);
    }
  }
});

Deno.test('modelInfoEmissionDirective: mentions no ban list / no content scan (shape, not content)', () => {
  // The directive is envelope-SHAPE text, not content / non-echo text: it must
  // not reference a ban list, a content scan, or any person/intent term.
  const forbiddenSubstrings = ['ban-list', 'slur', 'person-directed', 'troll', 'evidenceSpan'];
  for (const sub of forbiddenSubstrings) {
    if (MODEL_INFO_EMISSION_DIRECTIVE.includes(sub)) {
      throw new Error(`directive unexpectedly references a content-scan concept: "${sub}"`);
    }
  }
  // "ban" is checked as a standalone word, NOT as a substring. The directive
  // legitimately contains "confidence bands" (a confidence concept, not a ban
  // list); a naive includes('ban') would false-positive on "bands". The
  // word-boundary check proves the directive carries no standalone "ban".
  if (/(^|[^a-z])ban([^a-z]|$)/i.test(MODEL_INFO_EMISSION_DIRECTIVE)) {
    throw new Error('directive unexpectedly references a standalone "ban" token');
  }
  if (/ban[\s-]?list/i.test(MODEL_INFO_EMISSION_DIRECTIVE)) {
    throw new Error('directive unexpectedly references a "ban list"');
  }
});

Deno.test('modelInfoEmissionDirective: is additive — contains no weakening qualifier', () => {
  const weakeners = ['optional', 'may omit', 'if convenient', 'when possible'];
  for (const weakener of weakeners) {
    if (MODEL_INFO_EMISSION_DIRECTIVE.toLowerCase().includes(weakener)) {
      throw new Error(`directive contains a weakening qualifier: "${weakener}"`);
    }
  }
});

Deno.test('modelInfoEmissionDirective: references the family constant, embeds no per-family literal', () => {
  for (const letter of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
    const literal = `family-${letter}-v1`;
    if (MODEL_INFO_EMISSION_DIRECTIVE.includes(literal)) {
      throw new Error(`directive embeds a per-family literal: "${literal}"`);
    }
  }
  if (!MODEL_INFO_EMISSION_DIRECTIVE.includes('classifierSetVersion')) {
    throw new Error('directive should reference classifierSetVersion (the family constant)');
  }
});

Deno.test('modelInfoEmissionDirective: is a single non-empty BINDING response-envelope block', () => {
  if (MODEL_INFO_EMISSION_DIRECTIVE.trim().length === 0) {
    throw new Error('directive is empty');
  }
  if (!MODEL_INFO_EMISSION_DIRECTIVE.startsWith('RESPONSE-ENVELOPE RULE (BINDING):')) {
    throw new Error('directive must open with the RESPONSE-ENVELOPE RULE (BINDING) marker');
  }
});
