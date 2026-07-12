/**
 * A11Y-PR0 (#913) — overlay layer stack (pure reducer + module singleton).
 *
 * One LIFO stack of open overlay ids. It is the SINGLE arbiter of which
 * overlay owns Escape and the Tab trap: only the topmost layer traps Tab
 * and only the topmost layer dismisses on Escape. The composer dock reads
 * `isTopmost(dockLayer)` in its keydown handler so its Cmd+Enter / Cmd+K /
 * Esc shortcuts fall silent whenever any overlay is stacked above it —
 * this is the P0-3b single-Escape fix WITHOUT touching the pure
 * composerKeyboardModel (the dock gates at the handler, not the model).
 *
 * The reducer core (pushLayer / removeLayer / topOf) is pure and exported
 * for unit tests. The singleton facade holds one module-local array and
 * notifies subscribers on change so a React hook can re-read topmost.
 *
 * Doctrine: pure TS. No React, no DOM, no network, no Date. No verdict
 * tokens.
 */

export type OverlayLayerId = string;

// ── Pure reducer core (exported for unit tests) ──────────────────

/**
 * Push an id onto the top of the stack. Idempotent per id: pushing an id
 * that is already present returns the same array reference (no duplicate,
 * no reorder). Otherwise returns a new array with the id appended (the
 * last element is the topmost layer).
 */
export function pushLayer(
  stack: readonly OverlayLayerId[],
  id: OverlayLayerId,
): OverlayLayerId[] {
  if (stack.includes(id)) return stack as OverlayLayerId[];
  return [...stack, id];
}

/**
 * Remove an id from anywhere in the stack. Returns a new array with the id
 * removed; if the id is absent, returns the same array reference.
 */
export function removeLayer(
  stack: readonly OverlayLayerId[],
  id: OverlayLayerId,
): OverlayLayerId[] {
  if (!stack.includes(id)) return stack as OverlayLayerId[];
  return stack.filter((entry) => entry !== id);
}

/** The topmost (last) id, or null when the stack is empty. */
export function topOf(stack: readonly OverlayLayerId[]): OverlayLayerId | null {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

// ── Module-level LIFO singleton ──────────────────────────────────

let stack: OverlayLayerId[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A misbehaving listener must not corrupt the stack or block the
      // others; swallow and continue.
    }
  }
}

/** Push a layer (idempotent per id) and notify subscribers on change. */
export function registerLayer(id: OverlayLayerId): void {
  const next = pushLayer(stack, id);
  if (next !== stack) {
    stack = next;
    notify();
  }
}

/** Remove a layer and notify subscribers on change. */
export function unregisterLayer(id: OverlayLayerId): void {
  const next = removeLayer(stack, id);
  if (next !== stack) {
    stack = next;
    notify();
  }
}

/** True when `id` is the topmost registered layer. */
export function isTopmost(id: OverlayLayerId): boolean {
  return topOf(stack) === id;
}

/** True when at least one layer is registered. */
export function hasLayers(): boolean {
  return stack.length > 0;
}

/** The number of registered layers. */
export function depth(): number {
  return stack.length;
}

/**
 * Subscribe to stack changes. Returns an unsubscribe function. The
 * listener fires after every push / remove that mutates the stack.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only reset. Clears the module-local stack so a shared singleton
 * does not leak layers between test files. Call in `afterEach`.
 */
export function __resetOverlayLayerStack(): void {
  stack = [];
  notify();
}
