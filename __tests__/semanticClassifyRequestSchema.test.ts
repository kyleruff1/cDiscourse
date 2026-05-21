/**
 * MCP-016 — Semantic referee inbound request schema tests.
 *
 * `supabase/functions/_shared/semanticReferee/schema.ts` uses Deno-style
 * `npm:zod@4` imports and cannot be loaded by Jest. Following the
 * `adminSchemas.test.ts` convention, this suite RE-DECLARES the inbound schema
 * with the local `zod` and asserts the same behavior the Edge Function relies
 * on — PLUS a source-scan that the Deno schema declares the same invariants, so
 * the re-declaration cannot silently drift.
 *
 * If you change the Edge Function schema, mirror the change here.
 */
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';

const MOVE_BODY_MAX = 8_000;
const MAX_STRING_FIELD_LEN = 512;
const MAX_REQUESTED_CLASSIFIERS = 5;
const CLASSIFIER_ID_VALUES = ALL_SEMANTIC_CLASSIFIER_IDS as readonly [string, ...string[]];

// ── Local re-declaration of ClassifyMoveRequestSchema ─────────────

const ClassifyMoveRequestSchema = z
  .object({
    roomId: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    moveId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    parentId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    moveBodyRedacted: z.string().min(1).max(MOVE_BODY_MAX),
    parentBodyRedacted: z.string().max(MOVE_BODY_MAX).optional(),
    roomContext: z
      .object({
        debateMode: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        selectedAction: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        selectedMoveType: z.string().max(MAX_STRING_FIELD_LEN).optional(),
        side: z.enum(['affirmative', 'negative', 'observer', 'moderator']).optional(),
        actorRole: z.enum(['initiator', 'primary_opponent', 'chime_in', 'observer']).optional(),
      })
      .strict(),
    requestedClassifiers: z
      .array(z.enum(CLASSIFIER_ID_VALUES))
      .min(1)
      .max(MAX_REQUESTED_CLASSIFIERS),
    promptVersionHint: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    contentHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
  })
  .strict();

function makeRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A valid move body.',
    roomContext: { side: 'affirmative' },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'content-hash-1',
    ...overrides,
  };
}

describe('ClassifyMoveRequestSchema — accepts', () => {
  it('accepts a minimal valid request', () => {
    expect(ClassifyMoveRequestSchema.safeParse(makeRequest()).success).toBe(true);
  });

  it('accepts a request with a parent', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ parentId: 'parent-1', parentBodyRedacted: 'The parent body.' }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts a request with all five classifiers', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({
        requestedClassifiers: [
          'responds_to_parent',
          'narrows_claim',
          'asks_for_evidence',
          'provides_evidence',
          'ready_for_synthesis',
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('ClassifyMoveRequestSchema — rejects', () => {
  it('rejects an empty moveBodyRedacted', () => {
    expect(ClassifyMoveRequestSchema.safeParse(makeRequest({ moveBodyRedacted: '' })).success).toBe(
      false,
    );
  });

  it('rejects an over-length moveBodyRedacted (> 8000)', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ moveBodyRedacted: 'a'.repeat(8_001) }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an over-length parentBodyRedacted (> 8000)', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ parentBodyRedacted: 'a'.repeat(8_001) }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an empty requestedClassifiers array', () => {
    expect(
      ClassifyMoveRequestSchema.safeParse(makeRequest({ requestedClassifiers: [] })).success,
    ).toBe(false);
  });

  it('rejects more than five requestedClassifiers', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({
        requestedClassifiers: [
          'responds_to_parent',
          'narrows_claim',
          'asks_for_evidence',
          'provides_evidence',
          'ready_for_synthesis',
          'introduces_new_issue',
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unknown classifier id', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ requestedClassifiers: ['not_a_real_classifier'] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unknown extra top-level key (strict)', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ block: true }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unknown extra key inside roomContext (strict)', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ roomContext: { side: 'affirmative', smuggled: 'x' } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a missing roomId', () => {
    const req = makeRequest();
    delete req.roomId;
    expect(ClassifyMoveRequestSchema.safeParse(req).success).toBe(false);
  });

  it('rejects an invalid roomContext.side enum value', () => {
    const result = ClassifyMoveRequestSchema.safeParse(
      makeRequest({ roomContext: { side: 'spectator' } }),
    );
    expect(result.success).toBe(false);
  });
});

// ── Source-scan parity against the Deno schema ────────────────────

describe('ClassifyMoveRequestSchema — Deno source parity', () => {
  const denoSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee/schema.ts'),
    'utf8',
  );

  it('the Deno schema uses the npm:zod@4 specifier', () => {
    expect(denoSrc).toMatch(/from 'npm:zod@4'/);
  });

  it('the Deno schema declares ClassifyMoveRequestSchema as strict', () => {
    expect(denoSrc).toMatch(/export const ClassifyMoveRequestSchema/);
    // The top-level object and the roomContext object are both .strict().
    expect((denoSrc.match(/\.strict\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('the Deno schema caps moveBodyRedacted at 8000 and requestedClassifiers at 5', () => {
    expect(denoSrc).toMatch(/MOVE_BODY_MAX\s*=\s*8_000/);
    expect(denoSrc).toMatch(/MAX_REQUESTED_CLASSIFIERS\s*=\s*5/);
    expect(denoSrc).toMatch(/moveBodyRedacted:\s*z\.string\(\)\.min\(1[\s\S]*?\.max\(MOVE_BODY_MAX\)/);
  });

  it('the Deno schema enumerates requestedClassifiers against the classifier-id catalog', () => {
    expect(denoSrc).toMatch(/requestedClassifiers:\s*z[\s\S]*?CLASSIFIER_ID_VALUES/);
  });
});
