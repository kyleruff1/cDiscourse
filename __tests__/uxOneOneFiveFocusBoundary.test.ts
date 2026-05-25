/**
 * UX-001.5 — Pure-TS keyboard focus boundary model.
 *
 * Tests `resolveFocusBoundaryKeyEffect` for every key and modifier
 * combination, plus `applyFocusBoundaryEffect` for wrap semantics and
 * empty-list safety.
 */
import {
  applyFocusBoundaryEffect,
  FOCUS_BOUNDARY_NOOP,
  resolveFocusBoundaryKeyEffect,
  type FocusBoundaryKeyEffect,
} from '../src/features/nodeAnnotations/annotationFocusBoundary';

const NO_MODIFIERS = Object.freeze({ shift: false, alt: false, ctrl: false, meta: false });

describe('UX-001.5 — resolveFocusBoundaryKeyEffect — arrow keys', () => {
  it('ArrowRight → focus_next', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowRight', NO_MODIFIERS)).toEqual({
      type: 'focus_next',
    });
  });

  it('ArrowDown → focus_next', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowDown', NO_MODIFIERS)).toEqual({
      type: 'focus_next',
    });
  });

  it('ArrowLeft → focus_prev', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowLeft', NO_MODIFIERS)).toEqual({
      type: 'focus_prev',
    });
  });

  it('ArrowUp → focus_prev', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowUp', NO_MODIFIERS)).toEqual({
      type: 'focus_prev',
    });
  });
});

describe('UX-001.5 — resolveFocusBoundaryKeyEffect — Home / End / Escape', () => {
  it('Home → focus_first', () => {
    expect(resolveFocusBoundaryKeyEffect('Home', NO_MODIFIERS)).toEqual({
      type: 'focus_first',
    });
  });

  it('End → focus_last', () => {
    expect(resolveFocusBoundaryKeyEffect('End', NO_MODIFIERS)).toEqual({
      type: 'focus_last',
    });
  });

  it('Escape → exit_boundary', () => {
    expect(resolveFocusBoundaryKeyEffect('Escape', NO_MODIFIERS)).toEqual({
      type: 'exit_boundary',
    });
  });
});

describe('UX-001.5 — resolveFocusBoundaryKeyEffect — modifier noop', () => {
  it('Shift + ArrowRight → noop (preserves Shift+Tab behavior at OS level)', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowRight', { shift: true })).toEqual(
      FOCUS_BOUNDARY_NOOP,
    );
  });

  it('Ctrl + Home → noop', () => {
    expect(resolveFocusBoundaryKeyEffect('Home', { ctrl: true })).toEqual(
      FOCUS_BOUNDARY_NOOP,
    );
  });

  it('Meta + Escape → noop', () => {
    expect(resolveFocusBoundaryKeyEffect('Escape', { meta: true })).toEqual(
      FOCUS_BOUNDARY_NOOP,
    );
  });

  it('Alt + ArrowLeft → noop', () => {
    expect(resolveFocusBoundaryKeyEffect('ArrowLeft', { alt: true })).toEqual(
      FOCUS_BOUNDARY_NOOP,
    );
  });
});

describe('UX-001.5 — resolveFocusBoundaryKeyEffect — unknown keys', () => {
  it('unknown key → noop', () => {
    expect(resolveFocusBoundaryKeyEffect('a', NO_MODIFIERS)).toEqual(FOCUS_BOUNDARY_NOOP);
    expect(resolveFocusBoundaryKeyEffect('Enter', NO_MODIFIERS)).toEqual(
      FOCUS_BOUNDARY_NOOP,
    );
    expect(resolveFocusBoundaryKeyEffect('', NO_MODIFIERS)).toEqual(FOCUS_BOUNDARY_NOOP);
  });
});

describe('UX-001.5 — applyFocusBoundaryEffect — wrap semantics', () => {
  const FOCUS_NEXT: FocusBoundaryKeyEffect = { type: 'focus_next' };
  const FOCUS_PREV: FocusBoundaryKeyEffect = { type: 'focus_prev' };

  it('returns null for an empty list regardless of effect', () => {
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, null, 0)).toBeNull();
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, 0, 0)).toBeNull();
    expect(applyFocusBoundaryEffect({ type: 'focus_first' }, null, 0)).toBeNull();
  });

  it('focus_next from null starts at 0', () => {
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, null, 3)).toBe(0);
  });

  it('focus_next at the end wraps to 0', () => {
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, 2, 3)).toBe(0);
  });

  it('focus_next mid-list advances by one', () => {
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, 0, 3)).toBe(1);
    expect(applyFocusBoundaryEffect(FOCUS_NEXT, 1, 3)).toBe(2);
  });

  it('focus_prev from null starts at last', () => {
    expect(applyFocusBoundaryEffect(FOCUS_PREV, null, 3)).toBe(2);
  });

  it('focus_prev at 0 wraps to last', () => {
    expect(applyFocusBoundaryEffect(FOCUS_PREV, 0, 3)).toBe(2);
  });

  it('focus_prev mid-list retreats by one', () => {
    expect(applyFocusBoundaryEffect(FOCUS_PREV, 2, 3)).toBe(1);
    expect(applyFocusBoundaryEffect(FOCUS_PREV, 1, 3)).toBe(0);
  });

  it('focus_first → 0', () => {
    expect(applyFocusBoundaryEffect({ type: 'focus_first' }, 2, 3)).toBe(0);
  });

  it('focus_last → total - 1', () => {
    expect(applyFocusBoundaryEffect({ type: 'focus_last' }, 0, 3)).toBe(2);
  });

  it('exit_boundary → null', () => {
    expect(applyFocusBoundaryEffect({ type: 'exit_boundary' }, 1, 3)).toBeNull();
  });

  it('noop preserves current', () => {
    expect(applyFocusBoundaryEffect(FOCUS_BOUNDARY_NOOP, 1, 3)).toBe(1);
    expect(applyFocusBoundaryEffect(FOCUS_BOUNDARY_NOOP, null, 3)).toBeNull();
  });
});

describe('UX-001.5 — FOCUS_BOUNDARY_NOOP singleton', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(FOCUS_BOUNDARY_NOOP)).toBe(true);
  });

  it('always equals the noop type', () => {
    expect(FOCUS_BOUNDARY_NOOP.type).toBe('noop');
  });
});
