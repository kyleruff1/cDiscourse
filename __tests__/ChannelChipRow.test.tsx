/**
 * RULE-005 — ChannelChipRow + ChannelHelperFields helper tests.
 *
 * Following the repo's pure-helper component-test discipline (see
 * ReceiptChip.test.tsx): the chip row's load-bearing decisions — the
 * "Suggested" affordance, accessibility labels, the re-route advisory
 * visibility, the hit target — are extracted into pure helpers and
 * exercised here without an RN renderer.
 *
 * Asserts:
 *   - the suggested chip is detected and its accessibility label carries
 *     "suggested" (text, not color);
 *   - every chip exposes a radio role + selected state via its label;
 *   - the hit slop yields a ≥ 44×44 effective tap target;
 *   - the re-route advisory renders only when the suggestion isMismatch;
 *   - the advisory text is non-punitive;
 *   - the helper-field block discloses the right fields per channel and
 *     renders nothing for a no-field channel.
 *
 * .tsx extension matches the sibling ReceiptChip.test.tsx convention.
 */
import {
  CHANNEL_CHIP_HIT_SLOP,
  SUGGESTED_AFFORDANCE_TEXT,
  SWITCH_CHANNEL_ACTION_LABEL,
  isSuggestedChannel,
  buildChannelChipAccessibilityLabel,
  shouldShowRerouteAdvisory,
  buildRerouteAdvisoryText,
} from '../src/features/arguments/ChannelChipRow';
import {
  CHANNEL_FIELD_COPY,
  helperFieldsForChannel,
  channelHasHelperFields,
  getChannelFieldLabel,
  isHelperFieldRequired,
} from '../src/features/arguments/ChannelHelperFields';
import {
  ACTIVE_MOVE_CHANNELS,
  getChannelLabel,
  type ChannelSuggestion,
  type ChannelOptionalField,
} from '../src/features/arguments/channelModel';

function suggestion(over: Partial<ChannelSuggestion> = {}): ChannelSuggestion {
  return {
    suggested: 'reply',
    reason: 'no_signal',
    confidence: 'low',
    rationale: 'Start anywhere — Reply works when nothing else is set.',
    isMismatch: false,
    ...over,
  };
}

// ── Suggested affordance ───────────────────────────────────────

describe('RULE-005 ChannelChipRow — suggested affordance', () => {
  it('isSuggestedChannel is true only for the suggested channel', () => {
    const s = suggestion({ suggested: 'add_evidence' });
    expect(isSuggestedChannel('add_evidence', s)).toBe(true);
    expect(isSuggestedChannel('challenge', s)).toBe(false);
  });

  it('the suggested affordance text is plain English, not color-only', () => {
    expect(SUGGESTED_AFFORDANCE_TEXT).toBe('Suggested');
    // It is a literal word — a screen reader / grayscale user sees it.
    expect(SUGGESTED_AFFORDANCE_TEXT.length).toBeGreaterThan(0);
  });
});

// ── Accessibility labels ───────────────────────────────────────

describe('RULE-005 ChannelChipRow — accessibility labels', () => {
  it('the suggested chip label contains "suggested"', () => {
    const s = suggestion({ suggested: 'challenge' });
    const label = buildChannelChipAccessibilityLabel('challenge', false, s);
    expect(label.toLowerCase()).toContain('suggested');
  });

  it('a non-suggested chip label does not contain "suggested"', () => {
    const s = suggestion({ suggested: 'challenge' });
    const label = buildChannelChipAccessibilityLabel('reply', false, s);
    expect(label.toLowerCase()).not.toContain('suggested');
  });

  it('a selected chip label contains "selected"', () => {
    const s = suggestion();
    expect(buildChannelChipAccessibilityLabel('clarify', true, s).toLowerCase()).toContain(
      'selected',
    );
  });

  it('every chip label starts with the plain-language channel label', () => {
    const s = suggestion();
    for (const c of ACTIVE_MOVE_CHANNELS) {
      const label = buildChannelChipAccessibilityLabel(c, false, s);
      expect(label.startsWith(getChannelLabel(c))).toBe(true);
    }
  });

  it('a chip can be both selected and suggested', () => {
    const s = suggestion({ suggested: 'narrow' });
    const label = buildChannelChipAccessibilityLabel('narrow', true, s).toLowerCase();
    expect(label).toContain('selected');
    expect(label).toContain('suggested');
  });
});

// ── Hit target ─────────────────────────────────────────────────

describe('RULE-005 ChannelChipRow — hit target', () => {
  it('the chip hit slop yields a ≥ 44×44 effective tap target', () => {
    // The chip has minHeight 36; 36 + top 12 + bottom 12 = 60 ≥ 44.
    expect(36 + CHANNEL_CHIP_HIT_SLOP.top + CHANNEL_CHIP_HIT_SLOP.bottom).toBeGreaterThanOrEqual(
      44,
    );
    // Horizontal: the shortest label still pads out with hitSlop 8 each side.
    expect(CHANNEL_CHIP_HIT_SLOP.left + CHANNEL_CHIP_HIT_SLOP.right).toBeGreaterThanOrEqual(16);
  });

  it('CHANNEL_CHIP_HIT_SLOP is frozen', () => {
    expect(Object.isFrozen(CHANNEL_CHIP_HIT_SLOP)).toBe(true);
  });
});

// ── Re-route advisory ──────────────────────────────────────────

describe('RULE-005 ChannelChipRow — re-route advisory', () => {
  it('the advisory is hidden when there is no mismatch', () => {
    expect(shouldShowRerouteAdvisory(suggestion({ isMismatch: false }))).toBe(false);
  });

  it('the advisory shows only when the suggestion isMismatch', () => {
    expect(shouldShowRerouteAdvisory(suggestion({ isMismatch: true }))).toBe(true);
  });

  it('the advisory text names the suggested channel and offers a switch', () => {
    const s = suggestion({ suggested: 'branch_tangent', isMismatch: true });
    const text = buildRerouteAdvisoryText(s);
    expect(text).toContain(getChannelLabel('branch_tangent'));
    expect(text).toContain('Switch to');
  });

  it('the advisory text is non-punitive (no dodge / evade)', () => {
    const s = suggestion({
      suggested: 'branch_tangent',
      isMismatch: true,
      rationale: 'This reads like a new issue — branching keeps the thread clear.',
    });
    const text = buildRerouteAdvisoryText(s).toLowerCase();
    expect(text).not.toContain('dodge');
    expect(text).not.toContain('evad');
  });

  it('the switch action label is plain English', () => {
    expect(SWITCH_CHANNEL_ACTION_LABEL).toBe('Switch channel');
  });
});

// ── ChannelHelperFields helpers ────────────────────────────────

describe('RULE-005 ChannelHelperFields — field disclosure', () => {
  it('add_evidence discloses the source / quote / primary-source fields', () => {
    const fields = helperFieldsForChannel('add_evidence');
    expect(fields).toContain('source_url');
    expect(fields).toContain('quote_text');
    expect(fields).toContain('primary_source');
  });

  it('channelHasHelperFields is false for a no-field channel', () => {
    expect(channelHasHelperFields('meta_process')).toBe(false);
    expect(channelHasHelperFields('concede')).toBe(false);
    expect(channelHasHelperFields('branch_tangent')).toBe(false);
  });

  it('channelHasHelperFields is true for a channel with fields', () => {
    expect(channelHasHelperFields('add_evidence')).toBe(true);
    expect(channelHasHelperFields('clarify')).toBe(true);
  });

  it('every ChannelOptionalField has a plain-language label + placeholder', () => {
    for (const field of Object.keys(CHANNEL_FIELD_COPY) as ChannelOptionalField[]) {
      const copy = CHANNEL_FIELD_COPY[field];
      expect(copy.label.trim().length).toBeGreaterThan(0);
      expect(copy.placeholder.trim().length).toBeGreaterThan(0);
      expect(/^[A-Z]/.test(copy.label)).toBe(true);
    }
  });

  it('getChannelFieldLabel returns the frozen label', () => {
    expect(getChannelFieldLabel('source_url')).toBe(CHANNEL_FIELD_COPY.source_url.label);
  });

  it('every disclosed field on every active channel has copy', () => {
    for (const c of ACTIVE_MOVE_CHANNELS) {
      for (const field of helperFieldsForChannel(c)) {
        expect(CHANNEL_FIELD_COPY[field]).toBeDefined();
      }
    }
  });
});

describe('RULE-005 ChannelHelperFields — fields are advisory in v1', () => {
  it('no field is required in casual mode', () => {
    for (const field of Object.keys(CHANNEL_FIELD_COPY) as ChannelOptionalField[]) {
      expect(isHelperFieldRequired(field, 'casual')).toBe(false);
    }
  });

  it('no field is required in strict mode either (v1 — GAME-003 owns strict)', () => {
    for (const field of Object.keys(CHANNEL_FIELD_COPY) as ChannelOptionalField[]) {
      expect(isHelperFieldRequired(field, 'strict')).toBe(false);
    }
  });

  it('CHANNEL_FIELD_COPY is frozen', () => {
    expect(Object.isFrozen(CHANNEL_FIELD_COPY)).toBe(true);
  });
});
