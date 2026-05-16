/** Domain model types mirroring the database schema. */

export type RoomStatus = 'open' | 'voting' | 'closed' | 'archived';
export type ArgumentSide = 'affirmative' | 'negative' | 'neutral';

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Room {
  id: string;
  resolution: string;
  description: string | null;
  status: RoomStatus;
  constitutionVersion: string;
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
  closedAt: string | null;
}

export interface RoomMember {
  roomId: string;
  userId: string;
  side: ArgumentSide;
  joinedAt: string;
}

export interface Argument {
  id: string;
  roomId: string;
  parentId: string | null;
  authorId: string;
  type: string;
  side: ArgumentSide;
  body: string;
  depth: number;
  tags: string[];
  evidence: EvidenceLink[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceLink {
  url: string;
  label: string;
  accessedAt?: string;
}

export interface DbFlag {
  id: string;
  argumentId: string;
  source: 'deterministic' | 'ai';
  ruleId: string;
  severity: 'info' | 'warning' | 'violation';
  message: string;
  payload: Record<string, unknown>;
  authoritative: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  dismissed: boolean;
  createdAt: string;
}
