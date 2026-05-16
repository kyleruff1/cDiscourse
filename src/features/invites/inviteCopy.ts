/**
 * Invite copy strings — pure constants, no network.
 * Stage 6.1.0
 */

export const INVITE_PANEL_COPY = {
  title: 'Invite a challenger',
  subtitle: 'Invite someone to take the other side.',
  bodyDescription:
    'They can join, counter, add receipts, concede, or branch the argument.',
  emailOrNameLabel: 'Email or display name',
  emailOrNamePlaceholder: 'name@example.com or @username',
  copyInviteText: 'Copy invite text',
  copyRoomLink: 'Copy room link',
  markAsPlanned: 'Mark as planned invite',
  inviteBackendNotice: 'Invite sending coming later.',
  inviteTextTemplate: (roomTitle: string, claim: string) =>
    `You've been invited to argue about: "${roomTitle}"\nClaim: ${claim}\n\nJoin the argument and take a side.`,
  roomLinkPlaceholder: '[room link — invite backend coming later]',
} as const;

export const INVITE_ROLE_LABELS: Record<string, string> = {
  challenger: 'Take the other side',
  supporter: 'Support my side',
  observer: 'Watch',
  any: 'Any role',
};

export function buildInviteText(roomTitle: string, claim: string): string {
  return INVITE_PANEL_COPY.inviteTextTemplate(roomTitle, claim);
}
