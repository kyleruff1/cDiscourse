/**
 * MCP-SERVER-009-FAMILY-H — Family H rawKeys parity test.
 *
 * The server-side `FAMILY_H_RAW_KEYS` array mirrors the upstream Family H
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyH.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts:
 *   - every server-side rawKey string literal appears in upstream familyH.ts
 *   - upstream `familyH.ts` has exactly 12 rawKey declarations (uniform
 *     ai_classifier; 1 existing + 11 NEW)
 *   - upstream has zero `source: 'auto_metadata'` declarations
 *   - upstream has zero `source: 'lifecycle'` declarations (proves H is uniform)
 *   - the 12 rawKey literals match `FAMILY_H_RAW_KEYS` verbatim by string equality
 *
 * UNIFORM SOURCE NOTE (design §A.1.1): H is uniform `ai_classifier`. No
 * `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant exists (E + F also
 * omit it — uniform-source precedent). The parity test asserts exactly 12
 * ai_classifier declarations and zero excluded.
 *
 * Also verifies cross-family-key collision (HALT trigger #9 guard):
 *   - Family A ∩ Family H = ∅
 *   - Family B ∩ Family H = ∅
 *   - Family C ∩ Family H = ∅
 *   - Family D ∩ Family H = ∅
 *   - Family E ∩ Family H = ∅
 *   - Family F ∩ Family H = ∅
 *   - Family G ∩ Family H = ∅
 *
 * If MCP-021A adds/removes a Family H ai_classifier rawKey, this test
 * fails the build and forces a coordinated bump on the server-side mirror.
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

const UPSTREAM_FAMILY_H_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyH.ts',
  import.meta.url,
);

Deno.test('familyHKeysParity: every server-side rawKey literal appears in upstream familyH.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  for (const rawKey of FAMILY_H_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyH.ts does not contain rawKey literal '${rawKey}' — Family H taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyHKeysParity: upstream familyH.ts has exactly 12 rawKey declarations (uniform ai_classifier)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  // Extract every `rawKey: '<value>'` declaration from the upstream source.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyH.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family H upstream MUST have 12 declarations (uniform ai_classifier).
  if (upstreamDeclarations.length !== 12) {
    throw new Error(
      `Upstream familyH.ts has ${upstreamDeclarations.length} rawKey declarations; expected 12. Drift detected.`,
    );
  }
});

Deno.test('familyHKeysParity: upstream familyH.ts contains all 12 ai_classifier rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  for (const subsetKey of FAMILY_H_RAW_KEYS) {
    if (!upstream.includes(`'${subsetKey}'`) && !upstream.includes(`"${subsetKey}"`)) {
      throw new Error(`Upstream familyH.ts missing rawKey literal '${subsetKey}'`);
    }
  }
});

Deno.test('familyHKeysParity: upstream familyH.ts has ZERO source: auto_metadata declarations (uniform H)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  const autoMetadataRegex = /source:\s*'auto_metadata'/g;
  let count = 0;
  while (autoMetadataRegex.exec(upstream) !== null) {
    count += 1;
  }
  assertEquals(
    count,
    0,
    `Upstream familyH.ts has ${count} source: 'auto_metadata' declarations; expected 0 (H is uniform ai_classifier)`,
  );
});

Deno.test('familyHKeysParity: upstream familyH.ts has ZERO source: lifecycle declarations (uniform H)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  const lifecycleRegex = /source:\s*'lifecycle'/g;
  let count = 0;
  while (lifecycleRegex.exec(upstream) !== null) {
    count += 1;
  }
  assertEquals(
    count,
    0,
    `Upstream familyH.ts has ${count} source: 'lifecycle' declarations; expected 0 (H is uniform ai_classifier)`,
  );
});

Deno.test('familyHKeysParity: upstream ai_classifier-source declarations match server-side (set equality, exactly 12)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_H_PATH);
  // Parse upstream `source: 'ai_classifier'` blocks to find their declared
  // rawKeys. Each Object.freeze({ ... }) block has the shape:
  //   rawKey: '<rawKey>',
  //   ...
  //   source: 'ai_classifier',
  // We split the file on `Object.freeze({` and look at each block's
  // `rawKey: '...'` paired with `source: 'ai_classifier'`.
  const blocks = upstream.split('Object.freeze({');
  const aiClassifierKeys: string[] = [];
  for (const block of blocks) {
    if (!block.includes("source: 'ai_classifier'")) continue;
    const m = block.match(/rawKey:\s*'([a-z_]+)'/);
    if (m) aiClassifierKeys.push(m[1]);
  }
  if (aiClassifierKeys.length === 0) {
    throw new Error('Upstream familyH.ts produced 0 ai_classifier rawKey extractions — block regex broken');
  }
  assertEquals(
    aiClassifierKeys.length,
    12,
    `Upstream familyH.ts ai_classifier entries: expected 12, got ${aiClassifierKeys.length}`,
  );
  // Each upstream ai_classifier rawKey MUST be in the server-side set.
  for (const upstreamKey of aiClassifierKeys) {
    if (!FAMILY_H_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream ai_classifier rawKey '${upstreamKey}' missing from server-side FAMILY_H_RAW_KEYS`,
      );
    }
  }
  // And every server-side rawKey MUST be in the upstream ai_classifier set.
  for (const subsetKey of FAMILY_H_RAW_KEYS) {
    if (!aiClassifierKeys.includes(subsetKey)) {
      throw new Error(
        `Server-side rawKey '${subsetKey}' not found in upstream ai_classifier source declarations`,
      );
    }
  }
});

Deno.test('familyHKeysParity: Family A ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_A_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family B ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_B_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family C ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_C_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family C ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family D ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_D_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family D ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family E ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_E_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family E ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family F ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_F_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family F ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyHKeysParity: Family G ∩ Family H = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_H_RAW_KEYS.filter((k) => FAMILY_G_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family G ∩ Family H cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});
