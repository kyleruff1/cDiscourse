// Pure navigation helpers for the argument-first UI.
// No React, no Supabase — fully testable.

export type ArgumentRoomTab = 'arguments' | 'account' | 'debug';

export const TAB_LABELS: Record<ArgumentRoomTab, string> = {
  arguments: 'Arguments',
  account: 'Account',
  debug: 'Debug',
};

export const ARGUMENT_ROOM_LABEL = 'Argument Room';
export const START_ARGUMENT_LABEL = 'Start an argument';
export const REPLY_LABEL = 'Reply';

export interface ComposerVisibility {
  open: boolean;
  replyTargetId: string | null;
}

export function closedComposerState(): ComposerVisibility {
  return { open: false, replyTargetId: null };
}

export function openForNewArgument(): ComposerVisibility {
  return { open: true, replyTargetId: null };
}

export function openForReply(replyTargetId: string): ComposerVisibility {
  return { open: true, replyTargetId };
}

export function closeComposer(): ComposerVisibility {
  return { open: false, replyTargetId: null };
}

export function isComposerOpen(state: ComposerVisibility): boolean {
  return state.open;
}

export function isReply(state: ComposerVisibility): boolean {
  return state.open && state.replyTargetId !== null;
}
