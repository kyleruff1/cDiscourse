/**
 * EV-004 — Tests for the evidence symmetry map.
 *
 * Pure-model coverage:
 *   - Map covers every code in `EvidenceSymmetryCode` (9 entries).
 *   - Label parity with `toPlainLanguage` (single source of truth).
 *   - `synthesis_ready` + `max_depth_reached` helperLine + iconHint
 *     parity by-reference with RULE-003.
 *   - Doctrine ban-lists: verdict / person-attribution / snake_case /
 *     amplification / block-semantics / `hot`.
 *   - Doctrine §3 pin on `anti_amplification` helperLine.
 *   - R4 — `max_depth_reached` routes through `archived_or_resolved`.
 *   - Additive IconHint extension: the 4 new values are in
 *     `ALL_ICON_HINTS` and none is verdict-flavored.
 *   - Normalisation + unknown handling on
 *     `getEvidenceSymmetryOrSuppress`.
 *   - Source-scan: no React / Supabase / network / AI / Date.now /
 *     Math.random / console.log in `evidenceSymmetryMap.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  ALL_EVIDENCE_SYMMETRY_CODES,
  ALL_CHIP_KINDS,
  ALL_EDGE_STYLES,
  ALL_BAND_KINDS,
  EVIDENCE_SYMMETRY_MAP,
  getEvidenceSymmetry,
  getEvidenceSymmetryOrSuppress,
  type EvidenceSymmetryCode,
  type ChipKind,
  type EdgeStyle,
  type BandKind,
} from '../src/features/evidence/evidenceSymmetryMap';
import {
  ALL_ICON_HINTS,
  LIFECYCLE_UX_MAP,
  type IconHint,
} from '../src/features/rulesUx/lifecycleUxMap';
import {
  toPlainLanguage,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

const EV_004_SOURCE_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'evidence',
  'evidenceSymmetryMap.ts',
);

// COPY-001 post-hardening verdict ban list (right / wrong / validated added).
const BANNED_VERDICT_TOKENS =
  /\b(winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot|astroturfer|troll|correct|incorrect|true|false|right|wrong|validated)\b/i;

// Person-attribution ban (whole-word, case-insensitive).
const BANNED_PERSON_TOKENS =
  /\b(you|your|they|their|the user|the author|the poster)\b/i;

// Amplification ban (the word `popularity` is exempted ONLY inside the
// `anti_amplification` helperLine per doctrine §3; tested separately).
const BANNED_AMPLIFICATION_TOKENS =
  /\b(popular|viral|trending|engagement|retweet|like count|view count)\b/i;

// Block-semantics ban — score never blocks posting per doctrine §1.
const BANNED_BLOCK_TOKENS =
  /\b(block|prevent|reject|forbid|disallow|denied)\b/i;

// Verdict-glyph names that the RULE-003 ban-glyph test enforces.
const BANNED_VERDICT_GLYPHS = [
  'checkmark',
  'check',
  'x_mark',
  'cross',
  'crown',
  'trophy',
  'flame',
  'thumbs_up',
  'thumbs_down',
  'shield',
  'warning',
  'star',
  'medal',
  'gavel',
] as const;

// ── Coverage ──────────────────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — coverage', () => {
  test('every EvidenceSymmetryCode has a map entry', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(code);
    }
  });

  test('ALL_EVIDENCE_SYMMETRY_CODES length === 9', () => {
    expect(ALL_EVIDENCE_SYMMETRY_CODES.length).toBe(9);
  });

  test('Object.keys(EVIDENCE_SYMMETRY_MAP).length === 9', () => {
    expect(Object.keys(EVIDENCE_SYMMETRY_MAP).length).toBe(9);
  });

  test('has no extra keys beyond ALL_EVIDENCE_SYMMETRY_CODES', () => {
    const keys = Object.keys(EVIDENCE_SYMMETRY_MAP).sort();
    const vocab = [...ALL_EVIDENCE_SYMMETRY_CODES].sort();
    expect(keys).toEqual(vocab);
  });

  test('every entry has the required fields and types', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(typeof entry.code).toBe('string');
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.helperLine).toBe('string');
      expect(entry.helperLine.length).toBeGreaterThan(0);
      expect(typeof entry.iconHint).toBe('string');
      expect(typeof entry.chipKind).toBe('string');
      // edgeStyle / bandKind may legitimately be null.
      expect(entry.edgeStyle === null || typeof entry.edgeStyle === 'string').toBe(true);
      expect(entry.bandKind === null || typeof entry.bandKind === 'string').toBe(true);
    }
  });
});

// ── Parity with gameCopy + RULE-003 ───────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — label parity with toPlainLanguage', () => {
  test('for every code, entry.label === toPlainLanguage(code)', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.label).toBe(toPlainLanguage(code));
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — RULE-003 by-reference parity', () => {
  test('synthesis_ready helperLine matches LIFECYCLE_UX_MAP.synthesis_ready.helperLine', () => {
    expect(EVIDENCE_SYMMETRY_MAP.synthesis_ready.helperLine).toBe(
      LIFECYCLE_UX_MAP.synthesis_ready.helperLine,
    );
  });

  test('synthesis_ready iconHint matches LIFECYCLE_UX_MAP.synthesis_ready.iconHint', () => {
    expect(EVIDENCE_SYMMETRY_MAP.synthesis_ready.iconHint).toBe(
      LIFECYCLE_UX_MAP.synthesis_ready.iconHint,
    );
  });

  test('max_depth_reached helperLine matches LIFECYCLE_UX_MAP.archived_or_resolved.helperLine', () => {
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.helperLine).toBe(
      LIFECYCLE_UX_MAP.archived_or_resolved.helperLine,
    );
  });

  test('max_depth_reached iconHint matches LIFECYCLE_UX_MAP.archived_or_resolved.iconHint', () => {
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.iconHint).toBe(
      LIFECYCLE_UX_MAP.archived_or_resolved.iconHint,
    );
  });
});

// ── Doctrine §3 pin (anti_amplification) ──────────────────────

describe('EVIDENCE_SYMMETRY_MAP — anti_amplification doctrine §3 pin', () => {
  test('helperLine === "Popularity is not proof — show the source."', () => {
    expect(EVIDENCE_SYMMETRY_MAP.anti_amplification.helperLine).toBe(
      'Popularity is not proof — show the source.',
    );
  });

  test('the word `Popularity` appears in exactly one entry across helperLines + labels', () => {
    let count = 0;
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      if (/popularity/i.test(entry.helperLine)) count += 1;
      if (/popularity/i.test(entry.label)) count += 1;
    }
    // The label for anti_amplification is also "Popularity is not proof",
    // so we expect exactly 2 hits — one helperLine + one label, both on
    // the anti_amplification entry.
    expect(count).toBeGreaterThan(0);
    // No other entry's label or helperLine mentions popularity.
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      if (code === 'anti_amplification') continue;
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.helperLine.toLowerCase()).not.toContain('popularity');
      expect(entry.label.toLowerCase()).not.toContain('popularity');
    }
  });
});

// ── Ban-list tests ────────────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — verdict / truth ban', () => {
  test('no verdict token in any label or helperLine', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.label).not.toMatch(BANNED_VERDICT_TOKENS);
      expect(entry.helperLine).not.toMatch(BANNED_VERDICT_TOKENS);
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — person-attribution ban', () => {
  test('no person token in any label or helperLine', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.label).not.toMatch(BANNED_PERSON_TOKENS);
      expect(entry.helperLine).not.toMatch(BANNED_PERSON_TOKENS);
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — snake_case ban', () => {
  test('no field reads as an internal code', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(looksLikeInternalCode(entry.label)).toBe(false);
      expect(looksLikeInternalCode(entry.helperLine)).toBe(false);
    }
  });

  test('no raw EvidenceSymmetryCode appears verbatim in label or helperLine', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      for (const otherCode of ALL_EVIDENCE_SYMMETRY_CODES) {
        expect(entry.label).not.toContain(otherCode);
        expect(entry.helperLine).not.toContain(otherCode);
      }
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — amplification copy ban (with doctrine §3 carve-out)', () => {
  test('no amplification token in any non-anti_amplification entry', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      if (code === 'anti_amplification') continue;
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.label).not.toMatch(BANNED_AMPLIFICATION_TOKENS);
      expect(entry.helperLine).not.toMatch(BANNED_AMPLIFICATION_TOKENS);
    }
  });

  test('anti_amplification entry uses only the doctrine vocabulary word `Popularity`', () => {
    const entry = EVIDENCE_SYMMETRY_MAP.anti_amplification;
    // The exempted word `Popularity` is allowed (and required) on this entry.
    // The other amplification tokens stay banned.
    expect(entry.helperLine).not.toMatch(/\b(viral|trending|engagement|retweet|like count|view count)\b/i);
    expect(entry.label).not.toMatch(/\b(viral|trending|engagement|retweet|like count|view count)\b/i);
    // The label itself is "Popularity is not proof" — the only place
    // `popular` may appear in EV-004 literals.
    expect(entry.label.toLowerCase()).toContain('popularity');
  });
});

describe('EVIDENCE_SYMMETRY_MAP — block-semantics ban', () => {
  test('no block-semantics token in any label or helperLine', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.label).not.toMatch(BANNED_BLOCK_TOKENS);
      expect(entry.helperLine).not.toMatch(BANNED_BLOCK_TOKENS);
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — `hot` ban (no SW-002 carve-out here)', () => {
  test('no helperLine contains the word `hot`', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.helperLine.toLowerCase()).not.toMatch(/\bhot\b/);
      expect(entry.label.toLowerCase()).not.toMatch(/\bhot\b/);
    }
  });
});

describe('EVIDENCE_SYMMETRY_MAP — helperLine length cap', () => {
  test('every helperLine is ≤ 80 chars', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const entry = EVIDENCE_SYMMETRY_MAP[code];
      expect(entry.helperLine.length).toBeLessThanOrEqual(80);
    }
  });
});

// ── R1–R4 invariants ──────────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — R2 documentation (same-label dedup is consumer policy)', () => {
  test('synthesis_ready carries the same label as the META-001 ready_for_synthesis tag', () => {
    // Both surfaces emit "Ready for synthesis"; consumer dedups per R2.
    expect(EVIDENCE_SYMMETRY_MAP.synthesis_ready.label).toBe(toPlainLanguage('synthesis_ready'));
    expect(EVIDENCE_SYMMETRY_MAP.synthesis_ready.label).toBe(toPlainLanguage('ready_for_synthesis'));
  });
});

describe('EVIDENCE_SYMMETRY_MAP — R3 cross-level reuse', () => {
  test('evidence_debt label matches toPlainLanguage("evidence_debt") (RULE-001 / META-001 root)', () => {
    expect(EVIDENCE_SYMMETRY_MAP.evidence_debt.label).toBe(toPlainLanguage('evidence_debt'));
  });
});

describe('EVIDENCE_SYMMETRY_MAP — R4 runner-status routing for max_depth_reached', () => {
  test('bandKind === "resolved" (the primary visual carrier)', () => {
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.bandKind).toBe('resolved');
  });

  test('helperLine + iconHint mirror the archived_or_resolved lifecycle entry', () => {
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.helperLine).toBe(
      LIFECYCLE_UX_MAP.archived_or_resolved.helperLine,
    );
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.iconHint).toBe(
      LIFECYCLE_UX_MAP.archived_or_resolved.iconHint,
    );
  });

  test('chipKind === "resolved" (admin-debug only; the band is the primary carrier)', () => {
    expect(EVIDENCE_SYMMETRY_MAP.max_depth_reached.chipKind).toBe('resolved');
  });

  test('no other entry sets bandKind', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      if (code === 'max_depth_reached') continue;
      expect(EVIDENCE_SYMMETRY_MAP[code].bandKind).toBeNull();
    }
  });
});

// ── EdgeStyle invariants ──────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — edgeStyle invariants', () => {
  test('source_chain has edgeStyle === "dotted"', () => {
    expect(EVIDENCE_SYMMETRY_MAP.source_chain.edgeStyle).toBe('dotted');
  });

  test('every other entry has edgeStyle === null', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      if (code === 'source_chain') continue;
      expect(EVIDENCE_SYMMETRY_MAP[code].edgeStyle).toBeNull();
    }
  });
});

// ── IconHint additive extension ───────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — additive IconHint extension', () => {
  const NEW_HINTS: ReadonlyArray<IconHint> = ['key_term', 'logic_chain', 'causal_arrow', 'crowd_slash'];

  test('the 4 new IconHint values are present in ALL_ICON_HINTS', () => {
    const set = new Set<IconHint>(ALL_ICON_HINTS);
    for (const hint of NEW_HINTS) {
      expect(set.has(hint)).toBe(true);
    }
  });

  test('the 4 new IconHint values are not verdict-glyph-flavored', () => {
    for (const hint of NEW_HINTS) {
      for (const banned of BANNED_VERDICT_GLYPHS) {
        expect(hint).not.toBe(banned);
      }
    }
  });

  test('every entry iconHint is a member of ALL_ICON_HINTS', () => {
    const set = new Set<IconHint>(ALL_ICON_HINTS);
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(set.has(EVIDENCE_SYMMETRY_MAP[code].iconHint)).toBe(true);
    }
  });

  test('mapping table — issue icon name → final IconHint', () => {
    const expected: Record<EvidenceSymmetryCode, IconHint> = {
      source_chain: 'dotted_hexagon',
      evidence_debt: 'hexagon',
      scope: 'scope_brackets',
      definition: 'key_term',
      logic: 'logic_chain',
      causal: 'causal_arrow',
      anti_amplification: 'crowd_slash',
      synthesis_ready: 'eye',          // RULE-003 chose `eye`; EV-004 mirrors.
      max_depth_reached: 'archive_box', // R4 lifecycle.
    };
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(EVIDENCE_SYMMETRY_MAP[code].iconHint).toBe(expected[code]);
    }
  });
});

// ── chipKind invariants ───────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — chipKind invariants', () => {
  test('every entry chipKind is a member of ALL_CHIP_KINDS', () => {
    const set = new Set<ChipKind>(ALL_CHIP_KINDS);
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(set.has(EVIDENCE_SYMMETRY_MAP[code].chipKind)).toBe(true);
    }
  });

  test('chipKind mapping — code → chipKind', () => {
    const expected: Record<EvidenceSymmetryCode, ChipKind> = {
      source_chain: 'source_trail',
      evidence_debt: 'receipt',
      scope: 'scope',
      definition: 'definition',
      logic: 'logic',
      causal: 'mechanism',
      anti_amplification: 'amplification',
      synthesis_ready: 'synthesis',
      max_depth_reached: 'resolved',
    };
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(EVIDENCE_SYMMETRY_MAP[code].chipKind).toBe(expected[code]);
    }
  });
});

// ── Readers ───────────────────────────────────────────────────

describe('getEvidenceSymmetry — total reader', () => {
  test('returns the same entry reference as the map', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(getEvidenceSymmetry(code)).toBe(EVIDENCE_SYMMETRY_MAP[code]);
    }
  });
});

describe('getEvidenceSymmetryOrSuppress — defensive reader', () => {
  test('returns the same entry as the typed reader for known codes', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(getEvidenceSymmetryOrSuppress(code)).toBe(getEvidenceSymmetry(code));
    }
  });

  test('normalises whitespace / hyphens / case', () => {
    expect(getEvidenceSymmetryOrSuppress('SOURCE_CHAIN')?.code).toBe('source_chain');
    expect(getEvidenceSymmetryOrSuppress('source-chain')?.code).toBe('source_chain');
    expect(getEvidenceSymmetryOrSuppress('  source_chain  ')?.code).toBe('source_chain');
    expect(getEvidenceSymmetryOrSuppress('Source Chain')?.code).toBe('source_chain');
  });

  test('returns null for empty / null / undefined / unknown codes', () => {
    expect(getEvidenceSymmetryOrSuppress('')).toBeNull();
    expect(getEvidenceSymmetryOrSuppress(null)).toBeNull();
    expect(getEvidenceSymmetryOrSuppress(undefined)).toBeNull();
    expect(getEvidenceSymmetryOrSuppress('unknown_code')).toBeNull();
    expect(getEvidenceSymmetryOrSuppress('completely-made-up')).toBeNull();
  });
});

// ── Frozen-map invariants ─────────────────────────────────────

describe('EVIDENCE_SYMMETRY_MAP — frozen at module load', () => {
  test('the map is frozen', () => {
    expect(Object.isFrozen(EVIDENCE_SYMMETRY_MAP)).toBe(true);
  });

  test('every entry is frozen', () => {
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(Object.isFrozen(EVIDENCE_SYMMETRY_MAP[code])).toBe(true);
    }
  });

  test('ALL_EVIDENCE_SYMMETRY_CODES / ALL_CHIP_KINDS / ALL_EDGE_STYLES / ALL_BAND_KINDS are frozen', () => {
    expect(Object.isFrozen(ALL_EVIDENCE_SYMMETRY_CODES)).toBe(true);
    expect(Object.isFrozen(ALL_CHIP_KINDS)).toBe(true);
    expect(Object.isFrozen(ALL_EDGE_STYLES)).toBe(true);
    expect(Object.isFrozen(ALL_BAND_KINDS)).toBe(true);
  });

  test('ALL_CHIP_KINDS covers exactly the 9 chip kinds', () => {
    const fromMap = new Set<ChipKind>();
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      fromMap.add(EVIDENCE_SYMMETRY_MAP[code].chipKind);
    }
    expect([...fromMap].sort()).toEqual([...ALL_CHIP_KINDS].sort());
  });
});

// ── Source-scan (boundary enforcement) ────────────────────────

function stripCommentsAndStrings(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
  return out;
}

describe('EV-004 — source-scan boundary enforcement', () => {
  const raw = fs.readFileSync(EV_004_SOURCE_PATH, 'utf8');
  const code = stripCommentsAndStrings(raw);

  test('no Date.now() in executable code', () => {
    expect(/\bDate\.now\s*\(/.test(code)).toBe(false);
  });

  test('no Math.random() in executable code', () => {
    expect(/\bMath\.random\s*\(/.test(code)).toBe(false);
  });

  test('no fetch() in executable code', () => {
    expect(/\bfetch\s*\(/.test(code)).toBe(false);
  });

  test('no XMLHttpRequest reference in executable code', () => {
    expect(code.includes('XMLHttpRequest')).toBe(false);
  });

  test('no console.log in executable code', () => {
    expect(/\bconsole\.log\s*\(/.test(code)).toBe(false);
  });

  test('no supabase identifier in executable code', () => {
    expect(/\bsupabase\b/i.test(code)).toBe(false);
  });

  test('no anthropic identifier in executable code', () => {
    expect(/\banthropic\b/i.test(code)).toBe(false);
  });

  test('no xai identifier in executable code', () => {
    expect(/\bxai\b/i.test(code)).toBe(false);
  });

  test('no React / RN / Expo imports', () => {
    const rawLines = raw.split(/\r?\n/);
    for (const line of rawLines) {
      const t = line.trim();
      if (/^import\s+(?!type\b)/.test(t)) {
        expect(t.includes("'react'")).toBe(false);
        expect(t.includes('"react"')).toBe(false);
        expect(t.includes("'react-native'")).toBe(false);
        expect(t.includes('"react-native"')).toBe(false);
        expect(t.includes("'expo")).toBe(false);
        expect(t.includes('"expo')).toBe(false);
      }
    }
  });

  test('no ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE secret literal', () => {
    expect(raw.includes('ANTHROPIC_API_KEY')).toBe(false);
    expect(raw.includes('XAI_API_KEY')).toBe(false);
    expect(raw.includes('SERVICE_ROLE')).toBe(false);
    expect(raw.includes('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });

  test('cross-module value imports are limited to toPlainLanguage + LIFECYCLE_UX_MAP', () => {
    // Walk top-level imports and partition into value-imports vs type-imports.
    const lines = raw.split(/\r?\n/);
    const valueImportSpecifiers: string[] = [];
    let inImport = false;
    let isType = false;
    let acc = '';
    for (const line of lines) {
      const t = line.trim();
      if (!inImport) {
        if (/^import\s+type\b/.test(t)) {
          isType = true;
          inImport = true;
          acc = t;
        } else if (/^import\b/.test(t)) {
          isType = false;
          inImport = true;
          acc = t;
        } else {
          continue;
        }
      } else {
        acc = `${acc} ${t}`;
      }
      if (acc.includes(';') || /['"];?\s*$/.test(acc)) {
        if (!isType) {
          // Extract the specifiers between { ... }.
          const match = acc.match(/\{([^}]*)\}/);
          if (match) {
            const specs = match[1]
              .split(',')
              .map((s) => s.trim().split(/\s+as\s+/)[0])
              .filter((s) => s.length > 0);
            valueImportSpecifiers.push(...specs);
          }
        }
        inImport = false;
        isType = false;
        acc = '';
      }
    }
    // Allow exactly: `toPlainLanguage`, `LIFECYCLE_UX_MAP`. Other value
    // imports would be a boundary violation.
    const allowed = new Set(['toPlainLanguage', 'LIFECYCLE_UX_MAP']);
    for (const spec of valueImportSpecifiers) {
      expect(allowed.has(spec)).toBe(true);
    }
  });
});

// ── Type-level sanity ─────────────────────────────────────────

describe('EV-004 — type-level sanity', () => {
  test('EvidenceSymmetryCode union is exhaustively covered by ALL_EVIDENCE_SYMMETRY_CODES', () => {
    // Compile-time check: this assignment fails if the union and the
    // declared array drift apart. Asserted at run time too.
    const codes: ReadonlyArray<EvidenceSymmetryCode> = ALL_EVIDENCE_SYMMETRY_CODES;
    expect(codes.length).toBe(9);
  });

  test('EdgeStyle / BandKind reserved members do not appear in v1 entries', () => {
    // `kinked` is reserved for future BR-002 cards — EV-004 must not emit it.
    const reserved: EdgeStyle = 'kinked';
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      expect(EVIDENCE_SYMMETRY_MAP[code].edgeStyle).not.toBe(reserved);
    }
    // BandKind currently has only 'resolved'. Validate it is the only emitted value.
    const emittedBands = new Set<BandKind>();
    for (const code of ALL_EVIDENCE_SYMMETRY_CODES) {
      const b = EVIDENCE_SYMMETRY_MAP[code].bandKind;
      if (b !== null) emittedBands.add(b);
    }
    expect([...emittedBands]).toEqual(['resolved']);
  });
});
