/**
 * MCP-SERVER-003-FAMILY-B — Family B rawKeys parity test.
 *
 * The server-side `FAMILY_B_RAW_KEYS` array mirrors the upstream Family B
 * registry in `src/features/nodeLabels/machineObservationDefinitions/familyB.ts`.
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports do not work in that target. This test reads BOTH files as source
 * text and asserts every binding rawKey string literal appears in both.
 *
 * If MCP-021A adds/removes a Family B rawKey, this test fails the build
 * and forces a coordinated bump on the server-side mirror.
 */
import { FAMILY_B_RAW_KEYS } from '../lib/familyBKeys.ts';

const UPSTREAM_FAMILY_B_PATH = new URL(
  '../../src/features/nodeLabels/machineObservationDefinitions/familyB.ts',
  import.meta.url,
);

Deno.test('familyBKeysParity: every server-side rawKey literal appears in upstream familyB.ts', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_B_PATH);
  for (const rawKey of FAMILY_B_RAW_KEYS) {
    // The upstream file defines each rawKey via `rawKey: 'foo',` line. We
    // check for the quoted string literal to confirm the rawKey is bound to
    // a registry entry. (Comments / docstrings that mention the rawKey also
    // count — that's fine; the parity check is about lexical presence.)
    if (!upstream.includes(`'${rawKey}'`) && !upstream.includes(`"${rawKey}"`)) {
      throw new Error(
        `Upstream familyB.ts does not contain rawKey literal '${rawKey}' — Family B taxonomy drift detected`,
      );
    }
  }
});

Deno.test('familyBKeysParity: every upstream Family B rawKey is in the server-side constant', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_FAMILY_B_PATH);
  // Extract every `rawKey: '<value>'` line from the upstream source.
  // This is the canonical declaration shape per familyB.ts.
  const rawKeyDeclarationRegex = /rawKey:\s*'([a-z_]+)'/g;
  const upstreamKeys: string[] = [];
  let match;
  while ((match = rawKeyDeclarationRegex.exec(upstream)) !== null) {
    upstreamKeys.push(match[1]);
  }
  if (upstreamKeys.length === 0) {
    throw new Error('Upstream familyB.ts produced 0 rawKey declarations — regex broken or file moved');
  }
  // Family B upstream MUST have 17 entries (14 MCP-SERVER-003-FAMILY-B + 3
  // MCP-BUILD2a Build-2 addendum §5); if drift detected, fail explicitly so
  // the operator notices.
  if (upstreamKeys.length !== 17) {
    throw new Error(
      `Upstream familyB.ts has ${upstreamKeys.length} rawKey declarations; expected 17. Drift detected.`,
    );
  }
  for (const upstreamKey of upstreamKeys) {
    if (!FAMILY_B_RAW_KEYS.includes(upstreamKey)) {
      throw new Error(
        `Upstream rawKey '${upstreamKey}' missing from server-side FAMILY_B_RAW_KEYS — Family B taxonomy drift`,
      );
    }
  }
});
