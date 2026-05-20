/**
 * PR-001 — User-facing copy for the "My preferences" popout.
 *
 * Pure TypeScript. Every string a user can read lives here so the
 * doctrine ban-list test scans a single file.
 *
 * Doctrine (cdiscourse-doctrine §1/§9):
 *   - No verdict / truth tokens (winner, loser, correct, true, false …).
 *   - No internal codes leak — option labels are human prose, never the
 *     enum value (`high_contrast` renders as "High contrast").
 *   - Honest copy: the notification stub and the colour-blind modes say
 *     plainly that they are not functional yet.
 */

// ── Popout chrome ───────────────────────────────────────────────

export const PREFERENCES_COPY = {
  title: 'My preferences',
  subtitle:
    'Adjust how the app looks and feels for you. These settings are saved on this device.',
  close: 'Close preferences',
  triggerLabel: 'Open my preferences',
  triggerHint: 'Adjust your profile and display settings',
} as const;

// ── Field 1 — Display name ──────────────────────────────────────

export const DISPLAY_NAME_COPY = {
  label: 'Display name',
  helper: 'The name other people see on your messages.',
  inputAccessibilityLabel: 'Display name',
  placeholder: 'Your name',
  save: 'Save name',
  saving: 'Saving…',
  saved: 'Name saved.',
  emptyHint: 'Enter a name before saving.',
} as const;

// ── Field 2 — Avatar preview ────────────────────────────────────

export const AVATAR_COPY = {
  label: 'Avatar',
  helper:
    'A generated picture made from your initials. Uploading your own picture is coming in a later update.',
} as const;

// ── Field 3 — Contact email (read-only) ─────────────────────────

export const CONTACT_EMAIL_COPY = {
  label: 'Contact email',
  helper: 'The email address linked to your account.',
  /**
   * Correction 2: contact email is read-only here. Changing it is a
   * separate later card — there is no email-change control to route to,
   * so we say so plainly rather than send the user to a dead end.
   */
  notAvailableNote:
    "You can't change your email here yet. Email updates are coming in a later update.",
  noneOnFile: 'No email on file.',
} as const;

// ── Field 4 — Notification preference (honest stub) ─────────────

export const NOTIFICATIONS_COPY = {
  label: 'Notifications',
  helper:
    "Notifications aren't available yet. This remembers your choice for when they are.",
  switchAccessibilityLabel: 'Remember my notification choice',
} as const;

// ── Field 5 — Default room entry ────────────────────────────────

export const ROOM_ENTRY_COPY = {
  label: 'When I open a conversation',
  helper: 'Choose how a conversation opens by default.',
  options: {
    observe: 'Watch first',
    last_used: 'Use my last side',
  },
} as const;

// ── Field 6 — Visual density ────────────────────────────────────

export const DENSITY_COPY = {
  label: 'Timeline spacing',
  helper: 'How far apart messages sit on the conversation timeline.',
  options: {
    compact: 'Compact',
    normal: 'Normal',
    expanded: 'Roomy',
  },
} as const;

// ── Field 7 — Colour accessibility ──────────────────────────────

export const COLOR_MODE_COPY = {
  label: 'Colour mode',
  helper: 'Choose a colour treatment that works best for you.',
  options: {
    default: 'Default',
    high_contrast: 'High contrast',
    protanopia: 'Red–green (type 1)',
    deuteranopia: 'Red–green (type 2)',
    tritanopia: 'Blue–yellow',
  },
  /**
   * Honest copy for the three simulation modes that are persisted but
   * inert in v1 — no palette-swap layer exists to drive them yet.
   */
  comingSoonNote:
    'Colour-blind palettes are coming. Your choice is saved and will apply when the timeline palette update ships. The timeline already uses shapes and outlines so meaning never depends on colour alone.',
  highContrastNote:
    'High contrast sharpens outlines and text on this screen.',
} as const;

// ── Field 8 — Reduce motion ─────────────────────────────────────

export const REDUCE_MOTION_COPY = {
  label: 'Reduce motion',
  helper:
    'Limit animations on the conversation timeline. "System" follows your device setting.',
  options: {
    system: 'System',
    on: 'On',
    off: 'Off',
  },
  systemHintOn: 'Your device currently has reduce motion turned on.',
  systemHintOff: 'Your device currently has reduce motion turned off.',
} as const;

// ── Field 9 — Default side label ────────────────────────────────

export const SIDE_LABEL_COPY = {
  label: 'Side labels',
  helper: 'How the two sides of a debate are named.',
  options: {
    for_against: 'For / Against',
    side_a_b: 'Side A / Side B',
  },
  /**
   * Field 9 caveat: there is no central side-label resolver to wire
   * into yet, so this preference is saved but does not change labels in
   * v1. The helper says so honestly.
   */
  persistOnlyNote:
    'Your choice is saved and will apply when side labels become adjustable across the app.',
} as const;
