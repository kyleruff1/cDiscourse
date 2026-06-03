/**
 * CORPUS-30-POOL-DRIVEN-PLANNER — pure-JS planner.
 *
 * Public functions (per design):
 *   - uintHash(s)
 *       Deterministic 32-bit unsigned hash of a string. Backed by
 *       sha256.readUInt32BE(0). No Math.random anywhere. Same input
 *       always returns the same number.
 *
 *   - seedAssignment(runId, threadCount, seedPool)            §5
 *       Filters the pool to eligible seeds, Fisher-Yates shuffles by
 *       runId, returns the first threadCount items. Throws
 *       `seed_pool_undersized` (Error with that .reason) when fewer
 *       than threadCount eligible seeds are available — no replacement,
 *       per ratified §14 question 3.
 *
 *   - selectOption(runId, threadIndex, role, moveIndex, bankName,
 *                  bank, usedOptionsForThread)                 §6
 *       Deterministic per-move option pick with linear probe + no
 *       reuse within a thread until bank exhausts. When the bank is
 *       exhausted, resets the per-thread used set and emits a
 *       `bank_exhausted_reset` event via the optional onReset callback.
 *
 *   - assignVoiceId(runId, botUserId)                          §7.1
 *       Stable voiceId per bot per run.
 *
 *   - assignSpineId(runId, threadIndex, moveIndex, prevSpine)  §7.2
 *       Deterministic spineId with the no-repeat-prior constraint
 *       (advance by +1 mod SPINES.length on collision with prevSpine).
 *
 *   - resolveMoveBank(runId, threadIndex, moveIndex)           §4.4
 *       Returns { role, bankName } where bankName is either the fixed
 *       slot bank or a deterministic pick from the rotationSet.
 *
 *   - buildRunTag(runId, kind)                                 §8.2
 *       Replaces the runId.slice(0,8) bug with the §8.2 format
 *       `<kind>-YYYYMMDD-HHMM-<8hexsuffix>`.
 *
 * Pure CommonJS. No React, Supabase, network, or filesystem. Side-effect
 * free apart from the optional usedOptionsForThread Map mutation in
 * selectOption (the caller owns the Map).
 *
 * No truth labels, no person-labels, no verdict tokens anywhere here.
 * Structural metadata only.
 */

const { createHash } = require('node:crypto');
const {
  VOICES,
  SPINES,
  PROVOCATEUR_BANKS,
  REVOCATEUR_BANKS,
  ALL_BANK_NAMES,
  BANK_FLOORS,
  MOVE_PLAN,
} = require('./corpusPoolDrivenPlannerConstants');

// ── Deterministic hash ────────────────────────────────────────────

function uintHash(s) {
  // sha256 then take the first 4 bytes big-endian → uint32. Stable
  // across Node versions, no Math.random, no Date, no entropy.
  const digest = createHash('sha256').update(String(s)).digest();
  return digest.readUInt32BE(0);
}

// ── Seed assignment (Fisher-Yates seeded by runId) ───────────────

class SeedPoolUndersizedError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SeedPoolUndersizedError';
    this.reason = 'seed_pool_undersized';
    this.details = details || null;
  }
}

/**
 * Determine whether a seed's banks all meet their floor.
 *
 * The post-processor stamps `bankShortfall: true` when one or more
 * banks fail; we accept either an explicit shortfall flag or a fresh
 * recount of bank lengths.
 */
function seedMeetsAllFloors(seed) {
  if (!seed || typeof seed !== 'object') return false;
  if (seed.bankShortfall === true) return false;
  const banks = seed.banks || {};
  for (const bankName of ALL_BANK_NAMES) {
    const arr = banks[bankName];
    if (!Array.isArray(arr)) return false;
    if (arr.length < (BANK_FLOORS[bankName] || 0)) return false;
  }
  return true;
}

/**
 * Fisher-Yates seed assignment per design §5.
 *
 * Filters the pool to seeds meeting every floor, throws
 * SeedPoolUndersizedError when fewer than threadCount eligible seeds,
 * then deterministically shuffles by runId and returns the first
 * threadCount items.
 */
function seedAssignment(runId, threadCount, seedPool) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('seedAssignment requires a non-empty runId');
  }
  if (!Number.isFinite(threadCount) || threadCount <= 0) {
    throw new Error('seedAssignment requires a positive integer threadCount');
  }
  if (!Array.isArray(seedPool)) {
    throw new Error('seedAssignment requires an array seedPool');
  }

  const eligible = seedPool.filter(seedMeetsAllFloors);
  const n = eligible.length;

  if (n < threadCount) {
    const perBankCounts = {};
    for (const name of ALL_BANK_NAMES) {
      perBankCounts[name] = seedPool.filter((s) => {
        const arr = (s && s.banks && s.banks[name]) || [];
        return Array.isArray(arr) && arr.length >= (BANK_FLOORS[name] || 0);
      }).length;
    }
    throw new SeedPoolUndersizedError(
      `seed_pool_undersized: have ${n} eligible, need ${threadCount}`,
      { have: n, need: threadCount, totalPoolSize: seedPool.length, perBankFloorPass: perBankCounts },
    );
  }

  // Fisher-Yates shuffle keyed on runId. Operates on a copy.
  const shuffled = eligible.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = uintHash(`${runId}:seed:${i}`) % (i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, threadCount);
}

// ── Move bank resolution (§4.4) ──────────────────────────────────

function resolveMoveBank(runId, threadIndex, moveIndex) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('resolveMoveBank requires a non-empty runId');
  }
  if (!Number.isFinite(threadIndex) || threadIndex < 0) {
    throw new Error('resolveMoveBank requires threadIndex ≥ 0');
  }
  const plan = MOVE_PLAN[moveIndex];
  if (!plan) {
    throw new Error(`resolveMoveBank: no plan for moveIndex=${moveIndex} (expected 1..10)`);
  }
  if (plan.bankName) {
    return { role: plan.role, bankName: plan.bankName };
  }
  // Rotation set: deterministic pick keyed on (runId, role, threadIndex, moveIndex).
  const rotKey = `${runId}:rot:${plan.role === 'provocateur' ? 'p' : 'r'}:${threadIndex}:${moveIndex}`;
  const idx = uintHash(rotKey) % plan.rotationSet.length;
  const pickedBank = plan.rotationSet[idx];
  // Enforce role-bank gating per §4.3 — this is belt-and-suspenders;
  // the rotation set is already a subset of the role's bank vocabulary.
  const allowed = plan.role === 'provocateur' ? PROVOCATEUR_BANKS : REVOCATEUR_BANKS;
  if (!allowed.includes(pickedBank)) {
    throw new Error(
      `resolveMoveBank: rotation produced disallowed bank '${pickedBank}' for role '${plan.role}'`,
    );
  }
  return { role: plan.role, bankName: pickedBank };
}

// ── Option selection (§6) ───────────────────────────────────────

/**
 * Deterministic per-move option selection with linear-probe + no-reuse.
 *
 * @param {Object} args
 * @param {string} args.runId
 * @param {number} args.threadIndex
 * @param {'provocateur'|'revocateur'} args.role
 * @param {number} args.moveIndex
 * @param {string} args.bankName
 * @param {Array} args.bank             — the options array
 * @param {Map<string,Set<number>>} args.usedOptionsForThread
 *        Per-thread map from bankName → Set of used indices. The caller
 *        owns this Map; selectOption mutates it.
 * @param {function} [args.onReset]     — optional callback invoked when
 *        a bank exhausts and the used-set is reset. Receives
 *        { runId, threadIndex, role, moveIndex, bankName, bankSize }.
 * @returns { option, optionIndex }
 */
function selectOption({
  runId,
  threadIndex,
  role,
  moveIndex,
  bankName,
  bank,
  usedOptionsForThread,
  onReset,
}) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('selectOption requires a non-empty runId');
  }
  if (!Number.isFinite(threadIndex) || threadIndex < 0) {
    throw new Error('selectOption requires threadIndex ≥ 0');
  }
  if (role !== 'provocateur' && role !== 'revocateur') {
    throw new Error(`selectOption: role must be provocateur|revocateur (got '${role}')`);
  }
  if (!Number.isFinite(moveIndex) || moveIndex <= 0) {
    throw new Error('selectOption requires moveIndex ≥ 1');
  }
  if (typeof bankName !== 'string' || !ALL_BANK_NAMES.includes(bankName)) {
    throw new Error(`selectOption: unknown bankName '${bankName}'`);
  }
  // §4.3 role-bank gate.
  const allowed = role === 'provocateur' ? PROVOCATEUR_BANKS : REVOCATEUR_BANKS;
  if (!allowed.includes(bankName)) {
    throw new Error(
      `selectOption: role '${role}' may not draw from bank '${bankName}'`,
    );
  }
  if (!Array.isArray(bank) || bank.length === 0) {
    throw new Error(`selectOption: bank '${bankName}' is empty`);
  }
  if (!(usedOptionsForThread instanceof Map)) {
    throw new Error('selectOption requires a Map for usedOptionsForThread');
  }

  let used = usedOptionsForThread.get(bankName);
  if (!(used instanceof Set)) {
    used = new Set();
    usedOptionsForThread.set(bankName, used);
  }
  if (used.size >= bank.length) {
    // Bank exhausted — reset and emit the bank_exhausted_reset event.
    used.clear();
    if (typeof onReset === 'function') {
      onReset({ runId, threadIndex, role, moveIndex, bankName, bankSize: bank.length });
    }
  }

  const baseKey = `${runId}:opt:${threadIndex}:${role}:${moveIndex}:${bankName}`;
  const baseIndex = uintHash(baseKey) % bank.length;

  // Linear probe up to bank.length entries; at least one MUST be unused
  // because we reset above when used.size === bank.length.
  for (let k = 0; k < bank.length; k++) {
    const idx = (baseIndex + k) % bank.length;
    if (!used.has(idx)) {
      used.add(idx);
      return { option: bank[idx], optionIndex: idx };
    }
  }
  // Defensive: this is unreachable given the reset above.
  throw new Error(`selectOption: probe failed to find unused index in bank '${bankName}'`);
}

// ── Voice / spine assignment (§7) ───────────────────────────────

function assignVoiceId(runId, botUserId) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('assignVoiceId requires a non-empty runId');
  }
  if (typeof botUserId !== 'string' || botUserId.length === 0) {
    throw new Error('assignVoiceId requires a non-empty botUserId');
  }
  const idx = uintHash(`${runId}:voice:${botUserId}`) % VOICES.length;
  return VOICES[idx];
}

function assignSpineId(runId, threadIndex, moveIndex, previousSpineId) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('assignSpineId requires a non-empty runId');
  }
  if (!Number.isFinite(threadIndex) || threadIndex < 0) {
    throw new Error('assignSpineId requires threadIndex ≥ 0');
  }
  if (!Number.isFinite(moveIndex) || moveIndex <= 0) {
    throw new Error('assignSpineId requires moveIndex ≥ 1');
  }
  let idx = uintHash(`${runId}:spine:${threadIndex}:${moveIndex}`) % SPINES.length;
  if (previousSpineId && SPINES[idx] === previousSpineId) {
    // §7.2 no-repeat-prior constraint: advance by +1 mod 9.
    idx = (idx + 1) % SPINES.length;
  }
  return SPINES[idx];
}

// ── Run-tag builder (§8.2) ───────────────────────────────────────

/**
 * Build a stable, human-readable runTag from the runner's runId.
 *
 * The bug §1+§8.2 replaces: runId.slice(0,8) returns 'YYYY-MM-' from
 * the ISO prefix; same-month runs collide. The new tag uses the full
 * compact YYYYMMDD-HHMM stamp plus the random 8-hex suffix.
 *
 * @param {string} runId
 *   Must look like `YYYY-MM-DDTHH-MM-SS-mmmZ-XXXXXXXX` where XXXXXXXX
 *   is the randomUUID().slice(0,8) suffix added by the runner. When
 *   the timestamp prefix is missing, falls back to `undated`.
 * @param {'corpus-prod-synthetic'|'corpus-dev-synthetic'} kind
 * @returns {string} e.g. `corpus-prod-synthetic-20260603-1422-a1b2c3d4`
 */
function buildRunTag(runId, kind) {
  if (typeof runId !== 'string' || runId.length === 0) {
    throw new Error('buildRunTag requires a non-empty runId');
  }
  if (typeof kind !== 'string' || kind.length === 0) {
    throw new Error('buildRunTag requires a non-empty kind');
  }
  // The runner's runId shape: 2026-06-03T14-22-31-123Z-a1b2c3d4
  // We split on '-' and take the LAST segment as the uuid suffix. If
  // the runId doesn't contain a '-', `split` returns the whole string
  // and we treat it as the uuid suffix directly.
  const parts = String(runId).split('-');
  const rawSuffix = parts.length > 1 ? parts[parts.length - 1] : runId;
  // Strip any non-hex characters and clamp to 8 chars for the tag.
  const uuidSuffix = String(rawSuffix).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();

  const m = runId.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
  const stamp = m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : 'undated';
  return `${kind}-${stamp}-${uuidSuffix}`;
}

module.exports = {
  uintHash,
  seedAssignment,
  seedMeetsAllFloors,
  resolveMoveBank,
  selectOption,
  assignVoiceId,
  assignSpineId,
  buildRunTag,
  SeedPoolUndersizedError,
};
