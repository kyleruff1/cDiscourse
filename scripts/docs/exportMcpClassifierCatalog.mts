/**
 * MCP-CATALOG — One-off extraction script.
 *
 * Imports the Machine Observation definition registry + the family display
 * headings + the production-enablement map + the gameCopy plain-language
 * resolver, then emits a single CSV cataloging EVERY MCP boolean classifier
 * across all 10 families with each boolean's YES/NO meaning + every
 * user-facing message/label mapped to it.
 *
 * Run with: npx tsx scripts/docs/exportMcpClassifierCatalog.mts
 *
 * Read-only against all source modules. The ONLY write is the CSV. No
 * classifier is invoked (only static definitions are read). The Deno
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
 * `productionEnabled` map is hardcoded below (A-G true, H/I/J false) with a
 * citation because that module uses Deno `.ts` import specifiers that do not
 * resolve under the Node/tsx context; an assertion guards it against the
 * canonical family list.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  _INTERNAL_ALL_DEFINITIONS,
  getDefinitionsForFamily,
} from '../../src/features/nodeLabels/machineObservationDefinitions';
import {
  ALL_MACHINE_OBSERVATION_FAMILIES,
  type MachineObservationFamily,
} from '../../src/features/nodeLabels/nodeLabelTypes';
import { HUB_CLASSIFIER_FAMILY_HEADING } from '../../src/features/arguments/detail/argumentDetailModel';
import { toPlainLanguage } from '../../src/features/arguments/gameCopy';

// ── Family letter (A-J) mapped to family code (canonical order) ──────
const FAMILY_LETTER: Record<MachineObservationFamily, string> = {
  parent_relation: 'A',
  disagreement_axis: 'B',
  misunderstanding_repair: 'C',
  evidence_source_chain: 'D',
  argument_scheme: 'E',
  critical_question: 'F',
  resolution_progress: 'G',
  claim_clarity: 'H',
  thread_topology: 'I',
  sensitive_composer: 'J',
};

// ── productionEnabled per family ────────────────────────────────────
// SOURCE (read-only): supabase/functions/_shared/booleanObservations/
//   familyRegistry.ts → FAMILY_REGISTRY. A-G productionEnabled:true;
//   H/I/J productionEnabled:false. Hardcoded here because that module uses
//   Deno `.ts` import specifiers that do not resolve under Node/tsx.
const PRODUCTION_ENABLED: Record<MachineObservationFamily, boolean> = {
  parent_relation: true, // A
  disagreement_axis: true, // B
  misunderstanding_repair: true, // C
  evidence_source_chain: true, // D
  argument_scheme: true, // E
  critical_question: true, // F
  resolution_progress: true, // G
  claim_clarity: false, // H
  thread_topology: false, // I
  sensitive_composer: false, // J
};

// Assert the productionEnabled map covers exactly the canonical family list.
for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
  if (!(family in PRODUCTION_ENABLED)) {
    throw new Error(`productionEnabled map is missing family: ${family}`);
  }
  if (!(family in FAMILY_LETTER)) {
    throw new Error(`FAMILY_LETTER map is missing family: ${family}`);
  }
  if (!(family in HUB_CLASSIFIER_FAMILY_HEADING)) {
    throw new Error(`HUB_CLASSIFIER_FAMILY_HEADING is missing family: ${family}`);
  }
}

// ── CSV helpers ─────────────────────────────────────────────────────
function csvCell(value: string): string {
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function csvRow(cells: ReadonlyArray<string>): string {
  return cells.map(csvCell).join(',');
}

const NONE = '(none)';

function orNone(v: string | null | undefined): string {
  if (v === null || v === undefined) return NONE;
  const t = String(v).trim();
  return t.length === 0 ? NONE : t;
}

// Disposition note helper.
function dispositionNote(disposition: string, family: MachineObservationFamily): string {
  const notes: string[] = [];
  if (family === 'sensitive_composer') notes.push('§10a-sensitive');
  if (!PRODUCTION_ENABLED[family]) notes.push('held-out family (production-disabled)');
  if (disposition === 'composer_only') notes.push('composer-only');
  if (disposition === 'future_source') notes.push('future-source (not rendered in v1)');
  if (disposition === 'inspect_only') notes.push('inspect-only');
  if (disposition === 'hidden_sensitive') notes.push('hidden-sensitive');
  if (disposition === 'intentionally_silent') notes.push('intentionally-silent');
  return notes.length > 0 ? notes.join('; ') : '';
}

// ── Header ──────────────────────────────────────────────────────────
const HEADER = [
  'family_letter',
  'family_code',
  'family_label',
  'family_production_enabled',
  'observation_raw_key',
  'observation_label',
  'observation_short_label',
  'disposition',
  'source',
  'definition',
  'boolean_question',
  'yes_meaning',
  'yes_label',
  'yes_message',
  'no_meaning',
  'no_message',
  'plain_language_copy',
  'mapped_messages',
  'notes',
];

// ── Build rows ──────────────────────────────────────────────────────
const lines: string[] = [csvRow(HEADER)];
const perFamilyCounts: Record<string, number> = {};
let total = 0;

for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
  const defs = getDefinitionsForFamily(family);
  perFamilyCounts[family] = defs.length;
  total += defs.length;

  const familyLetter = FAMILY_LETTER[family];
  const familyLabel = HUB_CLASSIFIER_FAMILY_HEADING[family];
  const familyProd = PRODUCTION_ENABLED[family] ? 'true' : 'false';

  for (const def of defs) {
    // Plain-language resolutions (gameCopy.toPlainLanguage). The resolver
    // normalizes the input, so it accepts a rawKey or a label.
    const plRawKey = toPlainLanguage(def.rawKey); // null when no mapping
    const plLabel = toPlainLanguage(def.label);

    // YES message = the user-facing plain-language string for the TRUE/fired
    // state, preferring the rawKey mapping, then the label mapping.
    const yesMessage = plRawKey ?? plLabel ?? null;

    // Build the distinct set of every user-facing message/label/helper mapped
    // to this classifier across the copy sources, in a stable order.
    const mappedSet = new Map<string, true>();
    const pushMapped = (v: string | null | undefined) => {
      if (v === null || v === undefined) return;
      const t = String(v).trim();
      if (t.length > 0) mappedSet.set(t, true);
    };
    pushMapped(def.label);
    pushMapped(def.shortLabel);
    pushMapped(plRawKey);
    pushMapped(plLabel);
    pushMapped(def.description);
    const mappedMessages =
      mappedSet.size > 0 ? Array.from(mappedSet.keys()).join('; ') : NONE;

    // NO meaning: the negativeDefinition. Most booleans only render when TRUE;
    // there is no negative-state copy in the copy sources, so the NO message
    // is recorded as "not observed / did not fire".
    const noMessage = 'not observed / did not fire';

    const row = [
      familyLetter,
      family,
      familyLabel,
      familyProd,
      def.rawKey,
      orNone(def.label),
      orNone(def.shortLabel),
      def.disposition,
      def.source,
      orNone(def.description),
      orNone(def.booleanQuestion),
      orNone(def.positiveDefinition),
      orNone(def.label),
      orNone(yesMessage),
      orNone(def.negativeDefinition),
      noMessage,
      orNone(plRawKey),
      mappedMessages,
      dispositionNote(def.disposition, family),
    ];
    lines.push(csvRow(row));
  }
}

// Sanity: the row count must reconcile with the registry's full count.
if (total !== _INTERNAL_ALL_DEFINITIONS.length) {
  throw new Error(
    `Row count mismatch: summed ${total} but registry has ${_INTERNAL_ALL_DEFINITIONS.length}`,
  );
}

// ── Write CSV ───────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../../docs/reference/mcp-classifier-catalog.csv');
// UTF-8, LF line endings, trailing newline.
writeFileSync(outPath, lines.join('\n') + '\n', { encoding: 'utf8' });

// ── Report ──────────────────────────────────────────────────────────
/* eslint-disable no-console */
console.log('Per-family boolean counts:');
for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
  console.log(
    `  ${FAMILY_LETTER[family]} ${family.padEnd(24)} ${perFamilyCounts[family]
      .toString()
      .padStart(3)}  productionEnabled=${PRODUCTION_ENABLED[family]}`,
  );
}
console.log(`Total booleans (data rows): ${total}`);
console.log(`CSV written to: ${outPath}`);
/* eslint-enable no-console */
