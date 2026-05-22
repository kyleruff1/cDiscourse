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
  | 'metadata_events'
  | 'semantic_referee';

export const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  users: 'Users',
  view_as: 'View As',
  history: 'History',
  blocks: 'Blocks',
  bot_users: 'Bot Users',
  arguments: 'Arguments',
  metadata_events: 'Metadata Events',
  semantic_referee: 'Semantic Referee',
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
}
