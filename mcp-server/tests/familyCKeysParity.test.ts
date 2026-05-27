/**
 * MCP-SERVER-004-FAMILY-C — Family C rawKeys parity test.
 *
 * The server-side `FAMILY_C_RAW_KEYS` array mirrors the upstream Family C
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyC.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts every binding rawKey string literal appears in both.
 *
 * If MCP-021A adds/removes a Family C rawKey, this test fails the build
 * and forces a coordinated bump on the server-side mirror.
 *
 * Also verifies cross-family-key collision (HALT trigger #14 guard):
 *   - Family A ∩ Family C must be ∅
 *   - Family B ∩ Family C must be ∅
 */
import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';
import { FAMILY_C_RAW_KEYS } from '../lib/familyCKeys.ts';

const UPSTREAM_FAMILY_C_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyC.ts',
  import.meta.url,
);

Deno.test('familyCKeysParity: every server-side rawKey literal appears in upstream familyC.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_C_PATH);
  for (const rawKey of FAMILY_C_RAW_KEYS) {
    // The upstream file defines each rawKey via `rawKey: 'foo',` line. We
    // check for the quoted string literal to confirm the rawKey is bound to
    // a registry entry. (Comments / docstrings that mention the rawKey also
    // count — that's fine; the parity check is about lexical presence.)
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyC.ts does not contain rawKey literal '${rawKey}' — Family C taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyCKeysParity: every upstream Family C rawKey is in the server-side constant', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_C_PATH);
  // Extract every `rawKey: '<value>'` line from the upstream source.
  // This is the canonical declaration shape per familyC.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamKeys: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamKeys.push(match[1]);
  }
  if (upstreamKeys.length === 0) {
    throw new Error('Upstream familyC.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family C upstream MUST have 17 entries; if drift detected, fail
  // explicitly so the operator notices.
  if (upstreamKeys.length !== 17) {
    throw new Error(
      `Upstream familyC.ts has ${upstreamKeys.length} rawKey declarations; expected 17. Drift detected.`,
    );
  }
  for (const upstreamKey of upstreamKeys) {
    if (!FAMILY_C_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream rawKey '${upstreamKey}' missing from server-side FAMILY_C_RAW_KEYS — Family C taxonomy drift`,
      );
    }
  }
});

Deno.test('familyCKeysParity: Family A ∩ Family C = ∅ (HALT trigger #14 guard — no compound-key collision)', () => {
  const intersection: string[] = [];
  for (const keyC of FAMILY_C_RAW_KEYS) {
    if (FAMILY_A_RAW_KEYS.includes(keyC)) {
      intersection.push(keyC);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family A ∩ Family C cross-family key collision detected: ${intersection.join(', ')}. HALT trigger #14 fires.`,
    );
  }
});

Deno.test('familyCKeysParity: Family B ∩ Family C = ∅ (HALT trigger #14 guard — no compound-key collision)', () => {
  const intersection: string[] = [];
  for (const keyC of FAMILY_C_RAW_KEYS) {
    if (FAMILY_B_RAW_KEYS.includes(keyC)) {
      intersection.push(keyC);
    }
  }
  if (intersection.length > 0) {
    throw new Error(
      `Family B ∩ Family C cross-family key collision detected: ${intersection.join(', ')}. HALT trigger #14 fires.`,
    );
  }
});
