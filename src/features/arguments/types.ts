import type { PersistedPointTag } from '../metadata/pointTagsApi';
import type { MachineObservationResultRow } from '../nodeLabels/machineObservationPersistenceTypes';

export type { PersistedPointTag };
export type { MachineObservationResultRow };

export type ArgumentType =
  | 'thesis'
  | 'claim'
  | 'rebuttal'
  | 'counter_rebuttal'
  | 'evidence'
  | 'clarification_request'
  | 'concession'
  | 'synthesis';

export type ArgumentSide = 'affirmative' | 'negative' | 'neutral';
export type ArgumentStatus = 'draft' | 'posted' | 'hidden' | 'deleted';
export type DisagreementAxis = 'fact' | 'definition' | 'causal' | 'value' | 'evidence' | 'logic' | 'scope';
export type FlagSource = 'client_rules' | 'server_rules' | 'semantic_adapter' | 'user_report' | 'moderator';
export type FlagStatus = 'open' | 'needs_review' | 'confirmed' | 'dismissed';
export type TopicCheckMethod = 'lexical' | 'semantic_adapter' | 'manual';
export type TopicCheckStatus = 'satisfied' | 'weak' | 'failed' | 'not_applicable';

export interface ArgumentRow {
  id: string;
  debateId: string;
  parentId: string | null;
  authorId: string;
  argumentType: ArgumentType;
  side: ArgumentSide;
  body: string;
  depth: number;
  status: ArgumentStatus;
  targetExcerpt: string | null;
  disagreementAxis: DisagreementAxis | null;
  railPayload: Record<string, unknown>;
  clientValidation: Record<string, unknown>;
  serverValidation: Record<string, unknown>;
  clientSubmissionId: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * ADMIN-ARGS-INACTIVE-001 — lifecycle visibility state. NULL = active
   * (default views include it). NOT NULL = inactive (default views exclude
   * it). Pure-TS belt-and-braces filters compare against NULL.
   *
   * For non-admin viewers, this should ALWAYS be `null` because the RLS
   * policy + SQL predicate at the loader excludes inactive rows. The
   * pure-TS belt-and-braces check is defense-in-depth against future
   * loader refactors.
   *
   * Optional so existing test fixtures (predate this column) keep
   * compiling; absence is treated as `null` (active) at every filter site.
   */
  inactiveAt?: string | null;
}

export interface ArgumentTag {
  argumentId: string;
  tagCode: string;
  createdAt: string;
}

export interface ArgumentFlag {
  id: string;
  debateId: string;
  argumentId: string;
  flagCode: string;
  ruleCode: string | null;
  source: FlagSource;
  confidence: number | null;
  status: FlagStatus;
  createdAt: string;
}

export interface TopicSatisfactionCheck {
  id: string;
  debateId: string;
  argumentId: string;
  method: TopicCheckMethod;
  score: number;
  threshold: number;
  status: TopicCheckStatus;
  matchedTerms: string[];
  missingTerms: string[];
  createdAt: string;
}

export interface ArgumentRelations {
  tags: ArgumentTag[];
  flags: ArgumentFlag[];
  checks: TopicSatisfactionCheck[];
  /**
   * META-1A — Persisted manual-tag rows (`public.point_tags`), active only
   * (`removed_at is null`). Empty when META-1A is not yet deployed.
   */
  pointTags: PersistedPointTag[];
  /**
   * MCP-021B — Persisted Machine Observation result rows
   * (`public.argument_machine_observation_results`). Empty when MCP-021C
   * has not yet written rows for the room, or when the caller is
   * unauthorized to read.
   */
  persistedObservations: MachineObservationResultRow[];
}

export interface ArgumentCache {
  argumentsById: Record<string, ArgumentRow>;
  childIdsByParentId: Record<string, string[]>;
  tagsByArgumentId: Record<string, ArgumentTag[]>;
  flagsByArgumentId: Record<string, ArgumentFlag[]>;
  checksByArgumentId: Record<string, TopicSatisfactionCheck[]>;
  detachedArgumentIds: string[];
  loadedParentIds: Set<string>;
  loadedAtByParentId: Record<string, string>;
}

export interface ArgumentViewportState {
  debateId: string;
  focusedArgumentId: string | null;
  selectedParentId: string | null;
  rootCursor: string | null;
  pageSize: number;
  expandedArgumentIds: string[];
  collapsedArgumentIds: string[];
  visibleArgumentIds: string[];
  focusedPathIds: string[];
}
