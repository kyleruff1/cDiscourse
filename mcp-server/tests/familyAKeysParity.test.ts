/**
 * MCP-SERVER-002 — Family A rawKeys parity test.
 *
 * The server-side `FAMILY_A_RAW_KEYS` array mirrors the upstream Family A
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyA.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts every binding rawKey string literal appears in both.
 *
 * If MCP-021A adds/removes a Family A rawKey, this test fails the build
 * and forces a coordinated bump on the server-side mirror.
 */
import '../lib/familyRegistryInit.ts'; // side-effect: register Family A
import { getRawKeysForFamily } from '../lib/familyRegistry.ts';

const FAMILY_A_RAW_KEYS = Array.from(getRawKeysForFamily('parent_relation'));

const UPSTREAM_FAMILY_A_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyA.ts',
  import.meta.url,
);

Deno.test('familyAKeysParity: every server-side rawKey literal appears in upstream familyA.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_A_PATH);
  for (const rawKey of FAMILY_A_RAW_KEYS) {
    // The upstream file defines each rawKey via `rawKey: 'foo',` line. We
    // check for the quoted string literal to confirm the rawKey is bound to
    // a registry entry. (Comments / docstrings that mention the rawKey also
    // count — that's fine; the parity check is about lexical presence.)
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyA.ts does not contain rawKey literal '${rawKey}' — Family A taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyAKeysParity: every upstream Family A rawKey is in the server-side constant', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_A_PATH);
  // Extract every `rawKey: '<value>'` line from the upstream source.
  // This is the canonical declaration shape per familyA.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamKeys: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamKeys.push(match[1]);
  }
  if (upstreamKeys.length === 0) {
    throw new Error('Upstream familyA.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family A upstream MUST have 16 entries; if drift detected, fail
  // explicitly so the operator notices.
  if (upstreamKeys.length !== 16) {
    throw new Error(
      `Upstream familyA.ts has ${upstreamKeys.length} rawKey declarations; expected 16. Drift detected.`,
    );
  }
  for (const upstreamKey of upstreamKeys) {
    if (!FAMILY_A_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream rawKey '${upstreamKey}' missing from server-side FAMILY_A_RAW_KEYS — Family A taxonomy drift`,
      );
    }
  }
});
