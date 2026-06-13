/**
 * Invite copy strings — pure constants, no network.
 *
 * QOL-038 rewrite (2026-05-24): the Stage 6.1.0 placeholder copy is
 * superseded; the room-setup-side copy (`INVITE_PANEL_COPY`) moves to
 * the post-QOL-035 framing (the design's §9), and the invite-email
 * subject/body strings + the plain-language error-code map are added.
 *
 * Doctrine: no banned framing in any user-visible string. The banned
 * tokens (see `BANNED_INVITE_FRAMING` below) are NEVER mentioned in any
 * label, helper, placeholder, button copy, or email body. A doctrine
 * ban-list test scans every exported string.
 */

/**
 * Banned framing tokens for any user-visible invite string. Asserted by
 * `__tests__/inviteCopyDoctrine.test.ts`. The bottom four are the
 * QOL-038 issue-acceptance non-negotiables (`debate challenge` /
 * `game invite`) plus the post-QOL-035 framing scrub
 * (`challenger`/`opponent`).
 */
export const BANNED_INVITE_FRAMING = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  // post-QOL-035 framing
  'challenger',
  'opponent',
  // QOL-038 issue-acceptance non-negotiables.
  // These two literals are the BANNED list itself, NOT user-facing
  // copy — the ban-list doctrine test scans every other invite string
  // and asserts these tokens do not appear. The audit script is
  // told to skip the lines so this negation-by-listing doesn't
  // false-fire on the auditor.
  'debate challenge', // ux-audit-ignore-line
  'game invite', // ux-audit-ignore-line
] as const;

/**
 * Subject + body for the invitation email. QOL-040 will eventually send
 * this; QOL-038 ships it as the wire-up target so the strings are
 * frozen now (the operator can preview them via the inviter's
 * "Copy invite text" affordance).
 *
 * Doctrine: `respond` is the verb. No "challenge", no "argue about", no
 * "take a side".
 */
export const INVITE_EMAIL_SUBJECT = 'You were invited to respond to an argument';

export function buildInviteEmailBody(input: {
  roomTitle: string;
  inviteLink: string;
  invitedByDisplayName?: string | null;
}): string {
  const title = String(input.roomTitle || '').trim() || '(this argument)';
  const inviter =
    typeof input.invitedByDisplayName === 'string' && input.invitedByDisplayName.trim().length > 0
      ? input.invitedByDisplayName.trim()
      : 'A CDiscourse user';
  return [
    `${inviter} invited you to respond to an argument on CDiscourse:`,
    '',
    `"${title}"`,
    '',
    'Open this link to join the argument and post your response:',
    input.inviteLink,
    '',
    'This link is for you and expires in 14 days. If you don\'t recognize this argument, you can ignore the email.',
  ].join('\n');
}

/**
 * The InvitePanel copy bundle. Post-QOL-038 framing.
 */
export const INVITE_PANEL_COPY = {
  title: 'Invite someone to this argument',
  subtitle: 'They\'ll get a link that takes them straight to this argument.',
  bodyDescription:
    'Use email — they sign in (or sign up) once and land directly on the response screen.',
  emailLabel: 'Their email address',
  emailPlaceholder: 'name@example.com',
  sendButton: 'Send invite',
  sendingButton: 'Sending…',
  copyLinkButton: 'Copy invite link',
  copyLinkSuccess: 'Copied',
  revokeButton: 'Revoke',
  pendingChipLabel: 'Pending',
  revokedChipLabel: 'Revoked',
  acceptedChipLabel: 'Joined',
  reusedNotice: 'There\'s already a pending invite for that address.',
  emailedNotice: 'Invite emailed.',
  notAllowedNotice: 'Only participants in this argument can invite someone.',
  closePanel: 'Close invite panel',
  // QOL-035: title in the toolbar chip + accessibility label use "Invite"
  // / "Invite someone to this argument" — never "Invite a challenger".
  toolbarChipLabel: 'Invite',
  toolbarChipAccessibility: 'Invite someone to this argument',
} as const;

/**
 * The InviteRedeemGate copy bundle. Six redeem-side states + the §17
 * "Room archived" state (added by the QOL-038 designer pass).
 */
export const INVITE_REDEEM_COPY = {
  resolvingTitle: 'Opening your invite…',
  signedOutInvite: (roomTitle: string, inviter: string): string =>
    `${inviter} invited you to respond to an argument: "${roomTitle}". Continue to sign in.`,
  signedOutContinueButton: 'Continue',
  joiningTitle: 'Joining…',
  emailMismatchTitle: 'Different email address',
  emailMismatchBody: (inviter: string, viewerEmail: string): string =>
    `This invite was sent to a different email address. Sign in with the address the invite was sent to, or ask ${inviter} to re-send it to ${viewerEmail}.`,
  emailMismatchSignInElse: 'Sign in as someone else',
  expiredTitle: 'Invite expired',
  expiredBody: (inviter: string): string =>
    `This invite has expired. Ask ${inviter} to send a new one.`,
  revokedTitle: 'Invite no longer active',
  revokedBody: 'This invite is no longer active.',
  alreadyUsedTitle: 'Invite already used',
  alreadyUsedBody: 'This invite has already been used.',
  notFoundTitle: 'Invite link not found',
  notFoundBody: 'We couldn\'t open that invite link.',
  // QOL-038 §17 — soft-delete via debates.status='archived'.
  roomArchivedTitle: 'Argument archived',
  roomArchivedBody: (inviter: string): string =>
    `This argument was archived and is no longer active. Ask ${inviter} if there is a newer argument to join.`,
  roomClosedTitle: 'Argument settled',
  roomClosedBody: 'This argument is settled — you can\'t join now.',
  networkErrorTitle: 'Connection problem',
  networkErrorBody: 'We couldn\'t reach the server. Check your connection and try again.',
  retryButton: 'Retry',
  goHomeButton: 'Go to my arguments',
} as const;

/**
 * Map an Edge Function error code to plain-language UI copy. The fallback
 * for an unknown code is a generic message — the raw code is NEVER
 * echoed to the user (doctrine §9).
 */
const ERROR_CODE_MAP: Readonly<Record<string, string>> = {
  cannot_invite_self: 'You cannot invite yourself.',
  invalid_email: 'Enter a valid email address.',
  validation_failed: 'Some details need a fix — check the email address.',
  room_not_visible: 'You cannot invite to this argument.',
  not_allowed_to_invite: INVITE_PANEL_COPY.notAllowedNotice,
  room_archived: 'This argument was archived — you can\'t add people now.',
  room_closed: 'This argument is settled — you can\'t add people now.',
  // ARG-ROOM-006 item (g): the room already holds its one live invite (to
  // anyone). Neutral copy that names no one — no enumeration.
  room_already_has_invite: 'This argument already has an invite waiting.',
  invite_not_visible: 'You cannot manage this invite.',
  not_pending: 'This invite is no longer pending.',
  invite_revoked: 'This invite is no longer active.',
  invite_expired: 'This invite has expired.',
  invite_already_accepted: 'This invite has already been used.',
  invite_email_mismatch: 'This invite was sent to a different email address.',
  invite_not_found: 'We couldn\'t find that invite.',
  unauthorized: 'Please sign in.',
  network_error: 'We couldn\'t reach the server. Check your connection and try again.',
  empty_response: 'We didn\'t get a response. Try again.',
  invite_action_failed: 'That invite action could not be completed. Try again.',
  invite_insert_failed: 'We could not create that invite. Try again.',
  invite_lookup_failed: 'We could not open that invite. Try again.',
  invite_revoke_failed: 'We could not revoke that invite. Try again.',
  enrolment_failed: 'We could not join the argument. Try again.',
};

/** Returns plain-language copy for an Edge Function error code. */
export function plainLanguageForInviteError(code: string | null | undefined): string {
  if (typeof code !== 'string' || code.length === 0) {
    return ERROR_CODE_MAP.invite_action_failed;
  }
  const known = ERROR_CODE_MAP[code];
  if (known) return known;
  // Unknown code — never echo the raw token; return the generic fallback.
  return ERROR_CODE_MAP.invite_action_failed;
}

/**
 * Validate an email for the InvitePanel form. Returns null on valid;
 * otherwise the inline error string. Local-only — the wire-side
 * validator is the Edge Function's Zod schema.
 */
export function validateInviteEmailInput(email: string): string | null {
  if (!email || email.trim().length === 0) return 'Enter an email address.';
  if (email.trim().length > 320) return 'That email is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  return null;
}
