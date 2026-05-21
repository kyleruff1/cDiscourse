/**
 * IX-001 — source-scan: the model file is pure TS.
 *
 * `timelineDensityLensModel.ts` must have no value import of React,
 * react-native, Supabase, Expo, or a router; no network call; no
 * `Date.now()`; no `console.log`; no secret reference. It imports its
 * consumed contracts as TYPE-ONLY. It lives in `src/features/arguments/`,
 * not a new directory. `TimelineDensityMode` must still have exactly 3
 * members so VG-004 / PR-001 / QOL-033 are not forked (design §14).
 */
import * as fs from 'fs';
import * as path from 'path';

import { ALL_TIMELINE_DENSITY_MODES } from '../src/features/arguments/timelineNodeVisualModel';

const ARGUMENTS_DIR = path.join(__dirname, '..', 'src', 'features', 'arguments');
const MODEL_PATH = path.join(ARGUMENTS_DIR, 'timelineDensityLensModel.ts');
const MODEL_SOURCE = fs.readFileSync(MODEL_PATH, 'utf8');

/**
 * Strip block and line comments so a scan for a code-shape pattern (e.g.
 * `Date.now(`) is not tripped by a comment that documents the rule —
 * "never calls Date.now() here" is a doc, not a call.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const MODEL_CODE = stripComments(MODEL_SOURCE);

describe('timelineDensityLensModel.ts — purity', () => {
  it('lives in src/features/arguments/, not a new directory', () => {
    expect(fs.existsSync(MODEL_PATH)).toBe(true);
  });

  it('has no value import of react', () => {
    // A type-only import is fine; a value import is not. The model imports
    // no React at all.
    expect(/import\s+(?!type\b)[^;]*from\s+['"]react['"]/.test(MODEL_CODE)).toBe(false);
  });

  it('has no import of react-native', () => {
    expect(/from\s+['"]react-native['"]/.test(MODEL_CODE)).toBe(false);
  });

  it('has no import of @supabase/supabase-js or a supabase client module', () => {
    expect(/from\s+['"]@supabase\/supabase-js['"]/.test(MODEL_CODE)).toBe(false);
    expect(/from\s+['"][^'"]*supabaseClient['"]/.test(MODEL_CODE)).toBe(false);
  });

  it('has no import of an expo package or a router', () => {
    expect(/from\s+['"]expo[-/][^'"]*['"]/.test(MODEL_CODE)).toBe(false);
    expect(/from\s+['"]expo-router['"]/.test(MODEL_CODE)).toBe(false);
    expect(/from\s+['"]@react-navigation[^'"]*['"]/.test(MODEL_CODE)).toBe(false);
  });

  it('makes no network call and references no Linking', () => {
    expect(/\bfetch\s*\(/.test(MODEL_CODE)).toBe(false);
    expect(/\bXMLHttpRequest\b/.test(MODEL_CODE)).toBe(false);
    expect(/\bLinking\b/.test(MODEL_CODE)).toBe(false);
  });

  it('never calls Date.now() — recency uses an injected ctx.nowMs', () => {
    expect(/Date\.now\s*\(/.test(MODEL_CODE)).toBe(false);
  });

  it('contains no console.log', () => {
    expect(/console\.log\s*\(/.test(MODEL_CODE)).toBe(false);
  });

  it('references no secret or service-role token', () => {
    expect(/ANTHROPIC_API_KEY/.test(MODEL_CODE)).toBe(false);
    expect(/XAI_API_KEY/.test(MODEL_CODE)).toBe(false);
    expect(/SERVICE_ROLE/.test(MODEL_CODE)).toBe(false);
  });

  it('imports its consumed gallery / lifecycle / node contracts as type-only', () => {
    // The model must not value-import the re-derivers
    // (buildConversationGalleryCards / resolveNodeGapPx). It imports only
    // the TYPES it projects over.
    expect(MODEL_CODE).toMatch(
      /import\s+type\s+\{[^}]*ConversationGalleryCard[^}]*\}\s+from\s+['"][^'"]*conversationGalleryModel['"]/,
    );
    expect(MODEL_CODE).toMatch(
      /import\s+type\s+\{[^}]*TimelineDensityMode[^}]*\}\s+from\s+['"][^'"]*timelineNodeVisualModel['"]/,
    );
    // Never a VALUE import of the gallery builder or the spacing resolver.
    expect(/import\s+\{[^}]*buildConversationGalleryCards/.test(MODEL_CODE)).toBe(false);
    expect(/import\s+\{[^}]*resolveNodeGapPx/.test(MODEL_CODE)).toBe(false);
  });
});

describe('VG-004 TimelineDensityMode is NOT forked by IX-001', () => {
  it('TimelineDensityMode still has exactly its 3 shipped members', () => {
    expect([...ALL_TIMELINE_DENSITY_MODES].sort()).toEqual(['compact', 'expanded', 'normal']);
  });
});
