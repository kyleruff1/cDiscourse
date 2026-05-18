/**
 * Single source of truth for the user-facing labels + accessibility
 * copy of the two normal-user room views.
 *
 * Stage 6.5 / ST-001 — the internal `stack` mode is presented to users
 * as `Cards` to reinforce that Timeline is the primary board and Cards
 * is the deeper card-inspection mode. The internal `ArgumentViewMode`
 * union (`'stack' | 'timeline' | ...`) is intentionally NOT renamed so
 * existing pure-TS models, tests, and persisted state stay stable.
 */

export interface ViewModeCopy {
  /** Short chip label. Plain language, no verdict tokens. */
  label: string;
  /** Screen-reader label — names the view and its primacy. */
  accessibilityLabel: string;
  /** Screen-reader hint — explains what switching does. */
  accessibilityHint: string;
}

export const VIEW_MODE_COPY: { cards: ViewModeCopy; timeline: ViewModeCopy } = {
  // Internal mode id remains `stack`; user copy is `Cards`.
  cards: {
    label: 'Cards',
    accessibilityLabel: 'Cards view',
    accessibilityHint: 'Open the deeper card-inspection mode — focus on one move at a time.',
  },
  timeline: {
    label: 'Timeline',
    accessibilityLabel: 'Timeline map',
    accessibilityHint: 'Primary view — show the full conversation map.',
  },
};

/**
 * TL-001 — Timeline is the default room landing mode. Cards is reached
 * via the toolbar toggle. Internal id stays `'timeline'`; the visible
 * label comes from `VIEW_MODE_COPY.timeline.label`.
 */
export const DEFAULT_VIEW_MODE = 'timeline' as const;
