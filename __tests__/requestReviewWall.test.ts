/**
 * REF-005 — the wall (design §7 / §11).
 *
 * Three objects, three modules, no shared registry:
 *   - Machine Observation  (nodeLabels/machineObservationRegistry)
 *   - Gameplay Allegation   (nodeLabels/userAllegationRegistry + metadata ledger)
 *   - Moderation concern    (requestReview — THIS card)
 *
 * This suite proves they never cross-contaminate:
 *   1. The `requestReview` module imports nothing from `nodeLabels/`
 *      registries or `moveMetadataLedger`, and emits no `NodeLabelMark`.
 *   2. A `StructuredConcernDraft` is structurally NOT a `NodeLabelMark` and
 *      is never produced by / passed to a node-label adapter.
 *   3. `needs_source` / `needs_quote` exist as BOTH a `ReviewConcernType`
 *      (moderation) and a `ManualTagCode` (gameplay) — distinct objects from
 *      distinct modules with distinct lifecycles.
 *
 * Pure TS — source scan + provenance assertions.
 */
import fs from 'fs';
import path from 'path';
import {
  ALL_REVIEW_CONCERN_TYPES,
  buildSubmittableConcern,
} from '../src/features/requestReview/requestReviewModel';
import { ALL_MANUAL_TAG_CODES } from '../src/features/metadata';

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

// Strip block + line comments so a scan inspects CODE, not prose (the
// repo's ConcessionListSection.test.tsx / FistBumpReaction.test.tsx pattern).
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const REQUEST_REVIEW_FILES = [
  'src/features/requestReview/requestReviewModel.ts',
  'src/features/requestReview/RequestReviewComposer.tsx',
  'src/features/requestReview/index.ts',
];

// ── 1. The requestReview module imports no node-label / ledger registry ──

describe('REF-005 wall — requestReview imports nothing from the other two objects', () => {
  it('imports nothing from nodeLabels/ or the metadata ledger', () => {
    for (const rel of REQUEST_REVIEW_FILES) {
      const src = stripComments(read(rel));
      // No import statement reaches into the other two objects' modules.
      const imports = src.match(/from\s+['"][^'"]+['"]/g) ?? [];
      for (const imp of imports) {
        expect({ rel, imp, bad: /nodeLabels|moveMetadataLedger|userAllegationRegistry|machineObservationRegistry/.test(imp) }).toEqual(
          { rel, imp, bad: false },
        );
      }
    }
  });

  it('emits no NodeLabelMark and constructs no node-label mark fields', () => {
    for (const rel of REQUEST_REVIEW_FILES) {
      const src = stripComments(read(rel));
      expect({ rel, mark: src.includes('NodeLabelMark') }).toEqual({ rel, mark: false });
      // A moderation concern carries no rawKey / mark kind / mark source.
      expect({ rel, rawKey: /\brawKey\b/.test(src) }).toEqual({ rel, rawKey: false });
    }
  });
});

// ── 2. The other two objects do not import requestReview ────────

describe('REF-005 wall — the other two objects do not import requestReview', () => {
  it('the metadata ledger + node-label registries never import requestReview', () => {
    const files = [
      'src/features/metadata/moveMetadataLedger.ts',
      'src/features/nodeLabels/userAllegationRegistry.ts',
    ];
    for (const rel of files) {
      const src = read(rel);
      expect({ rel, hit: src.includes('requestReview') }).toEqual({ rel, hit: false });
    }
  });
});

// ── 3. A concern draft is structurally NOT a NodeLabelMark ──────

describe('REF-005 wall — StructuredConcernDraft is a distinct shape', () => {
  it('a built concern draft has concern fields and none of the NodeLabelMark fields', () => {
    const draft = buildSubmittableConcern({
      targetNodeId: 'n1',
      targetQuote: 'a passage',
      concernType: 'needs_source',
      requestedRemedy: 'ask_source',
    });
    expect(draft).not.toBeNull();
    // Concern shape.
    expect(Object.keys(draft!).sort()).toEqual(
      ['concernType', 'requestedRemedy', 'targetNodeId', 'targetQuote', 'visibility'].sort(),
    );
    // NodeLabelMark fields are absent — it cannot be mistaken for a mark.
    for (const markField of ['rawKey', 'kind', 'source', 'shortLabel', 'defaultSurface', 'disposition']) {
      expect({ markField, present: markField in draft! }).toEqual({ markField, present: false });
    }
  });
});

// ── 4. Distinct provenance for the name-overlap codes ───────────

describe('REF-005 wall — needs_source / needs_quote are distinct objects', () => {
  it('both names exist as a ReviewConcernType AND a ManualTagCode', () => {
    for (const name of ['needs_source', 'needs_quote'] as const) {
      expect(ALL_REVIEW_CONCERN_TYPES).toContain(name);
      expect(ALL_MANUAL_TAG_CODES).toContain(name);
    }
  });

  it('the two vocabularies are distinct constants from distinct modules', () => {
    // Different array references — they are not the same object accidentally
    // shared between the gameplay-allegation and moderation-concern objects.
    expect(ALL_REVIEW_CONCERN_TYPES as unknown).not.toBe(ALL_MANUAL_TAG_CODES as unknown);
    // The moderation vocabulary carries person-directed concern types the
    // gameplay-tag vocabulary does not (proving they are not the same set).
    expect(ALL_REVIEW_CONCERN_TYPES).toContain('harassment_concern');
    expect(ALL_MANUAL_TAG_CODES as readonly string[]).not.toContain('harassment_concern');
  });
});
