/**
 * ARG-ROOM-007 — live-smoke report renderer + secret-leak scanner (pure).
 *
 * The harness prints a redacted result block; the operator pastes it into
 * docs/testing-runs/2026-06-13-arg-room-live-smoke.md. The renderer carries NO
 * raw token / link, NO secret value, NO verdict / person token, and masked
 * emails only. PURE: no network, no clock, no I/O.
 *
 * BAN-LIST: MIRROR + PARITY (review finding #1)
 *   `_forbiddenReportTokens()` MIRRORS the shipped pure-model ban-list
 *   `_forbiddenArgumentRoomCreationTokens()` (src/features/debates/
 *   argumentRoomCreationMatrix.ts). A CommonJS harness cannot `require()` a TS
 *   source, so the list is mirrored here and PINNED equal by a parity test in
 *   __tests__/argRoomLiveSmoke.test.ts — the same idiom publicSeatModel /
 *   chimeInGovernance use for their own `_forbidden*Tokens`.
 */

'use strict';

/**
 * Mirror of `_forbiddenArgumentRoomCreationTokens()`. Pinned equal by the parity
 * test. Every string the report can emit describes the ROOM's structure
 * (seats / capacity / visibility), never a verdict, never a person.
 */
function _forbiddenReportTokens() {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    // Person-attribution tokens
    'troll',
    'bot',
    // QOL-038 banned invite framing
    'challenger',
    'opponent',
  ];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_RE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const BEARER_RE = /bearer\s+[A-Za-z0-9._-]+/i;
const SHA256_RE = /\b[a-f0-9]{64}\b/i;
const TOKEN_SHAPE_RE = /[A-Za-z0-9_-]{32,64}/g;

/**
 * Scan every captured value for a leaked secret. Returns an array of offending
 * `${path}: ${kind}` descriptors; an empty array means clean.
 *
 * Flags: a `Bearer <token>` header, a JWT-shape (three base64url segments), a
 * 64-hex sha-256 (e.g. a leaked `token_hash`), and any 32-64 char base64url
 * token-shape value. UUIDs (debateId / inviteId) are NOT flagged. The caller's
 * OWN supplied token(s) and the creator-only create-time `inviteLink` token are
 * whitelisted via `options.allowedTokens` (a `tokenEcho` of the caller's own
 * token is NOT a leak; a DIFFERENT invite's token IS).
 */
function scanForSecretLeak(captured, options) {
  const allowed = new Set((options && Array.isArray(options.allowedTokens) ? options.allowedTokens : []));
  const leaks = [];

  const visit = (value, path) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      scanString(value, path, allowed, leaks);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (typeof value === 'object') {
      for (const key of Object.keys(value)) {
        visit(value[key], path ? `${path}.${key}` : key);
      }
    }
  };

  visit(captured, '');
  // De-dupe (a JWT segment can also match the token-shape sweep).
  return Array.from(new Set(leaks));
}

function scanString(s, path, allowed, leaks) {
  if (BEARER_RE.test(s)) leaks.push(`${path}: bearer_token`);
  if (SHA256_RE.test(s)) leaks.push(`${path}: sha256_hash`);

  const jwtMatches = s.match(JWT_RE) || [];
  for (const m of jwtMatches) {
    if (!allowed.has(m)) leaks.push(`${path}: jwt_shape`);
  }

  const shapeMatches = s.match(TOKEN_SHAPE_RE) || [];
  for (const m of shapeMatches) {
    if (UUID_RE.test(m)) continue; // debateId / inviteId — legitimate
    if (allowed.has(m)) continue; // caller's own token / creator-only inviteLink
    // Skip a fragment that is part of a JWT we already flagged on this string.
    if (jwtMatches.some((j) => j.includes(m))) continue;
    leaks.push(`${path}: raw_token_shape`);
  }
}

/** Render a boolean as a verdict-free ON/OFF state (never the banned `true`/`false`). */
function onOff(flag) {
  return flag ? 'ON' : 'OFF';
}

function cell(v) {
  if (v === null || v === undefined || v === '') return 'TBD';
  return String(v);
}

/**
 * Render the committable markdown report block. Tolerant of missing fields
 * (defaults to placeholders) so it doubles as the operator-filled template.
 * Booleans render as ON/OFF / yes/no — never the banned literal `true`/`false`.
 */
function renderReport(results) {
  const r = results || {};
  const o = r.outcome || {};
  const gates = r.gatesArmed || {};
  const lines = [];

  lines.push('# ARG-ROOM-007 — live-smoke matrix (2026-06-13)');
  lines.push('');
  lines.push('## Header');
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push('| Cards under test | ARG-ROOM-002 (deployed) · 003 (merged) · 004 (deployed) |');
  lines.push(`| HEAD SHA | ${cell(r.headSha)} (main == origin/main) |`);
  lines.push(`| Harness | ${cell(r.harnessCmd || 'npm run smoke:arg-room:live')} |`);
  lines.push(`| Gate: invite email | ${onOff(gates.inviteEmail)} |`);
  lines.push(`| Gate: new-user Auth send | ${onOff(gates.newUserSend)} |`);
  lines.push(`| Accounts | ${cell(r.accountsLabel)} — ${cell(r.accountCount)} distinct |`);
  lines.push(
    `| Outcome | SMOKE ${cell(o.passed)}/${cell(o.total || 12)} PASSED (+${cell(o.regressionPassed)} regression) |`,
  );
  lines.push('');

  lines.push('## Preconditions (all confirmed before arming)');
  lines.push('| Gate | Result | Evidence |');
  lines.push('|---|---|---|');
  const preconds = Array.isArray(r.preconditions) ? r.preconditions : [];
  if (preconds.length === 0) {
    lines.push('| 004 deployed (manage-room-invite / room-notifications / create-argument-room) | TBD | merge=deploy |');
    lines.push('| Which Edge emits the create-time invite email (probe) | TBD | create-argument-room \\| manage-room-invite handleCreate |');
    lines.push('| Resolved distinct accounts | TBD | env (admin + accounts A/B/C [+ D/E]) |');
  } else {
    for (const p of preconds) {
      lines.push(`| ${cell(p.gate)} | ${cell(p.result)} | ${cell(p.evidence)} |`);
    }
  }
  lines.push('');

  lines.push('## Results');
  lines.push('| # | Check | Accts | Expected | Actual | Result |');
  lines.push('|---|---|---|---|---|---|');
  const rows = Array.isArray(r.results) ? r.results : [];
  if (rows.length === 0) {
    lines.push('| 1 | public/no-invite create | 1 | 200 | TBD | TBD |');
    lines.push('| … | … | … | … | … | … |');
    lines.push('| R1-R3 | regression (max-one / self / door) | 1 | per 002 | TBD | TBD |');
  } else {
    for (const row of rows) {
      lines.push(
        `| ${cell(row.num)} | ${cell(row.title)} | ${cell(row.accts)} | ${cell(row.expected)} | ${cell(row.actual)} | ${cell(row.result)} |`,
      );
    }
  }
  lines.push('');

  lines.push('## Account-limited checks (#5 / #7)');
  lines.push(cell(r.accountLimited) === 'TBD'
    ? 'Live-proven with >= 6 accounts, OR covered_by: 002-B6 + roomCapacityModel parity (the same enforce_room_capacity trigger, exercised at the private cap of 2 in the 002 smoke). The harness emits accounts_insufficient → covered_by, never an unearned PASS.'
    : cell(r.accountLimited));
  lines.push('');

  lines.push('## No-enumeration (#11) — response diff');
  lines.push(cell(r.noEnum) === 'TBD'
    ? 'Keys + status + notification value identical across existing-email and fresh-email create calls; only opaque inviteId / inviteLink differ.'
    : cell(r.noEnum));
  lines.push('');

  lines.push('## No-token-leakage (#12)');
  lines.push(cell(r.noLeak) === 'TBD'
    ? 'Response scan clean (no raw token / JWT-shape / Bearer / hash); the raw token surfaces ONLY in the creator-only create-time inviteLink. Log half operator-confirmed via Deno logs (short-id + email-domain only).'
    : cell(r.noLeak));
  lines.push('');

  lines.push('## Cleanup / disarm');
  lines.push(cell(r.cleanup) === 'TBD'
    ? 'Rooms archived (status flip, never hard delete); pending invites revoked; INVITE_EMAIL_ENABLED returned to OFF; CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE unset; fresh devtest alias note.'
    : cell(r.cleanup));
  lines.push('');

  lines.push('## Follow-ups');
  lines.push(cell(r.followUps) === 'TBD'
    ? '#623 fixture-account migration if seat-filling reuse is wanted; any residuals.'
    : cell(r.followUps));
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  _forbiddenReportTokens,
  scanForSecretLeak,
  renderReport,
};
