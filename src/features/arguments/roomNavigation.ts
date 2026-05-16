// Pure navigation helpers for the argument-first UI.
// No React, no Supabase — fully testable.

export type ArgumentRoomTab = 'arguments' | 'account' | 'admin' | 'debug';

export const TAB_LABELS: Record<ArgumentRoomTab, string> = {
  arguments: 'Arguments',
  account: 'Account',
  admin: 'Admin',
  debug: 'Debug',
};

/**
 * Returns the list of tabs visible to a user with the given role.
 * Pure function — no React. Used by the tab bar and tested directly.
 *
 * - Admin tab is shown only when role === 'admin'.
 * - Debug tab is shown only in __DEV__.
 */
export function getVisibleTabs(role: string | null | undefined, isDev: boolean): ArgumentRoomTab[] {
  const tabs: ArgumentRoomTab[] = ['arguments', 'account'];
  if (role === 'admin') tabs.push('admin');
  if (isDev) tabs.push('debug');
  return tabs;
}

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
