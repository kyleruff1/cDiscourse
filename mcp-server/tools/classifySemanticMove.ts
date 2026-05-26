/**
 * MCP-SERVER-001 — `classify_semantic_move` tool.
 *
 * Commit 2 lands the metadata + a placeholder handler that returns a
 * documented "not_implemented" envelope. Commit 3 replaces the handler with
 * the real Anthropic-backed implementation: input validation, seed prompt
 * assembly, provider call, output-schema validation, doctrine ban-list scan,
 * and the dual-envelope (content[text] + structuredContent) result.
 *
 * Tool name pinned verbatim from the deployed adapter:
 *   `supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts:38`
 *   (`MCP_CLASSIFY_TOOL_NAME = 'classify_semantic_move'`)
 */
import type { ToolInvocation, ToolCallResult } from '../lib/toolDispatch.ts';
import type { ToolMetadata } from '../lib/toolRegistry.ts';
import { log } from '../lib/logging.ts';

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

/**
 * Commit 2 placeholder. Commit 3 replaces this with the full Anthropic-backed
 * implementation.
 */
export function handleClassifySemanticMove(
  input: ToolInvocation,
): Promise<ToolCallResult> {
  log('info', 'classify_semantic_move_placeholder', {
    requestId: input.requestId,
    tool: 'classify_semantic_move',
    reason: 'commit_2_placeholder',
    status: 'rejected',
  });
  return Promise.resolve({
    content: [
      {
        type: 'text' as const,
        text: 'classify_semantic_move handler is not yet wired (commit 2 placeholder).',
      },
    ],
    structuredContent: {
      reason: 'not_wired',
      detail: 'Handler attaches in commit 3.',
    },
    isError: true,
  });
}
