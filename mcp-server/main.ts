/**
 * MCP-SERVER-001 — Entry point.
 *
 * Bootstrap the HTTP server using Deno's native `Deno.serve`. The actual
 * request dispatch lives in `server.ts`; this file is the thinnest possible
 * wrapper that registers the route handlers and starts listening.
 *
 * Commit 1 starts the server with /health wired; /mcp and /mcp/adapter-compat
 * return 503 until commit 2 registers the real handlers (via a side-effect
 * import of `./bootstrap.ts`).
 */
import { handleRequest, readPort } from './server.ts';
import { log } from './lib/logging.ts';
// Side-effect import: bootstrap.ts calls registerRouteHandlers().
import './bootstrap.ts';

if (import.meta.main) {
  const port = readPort();
  log('info', 'server_start', {
    endpoint: 'server',
    httpStatus: 0,
    status: 'success',
    reason: `listening_on_port_${port}`,
  });
  Deno.serve({ port }, handleRequest);
}
