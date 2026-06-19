/**
 * UX-COPY-001 — visible CivilDiscourse rebrand + first-run clarity.
 *
 * Guards the v4 copy overhaul this card shipped:
 *   (a) the visible-UI surfaces touched here read "CivilDiscourse", never
 *       the legacy "CDiscourse";
 *   (b) the retired tagline "Just get to the bottom of it" is ABSENT from the
 *       changed UI / copy constants;
 *   (c) the Sign In / first-run surface includes "A high-trust room for hard
 *       conversations.";
 *   (d) production UI does NOT contain "Speak your response" (voice is not
 *       shipped);
 *   (e) the user-visible app/document title is not "expo-scaffold";
 *   (f) the user-facing copy this card touched is ban-list clean (no winner /
 *       loser / score / fallacy / wrong / dishonest / bad faith / manipulative /
 *       truth engine / AI judge / "Decide for me");
 *   (g) an internal-allowlist guard so the ban / brand scan does NOT
 *       false-positive on env vars, repo / package identifiers, issue refs,
 *       historic docs, code comments, or design-export references.
 *
 * Pure source/config scan (repo idiom). No render harness, no Supabase, no
 * secrets. The scan is scoped to the EXACT files this card changed so it never
 * reaches the deferred internal-identity surfaces (package.json name, the
 * app.json `slug`, the EXPO_PUBLIC_ prefix, the domain, Supabase / email
 * templates) — those stay `cdiscourse` per the card's deferral.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// The visible-copy surfaces UX-COPY-001 changed. Each is a user-facing string
// source (component, copy constant, model copy, or the display-field config).
const CHANGED_VISIBLE_COPY_FILES: ReadonlyArray<string> = Object.freeze([
  'src/lib/designTokens.ts',
  'src/lib/brandCopy.ts',
  'src/features/auth/AuthScreen.tsx',
  'src/features/navigation/AboutScreen.tsx',
  'src/components/AppHeader.tsx',
  'src/features/arguments/ArgumentScoreTracker.tsx',
  'src/features/arguments/ComposerValidationPanel.tsx',
  'src/features/arguments/gameCopy.ts',
  'src/features/demoCorridor/corridorModel.ts',
  'src/features/invites/inviteCopy.ts',
  'src/features/invites/InviteRedeemGate.tsx',
  'src/features/invites/InviteCredentialStep.tsx',
  'src/features/devEnvironment/DevEnvironmentBanner.tsx',
]);

/**
 * §5g — internal-allowlist guard. Strip the parts of a source file that are
 * NOT user-facing copy before brand/ban scanning, so the scan asserts about
 * what the user reads, not repo plumbing. Stripped:
 *   - comment lines AND comment-block continuations (`/* … *​/`, `// …`, and
 *     lines inside an open block comment — doc comments deliberately name the
 *     retired strings);
 *   - import / require lines (paths legitimately contain `cdiscourse`);
 *   - testID lines (code identifiers, not prose);
 *   - ban-list / forbidden-token ARRAY bodies (these define the doctrine
 *     vocabulary — e.g. `FORBIDDEN_TOKEN_TOKENS = ['winner', …]` — and any
 *     line flagged `// ux-audit-ignore-line`).
 */
function userFacingTextOnly(src: string): string {
  const out: string[] = [];
  let inBlockComment = false;
  let inBanListArray = false;
  for (const line of src.split('\n')) {
    const t = line.trim();

    // Track multi-line block comments.
    if (inBlockComment) {
      if (t.includes('*/')) inBlockComment = false;
      continue;
    }
    if (t.startsWith('/*') && !t.includes('*/')) {
      inBlockComment = true;
      continue;
    }
    // Single-line comments + single-line block comments + comment continuations.
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    // A JSX/comment continuation that closes a block on this line (e.g.
    // `... copy). */}`): drop it too.
    if (t.includes('*/') || t.includes('*/}')) continue;
    if (/\/\/\s*ux-audit-ignore-line/.test(line)) continue;

    // Track ban-list / forbidden-token array bodies (doctrine vocabulary, not
    // user copy). Enter on a const-array opener whose NAME contains
    // forbidden/banned (e.g. `FORBIDDEN_TOKEN_TOKENS … = [`,
    // `BANNED_INVITE_FRAMING = [`) and which ends by opening an array literal,
    // exit on the array's closing bracket.
    if (/\b(forbidden|banned)\w*\b/i.test(line) && /=\s*\[\s*$/.test(line)) {
      inBanListArray = true;
      continue;
    }
    if (inBanListArray) {
      if (t.startsWith(']')) inBanListArray = false;
      continue;
    }

    // Drop import / require lines (paths legitimately contain `cdiscourse`).
    if (/^import\s/.test(t) || /require\(/.test(t)) continue;
    // Drop testID lines (code identifiers, not prose).
    if (/testID=/.test(t)) continue;

    out.push(line);
  }
  return out.join('\n');
}

describe('UX-COPY-001 (a) — visible brand reads CivilDiscourse, not legacy CDiscourse', () => {
  for (const rel of CHANGED_VISIBLE_COPY_FILES) {
    it(`${rel} — no user-facing "CDiscourse" (only CivilDiscourse)`, () => {
      const visible = userFacingTextOnly(read(rel));
      // Match a standalone "CDiscourse" NOT preceded by "Civil" and NOT part of
      // an identifier like CDiscourseRuntimeEnv. A user-facing occurrence is a
      // word boundary on both sides.
      const offenders = visible.match(/(?<!Civil)\bCDiscourse\b(?!Runtime|RuntimeEnv)/g) ?? [];
      expect(offenders).toEqual([]);
    });
  }

  it('the brandCopy product name constant is "CivilDiscourse"', () => {
    expect(read('src/lib/brandCopy.ts')).toContain("export const PRODUCT_NAME = 'CivilDiscourse'");
  });
});

describe('UX-COPY-001 (b) — retired tagline is absent from changed copy', () => {
  for (const rel of CHANGED_VISIBLE_COPY_FILES) {
    it(`${rel} — no user-facing "Just get to the bottom of it"`, () => {
      const visible = userFacingTextOnly(read(rel)).toLowerCase();
      expect(visible).not.toContain('just get to the bottom of it');
      expect(visible).not.toContain('bottom of it');
    });
  }
});

describe('UX-COPY-001 (c) — Sign In / first-run includes the high-trust tagline', () => {
  it('brandCopy carries the v4 primary tagline', () => {
    const brand = read('src/lib/brandCopy.ts');
    expect(brand).toContain('A high-trust room for hard conversations.');
  });

  // QUICK-COPY-001 — the three-beat sub-explanation + the mediator-not-a-judge
  // footer were removed (constants + AUTH_FIRST_RUN_COPY keys) and the Sign In
  // value-prop card is now the lockup + tagline only. They had no other
  // consumer, so the constants are gone from brandCopy entirely.
  it('brandCopy no longer carries the three-beat sub-explanation or mediator footer copy', () => {
    const brand = read('src/lib/brandCopy.ts');
    expect(brand).not.toContain('Mark the point. Respond clearly. See what remains unresolved.');
    expect(brand).not.toMatch(/mediator, not a judge/i);
    expect(brand).not.toMatch(/We surface the structure of a disagreement/i);
    // The AUTH_FIRST_RUN_COPY block is the lockup brand + tagline only now.
    expect(brand).toMatch(/brand:\s*PRODUCT_NAME/);
    expect(brand).toMatch(/tagline:\s*PRIMARY_TAGLINE/);
    expect(brand).not.toMatch(/subline:/);
    expect(brand).not.toMatch(/mediatorFooter:/);
  });

  it('the masthead tagline fixture is the v4 high-trust line', () => {
    expect(read('src/lib/designTokens.ts')).toContain(
      "taglineText: 'A high-trust room for hard conversations.'",
    );
  });

  it('AuthScreen wires the first-run copy block', () => {
    const auth = read('src/features/auth/AuthScreen.tsx');
    expect(auth).toContain('AUTH_FIRST_RUN_COPY');
    expect(auth).toContain('auth-value-prop');
  });
});

describe('UX-COPY-001 (d) — no voice copy in production UI (voice not shipped)', () => {
  for (const rel of CHANGED_VISIBLE_COPY_FILES) {
    it(`${rel} — no "Speak your response"`, () => {
      // Scan user-facing text only: the brandCopy doc comment names the voice
      // caveat on purpose; the stripper removes it.
      expect(userFacingTextOnly(read(rel)).toLowerCase()).not.toContain('speak your response');
    });
  }
});

describe('UX-COPY-001 (e) — visible app/document title is not the scaffold', () => {
  const appJson = JSON.parse(read('app.json')) as {
    expo: { name: string; slug: string; web?: { name?: string } };
  };

  it('expo.name (OS app label) is CivilDiscourse, not expo-scaffold', () => {
    expect(appJson.expo.name).toBe('CivilDiscourse');
    expect(appJson.expo.name.toLowerCase()).not.toContain('scaffold');
  });

  it('expo.web.name (browser tab / PWA title) is CivilDiscourse, not expo-scaffold', () => {
    expect(appJson.expo.web?.name).toBe('CivilDiscourse');
    expect(String(appJson.expo.web?.name).toLowerCase()).not.toContain('scaffold');
  });

  it('the deploy/EAS slug stays the deferred internal identifier (NOT renamed)', () => {
    // Deferred-identity guard: slug is build/OTA identity, not display copy.
    expect(appJson.expo.slug).toBe('expo-scaffold');
  });
});

describe('UX-COPY-001 (f) — changed user-facing copy is ban-list clean', () => {
  // Verdict / popularity / person-judgment tokens forbidden in visible copy.
  // These are matched as whole words against user-facing text only (§5g).
  const BANNED = [
    'winner', 'loser', 'fallacy', 'dishonest', 'bad faith', 'manipulati',
    'truth engine', 'ai judge', 'decide for me',
  ] as const;

  for (const rel of CHANGED_VISIBLE_COPY_FILES) {
    it(`${rel} — no verdict / popularity tokens in user-facing copy`, () => {
      const visible = userFacingTextOnly(read(rel)).toLowerCase();
      for (const token of BANNED) {
        expect(visible).not.toContain(token);
      }
    });
  }

  it('the de-scored ArgumentScoreTracker shows no "Score" / "Standings" visible label', () => {
    const visible = userFacingTextOnly(read('src/features/arguments/ArgumentScoreTracker.tsx'));
    // The visible <Text> labels must not say "Score" or "Standings".
    expect(visible).not.toMatch(/>\s*Score tracker/);
    expect(visible).not.toMatch(/Standings · gameplay/);
    // UX-ROOM-CHROME-001 — the prior "Where the points stand · gameplay
    // analysis" framing is retired in favor of the neutral mediator-readout
    // label so the room reads as a mediator surface, not a game scoreboard.
    expect(visible).not.toMatch(/Where the points stand · gameplay analysis/);
    expect(visible).toMatch(/Mediator readout/);
  });

  it('the softened concession + feedback copy drops "wrong" / "honest"', () => {
    const gameCopy = read('src/features/arguments/gameCopy.ts');
    expect(gameCopy).not.toContain("I'm only MOSTLY wrong");
    expect(gameCopy).not.toContain('an honest move');
    expect(gameCopy).toContain('I overstated part of this');
    expect(gameCopy).toContain('a clarifying move');
  });

  it('the de-scored STATUS_COPY uses structural support framing, not "ahead"', () => {
    const gameCopy = read('src/features/arguments/gameCopy.ts');
    expect(gameCopy).toContain("currentlyAhead: 'More support so far'");
    expect(gameCopy).toContain("moreSupported: 'Better supported point'");
  });
});

describe('UX-COPY-001 (g) — internal-allowlist guard does not false-positive', () => {
  it('the user-facing scan ignores import paths, comments, and testIDs', () => {
    // designTokens.ts legitimately contains the legacy "CDiscourse" word in a
    // comment ("any other CDiscourse surface"); the scan must NOT flag it.
    const raw = read('src/lib/designTokens.ts');
    expect(raw).toMatch(/CDiscourse surface/); // present in a comment
    const visible = userFacingTextOnly(raw);
    expect(visible).not.toMatch(/CDiscourse surface/); // stripped by the guard
  });

  it('the scan permits deferred internal identifiers (CDiscourseRuntimeEnv)', () => {
    // supabase.ts uses the `CDiscourseRuntimeEnv` interface name — an internal
    // code identifier, not user copy. It is NOT in the changed-files list and
    // the guard regex excludes the `Runtime`/`RuntimeEnv` suffix anyway.
    const offenders =
      'export interface CDiscourseRuntimeEnv {}'.match(/(?<!Civil)\bCDiscourse\b(?!Runtime|RuntimeEnv)/g) ?? [];
    expect(offenders).toEqual([]);
  });

  it('the changed-files list excludes deferred internal-identity surfaces', () => {
    for (const rel of CHANGED_VISIBLE_COPY_FILES) {
      expect(rel).not.toBe('package.json');
      expect(rel).not.toContain('supabase/');
      expect(rel).not.toContain('email');
    }
  });
});
