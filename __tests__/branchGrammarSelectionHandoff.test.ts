/**
 * BR-004 — branch selection hand-off to IX-004.
 *
 * BR-004 does NOT modify IX-004's readout panel or model. A branch
 * selection resolves to a MESSAGE id (the branch root) which is fed into
 * IX-004's existing selected-message channel. This suite asserts:
 *   - resolveBranchSelectionHandoff produces a value shaped exactly to
 *     IX-004's inputs (`branchRootMessageId` string + `status` ∈
 *     ReadoutSelectionStatus); the status is always 'explicit'.
 *   - Static scan: branchGrammarModel.ts + branchGrammarRenderContract.ts
 *     contain zero references to a navigation library — selecting a
 *     branch never triggers a route transition.
 *   - Both pure models import no React / Supabase / network / secret /
 *     AI provider — they are pure TS.
 */
import fs from 'fs';
import path from 'path';
import {
  resolveBranchSelectionHandoff,
  type BranchGrammarNode,
  type BranchSelectionHandoff,
} from '../src/features/arguments/branchGrammarModel';
import type { ReadoutSelectionStatus } from '../src/features/arguments/timelineSelectedReadoutModel';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const MODEL_REL = 'src/features/arguments/branchGrammarModel.ts';
const RENDER_REL = 'src/features/arguments/branchGrammarRenderContract.ts';

// ── 1. Hand-off shape matches IX-004's inputs ─────────────────────

describe('resolveBranchSelectionHandoff — IX-004-shaped output', () => {
  function grammarNode(over: Partial<BranchGrammarNode> = {}): BranchGrammarNode {
    return {
      branchId: over.branchId ?? 'b1',
      direction: over.direction ?? 'tangent_diagonal',
      originNodeId: over.originNodeId ?? 'branch-root-msg',
      participantCount: over.participantCount ?? 1,
      lastActivityAt: over.lastActivityAt ?? null,
      unresolvedAxisCount: over.unresolvedAxisCount ?? 0,
      primaryPartyEngaged: over.primaryPartyEngaged ?? false,
      offshootDepthCapReached: over.offshootDepthCapReached ?? false,
    };
  }

  const grammarMap = new Map<string, BranchGrammarNode>([['b1', grammarNode()]]);

  it('produces a branchRootMessageId string + a ReadoutSelectionStatus', () => {
    const h = resolveBranchSelectionHandoff('b1', grammarMap);
    expect(h).not.toBeNull();
    expect(typeof h?.branchRootMessageId).toBe('string');
    // The status must be assignable to IX-004's ReadoutSelectionStatus.
    const status: ReadoutSelectionStatus | undefined = h?.status;
    expect(status).toBeDefined();
  });

  it('the status is always "explicit" for a deliberate branch click', () => {
    const h = resolveBranchSelectionHandoff('b1', grammarMap);
    expect(h?.status).toBe('explicit');
  });

  it('the branchRootMessageId is the grammar node originNodeId — feeds the existing channel verbatim', () => {
    const h = resolveBranchSelectionHandoff('b1', grammarMap);
    expect(h?.branchRootMessageId).toBe('branch-root-msg');
  });

  it('the hand-off has exactly the two IX-004-shaped keys (no extra surface)', () => {
    const h = resolveBranchSelectionHandoff('b1', grammarMap) as BranchSelectionHandoff;
    expect(Object.keys(h).sort()).toEqual(['branchRootMessageId', 'status']);
  });

  it('returns null for an unknown branch (defensive, no throw)', () => {
    expect(resolveBranchSelectionHandoff('missing', grammarMap)).toBeNull();
  });
});

// ── 2. The grammar models never trigger a route transition ────────

const ROUTING_PATTERNS: RegExp[] = [
  /from\s+['"]@react-navigation\/[^'"]+['"]/,
  /from\s+['"]expo-router['"]/,
  /from\s+['"]react-router(?:-native|-dom)?['"]/,
  /\brouter\./,
  /\bnavigation\./,
];

describe('BR-004 grammar models — selection triggers no route transition', () => {
  it.each([MODEL_REL, RENDER_REL])('%s references no navigation primitive', (rel) => {
    const src = read(rel);
    for (const re of ROUTING_PATTERNS) {
      expect(src).not.toMatch(re);
    }
  });
});

// ── 3. The grammar models are pure TS ─────────────────────────────

describe('BR-004 grammar models — pure TS (no React / Supabase / network / AI)', () => {
  it.each([MODEL_REL, RENDER_REL])('%s imports no React', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/from\s+['"]react['"]/);
    expect(src).not.toMatch(/from\s+['"]react-native['"]/);
  });

  it.each([MODEL_REL, RENDER_REL])('%s imports no Supabase client', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/from\s+['"]@supabase\/[^'"]+['"]/);
    expect(src).not.toMatch(/\bsupabase\.[A-Za-z]/);
    expect(src).not.toMatch(/createClient\s*\(/);
  });

  it.each([MODEL_REL, RENDER_REL])('%s makes no network call', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });

  it.each([MODEL_REL, RENDER_REL])('%s references no secret token', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/SERVICE_ROLE/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
  });

  it.each([MODEL_REL, RENDER_REL])('%s references no AI provider', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/\bAnthropic\b/);
    expect(src).not.toMatch(/api\.x\.ai/);
    expect(src).not.toMatch(/api\.anthropic\.com/);
  });
});
