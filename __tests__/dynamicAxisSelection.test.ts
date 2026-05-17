/**
 * Stage 6.1.9 polish — Anthropic picks the disagreement axis dynamically.
 *
 * Covers:
 *   - parseModelResponse handles strict JSON, fenced JSON, JSON inside prose, and raw prose.
 *   - Invalid axis values fall back to null (caller will use fallbackAxis).
 *   - renderAdversarialMove returns chosenAxis from the model's JSON output.
 *   - When the model returns prose-only, the renderer falls back to fallbackAxis.
 *   - When Anthropic throws, deterministic fallback still produces a body + axis.
 */
import {
  parseModelResponse,
  renderAdversarialMove,
  ALLOWED_AXES,
} from '../scripts/bot-fixtures/xaiAdversarialMoveRenderer';

describe('parseModelResponse', () => {
  it('parses strict JSON with body + axis + mechanism', () => {
    const r = parseModelResponse('{"body":"Quote the section about long-run effects.","disagreementAxis":"evidence","mechanism":"primary-source demand"}');
    expect(r.jsonParsed).toBe(true);
    expect(r.body).toContain('long-run');
    expect(r.axis).toBe('evidence');
    expect(r.mechanism).toBe('primary-source demand');
  });

  it('parses JSON wrapped in ```json fences', () => {
    const r = parseModelResponse('```json\n{"body":"A claim that demands a primary source.","disagreementAxis":"source_chain","mechanism":"unverified forward"}\n```');
    expect(r.jsonParsed).toBe(true);
    expect(r.axis).toBe('source_chain');
  });

  it('parses a JSON object embedded inside prose', () => {
    const r = parseModelResponse('Sure, here you go: {"body":"The mechanism is unstated.","disagreementAxis":"causal","mechanism":"A causes B without a route"}\nThanks!');
    expect(r.jsonParsed).toBe(true);
    expect(r.axis).toBe('causal');
    expect(r.body).toContain('mechanism');
  });

  it('treats raw prose as body-only with axis=null', () => {
    const r = parseModelResponse('Holding the narrow form intact. The mechanism is missing.');
    expect(r.jsonParsed).toBe(false);
    expect(r.axis).toBeNull();
    expect(r.body).toContain('narrow form');
  });

  it('clamps invalid axis strings to null', () => {
    const r = parseModelResponse('{"body":"Body text here.","disagreementAxis":"tone","mechanism":"x"}');
    expect(r.jsonParsed).toBe(true);
    expect(r.axis).toBeNull();
  });

  it('accepts every axis in ALLOWED_AXES', () => {
    for (const a of ALLOWED_AXES) {
      const r = parseModelResponse(`{"body":"Body text here.","disagreementAxis":"${a}","mechanism":"x"}`);
      expect(r.axis).toBe(a);
    }
  });

  it('handles null + undefined input without throwing', () => {
    expect(() => parseModelResponse(null as unknown as string)).not.toThrow();
    expect(() => parseModelResponse(undefined as unknown as string)).not.toThrow();
    expect(parseModelResponse(null as unknown as string).axis).toBeNull();
  });

  it('unwraps one level of nested JSON in the body field', () => {
    // The model accidentally serialised JSON inside its own body field.
    const raw = '{"body":"{\\"body\\":\\"Quote the audit log and name the mechanism.\\",\\"disagreementAxis\\":\\"evidence\\",\\"mechanism\\":\\"primary-source demand\\"}","disagreementAxis":"evidence","mechanism":"outer"}';
    const r = parseModelResponse(raw);
    expect(r.body).toBe('Quote the audit log and name the mechanism.');
    expect(r.axis).toBe('evidence');
  });

  it('clears the body if a doubly-nested JSON remains after one unwrap', () => {
    // Triple-nested — we only unwrap one level. The remaining body is JSON-shaped, so it gets cleared.
    const raw = '{"body":"{\\"body\\":\\"{\\\\\\"body\\\\\\":\\\\\\"oops\\\\\\"}\\",\\"disagreementAxis\\":\\"logic\\"}","disagreementAxis":"logic","mechanism":"x"}';
    const r = parseModelResponse(raw);
    // Body is JSON-shaped after one unwrap → cleared so renderer triggers retry/fallback.
    expect(r.body).toBe('');
  });

  it('clears body when the outer JSON itself is malformed but still looks like a wrapper', () => {
    // Anthropic produced unescaped quotes inside the body, so JSON.parse fails on the outer.
    // Without the defensive clear, the parser would return the raw text as body — propagating
    // the malformed JSON wrapper downstream.
    const raw = '{"body": "You ask to "Quote the part" — but you are conflating two claims.", "disagreementAxis":"logic"}';
    const r = parseModelResponse(raw);
    expect(r.body).toBe('');
    expect(r.jsonParsed).toBe(false);
  });
});

describe('renderAdversarialMove — dynamic axis selection', () => {
  const scene = { title: 'A topic about pitch clocks', category: 'xai_adversarial', topicBucket: 'sports' };
  const parent = { argumentType: 'thesis', body: 'The pitch clock reduced average game duration by 25 minutes.', depth: 1 };
  const slot = { argumentType: 'rebuttal', depth: 3 };
  const persona = { skillRole: 'bot-revocateur', skillHash: 'deadbeefdeadbeef' };
  const skillBundle = {
    provocateurText: 'provocateur skill text long enough to satisfy the loader minimums '.repeat(8),
    revocateurText: 'revocateur skill text long enough to satisfy the loader minimums '.repeat(8),
    provocateurHash: 'aaaaaaaa', revocateurHash: 'bbbbbbbb',
  };

  function fakeClient(textResponse: string) {
    return {
      generate: async () => ({ text: textResponse, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 }, modelEcho: 'fake' }),
      snapshotUsage: () => ({ inputTokens: 1, outputTokens: 1, calls: 1, budget: { maxInputTokens: 1, maxOutputTokens: 1 }, model: 'fake' }),
    };
  }

  it('uses chosenAxis when the model returns parseable JSON', async () => {
    const fake = fakeClient('{"body":"Quote the umpire-discretion log for late-game high-leverage at-bats; the mechanism is not what the talking points claim about pitch-clock enforcement.","disagreementAxis":"evidence","mechanism":"primary-log demand"}');
    const r = await renderAdversarialMove({
      client: fake,
      scene, parent, slot, persona, skillBundle,
      conversationSummary: '',
      axis: 'auto',
      fallbackAxis: 'source_chain',
      antiAmplificationCue: '',
      forceTargetExcerpt: '',
    });
    expect(r.source).toBe('anthropic');
    expect(r.chosenAxis).toBe('evidence');
    expect(r.mechanism).toBe('primary-log demand');
    expect(r.jsonParsed).toBe(true);
  });

  it('falls back to fallbackAxis when the model returns prose-only', async () => {
    const fake = fakeClient('Holding the narrow form intact. The mechanism behind the broader form is what I am defending — not the slogan attached to it.');
    const r = await renderAdversarialMove({
      client: fake,
      scene, parent, slot, persona, skillBundle,
      conversationSummary: '',
      axis: 'auto',
      fallbackAxis: 'scope',
      antiAmplificationCue: '',
      forceTargetExcerpt: '',
    });
    // No JSON → axis: null in parse, runner uses fallbackAxis.
    expect(r.chosenAxis).toBe('scope');
    expect(r.jsonParsed).toBe(false);
  });

  it('falls back to fallbackAxis when the model returns an invalid axis', async () => {
    const fake = fakeClient('{"body":"Body text that is long enough to clear the 40 char minimum length requirement easily.","disagreementAxis":"vibes","mechanism":"x"}');
    const r = await renderAdversarialMove({
      client: fake,
      scene, parent, slot, persona, skillBundle,
      conversationSummary: '',
      axis: 'auto',
      fallbackAxis: 'logic',
      antiAmplificationCue: '',
      forceTargetExcerpt: '',
    });
    expect(r.chosenAxis).toBe('logic');
    // JSON itself parsed, but the axis was rejected.
    expect(r.jsonParsed).toBe(true);
  });

  it('uses chosenAxis even when the caller passed a suggested axis (not auto)', async () => {
    const fake = fakeClient('{"body":"Body text long enough to clear the minimum forty char length requirement easily.","disagreementAxis":"causal","mechanism":"x causes y"}');
    const r = await renderAdversarialMove({
      client: fake,
      scene, parent, slot, persona, skillBundle,
      conversationSummary: '',
      axis: 'evidence',           // caller suggestion
      fallbackAxis: 'evidence',
      antiAmplificationCue: '',
      forceTargetExcerpt: '',
    });
    // Anthropic was allowed to override the suggestion.
    expect(r.chosenAxis).toBe('causal');
  });

  it('returns deterministic fallback + fallbackAxis when no client is given', async () => {
    const r = await renderAdversarialMove({
      client: null,
      scene, parent, slot, persona, skillBundle,
      conversationSummary: '',
      axis: 'auto',
      fallbackAxis: 'definition',
      antiAmplificationCue: '',
      forceTargetExcerpt: '',
    });
    expect(r.source).toBe('deterministic_fallback');
    expect(r.chosenAxis).toBe('definition');
    expect(r.jsonParsed).toBe(false);
  });
});
