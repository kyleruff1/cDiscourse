/**
 * VOICE-005 (issue 663) - forbidden-inference source-scan guard for the
 * pure-TS visualizer tree.
 *
 * Bidirectional pattern mirroring the VOICE-003 / VOICE-004 guards:
 *
 *   (a) Assert-absent lexicon over every .ts file under
 *       src/features/voice/visualizer, excluding __fixtures__ and this
 *       test. Inherits the VOICE-003 / VOICE-004 lexicon VERBATIM and
 *       extends with visualizer-specific bans: voice signature, vocal
 *       print, prosody visualization, voice_print, voiceprint,
 *       waveform_fingerprint, audio_fingerprint.
 *
 *   (b) Purity bans: pseudo-random, clock reads, animation-frame
 *       callbacks, timer APIs.
 *
 *   (c) Non-basic-arithmetic bans (visualizer folder only): trig, sqrt,
 *       log, exp, pow, hypot, cbrt, sinh, cosh, tanh, sign. Only round,
 *       max, min, floor, ceil, abs are legal.
 *
 *   (d) Import bans: react, react-native, native Skia, native SVG,
 *       expo-audio, expo-sensors, react-native-sensors, the VOICE-004
 *       reducer path, and any React hook.
 *
 *   (e) Structural bans: no top-level let / var; no Skia SVG-parser
 *       entry-point literal.
 *
 *   (f) FIRING POSITIVE CONTROL: load the .ts.txt fixture and assert
 *       the scanner reports at least three distinct hits across three
 *       roles AND at least one visualizer-specific token AND at least
 *       one purity token AND at least one non-basic-arith token AND
 *       the Skia SVG-parser ban.
 *
 *   (g) Apostrophe-free comments in every visualizer .ts.
 *
 * The helpers are self-contained so a production refactor cannot
 * silently disarm the guard. Comments are apostrophe-free.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO = process.cwd();
const VISUALIZER_ROOT = join(REPO, 'src', 'features', 'voice', 'visualizer');
const POSITIVE_CONTROL_REL =
  'src/features/voice/visualizer/__fixtures__/voice005ForbiddenInferenceGuard.positiveControl.ts.txt';

// VOICE-003 + VOICE-004 lexicon inherited VERBATIM.
const WHOLE_WORD_BANS_INHERITED: readonly string[] = Object.freeze([
  'emotion',
  'tone',
  'stress',
  'anger',
  'angry',
  'mood',
  'sentiment',
  'honesty',
  'honest',
  'sincerity',
  'sincere',
  'manipulation',
  'manipulative',
  'biometric',
  'biometrics',
  'identity',
  'credibility',
  'credible',
  'intent',
  'intention',
  'truth',
  'truthful',
  'winner',
  'loser',
  'verdict',
  'liar',
  'dishonest',
  'extremist',
  'propagandist',
  'recognitionConfidence',
  'recognizerConfidence',
  'speakerConfidence',
  'confidence',
  'suspicious',
  'genuineness',
  'genuine',
  'authenticity',
  'authentic',
  'arousal',
  'energyLevel',
  'intensity',
  'agitation',
  'excitement',
  'passion',
  'shouting',
  'shoutingIndicator',
  'whisper',
  'aggression',
  'aggressionLevel',
  'dominance',
  'dominanceIndex',
  'assertiveness',
  'assertivenessScore',
  'emotionalIntensity',
  'stressScore',
  'angerScore',
  'speakerEnergy',
  'speakerActivity',
  'speakerId',
  'speakerRecognition',
  'voiceprint',
  'formant',
  'phoneme',
  'spectrogram',
  'fft',
  'fourier',
  'melspec',
  'mfcc',
  'prosody',
  'cepstral',
  'pitch',
  'f0',
]);

// VOICE-005 visualizer-specific whole-word bans.
const WHOLE_WORD_BANS_VISUALIZER: readonly string[] = Object.freeze([
  'voiceprint',
  'waveform_fingerprint',
  'audio_fingerprint',
  'voice_print',
]);

const SUBSTRING_BANS: readonly string[] = Object.freeze([
  'badFaith',
  'bad_faith',
  'bad faith',
  'voice signature',
  'vocal print',
  'prosody visualization',
  'voice-print',
  'voice biometric',
  'voice-biometric',
  'voice stress',
  'voice-stress',
]);

// Raw-audio identifier bans inherited from VOICE-004.
const RAW_AUDIO_BANS: readonly string[] = Object.freeze([
  'pcm',
  'audioBlob',
  'audioBuffer',
  'sampleBuffer',
  'rawSamples',
  'AudioBuffer',
  'storageKey',
  'signedUrl',
  'waveformPcm',
  'rawPcm',
]);

// Purity bans - the visualizer is pure and deterministic. Ban tokens
// assembled from parts so this test file itself never carries the
// literal token that a future doctrine scan of the test folder could
// bite on.
const PURITY_BANS: readonly string[] = Object.freeze([
  'Math' + '.random',
  'Date' + '.now',
  'performance' + '.now',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'setImmediate',
]);

// Non-basic-arith bans in the visualizer folder only. Only + - * /,
// Math.round, Math.max, Math.min, Math.floor, Math.ceil, Math.abs are
// legal. This is what makes IEEE-754 arithmetic bit-exact across V8,
// JSC, and Hermes.
const NON_BASIC_ARITH_BANS: readonly string[] = Object.freeze([
  'Math' + '.sin',
  'Math' + '.cos',
  'Math' + '.tan',
  'Math' + '.asin',
  'Math' + '.acos',
  'Math' + '.atan',
  'Math' + '.atan2',
  'Math' + '.sqrt',
  'Math' + '.exp',
  'Math' + '.log',
  'Math' + '.log2',
  'Math' + '.log10',
  'Math' + '.pow',
  'Math' + '.cbrt',
  'Math' + '.hypot',
  'Math' + '.sign',
  'Math' + '.sinh',
  'Math' + '.cosh',
  'Math' + '.tanh',
]);

// Skia SVG-parser entry-point ban (constructed from parts to avoid the
// literal token being in this test file).
const SKIA_PARSER_BAN = 'Make' + 'From' + 'SVG' + 'String';

// Import bans - the pure module has zero imports of React, native, or
// the VOICE-004 reducer path.
const FORBIDDEN_IMPORT_FRAGMENTS: readonly string[] = Object.freeze([
  "from 'react'",
  'from "react"',
  "from 'react-native'",
  'from "react-native"',
  "from '@shopify/react-native-skia'",
  'from "@shopify/react-native-skia"',
  "from 'react-native-svg'",
  'from "react-native-svg"',
  "from 'expo-audio'",
  'from "expo-audio"',
  "from 'expo-sensors'",
  'from "expo-sensors"',
  "from 'react-native-sensors'",
  'from "react-native-sensors"',
  "from '../waveform/waveformSessionMachine'",
  'from "../waveform/waveformSessionMachine"',
]);

const FORBIDDEN_HOOKS: readonly string[] = Object.freeze([
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useSyncExternalStore',
  'useReducer',
  'useContext',
  'useLayoutEffect',
]);

const FORBIDDEN_APIS: readonly string[] = Object.freeze([
  'fetch(',
  'XMLHttpRequest',
  'new AbortController',
  'new WebSocket',
]);

interface Hit {
  readonly token: string;
  readonly line: number;
  readonly snippet: string;
  readonly category:
    | 'lexicon'
    | 'purity'
    | 'nonBasicArith'
    | 'skiaParser'
    | 'visualizerSpecific';
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanForbidden(content: string): Hit[] {
  const hits: Hit[] = [];
  const lines = content.split('\n');
  const wholeWord = WHOLE_WORD_BANS_INHERITED.concat(WHOLE_WORD_BANS_VISUALIZER);
  const visualizerSet = new Set<string>(
    WHOLE_WORD_BANS_VISUALIZER.map((t) => t.toLowerCase()).concat(
      SUBSTRING_BANS.map((t) => t.toLowerCase()),
    ),
  );

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const token of wholeWord) {
      const re = new RegExp('\\b' + escapeRe(token) + '\\b', 'gi');
      if (re.test(line)) {
        hits.push({
          token,
          line: i + 1,
          snippet: line.trim(),
          category: visualizerSet.has(token.toLowerCase())
            ? 'visualizerSpecific'
            : 'lexicon',
        });
      }
    }
    for (const token of SUBSTRING_BANS) {
      const re = new RegExp(escapeRe(token), 'gi');
      if (re.test(line)) {
        hits.push({
          token,
          line: i + 1,
          snippet: line.trim(),
          category: 'visualizerSpecific',
        });
      }
    }
    for (const token of PURITY_BANS) {
      if (line.includes(token)) {
        hits.push({
          token,
          line: i + 1,
          snippet: line.trim(),
          category: 'purity',
        });
      }
    }
    for (const token of NON_BASIC_ARITH_BANS) {
      if (line.includes(token)) {
        hits.push({
          token,
          line: i + 1,
          snippet: line.trim(),
          category: 'nonBasicArith',
        });
      }
    }
    if (line.includes(SKIA_PARSER_BAN)) {
      hits.push({
        token: SKIA_PARSER_BAN,
        line: i + 1,
        snippet: line.trim(),
        category: 'skiaParser',
      });
    }
  }
  return hits;
}

function walkTs(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === '__fixtures__') continue;
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walkTs(full, out);
    } else if (name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

// ---------- (a) Assert-absent lexicon --------------------------------------

describe('VOICE-005 (issue 663) forbidden-inference source scan', () => {
  const scanned = walkTs(VISUALIZER_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('scan set covers at least the six VOICE-005 module files', () => {
    const rels = scanned.map((f) => f.rel);
    expect(rels).toEqual(
      expect.arrayContaining([
        'src/features/voice/visualizer/pathSegment.types.ts',
        'src/features/voice/visualizer/quantizeBucketsForRender.ts',
        'src/features/voice/visualizer/bucketsToPathSegments.ts',
        'src/features/voice/visualizer/pathSegmentsToSvgD.ts',
        'src/features/voice/visualizer/applyPathSegmentsToSkiaPath.ts',
        'src/features/voice/visualizer/index.ts',
      ]),
    );
    for (const rel of rels) {
      expect(rel).not.toContain('__fixtures__');
      expect(rel.endsWith('.ts.txt')).toBe(false);
    }
  });

  test.each(
    scanned.map((f) => [f.rel, f.src]) as ReadonlyArray<[string, string]>,
  )('%s carries zero forbidden tokens', (_rel, src) => {
    const hits = scanForbidden(src);
    if (hits.length > 0) {
      const lines = hits
        .map((h) => `  line ${h.line} [${h.category}][${h.token}]: ${h.snippet}`)
        .join('\n');
      throw new Error(`banned tokens found:\n${lines}`);
    }
    expect(hits).toEqual([]);
  });
});

// ---------- (a.2) Raw-audio identifier ban ---------------------------------

describe('VOICE-005 raw-audio identifier ban', () => {
  const scanned = walkTs(VISUALIZER_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('no raw-audio field names or identifiers appear in the visualizer tree', () => {
    for (const { rel, src } of scanned) {
      for (const bad of RAW_AUDIO_BANS) {
        const re = new RegExp('\\b' + escapeRe(bad) + '\\b');
        if (re.test(src)) {
          throw new Error(`${rel} carries raw-audio identifier ${bad}`);
        }
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- (d) Pure-TS boundary + hook / import bans ---------------------

describe('VOICE-005 pure-TS boundary', () => {
  const scanned = walkTs(VISUALIZER_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('no forbidden imports in the visualizer tree', () => {
    for (const { rel, src } of scanned) {
      for (const bad of FORBIDDEN_IMPORT_FRAGMENTS) {
        if (src.includes(bad)) {
          throw new Error(`${rel} carries forbidden import fragment ${bad}`);
        }
      }
    }
    expect(true).toBe(true);
  });

  test('no React hook symbol appears in any visualizer file', () => {
    for (const { rel, src } of scanned) {
      for (const hook of FORBIDDEN_HOOKS) {
        const re = new RegExp('\\b' + escapeRe(hook) + '\\b');
        if (re.test(src)) {
          throw new Error(`${rel} carries React hook ${hook}`);
        }
      }
    }
    expect(true).toBe(true);
  });

  test('no forbidden runtime API', () => {
    for (const { rel, src } of scanned) {
      for (const bad of FORBIDDEN_APIS) {
        if (src.includes(bad)) {
          throw new Error(`${rel} carries forbidden runtime API ${bad}`);
        }
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- (e) Structural bans -------------------------------------------

describe('VOICE-005 structural bans', () => {
  const scanned = walkTs(VISUALIZER_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('no top-level let or var declarations in any visualizer file', () => {
    for (const { rel, src } of scanned) {
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        // Top-level means column 0 (no leading whitespace). Function-
        // scoped let / var inside indented blocks is allowed.
        if (/^(let|var)\s+/.test(line)) {
          throw new Error(`${rel}:${i + 1} top-level ${line.trim()}`);
        }
        // Also catch export let / export var.
        if (/^export\s+(let|var)\s+/.test(line)) {
          throw new Error(`${rel}:${i + 1} exported mutable ${line.trim()}`);
        }
      }
    }
    expect(true).toBe(true);
  });

  test('no Skia SVG-parser entry-point literal in any visualizer file', () => {
    for (const { rel, src } of scanned) {
      if (src.includes(SKIA_PARSER_BAN)) {
        throw new Error(`${rel} references the banned Skia parser literal`);
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- (g) Apostrophe-free comments ----------------------------------

describe('VOICE-005 apostrophe-free comments', () => {
  const scanned = walkTs(VISUALIZER_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('no apostrophe inside a // or block comment', () => {
    for (const { rel, src } of scanned) {
      const lines = src.split('\n');
      let inBlock = false;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        let commentText = '';
        if (inBlock) {
          const end = line.indexOf('*/');
          commentText += end === -1 ? line : line.slice(0, end);
          if (end !== -1) inBlock = false;
        }
        const blockStart = line.indexOf('/*');
        if (blockStart !== -1 && !inBlock) {
          const blockEnd = line.indexOf('*/', blockStart + 2);
          if (blockEnd === -1) {
            commentText += line.slice(blockStart + 2);
            inBlock = true;
          } else {
            commentText += line.slice(blockStart + 2, blockEnd);
          }
        }
        const lineIdx = line.indexOf('//');
        if (lineIdx !== -1) commentText += line.slice(lineIdx + 2);
        if (/'/.test(commentText)) {
          throw new Error(
            `${rel}:${i + 1} apostrophe in comment: ${line.trim()}`,
          );
        }
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- (f) FIRING POSITIVE CONTROL -----------------------------------

describe('VOICE-005 firing positive control - the scanner bites', () => {
  const fixturePath = join(REPO, POSITIVE_CONTROL_REL);
  const src = readFileSync(fixturePath, 'utf8');
  const hits = scanForbidden(src);

  test('the ts.txt fixture reports at least three distinct hits across three roles', () => {
    const distinctTokens = new Set(hits.map((h) => h.token));
    expect(distinctTokens.size).toBeGreaterThanOrEqual(3);
    const roles = { comment: 0, fieldName: 0, stringLiteral: 0 };
    for (const h of hits) {
      const trimmed = h.snippet;
      if (/^\s*\/\//.test(trimmed) || /^\s*\*/.test(trimmed)) roles.comment += 1;
      else if (/readonly\s+\w+\s*:/.test(trimmed)) roles.fieldName += 1;
      else if (/['"`]/.test(trimmed)) roles.stringLiteral += 1;
    }
    expect(roles.comment).toBeGreaterThanOrEqual(1);
    expect(roles.fieldName).toBeGreaterThanOrEqual(1);
    expect(roles.stringLiteral).toBeGreaterThanOrEqual(1);
  });

  test('the fixture carries at least one visualizer-specific ban', () => {
    const found = hits.some((h) => h.category === 'visualizerSpecific');
    expect(found).toBe(true);
  });

  test('the fixture carries at least one purity ban hit', () => {
    const found = hits.some((h) => h.category === 'purity');
    expect(found).toBe(true);
  });

  test('the fixture carries at least one non-basic-arith ban hit', () => {
    const found = hits.some((h) => h.category === 'nonBasicArith');
    expect(found).toBe(true);
  });

  test('the fixture carries the Skia SVG-parser ban hit', () => {
    const found = hits.some((h) => h.category === 'skiaParser');
    expect(found).toBe(true);
  });

  test('the ts.txt fixture is excluded from the production scan set', () => {
    const rels = walkTs(VISUALIZER_ROOT).map((full) =>
      relative(REPO, full).replace(/\\/g, '/'),
    );
    expect(rels).not.toContain(POSITIVE_CONTROL_REL);
  });
});
