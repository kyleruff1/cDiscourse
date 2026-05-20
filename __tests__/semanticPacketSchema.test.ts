/**
 * MCP-016 — Semantic referee outbound packet schema tests.
 *
 * `supabase/functions/_shared/semanticReferee/schema.ts` uses `npm:zod@4` and
 * cannot be loaded by Jest. Following the `adminSchemas.test.ts` convention,
 * this suite RE-DECLARES `SemanticRefereePacketSchema` with the local `zod` and
 * asserts the doctrine invariants the boundary depends on — PLUS a source-scan
 * proving the Deno schema declares the same pins.
 *
 * The doctrine pins under test (MCP-001 §7, cdiscourse-doctrine §1):
 *   - `authoritative` is `z.literal(false)`;
 *   - every nested object is `.strict()` — a smuggled `block` / truth / winner
 *     field FAILS;
 *   - `binaries[].value` is `z.union([z.literal(0), z.literal(1)])`;
 *   - `scoreHints` integers are pinned to 0..3.
 */
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { ALL_SEMANTIC_CLASSIFIER_IDS, PACKET_VERSION } from '../src/features/semanticReferee';

const MAX_COPY_FIELD_LEN = 280;
const MAX_STRING_FIELD_LEN = 512;
const SCORE_HINT_MIN = 0;
const SCORE_HINT_MAX = 3;
const CLASSIFIER_ID_VALUES = ALL_SEMANTIC_CLASSIFIER_IDS as readonly [string, ...string[]];
const ROUTE_VALUES = [
  'mainline',
  'vertical_chime_branch',
  'diagonal_tangent',
  'outer_realm',
  'cards_detail',
  'synthesis_lane',
  'no_route_change',
] as const;
const FRICTION_VALUES = [
  'none',
  'soft_chip',
  'pre_send_pause',
  'ask_for_quote',
  'ask_for_source',
  'suggest_branch',
  'suggest_narrow',
  'cooldown_notice',
] as const;
const PROVIDER_VALUES = ['mock', 'mcp', 'anthropic', 'operator-selected'] as const;

// ── Local re-declaration of SemanticRefereePacketSchema ───────────

const BinarySampleSchema = z
  .object({
    classifierId: z.enum(CLASSIFIER_ID_VALUES),
    value: z.union([z.literal(0), z.literal(1)]),
    confidence: z.enum(['low', 'medium', 'high']),
    reasonCode: z.string().min(1).max(MAX_COPY_FIELD_LEN),
    evidenceSpan: z.string().max(MAX_COPY_FIELD_LEN).optional(),
    parentSpan: z.string().max(MAX_COPY_FIELD_LEN).optional(),
  })
  .strict();

const ScoreHintsSchema = z
  .object({
    continuityCredit: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    evidencePressure: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    branchHygiene: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    synthesisReadiness: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    sourceChainDebt: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
    unresolvedRedirectRisk: z.number().int().min(SCORE_HINT_MIN).max(SCORE_HINT_MAX),
  })
  .strict();

const SemanticRefereePacketSchema = z
  .object({
    packetVersion: z.literal(PACKET_VERSION),
    promptVersion: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    modelVersion: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    provider: z.enum(PROVIDER_VALUES),
    authoritative: z.literal(false),
    inputHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    contentHash: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    roomId: z.string().min(1).max(MAX_STRING_FIELD_LEN),
    moveId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    parentId: z.string().min(1).max(MAX_STRING_FIELD_LEN).optional(),
    selectedAction: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    selectedMoveType: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    debateMode: z.string().max(MAX_STRING_FIELD_LEN).optional(),
    binaries: z.array(BinarySampleSchema),
    routeSuggestion: z.enum(ROUTE_VALUES),
    frictionSuggestion: z.enum(FRICTION_VALUES),
    scoreHints: ScoreHintsSchema,
  })
  .strict();

function makePacket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-semantic-referee-v0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'input-hash-1',
    contentHash: 'content-hash-1',
    roomId: 'room-1',
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 1,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
    ...overrides,
  };
}

describe('SemanticRefereePacketSchema — accepts', () => {
  it('accepts a valid packet', () => {
    expect(SemanticRefereePacketSchema.safeParse(makePacket()).success).toBe(true);
  });

  it('accepts a packet with empty binaries and zero hints (the fallback shape)', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [],
        routeSuggestion: 'no_route_change',
        scoreHints: {
          continuityCredit: 0,
          evidencePressure: 0,
          branchHygiene: 0,
          synthesisReadiness: 0,
          sourceChainDebt: 0,
          unresolvedRedirectRisk: 0,
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe('SemanticRefereePacketSchema — rejects truth / verdict widening', () => {
  it('rejects authoritative: true', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ authoritative: true })).success,
    ).toBe(false);
  });

  it('rejects a missing authoritative field', () => {
    const packet = makePacket();
    delete packet.authoritative;
    expect(SemanticRefereePacketSchema.safeParse(packet).success).toBe(false);
  });

  it('rejects a smuggled block field (strict)', () => {
    expect(SemanticRefereePacketSchema.safeParse(makePacket({ block: true })).success).toBe(false);
  });

  it('rejects a smuggled truth field (strict)', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ isTrue: true })).success,
    ).toBe(false);
  });

  it('rejects a smuggled winner field (strict)', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ winner: 'affirmative' })).success,
    ).toBe(false);
  });

  it('rejects any unknown extra top-level field (strict)', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ extraField: 'x' })).success,
    ).toBe(false);
  });
});

describe('SemanticRefereePacketSchema — rejects malformed binaries', () => {
  it('rejects a binary value of 2', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [
          { classifierId: 'responds_to_parent', value: 2, confidence: 'high', reasonCode: 'parent_continuity_x' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a binary value of 0.5', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [
          { classifierId: 'responds_to_parent', value: 0.5, confidence: 'high', reasonCode: 'parent_continuity_x' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a binary value of the string "1"', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [
          { classifierId: 'responds_to_parent', value: '1', confidence: 'high', reasonCode: 'parent_continuity_x' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an unknown classifierId', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [
          { classifierId: 'not_a_classifier', value: 1, confidence: 'high', reasonCode: 'parent_continuity_x' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a smuggled field inside a binary (strict)', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        binaries: [
          {
            classifierId: 'responds_to_parent',
            value: 1,
            confidence: 'high',
            reasonCode: 'parent_continuity_x',
            verdict: 'won',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('SemanticRefereePacketSchema — rejects malformed route / friction / hints', () => {
  it('rejects an unknown routeSuggestion', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ routeSuggestion: 'teleport_lane' }))
        .success,
    ).toBe(false);
  });

  it('rejects an unknown frictionSuggestion', () => {
    expect(
      SemanticRefereePacketSchema.safeParse(makePacket({ frictionSuggestion: 'shut_it_down' }))
        .success,
    ).toBe(false);
  });

  it('rejects a scoreHints integer of 9 (out of 0..3)', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        scoreHints: {
          continuityCredit: 9,
          evidencePressure: 0,
          branchHygiene: 0,
          synthesisReadiness: 0,
          sourceChainDebt: 0,
          unresolvedRedirectRisk: 0,
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a smuggled field inside scoreHints (strict)', () => {
    const result = SemanticRefereePacketSchema.safeParse(
      makePacket({
        scoreHints: {
          continuityCredit: 0,
          evidencePressure: 0,
          branchHygiene: 0,
          synthesisReadiness: 0,
          sourceChainDebt: 0,
          unresolvedRedirectRisk: 0,
          truthDelta: 1,
        },
      }),
    );
    expect(result.success).toBe(false);
  });
});

// ── Source-scan parity against the Deno schema ────────────────────

describe('SemanticRefereePacketSchema — Deno source parity', () => {
  const denoSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee/schema.ts'),
    'utf8',
  );

  it('the Deno schema pins authoritative to z.literal(false)', () => {
    expect(denoSrc).toMatch(/authoritative:\s*z\.literal\(false\)/);
  });

  it('the Deno schema pins packetVersion to z.literal(PACKET_VERSION)', () => {
    expect(denoSrc).toMatch(/packetVersion:\s*z\.literal\(PACKET_VERSION\)/);
  });

  it('the Deno schema pins a binary value to z.union of literal 0 and literal 1', () => {
    expect(denoSrc).toMatch(/value:\s*z\.union\(\[z\.literal\(0\),\s*z\.literal\(1\)\]\)/);
  });

  it('the Deno schema declares every nested object .strict()', () => {
    // packet object, binary object, scoreHints object, plus the request schema's
    // two — at least five .strict() declarations in the file.
    expect((denoSrc.match(/\.strict\(\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('the Deno schema pins scoreHints integers to SCORE_HINT_MIN..SCORE_HINT_MAX', () => {
    expect(denoSrc).toMatch(/z\.number\(\)\.int\(\)\.min\(SCORE_HINT_MIN\)\.max\(SCORE_HINT_MAX\)/);
  });
});
