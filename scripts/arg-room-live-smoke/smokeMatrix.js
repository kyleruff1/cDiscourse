/**
 * ARG-ROOM-007 — live-smoke matrix (pure data + helpers).
 *
 * WHAT THIS IS
 *   The frozen 12-check end-to-end verification matrix (plus 3 regression
 *   re-checks already proven by the ARG-ROOM-002 live smoke) for the public /
 *   private argument-room invite feature. This module is PURE: no network, no
 *   clock, no I/O. It is the single source of truth for what each live check
 *   asserts; `runArgRoomLiveSmoke.js` consumes it behind the operator-armed gate.
 *
 * DOCTRINE
 *   Every check asserts exactly ONE of the four seat states (active / observer /
 *   reserved-invite / open) and describes capacity as STRUCTURE, never a verdict
 *   (doctrine §1). No check reads heat / popularity (§2-3). The wire codes below
 *   (`room_capacity_reached`, `private_requires_invite`, etc.) are the deployed
 *   contract surfaced in an OPERATOR report — they are not user-facing copy.
 *
 * SHIPPED ENFORCEMENT THIS MATRIX ONLY OBSERVES (does NOT rebuild)
 *   - `enforce_room_capacity` BEFORE INSERT trigger (migration 20260613000001):
 *     `room_capacity_reached` / SQLSTATE 23514 when active+reserved+1 > cap.
 *   - `create-argument-room` Edge: 400 `private_requires_invite`,
 *     400 `cannot_invite_self`, 409 `room_capacity_reached`, 422 `validation_failed`.
 *   - `manage-room-invite` Edge: 403 `invite_email_mismatch`, idempotent accept.
 *   - Dropped client `debates` INSERT policy: direct insert → 42501.
 */

'use strict';

/**
 * The 12 core live-smoke checks. `id` is stable; the runner keys results by it.
 * `accountsNeeded` = distinct JWT logins the harness performs (1 | 2 | 6).
 * `needsSixAccounts` is true ONLY for the two public-cap-5 fill checks.
 * `gateDependent` is true ONLY for the three email-bearing checks (#9/#10/#11),
 * which require ARG-ROOM-004 deployed to be meaningful.
 * `verify` is the browser-free verification mode.
 */
const CORE_CHECKS = [
  {
    id: 'public-no-invite-create',
    title: 'Public, no invite — create',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 200 },
    verify: 'rls_read',
  },
  {
    id: 'public-one-invite-create',
    title: 'Public, one invite — create (reserves one of five seats)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 200 },
    verify: 'rls_read',
  },
  {
    id: 'private-one-invite-create',
    title: 'Private, one invite — create (cap 2 reached)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 200 },
    verify: 'rls_read',
  },
  {
    id: 'private-no-invite-reject',
    title: 'Private, no invite — forced reject',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 400, code: 'private_requires_invite' },
    verify: 'edge_response',
  },
  {
    id: 'public-cap-5-refuse-6th',
    title: 'Public cap at 5 — sixth active seat refused',
    accountsNeeded: 6,
    needsSixAccounts: true,
    gateDependent: false,
    regression: false,
    expected: { sqlState: '23514', code: 'room_capacity_reached' },
    verify: 'rls_read',
    coveredByIfInsufficientAccounts: ['002-B6', 'roomCapacityModel-parity'],
  },
  {
    id: 'reserved-invite-seat-acceptance',
    title: 'Reserved-invite seat acceptance (reserved → active, no double count)',
    accountsNeeded: 2,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 200, code: 'accepted' },
    verify: 'rls_read',
  },
  {
    id: 'observer-into-full-public',
    title: 'Observer into a full public room (observers are uncapped)',
    accountsNeeded: 6,
    needsSixAccounts: true,
    gateDependent: false,
    regression: false,
    expected: { status: 200 },
    verify: 'rls_read',
    coveredByIfInsufficientAccounts: ['observer-short-circuit-unit', 'roomCapacityModel-parity'],
  },
  {
    id: 'wrong-user-invite-recovery',
    title: 'Wrong-user invite recovery (email-binding refusal)',
    accountsNeeded: 2,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 403, code: 'invite_email_mismatch' },
    verify: 'edge_response',
  },
  {
    id: 'new-user-invite-callback',
    title: 'New-user invite callback (email → /auth/callback → set password → auto-accept)',
    accountsNeeded: 2,
    needsSixAccounts: false,
    gateDependent: true,
    regression: false,
    expected: { status: 200, code: 'accepted' },
    verify: 'operator_confirmed',
  },
  {
    id: 'existing-user-invite-flow',
    title: 'Existing-user invite flow (invite → sign in → accept)',
    accountsNeeded: 2,
    needsSixAccounts: false,
    gateDependent: true,
    regression: false,
    expected: { status: 200, code: 'accepted' },
    verify: 'rls_read',
  },
  {
    id: 'no-enumeration',
    title: 'No enumeration (uniform existing-vs-new create response)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: true,
    regression: false,
    expected: { status: 200 },
    verify: 'response_diff',
  },
  {
    id: 'no-token-leakage',
    title: 'No token leakage (no raw token / link in any response or log)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: false,
    expected: { status: 200 },
    verify: 'response_scan',
  },
];

/**
 * Regression re-checks — cheap, already proven LIVE by the ARG-ROOM-002 smoke
 * (docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md). Included so
 * the matrix is complete; flagged `regression: true` (not net-new).
 */
const REGRESSION_CHECKS = [
  {
    id: 'max-one-direct-invite',
    title: 'R1 — two or more invites refused (single-invite strict schema)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: true,
    expected: { status: 422, code: 'validation_failed' },
    verify: 'edge_response',
  },
  {
    id: 'self-invite-refused',
    title: 'R2 — invite addressed to the caller refused',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: true,
    expected: { status: 400, code: 'cannot_invite_self' },
    verify: 'edge_response',
  },
  {
    id: 'direct-debates-insert-refused',
    title: 'R3 — direct client debates INSERT refused (door closed)',
    accountsNeeded: 1,
    needsSixAccounts: false,
    gateDependent: false,
    regression: true,
    expected: { sqlState: '42501' },
    verify: 'rls_read',
  },
];

/** All 12 core + 3 regression checks, frozen (engine.ts discipline). */
const SMOKE_CHECKS = Object.freeze(
  [...CORE_CHECKS, ...REGRESSION_CHECKS].map((c) => Object.freeze({ ...c, expected: Object.freeze({ ...c.expected }) })),
);

/** Allowed `verify` modes (closed set). */
const VERIFY_MODES = Object.freeze([
  'edge_response',
  'rls_read',
  'response_diff',
  'response_scan',
  'operator_confirmed',
]);

/** Find a check (core or regression) by id. Pure. Returns null if unknown. */
function findCheck(id) {
  return SMOKE_CHECKS.find((c) => c.id === id) || null;
}

/** Pure lookup of a check's expected result. Returns null for an unknown id. */
function expectedForCheck(id) {
  const c = findCheck(id);
  return c ? c.expected : null;
}

/** The ids of checks that require >= 6 distinct accounts (the public-cap-5 pair). */
function checksRequiringSixAccounts() {
  return SMOKE_CHECKS.filter((c) => c.needsSixAccounts).map((c) => c.id);
}

/** The ids of the email-bearing checks that depend on ARG-ROOM-004 deployment. */
function gateDependentChecks() {
  return SMOKE_CHECKS.filter((c) => c.gateDependent).map((c) => c.id);
}

/** The 12 core (non-regression) check ids, in order. */
function coreCheckIds() {
  return SMOKE_CHECKS.filter((c) => !c.regression).map((c) => c.id);
}

/** The 3 regression check ids, in order. */
function regressionCheckIds() {
  return SMOKE_CHECKS.filter((c) => c.regression).map((c) => c.id);
}

module.exports = {
  SMOKE_CHECKS,
  VERIFY_MODES,
  findCheck,
  expectedForCheck,
  checksRequiringSixAccounts,
  gateDependentChecks,
  coreCheckIds,
  regressionCheckIds,
};
