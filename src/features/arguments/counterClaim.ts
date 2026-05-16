/**
 * Upfront counterclaim support — pure model helpers.
 * Pure TypeScript — no React, no Supabase, no Anthropic, no network.
 *
 * The counterclaim is optional. If provided it produces an initial
 * opposing move draft after the root claim — but only through the
 * existing submit flow. No direct DB inserts here.
 *
 * Stage 6.1.0
 */

// ── Types ──────────────────────────────────────────────────────

export interface CounterClaimDraft {
  mainClaim: string;
  counterClaim: string | null;
  basis: string | null;
  side: 'affirmative' | 'negative' | 'neutral';
}

export interface CounterClaimValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InitialArgumentMoveDraft {
  kind: 'root_claim' | 'opening_counter';
  body: string;
  side: 'affirmative' | 'negative' | 'neutral';
  basis: string | null;
}

// ── Copy ───────────────────────────────────────────────────────

export const COUNTER_CLAIM_COPY = {
  whatAreClaiming: 'What are you claiming?',
  teeUpCounter: 'Want to tee up the obvious counter?',
  whatReceipts: 'What receipts or basis do you have?',
  letOtherSideRefute: 'Let the other side refute your basis.',
  startClean: 'You can start clean and add receipts later.',
  counterClaimPlaceholder: 'The obvious objection is…',
  mainClaimPlaceholder: 'State your claim…',
  basisPlaceholder: 'Link, citation, or source text…',
} as const;

// ── Validation ─────────────────────────────────────────────────

export function validateCounterClaimDraft(
  draft: CounterClaimDraft,
): CounterClaimValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.mainClaim || draft.mainClaim.trim().length === 0) {
    errors.push('Main claim is required.');
  }
  if (draft.mainClaim && draft.mainClaim.trim().length < 10) {
    errors.push('Main claim must be at least 10 characters.');
  }
  if (draft.mainClaim && draft.mainClaim.trim().length > 2000) {
    errors.push('Main claim must be 2000 characters or fewer.');
  }

  if (draft.counterClaim !== null && draft.counterClaim.trim().length > 0) {
    if (draft.counterClaim.trim().length < 10) {
      warnings.push('Counter claim is short — consider expanding it.');
    }
    if (draft.counterClaim.trim().length > 2000) {
      errors.push('Counter claim must be 2000 characters or fewer.');
    }
  }

  if (draft.basis !== null && draft.basis.trim().length > 2000) {
    errors.push('Basis must be 2000 characters or fewer.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Draft builders ─────────────────────────────────────────────

export function buildInitialArgumentMoves(
  draft: CounterClaimDraft,
): InitialArgumentMoveDraft[] {
  const moves: InitialArgumentMoveDraft[] = [
    {
      kind: 'root_claim',
      body: draft.mainClaim.trim(),
      side: draft.side,
      basis: draft.basis ? draft.basis.trim() : null,
    },
  ];

  if (draft.counterClaim && draft.counterClaim.trim().length >= 10) {
    const counterSide =
      draft.side === 'affirmative'
        ? 'negative'
        : draft.side === 'negative'
          ? 'affirmative'
          : 'neutral';

    moves.push({
      kind: 'opening_counter',
      body: draft.counterClaim.trim(),
      side: counterSide,
      basis: null,
    });
  }

  return moves;
}

export function createRoomWithOptionalCounterDraft(input: {
  title: string;
  resolution: string;
  mainClaim: string;
  counterClaim?: string | null;
  basis?: string | null;
  side?: 'affirmative' | 'negative' | 'neutral';
}): {
  draft: CounterClaimDraft;
  validation: CounterClaimValidationResult;
  moves: InitialArgumentMoveDraft[];
} {
  const draft: CounterClaimDraft = {
    mainClaim: input.mainClaim,
    counterClaim: input.counterClaim ?? null,
    basis: input.basis ?? null,
    side: input.side ?? 'affirmative',
  };

  const validation = validateCounterClaimDraft(draft);
  const moves = validation.valid ? buildInitialArgumentMoves(draft) : [];

  return { draft, validation, moves };
}

export function getCounterClaimPromptCopy(): typeof COUNTER_CLAIM_COPY {
  return COUNTER_CLAIM_COPY;
}
