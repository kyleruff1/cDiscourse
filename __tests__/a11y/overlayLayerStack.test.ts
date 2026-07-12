/**
 * A11Y-PR0 (#913) — overlayLayerStack tests: pure reducer + singleton facade.
 */
import {
  __resetOverlayLayerStack,
  depth,
  hasLayers,
  isTopmost,
  pushLayer,
  registerLayer,
  removeLayer,
  subscribe,
  topOf,
  unregisterLayer,
} from '../../src/features/a11y/overlayLayerStack';

describe('A11Y-PR0 — pure reducer', () => {
  it('pushLayer appends to the top', () => {
    expect(pushLayer([], 'a')).toEqual(['a']);
    expect(pushLayer(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('pushLayer is idempotent per id (no duplicate, same reference)', () => {
    const stack = ['a', 'b'];
    const next = pushLayer(stack, 'a');
    expect(next).toBe(stack);
    expect(next).toEqual(['a', 'b']);
  });

  it('removeLayer removes from the middle', () => {
    expect(removeLayer(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('removeLayer on an absent id returns the same reference', () => {
    const stack = ['a', 'b'];
    expect(removeLayer(stack, 'z')).toBe(stack);
  });

  it('topOf returns the last id or null', () => {
    expect(topOf([])).toBeNull();
    expect(topOf(['a'])).toBe('a');
    expect(topOf(['a', 'b'])).toBe('b');
  });
});

describe('A11Y-PR0 — singleton facade', () => {
  afterEach(() => {
    __resetOverlayLayerStack();
  });

  it('register then isTopmost is true; hasLayers / depth reflect the push', () => {
    expect(hasLayers()).toBe(false);
    expect(depth()).toBe(0);
    registerLayer('dock');
    expect(isTopmost('dock')).toBe(true);
    expect(hasLayers()).toBe(true);
    expect(depth()).toBe(1);
  });

  it('registering a second layer flips topmost to the newest', () => {
    registerLayer('dock');
    registerLayer('popout');
    expect(isTopmost('popout')).toBe(true);
    expect(isTopmost('dock')).toBe(false);
    expect(depth()).toBe(2);
  });

  it('unregistering the top restores the previous topmost', () => {
    registerLayer('dock');
    registerLayer('popout');
    unregisterLayer('popout');
    expect(isTopmost('dock')).toBe(true);
    expect(depth()).toBe(1);
  });

  it('registerLayer is idempotent per id (no duplicate push)', () => {
    registerLayer('dock');
    registerLayer('dock');
    expect(depth()).toBe(1);
  });

  it('subscribe fires on push and remove; unsubscribe stops it', () => {
    let count = 0;
    const unsub = subscribe(() => {
      count += 1;
    });
    registerLayer('dock');
    expect(count).toBe(1);
    unregisterLayer('dock');
    expect(count).toBe(2);
    unsub();
    registerLayer('later');
    expect(count).toBe(2);
  });

  it('__resetOverlayLayerStack clears the stack', () => {
    registerLayer('dock');
    registerLayer('popout');
    __resetOverlayLayerStack();
    expect(hasLayers()).toBe(false);
    expect(depth()).toBe(0);
    expect(isTopmost('dock')).toBe(false);
  });
});
