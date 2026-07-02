/**
 * PRIVATE-GROUPS-002 (#859) — pure-TS derivations for circles.
 *
 * Pure TypeScript. No React, no Supabase, no network, no async, no clock, no
 * randomness — so any circle surface can preview member-count bands, the
 * "minimal circle (pair)" state, and a display roll-up without a round-trip
 * while the SQL layer + Edge Functions stay authoritative for reads/writes.
 * Testable like inviteModel.ts / roomCapacityModel.ts.
 *
 * Scope: this card ships ONLY the pure model + the minimal type exports the
 * tests need. circlesApi / circleInviteApi / useCircles (the client wrappers)
 * and all UI are OUT OF SCOPE (owned by PRIVATE-GROUPS #839/#840 + #843).
 *
 * Doctrine: a circle is an ACCESS + MEMORY boundary — a member count is a
 * STRUCTURAL fact (how many people are in the group), never a verdict on a
 * person, and never an input from heat / popularity. Nothing here labels a
 * person or claim.
 */

/** Circle membership role — mirrors the DB check (role in ('owner','member')). */
export type CircleRole = 'owner' | 'member';

/** A live circle member, projected down to what the pure model reasons about. */
export interface CircleMemberSummary {
  userId: string;
  role: CircleRole;
}

/**
 * Member-count band. STRUCTURAL, never a ranking:
 *   - 'empty'   — 0 live members (a soft-deleted / drained circle; not a
 *                 normal live state, but the model must not throw on it).
 *   - 'pair'    — exactly 2 live members (the minimal circle / 1:1).
 *   - 'small'   — 3 to 6 live members.
 *   - 'large'   — 7 or more live members.
 * A single-member circle (the owner alone, pre-first-accept) is 'solo'.
 */
export type CircleMemberBand = 'empty' | 'solo' | 'pair' | 'small' | 'large';

/** The display roll-up a circle surface can render without a round-trip. */
export interface CircleDisplaySummary {
  memberCount: number;
  band: CircleMemberBand;
  /** True iff exactly 2 live members — the minimal circle (1:1 pair). */
  isMinimalCircle: boolean;
  ownerCount: number;
}

const SMALL_BAND_MAX = 6;

/**
 * Count of LIVE members from a member-summary list. Defensive: a non-array
 * input yields 0 (never throws). This is the single count all the other
 * derivations read.
 */
export function liveMemberCount(members: CircleMemberSummary[] | null | undefined): number {
  if (!Array.isArray(members)) return 0;
  return members.length;
}

/**
 * The member-count band for a raw live-member count. Defensive: a
 * non-finite / negative count is treated as 0 ('empty'). No band implies
 * quality or ranking — it is a size bucket only.
 */
export function memberCountBand(memberCount: number): CircleMemberBand {
  if (!Number.isFinite(memberCount) || memberCount <= 0) return 'empty';
  if (memberCount === 1) return 'solo';
  if (memberCount === 2) return 'pair';
  if (memberCount <= SMALL_BAND_MAX) return 'small';
  return 'large';
}

/**
 * The load-bearing product predicate: is this the MINIMAL circle (the 1:1
 * pair)? True iff exactly 2 live members. 1:1 features are a WHERE clause
 * over this, not a separate schema (the circle-of-N design decision).
 */
export function isMinimalCircle(memberCount: number): boolean {
  return memberCount === 2;
}

/** Count of live members whose role is 'owner'. Defensive on a null list. */
export function ownerCount(members: CircleMemberSummary[] | null | undefined): number {
  if (!Array.isArray(members)) return 0;
  return members.filter((m) => m && m.role === 'owner').length;
}

/**
 * The display roll-up for a circle, derived from its live-member summaries.
 * Pure + total: any input (including null / empty) yields a well-formed
 * summary. The 'empty' band + isMinimalCircle=false is the safe default.
 */
export function deriveCircleDisplaySummary(
  members: CircleMemberSummary[] | null | undefined,
): CircleDisplaySummary {
  const memberCount = liveMemberCount(members);
  return {
    memberCount,
    band: memberCountBand(memberCount),
    isMinimalCircle: isMinimalCircle(memberCount),
    ownerCount: ownerCount(members),
  };
}
