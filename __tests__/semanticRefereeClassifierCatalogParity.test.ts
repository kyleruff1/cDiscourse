/**
 * MCP-MOD-002 / MCP-MOD-005 — parity guard between the classifier-catalog
 * inventory doc (`docs/architecture/semantic-referee-classifier-catalog.md`)
 * and the authoritative semantic-referee catalog
 * (`supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts`).
 *
 * Two invariants:
 *
 *   1. Every id in `ALL_SEMANTIC_CLASSIFIER_IDS` appears as a section heading
 *      in the inventory doc. A future catalog change without a doc update
 *      fails this test.
 *
 *   2. For every id, the AI question rendered inside the inventory's
 *      `<!-- ai-question:<id> -->` marker matches the catalog's
 *      `structuralQuestion` field byte-for-byte. A wording change to a
 *      question without a doc update fails this test. (Post-MCP-MOD-005 the
 *      catalog IS the source of truth; the previous `CLASSIFIER_QUESTION_TEXT`
 *      indirection was removed.)
 *
 * The extraction convention is documented in the inventory doc's "How to read
 * each section" intro: each section's AI question is rendered in a fenced
 * code block immediately under a `<!-- ai-question:<id> -->` HTML comment.
 * The regex `<!-- ai-question:(id) -->\n```(\n)([\s\S]*?)(\n)```` matches.
 *
 * Pure source-scan. No network. No Supabase. No React.
 */
import fs from 'fs';
import path from 'path';
import {
  DENO_CATALOG_BY_ID,
  DENO_ALL_SEMANTIC_CLASSIFIER_IDS,
} from './_helpers/semanticRefereeDeno';

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(
  REPO_ROOT,
  'docs',
  'architecture',
  'semantic-referee-classifier-catalog.md',
);

function readInventory(): string {
  return fs.readFileSync(INVENTORY_PATH, 'utf8');
}

/**
 * Extract the AI-question text for one classifier id from the inventory doc.
 * Returns `null` when the marker or its following fenced code block cannot be
 * located.
 */
function extractAiQuestion(doc: string, id: string): string | null {
  // Escape regex metacharacters in the id (every id is snake_case alphanumeric
  // today, but stay defensive).
  const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<!-- ai-question:${safeId} -->\\r?\\n\\\`\\\`\\\`\\r?\\n([\\s\\S]*?)\\r?\\n\\\`\\\`\\\``,
    'm',
  );
  const match = doc.match(pattern);
  if (!match) return null;
  return match[1];
}

describe('classifier-catalog inventory parity (MCP-MOD-002)', () => {
  const doc = readInventory();

  it('has a section heading for every id in ALL_SEMANTIC_CLASSIFIER_IDS', () => {
    const missing: string[] = [];
    for (const id of DENO_ALL_SEMANTIC_CLASSIFIER_IDS) {
      // Section headings render as "### `<id>`" — backtick-delimited at the
      // start of a level-3 heading line.
      const headingPattern = new RegExp(`^### \\\`${id}\\\`\\s*$`, 'm');
      if (!headingPattern.test(doc)) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('catalogs exactly 23 classifier ids — no more, no fewer', () => {
    // Independent sanity check; MCP-MOD-002 design §3 freezes catalog v0 at 23.
    expect(DENO_ALL_SEMANTIC_CLASSIFIER_IDS.length).toBe(23);
  });

  it('renders every AI question byte-for-byte the same as the catalog structuralQuestion', () => {
    const mismatches: Array<{
      id: string;
      expected: string;
      actual: string | null;
    }> = [];
    for (const id of DENO_ALL_SEMANTIC_CLASSIFIER_IDS) {
      const entry = DENO_CATALOG_BY_ID.get(id);
      const expected = entry?.structuralQuestion ?? '';
      const actual = extractAiQuestion(doc, id);
      if (actual === null || actual !== expected) {
        mismatches.push({ id, expected, actual });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('renders the AI question for every id (no missing marker / fenced block)', () => {
    const missing: string[] = [];
    for (const id of DENO_ALL_SEMANTIC_CLASSIFIER_IDS) {
      if (extractAiQuestion(doc, id) === null) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
  });
});
