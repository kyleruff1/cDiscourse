/**
 * MCP-021C-EDGE — Family-agnostic request builder for the Boolean
 * Observation classifier MCP call.
 *
 * Per design §3.3: for each argumentId in the Edge Function input, ONE
 * MCP call is made per argument carrying:
 *   - the move body
 *   - the parent body (or null when root)
 *   - thread context excerpt (≤2,000 chars; up to 3 ancestor bodies)
 *   - the union of rawKeys from the eligible families
 *
 * The builder is family-agnostic — it filters input families via
 * `familyRegistry.filterFamiliesForMode(...)` and resolves rawKeys via
 * the mirrored `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY`. At
 * MCP-021C-EDGE ship, production mode only sees `parent_relation` (16
 * rawKeys); admin validation mode sees the requested families.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §7 — Pure TS; no Deno-specific call. The MCP
 *     call itself is in `booleanObservationMcpAdapter.ts`.
 *   - cdiscourse-doctrine §10a — request carries STRUCTURAL questions
 *     only; the verbose definitions delegate to the MCP-021A registry.
 */

import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';
import type {
  McpBooleanObservationRequest,
} from './mcpBooleanObservationSchema.ts';
import { MACHINE_OBSERVATION_DEFINITIONS_REGISTRY } from './machineObservationDefinitions.ts';
import { filterFamiliesForMode } from './familyRegistry.ts';
import type {
  MachineObservationDefinition,
  MachineObservationFamily,
  MachineObservationSource,
} from './nodeLabelTypes.ts';
import type { MachineObservationRunMode } from './runModeConstants.ts';

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const MAX_THREAD_CONTEXT_CHARS = 2_000;

/**
 * MCP-SERVER-005-FAMILY-D Stage 2B subset filter — per-family source allowlist
 * for the MCP server's classifier scope.
 *
 * The Edge function's full registry (MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)
 * enumerates ALL rawKeys for a family across ALL sources (auto_metadata +
 * lifecycle + ai_classifier). The MCP server, per operator Stage 2B decisions
 * for each family, may support only a subset of those sources.
 *
 * For Family D (`evidence_source_chain`), operator Stage 2B approved
 * "Subset path (19 ai_classifier keys; 8 deterministic excluded)". Sending
 * the 8 deterministic keys to the MCP server would trigger unsupported_rawKey
 * validation → mcp_validation_failed at the Edge.
 *
 * For Family A/B/C, the MCP server supports all sources in those families'
 * key sets (lifecycle + auto_metadata + ai_classifier as appropriate); the
 * absence of an entry in this map preserves current behavior (all sources
 * sent).
 *
 * Future families with similar source-mix complexity (E/F/G/H/I/J) add an
 * entry here keyed on their family identifier when their Stage 2B decision
 * lands; absence = full registry passthrough.
 *
 * Doctrine: this constant is the binding boundary between Edge taxonomy
 * (full 27-entry Family D for parser/rendering purposes) and MCP server
 * classifier scope (19 ai_classifier keys per Stage 2B).
 */
const MCP_SERVER_SUPPORTED_FAMILY_SOURCES: Readonly<
  Partial<Record<MachineObservationFamily, ReadonlySet<MachineObservationSource>>>
> = Object.freeze({
  evidence_source_chain: Object.freeze(new Set<MachineObservationSource>(['ai_classifier'])),
});

/**
 * Test-only export to verify the constant shape from outside. Production
 * code should rely on the filter behavior in
 * `buildBooleanObservationRequestForArgument`.
 */
export function getMcpServerSupportedFamilySources(
  family: MachineObservationFamily,
): ReadonlySet<MachineObservationSource> | undefined {
  return MCP_SERVER_SUPPORTED_FAMILY_SOURCES[family];
}

export interface BuildBooleanObservationRequestInput {
  /** The move being classified. */
  argumentId: string;
  /** Parent argument id (null when classifying a root claim). */
  parentArgumentId: string | null;
  /** Sanitized text of the move being classified. */
  currentText: string;
  /** Sanitized text of the parent move (null when root). */
  parentText: string | null;
  /**
   * Sanitized excerpt of the recent ancestor chain (joined by `\n---\n`,
   * truncated to <=MAX_THREAD_CONTEXT_CHARS chars).
   */
  threadContextExcerpt: string;
  /**
   * Families the caller wants to evaluate. The builder filters this list
   * against the family registry for the given mode.
   */
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  /** Run mode discriminator — gates the family filter. */
  mode: MachineObservationRunMode;
  /** Optional per-call timeout override. */
  timeoutMs?: number;
}

/**
 * Build the MCP request body for one argument. Pure.
 *
 * Returns NEVER null — if no families are eligible for the requested
 * mode, returns a request with empty `requestedRawKeys` (caller decides
 * whether to skip the MCP call).
 */
export function buildBooleanObservationRequestForArgument(
  input: BuildBooleanObservationRequestInput,
): McpBooleanObservationRequest {
  // Filter the requested families against the registry for the mode.
  const eligibleFamilies = filterFamiliesForMode(input.requestedFamilies, input.mode);

  // Build the rawKey set from the eligible families.
  // Build the rawKey set + definitions map. Iterate the compound registry
  // (keyed by `${source}:${rawKey}`); two rawKeys overlap between sources
  // (`source_requested`, `quote_requested` appear in both `auto_metadata`
  // and `lifecycle` per MCP-021A §"Key shape"). Dedupe rawKeys via a Set
  // so the MCP server only receives one question per distinct key. The
  // definitions map naturally dedupes (Record by rawKey); the priority
  // order in `machineObservationDefinitions.buildByRawKeyRegistry` picks
  // the highest-priority entry per rawKey.
  const rawKeySet = new Set<string>();
  const definitions: Record<string, MachineObservationDefinition> = {};
  for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
    if (!eligibleFamilies.includes(def.family)) continue;
    // MCP-SERVER-005-FAMILY-D Stage 2B subset filter: if the family
    // has an explicit MCP-supported-source allowlist (e.g., Family D =
    // ai_classifier only per operator Stage 2B), skip entries whose
    // source is not in the allowlist. Families without an entry pass
    // through unfiltered (current Family A/B/C behavior preserved).
    const allowedSources = MCP_SERVER_SUPPORTED_FAMILY_SOURCES[def.family];
    if (allowedSources && !allowedSources.has(def.source)) continue;
    rawKeySet.add(def.rawKey);
    // Last write wins in this loop; the parser caller resolves via
    // lookupMachineObservationDefinition() which uses the priority
    // BY_RAW_KEY registry. Either map shape is acceptable; the wire
    // contract is `definitions` keyed by rawKey.
    definitions[def.rawKey] = def;
  }
  const rawKeys = Array.from(rawKeySet);

  // Truncate threadContextExcerpt defensively.
  const safeThreadContext =
    typeof input.threadContextExcerpt === 'string'
      ? input.threadContextExcerpt.slice(0, MAX_THREAD_CONTEXT_CHARS)
      : '';

  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: input.argumentId,
    parentNodeId: input.parentArgumentId,
    currentText: input.currentText,
    parentText: input.parentText,
    threadContextExcerpt: safeThreadContext,
    requestedFamilies: Object.freeze([...eligibleFamilies]),
    requestedRawKeys: Object.freeze([...rawKeys]),
    definitions,
    timeoutMs:
      typeof input.timeoutMs === 'number' && input.timeoutMs > 0
        ? input.timeoutMs
        : DEFAULT_REQUEST_TIMEOUT_MS,
  };
}

/**
 * Build a deterministic input_hash for the {argumentId, schemaVersion,
 * runMode, sortedFamilies} tuple. Used by the persistence writer to
 * record a stable cache-key + audit token per run.
 *
 * Pure. Same inputs → byte-identical output (no Date.now, no randomness).
 *
 * Uses FNV-1a — same idiom as the MCP-018 adapter
 * (supabase/functions/_shared/semanticReferee/mcpAdapter.ts:70-82).
 */
export function buildBooleanObservationInputHash(input: {
  argumentId: string;
  schemaVersion: string;
  runMode: MachineObservationRunMode;
  families: ReadonlyArray<string>;
}): string {
  const sortedFamilies = [...input.families].sort().join(',');
  const composite = `${input.argumentId}|${input.schemaVersion}|${input.runMode}|${sortedFamilies}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < composite.length; i += 1) {
    hash ^= composite.charCodeAt(i);
    hash =
      (hash +
        ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>>
      0;
  }
  return `mcp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
