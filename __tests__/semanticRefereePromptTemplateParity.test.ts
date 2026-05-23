/**
 * MCP-MOD-003 — parity guard between the prompt-template inventory doc
 * (`docs/architecture/semantic-referee-prompt-template.md`) and the live
 * sources of the seed prompt (`anthropicClassifierCore.ts`, `seedPrompt.ts`).
 *
 * Three invariants:
 *
 *   1. The inventory's `prompt-block:system-prompt` block matches the
 *      `SEMANTIC_REFEREE_SYSTEM_PROMPT` constant byte-for-byte. A wording
 *      change in `anthropicClassifierCore.ts` without an inventory update
 *      fails this test.
 *
 *   2. The inventory's `prompt-block:user-message-instruction` block matches
 *      the strict-JSON contract paragraph emitted by `buildClassifierPrompt`
 *      byte-for-byte. The instruction text is the `.join(' ')` of the
 *      `instruction` array literal in `seedPrompt.ts`. The test extracts it
 *      from a live call to `buildClassifierPrompt` (splits the assembled
 *      prompt by the surrounding blank-line separators) and compares to the
 *      inventory.
 *
 *   3. The inventory's `prompt-block:per-id-question-sample` block matches the
 *      full output of `buildClassifierPrompt` for a fixed sample request
 *      (the first 3 ids in `ALL_SEMANTIC_CLASSIFIER_IDS`, a parent body, a
 *      move body, `debateMode: 'standard'`). This exercises the actual
 *      assembly mechanism — per-id selection, instruction join, worked
 *      example, redacted input frame — not just the static template.
 *
 * The extraction convention:
 *   - The system-prompt and user-message-instruction blocks use a TRIPLE-
 *     backtick fence (no inner backtick fences possible).
 *   - The per-id-question-sample block uses a QUADRUPLE-backtick fence
 *     because the worked-example portion of the assembled prompt has its
 *     own inner triple-backtick fence (` ```json ... ``` `). The
 *     quadruple-backtick outer fence preserves the inner triple-backtick
 *     fences as literal text.
 *
 * Pure source-scan. No network. No Supabase. No React.
 */
import fs from 'fs';
import path from 'path';
import {
  SEMANTIC_REFEREE_SYSTEM_PROMPT,
  buildClassifierPrompt,
} from './_helpers/semanticRefereeDeno';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'architecture',
  'semantic-referee-prompt-template.md',
);

function readInventory(): string {
  return fs.readFileSync(INVENTORY_PATH, 'utf8');
}

/**
 * Extract a marker-fenced block from the inventory document. `fenceTickCount`
 * is the number of backticks that delimit the block (3 or 4).
 *
 * Pattern: `<!-- prompt-block:<marker> -->\n<fence>\n<content>\n<fence>`.
 *
 * Returns the content (no trailing newline) or `null` if the marker / fence
 * cannot be located.
 */
function extractPromptBlock(
  doc: string,
  marker: string,
  fenceTickCount: number,
): string | null {
  const safeMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fence = '`'.repeat(fenceTickCount);
  // Lazy match the content between the opening fence and the next closing
  // fence at the start of a line. We anchor the closing fence to a newline
  // so a fence of the same length INSIDE the content (e.g. the worked
  // example's ` ```json ` inside the quadruple-backtick block) is preserved
  // as literal text.
  const fencePattern = fence.replace(/`/g, '\\`');
  const pattern = new RegExp(
    `<!-- prompt-block:${safeMarker} -->\\r?\\n${fencePattern}\\r?\\n([\\s\\S]*?)\\r?\\n${fencePattern}(?:\\r?\\n|$)`,
    'm',
  );
  const match = doc.match(pattern);
  if (!match) return null;
  return match[1];
}

/**
 * Build the fixed sample request used by invariants 2 and 3. Same input,
 * same output — `buildClassifierPrompt` is deterministic.
 */
function buildSampleRequest(): ClassifyMoveRequest {
  return {
    roomId: 'room-doc-sample',
    moveBodyRedacted: '[MOVE_BODY]',
    parentBodyRedacted: '[PARENT_BODY]',
    roomContext: { debateMode: 'standard' },
    requestedClassifiers: [
      'responds_to_parent',
      'introduces_new_issue',
      'asks_for_evidence',
    ],
    contentHash: 'h0',
  };
}

/**
 * Pull the strict-JSON instruction paragraph out of a full assembled prompt.
 *
 * The assembled prompt is structured as:
 *
 *   Structural questions for this move:
 *   - <id>: <question>
 *   ...
 *
 *   <instruction paragraph — single line via .join(' ')>
 *
 *   Worked example ...
 *
 * The instruction is the body between the first blank line after the
 * question list and the next blank line. We pick it out by splitting on
 * the double-newline separator the assembly uses.
 */
function extractInstructionFromAssembled(assembled: string): string {
  const parts = assembled.split(/\n\n/);
  // parts[0] is "Structural questions for this move:\n- ..."
  // parts[1] is the instruction paragraph
  // parts[2] is the worked example
  // parts[3] is the redacted input block
  if (parts.length < 4) {
    throw new Error(
      `assembled prompt did not split into >= 4 parts on double newlines (got ${parts.length})`,
    );
  }
  return parts[1];
}

describe('prompt-template inventory parity (MCP-MOD-003)', () => {
  const doc = readInventory();

  // ── Invariant 1 — system prompt ────────────────────────────────

  it('the system-prompt block matches SEMANTIC_REFEREE_SYSTEM_PROMPT byte-for-byte', () => {
    const block = extractPromptBlock(doc, 'system-prompt', 3);
    expect(block).not.toBeNull();
    expect(block).toBe(SEMANTIC_REFEREE_SYSTEM_PROMPT);
  });

  it('locates the system-prompt marker in the inventory document', () => {
    expect(doc).toContain('<!-- prompt-block:system-prompt -->');
  });

  // ── Invariant 2 — user-message instruction ─────────────────────

  it('the user-message-instruction block matches the live strict-JSON paragraph byte-for-byte', () => {
    const block = extractPromptBlock(doc, 'user-message-instruction', 3);
    expect(block).not.toBeNull();
    const assembled = buildClassifierPrompt(buildSampleRequest());
    const liveInstruction = extractInstructionFromAssembled(assembled);
    expect(block).toBe(liveInstruction);
  });

  it('locates the user-message-instruction marker in the inventory document', () => {
    expect(doc).toContain('<!-- prompt-block:user-message-instruction -->');
  });

  // ── Invariant 3 — per-id question assembly ─────────────────────

  it('the per-id-question-sample block matches the full assembled prompt for the fixed sample request', () => {
    const block = extractPromptBlock(doc, 'per-id-question-sample', 4);
    expect(block).not.toBeNull();
    const assembled = buildClassifierPrompt(buildSampleRequest());
    expect(block).toBe(assembled);
  });

  it('locates the per-id-question-sample marker in the inventory document', () => {
    expect(doc).toContain('<!-- prompt-block:per-id-question-sample -->');
  });

  // ── Structural sanity — all three markers present ──────────────

  it('renders all three prompt-block markers (no missing section)', () => {
    const markers = [
      'system-prompt',
      'user-message-instruction',
      'per-id-question-sample',
    ];
    const missing: string[] = [];
    for (const marker of markers) {
      if (!doc.includes(`<!-- prompt-block:${marker} -->`)) {
        missing.push(marker);
      }
    }
    expect(missing).toEqual([]);
  });
});
