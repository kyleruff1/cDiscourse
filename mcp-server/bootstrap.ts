/**
 * MCP-SERVER-001 — Side-effect module that wires route handlers.
 *
 * Commit 1 ships this file empty (no-op). Commit 2 + 3 + 4 add
 * `registerRouteHandlers({ mcp, adapterCompat })` calls here. Keeping the
 * registration out of server.ts (and out of main.ts proper) avoids a
 * circular import between server.ts and routes/mcp.ts.
 */
// No-op in commit 1 — /mcp and /mcp/adapter-compat return 503 until handlers
// register themselves in subsequent commits.
export {};
