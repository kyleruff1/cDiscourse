/**
 * QOL-038 — InviteRedeemGate contract tests.
 *
 * Mirrors the InvitePanel test discipline: source scan + copy-bundle
 * integration. The component's renderable branches map 1-1 to the
 * §7.2 table + the §17 enrichment row; the test asserts each branch
 * has a dedicated panel component and references the right copy key.
 *
 * Doctrine:
 *  - No console.* anywhere (the gate handles a raw token).
 *  - The §17 room-archived branch fires on EITHER a lookup_by_token
 *    `room_archived` status OR an accept `room_archived` error code.
 *  - The escape hatch ("Go to my arguments") is universal — every
 *    panel renders it.
 *  - The auto-accept effect gates on (signed-in + live pending) and
 *    fires lookupInviteByToken → acceptRoomInvite without user input.
 */
import fs from 'fs';
import path from 'path';
import { INVITE_REDEEM_COPY } from '../src/features/invites/inviteCopy';

const componentSrc = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'invites', 'InviteRedeemGate.tsx'),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const code = stripComments(componentSrc);

// ── No console.* anywhere ─────────────────────────────────────

describe('InviteRedeemGate — no console.* anywhere (token-leak doctrine §5.7)', () => {
  it('contains no console.log / console.error / console.warn / console.info', () => {
    expect(code).not.toMatch(/console\./);
  });
});

// ── Imports ───────────────────────────────────────────────────

describe('InviteRedeemGate — imports', () => {
  it('imports lookupInviteByToken + acceptRoomInvite from the wrapper', () => {
    expect(code).toContain('lookupInviteByToken');
    expect(code).toContain('acceptRoomInvite');
    expect(code).toMatch(/from '\.\/inviteApi'/);
  });

  it('imports the redeem-copy bundle from inviteCopy', () => {
    expect(code).toContain('INVITE_REDEEM_COPY');
    expect(code).toMatch(/from '\.\/inviteCopy'/);
  });

  it('does NOT import the supabase client directly', () => {
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/lib\/supabase['"]/);
  });

  it('does NOT contain a SERVICE_ROLE literal', () => {
    expect(code).not.toContain('SERVICE_ROLE');
    expect(code).not.toContain('service_role');
  });
});

// ── State machine branches ────────────────────────────────────

describe('InviteRedeemGate — covers every §7.2 + §17 state', () => {
  it('has a SignedOutPrompt branch for the pending+signed-out path', () => {
    expect(code).toMatch(/function SignedOutPrompt/);
    expect(code).toContain('signedOutInvite');
  });

  it('has an ExpiredPanel branch', () => {
    expect(code).toMatch(/function ExpiredPanel/);
    expect(code).toContain('expiredBody');
  });

  it('has a RevokedPanel branch', () => {
    expect(code).toMatch(/function RevokedPanel/);
    expect(code).toContain('revokedBody');
  });

  it('has an AlreadyUsedPanel branch', () => {
    expect(code).toMatch(/function AlreadyUsedPanel/);
    expect(code).toContain('alreadyUsedBody');
  });

  it('has a NotFoundPanel branch', () => {
    expect(code).toMatch(/function NotFoundPanel/);
    expect(code).toContain('notFoundBody');
  });

  it('has a MismatchPanel branch with "Sign in as someone else"', () => {
    expect(code).toMatch(/function MismatchPanel/);
    expect(code).toContain('emailMismatchBody');
    expect(code).toContain('emailMismatchSignInElse');
  });

  it('has a NetworkPanel branch with a Retry affordance', () => {
    expect(code).toMatch(/function NetworkPanel/);
    expect(code).toContain('retryButton');
  });

  it('has the §17 ArchivedPanel branch (QOL-038 designer enrichment)', () => {
    expect(code).toMatch(/function ArchivedPanel/);
    expect(code).toContain('roomArchivedBody');
    expect(code).toContain('roomArchivedTitle');
    expect(code).toContain('invite-redeem-room-archived');
  });

  it('has a ClosedPanel branch (for room_closed)', () => {
    expect(code).toMatch(/function ClosedPanel/);
    expect(code).toContain('roomClosedBody');
  });
});

// ── §17 archived branches in both lookup AND accept paths ─────

describe('InviteRedeemGate — §17 archived branch fires in both lookup and accept paths', () => {
  it('the lookup-ok switch routes room_archived to ArchivedPanel', () => {
    expect(code).toMatch(/case 'room_archived':[\s\S]{0,200}ArchivedPanel/);
  });

  it('the accept-error branch routes room_archived to ArchivedPanel', () => {
    // The accept-error switch checks for the room_archived code.
    expect(code).toMatch(/errorCode === 'room_archived'[\s\S]{0,200}ArchivedPanel/);
  });
});

// ── Universal escape hatch ────────────────────────────────────

describe('InviteRedeemGate — universal "Go to my arguments" escape hatch', () => {
  it('PanelLayout renders the go-home button on every branch', () => {
    expect(code).toMatch(/function PanelLayout/);
    expect(code).toContain('goHomeButton');
    expect(code).toContain('onExit');
    expect(code).toContain('invite-redeem-exit-button');
  });
});

// ── Auto-accept effect ────────────────────────────────────────

describe('InviteRedeemGate — auto-accept on (signed-in + live pending)', () => {
  it('declares the useEffect that fires acceptRoomInvite without user input', () => {
    // The effect body must reference both signedIn AND the lookup
    // status === 'pending' to gate the call.
    expect(code).toMatch(/useEffect\([\s\S]{0,400}signedIn[\s\S]{0,400}runAccept/);
  });
});

// ── Copy bundle integration sanity ────────────────────────────

describe('INVITE_REDEEM_COPY consumed by the gate', () => {
  it('the §17 archived title is present in the bundle', () => {
    expect(INVITE_REDEEM_COPY.roomArchivedTitle).toBe('Argument archived');
  });

  it('the go-home button label is the universal escape hatch text', () => {
    expect(INVITE_REDEEM_COPY.goHomeButton).toBe('Go to my arguments');
  });
});
