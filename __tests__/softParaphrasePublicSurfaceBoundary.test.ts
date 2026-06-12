/**
 * OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — File 4 of 4 (jest).
 *
 * The mechanical companion to the design's §2.3 rendering-surface boundary.
 * Read-only registry + source scans — this file NEVER modifies any file it
 * reads. It pins the PUBLIC blast-radius statement that makes the soft-survivor
 * residual matter:
 *
 *   - A–I production families render their dispositions PUBLICLY
 *     (defaultSurface 'timeline_node', disposition 'rendered_now') — a surviving
 *     soft-paraphrase span on such a key renders as an Observation on the
 *     TARGET's node (public blast radius).
 *   - Family J's sensitive keys are composer-only (disposition 'composer_only')
 *     — never on a target node; that double-containment (+ admin-validation-only
 *     posture) is why the J soft survivor has effectively zero public reach.
 *   - The Edge sanitizer is NOT a second ban-scan backstop: a soft survivor
 *     that reaches the Edge is not caught there (the sanitizer drops only
 *     unknown rawKeys + sub-floor confidence, then truncates).
 *
 * Doctrine (cdiscourse-doctrine §10a): asserts dispositions only — no user-facing
 * copy, no truth/verdict labels. The card characterizes the boundary; it does
 * NOT close the soft residual (see design §5).
 */
import * as fs from 'fs';
import * as path from 'path';
import { FAMILY_A_DEFINITIONS } from '../src/features/nodeLabels/machineObservationDefinitions/familyA';
import { FAMILY_J_DEFINITIONS } from '../src/features/nodeLabels/machineObservationDefinitions/familyJ';

const REPO = process.cwd();
const EDGE_SCHEMA_PATH = path.join(REPO, 'src/features/nodeLabels/mcpBooleanObservationSchema.ts');

/** Strip TS line + block comments so source scans hit executable code only. */
function stripTsComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const byRawKey = (
  defs: ReadonlyArray<{ rawKey: string; defaultSurface: string; disposition: string }>,
  rawKey: string,
) => defs.find((d) => d.rawKey === rawKey);

describe('OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — public-surface boundary (§2.3)', () => {
  // PSB-public ×2 — a representative A–I rawKey renders publicly on the target
  // node, so a surviving soft-paraphrase span on it has public blast radius.
  it('PSB-public — Family A `has_rebuttal` renders publicly (timeline_node / rendered_now)', () => {
    const def = byRawKey(FAMILY_A_DEFINITIONS, 'has_rebuttal');
    expect(def).toBeDefined();
    expect(def!.defaultSurface).toBe('timeline_node');
    expect(def!.disposition).toBe('rendered_now');
  });

  it('PSB-public — Family A `rebutted` renders publicly (timeline_node / rendered_now)', () => {
    const def = byRawKey(FAMILY_A_DEFINITIONS, 'rebutted');
    expect(def).toBeDefined();
    expect(def!.defaultSurface).toBe('timeline_node');
    expect(def!.disposition).toBe('rendered_now');
  });

  // PSB-composer-only ×1 — J's three sensitive keys never mount on a target
  // node; their composer-only disposition contains the J soft survivor.
  it('PSB-composer-only — Family J sensitive keys are composer_only (never on a target node)', () => {
    const sensitiveKeys = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
    ];
    for (const rawKey of sensitiveKeys) {
      const def = byRawKey(FAMILY_J_DEFINITIONS, rawKey);
      expect(def).toBeDefined();
      expect(def!.disposition).toBe('composer_only');
    }
  });

  // PSB-edge-no-ban-scan ×1 — the Edge sanitizer is not a second backstop, so a
  // soft survivor that reaches the Edge is not caught there.
  it('PSB-edge-no-ban-scan — sanitizeMcpBooleanObservationResponse source references no ban-scan', () => {
    const code = stripTsComments(fs.readFileSync(EDGE_SCHEMA_PATH, 'utf8'));
    // The function must exist in the file we are scanning (guards against a
    // moved/renamed sanitizer silently passing the negative assertions).
    expect(code).toMatch(/export function sanitizeMcpBooleanObservationResponse/);
    // It performs NO ban-list scan: no scanFamily* import/call, no
    // DOCTRINE_BAN_PATTERNS reference anywhere in executable code.
    expect(code).not.toMatch(/scanFamily/);
    expect(code).not.toMatch(/DOCTRINE_BAN_PATTERNS/);
  });
});
