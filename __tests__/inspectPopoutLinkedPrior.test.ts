/**
 * QOL-042 — Inspect popout "From the linked prior argument" section tests.
 *
 * `buildInspectLinkedPriorSection` is ADDITIVE — it produces the optional
 * conditional section without altering the fixed seven-section set that
 * `buildInspectPopout` always returns.
 */
import {
  buildInspectLinkedPriorSection,
  buildInspectPopout,
  INSPECT_LINKED_PRIOR_EMPTY_BODY,
  INSPECT_LINKED_PRIOR_HEADER,
  type InspectLinkedPriorTangentItem,
} from '../src/features/arguments/oneBox/inspectPopoutModel';

const tangentItems: InspectLinkedPriorTangentItem[] = [
  { argumentId: 'a1', excerpt: 'The door-unlocked tangent from the prior room' },
  { argumentId: 'a2', excerpt: 'And the porch-light follow-up' },
];

describe('buildInspectLinkedPriorSection — visibility', () => {
  it('is visible for an authorized viewer with tangent context', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'authorized',
      tangentItems,
    });
    expect(section.isVisible).toBe(true);
    expect(section.id).toBe('linked_prior_argument');
    expect(section.title).toBe(INSPECT_LINKED_PRIOR_HEADER);
    expect(section.tangentItems).toHaveLength(2);
    expect(section.emptyBody).toBe('');
  });

  it('is visible for an authorized viewer with NO tangents, with the empty-body line', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'authorized',
      tangentItems: [],
    });
    expect(section.isVisible).toBe(true);
    expect(section.tangentItems).toHaveLength(0);
    expect(section.emptyBody).toBe(INSPECT_LINKED_PRIOR_EMPTY_BODY);
  });

  it('is NOT visible for a title_only viewer (no prior content to show)', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'title_only',
      tangentItems: [],
    });
    expect(section.isVisible).toBe(false);
    expect(section.tangentItems).toHaveLength(0);
  });

  it('is NOT visible for an unavailable viewer', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'unavailable',
      tangentItems: [],
    });
    expect(section.isVisible).toBe(false);
  });

  it('drops tangent items for a non-authorized viewer even if some are passed', () => {
    // Defensive: a title_only caller's tangent fetch returns zero rows
    // under RLS, but if items somehow arrive the section still hides them.
    const section = buildInspectLinkedPriorSection({
      accessState: 'title_only',
      tangentItems,
    });
    expect(section.tangentItems).toHaveLength(0);
  });
});

describe('buildInspectLinkedPriorSection — additive (fixed section set untouched)', () => {
  it('buildInspectPopout still returns exactly the fixed seven sections', () => {
    const model = buildInspectPopout({ stage: 'open', content: { says: 'A move' } });
    expect(model.sections).toHaveLength(7);
    // The linked-prior section id is NOT one of the fixed seven.
    expect(model.sections.some((s) => s.id === ('linked_prior_argument' as never))).toBe(
      false,
    );
  });

  it('the linked-prior section carries a verbose, plain-language a11y label', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'authorized',
      tangentItems,
    });
    expect(section.accessibilityLabel.length).toBeGreaterThan(0);
    expect(section.accessibilityLabel.toLowerCase()).toContain('linked prior argument');
    expect(section.accessibilityLabel).not.toMatch(/_/);
  });

  it('the section header has no verdict / truth token', () => {
    const banned = ['winner', 'loser', 'won', 'proved', 'true', 'false', 'correct'];
    const section = buildInspectLinkedPriorSection({
      accessState: 'authorized',
      tangentItems,
    });
    for (const token of banned) {
      expect(section.title.toLowerCase()).not.toContain(token);
      expect(section.emptyBody.toLowerCase()).not.toContain(token);
    }
  });
});

describe('buildInspectLinkedPriorSection — determinism', () => {
  it('returns equal output for equal input', () => {
    const input = { accessState: 'authorized' as const, tangentItems };
    expect(buildInspectLinkedPriorSection(input)).toEqual(
      buildInspectLinkedPriorSection(input),
    );
  });

  it('handles a non-array tangentItems input defensively', () => {
    const section = buildInspectLinkedPriorSection({
      accessState: 'authorized',
      tangentItems: null as unknown as InspectLinkedPriorTangentItem[],
    });
    expect(section.isVisible).toBe(true);
    expect(section.tangentItems).toHaveLength(0);
    expect(section.emptyBody).toBe(INSPECT_LINKED_PRIOR_EMPTY_BODY);
  });
});
