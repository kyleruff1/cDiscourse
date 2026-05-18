/**
 * TL-001 — Make Timeline the default room landing mode.
 *
 * Tests the default view mode constant, the gallery entry hint contract
 * for the four scenarios named in the issue body (non-participant,
 * existing participant, new debate, no modal on entry), and verifies
 * that App.tsx wires the default constant rather than a hardcoded
 * literal.
 */
import fs from 'fs';
import path from 'path';
import { DEFAULT_VIEW_MODE } from '../src/features/arguments/viewModeCopy';
import {
  deriveConversationEntryHint,
  type ConversationGalleryCard,
} from '../src/features/debates/conversationGalleryModel';

// ── DEFAULT_VIEW_MODE constant ───────────────────────────────────

describe('TL-001 default view mode constant', () => {
  it('DEFAULT_VIEW_MODE is "timeline"', () => {
    expect(DEFAULT_VIEW_MODE).toBe('timeline');
  });

  it('DEFAULT_VIEW_MODE is NOT "stack"', () => {
    // Guard against an accidental revert — the whole TL-001 ask is to flip
    // away from the prior Stack default.
    expect(DEFAULT_VIEW_MODE as string).not.toBe('stack');
  });
});

// ── App.tsx wires the constant, not a hardcoded literal ──────────

describe('TL-001 App.tsx wires DEFAULT_VIEW_MODE', () => {
  const appTsx = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');

  it('imports DEFAULT_VIEW_MODE from viewModeCopy', () => {
    expect(appTsx).toMatch(/import\s*\{[^}]*\bDEFAULT_VIEW_MODE\b[^}]*\}\s*from\s*['"][^'"]*viewModeCopy['"]/);
  });

  it('initialises viewMode with DEFAULT_VIEW_MODE', () => {
    expect(appTsx).toMatch(/useState<ArgumentViewMode>\(DEFAULT_VIEW_MODE\)/);
  });

  it('does NOT hardcode useState<ArgumentViewMode>(\'stack\') anywhere', () => {
    expect(appTsx).not.toMatch(/useState<ArgumentViewMode>\(\s*['"]stack['"]\s*\)/);
  });
});

// ── Gallery-driven entry hints (the four issue scenarios) ────────

/**
 * `deriveConversationEntryHint` only reads `bucket` + `hasNoRebuttal`.
 * We cast through `unknown` to keep this test focused on the contract
 * without recreating the full card shape on every call.
 */
function card(partial: { bucket?: ConversationGalleryCard['bucket']; hasNoRebuttal?: boolean; hasUserJoined?: boolean; mySide?: ConversationGalleryCard['mySide'] }): ConversationGalleryCard {
  return {
    bucket: partial.bucket ?? 'all_open',
    hasNoRebuttal: partial.hasNoRebuttal ?? true,
    hasUserJoined: partial.hasUserJoined ?? false,
    mySide: partial.mySide ?? null,
  } as unknown as ConversationGalleryCard;
}

describe('TL-001 entry-hint contract under Timeline default', () => {
  it('non-participant opening a needs-first-rebuttal room activates root with "Be the first rebuttal"', () => {
    const hint = deriveConversationEntryHint(
      card({ bucket: 'needs_rebuttal', hasNoRebuttal: true, hasUserJoined: false }),
    );
    expect(hint.activate).toBe('root');
    expect(hint.microMomentLabel).toMatch(/be the first rebuttal/i);
  });

  it('existing participant returning to one of their rooms activates latest, not root', () => {
    const hint = deriveConversationEntryHint(
      card({
        bucket: 'my_rooms',
        hasNoRebuttal: false,
        hasUserJoined: true,
        mySide: 'affirmative',
      }),
    );
    expect(hint.activate).toBe('latest');
  });

  it('a brand-new debate (just the root) activates root, no matter the bucket', () => {
    const hint = deriveConversationEntryHint(
      card({ bucket: 'all_open', hasNoRebuttal: true }),
    );
    // `hasNoRebuttal` short-circuits to root regardless of bucket.
    expect(hint.activate).toBe('root');
    expect(hint.microMomentLabel).toMatch(/be the first rebuttal/i);
  });

  it('no JoinDebatePanel modal is in the gallery onSelect path (Stage 6.4 contract)', () => {
    const appTsx = fs.readFileSync(path.join(process.cwd(), 'App.tsx'), 'utf8');
    // The gallery `onSelect` should take (debate, side, hint) — the side is
    // chosen by `deriveConversationEntryHint` / explicit rail Join, never
    // through a modal popped on entry.
    expect(appTsx).toMatch(/onSelect=\{\(debate,\s*side,\s*hint\)/);
    // Confirm no `JoinDebatePanel` is mounted along the gallery onSelect chain
    // (it's still imported for the in-rail Join action — that's fine).
    expect(appTsx).not.toMatch(/onSelect=\{[^}]*JoinDebatePanel/);
  });

  it('entry-hint microMomentLabels contain no internal codes or verdict tokens', () => {
    const forbidden = /\b(winner|loser|truth|liar|dishonest|extremist|propagandist|topic_satisfaction|evidence_debt|max_depth)\b/i;
    const snake = /[a-z]_[a-z]/;
    const buckets = [
      'needs_rebuttal',
      'source_chain_fight',
      'evidence_fight',
      'definition_scope_fight',
      'unresolved_deep_chain',
      'hot_now',
      'gaining_heat',
      'pedantic_plain',
      'resolved_or_synthesized',
      'my_rooms',
      'all_open',
    ] as const;
    for (const b of buckets) {
      const hint = deriveConversationEntryHint(
        card({ bucket: b, hasNoRebuttal: b === 'needs_rebuttal' }),
      );
      expect(hint.microMomentLabel).not.toMatch(forbidden);
      expect(hint.microMomentLabel).not.toMatch(snake);
    }
  });
});
