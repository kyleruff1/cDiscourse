/**
 * MCP-SERVER-006-FAMILY-E — Family E rawKeys parity test.
 *
 * The server-side `FAMILY_E_RAW_KEYS` array mirrors the upstream Family E
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts:
 *   - every binding rawKey string literal appears in both files
 *   - upstream `familyE.ts` has exactly 19 rawKey declarations (16 baseline +
 *     3 MCP-BUILD2e; uniform ai_classifier; no auto_metadata, no lifecycle)
 *   - the server-side constant contains exactly the 19 ai_classifier-source
 *     entries
 *
 * Also verifies cross-family-key collision (HALT trigger #2 guard):
 *   - Family A ∩ Family E = ∅
 *   - Family B ∩ Family E = ∅
 *   - Family C ∩ Family E = ∅
 *   - Family D ∩ Family E = ∅
 *
 * Also verifies HALT trigger #15 guard:
 *   - All 19 Family E entries upstream use `source: 'ai_classifier'`
 *     (uniform; no Subset filter required)
 *
 * If MCP-021A adds/removes a Family E rawKey, this test fails the build
 * and forces a coordinated bump on the server-side mirror.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';
import { FAMILY_C_RAW_KEYS } from '../lib/familyCKeys.ts';
import { FAMILY_D_RAW_KEYS } from '../lib/familyDKeys.ts';
import { FAMILY_E_RAW_KEYS } from '../lib/familyEKeys.ts';

const UPSTREAM_FAMILY_E_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyE.ts',
  import.meta.url,
);

Deno.test('familyEKeysParity: every server-side rawKey literal appears in upstream familyE.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_E_PATH);
  for (const rawKey of FAMILY_E_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyE.ts does not contain rawKey literal '${rawKey}' — Family E taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyEKeysParity: upstream familyE.ts has exactly 19 rawKey declarations', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_E_PATH);
  // Extract every `rawKey: '<value>'` declaration from the upstream source.
  // This is the canonical buildScheme() shape per familyE.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyE.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family E upstream MUST have 19 declarations (intent brief §1 binding 16 +
  // 3 MCP-BUILD2e Build-2 manifest §4).
  if (upstreamDeclarations.length !== 19) {
    throw new Error(
      `Upstream familyE.ts has ${upstreamDeclarations.length} rawKey declarations; expected 19. Drift detected.`,
    );
  }
});

Deno.test('familyEKeysParity: every upstream Family E rawKey is in the server-side constant', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_E_PATH);
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamKeys: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamKeys.push(match[1]);
  }
  for (const upstreamKey of upstreamKeys) {
    if (!FAMILY_E_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream rawKey '${upstreamKey}' missing from server-side FAMILY_E_RAW_KEYS — Family E taxonomy drift`,
      );
    }
  }
});

Deno.test('familyEKeysParity: Family A ∩ Family E = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyE of FAMILY_E_RAW_KEYS) {
    if (FAMILY_A_RAW_KEYS.includes(keyE)) {
      intersection.push(keyE);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family E cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyEKeysParity: Family B ∩ Family E = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyE of FAMILY_E_RAW_KEYS) {
    if (FAMILY_B_RAW_KEYS.includes(keyE)) {
      intersection.push(keyE);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family E cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyEKeysParity: Family C ∩ Family E = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyE of FAMILY_E_RAW_KEYS) {
    if (FAMILY_C_RAW_KEYS.includes(keyE)) {
      intersection.push(keyE);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family C ∩ Family E cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyEKeysParity: Family D ∩ Family E = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyE of FAMILY_E_RAW_KEYS) {
    if (FAMILY_D_RAW_KEYS.includes(keyE)) {
      intersection.push(keyE);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family D ∩ Family E cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyEKeysParity: all 19 upstream Family E entries use source: ai_classifier (HALT trigger #15 guard)', async () => {
  // Per design §1 + §10 + Build-2 manifest §4: Family E is uniform
  // `ai_classifier` (19/19 keys). No Subset filter required (Stage 2B NOT
  // REQUIRED). Any entry with a different source would surface as a Stage 2B
  // trigger.
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_E_PATH);
  // Split into buildScheme blocks. Each block should declare
  // `source: 'ai_classifier'` per the shared SchemeBuilder factory.
  const blocks = upstream.split('buildScheme({');
  // The first block is preamble (header + imports); subsequent blocks are
  // entries. So expect 20 blocks (19 entries + 1 preamble).
  const entryBlocks = blocks.slice(1);
  assertEquals(
    entryBlocks.length,
    19,
    `Expected 19 buildScheme() entry blocks; got ${entryBlocks.length}`,
  );
  // The shared buildScheme factory pins source: 'ai_classifier' as const,
  // so individual blocks don't repeat it. But the factory itself should
  // declare it. Confirm the factory's binding.
  if (!upstream.includes("source: 'ai_classifier' as const")) {
    throw new Error(
      `Upstream familyE.ts buildScheme() factory missing "source: 'ai_classifier' as const" — Stage 2B guarantee violated`,
    );
  }
});

Deno.test('familyEKeysParity: upstream ai_classifier-source declarations match server-side constant (set equality)', async () => {
  // Each upstream Family E rawKey MUST be in the server-side constant.
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_E_PATH);
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamKeys: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamKeys.push(match[1]);
  }
  assertEquals(
    upstreamKeys.length,
    19,
    `Upstream familyE.ts ai_classifier entries: expected 19, got ${upstreamKeys.length}`,
  );
  // Each upstream rawKey MUST be in the server-side constant.
  for (const upstreamKey of upstreamKeys) {
    if (!FAMILY_E_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream rawKey '${upstreamKey}' missing from server-side FAMILY_E_RAW_KEYS`,
      );
    }
  }
  // And every server-side rawKey MUST be in the upstream set.
  for (const serverKey of FAMILY_E_RAW_KEYS) {
    if (!upstreamKeys.includes(serverKey)) {
      throw new Error(
        `Server-side rawKey '${serverKey}' not found in upstream familyE.ts rawKey declarations`,
      );
    }
  }
});
