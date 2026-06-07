/**
 * Admin feature types. Mirror the shapes returned by admin-users Edge Function.
 * No service keys; no secrets.
 */
import type { ProfileRole } from '../account/types';

// ADMIN-AI-001 — the semantic-referee runtime-config view type is owned by
// `src/lib/edgeFunctions.ts` (it is an `admin-users` response shape); the
// admin feature re-exports it so tab code imports it from one place.
export type {
  SemanticRefereeConfigView,
  SetSemanticRefereeConfigInput,
} from '../../lib/edgeFunctions';

export interface AdminUserSummary {
  id: string;
  email: string | null;
  displayName: string | null;
  role: ProfileRole;
  admin: boolean;
  isBot: boolean;
  botLabel: string | null;
  botPersona: string | null;
  botEnabled: boolean | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
}

export interface AdminUserDetail {
  auth: {
    id: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    bannedUntil: string | null;
    emailConfirmedAt: string | null;
  };
  profile: {
    id: string;
    display_name: string | null;
    role: ProfileRole;
    created_at: string;
  } | null;
  bot: {
    id: string;
    label: string;
    persona: string | null;
    enabled: boolean;
    created_at: string;
  } | null;
  argumentCount: number;
  recentArguments: Array<{
    id: string;
    debate_id: string;
    argument_type: string;
    side: string;
    body: string;
    status: string;
    created_at: string;
  }>;
  recentAuditEvents: AdminAuditEvent[];
  recentParticipations: Array<{
    debate_id: string;
    role: string;
    created_at: string;
  }>;
}

export interface AdminAuditEvent {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  actor_user_id: string | null;
  target_user_id?: string | null;
  payload: Record<string, unknown>;
}

export interface AdminBlockRule {
  id: string;
  block_type: 'email' | 'email_domain' | 'ip' | 'ip_cidr' | 'profile';
  value: string;
  normalized_value: string;
  reason: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  lifted_by: string | null;
  lifted_at: string | null;
}

export interface AdminViewAsSnapshot {
  readOnly: true;
  note: string;
  target: {
    id: string;
    email: string | null;
    profile: AdminUserDetail['profile'];
    bot: AdminUserDetail['bot'];
  };
  recentArguments: AdminUserDetail['recentArguments'];
  recentParticipations: AdminUserDetail['recentParticipations'];
  recentAuditEvents: AdminAuditEvent[];
}

export type AdminTab =
  | 'users'
  | 'view_as'
  | 'history'
  | 'blocks'
  | 'bot_users'
  | 'arguments'
  // ADMIN-CONV-INACTIVE-001 — per-debate (conversation) inactive visibility tab.
  | 'debates'
  | 'metadata_events'
  | 'semantic_referee'
  // OPS-MCP-OBSERVABILITY-002 — read-only classifier-health diagnostic panel.
  | 'classifier_health';

export const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  users: 'Users',
  view_as: 'View As',
  history: 'History',
  blocks: 'Blocks',
  bot_users: 'Bot Users',
  arguments: 'Arguments',
  debates: 'Debates',
  metadata_events: 'Metadata Events',
  semantic_referee: 'Semantic Referee',
  classifier_health: 'Classifier Health',
};

/**
 * One row in the AdminArgumentsTab. Shape is what the tab's loader returns
 * after joining `public.arguments` with `public.debates` (title) and
 * `public.profiles` (display name). Admin RLS already permits the SELECT.
 */
export interface AdminArgumentRow {
  id: string;
  debateId: string;
  debateTitle: string | null;
  /**
   * ADMIN-CONV-INACTIVE-001 — the parent DEBATE's (conversation's) inactive
   * timestamp (the #514 debate-level inactivation). NULL = the conversation is
   * active; NOT NULL = an admin has inactivated the whole room. Distinct from
   * the per-argument `inactiveAt` below (an individual statement fold). Carries
   * WHAT (the timestamp) only — NEVER `inactive_reason` / `inactive_by`
   * (doctrine §10a).
   */
  debateInactiveAt: string | null;
  authorId: string | null;
  authorDisplayName: string | null;
  argumentType: string;
  side: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  disagreementAxis: string | null;
  selectedTagCodes: string[] | null;
  targetExcerpt: string | null;
  hasFlags: boolean;
  topicSatisfactionScore: number | null;
  /**
   * ADMIN-ARGS-INACTIVE-001 — lifecycle visibility. NULL = active. NOT NULL
   * = inactive (hidden from default views). Reversible.
   */
  inactiveAt: string | null;
  /** Admin profile id that performed the most recent inactivation transition. */
  inactiveBy: string | null;
  /**
   * Admin-only free text. The row carries this value for admin row-detail;
   * the UI MUST gate rendering on admin row detail and MUST NOT render this
   * on any user-facing argument surface (doctrine §10a — composer-only).
   */
  inactiveReason: string | null;
}

/**
 * ADMIN-CONV-INACTIVE-001 — one loader row for the AdminDebatesTab.
 *
 * Joins `public.debates` with `profiles(display_name)` for `created_by`
 * (FK-pinned to `debates_created_by_fkey`; the inactivator's profile is NEVER
 * embedded — doctrine §10a). Carries `inactiveReason` from the DB (admin-only);
 * the RENDER view-model (`AdminDebateRowView` below) STRUCTURALLY OMITS it so
 * it can never reach a rendered surface.
 */
export interface AdminDebateRow {
  id: string;
  title: string | null;
  resolution: string;
  status: string;
  visibility: string;
  createdBy: string | null;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Lifecycle visibility. NULL = active. NOT NULL = inactive. Reversible. */
  inactiveAt: string | null;
  inactiveBy: string | null;
  /**
   * Admin-only free text. Present on the loader row; the render view-model
   * OMITS this field so it can never reach a rendered surface (doctrine §10a).
   */
  inactiveReason: string | null;
}

/**
 * ADMIN-CONV-INACTIVE-001 — what AdminDebatesTab actually renders.
 *
 * `inactiveReason` is STRUCTURALLY ABSENT — there is no field on this type to
 * render. `isInactive` is derived from `inactiveAt` only. The reason-omitting
 * projection (`toAdminDebateRowView`) is enforced by the type system, not just
 * by reviewer vigilance.
 */
export interface AdminDebateRowView {
  id: string;
  title: string | null;
  resolution: string;
  status: string;
  visibility: string;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  inactiveAt: string | null;
  /** Derived: inactiveAt !== null. */
  isInactive: boolean;
  // NOTE: no inactiveReason field. By construction (doctrine §10a leak gate).
}
