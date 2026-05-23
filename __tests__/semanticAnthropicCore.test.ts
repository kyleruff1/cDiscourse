/**
 * MCP-017 — semantic-referee Anthropic classifier core unit tests.
 *
 * Covers the zod-free, Jest-importable core (`anthropicClassifierCore.ts` +
 * `seedPrompt.ts`), loaded via the `_helpers/semanticRefereeDeno.ts` bridge.
 * These are the pure functions the live provider (`anthropicProvider.ts`)
 * composes — they touch no `fetch`, no `Deno`, no `npm:zod`, so Jest runs them
 * directly (design §8 "Test reality").
 *
 * Every public function gets a happy-path + failure-case test — the pure-TS
 * model bar (test-discipline).
 */
import {
  DEFAULT_SEMANTIC_REFEREE_MODEL,
  ANTHROPIC_MAX_TOKENS,
  ANTHROPIC_TEMPERATURE,
  SEMANTIC_REFEREE_SYSTEM_PROMPT,
  buildAnthropicRequestBody,
  extractAnthropicContentText,
  parseJsonFromContent,
  sanitizeRawPayload,
  buildClassifierPrompt,
  CLASSIFIER_QUESTION_TEXT,
  SEED_PROMPT_VERSION,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body that narrows the parent claim.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent', 'narrows_claim'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

// ── DEFAULT_SEMANTIC_REFEREE_MODEL + constants ────────────────────

describe('anthropicClassifierCore — constants', () => {
  it('DEFAULT_SEMANTIC_REFEREE_MODEL is the documented Haiku-class alias', () => {
    expect(DEFAULT_SEMANTIC_REFEREE_MODEL).toBe('claude-haiku-4-5');
  });

  it('MAX_TOKENS is a small bounded integer', () => {
    expect(Number.isInteger(ANTHROPIC_MAX_TOKENS)).toBe(true);
    expect(ANTHROPIC_MAX_TOKENS).toBeGreaterThan(0);
    expect(ANTHROPIC_MAX_TOKENS).toBeLessThanOrEqual(2000);
  });

  it('TEMPERATURE is 0 — deterministic decoding', () => {
    expect(ANTHROPIC_TEMPERATURE).toBe(0);
  });

  it('the system prompt forbids verdict / truth / winner / popularity language', () => {
    const lower = SEMANTIC_REFEREE_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('do not decide who is right');
    expect(lower).toContain('do not assign a truth value');
    expect(lower).toContain('strict json');
    // It asks for structure, not a verdict.
    expect(lower).toContain('structural');
  });
});

// ── buildAnthropicRequestBody ─────────────────────────────────────

describe('buildAnthropicRequestBody', () => {
  it('produces the Anthropic Messages API request shape', () => {
    const body = buildAnthropicRequestBody(makeRequest(), 'claude-haiku-4-5');
    expect(body.model).toBe('claude-haiku-4-5');
    expect(body.max_tokens).toBe(ANTHROPIC_MAX_TOKENS);
    expect(body.temperature).toBe(0);
    expect(body.system).toBe(SEMANTIC_REFEREE_SYSTEM_PROMPT);
    expect(Array.isArray(body.messages)).toBe(true);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(typeof messages[0].content).toBe('string');
  });

  it('uses the model id passed in, not a hard-coded one', () => {
    const body = buildAnthropicRequestBody(makeRequest(), 'claude-haiku-4-5-20251001');
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });

  it('is deterministic — same request + model yields a byte-identical body', () => {
    const request = makeRequest();
    const a = JSON.stringify(buildAnthropicRequestBody(request, 'claude-haiku-4-5'));
    const b = JSON.stringify(buildAnthropicRequestBody(request, 'claude-haiku-4-5'));
    expect(a).toBe(b);
  });

  it('embeds the classifier prompt as the user message content', () => {
    const request = makeRequest();
    const body = buildAnthropicRequestBody(request, 'claude-haiku-4-5');
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toBe(buildClassifierPrompt(request));
  });
});

// ── buildClassifierPrompt ─────────────────────────────────────────

describe('buildClassifierPrompt', () => {
  it('includes the structural question for each requested classifier id', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ requestedClassifiers: ['responds_to_parent', 'asks_for_evidence'] }),
    );
    expect(prompt).toContain('responds_to_parent');
    expect(prompt).toContain(CLASSIFIER_QUESTION_TEXT.responds_to_parent);
    expect(prompt).toContain('asks_for_evidence');
    expect(prompt).toContain(CLASSIFIER_QUESTION_TEXT.asks_for_evidence);
  });

  it('emits ONLY the requested classifiers, not every catalog id', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ requestedClassifiers: ['responds_to_parent'] }),
    );
    expect(prompt).toContain('responds_to_parent');
    // A catalog id that was not requested must not appear.
    expect(prompt).not.toContain('uses_popularity_as_evidence');
    expect(prompt).not.toContain('ready_for_synthesis');
  });

  it('de-duplicates a repeated requested classifier id', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ requestedClassifiers: ['narrows_claim', 'narrows_claim'] }),
    );
    const occurrences = prompt.split('- narrows_claim:').length - 1;
    expect(occurrences).toBe(1);
  });

  it('carries the strict-JSON output instruction', () => {
    const prompt = buildClassifierPrompt(makeRequest());
    const lower = prompt.toLowerCase();
    expect(lower).toContain('json');
    expect(lower).toContain('no prose');
    expect(lower).toContain('no markdown');
  });

  it('includes the redacted move body as the input to classify', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ moveBodyRedacted: 'UNIQUE_MOVE_MARKER_42' }),
    );
    expect(prompt).toContain('UNIQUE_MOVE_MARKER_42');
  });

  it('includes the redacted parent body when present', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({ parentBodyRedacted: 'UNIQUE_PARENT_MARKER_99' }),
    );
    expect(prompt).toContain('UNIQUE_PARENT_MARKER_99');
  });

  it('marks a root move explicitly when there is no parent body', () => {
    const prompt = buildClassifierPrompt(makeRequest({ parentBodyRedacted: undefined }));
    expect(prompt.toLowerCase()).toContain('root move');
  });

  it('SEED_PROMPT_VERSION is the documented prompt-version string', () => {
    // SMOKE-FIX-002 bumped v0 → v1 (enum enumeration + worked-example wording change).
    expect(SEED_PROMPT_VERSION).toBe('mcp-semantic-referee-prompt-v1');
  });
});

// ── extractAnthropicContentText ───────────────────────────────────

describe('extractAnthropicContentText', () => {
  it('returns the first text-type content block', () => {
    const response = {
      content: [
        { type: 'text', text: 'the model output' },
        { type: 'text', text: 'a second block' },
      ],
    };
    expect(extractAnthropicContentText(response)).toBe('the model output');
  });

  it('skips a non-text block and returns the first text block after it', () => {
    const response = {
      content: [
        { type: 'tool_use', id: 'x' },
        { type: 'text', text: 'the real text' },
      ],
    };
    expect(extractAnthropicContentText(response)).toBe('the real text');
  });

  it('returns undefined for an empty content array', () => {
    expect(extractAnthropicContentText({ content: [] })).toBeUndefined();
  });

  it('returns undefined for a missing / malformed content field', () => {
    expect(extractAnthropicContentText({})).toBeUndefined();
    expect(extractAnthropicContentText({ content: 'not-an-array' })).toBeUndefined();
  });

  it('returns undefined for a non-object input', () => {
    expect(extractAnthropicContentText(null)).toBeUndefined();
    expect(extractAnthropicContentText('a string')).toBeUndefined();
    expect(extractAnthropicContentText(42)).toBeUndefined();
  });
});

// ── parseJsonFromContent ──────────────────────────────────────────

describe('parseJsonFromContent', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonFromContent('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
  });

  it('parses a fenced JSON object (extracts the first {...} run)', () => {
    const fenced = '```json\n{"value":1}\n```';
    expect(parseJsonFromContent(fenced)).toEqual({ value: 1 });
  });

  it('parses a JSON object surrounded by prose', () => {
    expect(parseJsonFromContent('Here it is: {"ok":true} done.')).toEqual({ ok: true });
  });

  it('returns null for non-JSON text — never throws', () => {
    expect(parseJsonFromContent('just some prose, no object')).toBeNull();
  });

  it('returns null for a JSON array (must be an object)', () => {
    expect(parseJsonFromContent('[1,2,3]')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseJsonFromContent('')).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(parseJsonFromContent(null)).toBeNull();
    expect(parseJsonFromContent(42)).toBeNull();
    expect(parseJsonFromContent({})).toBeNull();
  });

  it('returns null for a malformed object body — never throws', () => {
    expect(parseJsonFromContent('{ not valid json }')).toBeNull();
  });
});

// ── sanitizeRawPayload ────────────────────────────────────────────

describe('sanitizeRawPayload', () => {
  it('retains exactly { model, stop_reason, usage }', () => {
    const raw = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
      content: [{ type: 'text', text: 'secret-ish body' }],
    };
    const sanitized = sanitizeRawPayload(raw);
    expect(Object.keys(sanitized).sort()).toEqual(['model', 'stop_reason', 'usage']);
    expect(sanitized.model).toBe('claude-haiku-4-5');
    expect(sanitized.stop_reason).toBe('end_turn');
    expect(sanitized.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
  });

  it('drops every other key — id, role, type, content', () => {
    const raw = { id: 'x', role: 'assistant', type: 'message', content: ['body'] };
    const sanitized = sanitizeRawPayload(raw) as Record<string, unknown>;
    expect(sanitized).not.toHaveProperty('id');
    expect(sanitized).not.toHaveProperty('role');
    expect(sanitized).not.toHaveProperty('type');
    expect(sanitized).not.toHaveProperty('content');
  });

  it('returns all-undefined for a non-object input — never throws', () => {
    expect(sanitizeRawPayload(null)).toEqual({
      model: undefined,
      stop_reason: undefined,
      usage: undefined,
    });
    expect(sanitizeRawPayload('a string')).toEqual({
      model: undefined,
      stop_reason: undefined,
      usage: undefined,
    });
  });
});
