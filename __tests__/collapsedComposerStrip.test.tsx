/**
 * UX-001.3 — CollapsedComposerStrip tests.
 *
 * Covers:
 *  - Per-band collapsed heights (56 / 64 / 72).
 *  - Tap → invokes onExpand once.
 *  - accessibilityRole="button" + accessibilityState={ expanded: false }.
 *  - 44+ px hit target via minHeight.
 *  - Compose CTA label is plain English, no verdict tokens.
 *  - Per-mode main label content.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CollapsedComposerStrip } from '../src/features/arguments/composer/CollapsedComposerStrip';
import { COMPOSER_STRIP_HEIGHT_BY_BAND } from '../src/features/arguments/composer/ComposerContextStrip';
import type { ArgumentRow } from '../src/features/arguments/types';

const parent: ArgumentRow = {
  id: 'arg-1',
  debateId: 'd-1',
  parentId: null,
  authorId: 'u-1',
  authorName: 'Alice',
  argumentType: 'claim',
  side: 'affirmative',
  body: 'Bike lanes improve safety by 35%.',
  targetExcerpt: null,
  disagreementAxis: null,
  rolledUp: false,
  isDeleted: false,
  createdAt: '2026-05-25T12:00:00Z',
  updatedAt: '2026-05-25T12:00:00Z',
  topicScoreCheck: null,
} as unknown as ArgumentRow;

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }
  return {};
}

describe('CollapsedComposerStrip — rendering', () => {
  it('renders with the parent type + excerpt main label', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const label = getByTestId('collapsed-composer-strip-main-label');
    expect(label.props.children).toContain('Respond to Claim');
  });

  it('renders the Compose CTA', () => {
    const { getByText } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    expect(getByText('Compose')).toBeTruthy();
  });

  it('renders for root_claim mode with the resolution', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="root_claim"
        parentArgument={null}
        resolution="Bike lanes should be prioritized"
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const label = getByTestId('collapsed-composer-strip-main-label');
    expect(label.props.children).toContain('New argument');
  });
});

describe('CollapsedComposerStrip — per-band heights', () => {
  it('phone strip minHeight matches the brief target', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const outer = getByTestId('collapsed-composer-strip');
    const style = flattenStyle(outer.props.style);
    expect(style.minHeight).toBe(COMPOSER_STRIP_HEIGHT_BY_BAND.phone);
    expect(style.minHeight).toBe(56);
  });

  it('tablet strip minHeight matches the brief target', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="tablet"
      />,
    );
    const outer = getByTestId('collapsed-composer-strip');
    const style = flattenStyle(outer.props.style);
    expect(style.minHeight).toBe(64);
  });

  it('wide strip minHeight matches the brief target', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="wide"
      />,
    );
    const outer = getByTestId('collapsed-composer-strip');
    const style = flattenStyle(outer.props.style);
    expect(style.minHeight).toBe(72);
  });

  it('every band height exceeds 44 px (the 44 minimum is automatic)', () => {
    for (const band of ['phone', 'tablet', 'wide'] as const) {
      expect(COMPOSER_STRIP_HEIGHT_BY_BAND[band]).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('CollapsedComposerStrip — accessibility', () => {
  it('exposes role="button" with state expanded=false', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const outer = getByTestId('collapsed-composer-strip');
    expect(outer.props.accessibilityRole).toBe('button');
    expect(outer.props.accessibilityState).toEqual({ expanded: false });
  });

  it('has a descriptive accessibilityLabel including the main label', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const outer = getByTestId('collapsed-composer-strip');
    expect(outer.props.accessibilityLabel).toContain('Compose');
    expect(outer.props.accessibilityLabel).toContain('Respond to Claim');
  });
});

describe('CollapsedComposerStrip — interaction', () => {
  it('tap calls onExpand exactly once', () => {
    const onExpand = jest.fn();
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={onExpand}
        bandOverride="phone"
      />,
    );
    fireEvent.press(getByTestId('collapsed-composer-strip'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});

describe('CollapsedComposerStrip — doctrine', () => {
  it('the Compose CTA is plain English (no verdict)', () => {
    const banned = ['winner', 'loser', 'liar', 'correct', 'verdict', 'truth'];
    const { getByText } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
      />,
    );
    const cta = getByText('Compose');
    for (const b of banned) {
      expect(String(cta.props.children).toLowerCase()).not.toContain(b);
    }
  });
});

describe('CollapsedComposerStrip — testIDPrefix', () => {
  it('namespaces testIDs when prefix is supplied', () => {
    const { getByTestId } = render(
      <CollapsedComposerStrip
        boxType="respond"
        parentArgument={parent}
        onExpand={() => {}}
        bandOverride="phone"
        testIDPrefix="room-A"
      />,
    );
    expect(getByTestId('room-A-collapsed-composer-strip')).toBeTruthy();
  });
});
