/**
 * QOL-030 — One-box composer copy ban-list scan.
 *
 * Design §9 test plan: "Doctrine ban-list scan over every produced label."
 *
 * The two pure QOL-030 models (`boxModel`, `actPopoutModel`) and the
 * `OneBox` component author ~43 user-facing strings — every box-type chip
 * label, every schema-kind notice, every flash-menu group heading, and
 * every flash-menu entry `label` + `accessibilityLabel`. This suite is the
 * regression guard the design mandates: it collects ALL of them and applies
 * the existing `_forbiddenBoxTokens()` helper (verdict + amplification
 * tokens) as a hard scan. Zero matches allowed.
 *
 * It also closes the design §9 "Source scan" checklist item — a one-line
 * source-read confirming `boxModel.ts` / `actPopoutModel.ts` import no
 * React / Supabase / network primitive (the chassis test already does this
 * for the three `.tsx` chassis files; the two pure models were the gap).
 *
 * Five in-tree comments (`boxModel.ts` `_forbiddenBoxTokens`,
 * `actPopoutModel.ts` `ACT_ENTRY_DEFINITIONS`, `OneBox.tsx`
 * `BOX_TYPE_LABEL`, `boxModel.test.ts`, `actPopoutModel.test.ts`) cite this
 * file by name — this is that file.
 *
 * `BOX_TYPE_LABEL` + `SCHEMA_KIND_NOTICE` live in `OneBox.tsx`, which
 * value-imports `ArgumentComposer` (→ AsyncStorage); a pure-TS test cannot
 * value-import it. Both are therefore SOURCE-SCANNED — the same pattern
 * `oneBoxPopoutChassis.test.tsx` / `composerDockInRoom.test.ts` use for
 * `OneBox.tsx`. The two pure models ARE value-imported.
 *
 * Mirrors `channelCopyBanList.test.ts` / `argumentModeBanList.test.ts` —
 * the precedent doctrine safety suites. Pure-TS — no React, no Supabase,
 * no network.
 */
import fs from 'fs';
import path from 'path';
import {
  ALL_BOX_TYPES,
  ALL_SCHEMA_KINDS,
  _forbiddenBoxTokens,
} from '../src/features/arguments/oneBox/boxModel';
import {
  ACT_GROUP_ORDER,
  ACT_GROUP_LABEL,
  ALL_ACT_ENTRY_IDS,
  _debug,
} from '../src/features/arguments/oneBox/actPopoutModel';
import {
  GO_GROUP_ORDER,
  GO_GROUP_LABEL,
  GO_DISABLED_REASON,
  ALL_GO_ENTRY_IDS,
  _debug as _goDebug,
} from '../src/features/arguments/oneBox/goPopoutModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Source reads ───────────────────────────────────────────────

const ONEBOX_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox');
const ONEBOX_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'OneBox.tsx'), 'utf8');
const BOX_MODEL_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'boxModel.ts'), 'utf8');
const ACT_MODEL_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'actPopoutModel.ts'), 'utf8');

/**
 * Strips `/* … *​/` block comments and `// …` line comments from source so
 * the §5 import-purity scans inspect real CODE only — a doctrine comment
 * that *names* a forbidden primitive ("no `Date.now()`", "never imports
 * `supabase`") must not register as a usage. This is the same hazard the
 * `_forbiddenBoxTokens` comment in `boxModel.ts` calls out for the
 * terminology audit.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Pulls the `key: 'value',` pairs out of a frozen object-literal block of
 * `OneBox.tsx` — the source-scan pattern the chassis test uses. The block
 * is delimited by the `const <name>` declaration and the next sentinel.
 */
function extractStringRecord(declaration: string, endSentinel: string): Map<string, string> {
  const start = ONEBOX_SRC.indexOf(declaration);
  if (start < 0) throw new Error(`extractStringRecord: "${declaration}" not found in OneBox.tsx`);
  const end = ONEBOX_SRC.indexOf(endSentinel, start);
  const block = ONEBOX_SRC.slice(start, end < 0 ? undefined : end);
  const out = new Map<string, string>();
  const re = /(\w+):\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out.set(m[1], m[2]);
  }
  return out;
}

/** The 12 box-type chip labels — `export const BOX_TYPE_LABEL` in OneBox.tsx. */
function boxTypeLabels(): Map<string, string> {
  return extractStringRecord('export const BOX_TYPE_LABEL', '/**');
}

/** The 4 schema-kind notices — module-private `SCHEMA_KIND_NOTICE` in OneBox.tsx. */
function schemaKindNotices(): Map<string, string> {
  return extractStringRecord('const SCHEMA_KIND_NOTICE', '// ── Component');
}

// ── Collect every produced QOL-030 user-facing string ──────────

/**
 * Every user-facing string the QOL-030 box + flash menu can render:
 *  - `BOX_TYPE_LABEL` — 12 box-type chip labels (source-scanned).
 *  - `SCHEMA_KIND_NOTICE` — 4 schema-kind helper lines (source-scanned).
 *  - `ACT_GROUP_LABEL` — 6 flash-menu group headings.
 *  - `ACT_ENTRY_DEFINITIONS` — 21 `label` + 21 `accessibilityLabel` pairs.
 */
function collectProducedStrings(): { where: string; value: string }[] {
  const out: { where: string; value: string }[] = [];

  // 1. Box-type chip labels (OneBox.tsx — source-scanned).
  for (const [type, label] of boxTypeLabels()) {
    out.push({ where: `BOX_TYPE_LABEL.${type}`, value: label });
  }

  // 2. Schema-kind notices (OneBox.tsx — source-scanned).
  for (const [kind, text] of schemaKindNotices()) {
    out.push({ where: `SCHEMA_KIND_NOTICE.${kind}`, value: text });
  }

  // 3. Flash-menu group headings (actPopoutModel.ts — value-imported).
  for (const groupId of ACT_GROUP_ORDER) {
    out.push({ where: `ACT_GROUP_LABEL.${groupId}`, value: ACT_GROUP_LABEL[groupId] });
  }

  // 4. Flash-menu entry labels + accessibility labels (via _debug).
  for (const id of ALL_ACT_ENTRY_IDS) {
    const def = _debug.ACT_ENTRY_DEFINITIONS[id];
    out.push({ where: `ACT_ENTRY_DEFINITIONS.${id}.label`, value: def.label });
    out.push({
      where: `ACT_ENTRY_DEFINITIONS.${id}.accessibilityLabel`,
      value: def.accessibilityLabel,
    });
  }

  return out;
}

const PRODUCED = collectProducedStrings();
const BANNED = _forbiddenBoxTokens();

/**
 * Short everyday-English verdict words scanned with word boundaries to
 * avoid false hits ("a record stays true to its source", "the right
 * panel"). Substring tokens are unambiguous and scanned plainly.
 */
const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'won',
  'lost',
  'right',
  'wrong',
  'correct',
  'incorrect',
  'proof',
  'proven',
  'shares',
  'likes',
]);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

// ── 1. The ban-list scan ───────────────────────────────────────

describe('QOL-030 one-box copy — doctrine ban-list scan', () => {
  it('the _forbiddenBoxTokens list is non-empty and all lowercase', () => {
    expect(BANNED.length).toBeGreaterThan(0);
    for (const t of BANNED) expect(t).toBe(t.toLowerCase());
  });

  it('source-scans all 12 box-type labels + all 4 schema-kind notices', () => {
    // The two source-scans found a complete record — every BoxType /
    // SchemaKind key is accounted for. Guards the regex against drift.
    expect([...boxTypeLabels().keys()].sort()).toEqual([...ALL_BOX_TYPES].sort());
    expect([...schemaKindNotices().keys()].sort()).toEqual([...ALL_SCHEMA_KINDS].sort());
  });

  it('collects every produced label — all 4 surfaces, ~43 strings', () => {
    // 12 box types + 4 schema notices + 6 groups + 21×2 entry strings = 64.
    expect(PRODUCED.length).toBe(12 + 4 + 6 + 21 * 2);
  });

  it('no produced label contains a forbidden verdict / amplification token', () => {
    for (const { where, value } of PRODUCED) {
      for (const token of BANNED) {
        expect({ where, value, hit: hitsBanned(value, token) ? token : null }).toEqual({
          where,
          value,
          hit: null,
        });
      }
    }
  });
});

// ── 2. Per-surface explicit coverage ───────────────────────────

describe('QOL-030 one-box copy — per-surface coverage', () => {
  it('every box type has a clean plain-language chip label', () => {
    for (const [type, label] of boxTypeLabels()) {
      expect({ type, len: label.length }).toEqual({ type, len: label.length });
      expect(label.length).toBeGreaterThan(0);
      for (const token of BANNED) expect(hitsBanned(label, token)).toBe(false);
    }
  });

  it('every schema-kind notice is a clean plain-language line', () => {
    for (const [kind, text] of schemaKindNotices()) {
      expect({ kind, len: text.length }).toEqual({ kind, len: text.length });
      expect(text.length).toBeGreaterThan(0);
      for (const token of BANNED) expect(hitsBanned(text, token)).toBe(false);
    }
  });

  it('every flash-menu group heading is clean', () => {
    for (const groupId of ACT_GROUP_ORDER) {
      const label = ACT_GROUP_LABEL[groupId];
      expect(label.length).toBeGreaterThan(0);
      for (const token of BANNED) expect(hitsBanned(label, token)).toBe(false);
    }
  });

  it('every flash-menu entry label + accessibilityLabel is clean', () => {
    for (const id of ALL_ACT_ENTRY_IDS) {
      const def = _debug.ACT_ENTRY_DEFINITIONS[id];
      for (const token of BANNED) {
        expect(hitsBanned(def.label, token)).toBe(false);
        expect(hitsBanned(def.accessibilityLabel, token)).toBe(false);
      }
    }
  });
});

// ── 3. Plain-language guard — no internal code leaks ───────────

describe('QOL-030 one-box copy — plain-language guard', () => {
  it('no box-type label looks like an internal code', () => {
    for (const [, label] of boxTypeLabels()) {
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });

  it('no box-type label leaks a raw BoxType id (snake_case)', () => {
    // The internal `BoxType` ids (`root_claim`, `respond_to_concession`,
    // `branch_tangent`, …) must never appear verbatim in a label.
    for (const [type, label] of boxTypeLabels()) {
      expect({ type, leaks: label.includes(type) }).toEqual({ type, leaks: false });
    }
  });

  it('no flash-menu entry label looks like an internal code', () => {
    for (const id of ALL_ACT_ENTRY_IDS) {
      expect(looksLikeInternalCode(_debug.ACT_ENTRY_DEFINITIONS[id].label)).toBe(false);
    }
  });

  it('no flash-menu entry label leaks a raw ActEntryId (snake_case)', () => {
    for (const id of ALL_ACT_ENTRY_IDS) {
      expect({ id, leaks: _debug.ACT_ENTRY_DEFINITIONS[id].label.includes(id) }).toEqual({
        id,
        leaks: false,
      });
    }
  });

  it('no flash-menu group heading looks like an internal code', () => {
    for (const groupId of ACT_GROUP_ORDER) {
      expect(looksLikeInternalCode(ACT_GROUP_LABEL[groupId])).toBe(false);
    }
  });

  it('no produced label contains a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const { where, value } of PRODUCED) {
      expect({ where, snake: snake.test(value) }).toEqual({ where, snake: false });
    }
  });

  it('no schema-kind notice leaks a raw SchemaKind code', () => {
    // `free_body` / `forced_list` / `structured_form` / `composite` must
    // be mapped to prose, never echoed (the design §10 doctrine).
    const notices = [...schemaKindNotices().values()].map((t) => t.toLowerCase());
    for (const kind of ALL_SCHEMA_KINDS) {
      for (const text of notices) {
        expect({ kind, leaks: text.includes(kind) }).toEqual({ kind, leaks: false });
      }
    }
  });
});

// ── 4. Label length budgets (design §6.3 — labels ≤ 24 chars) ──

describe('QOL-030 one-box copy — length budgets', () => {
  it('every flash-menu entry label is ≤ 24 chars (design §6.3)', () => {
    for (const id of ALL_ACT_ENTRY_IDS) {
      const label = _debug.ACT_ENTRY_DEFINITIONS[id].label;
      expect({ id, len: label.length, within: label.length <= 24 }).toEqual({
        id,
        len: label.length,
        within: true,
      });
    }
  });

  it('every flash-menu accessibility label is ≤ 80 chars (design §6.3)', () => {
    for (const id of ALL_ACT_ENTRY_IDS) {
      const a11y = _debug.ACT_ENTRY_DEFINITIONS[id].accessibilityLabel;
      expect({ id, len: a11y.length, within: a11y.length <= 80 }).toEqual({
        id,
        len: a11y.length,
        within: true,
      });
    }
  });

  it('every box-type chip label is ≤ 32 chars', () => {
    for (const [type, label] of boxTypeLabels()) {
      expect({ type, within: label.length <= 32 }).toEqual({ type, within: true });
    }
  });
});

// ── 5. Source scan — the two pure models are import-pure ────────
//
// Design §9 "Source scan" checklist item. `oneBoxPopoutChassis.test.tsx`
// already source-scans the three `.tsx` chassis files; the two pure-TS
// models (`boxModel.ts`, `actPopoutModel.ts`) were the gap. Typecheck
// guards the import graph too, but this is the explicit doctrine guard.

describe('QOL-030 one-box copy — pure-model source scan', () => {
  // Comment-stripped — a doctrine comment that names a forbidden primitive
  // ("no `Date.now()`", "never imports `supabase`") must not register.
  const pureModels: { name: string; src: string }[] = [
    { name: 'boxModel.ts', src: stripComments(BOX_MODEL_SRC) },
    { name: 'actPopoutModel.ts', src: stripComments(ACT_MODEL_SRC) },
  ];

  it('comment-stripping leaves real code intact (sanity)', () => {
    // The stripped source still has the exported function signatures —
    // proves stripComments did not eat the code it must scan.
    expect(pureModels[0].src).toMatch(/export function renderSchema/);
    expect(pureModels[1].src).toMatch(/export function buildActPopout/);
    // …and the doctrine comment phrase is gone.
    expect(pureModels[0].src).not.toMatch(/no `Date\.now\(\)`/);
  });

  it('neither pure model imports Supabase', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /from ['"][^'"]*supabase/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('neither pure model imports React or React Native', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /from ['"]react(-native)?['"]/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('neither pure model performs a network call', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /\bfetch\(/.test(src) }).toEqual({ name, hit: false });
      expect({ name, hit: /\bXMLHttpRequest\b/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('neither pure model imports an AI provider', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /anthropic|openai|x\.ai/i.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('neither pure model reads Date.now() (deterministic — design §10)', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /Date\.now\(\)/.test(src) }).toEqual({ name, hit: false });
    }
  });
});

// ── 6. QOL-033 — Go popout copy ban-list ───────────────────────
//
// QOL-033 adds a third popout (Go — navigate & re-view) on the same
// chassis. Its pure model (`goPopoutModel.ts`) authors every Go group
// heading, every Go entry `label` + `accessibilityLabel`, and the
// disabled-reason copy. They are held to the same doctrine bar — the
// QOL-033 design §7 "no verdict / winner / loser copy in any label" check.

/** Every user-facing string the QOL-033 Go popout model can render. */
function collectGoStrings(): { where: string; value: string }[] {
  const out: { where: string; value: string }[] = [];

  // Go group headings.
  for (const groupId of GO_GROUP_ORDER) {
    out.push({ where: `GO_GROUP_LABEL.${groupId}`, value: GO_GROUP_LABEL[groupId] });
  }

  // Go entry labels + accessibility labels.
  for (const id of ALL_GO_ENTRY_IDS) {
    const def = _goDebug.GO_ENTRY_DEFINITIONS[id];
    out.push({ where: `GO_ENTRY_DEFINITIONS.${id}.label`, value: def.label });
    out.push({
      where: `GO_ENTRY_DEFINITIONS.${id}.accessibilityLabel`,
      value: def.accessibilityLabel,
    });
  }

  // Go disabled-reason copy.
  for (const [key, reason] of Object.entries(GO_DISABLED_REASON)) {
    out.push({ where: `GO_DISABLED_REASON.${key}`, value: reason });
  }

  return out;
}

const GO_PRODUCED = collectGoStrings();

describe('QOL-033 Go popout copy — doctrine ban-list scan', () => {
  it('collects every Go-popout string — 4 groups + 12×2 entries + 4 reasons', () => {
    expect(GO_PRODUCED.length).toBe(4 + 12 * 2 + 4);
  });

  it('no Go-popout label contains a forbidden verdict / amplification token', () => {
    for (const { where, value } of GO_PRODUCED) {
      for (const token of BANNED) {
        expect({ where, value, hit: hitsBanned(value, token) ? token : null }).toEqual({
          where,
          value,
          hit: null,
        });
      }
    }
  });

  it('no Go-popout label looks like an internal code', () => {
    for (const { value } of GO_PRODUCED) {
      expect(looksLikeInternalCode(value)).toBe(false);
    }
  });

  it('no Go-popout label leaks a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const { where, value } of GO_PRODUCED) {
      expect({ where, snake: snake.test(value) }).toEqual({ where, snake: false });
    }
  });

  it('no Go-entry label leaks a raw GoEntryId (snake_case)', () => {
    for (const id of ALL_GO_ENTRY_IDS) {
      const label = _goDebug.GO_ENTRY_DEFINITIONS[id].label;
      expect({ id, leaks: label.includes(id) }).toEqual({ id, leaks: false });
    }
  });

  it('every Go-entry label is ≤ 24 chars (design §6.3 budget)', () => {
    for (const id of ALL_GO_ENTRY_IDS) {
      const label = _goDebug.GO_ENTRY_DEFINITIONS[id].label;
      expect({ id, within: label.length <= 24 }).toEqual({ id, within: true });
    }
  });

  it('every Go-entry accessibility label is ≤ 80 chars (design §6.3 budget)', () => {
    for (const id of ALL_GO_ENTRY_IDS) {
      const a11y = _goDebug.GO_ENTRY_DEFINITIONS[id].accessibilityLabel;
      expect({ id, within: a11y.length <= 80 }).toEqual({ id, within: true });
    }
  });

  it('"hot zone" copy never co-occurs with a verdict word (doctrine §2)', () => {
    // Heat is an activity signal — the Hot-zone entry must not imply a result.
    const hotEntry = _goDebug.GO_ENTRY_DEFINITIONS.jump_hot_zone;
    const verdictWords = ['winner', 'best', 'correct', 'right', 'true', 'important'];
    for (const w of verdictWords) {
      expect(hotEntry.label.toLowerCase()).not.toContain(w);
      expect(hotEntry.accessibilityLabel.toLowerCase()).not.toContain(w);
    }
  });
});

describe('QOL-033 Go popout — pure-model source scan', () => {
  const goModelSrc = stripComments(
    fs.readFileSync(path.join(ONEBOX_DIR, 'goPopoutModel.ts'), 'utf8'),
  );

  it('goPopoutModel imports no Supabase / React / network / AI primitive', () => {
    expect(/from ['"][^'"]*supabase/.test(goModelSrc)).toBe(false);
    expect(/from ['"]react(-native)?['"]/.test(goModelSrc)).toBe(false);
    expect(/\bfetch\(/.test(goModelSrc)).toBe(false);
    expect(/anthropic|openai|x\.ai/i.test(goModelSrc)).toBe(false);
  });

  it('goPopoutModel reads no wall clock (deterministic — design §8)', () => {
    expect(/Date\.now\(\)/.test(goModelSrc)).toBe(false);
  });
});
