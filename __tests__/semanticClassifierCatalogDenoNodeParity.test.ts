/**
 * MCP-MOD-004 / MCP-MOD-006 — Node ↔ Deno semantic-classifier-catalog parity.
 *
 * `semanticClassifierCatalog.ts` lives in two places: the Node-side source of
 * truth at `src/lib/constitution/semanticClassifierCatalog.ts` and the
 * Deno-side mirror at
 * `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts`.
 *
 * The Deno boundary's `seedPrompt.ts` consumes the Deno mirror's catalog
 * directly (it cannot import the Node file — Deno needs `.ts`-extension
 * specifiers; the Node toolchain forbids them). This test reads BOTH files AS
 * SOURCE TEXT and fails the build if the per-id catalog entry literals drift.
 *
 * Post-MCP-MOD-006: the catalog now also carries `bannerCodePriorityList` and
 * `ledgerCategories` per entry. The byte-identical span comparison covers
 * those fields automatically; dedicated extractors (`extractBannerPriorityLists`,
 * `extractLedgerCategoriesLists`) add per-field assertions for clearer
 * diagnostics on drift.
 *
 * Mirrors the existing pattern from
 * `__tests__/semanticAnthropicContentScanParity.test.ts` — extract bounded
 * source spans, normalise whitespace boundaries, compare.
 */
import * as fs from 'fs';
import * as path from 'path';

const NODE_CATALOG_PATH = path.join(
  process.cwd(),
  'src/lib/constitution/semanticClassifierCatalog.ts',
);
const DENO_CATALOG_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts',
);

const nodeSrc = fs.readFileSync(NODE_CATALOG_PATH, 'utf8');
const denoSrc = fs.readFileSync(DENO_CATALOG_PATH, 'utf8');

/**
 * Extract the `SEMANTIC_CLASSIFIER_CATALOG` array span from a source file —
 * everything between `Object.freeze([` and the matching `]);` immediately
 * following the array. The 35 entries (catalog v1, post-MCP-CAT-001) live
 * inside this span. Used to compare just the catalog literals, ignoring
 * boilerplate / imports / comments.
 */
function extractCatalogSpan(src: string): string {
  const startMarker = /SEMANTIC_CLASSIFIER_CATALOG[^=]*=\s*\n?\s*Object\.freeze\(\[\s*\n/;
  const match = startMarker.exec(src);
  if (!match) {
    throw new Error('could not find SEMANTIC_CLASSIFIER_CATALOG declaration');
  }
  const startIdx = match.index + match[0].length;
  // Walk forward to find the matching `]);` that closes the array. The closing
  // is `  ]);` at the same indent level — i.e. preceded by exactly two spaces.
  const closeMarker = /\n\s*\]\);/g;
  closeMarker.lastIndex = startIdx;
  const closeMatch = closeMarker.exec(src);
  if (!closeMatch) {
    throw new Error('could not find closing `]);` for SEMANTIC_CLASSIFIER_CATALOG');
  }
  return src.slice(startIdx, closeMatch.index);
}

/**
 * Extract every `id: '<value>',` literal in declaration order. The catalog has
 * 35 entries (catalog v1) so the result should have 35 strings.
 */
function extractIdLiterals(span: string): string[] {
  return Array.from(span.matchAll(/\bid:\s*'([^']+)'/g)).map((m) => m[1]);
}

/**
 * Extract every `bannerCode: <value>,` literal (a string OR `null`).
 * Returns one entry per catalog row, in declaration order.
 */
function extractBannerCodes(span: string): Array<string | null> {
  return Array.from(span.matchAll(/\bbannerCode:\s*(?:'([^']+)'|(null))\s*,/g)).map((m) =>
    m[1] !== undefined ? m[1] : null,
  );
}

/**
 * Extract every `ledgerFeedbackCode: <value>,` literal (a string OR `null`).
 * Returns one entry per catalog row, in declaration order.
 */
function extractLedgerCodes(span: string): Array<string | null> {
  return Array.from(
    span.matchAll(/\bledgerFeedbackCode:\s*(?:'([^']+)'|(null))\s*,/g),
  ).map((m) => (m[1] !== undefined ? m[1] : null));
}

/**
 * Extract every `family: '<value>',` literal in declaration order.
 */
function extractFamilies(span: string): string[] {
  return Array.from(span.matchAll(/\bfamily:\s*'([^']+)'/g)).map((m) => m[1]);
}

/**
 * Extract every `bannerCodePriorityList: Object.freeze([...]),` literal in
 * declaration order. Returns one array of string literals per catalog row,
 * preserving the inner ordering. (MCP-MOD-006.)
 */
function extractBannerPriorityLists(span: string): Array<string[]> {
  const re = /\bbannerCodePriorityList:\s*Object\.freeze\(\s*\[([^\]]*)\]\s*\)/g;
  const out: Array<string[]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(span)) !== null) {
    const inner = m[1];
    out.push(Array.from(inner.matchAll(/'([^']+)'/g)).map((s) => s[1]));
  }
  return out;
}

/**
 * Extract every `ledgerCategories: Object.freeze([...]),` literal in
 * declaration order. (MCP-MOD-006.)
 */
function extractLedgerCategoriesLists(span: string): Array<string[]> {
  const re = /\bledgerCategories:\s*Object\.freeze\(\s*\[([^\]]*)\]\s*\)/g;
  const out: Array<string[]> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(span)) !== null) {
    const inner = m[1];
    out.push(Array.from(inner.matchAll(/'([^']+)'/g)).map((s) => s[1]));
  }
  return out;
}

describe('semantic classifier catalog — Node ↔ Deno source-text parity', () => {
  it('both source files exist', () => {
    expect(fs.existsSync(NODE_CATALOG_PATH)).toBe(true);
    expect(fs.existsSync(DENO_CATALOG_PATH)).toBe(true);
  });

  it('both files contain a SEMANTIC_CLASSIFIER_CATALOG declaration with the same 35 ids in the same order', () => {
    const nodeSpan = extractCatalogSpan(nodeSrc);
    const denoSpan = extractCatalogSpan(denoSrc);
    const nodeIds = extractIdLiterals(nodeSpan);
    const denoIds = extractIdLiterals(denoSpan);
    expect(nodeIds).toHaveLength(35);
    expect(denoIds).toHaveLength(35);
    expect(nodeIds).toEqual(denoIds);
  });

  it('the catalog span is byte-identical between the Node and Deno files', () => {
    // The two files share the catalog span verbatim — only the surrounding
    // imports / module-level boilerplate differ. A drift in any per-id literal
    // (binarySignal, structuralQuestion, family, bannerCode, ledgerFeedbackCode)
    // fails here.
    const nodeSpan = extractCatalogSpan(nodeSrc);
    const denoSpan = extractCatalogSpan(denoSrc);
    expect(denoSpan).toBe(nodeSpan);
  });

  it('every per-id bannerCode literal matches between the Node and Deno files', () => {
    const nodeCodes = extractBannerCodes(extractCatalogSpan(nodeSrc));
    const denoCodes = extractBannerCodes(extractCatalogSpan(denoSrc));
    expect(nodeCodes).toHaveLength(35);
    expect(denoCodes).toHaveLength(35);
    expect(denoCodes).toEqual(nodeCodes);
  });

  it('every per-id ledgerFeedbackCode literal matches between the Node and Deno files', () => {
    const nodeCodes = extractLedgerCodes(extractCatalogSpan(nodeSrc));
    const denoCodes = extractLedgerCodes(extractCatalogSpan(denoSrc));
    expect(nodeCodes).toHaveLength(35);
    expect(denoCodes).toHaveLength(35);
    expect(denoCodes).toEqual(nodeCodes);
  });

  it('every per-id family literal matches between the Node and Deno files', () => {
    const nodeFamilies = extractFamilies(extractCatalogSpan(nodeSrc));
    const denoFamilies = extractFamilies(extractCatalogSpan(denoSrc));
    expect(nodeFamilies).toHaveLength(35);
    expect(denoFamilies).toHaveLength(35);
    expect(denoFamilies).toEqual(nodeFamilies);
  });

  it('every per-id bannerCodePriorityList literal matches between the Node and Deno files (MCP-MOD-006)', () => {
    const nodeLists = extractBannerPriorityLists(extractCatalogSpan(nodeSrc));
    const denoLists = extractBannerPriorityLists(extractCatalogSpan(denoSrc));
    expect(nodeLists).toHaveLength(35);
    expect(denoLists).toHaveLength(35);
    expect(denoLists).toEqual(nodeLists);
  });

  it('every per-id ledgerCategories literal matches between the Node and Deno files (MCP-MOD-006)', () => {
    const nodeLists = extractLedgerCategoriesLists(extractCatalogSpan(nodeSrc));
    const denoLists = extractLedgerCategoriesLists(extractCatalogSpan(denoSrc));
    expect(nodeLists).toHaveLength(35);
    expect(denoLists).toHaveLength(35);
    expect(denoLists).toEqual(nodeLists);
  });

  it('the Node file imports SemanticClassifierId from the features tree (not the Deno mirror)', () => {
    expect(nodeSrc).toMatch(
      /from\s+'\.\.\/\.\.\/features\/semanticReferee\/semanticRefereeTypes'/,
    );
  });

  it("the Deno file imports SemanticClassifierId from its sibling types.ts (with the .ts extension Deno requires)", () => {
    expect(denoSrc).toMatch(/from\s+'\.\/types\.ts'/);
  });
});
