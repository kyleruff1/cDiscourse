/**
 * SMOKE-FIX-001 — semantic-referee actorRole parity (Node union ⊆ Deno schema enum).
 *
 * The production `SemanticActorRole` union in `src/features/semanticReferee/triggerGates.ts`
 * is the source of truth for the actor-role vocabulary. The Deno-side inbound boundary in
 * `supabase/functions/_shared/semanticReferee/schema.ts` declares an `actorRole` enum on
 * `roomContext`. These two MUST stay in agreement: the schema enum must be a SUPERSET-OR-EQUAL
 * of the Node union, so the boundary accepts every value the production mapper emits.
 *
 * This test is a SOURCE-SCAN (not a Deno import) — `schema.ts` imports `npm:zod@4` and is not
 * Jest-importable, exactly the same constraint that already drives
 * `semanticAnthropicContentScanParity.test.ts`.
 *
 * Parity is asserted as superset (not equality): the schema may legitimately accept more
 * values than the production mapper emits today (e.g. a future client variant). Equality
 * would break the first time someone adds an actor role to the schema for an experimental
 * surface before the mapper catches up. The card SMOKE-FIX-001 design §10 documents this
 * choice.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();
const SCHEMA_PATH = path.join(
  REPO_ROOT,
  'supabase/functions/_shared/semanticReferee/schema.ts',
);
const GATES_PATH = path.join(
  REPO_ROOT,
  'src/features/semanticReferee/triggerGates.ts',
);

describe('semantic-referee actorRole parity (Node union ⊆ Deno schema enum)', () => {
  it('every SemanticActorRole value appears in the schema actorRole enum', () => {
    const schemaSrc = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const gatesSrc = fs.readFileSync(GATES_PATH, 'utf8');

    // Find the actorRole enum in the Deno schema. Matches:
    //   actorRole: z.enum(['initiator', 'primary_opponent', ...]).optional(),
    const schemaEnumMatch = schemaSrc.match(
      /actorRole:\s*z\.enum\(\[([^\]]+)\]\)/,
    );
    expect(schemaEnumMatch).not.toBeNull();
    const schemaEnumMembers = Array.from(
      schemaEnumMatch![1].matchAll(/'([a-z_]+)'/g),
    ).map((m) => m[1]);
    expect(schemaEnumMembers.length).toBeGreaterThan(0);
    const schemaEnum = new Set(schemaEnumMembers);

    // Find the SemanticActorRole union body in triggerGates.ts. Matches:
    //   export type SemanticActorRole =
    //     | 'initiator'
    //     | 'primary_opponent'
    //     | ...;
    const unionMatch = gatesSrc.match(
      /export type SemanticActorRole =([\s\S]*?);/,
    );
    expect(unionMatch).not.toBeNull();
    const unionMembers = Array.from(
      unionMatch![1].matchAll(/'([a-z_]+)'/g),
    ).map((m) => m[1]);
    expect(unionMembers.length).toBeGreaterThan(0);

    for (const member of unionMembers) {
      expect(schemaEnum.has(member)).toBe(true);
    }
  });

  it('the schema actorRole enum includes moderator (SMOKE-FIX-001 widening)', () => {
    const schemaSrc = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const schemaEnumMatch = schemaSrc.match(
      /actorRole:\s*z\.enum\(\[([^\]]+)\]\)/,
    );
    expect(schemaEnumMatch).not.toBeNull();
    const schemaEnumMembers = Array.from(
      schemaEnumMatch![1].matchAll(/'([a-z_]+)'/g),
    ).map((m) => m[1]);
    expect(schemaEnumMembers).toContain('moderator');
  });

  it('the schema roomContext.side enum already accepts moderator (sanity check)', () => {
    const schemaSrc = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const sideEnumMatch = schemaSrc.match(/side:\s*z\.enum\(\[([^\]]+)\]\)/);
    expect(sideEnumMatch).not.toBeNull();
    const sideEnumMembers = Array.from(
      sideEnumMatch![1].matchAll(/'([a-z_]+)'/g),
    ).map((m) => m[1]);
    expect(sideEnumMembers).toContain('moderator');
  });
});
