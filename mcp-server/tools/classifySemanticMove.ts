/**
 * MCP-SERVER-001 — `classify_semantic_move` tool.
 *
 * Tool name pinned verbatim from the deployed adapter:
 *   `supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts:38`
 *   (`MCP_CLASSIFY_TOOL_NAME = 'classify_semantic_move'`)
 *
 * Flow (per design §6.2):
 *   1. Validate input against inputSchema (validateClassifyMoveInput)
 *   2. Build Anthropic prompt (system + user; mirror of the canonical seed)
 *   3. Call Anthropic Messages API (or load fixture when
 *      MCP_SERVER_USE_FIXTURE_PROVIDER=true)
 *   4. Parse and validate against the structural-subset outputSchema
 *   5. Run doctrine ban-list scan across every string field
 *   6. Return the dual-envelope tool result:
 *        content: [{type: "text", text: JSON.stringify(packet)}]
 *        structuredContent: packet
 *        isError: false
 *
 * Errors at any step return an isError envelope with a typed reason —
 * NEVER a partial or fake packet. The Edge Function adapter falls back to
 * the deterministic layer when the server returns an error envelope.
 */
import type { ToolInvocation, ToolCallResult } from '../lib/toolDispatch.ts';
import type { ToolMetadata } from '../lib/toolRegistry.ts';
import { isPlainObject } from '../lib/jsonRpc.ts';
import { log } from '../lib/logging.ts';
import {
  validateClassifyMoveInput,
  validateSemanticRefereePacket,
} from '../lib/semanticRefereePacketSchema.ts';
import { runAnthropicSemanticReferee } from '../lib/anthropic.ts';
import { loadFixtureSemanticPacket } from '../lib/fixtureProvider.ts';

export const CLASSIFY_SEMANTIC_MOVE_TOOL: ToolMetadata = {
  name: 'classify_semantic_move',
  title: 'Semantic Move Classifier',
  description:
    "Classifies a single argument move's structural properties — parent continuity, evidence hygiene, branch hygiene, constructive movement, debate-mode fit, friction. STRUCTURAL questions only — never assigns truth value, never picks a winner, never reads popularity as evidence. Returns a SemanticRefereePacket. Used by CDiscourse's semantic-referee Edge Function.",
  inputSchema: {
    type: 'object',
    required: ['moveBodyRedacted', 'roomContext', 'requestedClassifiers', 'contentHash', 'roomId'],
    properties: {
      moveBodyRedacted: { type: 'string', minLength: 1, maxLength: 8000 },
      parentBodyRedacted: { type: 'string', maxLength: 8000 },
      roomContext: {
        type: 'object',
        properties: {
          debateMode: { type: 'string', maxLength: 512 },
          selectedAction: { type: 'string', maxLength: 512 },
          selectedMoveType: { type: 'string', maxLength: 512 },
          side: {
            type: 'string',
            enum: ['affirmative', 'negative', 'observer', 'moderator'],
          },
          actorRole: {
            type: 'string',
            enum: ['initiator', 'primary_opponent', 'chime_in', 'observer'],
          },
        },
        additionalProperties: false,
      },
      requestedClassifiers: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string' },
      },
      contentHash: { type: 'string', minLength: 1, maxLength: 512 },
      roomId: { type: 'string', minLength: 1, maxLength: 512 },
      moveId: { type: 'string', minLength: 1, maxLength: 512 },
      parentId: { type: 'string', minLength: 1, maxLength: 512 },
      promptVersionHint: { type: 'string', minLength: 1, maxLength: 512 },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    required: ['binaries', 'routeSuggestion', 'frictionSuggestion', 'scoreHints'],
    properties: {
      binaries: {
        type: 'array',
        items: {
          type: 'object',
          required: ['classifierId', 'value', 'confidence', 'reasonCode'],
          properties: {
            classifierId: { type: 'string' },
            value: { type: 'integer', minimum: 0, maximum: 1 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            reasonCode: { type: 'string', minLength: 1, maxLength: 280 },
            evidenceSpan: { type: 'string', maxLength: 280 },
            parentSpan: { type: 'string', maxLength: 280 },
          },
          additionalProperties: false,
        },
      },
      routeSuggestion: {
        type: 'string',
        enum: [
          'mainline',
          'vertical_chime_branch',
          'diagonal_tangent',
          'outer_realm',
          'cards_detail',
          'synthesis_lane',
          'no_route_change',
        ],
      },
      frictionSuggestion: {
        type: 'string',
        enum: [
          'none',
          'soft_chip',
          'pre_send_pause',
          'ask_for_quote',
          'ask_for_source',
          'suggest_branch',
          'suggest_narrow',
          'cooldown_notice',
        ],
      },
      scoreHints: {
        type: 'object',
        required: [
          'continuityCredit',
          'evidencePressure',
          'branchHygiene',
          'synthesisReadiness',
          'sourceChainDebt',
          'unresolvedRedirectRisk',
        ],
        properties: {
          continuityCredit: { type: 'integer', minimum: 0, maximum: 3 },
          evidencePressure: { type: 'integer', minimum: 0, maximum: 3 },
          branchHygiene: { type: 'integer', minimum: 0, maximum: 3 },
          synthesisReadiness: { type: 'integer', minimum: 0, maximum: 3 },
          sourceChainDebt: { type: 'integer', minimum: 0, maximum: 3 },
          unresolvedRedirectRisk: { type: 'integer', minimum: 0, maximum: 3 },
        },
        additionalProperties: false,
      },
      modelVersion: { type: 'string', maxLength: 512 },
    },
    additionalProperties: false,
  },
};

function errorResult(
  reason: string,
  message: string,
  extra: Record<string, unknown> = {},
): ToolCallResult {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { reason, ...extra },
    isError: true,
  };
}

/**
 * Handle a `classify_semantic_move` invocation. Pure async function — no
 * direct Deno.env reads here; provider selection happens inside `anthropic.ts`
 * and `fixtureProvider.ts`.
 */
export async function handleClassifySemanticMove(
  input: ToolInvocation,
): Promise<ToolCallResult> {
  const args = isPlainObject(input.rawArgs) ? input.rawArgs : null;
  if (args === null) {
    return errorResult(
      'invalid_params',
      'classify_semantic_move arguments must be a JSON object',
    );
  }
  const validated = validateClassifyMoveInput(args);
  if (!validated.ok) {
    return errorResult('invalid_params', 'Input failed schema validation', {
      path: validated.path,
      detail: validated.detail,
    });
  }
  const request = validated.value;

  // Provider selection.
  let providerResult:
    | { ok: true; packet: Record<string, unknown> }
    | { ok: false; reason: string; detail?: string };
  if (Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER') === 'true') {
    const fixture = await loadFixtureSemanticPacket();
    if (fixture.ok) {
      providerResult = { ok: true, packet: fixture.value };
    } else {
      providerResult = { ok: false, reason: fixture.reason };
    }
  } else {
    const anthropic = await runAnthropicSemanticReferee(request, input.requestId);
    if (anthropic.ok) {
      providerResult = { ok: true, packet: anthropic.packet };
    } else {
      providerResult = { ok: false, reason: anthropic.reason, detail: anthropic.detail };
    }
  }

  if (!providerResult.ok) {
    return errorResult(
      providerResult.reason,
      `Semantic referee call failed: ${providerResult.reason}`,
      providerResult.detail !== undefined ? { detail: providerResult.detail } : {},
    );
  }

  // Output-schema + doctrine ban-list validation.
  const packetCheck = validateSemanticRefereePacket(providerResult.packet);
  if (!packetCheck.ok) {
    log('warn', 'semantic_referee_packet_invalid', {
      requestId: input.requestId,
      tool: 'classify_semantic_move',
      reason: 'validation_failed',
      status: 'failure',
    });
    return errorResult('validation_failed', 'Model response failed packet schema', {
      path: packetCheck.path,
      detail: packetCheck.detail,
    });
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(packetCheck.value) }],
    structuredContent: packetCheck.value,
    isError: false,
  };
}
