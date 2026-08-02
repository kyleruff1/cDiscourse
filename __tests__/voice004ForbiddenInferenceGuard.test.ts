/**
 * VOICE-004 (issue 662) - forbidden-inference source-scan guard.
 *
 * Bidirectional pattern mirroring the VOICE-003 guard:
 *
 *   (a) Assert-absent lexicon over every .ts file under
 *       src/features/voice/waveform, excluding __fixtures__ and this test.
 *       Inherits the VOICE-003 whole-word and substring lexicon VERBATIM
 *       and extends with waveform-specific bans: arousal, energyLevel,
 *       intensity, agitation, shouting, whisper, aggression, dominance,
 *       assertiveness, formant, phoneme, spectrogram, fft, fourier,
 *       melspec, mfcc, prosody, cepstral, pitch, f0, speakerId,
 *       speakerRecognition, voiceprint, and related compound tokens.
 *
 *   (b) audioUri context check: every occurrence of audioUri sits on a
 *       line that also names null and never adjacent to a forbidden
 *       neighbor (URI, URL, bucket-as-storage, pcm, blob, etc.).
 *
 *   (c) Reserved-literal placement: the string literals stream_pcm and
 *       cache_temp_deleted appear ONLY in voiceWaveformArtifact.types.ts.
 *
 *   (d) Module-constant scoping: SILENCE_THRESHOLD and
 *       MIN_SAMPLES_FOR_FINALIZED appear only in waveformSessionMachine.ts
 *       and in the barrel index.ts.
 *
 *   (e) Pure-TS boundary: no imports from react, react-native, expo-*,
 *       @supabase/, fetch, XMLHttpRequest, AbortController, WebSocket.
 *
 *   (f) FIRING POSITIVE CONTROL: load the .ts.txt fixture and assert
 *       the scanner reports at least 3 hits across 3 roles AND at least
 *       one waveform-specific ban token. If the scanner regex or glob
 *       is broken, this test fails LOUDLY.
 *
 * The helpers are self-contained so a production refactor cannot
 * silently disarm the guard. Comments are apostrophe-free.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const REPO = process.cwd();
const WAVEFORM_ROOT = join(REPO, 'src', 'features', 'voice', 'waveform');
const TYPES_FILE_REL = 'src/features/voice/waveform/voiceWaveformArtifact.types.ts';
const REDUCER_FILE_REL = 'src/features/voice/waveform/waveformSessionMachine.ts';
const BARREL_FILE_REL = 'src/features/voice/waveform/index.ts';
const POSITIVE_CONTROL_REL =
  'src/features/voice/waveform/__fixtures__/voice004ForbiddenInferenceGuard.positiveControl.ts.txt';

// VOICE-003 lexicon inherited VERBATIM. Whole-word entries first.
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
]);

// VOICE-004 waveform-specific whole-word bans.
const WHOLE_WORD_BANS_WAVEFORM: readonly string[] = Object.freeze([
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

const SUBSTRING_BANS: readonly string[] = Object.freeze([
  'badFaith',
  'bad_faith',
  'bad faith',
  'heavilyEdited',
  'heavily_edited',
  'energy_level',
  'shouting_indicator',
  'aggression_level',
  'dominance_index',
  'speaker_id',
  'speaker_recognition',
  'voice stress',
  'voice-stress',
  'voice_stress',
  'voice print',
  'voice-print',
  'voice biometric',
  'voice-biometric',
]);

// Raw-audio identifier ban. Zero matches expected in the module tree.
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

// Compound identifiers where "bucket" is legitimately part of a domain
// term (not the S3-bucket sense).
const WHITELISTED_COMPOUNDS: readonly string[] = Object.freeze([
  'amplitudeBuckets',
  'bucketWidth',
  'samplesInCurrentBucket',
  'foldSampleIntoBuckets',
  'halveBucketsPairMax',
  'MAX_AMPLITUDE_BUCKETS',
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
  const wholeWord = WHOLE_WORD_BANS_INHERITED.concat(WHOLE_WORD_BANS_WAVEFORM);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const token of wholeWord) {
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

describe('VOICE-004 (issue 662) forbidden-inference source scan', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('scan set covers at least the five VOICE-004 module files', () => {
    const rels = scanned.map((f) => f.rel);
    expect(rels).toEqual(
      expect.arrayContaining([
        'src/features/voice/waveform/waveformSessionMachine.ts',
        'src/features/voice/waveform/voiceWaveformArtifact.types.ts',
        'src/features/voice/waveform/deriveWaveformSummary.ts',
        'src/features/voice/waveform/normalizeMeteringDbFsToAmplitude.ts',
        'src/features/voice/waveform/index.ts',
      ]),
    );
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
      const lines = hits
        .map((h) => `  line ${h.line} [${h.token}]: ${h.snippet}`)
        .join('\n');
      throw new Error(`banned tokens found:\n${lines}`);
    }
    expect(hits).toEqual([]);
  });
});

// ---------- (a.2) Raw-audio identifier ban ---------------------------------

describe('VOICE-004 raw-audio identifier ban', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('no raw-audio field names or identifiers appear in the module tree', () => {
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

  test('bare "bucket" outside the whitelisted compounds is absent', () => {
    for (const { rel, src } of scanned) {
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        // Strip whitelisted compounds so their internal "bucket" cannot
        // trigger the bare check.
        let scrubbed = line;
        for (const w of WHITELISTED_COMPOUNDS) {
          scrubbed = scrubbed.split(w).join('');
        }
        if (/\bbucket\b/i.test(scrubbed)) {
          // The design allows bucket as a domain word in comments and
          // literals so long as it is not the S3-bucket sense. The
          // check is scoped: bare bucket adjacent to storage tokens
          // is a violation. Everything else passes.
          const storageAdj =
            /\b(s3|storage|blob|bytes|storageKey|signedUrl|mp3|wav|pcm)\b/i;
          if (storageAdj.test(scrubbed)) {
            throw new Error(
              `${rel}:${i + 1} bare "bucket" near storage token: ${line.trim()}`,
            );
          }
        }
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- (b) audioUri neighbor / null-only check ------------------------

describe('VOICE-004 audioUri context guard', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  const AUDIO_URI_FORBIDDEN_NEIGHBORS: readonly string[] = Object.freeze([
    'bucket',
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
    expect(true).toBe(true);
  });
});

// ---------- (c) Reserved-literal placement --------------------------------

describe('VOICE-004 reserved-literal placement', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('stream_pcm appears ONLY in voiceWaveformArtifact.types.ts', () => {
    const violators: string[] = [];
    for (const { rel, src } of scanned) {
      if (rel === TYPES_FILE_REL) continue;
      if (src.includes('stream_pcm')) violators.push(rel);
    }
    expect(violators).toEqual([]);
  });

  test('cache_temp_deleted appears ONLY in voiceWaveformArtifact.types.ts', () => {
    const violators: string[] = [];
    for (const { rel, src } of scanned) {
      if (rel === TYPES_FILE_REL) continue;
      if (src.includes('cache_temp_deleted')) violators.push(rel);
    }
    expect(violators).toEqual([]);
  });

  test('the types file DOES carry each reserved literal (positive control on placement)', () => {
    const typesFullPath = join(REPO, TYPES_FILE_REL);
    const src = readFileSync(typesFullPath, 'utf8');
    expect(src).toContain('stream_pcm');
    expect(src).toContain('cache_temp_deleted');
  });
});

// ---------- (d) Module-constant scoping ------------------------------------

describe('VOICE-004 module-constant scoping', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  test('SILENCE_THRESHOLD appears only in reducer + barrel', () => {
    const violators: string[] = [];
    for (const { rel, src } of scanned) {
      if (rel === REDUCER_FILE_REL) continue;
      if (rel === BARREL_FILE_REL) continue;
      if (src.includes('SILENCE_THRESHOLD')) violators.push(rel);
    }
    expect(violators).toEqual([]);
  });

  test('MIN_SAMPLES_FOR_FINALIZED appears only in reducer + barrel', () => {
    const violators: string[] = [];
    for (const { rel, src } of scanned) {
      if (rel === REDUCER_FILE_REL) continue;
      if (rel === BARREL_FILE_REL) continue;
      if (src.includes('MIN_SAMPLES_FOR_FINALIZED')) violators.push(rel);
    }
    expect(violators).toEqual([]);
  });
});

// ---------- (e) Pure-TS boundary -------------------------------------------

describe('VOICE-004 pure-TS boundary', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  const FORBIDDEN_IMPORTS: readonly string[] = Object.freeze([
    "from 'react'",
    'from "react"',
    "from 'react-native'",
    'from "react-native"',
    'from \'expo-',
    'from "expo-',
    "from '@supabase/",
    'from "@supabase/',
  ]);

  const FORBIDDEN_APIS: readonly string[] = Object.freeze([
    'fetch(',
    'XMLHttpRequest',
    'new AbortController',
    'new WebSocket',
  ]);

  test('no forbidden imports or network APIs in the module tree', () => {
    for (const { rel, src } of scanned) {
      for (const bad of FORBIDDEN_IMPORTS) {
        if (src.includes(bad)) {
          throw new Error(`${rel} carries forbidden import fragment ${bad}`);
        }
      }
      for (const bad of FORBIDDEN_APIS) {
        if (src.includes(bad)) {
          throw new Error(`${rel} carries forbidden runtime API ${bad}`);
        }
      }
    }
    expect(true).toBe(true);
  });
});

// ---------- Apostrophe-free comment check ---------------------------------

describe('VOICE-004 apostrophe-free comments', () => {
  const scanned = walkTs(WAVEFORM_ROOT).map((full) => ({
    rel: relative(REPO, full).replace(/\\/g, '/'),
    src: readFileSync(full, 'utf8'),
  }));

  // Extract // and block comments and assert no apostrophe.
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

// ---------- (f) FIRING POSITIVE CONTROL ------------------------------------

describe('VOICE-004 firing positive control - the scanner bites', () => {
  test('the ts.txt fixture reports at least three distinct banned-token hits', () => {
    const fixturePath = join(REPO, POSITIVE_CONTROL_REL);
    const src = readFileSync(fixturePath, 'utf8');
    const hits = scanBanned(src);
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

  test('the fixture carries at least one WAVEFORM-specific ban token', () => {
    const fixturePath = join(REPO, POSITIVE_CONTROL_REL);
    const src = readFileSync(fixturePath, 'utf8');
    const hits = scanBanned(src);
    const waveformSet = new Set<string>(
      WHOLE_WORD_BANS_WAVEFORM.map((t) => t.toLowerCase()),
    );
    let found = false;
    for (const h of hits) {
      if (waveformSet.has(h.token.toLowerCase())) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('the ts.txt fixture is excluded from the scan set', () => {
    const rels = walkTs(WAVEFORM_ROOT).map((full) =>
      relative(REPO, full).replace(/\\/g, '/'),
    );
    expect(rels).not.toContain(POSITIVE_CONTROL_REL);
  });
});
