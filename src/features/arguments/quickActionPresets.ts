/**
 * Stage 6.2 — Quick-action → composer preset mapping (Milestone 7).
 *
 * Pure. No React. No Supabase. Takes a sidecar/bubble quick action label
 * and the parent argument type, returns a typed MoveDraftPatch the
 * composer applies on mount. Never sets fields the user didn't ask for.
 */
import type { ArgumentType } from '../../domain/constitution/types';
import type { MoveDraftPatch } from './conversationMoves';

export type QuickActionLabel =
  | 'reply'
  | 'challenge'
  | 'source'
  | 'quote'
  | 'clarify'
  | 'evidence'
  | 'concede'
  | 'branch'
  | 'flag';

/**
 * Given a quick-action label and the parent argument's type, return a
 * MoveDraftPatch the composer can apply once. Returns null when the
 * action does not have a meaningful preset (e.g., `reply` should leave
 * argumentType free).
 */
export function quickActionToPreset(action: QuickActionLabel, parentType: ArgumentType | null): MoveDraftPatch | null {
  switch (action) {
    case 'reply':
      // Don't force a type; just open the composer with the parent set.
      return null;

    case 'challenge': {
      // Choose the best allowed rebuttal/counter-rebuttal for the parent.
      const challengeType: ArgumentType =
        parentType === 'rebuttal' ? 'counter_rebuttal' :
        parentType === 'counter_rebuttal' ? 'rebuttal' :
        'rebuttal';
      return {
        argumentType: challengeType,
        // No axis required — leave it null so the user isn't forced to pick.
        disagreementAxis: null,
      };
    }

    case 'source':
      // Clarification semantics — ask for the primary source.
      return {
        argumentType: 'clarification_request',
        suggestedTagCodes: ['source_request'],
      };

    case 'quote':
      return {
        argumentType: 'clarification_request',
        suggestedTagCodes: ['quote_request'],
      };

    case 'clarify':
      return {
        argumentType: 'clarification_request',
      };

    case 'evidence':
      // Evidence type — composer auto-expands evidence fields.
      return {
        argumentType: 'evidence',
      };

    case 'concede':
      // Concession move; the composer no longer requires the exact "I concede" phrase.
      return {
        argumentType: 'concession',
      };

    case 'branch':
      // Branch == open a targeted reply; no forced type, deferred to user.
      return null;

    case 'flag':
      // Flag has its own moderation flow; do not invent destructive composer behaviour here.
      return null;

    default:
      return null;
  }
}
