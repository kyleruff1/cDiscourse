/**
 * MCP-016 — Semantic referee boundary fallback tests.
 *
 * The boundary validates a provider's packet against the outbound schema
 * BEFORE returning it. On any schema failure it substitutes a deterministic
 * minimal fallback packet — never a thrown error. The outcome stays
 * `{ enabled: true, packet }` with a schema-valid packet.
 *
 * `validateOrFallback` lives in the zod-coupled `providers.ts` (not Jest-
 * importable). This suite proves the two halves it composes:
 *   1. `buildFallbackPacket` (zod-free) produces a deterministic minimal,
 *      schema-valid packet — exercised directly.
 *   2. A re-declared local-zod packet schema (the `adminSchemas.test.ts`
 *      mirror convention) accepts the fallback packet AND rejects the kind of
 *      malformed packet (`authoritative: true`) that triggers the fallback.
 * Plus a source-scan that `providers.ts` wires validate → fallback.
 */
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { buildFallbackPacket } from './_helpers/semanticRefereeDeno';
import { ALL_SEMANTIC_CLASSIFIER_IDS, PACKET_VERSION } from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

const CLASSIFIER_ID_VALUES = ALL_SEMANTIC_CLASSIFIER_IDS as readonly [string, ...string[]];

// ── Local mirror of the outbound packet schema (adminSchemas convention) ──

const LocalPacketSchema = z
  .object({
    packetVersion: z.literal(PACKET_VERSION),
    promptVersion: z.string().min(1),
    modelVersion: z.string().min(1),
    provider: z.enum(['mock', 'mcp', 'anthropic', 'operator-selected']),
    authoritative: z.literal(false),
    inputHash: z.string().min(1),
    contentHash: z.string().min(1),
    roomId: z.string().min(1),
    moveId: z.string().min(1).optional(),
    parentId: z.string().min(1).optional(),
    selectedAction: z.string().optional(),
    selectedMoveType: z.string().optional(),
    debateMode: z.string().optional(),
    binaries: z.array(
      z
        .object({
          classifierId: z.enum(CLASSIFIER_ID_VALUES),
          value: z.union([z.literal(0), z.literal(1)]),
          confidence: z.enum(['low', 'medium', 'high']),
          reasonCode: z.string().min(1),
          evidenceSpan: z.string().optional(),
          parentSpan: z.string().optional(),
        })
        .strict(),
    ),
    routeSuggestion: z.enum([
      'mainline',
      'vertical_chime_branch',
      'diagonal_tangent',
      'outer_realm',
      'cards_detail',
      'synthesis_lane',
      'no_route_change',
    ]),
    frictionSuggestion: z.enum([
      'none',
      'soft_chip',
      'pre_send_pause',
      'ask_for_quote',
      'ask_for_source',
      'suggest_branch',
      'suggest_narrow',
      'cooldown_notice',
    ]),
    scoreHints: z
      .object({
        continuityCredit: z.number().int().min(0).max(3),
        evidencePressure: z.number().int().min(0).max(3),
        branchHygiene: z.number().int().min(0).max(3),
        synthesisReadiness: z.number().int().min(0).max(3),
        sourceChainDebt: z.number().int().min(0).max(3),
        unresolvedRedirectRisk: z.number().int().min(0).max(3),
      })
      .strict(),
  })
  .strict();

function makeRequest(): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'content-hash-1',
  };
}

/**
 * Reproduces `validateOrFallback`'s logic with the local mirror schema: if the
 * candidate packet fails validation, return the deterministic fallback.
 */
function localValidateOrFallback(
  request: ClassifyMoveRequest,
  candidate: unknown,
): { schemaValid: boolean; result: unknown } {
  const parsed = LocalPacketSchema.safeParse(candidate);
  if (parsed.success) {
    return { schemaValid: true, result: candidate };
  }
  return { schemaValid: false, result: buildFallbackPacket(request) };
}

describe('buildFallbackPacket — the deterministic fallback', () => {
  it('produces a packet that passes the outbound schema', () => {
    const fallback = buildFallbackPacket(makeRequest());
    expect(LocalPacketSchema.safeParse(fallback).success).toBe(true);
  });

  it('is minimal — empty binaries, no route change, no friction, zero hints', () => {
    const fallback = buildFallbackPacket(makeRequest());
    expect(fallback.binaries).toHaveLength(0);
    expect(fallback.routeSuggestion).toBe('no_route_change');
    expect(fallback.frictionSuggestion).toBe('none');
    for (const value of Object.values(fallback.scoreHints)) {
      expect(value).toBe(0);
    }
  });

  it('is doctrine-clean — provider mock, authoritative false', () => {
    const fallback = buildFallbackPacket(makeRequest());
    expect(fallback.provider).toBe('mock');
    expect(fallback.authoritative).toBe(false);
  });
});

describe('validate-or-fallback — a malformed packet yields the fallback', () => {
  it('a valid packet passes straight through', () => {
    const request = makeRequest();
    const goodPacket = buildFallbackPacket(request);
    const { schemaValid, result } = localValidateOrFallback(request, goodPacket);
    expect(schemaValid).toBe(true);
    expect(result).toBe(goodPacket);
  });

  it('an authoritative:true packet fails the schema and is replaced by the fallback', () => {
    const request = makeRequest();
    const malformed = { ...buildFallbackPacket(request), authoritative: true };
    const { schemaValid, result } = localValidateOrFallback(request, malformed);
    expect(schemaValid).toBe(false);
    // The result is the deterministic fallback — schema-valid, authoritative false.
    expect(LocalPacketSchema.safeParse(result).success).toBe(true);
    expect((result as { authoritative: unknown }).authoritative).toBe(false);
  });

  it('a packet with a smuggled block field fails the schema and is replaced', () => {
    const request = makeRequest();
    const malformed = { ...buildFallbackPacket(request), block: true };
    const { schemaValid, result } = localValidateOrFallback(request, malformed);
    expect(schemaValid).toBe(false);
    expect(LocalPacketSchema.safeParse(result).success).toBe(true);
  });

  it('never throws — a malformed packet still produces a usable outcome', () => {
    const request = makeRequest();
    expect(() =>
      localValidateOrFallback(request, { totally: 'wrong', shape: true }),
    ).not.toThrow();
    const { result } = localValidateOrFallback(request, { totally: 'wrong' });
    expect(LocalPacketSchema.safeParse(result).success).toBe(true);
  });
});

// ── Source-scan: providers.ts wires validate → fallback ───────────

describe('providers.ts — wires the validate-or-fallback path', () => {
  const providersSrc = fs.readFileSync(
    path.join(process.cwd(), 'supabase/functions/_shared/semanticReferee/providers.ts'),
    'utf8',
  );

  it('exports validateOrFallback', () => {
    expect(providersSrc).toMatch(/export function validateOrFallback/);
  });

  it('validateOrFallback safeParses against the outbound schema and falls back on failure', () => {
    expect(providersSrc).toMatch(/SemanticRefereePacketSchema\.safeParse/);
    expect(providersSrc).toMatch(/buildFallbackPacket\(request\)/);
  });

  it('classifyWithConfiguredProvider runs validateOrFallback on an enabled outcome', () => {
    expect(providersSrc).toMatch(/validateOrFallback\(request,\s*outcome\.packet\)/);
  });
});
