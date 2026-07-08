/**
 * START-001 (#827) — Person-first argument picker model (pure TypeScript).
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI import; no
 * mutation of inputs, no clock, no randomness. JSON-serializable in and out.
 * The only imports are the pure invite helpers `normaliseInviteeEmail` /
 * `maskInviteeEmail` (from `../../invites/inviteModel`), which are themselves
 * pure-TS. This mirrors the discipline of `roomVisibilityModel.ts` /
 * `argumentRoomCreationMatrix.ts` and is pinned by a source-scan test.
 *
 * WHAT THIS MODEL OWNS
 *   - `PersonTarget` — the value the picker emits (a recent opponent, a freshly
 *     typed e-mail, or the open-floor sentinel). Both `profile` and `email`
 *     resolve to a single invitable e-mail string; the `kind` is provenance
 *     only (UI / telemetry), never a different create path.
 *   - `deriveRecentOpponents` — dedupe + sort + cap over the viewer OWN sent
 *     invite rows, ordered strictly by invite RECENCY (a structural fact),
 *     never by heat, engagement, popularity, view or follower counts
 *     (cdiscourse-doctrine section 2 / section 3).
 *   - `personTargetToCreationIntent` — maps a target plus the sheet-held
 *     visibility into the exact `deriveArgumentRoomCreation` input.
 *   - `orderPickerRows` — the fixed source order (recents, circles, e-mail
 *     entry) with the open-floor row ALWAYS last.
 *
 * RECENTS SOURCE (scope-reality audit, START-001 design decision 1)
 *   Recent opponents derive from the viewer OWN `argument_room_invites` rows,
 *   read directly via PostgREST under the existing RLS policy
 *   `ari_select_inviter_own` (verified at
 *   `supabase/migrations/20260524000013_qol_038_argument_room_invites.sql:112`,
 *   `using (argument_room_invites.invited_by = auth.uid())`). That policy makes
 *   the read structurally incapable of enumerating any other user; e-mail entry
 *   is the only path to a stranger. There is NO `profiles` search, NO directory
 *   endpoint, NO global user search (cdiscourse-doctrine section 10 v1 scope).
 *   The full e-mail is carried only inside `PersonTarget` / the create payload;
 *   every list surface shows the MASKED form (`maskInviteeEmail`).
 *
 * TWO-TAP VISIBILITY INVARIANT (reconciled with START-003 A3 / A4)
 *   `personTargetToCreationIntent` NEVER forces `visibility: 'public'`. It
 *   passes the caller-supplied visibility straight through. Create-time
 *   visibility is owned by the sheet and can only become `'public'` via the
 *   PublicArgumentToggle confirm transition (START-003). Selecting the
 *   open-floor row supplies NO invite and leaves the sheet at its private
 *   default, so a public create is structurally unreachable in fewer than two
 *   deliberate taps. Comments in this file are apostrophe-free by convention
 *   (the doctrine-scanner quote-parity gotcha).
 */

import { normaliseInviteeEmail, maskInviteeEmail } from '../../invites/inviteModel';
import type { RoomVisibility } from '../../debates/types';

// ── The picker value ────────────────────────────────────────────

/**
 * The value the picker emits. Both `profile` and `email` resolve to a create
 * invite of shape `{ email }` — the kind is UI / telemetry provenance only, not
 * a different creation path.
 */
export type PersonTarget =
  | { kind: 'profile'; email: string; id?: string | null } // a recent opponent (history)
  | { kind: 'email'; email: string } // a freshly typed address
  | { kind: 'open_floor' }; // public, no invite

/** One recent opponent, derived from the viewer OWN sent-invite rows. */
export interface RecentOpponent {
  /** Full normalised e-mail — the invitable value fed to the create payload. */
  email: string;
  /** Display-only masked form (j•••@example.com) via `maskInviteeEmail`. */
  maskedEmail: string;
  /** Most-recent invite time (ms) for this e-mail — the sort key only. */
  lastInvitedAtMs: number;
}

/** Raw row shape the api returns (mirrors the RLS-scoped select). */
export interface RecentInviteRow {
  invitee_email_lower: string;
  debate_id: string;
  created_at: string;
  status: string;
}

/** A circle option slot — RESERVED for START-002; always `[]` in START-001. */
export interface CircleOption {
  id: string;
  label: string;
}

// ── Ordered picker rows ─────────────────────────────────────────

/** The four ordered row kinds the picker renders. */
export type PickerRowKind = 'recent' | 'circle' | 'email_entry' | 'open_floor';

/**
 * A single ordered picker row descriptor. The UI reads this list to render the
 * fixed source order; the model owns the ORDER and the open-floor-last
 * invariant so no surface can reorder them.
 */
export interface PickerRow {
  kind: PickerRowKind;
  /** Stable list key. */
  key: string;
  /** Present when `kind === 'recent'`. */
  recent?: RecentOpponent;
  /** Present when `kind === 'circle'`. */
  circle?: CircleOption;
  /** Present when `kind === 'email_entry'` — whether the field currently holds text. */
  hasValue?: boolean;
}

// ── deriveRecentOpponents ───────────────────────────────────────

/** Default number of recent-opponent chips shown. */
export const DEFAULT_RECENT_OPPONENTS_LIMIT = 8;

/**
 * Dedupe the viewer sent-invite rows by `invitee_email_lower` (keeping the
 * newest `created_at`), sort newest-first, and cap at `limit`. Pure — the input
 * array is never mutated. Ordering is strictly by invite RECENCY, a structural
 * fact; there is NO heat / popularity / engagement input (doctrine section 2 /
 * section 3). A row whose e-mail does not normalise is skipped (malformed row
 * never becomes a chip). The full e-mail is carried for the create payload; the
 * masked form is what any list surface shows.
 */
export function deriveRecentOpponents(
  rows: RecentInviteRow[] | null | undefined,
  limit: number = DEFAULT_RECENT_OPPONENTS_LIMIT,
): RecentOpponent[] {
  if (!Array.isArray(rows)) return [];
  const byEmail = new Map<string, RecentOpponent>();
  for (const row of rows) {
    if (!row || typeof row.invitee_email_lower !== 'string') continue;
    const email = normaliseInviteeEmail(row.invitee_email_lower);
    if (email === null) continue;
    const parsed = Date.parse(row.created_at);
    const lastInvitedAtMs = Number.isFinite(parsed) ? parsed : 0;
    const existing = byEmail.get(email);
    if (!existing || lastInvitedAtMs > existing.lastInvitedAtMs) {
      byEmail.set(email, {
        email,
        maskedEmail: maskInviteeEmail(email),
        lastInvitedAtMs,
      });
    }
  }
  const list = Array.from(byEmail.values());
  list.sort((a, b) => b.lastInvitedAtMs - a.lastInvitedAtMs);
  const cap =
    Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : DEFAULT_RECENT_OPPONENTS_LIMIT;
  return list.slice(0, cap);
}

// ── personTargetToInviteEmail ───────────────────────────────────

/**
 * Resolve a target to the single invitable e-mail string the sheet threads into
 * `deriveArgumentRoomCreation`. `open_floor` resolves to the empty string (no
 * invite). Both `profile` and `email` resolve to their carried address; the
 * matrix normaliser remains the single source of the storage form.
 */
export function personTargetToInviteEmail(target: PersonTarget | null | undefined): string {
  if (!target) return '';
  if (target.kind === 'open_floor') return '';
  return typeof target.email === 'string' ? target.email : '';
}

// ── personTargetToCreationIntent ────────────────────────────────

/**
 * Map a `PersonTarget` plus the sheet-held `visibility` into the exact
 * `deriveArgumentRoomCreation` input shape.
 *
 * TWO-TAP INVARIANT: the supplied `visibility` is passed straight through and
 * NEVER overridden. This helper cannot fabricate `'public'` — an open-floor
 * target only zeroes the invite list; the sheet decides visibility, and the
 * sheet can only hold `'public'` after the PublicArgumentToggle confirm
 * transition (START-003 A4). So:
 *   - `profile` / `email` -> `{ visibility, directInviteEmails: [email] }`
 *   - `open_floor`        -> `{ visibility, directInviteEmails: [] }`
 */
export function personTargetToCreationIntent(
  target: PersonTarget | null | undefined,
  visibility: RoomVisibility,
): { visibility: RoomVisibility; directInviteEmails: string[] } {
  const email = personTargetToInviteEmail(target);
  return {
    visibility,
    directInviteEmails: email.trim().length > 0 ? [email] : [],
  };
}

// ── orderPickerRows ─────────────────────────────────────────────

/**
 * Enforce the fixed picker source order — recents, then circles, then the
 * e-mail entry row — with the open-floor row ALWAYS last. Pure; inputs are
 * never mutated. `hasTypedEmail` sets `hasValue` on the e-mail entry row so the
 * UI can render the typed value vs the empty prompt without changing order.
 *
 * Cross-source dedupe: a circle whose (future START-002) member e-mail matches a
 * recent opponent is dropped so a person shows once, recents winning. Today
 * `CircleOption` carries no e-mail so this is a no-op and `circles` is always
 * `[]` in START-001; the ordering slot is reserved so START-002 plugs in with no
 * ordering change.
 */
export function orderPickerRows(
  recents: RecentOpponent[] | null | undefined,
  circles: CircleOption[] | null | undefined,
  hasTypedEmail: boolean = false,
): PickerRow[] {
  const rows: PickerRow[] = [];
  const seenEmails = new Set<string>();

  const recentList = Array.isArray(recents) ? recents : [];
  for (const recent of recentList) {
    if (!recent || typeof recent.email !== 'string') continue;
    if (seenEmails.has(recent.email)) continue;
    seenEmails.add(recent.email);
    rows.push({ kind: 'recent', key: `recent:${recent.email}`, recent });
  }

  const circleList = Array.isArray(circles) ? circles : [];
  for (const circle of circleList) {
    if (!circle || typeof circle.id !== 'string') continue;
    rows.push({ kind: 'circle', key: `circle:${circle.id}`, circle });
  }

  rows.push({ kind: 'email_entry', key: 'email_entry', hasValue: hasTypedEmail === true });

  // Open floor is ALWAYS the last row (the person-first, public-is-last
  // invariant). No code path may place a row after it.
  rows.push({ kind: 'open_floor', key: 'open_floor' });

  return rows;
}

/**
 * Guard predicate the picker UI + tests use to prove the open-floor row is the
 * final row of any `orderPickerRows` output.
 */
export function isOpenFloorLast(rows: PickerRow[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const openFloorIndexes = rows
    .map((r, i) => (r.kind === 'open_floor' ? i : -1))
    .filter((i) => i >= 0);
  return openFloorIndexes.length === 1 && openFloorIndexes[0] === rows.length - 1;
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/personArgumentPickerModel.test.ts`.
 * NOT a content filter. Mirrors the sibling pure-model ban lists
 * (`_forbiddenArgumentRoomCreationTokens`): every string this model can emit
 * names a person only as an INVITEE (an address), never with a verdict, never
 * with an amplification / popularity token, never a person-attribution slur.
 */
export function _forbiddenPersonPickerTokens(): string[] {
  return [
    // Verdict tokens (cdiscourse-doctrine section 1).
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    // Amplification tokens (section 2 / section 3).
    'popular',
    'trending',
    'viral',
    // Person-attribution tokens.
    'troll',
    'bot',
    // Invite-framing bans (QOL-038).
    'challenger',
    'opponent',
  ];
}
