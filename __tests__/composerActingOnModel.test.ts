/**
 * UX-001.3 — composerActingOnModel pure-model tests.
 *
 * Covers:
 *  - Per-mode main label content
 *  - Divergence cue logic: fires only when activeMessageId !== parentArgumentId
 *  - No divergence on root-claim mode (both ids null)
 *  - No divergence when ids match
 *  - Plain-language copy (no verdict tokens, no internal codes)
 *  - Idempotence on identical inputs
 */
import {
  COMPOSER_DIVERGENCE_CUE,
  deriveComposerActingOnLabel,
} from '../src/features/arguments/composer/composerActingOnModel';
import type { ComposerActingOnInput } from '../src/features/arguments/composer/composerActingOnModel';
import { ALL_BOX_TYPES } from '../src/features/arguments/oneBox/boxModel';

function base(partial: Partial<ComposerActingOnInput>): ComposerActingOnInput {
  return {
    activeMessageId: partial.activeMessageId ?? null,
    parentArgumentId: partial.parentArgumentId ?? null,
    boxType: partial.boxType ?? 'respond',
    parentBodyExcerpt: partial.parentBodyExcerpt ?? null,
    parentTypeLabel: partial.parentTypeLabel ?? null,
    resolutionExcerpt: partial.resolutionExcerpt,
    clusterMemberCount: partial.clusterMemberCount,
    clusterSummaryExcerpt: partial.clusterSummaryExcerpt,
    conversationItemCount: partial.conversationItemCount,
    conversationTargetExcerpt: partial.conversationTargetExcerpt,
  };
}

describe('composerActingOnModel — root_claim', () => {
  it('uses the resolution excerpt when present', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'root_claim',
        resolutionExcerpt: 'Public transit reduces urban congestion',
      }),
    );
    expect(label.mainLabel).toContain('New argument');
    expect(label.mainLabel).toContain(
      'Public transit reduces urban congestion',
    );
  });

  it('falls back to "New argument" with no resolution excerpt', () => {
    const label = deriveComposerActingOnLabel(
      base({ boxType: 'root_claim' }),
    );
    expect(label.mainLabel).toBe('New argument');
  });
});

describe('composerActingOnModel — per-mode labels with parent', () => {
  const parent = {
    parentArgumentId: 'arg-1',
    parentBodyExcerpt: 'Bike lanes improve safety',
    parentTypeLabel: 'Claim',
  };

  it('respond names the parent type and excerpt', () => {
    const label = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'respond' }),
    );
    expect(label.mainLabel).toMatch(/Respond to Claim/);
    expect(label.mainLabel).toContain('Bike lanes improve safety');
  });

  it('branch_tangent reads as a side issue off the parent', () => {
    const label = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'branch_tangent' }),
    );
    expect(label.mainLabel).toContain('Side issue off Claim');
  });

  it('add_evidence reads as adding evidence to the parent', () => {
    const label = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'add_evidence' }),
    );
    expect(label.mainLabel).toContain('Add evidence to Claim');
  });

  it('ask_source / ask_quote read as asking', () => {
    const askS = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'ask_source' }),
    );
    const askQ = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'ask_quote' }),
    );
    expect(askS.mainLabel).toContain('Ask source for Claim');
    expect(askQ.mainLabel).toContain('Ask quote for Claim');
  });

  it('clarify / narrow / confirm read with the parent type', () => {
    for (const boxType of ['clarify', 'narrow', 'confirm'] as const) {
      const label = deriveComposerActingOnLabel(
        base({ ...parent, boxType }),
      );
      expect(label.mainLabel.toLowerCase()).toContain(boxType);
      expect(label.mainLabel).toContain('Claim');
    }
  });

  it('offer_concession names the parent type', () => {
    const label = deriveComposerActingOnLabel(
      base({ ...parent, boxType: 'offer_concession' }),
    );
    expect(label.mainLabel).toContain('Offer concession on Claim');
  });
});

describe('composerActingOnModel — synthesize', () => {
  it('singular and plural counts read correctly', () => {
    const one = deriveComposerActingOnLabel(
      base({
        boxType: 'synthesize',
        clusterMemberCount: 1,
        clusterSummaryExcerpt: 'Cost vs. safety axis',
      }),
    );
    const many = deriveComposerActingOnLabel(
      base({
        boxType: 'synthesize',
        clusterMemberCount: 4,
        clusterSummaryExcerpt: 'Cost vs. safety axis',
      }),
    );
    expect(one.mainLabel).toContain('Synthesize 1 move');
    expect(many.mainLabel).toContain('Synthesize 4 moves');
    expect(many.mainLabel).toContain('Cost vs. safety axis');
  });

  it('zero count falls back to parent excerpt or bare label', () => {
    const noCount = deriveComposerActingOnLabel(
      base({
        boxType: 'synthesize',
        parentBodyExcerpt: 'Some parent text',
        parentTypeLabel: 'Claim',
      }),
    );
    expect(noCount.mainLabel).toContain('Synthesize');
  });
});

describe('composerActingOnModel — respond_to_concession', () => {
  it('singular and plural counts read correctly', () => {
    const one = deriveComposerActingOnLabel(
      base({
        boxType: 'respond_to_concession',
        conversationItemCount: 1,
        conversationTargetExcerpt: 'Cost concession',
      }),
    );
    const many = deriveComposerActingOnLabel(
      base({
        boxType: 'respond_to_concession',
        conversationItemCount: 3,
        conversationTargetExcerpt: 'Multiple points',
      }),
    );
    expect(one.mainLabel).toContain('Respond to 1 concession');
    expect(many.mainLabel).toContain('Respond to 3 concessions');
  });
});

describe('composerActingOnModel — respond_to_evidence', () => {
  it('reads with the parent excerpt', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'respond_to_evidence',
        parentArgumentId: 'arg-ev',
        parentBodyExcerpt: 'Study cites 30% reduction',
        parentTypeLabel: 'Evidence',
      }),
    );
    expect(label.mainLabel).toContain('Respond to evidence');
    expect(label.mainLabel).toContain('Study cites 30% reduction');
  });
});

describe('composerActingOnModel — divergence cue', () => {
  it('fires when activeMessageId differs from parentArgumentId', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'respond',
        parentArgumentId: 'arg-1',
        activeMessageId: 'arg-2',
        parentBodyExcerpt: 'p',
        parentTypeLabel: 'Claim',
      }),
    );
    expect(label.divergenceCue).toBe(COMPOSER_DIVERGENCE_CUE);
  });

  it('does NOT fire when ids match', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'respond',
        parentArgumentId: 'arg-1',
        activeMessageId: 'arg-1',
        parentBodyExcerpt: 'p',
        parentTypeLabel: 'Claim',
      }),
    );
    expect(label.divergenceCue).toBeNull();
  });

  it('does NOT fire when activeMessageId is null', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'respond',
        parentArgumentId: 'arg-1',
        activeMessageId: null,
        parentBodyExcerpt: 'p',
        parentTypeLabel: 'Claim',
      }),
    );
    expect(label.divergenceCue).toBeNull();
  });

  it('does NOT fire when parentArgumentId is null (root_claim)', () => {
    const label = deriveComposerActingOnLabel(
      base({
        boxType: 'root_claim',
        activeMessageId: 'arg-1',
        parentArgumentId: null,
      }),
    );
    expect(label.divergenceCue).toBeNull();
  });

  it('the cue is plain English (no verdict tokens, no internal codes)', () => {
    const banned = [
      'winner',
      'loser',
      'liar',
      'correct',
      'truth',
      'true',
      'false',
      'wrong',
      'right',
      'verdict',
      'activeMessageId',
      'parentArgumentId',
      'box_type',
      'snake_case',
    ];
    for (const b of banned) {
      expect(COMPOSER_DIVERGENCE_CUE.toLowerCase()).not.toContain(
        b.toLowerCase(),
      );
    }
    expect(COMPOSER_DIVERGENCE_CUE).not.toMatch(/_/);
  });
});

describe('composerActingOnModel — idempotence', () => {
  it('returns the same shape for repeated identical inputs', () => {
    const inp: ComposerActingOnInput = base({
      boxType: 'respond',
      parentArgumentId: 'arg-1',
      activeMessageId: 'arg-1',
      parentBodyExcerpt: 'p',
      parentTypeLabel: 'Claim',
    });
    const a = deriveComposerActingOnLabel(inp);
    const b = deriveComposerActingOnLabel(inp);
    expect(a).toEqual(b);
  });
});

describe('composerActingOnModel — full mode coverage', () => {
  it('produces a non-empty mainLabel for EVERY BoxType', () => {
    // Includes the brand-new offer_concession (added in commit 3 of UX-001.3).
    // For commit 1 the boxModel union doesn't yet include offer_concession;
    // we cover the existing 12 here and the 13th in a later test.
    for (const boxType of ALL_BOX_TYPES) {
      const label = deriveComposerActingOnLabel(
        base({
          boxType,
          parentArgumentId: 'arg-1',
          parentBodyExcerpt: 'parent excerpt',
          parentTypeLabel: 'Claim',
          resolutionExcerpt: 'Resolution',
          clusterMemberCount: 2,
          clusterSummaryExcerpt: 'Cluster summary',
          conversationItemCount: 2,
          conversationTargetExcerpt: 'Target excerpt',
        }),
      );
      expect(label.mainLabel.length).toBeGreaterThan(0);
      // No verdict tokens anywhere in the main label.
      const banned = ['winner', 'loser', 'liar', 'truth value'];
      for (const b of banned) {
        expect(label.mainLabel.toLowerCase()).not.toContain(b);
      }
    }
  });
});
