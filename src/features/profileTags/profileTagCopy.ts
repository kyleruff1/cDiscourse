/**
 * PR-002 — User-facing copy for the "Profile tags" feature.
 *
 * Pure TypeScript. Every string a user can read lives here so the
 * doctrine ban-list test scans a single file.
 *
 * Doctrine (cdiscourse-doctrine §1/§9):
 *   - No verdict / truth tokens (winner, loser, correct, true, false …).
 *   - No internal codes leak — labels are human prose, never the enum id
 *     (`topic_climate` renders as "Climate & environment").
 *   - Plain language; the copy states plainly that tags are OPTIONAL and
 *     that they are saved on this device.
 *   - The "Accessibility" category copy makes clear these tags are inert
 *     social self-description — they are NOT the functional reduce-motion
 *     / colour settings PR-001 owns.
 */

// ── The "Profile tags" row inside the preferences popout ────────

export const PROFILE_TAGS_ROW_COPY = {
  label: 'Profile tags',
  helper:
    'Add a few optional tags about your interests and how you like to argue.',
  open: 'Open profile tags',
  openHint: 'Choose a few optional tags for your profile',
  /** Shown in the row when one or more tags are selected. */
  countSome: (n: number) => `${n} tag${n === 1 ? '' : 's'} added`,
  /** Shown in the row when no tags are selected. */
  countNone: 'No tags yet',
} as const;

// ── Popout chrome ───────────────────────────────────────────────

export const PROFILE_TAGS_POPOUT_COPY = {
  title: 'Profile tags',
  subtitle:
    'Tags are optional. They add a little context about you and are saved on this device.',
  close: 'Close profile tags',
  /** The "tags are optional" helper line shown under the header. */
  optionalHelper:
    'Tags are optional — pick a few (up to 5) or none at all. They never affect your points or whether a message can be posted.',
  /** The live "N of 5 selected" count line. */
  countLine: (n: number, max: number) => `${n} of ${max} selected`,
  /** Shown when no tags are selected. */
  emptyState: 'No tags yet — tags are optional.',
  /** Shown when the 5-tag cap is reached. */
  atLimitNote: 'You can add up to 5 tags — remove one to add another.',
  /** The "Clear all tags" button label (only shown when count > 0). */
  clearAll: 'Clear all tags',
  clearAllHint: 'Remove every selected tag',
} as const;

// ── Category section headers ────────────────────────────────────

export const PROFILE_TAG_CATEGORY_COPY = {
  topic_interest: {
    title: 'Topic interests',
    helper: 'Broad subjects you enjoy discussing.',
  },
  debate_style: {
    title: 'Argument style',
    helper: 'How you like to take part in a discussion.',
  },
  availability: {
    title: 'Availability',
    helper: 'A rough idea of when you tend to be around.',
  },
  accessibility_note: {
    title: 'Accessibility',
    helper:
      'Optional notes so others can be considerate. These are just self-description — your motion and colour settings live in My preferences.',
  },
} as const;

// ── Chip accessibility ──────────────────────────────────────────

/**
 * Build a descriptive chip accessibility label, e.g.
 * "Climate & environment, Topic interests, selected".
 */
export function chipAccessibilityLabel(
  tagLabel: string,
  categoryTitle: string,
  selected: boolean,
): string {
  return `${tagLabel}, ${categoryTitle}, ${selected ? 'selected' : 'not selected'}`;
}
