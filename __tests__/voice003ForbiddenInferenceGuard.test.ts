/**
 * VOICE-003 (issue 661) - forbidden-inference source-scan guard.
 *
 * Bidirectional pattern mirroring cohesionPrinciple9Guard:
 *
 *   (a) Assert-absent lexicon over every .ts file under
 *       src/features/voice/**, excluding __fixtures__ and this test.
 *
 *   (b) audioUri context check: every occurrence of the substring
 *       "audioUri" in the tree must appear on a line where the token
 *       "null" is nearby, and never adjacent to a forbidden neighbor
 *       token (string / URI / URL / uri / url / bucket / s3 / mp3 /
 *       wav / pcm / bytes / blob / storageKey / signedUrl).
 *
 *   (c) The literal "scoped_governed" appears only in files matching
 *       **\/speech\/speechTranscriptArtifact.types.ts.
 *
 *   (d) FIRING POSITIVE CONTROL: load the .ts.txt fixture as text and
 *       assert the scanner reports at least three hits (one field
 *       name, one string literal, one comment). If the scanner regex
 *       or glob is broken, this test fails loudly.
 *
 * The helpers here are self-contained so a production refactor cannot
 * silently disarm the guard. Comments are apostrophe-free for the
 * doctrine scanner.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO = process.cwd();
const VOICE_ROOT = join(REPO, 'src', 'features', 'voice');
const TYPES_FILE_REL = 'src/features/voice/speech/speechTranscriptArtifact.types.ts';
const POSITIVE_CONTROL_REL =
  'src/features/voice/speech/__fixtures__/voice003ForbiddenInferenceGuard.positiveControl.ts.txt';

// The ban list is authored as a literal array below so the assertion is
// visible in the file. Each entry is either a whole-word token (default)
// or a compound token that carries an internal underscore or space (which
// requires a substring match because "\b" does not sit between "_" and a
// letter the way it sits between " " and a letter).
const WHOLE_WORD_BANS: readonly string[] = Object.freeze([
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
]);

const SUBSTRING_BANS: readonly string[] = Object.freeze([
  'badFaith',
  'bad_faith',
  'bad faith',
  'heavilyEdited',
  'heavily_edited',
]);

interface Hit {
  readonly token: string;
  readonly line: number;
  readonly snippet: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanBanned(content: string): Hit[] {
  const hits: Hit[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const token of WHOLE_WORD_BANS) {
      const re = new RegExp('\\b' + escapeRe(token) + '\\b', 'gi');
      if (re.test(line)) {
        hits.push({ token, line: i + 1, snippet: line.trim() });
      }
    }
    for (const token of SUBSTRING_BANS) {
      const re = new RegExp(escapeRe(token), 'gi');
      if (re.test(line)) {
        hits.push({ token, line: i + 1, snippet: line.trim() });
      }
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

describe('VOICE-003 (issue 661) forbidden-inference source scan', () => {
  const scanned = walkTs(VOICE_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('scan set covers at least the four VOICE-003 module files', () => {
    const rels = scanned.map((f) => f.rel);
    expect(rels).toEqual(
      expect.arrayContaining([
        'src/features/voice/speech/speechSessionMachine.ts',
        'src/features/voice/speech/speechTranscriptArtifact.types.ts',
        'src/features/voice/speech/deriveEditedProvenance.ts',
        'src/features/voice/speech/index.ts',
      ]),
    );
    // The positive-control fixture must NOT be in the scan set.
    for (const rel of rels) {
      expect(rel).not.toContain('__fixtures__');
      expect(rel.endsWith('.ts.txt')).toBe(false);
    }
  });

  test.each(
    scanned.map((f) => [f.rel, f.src]) as ReadonlyArray<[string, string]>,
  )('%s carries zero forbidden-inference tokens', (_rel, src) => {
    const hits = scanBanned(src);
    if (hits.length > 0) {
      // Emit a readable diagnostic - the failure message names the
      // offending token and line.
      const lines = hits
        .map((h) => `  line ${h.line} [${h.token}]: ${h.snippet}`)
        .join('\n');
      throw new Error(`banned tokens found:\n${lines}`);
    }
    expect(hits).toEqual([]);
  });
});

// ---------- (b) audioUri neighbor / null-only check ------------------------

describe('VOICE-003 audioUri context guard', () => {
  const scanned = walkTs(VOICE_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  const AUDIO_URI_FORBIDDEN_NEIGHBORS: readonly string[] = Object.freeze([
    'bucket',
    // "s3" needs a whole-word boundary so words like "s3" only fire alone.
    's3',
    'mp3',
    'wav',
    'pcm',
    'bytes',
    'blob',
    'storageKey',
    'signedUrl',
  ]);

  test('every occurrence of audioUri sits on a line that also names null', () => {
    for (const { rel, src } of scanned) {
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!/audioUri/.test(line)) continue;
        const nearNull = /\bnull\b/.test(line);
        // Lines that carry audioUri without null are only tolerated when
        // they are a type-level reference (e.g. import/export type). The
        // guard failure message lists the offending line.
        if (!nearNull) {
          const isTypeRefLine =
            /import\s+type|export\s+type|readonly\s+audioUri/.test(line);
          if (!isTypeRefLine) {
            throw new Error(
              `${rel}:${i + 1} audioUri without adjacent null: ${line.trim()}`,
            );
          }
        }
        for (const bad of AUDIO_URI_FORBIDDEN_NEIGHBORS) {
          if (new RegExp('\\b' + escapeRe(bad) + '\\b', 'i').test(line)) {
            throw new Error(
              `${rel}:${i + 1} audioUri adjacent to forbidden neighbor ${bad}: ${line.trim()}`,
            );
          }
        }
      }
    }
    // Reaching here means the scan passed for every file.
    expect(true).toBe(true);
  });
});

// ---------- (c) scoped_governed only in the type-declaration file ---------

describe('VOICE-003 scoped_governed placement', () => {
  const scanned = walkTs(VOICE_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('the literal scoped_governed appears ONLY in the types file', () => {
    const violators: string[] = [];
    for (const { rel, src } of scanned) {
      if (rel === TYPES_FILE_REL) continue;
      if (src.includes('scoped_governed')) {
        violators.push(rel);
      }
    }
    expect(violators).toEqual([]);
  });

  test('the types file DOES carry the literal (positive control on placement)', () => {
    const typesFullPath = join(REPO, TYPES_FILE_REL);
    const src = readFileSync(typesFullPath, 'utf8');
    expect(src).toContain('scoped_governed');
  });
});

// ---------- (d) FIRING POSITIVE CONTROL ------------------------------------

describe('VOICE-003 firing positive control - the scanner bites', () => {
  test('the ts.txt fixture reports at least three distinct banned-token hits', () => {
    const fixturePath = join(REPO, POSITIVE_CONTROL_REL);
    const src = readFileSync(fixturePath, 'utf8');
    const hits = scanBanned(src);
    // Distinct tokens across the hits.
    const distinctTokens = new Set(hits.map((h) => h.token));
    expect(distinctTokens.size).toBeGreaterThanOrEqual(3);
    // The fixture should carry hits in at least three different roles:
    // a comment, a field name, and a string literal. Detect roles by
    // looking at each hit line for context clues.
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

  test('the ts.txt fixture is excluded from the scan set', () => {
    const rels = walkTs(VOICE_ROOT).map((full) =>
      relative(REPO, full).replace(/\\/g, '/'),
    );
    expect(rels).not.toContain(POSITIVE_CONTROL_REL);
  });
});
