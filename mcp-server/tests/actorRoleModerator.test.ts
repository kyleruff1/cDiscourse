/**
 * MCP-SERVER-002 — actorRole=moderator enum addition (folded-in
 * MCP-SERVER-001-SMOKE follow-up).
 *
 * The MCP-SERVER-001-SMOKE Phase 5 surfaced that the smoke script's
 * `actorRole='moderator'` payload was rejected by the server's validator
 * because the enum was {initiator, primary_opponent, chime_in, observer}
 * — moderator was not present. MCP-SERVER-002 adds `moderator` as the 5th
 * accepted value in 3 surgical lines in semanticRefereePacketSchema.ts.
 *
 * Critical invariants:
 *   - validateClassifyMoveInput accepts actorRole='moderator' (not
 *     invalid_params at validator level)
 *   - The existing 4 actorRoles still pass (no regression)
 *   - Junk strings are still rejected
 *
 * The boolean tool's input schema has NO roomContext (Family A request
 * does not carry actor-role data); only semantic-move is exercised here.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  validateClassifyMoveInput,
  ALL_ACTOR_ROLES,
} from '../lib/semanticRefereePacketSchema.ts';

function baseInput(): Record<string, unknown> {
  return {
    moveBodyRedacted: '[fixture] sample move',
    roomContext: { side: 'affirmative' },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'h-1',
    roomId: 'room-1',
  };
}

Deno.test('actorRole=moderator: ALL_ACTOR_ROLES includes moderator', () => {
  if (!ALL_ACTOR_ROLES.includes('moderator')) {
    throw new Error('ALL_ACTOR_ROLES does not include moderator');
  }
  assertEquals(ALL_ACTOR_ROLES.length, 5);
});

Deno.test('actorRole=moderator: validateClassifyMoveInput accepts moderator', () => {
  const input = baseInput();
  (input.roomContext as Record<string, unknown>).actorRole = 'moderator';
  const result = validateClassifyMoveInput(input);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.roomContext.actorRole, 'moderator');
  }
});

Deno.test('actorRole regression: existing 4 actorRoles all still accepted', () => {
  const existing = ['initiator', 'primary_opponent', 'chime_in', 'observer'];
  for (const role of existing) {
    const input = baseInput();
    (input.roomContext as Record<string, unknown>).actorRole = role;
    const result = validateClassifyMoveInput(input);
    if (!result.ok) {
      throw new Error(`actorRole=${role} now rejected; was accepted in MCP-SERVER-001`);
    }
    if (result.ok) {
      assertEquals(result.value.roomContext.actorRole, role);
    }
  }
});

Deno.test('actorRole regression: junk strings still rejected', () => {
  const input = baseInput();
  (input.roomContext as Record<string, unknown>).actorRole = 'arbitrator';
  const result = validateClassifyMoveInput(input);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'roomContext.actorRole');
  }
});

Deno.test('actorRole regression: error message includes moderator', () => {
  const input = baseInput();
  (input.roomContext as Record<string, unknown>).actorRole = 'arbitrator';
  const result = validateClassifyMoveInput(input);
  assertEquals(result.ok, false);
  if (!result.ok) {
    if (!result.detail.includes('moderator')) {
      throw new Error(`Error message does not mention moderator: ${result.detail}`);
    }
  }
});
