/**
 * QOL-038 — invites barrel.
 *
 * The InvitePanel is the inviter-side surface; InviteRedeemGate is the
 * invitee-side surface; the model + deep-link + intent are the pure
 * helpers that the App.tsx wiring consumes.
 */
export { InvitePanel } from './InvitePanel';
export { InviteRedeemGate } from './InviteRedeemGate';
export type { InviteRedeemGateProps } from './InviteRedeemGate';

export {
  INVITE_PANEL_COPY,
  INVITE_REDEEM_COPY,
  INVITE_EMAIL_SUBJECT,
  BANNED_INVITE_FRAMING,
  buildInviteEmailBody,
  plainLanguageForInviteError,
  validateInviteEmailInput,
} from './inviteCopy';

export {
  INVITE_TRANSITIONS,
  computeLiveStatus,
  isInviteRedeemable,
  isLegalInviteTransition,
  maskInviteeEmail,
  normaliseInviteeEmail,
  summariseInviteForInviter,
  isIntendedSeat,
  isInviteStatus,
  type IntendedSeat,
  type InviteStatus,
  type InviteSummaryForInviter,
  type RoomInvite,
} from './inviteModel';

export {
  INVITE_ROUTE_PREFIX,
  NATIVE_INVITE_SCHEME_PREFIX,
  INVITE_TOKEN_MIN_LENGTH,
  INVITE_TOKEN_MAX_LENGTH,
  buildInviteLink,
  buildNativeInviteLink,
  isValidInviteTokenShape,
  parseInviteDeepLink,
  type ParsedInviteDeepLink,
} from './inviteDeepLink';

// ARG-ROOM-004 — the `/auth/callback?invite=<token>` → seat bridge extractor +
// the combined cold-start resolver App.tsx consumes.
export {
  extractBridgedInviteToken,
  resolveColdStartInviteToken,
} from './bridgedInviteToken';

export {
  PENDING_INVITE_INTENT_FRESHNESS_MS,
  PENDING_INVITE_INTENT_STORAGE_KEY,
  buildPendingInviteIntent,
  clearPendingInviteIntentFromStorage,
  isPendingInviteIntentFresh,
  loadFreshPendingInviteIntent,
  loadPendingInviteIntentFromStorage,
  parsePendingInviteIntent,
  savePendingInviteIntentToStorage,
  type PendingInviteIntent,
} from './pendingInviteIntent';

export {
  createRoomInvite,
  revokeRoomInvite,
  listInvitesForDebate,
  lookupInviteByToken,
  acceptRoomInvite,
  type AcceptRoomInviteInput,
  type AcceptRoomInviteResponse,
  type CreateRoomInviteInput,
  type CreateRoomInviteResponse,
  type InviteApiResult,
  type ListInvitesForDebateInput,
  type ListInvitesForDebateResponse,
  type LookupInviteByTokenInput,
  type LookupInviteByTokenResponse,
  type LookupInviteStatus,
  type RevokeRoomInviteInput,
  type RevokeRoomInviteResponse,
} from './inviteApi';

export { useRoomInvites } from './useRoomInvites';
export type { UseRoomInvitesResult } from './useRoomInvites';

export type {
  ArgumentRoomInviteRecord,
  InviteFormState,
} from './inviteTypes';
export { emptyInviteForm } from './inviteTypes';
