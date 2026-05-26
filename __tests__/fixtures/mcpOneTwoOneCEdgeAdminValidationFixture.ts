/**
 * MCP-021C-EDGE — Admin validation fixture (3 argument UUIDs).
 *
 * Per design §9 (Decision 10): three real persisted moves from the
 * 2026-05-25 testing-runs corpus — Onboarding apology room — covering
 * depth 0 (root), depth 1 (rebuttal), depth 2 (counter_rebuttal).
 *
 * Used by:
 *   - Test (in-memory mock): the integration flow test feeds these
 *     UUIDs through the Edge Function handler with a mock MCP adapter.
 *   - Live EDGE-SMOKE (operator): the same three UUIDs are POSTed to
 *     the deployed Edge Function via the audit template.
 *
 * Doctrine:
 *   - All three argument UUIDs reach a public Onboarding apology room
 *     (`is_debate_open_or_locked_public(debate_id)` arm of the
 *     canonical arguments SELECT policy makes them visible to any
 *     authenticated caller).
 *   - The fixture is reference-only — no DB writes happen at import
 *     time; the Edge Function loads the move bodies via service-role
 *     at runtime.
 */

/**
 * Onboarding apology debate room — public.
 * Resolution: "Long onboarding is an apology for bad UI."
 */
export const FIXTURE_DEBATE_ID = '1e598dce-8188-4c7e-bdd6-aedede750923';

/**
 * Depth 0 (root): start_thesis / thesis move.
 * Body: the root claim that long onboarding apologies are for bad UI.
 */
export const FIXTURE_ARGUMENT_ID_DEPTH_0 = 'f41b18b0-8ad6-4865-94c5-17a568f6a6ad';

/**
 * Depth 1: challenge_parent / rebuttal.
 * The first rebuttal to the root thesis.
 */
export const FIXTURE_ARGUMENT_ID_DEPTH_1 = '781f8057-9e2a-4fa9-92a8-469676950ff7';

/**
 * Depth 2: challenge_parent / counter_rebuttal.
 * The counter-rebuttal challenging the depth-1 rebuttal — exercises
 * Family A `has_counter_rebuttal = TRUE` on the depth-1 parent.
 */
export const FIXTURE_ARGUMENT_ID_DEPTH_2 = 'db0de3e0-24c6-40af-ba5f-2844acfa5bac';

/**
 * Frozen array of all three fixture UUIDs in depth order.
 */
export const ALL_FIXTURE_ARGUMENT_IDS: ReadonlyArray<string> = Object.freeze([
  FIXTURE_ARGUMENT_ID_DEPTH_0,
  FIXTURE_ARGUMENT_ID_DEPTH_1,
  FIXTURE_ARGUMENT_ID_DEPTH_2,
]);

/**
 * Alternate fixture rooms (per Decision 10) — documented in the design
 * doc §9.2 as fallback rooms if EDGE-SMOKE finds the Onboarding apology
 * room unsuitable. The argument UUIDs within these alternate rooms are
 * NOT resolved at design time; the operator resolves them via
 * `npx supabase db query --linked` if needed.
 */
export const ALTERNATE_FIXTURE_DEBATE_IDS: ReadonlyArray<{
  readonly room: string;
  readonly debateId: string;
}> = Object.freeze([
  { room: 'Pitch clock baseball', debateId: '35ef4c74-dfc8-4520-bcc9-558272257153' },
  { room: 'Bike lanes curb', debateId: '2c085a50-4a27-4dad-bc3d-17a3eca09ddb' },
]);
