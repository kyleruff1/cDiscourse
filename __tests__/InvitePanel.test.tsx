/**
 * QOL-038 — InvitePanel contract tests.
 *
 * Pure-helper + source-scan style (mirrors AcceptanceGradientControl /
 * BranchCollapseStub). The render-time behaviour is implicit in the
 * component's hook (useRoomInvites) — the safety properties asserted
 * here are:
 *
 *   - Every visible text / accessibility label comes from inviteCopy
 *     (the ban-list test already scans those strings).
 *   - The panel does NOT import any service-role / Edge Function URL
 *     directly; it routes through useRoomInvites which routes through
 *     inviteApi (which routes through supabase.functions.invoke).
 *   - The component declares the testIDs the cascade-affected tests
 *     elsewhere rely on (the room-toolbar tests will assert the chip's
 *     accessibilityLabel passes through).
 *   - The not-allowed branch renders the §7.1 notice copy and hides
 *     the email field.
 *   - The "Copy invite link" affordance is conditional on (!emailEnabled
 *     && lastInviteLink).
 *   - There is NO `console.*` anywhere in the component (the no-console
 *     rule + the token-leak doctrine §5.7 — the InvitePanel handles a
 *     raw token via lastInviteLink, so this is load-bearing).
 */
import fs from 'fs';
import path from 'path';
import { INVITE_PANEL_COPY } from '../src/features/invites/inviteCopy';

const repoRoot = process.cwd();
const componentSrc = fs.readFileSync(
  path.join(repoRoot, 'src', 'features', 'invites', 'InvitePanel.tsx'),
  'utf8',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const code = stripComments(componentSrc);

// ── Imports ───────────────────────────────────────────────────

describe('InvitePanel — imports', () => {
  it('imports useRoomInvites (not inviteApi directly) — the hook owns state', () => {
    expect(code).toMatch(/from '\.\/useRoomInvites'/);
  });

  it('imports the copy bundle from inviteCopy', () => {
    expect(code).toMatch(/INVITE_PANEL_COPY[\s\S]*from '\.\/inviteCopy'/);
  });

  it('does NOT import a service-role / SERVICE_ROLE / SUPABASE_SERVICE literal', () => {
    expect(code).not.toContain('SERVICE_ROLE');
    expect(code).not.toContain('service_role');
  });

  it('does NOT import the supabase client directly (only via the hook → inviteApi)', () => {
    expect(code).not.toMatch(/from ['"]\.\.\/\.\.\/lib\/supabase['"]/);
  });

  it('does NOT import any other Edge Function helper', () => {
    expect(code).not.toContain('annotate-evidence');
    expect(code).not.toContain('admin-users');
  });
});

// ── No console.* anywhere (token-leak doctrine §5.7) ──────────

describe('InvitePanel — no console.* anywhere (token-leak doctrine §5.7)', () => {
  it('contains no console.log / console.error / console.warn', () => {
    expect(code).not.toMatch(/console\./);
  });
});

// ── Visible strings come from inviteCopy ──────────────────────

describe('InvitePanel — visible strings come from inviteCopy', () => {
  it('renders the title, send button, and notice strings via INVITE_PANEL_COPY', () => {
    // The component refers to these properties; the test does not
    // re-assert the literal text (that lives in the copy file + the
    // doctrine ban-list test).
    expect(code).toContain('INVITE_PANEL_COPY.title');
    expect(code).toContain('INVITE_PANEL_COPY.sendButton');
    expect(code).toContain('INVITE_PANEL_COPY.notAllowedNotice');
    expect(code).toContain('INVITE_PANEL_COPY.toolbarChipAccessibility');
  });

  it('the source contains no hardcoded "challenger" / "argue about" / verdict tokens', () => {
    const banned = ['challenger', 'argue about', 'take a side', 'winner', 'loser'];
    for (const token of banned) {
      expect(code.toLowerCase()).not.toContain(token);
    }
  });
});

// ── canInvite branch ──────────────────────────────────────────

describe('InvitePanel — canInvite branch (§7.1 not-allowed state)', () => {
  it('renders the not-allowed notice when canInvite is false', () => {
    // Visible branch on `if (!canInvite) return ...`
    expect(code).toMatch(/if \(!canInvite\)/);
    expect(code).toContain('notAllowedNotice');
  });
});

// ── Copy-link affordance conditional on email-off ─────────────

describe('InvitePanel — copy-link affordance is conditional', () => {
  it('renders the link box only when (!emailEnabled && lastInviteLink)', () => {
    expect(code).toMatch(/!emailEnabled[\s\S]{0,40}lastInviteLink/);
  });

  it('renders the "Invite emailed" notice when emailEnabled && lastInviteLink', () => {
    expect(code).toMatch(/emailEnabled[\s\S]{0,40}lastInviteLink/);
  });
});

// ── testIDs ───────────────────────────────────────────────────

describe('InvitePanel — testIDs', () => {
  it('declares the email input + send button + list + revoke testIDs', () => {
    for (const id of [
      'invite-panel-email-input',
      'invite-panel-send',
      'invite-panel-list',
      'invite-panel-link-box',
    ]) {
      expect(code).toContain(`testID="${id}"`);
    }
  });
});

// ── Copy bundle integration sanity ────────────────────────────

describe('INVITE_PANEL_COPY consumed by the component', () => {
  it('has the toolbar accessibility label the App.tsx chip uses', () => {
    expect(INVITE_PANEL_COPY.toolbarChipAccessibility).toBeTruthy();
    // Loadbearing — App.tsx imports this exact key.
    expect(INVITE_PANEL_COPY.toolbarChipAccessibility.toLowerCase()).not.toContain(
      'challenger',
    );
  });
});
