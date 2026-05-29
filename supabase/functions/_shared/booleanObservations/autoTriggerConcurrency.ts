/**
 * OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Auto-trigger concurrency policy.
 *
 * Maximum number of family iterations dispatched concurrently. D1: chosen
 * for SAFETY (rate-limit headroom + simple reasoning), not throughput-
 * optimality. A bump to 3 is a 1-line PR gated on the measured 429 rate
 * at 2 (smoke Phase 4c). A CONSTANT — NOT an env var — so it is auditable
 * and rollback-via-PR. Lives in its own pure module (zero imports) so it
 * is importable by BOTH the dispatcher (which is not Jest-loadable) and
 * the concurrency tests (via the Jest bridge), satisfying D7.
 */
export const MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2;
