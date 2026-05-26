/**
 * MCP-SERVER-001 — MCP-Protocol-Version header handling.
 *
 * Targeted version: 2025-11-25 (the latest stable as of authoring).
 * - Always echo the server's targeted version in the response header.
 * - When the client sends an unknown or older version, log a structured
 *   warning and continue serving with 2025-11-25 semantics. (v1 does not
 *   downgrade response shapes.)
 */
export const MCP_TARGETED_PROTOCOL_VERSION = '2025-11-25';

/**
 * Known versions of the MCP spec the server has been explicitly tested
 * against. Any version not listed here is treated as "unknown" and the server
 * emits a warning log entry; the request still proceeds.
 */
export const MCP_KNOWN_PROTOCOL_VERSIONS: readonly string[] = ['2025-11-25', '2025-06-18'];

export interface ProtocolVersionDecision {
  /** The version echoed in the response header (always the targeted version). */
  echoVersion: string;
  /** Whether to emit a structured warning log entry. */
  warn: boolean;
  /** A short reason code suitable for the warning log entry. */
  warnReason?: 'unknown_version' | 'older_known_version';
}

export function evaluateProtocolVersion(
  clientHeader: string | null,
): ProtocolVersionDecision {
  if (clientHeader === null || clientHeader.length === 0) {
    return { echoVersion: MCP_TARGETED_PROTOCOL_VERSION, warn: false };
  }
  if (clientHeader === MCP_TARGETED_PROTOCOL_VERSION) {
    return { echoVersion: MCP_TARGETED_PROTOCOL_VERSION, warn: false };
  }
  if (MCP_KNOWN_PROTOCOL_VERSIONS.includes(clientHeader)) {
    return {
      echoVersion: MCP_TARGETED_PROTOCOL_VERSION,
      warn: true,
      warnReason: 'older_known_version',
    };
  }
  return {
    echoVersion: MCP_TARGETED_PROTOCOL_VERSION,
    warn: true,
    warnReason: 'unknown_version',
  };
}
