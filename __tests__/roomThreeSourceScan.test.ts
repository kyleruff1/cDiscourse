/**
 * ROOM-003 (#829) — source scans over the three new source files.
 *
 * Guards the card boundaries: no audio-API import (the mic slot is reserved
 * + disabled; VOICE-UI-001 fills it), no console.log, no dynamic process.env
 * reads, comments apostrophe-free (the doctrine-scanner quote-parity gotcha),
 * and the pure model imports no React / Supabase / network primitive.
 */
import fs from 'fs';
import path from 'path';

const COMPOSER_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'composer');

const BAR_SRC = fs.readFileSync(path.join(COMPOSER_DIR, 'ArgumentEntryComposer.tsx'), 'utf8');
const MODEL_SRC = fs.readFileSync(path.join(COMPOSER_DIR, 'argumentEntryComposerModel.ts'), 'utf8');
const HOOK_SRC = fs.readFileSync(path.join(COMPOSER_DIR, 'useEntryComposerSubmit.ts'), 'utf8');

const NEW_SOURCES: { name: string; src: string }[] = [
  { name: 'ArgumentEntryComposer.tsx', src: BAR_SRC },
  { name: 'argumentEntryComposerModel.ts', src: MODEL_SRC },
  { name: 'useEntryComposerSubmit.ts', src: HOOK_SRC },
];

/** Collect block + line comments (line comments not preceded by a colon so
 *  URL schemes like https:// do not register). */
function collectComments(src: string): string[] {
  const comments: string[] = [];
  const block = src.match(/\/\*[\s\S]*?\*\//g) ?? [];
  comments.push(...block);
  const lineRe = /(^|[^:])\/\/([^\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(src)) !== null) comments.push(m[2]);
  return comments;
}

describe('ROOM-003 source scans — the three new files', () => {
  it('the bar imports no audio API (mic slot is reserved + disabled)', () => {
    expect(/expo-av|expo-audio|expo-speech-recognition|expo-speech/.test(BAR_SRC)).toBe(false);
    expect(/MediaRecorder|getUserMedia|navigator\.mediaDevices/.test(BAR_SRC)).toBe(false);
  });

  it('no new file contains a console.log', () => {
    for (const { name, src } of NEW_SOURCES) {
      expect({ name, hit: /console\.log/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('no new file reads a dynamic process.env[...] (static inlining discipline)', () => {
    for (const { name, src } of NEW_SOURCES) {
      expect({ name, hit: /process\.env\[/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('comments in all three new files are apostrophe-free (doctrine-scanner gotcha)', () => {
    for (const { name, src } of NEW_SOURCES) {
      for (const comment of collectComments(src)) {
        expect({ name, comment, hasApostrophe: comment.includes("'") }).toEqual({
          name,
          comment,
          hasApostrophe: false,
        });
      }
    }
  });

  it('the pure model imports no React / React Native / Supabase / network primitive', () => {
    const noComments = MODEL_SRC.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(/from ['"]react(-native)?['"]/.test(noComments)).toBe(false);
    expect(/from ['"][^'"]*supabase/.test(noComments)).toBe(false);
    expect(/\bfetch\(/.test(noComments)).toBe(false);
    expect(/anthropic|openai|x\.ai/i.test(noComments)).toBe(false);
  });

  it('no new file uses the service role or writes public.arguments directly', () => {
    for (const { name, src } of NEW_SOURCES) {
      const noComments = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      expect({ name, hit: /SERVICE_ROLE|service_role/.test(noComments) }).toEqual({ name, hit: false });
      expect({ name, hit: /\.from\(['"]arguments['"]\)/.test(noComments) }).toEqual({ name, hit: false });
    }
  });
});
