/**
 * UX-001.3 — ComposerContextStrip tests.
 *
 * Covers:
 *  - Per-band compact heights match the brief (56 / 64 / 72).
 *  - Mode-specific main label content.
 *  - Expand affordance accessibility (role=button + accessibilityState).
 *  - Hit target ≥ 44 via hitSlop.
 *  - Truncation helper bounds.
 *  - Divergence cue surfaces when activeMessageId differs.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  ComposerContextStrip,
  COMPOSER_STRIP_HEIGHT_BY_BAND,
  COMPOSER_STRIP_PADDING_V_BY_BAND,
  COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND,
  truncateExcerpt,
} from '../src/features/arguments/composer/ComposerContextStrip';
import type { ArgumentRow } from '../src/features/arguments/types';

const parent: ArgumentRow = {
  id: 'arg-1',
  debateId: 'd-1',
  parentId: null,
  authorId: 'u-1',
  authorName: 'Alice',
  argumentType: 'claim',
  side: 'affirmative',
  body: 'Bike lanes improve safety by 35% in dense urban areas.',
  targetExcerpt: null,
  disagreementAxis: null,
  rolledUp: false,
  isDeleted: false,
  createdAt: '2026-05-25T12:00:00Z',
  updatedAt: '2026-05-25T12:00:00Z',
  topicScoreCheck: null,
} as unknown as ArgumentRow;

describe('ComposerContextStrip — per-band heights match brief', () => {
  it('phone target height is 56 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBe(56);
  });

  it('tablet target height is 64 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBe(64);
  });

  it('wide target height is 72 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBe(72);
  });

  it('per-band padding+content+border+slack sums match the target heights', () => {
    for (const band of ['phone', 'tablet', 'wide'] as const) {
      const sum =
        COMPOSER_STRIP_PADDING_V_BY_BAND[band] * 2 +
        COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND[band] +
        1 + // border
        1;  // slack
      expect(sum).toBe(COMPOSER_STRIP_HEIGHT_BY_BAND[band]);
    }
  });

  it('phone target fits the brief bounds 48-64 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBeGreaterThanOrEqual(48);
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.phone).toBeLessThanOrEqual(64);
  });

  it('tablet target fits the brief bounds 56-72 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBeGreaterThanOrEqual(56);
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.tablet).toBeLessThanOrEqual(72);
  });

  it('wide target fits the brief bounds 64-80 px', () => {
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBeGreaterThanOrEqual(64);
    expect(COMPOSER_STRIP_HEIGHT_BY_BAND.wide).toBeLessThanOrEqual(80);
  });
});

describe('ComposerContextStrip — truncateExcerpt helper', () => {
  it('returns empty string for null/undefined', () => {
    expect(truncateExcerpt(null, 10)).toBe('');
    expect(truncateExcerpt(undefined, 10)).toBe('');
  });

  it('returns the input unchanged when within bounds', () => {
    expect(truncateExcerpt('short', 10)).toBe('short');
  });

  it('truncates and appends ellipsis when over bounds', () => {
    expect(truncateExcerpt('1234567890ABCDE', 10)).toBe('1234567890…');
  });
});

describe('ComposerContextStrip — rendering for respond mode', () => {
  it('renders the parent type + excerpt main label', () => {
    const { getByTestId } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    const label = getByTestId('composer-context-strip-main-label');
    expect(label.props.children).toContain('Respond to Claim');
    expect(label.props.children).toContain('Bike lanes improve safety');
  });

  it('exposes the expand affordance with role=button + a11y state', () => {
    const { getByTestId } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    const trigger = getByTestId('composer-context-strip-expand');
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityState).toEqual({ expanded: false });
    // hitSlop ≥ 14 in every direction → effective tap region ≥ 44x44.
    expect(trigger.props.hitSlop).toEqual({
      top: 14,
      bottom: 14,
      left: 14,
      right: 14,
    });
  });

  it('reflects expanded state in accessibilityState when expanded', () => {
    const { getByTestId } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={true}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    const trigger = getByTestId('composer-context-strip-expand');
    expect(trigger.props.accessibilityState).toEqual({ expanded: true });
  });
});

describe('ComposerContextStrip — divergence cue', () => {
  it('renders the cue when activeMessageId differs from parent.id', () => {
    const { getByTestId } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        activeMessageId="arg-2"
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    const cue = getByTestId('composer-context-strip-divergence-cue');
    expect(cue.props.children).toContain('different move');
  });

  it('does not render the cue when ids match', () => {
    const { queryByTestId } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        activeMessageId="arg-1"
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    expect(queryByTestId('composer-context-strip-divergence-cue')).toBeNull();
  });

  it('does not render the cue for root_claim mode', () => {
    const { queryByTestId } = render(
      <ComposerContextStrip
        boxType="root_claim"
        parentArgument={null}
        activeMessageId={null}
        resolution="A resolution"
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    expect(queryByTestId('composer-context-strip-divergence-cue')).toBeNull();
  });
});

describe('ComposerContextStrip — expanded host', () => {
  it('renders the expanded host only when expanded=true', () => {
    const { queryByTestId, rerender } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    expect(queryByTestId('composer-context-strip-expanded')).toBeNull();
    rerender(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={true}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    expect(queryByTestId('composer-context-strip-expanded')).not.toBeNull();
  });

  it('caps the expanded host at max(160, viewport * 0.25)', () => {
    const { getByTestId, rerender } = render(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={true}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={400}
      />,
    );
    // 400 * 0.25 = 100; floor is 160.
    let host = getByTestId('composer-context-strip-expanded');
    const flat1 = (Array.isArray(host.props.style)
      ? host.props.style.find((s: { maxHeight?: number }) => s && typeof s.maxHeight === 'number')
      : host.props.style) as { maxHeight: number };
    expect(flat1.maxHeight).toBe(160);

    rerender(
      <ComposerContextStrip
        boxType="respond"
        parentArgument={parent}
        expanded={true}
        onToggleExpanded={() => {}}
        bandOverride="wide"
        viewportHeightOverride={1080}
      />,
    );
    // 1080 * 0.25 = 270; floor (160) ignored.
    host = getByTestId('composer-context-strip-expanded');
    const flat2 = (Array.isArray(host.props.style)
      ? host.props.style.find((s: { maxHeight?: number }) => s && typeof s.maxHeight === 'number')
      : host.props.style) as { maxHeight: number };
    expect(flat2.maxHeight).toBe(270);
  });
});

describe('ComposerContextStrip — root_claim mode', () => {
  it('uses the resolution excerpt instead of a parent type', () => {
    const { getByTestId } = render(
      <ComposerContextStrip
        boxType="root_claim"
        parentArgument={null}
        resolution="Bike lanes should be prioritized in city budgets."
        expanded={false}
        onToggleExpanded={() => {}}
        bandOverride="phone"
        viewportHeightOverride={844}
      />,
    );
    const label = getByTestId('composer-context-strip-main-label');
    expect(label.props.children).toContain('New argument');
    expect(label.props.children).toContain('Bike lanes should be prioritized');
  });
});

describe('ComposerContextStrip — doctrine', () => {
  it('no verdict tokens in any rendered label text across all modes', () => {
    const banned = ['winner', 'loser', 'liar', 'correct', 'verdict'];
    const modes = [
      'root_claim',
      'respond',
      'add_evidence',
      'ask_source',
      'ask_quote',
      'clarify',
      'narrow',
      'confirm',
      'synthesize',
      'branch_tangent',
      'offer_concession',
      'respond_to_concession',
      'respond_to_evidence',
    ] as const;
    for (const mode of modes) {
      const { getByTestId, unmount } = render(
        <ComposerContextStrip
          boxType={mode}
          parentArgument={parent}
          resolution="A resolution"
          clusterContext={{ memberCount: 2, summaryExcerpt: 'cluster' }}
          conversationContext={{ itemCount: 2, targetExcerpt: 'target' }}
          expanded={false}
          onToggleExpanded={() => {}}
          bandOverride="phone"
          viewportHeightOverride={844}
        />,
      );
      const label = getByTestId('composer-context-strip-main-label');
      const text = String(label.props.children).toLowerCase();
      for (const b of banned) {
        expect(text).not.toContain(b);
      }
      unmount();
    }
  });
});
