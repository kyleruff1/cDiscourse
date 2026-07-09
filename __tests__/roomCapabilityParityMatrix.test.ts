/**
 * ROOM-004 (#886) — capability-parity matrix (THE defining artifact, QA-002 seed).
 *
 * The A x B parity rule: view choice is a lens, never a capability gate. For
 * every RailActionCode x viewerRole x actor class, the set of codes reachable
 * in the Exchange lens equals the set reachable in the Map lens, and every code
 * has ONE lens-independent handler class. A future Exchange-only capability
 * would diverge the two per-lens sets and FAIL this matrix.
 *
 * Handler identity is additionally proven by a source-scan: ArgumentRoom passes
 * the SAME handleRailAction to ExchangeView.onRailAction and to the Map popover
 * binding.
 */
import fs from 'fs';
import path from 'path';
import {
  PARITY_ACTION_CODES,
  exchangeNodeRowCodes,
  mapNodeRowCodes,
  railActionHandlerId,
  reachableRailActionCodes,
  reachableRailActionCodesWith,
} from '../src/features/arguments/room/roomCapabilityParity';
import { ROOM_RAIL_ACTION_CODES } from '../src/features/arguments/room/roomActionCodes';
import type { RailBubbleActor, RailViewerRole } from '../src/features/arguments/railActionCategories';

const VIEWER_ROLES: RailViewerRole[] = ['observer', 'participant'];
const ACTORS: RailBubbleActor[] = ['self', 'other', 'bot', 'admin', 'unknown'];

// ── Reachability parity across lenses ─────────────────────────

describe('ROOM-004 parity matrix — reachability is identical across lenses', () => {
  for (const code of PARITY_ACTION_CODES) {
    for (const vr of VIEWER_ROLES) {
      for (const actor of ACTORS) {
        it(`${code} @ ${vr}/${actor}: exchange reachability === map reachability`, () => {
          const inExchange = reachableRailActionCodes('exchange', vr, actor).has(code);
          const inMap = reachableRailActionCodes('map', vr, actor).has(code);
          expect(inMap).toBe(inExchange);
        });
      }
    }
  }

  it('the whole reachable SET is equal for every viewer x actor cell', () => {
    for (const vr of VIEWER_ROLES) {
      for (const actor of ACTORS) {
        const ex = [...reachableRailActionCodes('exchange', vr, actor)].sort();
        const mp = [...reachableRailActionCodes('map', vr, actor)].sort();
        expect({ vr, actor, mp }).toEqual({ vr, actor, mp: ex });
      }
    }
  });
});

// ── Handler class is lens-independent ─────────────────────────

describe('ROOM-004 parity matrix — handler class is lens-independent', () => {
  it('every parity code classifies to exactly one handler class', () => {
    for (const code of PARITY_ACTION_CODES) {
      const cls = railActionHandlerId(code);
      expect(['rail', 'act', 'go']).toContain(cls);
    }
  });

  it('PARITY_ACTION_CODES is the frozen ROOM_RAIL_ACTION_CODES (cannot drift)', () => {
    expect(PARITY_ACTION_CODES).toBe(ROOM_RAIL_ACTION_CODES);
  });
});

// ── Own-move sub-matrix ───────────────────────────────────────

describe('ROOM-004 parity matrix — both arms derive from the REAL production derivations', () => {
  it('participant-other: the Ringside derivation and the popover injection produce the SAME node row', () => {
    // Exchange arm = getBubbleControlsForActor (the Ringside card source).
    // Map arm = buildMapNodeActionSurface (the real popover injection).
    const ex = exchangeNodeRowCodes('participant', 'other');
    const mp = mapNodeRowCodes('participant', 'other');
    expect(mp).toEqual(ex);
    // And it is the FULL allowedControls set (mapped), not just reply / disagree.
    expect(ex).toEqual(['reply', 'disagree', 'flag', 'ask_source', 'ask_quote', 'split_branch', 'qualifiers']);
  });

  it('observer: both arms produce watch / join / share', () => {
    expect(exchangeNodeRowCodes('observer', 'other')).toEqual(['watch', 'join_aff', 'join_neg', 'share']);
    expect(mapNodeRowCodes('observer', 'other')).toEqual(['watch', 'join_aff', 'join_neg', 'share']);
  });
});

describe('ROOM-004 parity matrix — own-move contract', () => {
  it('reply / disagree are NOT reachable via the node row for self in EITHER lens', () => {
    expect(exchangeNodeRowCodes('participant', 'self')).not.toContain('reply');
    expect(exchangeNodeRowCodes('participant', 'self')).not.toContain('disagree');
    expect(mapNodeRowCodes('participant', 'self')).not.toContain('reply');
    expect(mapNodeRowCodes('participant', 'self')).not.toContain('disagree');
  });

  it('own node row is qualifiers + request_deletion only (mirrors the Ringside card)', () => {
    expect(exchangeNodeRowCodes('participant', 'self')).toEqual(['qualifiers', 'request_deletion']);
    expect(mapNodeRowCodes('participant', 'self')).toEqual(['qualifiers', 'request_deletion']);
  });

  it('qualifiers + request_deletion ARE reachable via Act for self in BOTH lenses', () => {
    for (const lens of ['exchange', 'map'] as const) {
      const set = reachableRailActionCodes(lens, 'participant', 'self');
      expect(set.has('qualifiers')).toBe(true);
      expect(set.has('request_deletion')).toBe(true);
      expect(railActionHandlerId('qualifiers')).toBe('act');
      expect(railActionHandlerId('request_deletion')).toBe('act');
    }
  });
});

// ── Negative control: the guard MUST be proven to fire ─────────

describe('ROOM-004 parity matrix — negative control (the guard fires on divergence)', () => {
  it('goes RED when a lens node row is stubbed to a subset', () => {
    const vr: RailViewerRole = 'participant';
    const actor: RailBubbleActor = 'other';
    // The real exchange reachable set (the source of truth for this cell).
    const realExchange = [...reachableRailActionCodes('exchange', vr, actor)].sort();
    // Simulate a Map lens that lost a capability (popover filtered to reply only).
    const stubbedMap = [...reachableRailActionCodesWith(['reply'], vr, actor)].sort();
    // The set-equality assertion the matrix runs WOULD fail on this divergence.
    expect(stubbedMap).not.toEqual(realExchange);
    // Concretely: disagree is reachable in exchange but dropped by the stub.
    expect(realExchange).toContain('disagree');
    expect(stubbedMap).not.toContain('disagree');
  });

  it('stays GREEN when the node row matches the real derivation', () => {
    const vr: RailViewerRole = 'participant';
    const actor: RailBubbleActor = 'other';
    const realExchange = [...reachableRailActionCodes('exchange', vr, actor)].sort();
    // Feeding the real map node row reproduces the exchange set (no divergence).
    const realMap = [...reachableRailActionCodesWith(mapNodeRowCodes(vr, actor), vr, actor)].sort();
    expect(realMap).toEqual(realExchange);
  });
});

// ── Handler identity (source-scan) — BOTH dispatch paths ──────

describe('ROOM-004 parity matrix — handler identity (both paths)', () => {
  const ROOM_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
    'utf8',
  );

  it('participant path: ExchangeView.onBubbleAction and the Map popover onPopoverControl both dispatch handleBubbleAction', () => {
    // The Ringside cards dispatch participant controls via onBubbleAction.
    expect(ROOM_SRC).toMatch(/<ExchangeView[\s\S]*?onBubbleAction=\{handleBubbleAction\}/);
    // The Map popover control binding wraps the SAME handleBubbleAction instance.
    expect(ROOM_SRC).toMatch(/onPopoverControl=\{\(control\) => \{\s*\n\s*if \(activeMessageId\) handleBubbleAction\(control, activeMessageId\);/);
  });

  it('observer path: ExchangeView.onRailAction and the Map popover onPopoverAction both dispatch handleRailAction', () => {
    expect(ROOM_SRC).toMatch(/<ExchangeView[\s\S]*?onRailAction=\{handleRailAction\}/);
    expect(ROOM_SRC).toMatch(/onPopoverAction=\{\(code\) => handleRailAction\(code, \{ activeMessageId \}\)\}/);
  });
});
