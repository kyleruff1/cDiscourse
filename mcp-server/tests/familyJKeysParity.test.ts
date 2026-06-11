/**
 * MCP-SERVER-011-FAMILY-J — Family J rawKeys parity test.
 *
 * The server-side `FAMILY_J_RAW_KEYS` array + per-entry source/disposition
 * metadata mirror the upstream Family J registry in
 * `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts`. The
 * server is a separately-deployable artifact (Deno Deploy); cross-tree imports
 * do not work in that target. This test reads BOTH files as source text and
 * asserts:
 *   - every server-side rawKey string literal appears in upstream familyJ.ts
 *   - upstream `familyJ.ts` has exactly 5 rawKey declarations (uniform
 *     semantic_referee)
 *   - upstream has zero `source: 'auto_metadata'` declarations
 *   - upstream has zero `source: 'lifecycle'` declarations (proves J is uniform)
 *   - upstream has exactly 5 `source: 'semantic_referee'` declarations matching
 *     FAMILY_J_RAW_KEYS verbatim
 *   - the upstream disposition split is exactly 3 composer_only + 2 inspect_only
 *     and matches the server-side FAMILY_J_PROMPT_ENTRIES disposition metadata
 *
 * SOURCE-UNIFORM NOTE (design §1): J is uniform `semantic_referee`. No
 * `FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant exists (E + F + H also
 * omit it — uniform-source precedent; the inverse of the mixed-source D/G/I).
 * The parity test asserts exactly 5 semantic_referee declarations and zero
 * excluded.
 *
 * Also verifies cross-family-key collision (HALT trigger #9 guard):
 *   - Family A ∩ Family J = ∅ … Family I ∩ Family J = ∅
 *
 * If MCP-021A adds/removes a Family J semantic_referee rawKey or flips a
 * disposition, this test fails the build and forces a coordinated bump on the
 * server-side mirror.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';
import { FAMILY_C_RAW_KEYS } from '../lib/familyCKeys.ts';
import { FAMILY_D_RAW_KEYS } from '../lib/familyDKeys.ts';
import { FAMILY_E_RAW_KEYS } from '../lib/familyEKeys.ts';
import { FAMILY_F_RAW_KEYS } from '../lib/familyFKeys.ts';
import { FAMILY_G_RAW_KEYS } from '../lib/familyGKeys.ts';
import { FAMILY_H_RAW_KEYS } from '../lib/familyHKeys.ts';
import { FAMILY_I_RAW_KEYS } from '../lib/familyIKeys.ts';
import { FAMILY_J_RAW_KEYS, FAMILY_J_PROMPT_ENTRIES } from '../lib/familyJKeys.ts';

const UPSTREAM_FAMILY_J_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyJ.ts',
  import.meta.url,
);

function countSourceDeclarations(upstream: string, source: string): number {
  const regex = new RegExp(`source:\\s*'${source}'`, 'g');
  let count = 0;
  while (regex.exec(upstream) !== null) count += 1;
  return count;
}

/**
 * Parse upstream `Object.freeze({ ... })` blocks and return the rawKeys of
 * each block whose source matches the requested source string.
 */
function rawKeysForSource(upstream: string, source: string): string[] {
  const blocks = upstream.split('Object.freeze({');
  const keys: string[] = [];
  for (const block of blocks) {
    if (!block.includes(`source: '${source}'`)) continue;
    const m = block.match(/rawKey:\s*'([a-z_]+)'/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

/**
 * Parse upstream `Object.freeze({ ... })` blocks and return a rawKey →
 * disposition map for the semantic_referee blocks.
 */
function dispositionByRawKey(upstream: string): Record<string, string> {
  const blocks = upstream.split('Object.freeze({');
  const out: Record<string, string> = {};
  for (const block of blocks) {
    if (!block.includes("source: 'semantic_referee'")) continue;
    const rawKeyMatch = block.match(/rawKey:\s*'([a-z_]+)'/);
    const dispMatch = block.match(/disposition:\s*'([a-z_]+)'/);
    if (rawKeyMatch && dispMatch) out[rawKeyMatch[1]] = dispMatch[1];
  }
  return out;
}

Deno.test('familyJKeysParity: every server-side rawKey literal appears in upstream familyJ.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  for (const rawKey of FAMILY_J_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyJ.ts does not contain rawKey literal '${rawKey}' — Family J taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyJKeysParity: upstream familyJ.ts has exactly 5 rawKey declarations (uniform semantic_referee)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyJ.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  if (upstreamDeclarations.length !== 5) {
    throw new Error(
      `Upstream familyJ.ts has ${upstreamDeclarations.length} rawKey declarations; expected 5. Drift detected.`,
    );
  }
});

Deno.test('familyJKeysParity: upstream familyJ.ts contains all 5 semantic_referee rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  for (const subsetKey of FAMILY_J_RAW_KEYS) {
    if (!upstream.includes(`'${subsetKey}'`) && !upstream.includes(`"${subsetKey}"`)) {
      throw new Error(`Upstream familyJ.ts missing rawKey literal '${subsetKey}'`);
    }
  }
});

Deno.test('familyJKeysParity: upstream familyJ.ts has ZERO source: auto_metadata declarations (uniform J)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const count = countSourceDeclarations(upstream, 'auto_metadata');
  assertEquals(
    count,
    0,
    `Upstream familyJ.ts has ${count} source: 'auto_metadata' declarations; expected 0 (J is uniform semantic_referee)`,
  );
});

Deno.test('familyJKeysParity: upstream familyJ.ts has ZERO source: lifecycle declarations (uniform J)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const count = countSourceDeclarations(upstream, 'lifecycle');
  assertEquals(
    count,
    0,
    `Upstream familyJ.ts has ${count} source: 'lifecycle' declarations; expected 0 (J is uniform semantic_referee)`,
  );
});

Deno.test('familyJKeysParity: upstream familyJ.ts has ZERO source: ai_classifier declarations (uniform semantic_referee J)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const count = countSourceDeclarations(upstream, 'ai_classifier');
  assertEquals(
    count,
    0,
    `Upstream familyJ.ts has ${count} source: 'ai_classifier' declarations; expected 0 (J is uniform semantic_referee)`,
  );
});

Deno.test('familyJKeysParity: upstream semantic_referee-source declarations match server-side FAMILY_J_RAW_KEYS (set equality, exactly 5)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const semanticRefereeKeys = rawKeysForSource(upstream, 'semantic_referee');
  if (semanticRefereeKeys.length === 0) {
    throw new Error('Upstream familyJ.ts produced 0 semantic_referee rawKey extractions — block regex broken');
  }
  assertEquals(
    semanticRefereeKeys.length,
    5,
    `Upstream familyJ.ts semantic_referee entries: expected 5, got ${semanticRefereeKeys.length}`,
  );
  for (const upstreamKey of semanticRefereeKeys) {
    if (!FAMILY_J_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream semantic_referee rawKey '${upstreamKey}' missing from server-side FAMILY_J_RAW_KEYS`,
      );
    }
  }
  for (const subsetKey of FAMILY_J_RAW_KEYS) {
    if (!semanticRefereeKeys.includes(subsetKey)) {
      throw new Error(
        `Server-side rawKey '${subsetKey}' not found in upstream semantic_referee source declarations`,
      );
    }
  }
});

Deno.test('familyJKeysParity: upstream disposition split is exactly 3 composer_only + 2 inspect_only', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const dispMap = dispositionByRawKey(upstream);
  const composerOnly = Object.values(dispMap).filter((d) => d === 'composer_only');
  const inspectOnly = Object.values(dispMap).filter((d) => d === 'inspect_only');
  assertEquals(composerOnly.length, 3, `expected 3 composer_only upstream; got ${composerOnly.length}`);
  assertEquals(inspectOnly.length, 2, `expected 2 inspect_only upstream; got ${inspectOnly.length}`);
});

Deno.test('familyJKeysParity: upstream disposition per rawKey matches server-side FAMILY_J_PROMPT_ENTRIES', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  const dispMap = dispositionByRawKey(upstream);
  for (const entry of FAMILY_J_PROMPT_ENTRIES) {
    const upstreamDisp = dispMap[entry.rawKey];
    if (upstreamDisp === undefined) {
      throw new Error(`Upstream familyJ.ts missing disposition for rawKey '${entry.rawKey}'`);
    }
    assertEquals(
      entry.disposition,
      upstreamDisp,
      `disposition drift for '${entry.rawKey}': server='${entry.disposition}' upstream='${upstreamDisp}'`,
    );
  }
});

Deno.test('familyJKeysParity: upstream familyJ.ts header documents the 5-entry binding (Trigger 10)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_J_PATH);
  if (!upstream.includes('5 entries')) {
    throw new Error('Upstream familyJ.ts header does not document "5 entries" — header/code drift');
  }
});

Deno.test('familyJKeysParity: Family A ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_A_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family A ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family B ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_B_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family B ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family C ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_C_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family C ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family D ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_D_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family D ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family E ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_E_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family E ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family F ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_F_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family F ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family G ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_G_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family G ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family H ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_H_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family H ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});

Deno.test('familyJKeysParity: Family I ∩ Family J = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_J_RAW_KEYS.filter((k) => FAMILY_I_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(`Family I ∩ Family J cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`);
  }
});
