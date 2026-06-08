/**
 * MCP-SERVER-005-FAMILY-D — Family D rawKeys parity test.
 *
 * The server-side `FAMILY_D_RAW_KEYS` array mirrors the upstream Family D
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyD.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts:
 *   - every binding Subset rawKey string literal appears in both files
 *   - upstream `familyD.ts` has exactly 30 rawKey declarations (5
 *     auto_metadata + 3 lifecycle + 22 ai_classifier; MCP-BUILD2d added 3
 *     ai_classifier keys, taking the Subset 19 → 22)
 *   - the server-side Subset contains exactly the 22 ai_classifier-source
 *     entries; the 8 deterministic rawKey declarations are absent from
 *     `FAMILY_D_RAW_KEYS`
 *
 * Also verifies cross-family-key collision (HALT trigger #2 guard):
 *   - Family A ∩ Family D-Subset = ∅
 *   - Family B ∩ Family D-Subset = ∅
 *   - Family C ∩ Family D-Subset = ∅
 *
 * If MCP-021A adds/removes a Family D ai_classifier rawKey, this test
 * fails the build and forces a coordinated bump on the server-side mirror.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';
import { FAMILY_C_RAW_KEYS } from '../lib/familyCKeys.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyDKeys.ts';

const UPSTREAM_FAMILY_D_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyD.ts',
  import.meta.url,
);

Deno.test('familyDKeysParity: every server-side Subset rawKey literal appears in upstream familyD.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_D_PATH);
  for (const rawKey of FAMILY_D_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyD.ts does not contain rawKey literal '${rawKey}' — Family D taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyDKeysParity: upstream familyD.ts has exactly 30 rawKey declarations (5 + 3 + 22)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_D_PATH);
  // Extract every `rawKey: '<value>'` declaration from the upstream source.
  // This is the canonical buildEvidence() shape per familyD.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyD.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family D upstream MUST have 30 declarations (27 baseline + 3 MCP-BUILD2d).
  if (upstreamDeclarations.length !== 30) {
    throw new Error(
      `Upstream familyD.ts has ${upstreamDeclarations.length} rawKey declarations; expected 30. Drift detected.`,
    );
  }
});

Deno.test('familyDKeysParity: upstream familyD.ts contains all 22 ai_classifier-Subset rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_D_PATH);
  for (const subsetKey of FAMILY_D_RAW_KEYS) {
    // Each Subset rawKey must appear at least once as a string literal in
    // upstream. Comments/docstrings count for parity — the test guards
    // against silent removal.
    if (!upstream.includes(`'${subsetKey}'`) && !upstream.includes(`"${subsetKey}"`)) {
      throw new Error(
        `Upstream familyD.ts missing Subset rawKey literal '${subsetKey}'`,
      );
    }
  }
});

Deno.test('familyDKeysParity: server-side FAMILY_D_RAW_KEYS excludes ALL 6 unique deterministic rawKey strings', async () => {
  // The Subset path excludes 8 deterministic entries with 6 unique rawKey
  // strings (5 auto_metadata + the 1 lifecycle-only 'sourced'; the 2
  // collision strings 'source_requested' / 'quote_requested' are listed
  // once in FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS because BOTH
  // source-type entries are excluded). Asserting the server-side Subset
  // does NOT contain any of them.
  for (const excludedKey of FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (FAMILY_D_RAW_KEYS.includes(excludedKey)) {
      throw new Error(
        `FAMILY_D_RAW_KEYS contains excluded deterministic rawKey '${excludedKey}'. Stage 2B Subset boundary violated.`,
      );
    }
  }
});

Deno.test('familyDKeysParity: upstream familyD.ts contains all 6 unique excluded deterministic rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_D_PATH);
  // Stage 2B excludes these from the Subset, but they MUST still exist
  // upstream — this proves the exclusion is intentional, not a silent
  // taxonomy removal.
  for (const excludedKey of FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (!upstream.includes(`'${excludedKey}'`) && !upstream.includes(`"${excludedKey}"`)) {
      throw new Error(
        `Upstream familyD.ts missing excluded deterministic rawKey '${excludedKey}'. Either upstream removed it (would indicate taxonomy drift) or the excluded list is stale.`,
      );
    }
  }
});

Deno.test('familyDKeysParity: Family A ∩ Family D-Subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyD of FAMILY_D_RAW_KEYS) {
    if (FAMILY_A_RAW_KEYS.includes(keyD)) {
      intersection.push(keyD);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family D-Subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyDKeysParity: Family B ∩ Family D-Subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyD of FAMILY_D_RAW_KEYS) {
    if (FAMILY_B_RAW_KEYS.includes(keyD)) {
      intersection.push(keyD);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family D-Subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyDKeysParity: Family C ∩ Family D-Subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection: string[] = [];
  for (const keyD of FAMILY_D_RAW_KEYS) {
    if (FAMILY_C_RAW_KEYS.includes(keyD)) {
      intersection.push(keyD);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family C ∩ Family D-Subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyDKeysParity: upstream ai_classifier-source declarations match server-side Subset (set equality)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_D_PATH);
  // Parse upstream `source: 'ai_classifier'` blocks to find their
  // declared rawKeys. Each buildEvidence() block has the shape:
  //   rawKey: '<rawKey>',
  //   source: 'ai_classifier',
  // We split the file on `buildEvidence({` and look at each block's
  // `rawKey: '...'` paired with `source: 'ai_classifier'`.
  const blocks = upstream.split('buildEvidence({');
  const aiClassifierKeys: string[] = [];
  for (const block of blocks) {
    if (!block.includes("source: 'ai_classifier'")) continue;
    const m = block.match(/rawKey:\s*'([a-z_]+)'/);
    if (m) aiClassifierKeys.push(m[1]);
  }
  if (aiClassifierKeys.length === 0) {
    throw new Error('Upstream familyD.ts produced 0 ai_classifier rawKey extractions — block regex broken');
  }
  assertEquals(
    aiClassifierKeys.length,
    22,
    `Upstream familyD.ts ai_classifier entries: expected 22, got ${aiClassifierKeys.length}`,
  );
  // Each upstream ai_classifier rawKey MUST be in the server-side Subset.
  for (const upstreamKey of aiClassifierKeys) {
    if (!FAMILY_D_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream ai_classifier rawKey '${upstreamKey}' missing from server-side FAMILY_D_RAW_KEYS Subset`,
      );
    }
  }
  // And every server-side Subset rawKey MUST be in the upstream ai_classifier set.
  for (const subsetKey of FAMILY_D_RAW_KEYS) {
    if (!aiClassifierKeys.includes(subsetKey)) {
      throw new Error(
        `Server-side Subset rawKey '${subsetKey}' not found in upstream ai_classifier source declarations`,
      );
    }
  }
});
