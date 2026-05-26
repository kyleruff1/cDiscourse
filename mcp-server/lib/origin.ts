/**
 * MCP-SERVER-001 — Origin header validation middleware.
 *
 * Per MCP spec: when the Origin header is present, validate it against the
 * server's allow-list. Empty/unset allow-list means allow everything (the
 * default; legacy MCP-018 adapter is server-to-server and does not send
 * Origin). When the allow-list is non-empty AND a request includes Origin,
 * the value must match exactly or the request is rejected.
 */
export type OriginCheckResult =
  | { ok: true }
  | { ok: false; reason: 'origin_not_allowed' };

/**
 * Parse a comma-separated allow-list value from env. Each entry is trimmed
 * of leading/trailing whitespace; empty entries are dropped. Returns a frozen
 * array.
 */
export function parseAllowedOrigins(raw: string | undefined): readonly string[] {
  if (!raw || raw.trim().length === 0) return [];
  return Object.freeze(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

/**
 * Validate the Origin header against the configured allow-list.
 *
 * Returns `{ok: true}` when:
 *   - the Origin header is absent (server-to-server callers), OR
 *   - the allow-list is empty (configured wide open), OR
 *   - the Origin value exactly matches an entry in the allow-list.
 *
 * Returns `{ok: false, reason: 'origin_not_allowed'}` when the header is
 * present AND the allow-list is non-empty AND the value is not in the list.
 */
export function validateOrigin(
  originHeader: string | null,
  allowedOrigins: readonly string[],
): OriginCheckResult {
  if (originHeader === null || originHeader.length === 0) return { ok: true };
  if (allowedOrigins.length === 0) return { ok: true };
  if (allowedOrigins.includes(originHeader)) return { ok: true };
  return { ok: false, reason: 'origin_not_allowed' };
}
