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
  railActionHandlerId,
  reachableRailActionCodes,
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

describe('ROOM-004 parity matrix — own-move contract', () => {
  it('reply / disagree are NOT reachable via the node row for self in EITHER lens', () => {
    for (const lens of ['exchange', 'map'] as const) {
      const set = reachableRailActionCodes(lens, 'participant', 'self');
      expect(set.has('reply')).toBe(false);
      expect(set.has('disagree')).toBe(false);
    }
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

  it('participant-other reaches reply / disagree in BOTH lenses (handler class rail)', () => {
    for (const lens of ['exchange', 'map'] as const) {
      const set = reachableRailActionCodes(lens, 'participant', 'other');
      expect(set.has('reply')).toBe(true);
      expect(set.has('disagree')).toBe(true);
    }
    expect(railActionHandlerId('reply')).toBe('rail');
    expect(railActionHandlerId('disagree')).toBe('rail');
  });
});

// ── Handler identity (source-scan) ────────────────────────────

describe('ROOM-004 parity matrix — handler identity', () => {
  const ROOM_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/room/ArgumentRoom.tsx'),
    'utf8',
  );

  it('ExchangeView.onRailAction and the Map popover binding both dispatch handleRailAction', () => {
    // The Exchange lens receives handleRailAction directly.
    expect(ROOM_SRC).toMatch(/<ExchangeView[\s\S]*?onRailAction=\{handleRailAction\}/);
    // The Map popover binding wraps the SAME handleRailAction instance.
    expect(ROOM_SRC).toMatch(/onPopoverAction=\{\(code\) => handleRailAction\(code, \{ activeMessageId \}\)\}/);
  });
});
