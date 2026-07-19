/**
 * A11Y-PR0 (#913) — overlay accessibility barrel.
 *
 * Public surface for the web-only overlay-a11y layer: the pure Tab-trap
 * model, the shared LIFO layer stack, and the useOverlayA11y hook.
 */
export {
  FOCUSABLE_SELECTOR,
  FOCUS_TRAP_PASS,
  resolveFocusTrapEffect,
} from './overlayFocusTrapModel';
export type { FocusTrapEffect, FocusTrapInput } from './overlayFocusTrapModel';

export {
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
} from './overlayLayerStack';
export type { OverlayLayerId } from './overlayLayerStack';

export { useOverlayA11y } from './useOverlayA11y';
export type {
  UseOverlayA11yOptions,
  UseOverlayA11yResult,
} from './useOverlayA11y';

// A11Y-PR0-FOLLOW (issue 915) — native-only hardware-back dismissal for the
// two inline (non-Modal) sheets.
export { useNativeBackClose } from './useNativeBackClose';
