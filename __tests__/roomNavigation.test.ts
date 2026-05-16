jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
  SUPABASE_CONFIGURED: false,
}));

import {
  TAB_LABELS,
  ARGUMENT_ROOM_LABEL,
  START_ARGUMENT_LABEL,
  REPLY_LABEL,
  closedComposerState,
  openForNewArgument,
  openForReply,
  closeComposer,
  isComposerOpen,
  isReply,
} from '../src/features/arguments/roomNavigation';

// ── Tab labels ────────────────────────────────────────────────

describe('TAB_LABELS', () => {
  it('contains Arguments', () => {
    expect(TAB_LABELS.arguments).toBe('Arguments');
  });

  it('contains Account', () => {
    expect(TAB_LABELS.account).toBe('Account');
  });

  it('contains Debug', () => {
    expect(TAB_LABELS.debug).toBe('Debug');
  });

  it('does not contain Debates, Debate, or Compose tabs', () => {
    const keys = Object.keys(TAB_LABELS);
    expect(keys).not.toContain('debates');
    expect(keys).not.toContain('current_debate');
    expect(keys).not.toContain('composer');
  });

  it('has the four expected tab keys (arguments, account, admin, debug)', () => {
    expect(Object.keys(TAB_LABELS).sort()).toEqual(['account', 'admin', 'arguments', 'debug']);
  });
});

// ── Room and action labels ────────────────────────────────────

describe('room labels', () => {
  it('ARGUMENT_ROOM_LABEL is Argument Room', () => {
    expect(ARGUMENT_ROOM_LABEL).toBe('Argument Room');
  });

  it('START_ARGUMENT_LABEL mentions argument', () => {
    expect(START_ARGUMENT_LABEL.toLowerCase()).toContain('argument');
  });

  it('REPLY_LABEL is Reply', () => {
    expect(REPLY_LABEL).toBe('Reply');
  });
});

// ── Composer visibility state ─────────────────────────────────

describe('closedComposerState', () => {
  it('returns open: false', () => {
    expect(closedComposerState().open).toBe(false);
  });

  it('returns replyTargetId: null', () => {
    expect(closedComposerState().replyTargetId).toBeNull();
  });
});

describe('openForNewArgument (Start an argument)', () => {
  it('sets open: true', () => {
    expect(openForNewArgument().open).toBe(true);
  });

  it('sets replyTargetId: null (root, no parent)', () => {
    expect(openForNewArgument().replyTargetId).toBeNull();
  });

  it('isComposerOpen returns true', () => {
    expect(isComposerOpen(openForNewArgument())).toBe(true);
  });

  it('isReply returns false for root', () => {
    expect(isReply(openForNewArgument())).toBe(false);
  });
});

describe('openForReply', () => {
  it('sets open: true', () => {
    expect(openForReply('arg-123').open).toBe(true);
  });

  it('sets replyTargetId to the provided ID', () => {
    expect(openForReply('arg-abc').replyTargetId).toBe('arg-abc');
  });

  it('isComposerOpen returns true', () => {
    expect(isComposerOpen(openForReply('arg-xyz'))).toBe(true);
  });

  it('isReply returns true', () => {
    expect(isReply(openForReply('arg-123'))).toBe(true);
  });
});

describe('closeComposer (Cancel / Discard)', () => {
  it('sets open: false', () => {
    expect(closeComposer().open).toBe(false);
  });

  it('clears replyTargetId', () => {
    expect(closeComposer().replyTargetId).toBeNull();
  });

  it('isComposerOpen returns false', () => {
    expect(isComposerOpen(closeComposer())).toBe(false);
  });
});

// ── Submit path guard ─────────────────────────────────────────

describe('submit path', () => {
  it('submitArgumentDraft is exported from edgeFunctions (only submit path)', () => {
    const { submitArgumentDraft } = require('../src/lib/edgeFunctions');
    expect(typeof submitArgumentDraft).toBe('function');
  });
});
