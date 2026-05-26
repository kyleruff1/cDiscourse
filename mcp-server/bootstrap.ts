/**
 * MCP-SERVER-001 — Side-effect module that wires route handlers.
 *
 * Imported by main.ts for its side effect of calling
 * `registerRouteHandlers`. Keeping the registration out of server.ts (and
 * out of main.ts proper) avoids a circular import between server.ts and
 * routes/mcp.ts.
 */
import { registerRouteHandlers } from './server.ts';
import { handleMcp } from './routes/mcp.ts';
import { handleAdapterCompat } from './routes/adapterCompat.ts';

registerRouteHandlers({
  mcp: handleMcp,
  adapterCompat: handleAdapterCompat,
});
