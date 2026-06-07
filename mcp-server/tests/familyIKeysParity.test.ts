/**
 * MCP-SERVER-010-FAMILY-I — Family I rawKeys parity test.
 *
 * The server-side `FAMILY_I_RAW_KEYS` array mirrors the upstream Family I
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyI.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts:
 *   - every server-side ai_classifier rawKey string literal appears in
 *     upstream familyI.ts
 *   - upstream `familyI.ts` has exactly 21 rawKey declarations (MIXED source)
 *   - upstream has exactly 6 `source: 'ai_classifier'` declarations
 *   - upstream has exactly 8 `source: 'auto_metadata'` declarations
 *   - upstream has exactly 7 `source: 'lifecycle'` declarations
 *     (the 6/8/7 mixed split — design §A.1.0 T1 source verification)
 *   - the 6 ai_classifier rawKey literals match `FAMILY_I_RAW_KEYS` verbatim
 *   - the 15 excluded literals match `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS`
 *     verbatim and are all present upstream as auto_metadata/lifecycle
 *   - the included + excluded sets are disjoint and union to 21
 *   - the file header correctly claims "21 entries total"
 *
 * MIXED SOURCE NOTE (design §A.1.0): I is MIXED. The
 * `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant (15 keys) is REQUIRED
 * (mirrors Family D + Family G), unlike the uniform-source H which omitted
 * it.
 *
 * Also verifies cross-family-key collision (HALT trigger #9 guard):
 *   - Family A ∩ Family I = ∅ … Family H ∩ Family I = ∅
 *
 * If MCP-021A adds/removes a Family I ai_classifier rawKey, this test
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
import {
  FAMILY_I_RAW_KEYS,
  FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyIKeys.ts';

const UPSTREAM_FAMILY_I_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyI.ts',
  import.meta.url,
);

function countSourceDeclarations(upstream: string, source: string): number {
  const regex = new RegExp(`source:\\s*'${source}'`, 'g');
  let count = 0;
  while (regex.exec(upstream) !== null) count += 1;
  return count;
}

/**
 * Parse upstream `buildTopology({ ... })` blocks and return the rawKeys of
 * each block whose source matches the requested source string. (Each Family I
 * entry is declared via a buildTopology({ rawKey, source, ... }) call, so the
 * split key is `buildTopology({` — NOT `Object.freeze({`, which appears inside
 * the builder and would mis-pair the source/rawKey extraction.)
 */
function rawKeysForSource(upstream: string, source: string): string[] {
  const blocks = upstream.split('buildTopology({');
  const keys: string[] = [];
  for (const block of blocks) {
    if (!block.includes(`source: '${source}'`)) continue;
    const m = block.match(/rawKey:\s*'([a-z_]+)'/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

Deno.test('familyIKeysParity: every server-side rawKey literal appears in upstream familyI.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  for (const rawKey of FAMILY_I_RAW_KEYS) {
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyI.ts does not contain rawKey literal '${rawKey}' — Family I taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyIKeysParity: upstream familyI.ts has exactly 21 rawKey declarations (MIXED source)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamDeclarations: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamDeclarations.push(match[1]);
  }
  if (upstreamDeclarations.length === 0) {
    throw new Error('Upstream familyI.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  if (upstreamDeclarations.length !== 21) {
    throw new Error(
      `Upstream familyI.ts has ${upstreamDeclarations.length} rawKey declarations; expected 21. Drift detected.`,
    );
  }
});

Deno.test('familyIKeysParity: upstream familyI.ts has exactly 6 source: ai_classifier declarations', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const count = countSourceDeclarations(upstream, 'ai_classifier');
  assertEquals(
    count,
    6,
    `Upstream familyI.ts has ${count} source: 'ai_classifier' declarations; expected 6 (the MCP classifier scope)`,
  );
});

Deno.test('familyIKeysParity: upstream familyI.ts has exactly 8 source: auto_metadata declarations', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const count = countSourceDeclarations(upstream, 'auto_metadata');
  assertEquals(
    count,
    8,
    `Upstream familyI.ts has ${count} source: 'auto_metadata' declarations; expected 8 (excluded deterministic)`,
  );
});

Deno.test('familyIKeysParity: upstream familyI.ts has exactly 7 source: lifecycle declarations', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const count = countSourceDeclarations(upstream, 'lifecycle');
  assertEquals(
    count,
    7,
    `Upstream familyI.ts has ${count} source: 'lifecycle' declarations; expected 7 (excluded deterministic)`,
  );
});

Deno.test('familyIKeysParity: upstream ai_classifier-source declarations match server-side FAMILY_I_RAW_KEYS (set equality, exactly 6)', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const aiClassifierKeys = rawKeysForSource(upstream, 'ai_classifier');
  if (aiClassifierKeys.length === 0) {
    throw new Error('Upstream familyI.ts produced 0 ai_classifier rawKey extractions — block regex broken');
  }
  assertEquals(
    aiClassifierKeys.length,
    6,
    `Upstream familyI.ts ai_classifier entries: expected 6, got ${aiClassifierKeys.length}`,
  );
  for (const upstreamKey of aiClassifierKeys) {
    if (!FAMILY_I_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream ai_classifier rawKey '${upstreamKey}' missing from server-side FAMILY_I_RAW_KEYS`,
      );
    }
  }
  for (const subsetKey of FAMILY_I_RAW_KEYS) {
    if (!aiClassifierKeys.includes(subsetKey)) {
      throw new Error(
        `Server-side rawKey '${subsetKey}' not found in upstream ai_classifier source declarations`,
      );
    }
  }
});

Deno.test('familyIKeysParity: the 15 excluded literals are all present upstream as auto_metadata or lifecycle', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  const deterministicKeys = new Set<string>([
    ...rawKeysForSource(upstream, 'auto_metadata'),
    ...rawKeysForSource(upstream, 'lifecycle'),
  ]);
  assertEquals(
    deterministicKeys.size,
    15,
    `Upstream familyI.ts deterministic (auto_metadata + lifecycle) entries: expected 15, got ${deterministicKeys.size}`,
  );
  for (const excluded of FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (!deterministicKeys.has(excluded)) {
      throw new Error(
        `Excluded rawKey '${excluded}' not found upstream as auto_metadata or lifecycle source`,
      );
    }
  }
});

Deno.test('familyIKeysParity: included ∩ excluded = ∅ and union = 21 (mixed-source boundary)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) =>
    FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(k),
  );
  assertEquals(intersection.length, 0, `included ∩ excluded non-empty: ${intersection.join(', ')}`);
  const union = new Set<string>([
    ...FAMILY_I_RAW_KEYS,
    ...FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS,
  ]);
  assertEquals(union.size, 21);
});

Deno.test('familyIKeysParity: upstream familyI.ts header correctly claims "21 entries total"', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_I_PATH);
  if (!upstream.includes('21 entries total')) {
    throw new Error('Upstream familyI.ts header does not claim "21 entries total" — header/code drift');
  }
});

Deno.test('familyIKeysParity: Family A ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_A_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family B ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_B_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family C ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_C_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family C ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family D ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_D_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family D ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family E ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_E_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family E ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family F ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_F_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family F ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family G ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_G_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family G ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});

Deno.test('familyIKeysParity: Family H ∩ Family I = ∅ (HALT trigger #9 guard)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) => FAMILY_H_RAW_KEYS.includes(k));
  if (intersection.length > 0) {
    throw new Error(
      `Family H ∩ Family I cross-family key collision detected: ${intersection.join(', ')}. HALT trigger fires.`,
    );
  }
});
