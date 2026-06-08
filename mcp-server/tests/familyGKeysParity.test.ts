/**
 * MCP-SERVER-008-FAMILY-G — Family G rawKeys parity test.
 *
 * The server-side `FAMILY_G_RAW_KEYS` array mirrors the upstream Family G
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyG.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts:
 *   - every binding subset rawKey string literal appears in both files
 *   - upstream `familyG.ts` has exactly 33 rawKey declarations
 *     (5 auto_metadata + 7 lifecycle + 21 ai_classifier; MCP-BUILD2g added 3
 *     ai_classifier keys, taking the Subset 18 → 21)
 *   - the server-side subset contains exactly the 21 ai_classifier-source
 *     entries; the 12 deterministic rawKey declarations are absent from
 *     `FAMILY_G_RAW_KEYS`
 *
 * SOURCE COUNT NOTE (design §A.1.0 + MCP-BUILD2g): the upstream `familyG.ts`
 * file-header forecast says "29 entries"; the actual array has 30 frozen
 * entries baseline with 18 ai_classifier declarations, and MCP-BUILD2g adds 3
 * ai_classifier booleans → 33 total / 21 ai_classifier. The binding contract
 * is the actual `source: 'ai_classifier'` literals in the code (21), NOT the
 * stale header. This test asserts exactly 21 ai_classifier declarations and 33
 * total.
 *
 * Also verifies cross-family-key collision (HALT trigger #2 guard):
 *   - Family A ∩ Family G-subset = ∅
 *   - Family B ∩ Family G-subset = ∅
 *   - Family C ∩ Family G-subset = ∅
 *   - Family D ∩ Family G-subset = ∅
 *   - Family E ∩ Family G-subset = ∅
 *   - Family F ∩ Family G-subset = ∅
 *
 * If MCP-021A adds/removes a Family G ai_classifier rawKey, this test
 * fails the build and forces a coordinated bump on the server-side mirror.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';
import { FAMILY_C_RAW_KEYS } from '../lib/familyCKeys.ts';
import { FAMILY_D_RAW_KEYS } from '../lib/familyDKeys.ts';
import { FAMILY_E_RAW_KEYS } from '../lib/familyEKeys.ts';
import { FAMILY_F_RAW_KEYS } from '../lib/familyFKeys.ts';
import {
  FAMILY_G_RAW_KEYS,
  FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyGKeys.ts';

const UPSTREAM_FAMILY_G_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyG.ts',
  import.meta.url,
);

Deno.test('familyGKeysParity: every server-side subset rawKey literal appears in upstream familyG.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  for (const rawKey of FAMILY_G_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyG.ts does not contain rawKey literal '${rawKey}' — Family G taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyGKeysParity: upstream familyG.ts has exactly 33 rawKey declarations (5 + 7 + 21)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  // Extract every `rawKey: '<value>'` declaration from the upstream source.
  // This is the canonical buildResolution() shape per familyG.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyG.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family G upstream MUST have 33 declarations (30 baseline + 3 MCP-BUILD2g).
  if (upstreamDeclarations.length !== 33) {
    throw new Error(
      `Upstream familyG.ts has ${upstreamDeclarations.length} rawKey declarations; expected 33. Drift detected.`,
    );
  }
});

Deno.test('familyGKeysParity: upstream familyG.ts contains all 21 ai_classifier-subset rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  for (const subsetKey of FAMILY_G_RAW_KEYS) {
    if (!upstream.includes(`'${subsetKey}'`) && !upstream.includes(`"${subsetKey}"`)) {
      throw new Error(`Upstream familyG.ts missing subset rawKey literal '${subsetKey}'`);
    }
  }
});

Deno.test('familyGKeysParity: server-side FAMILY_G_RAW_KEYS excludes ALL 12 deterministic rawKey strings', async () => {
  // The subset path excludes 12 deterministic entries (5 auto_metadata +
  // 7 lifecycle). Asserting the server-side subset does NOT contain any.
  for (const excludedKey of FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (FAMILY_G_RAW_KEYS.includes(excludedKey)) {
      throw new Error(
        `FAMILY_G_RAW_KEYS contains excluded deterministic rawKey '${excludedKey}'. Stage 2B subset boundary violated.`,
      );
    }
  }
});

Deno.test('familyGKeysParity: upstream familyG.ts contains all 12 excluded deterministic rawKey literals', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  // Stage 2B excludes these from the subset, but they MUST still exist
  // upstream — this proves the exclusion is intentional, not a silent
  // taxonomy removal.
  for (const excludedKey of FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (!upstream.includes(`'${excludedKey}'`) && !upstream.includes(`"${excludedKey}"`)) {
      throw new Error(
        `Upstream familyG.ts missing excluded deterministic rawKey '${excludedKey}'. Either upstream removed it (taxonomy drift) or the excluded list is stale.`,
      );
    }
  }
});

Deno.test('familyGKeysParity: upstream ai_classifier-source declarations match server-side subset (set equality, exactly 21)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  // Parse upstream `source: 'ai_classifier'` blocks to find their declared
  // rawKeys. Each buildResolution() block has the shape:
  //   rawKey: '<rawKey>',
  //   source: 'ai_classifier',
  // We split the file on `buildResolution({` and look at each block's
  // `rawKey: '...'` paired with `source: 'ai_classifier'`.
  const blocks = upstream.split('buildResolution({');
  const aiClassifierKeys: string[] = [];
  for (const block of blocks) {
    if (!block.includes("source: 'ai_classifier'")) continue;
    const m = block.match(/rawKey:\s*'([a-z_]+)'/);
    if (m) aiClassifierKeys.push(m[1]);
  }
  if (aiClassifierKeys.length === 0) {
    throw new Error('Upstream familyG.ts produced 0 ai_classifier rawKey extractions — block regex broken');
  }
  assertEquals(
    aiClassifierKeys.length,
    21,
    `Upstream familyG.ts ai_classifier entries: expected 21, got ${aiClassifierKeys.length}`,
  );
  // Each upstream ai_classifier rawKey MUST be in the server-side subset.
  for (const upstreamKey of aiClassifierKeys) {
    if (!FAMILY_G_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream ai_classifier rawKey '${upstreamKey}' missing from server-side FAMILY_G_RAW_KEYS subset`,
      );
    }
  }
  // And every server-side subset rawKey MUST be in the upstream ai_classifier set.
  for (const subsetKey of FAMILY_G_RAW_KEYS) {
    if (!aiClassifierKeys.includes(subsetKey)) {
      throw new Error(
        `Server-side subset rawKey '${subsetKey}' not found in upstream ai_classifier source declarations`,
      );
    }
  }
});

Deno.test('familyGKeysParity: the 12 excluded keys are upstream auto_metadata or lifecycle (not ai_classifier)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_G_PATH);
  const blocks = upstream.split('buildResolution({');
  for (const excludedKey of FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    const block = blocks.find((b) => {
      const m = b.match(/rawKey:\s*'([a-z_]+)'/);
      return m && m[1] === excludedKey;
    });
    if (!block) {
      throw new Error(`Upstream familyG.ts has no buildResolution block for excluded key '${excludedKey}'`);
    }
    const isDeterministic =
      block.includes("source: 'auto_metadata'") || block.includes("source: 'lifecycle'");
    if (!isDeterministic) {
      throw new Error(
        `Excluded key '${excludedKey}' is NOT auto_metadata/lifecycle upstream — it should not be in the excluded list`,
      );
    }
  }
});

Deno.test('familyGKeysParity: Family A ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_A_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyGKeysParity: Family B ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_B_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyGKeysParity: Family C ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_C_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family C ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyGKeysParity: Family D ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_D_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family D ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyGKeysParity: Family E ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_E_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family E ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyGKeysParity: Family F ∩ Family G-subset = ∅ (HALT trigger #2 guard)', () => {
  const intersection = FAMILY_G_RAW_KEYS.filter((k) => FAMILY_F_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family F ∩ Family G-subset cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});
