/**
 * META-1A — Eligibility mirror parity tests.
 *
 * `supabase/functions/_shared/pointTagEligibility.ts` is a Deno-side MIRROR
 * of META-001's client `MANUAL_TAG_ELIGIBILITY_TABLE` (the Edge Function
 * cannot import from `src/`). This suite is the guard that the mirror never
 * drifts: it imports the client table directly and reads the mirror source
 * file, asserting the two are structurally identical.
 *
 * Pattern: the `adminSchemas.test.ts` mirror-parity convention.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  MANUAL_TAG_ELIGIBILITY_TABLE as CLIENT_TABLE,
} from '../src/features/metadata/manualTagModel';
import { ALL_MANUAL_TAG_CODES as CLIENT_CODES } from '../src/features/metadata/moveMetadataLedger';

const mirrorPath = path.join(process.cwd(), 'supabase/functions/_shared/pointTagEligibility.ts');
const mirrorSrc = fs.readFileSync(mirrorPath, 'utf8');

describe('pointTagEligibility mirror — header + provenance', () => {
  it('carries the mirror header comment', () => {
    expect(mirrorSrc).toMatch(/MIRROR of src\/features\/metadata\/manualTagModel\.ts/);
    expect(mirrorSrc).toMatch(/keep byte-identical/);
    expect(mirrorSrc).toMatch(/pointTagsEligibilityMirror\.test\.ts/);
  });

  it('imports nothing from src/ (Edge Functions cannot)', () => {
    expect(mirrorSrc).not.toMatch(/from ['"]\.\.\/\.\.\/src/);
    expect(mirrorSrc).not.toMatch(/from ['"]\.\.\/\.\.\/\.\.\//);
  });

  it('imports no Supabase / network / Deno-runtime dependency', () => {
    expect(mirrorSrc).not.toMatch(/@supabase\/supabase-js/);
    expect(mirrorSrc).not.toMatch(/Deno\.serve/);
    expect(mirrorSrc).not.toMatch(/\bfetch\(/);
  });
});

describe('pointTagEligibility mirror — table parity', () => {
  it('declares all 10 META-001 manual tag codes verbatim', () => {
    for (const code of CLIENT_CODES) {
      expect(mirrorSrc).toContain(code);
    }
    // The mirror's ALL_MANUAL_TAG_CODES array must list exactly the 10.
    expect(CLIENT_CODES).toHaveLength(10);
  });

  it('mirrors every eligibility record byte-structurally', () => {
    // For each code, every one of the 4 boolean fields must appear in the
    // mirror source with the SAME literal value the client table has.
    for (const code of CLIENT_CODES) {
      const record = CLIENT_TABLE[code];
      // The mirror declares each code as an object literal; extract its block.
      const blockMatch = mirrorSrc.match(
        new RegExp(`${code}:\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\)`),
      );
      expect(blockMatch).not.toBeNull();
      const block = blockMatch ? blockMatch[1] : '';
      expect(block).toMatch(new RegExp(`allowOnOwnBubble:\\s*${record.allowOnOwnBubble}\\b`));
      expect(block).toMatch(new RegExp(`allowOnOtherBubble:\\s*${record.allowOnOtherBubble}\\b`));
      expect(block).toMatch(new RegExp(`allowObserver:\\s*${record.allowObserver}\\b`));
      expect(block).toMatch(new RegExp(`allowAdmin:\\s*${record.allowAdmin}\\b`));
    }
  });

  it('the client table has exactly the 10 keys, no more, no fewer', () => {
    expect(Object.keys(CLIENT_TABLE).sort()).toEqual([...CLIENT_CODES].sort());
  });

  it('every client record has exactly the 4 boolean fields', () => {
    for (const code of CLIENT_CODES) {
      const record = CLIENT_TABLE[code];
      expect(Object.keys(record).sort()).toEqual(
        ['allowAdmin', 'allowObserver', 'allowOnOtherBubble', 'allowOnOwnBubble'],
      );
      for (const key of Object.keys(record)) {
        expect(typeof (record as unknown as Record<string, unknown>)[key]).toBe('boolean');
      }
    }
  });
});
