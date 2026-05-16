export type DebateStatus = 'draft' | 'open' | 'locked' | 'archived';
export type ParticipantSide = 'affirmative' | 'negative' | 'observer' | 'moderator';

export interface Debate {
  id: string;
  createdBy: string;
  title: string;
  resolution: string;
  description: string;
  status: DebateStatus;
  constitutionId: string;
  createdAt: string;
  updatedAt: string;
  myParticipantSide: ParticipantSide | null;
}

export interface CreateDebateInput {
  title: string;
  resolution: string;
  description: string;
}

export interface JoinResult {
  side: ParticipantSide;
  alreadyJoined: boolean;
}

export type DebateApiResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
