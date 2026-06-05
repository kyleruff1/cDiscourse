/**
 * DEVEX-DOC-GUARD-TESTS-001 (#496) — Test 3
 *
 * Guards `docs/testing-runs/2026-06-03-corpus-30-human-review.md` (the #474
 * human review board). Patterned after `__tests__/corpus30RunReportLeakage.test.ts`:
 * fs.readFileSync the committed doc, run leak-shape regexes, assert zero
 * substantive hits. This board is leak-sensitive because the operator fills
 * ≥10 of 30 rows post-merge — each edit is a fresh leak surface — so the guard
 * runs in CI, not just at review time.
 *
 * Doctrine: cdiscourse-doctrine §1 (no truth labels), §3 (popularity ≠ evidence),
 * §6 (secrets), §10a (no Allegation-shaped X content surfaced) + the operator's
 * settled `policy_no_censorship`. Per `policy_no_censorship`, the test does NOT
 * scan for "hostile rhetoric" — only structural leak patterns and the
 * not-a-suppression-workflow invariant.
 *
 * Acceptance-gate invariant (verbatim, restated for this guard):
 *   "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The
 *    deterministic rules engine, src/lib/constitution/engine.ts, is the sole
 *    gate. Classifiers run after an argument is stored. No path may block,
 *    reject, route, or delay an ordinary user post."
 * This is a CI guard over documentation — no submission path, no family state,
 * no planner.
 *
 * §4-A failure semantics: if any assertion fails on the committed doc, do NOT
 * loosen the regex and do NOT edit the guarded doc. Report the failing
 * assertion + the tripping line and HALT.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const DOC_REL = 'docs/testing-runs/2026-06-03-corpus-30-human-review.md';
const DOC_ABS = path.join(REPO_ROOT, DOC_REL);

// --- Leak-shape patterns -----------------------------------------------------

const X_HANDLE = /(?<![A-Za-z0-9_])@[A-Za-z0-9_]{1,15}(?![A-Za-z0-9_])/;
const SOCIAL_URL = /\b(?:x\.com|twitter\.com|t\.co)\//i;
const POST_ID = /\b\d{15,20}\b/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const SK_ANT = /\bsk-ant-[A-Za-z0-9_-]{20,}\b/;
/**
 * `xai-` API-key shape. The key body is base64-ish with NO hyphens, ≥30 chars.
 * This deliberately excludes the literal `xai-adversarial-bot-corpus.md`
 * filename the doc links to: the hyphen in `xai-adversarial` terminates the
 * `[A-Za-z0-9_]` body class long before 30 chars, so the filename can never
 * match. See the scoping unit tests below.
 */
const XAI_KEY = /\bxai-[A-Za-z0-9_]{30,}\b/;
const SB_SECRET = /\bsb_secret[_-]?[A-Za-z0-9]{10,}\b/;
const JWT_SHAPE =
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/;
const BEARER = /\bBearer\s+[A-Za-z0-9._-]{15,}\b/;
const SECRET_ENV =
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN)\s*=/;
const FULL_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

interface NamedPattern {
  name: string;
  pattern: RegExp;
}

const LEAK_PATTERNS: NamedPattern[] = [
  { name: 'X handle', pattern: X_HANDLE },
  { name: 'social URL (x.com / twitter.com / t.co)', pattern: SOCIAL_URL },
  { name: 'post id (15-20 digits)', pattern: POST_ID },
  { name: 'email', pattern: EMAIL },
  { name: 'sk-ant- key', pattern: SK_ANT },
  { name: 'xai- key', pattern: XAI_KEY },
  { name: 'sb_secret key', pattern: SB_SECRET },
  { name: 'JWT shape', pattern: JWT_SHAPE },
  { name: 'Bearer token', pattern: BEARER },
  { name: 'secret env assignment', pattern: SECRET_ENV },
  { name: 'full UUID', pattern: FULL_UUID },
];

// --- not-a-suppression-workflow ----------------------------------------------

/**
 * Suppression-action verbs (word-boundary on BOTH sides so "ban" does not match
 * "band"/"bands", "suppress" does not match "suppression", "censor" does not
 * match "censorship", "redact" does not match "redaction"). For every
 * occurrence, a negation/prohibition must appear within the surrounding window
 * — a BARE prescriptive occurrence ("reviewers remove X") fails.
 */
const SUPPRESSION_VERB = /\b(remove|redact|hide|filter|ban|suppress|block|censor)\b/gi;

/**
 * Negation/prohibition markers. Beyond the spec's core set
 * (not / never / does not / must not / is not / NOT a) we also accept the
 * other prohibition forms the committed doc actually uses around its
 * suppression-verb list: "No path may", "Nothing in this board", "no step",
 * "out of scope", n't contractions. These are still prohibitions — a genuine
 * prescriptive action step has none of them nearby.
 */
const NEGATION =
  /\b(?:not|never|no|nothing|none|cannot|without)\b|n['’]t|out of scope/i;

/**
 * Bidirectional context window for the negation check. The committed doc's
 * densest prohibition (line 149: the quoted prohibited list "remove / redact /
 * hide / filter / ban / suppress / block X … out of scope and must not be
 * written") spans ~80 chars between the first verb and its trailing negation.
 * 100 chars covers that worst case with margin while still failing a genuinely
 * bare prescriptive verb (which has no negation within ±100 chars).
 */
const NEGATION_WINDOW = 100;

// -----------------------------------------------------------------------------

describe('CORPUS-30 human review board — leakage + suppression-shape guards', () => {
  let text: string;

  beforeAll(() => {
    expect(fs.existsSync(DOC_ABS)).toBe(true);
    text = fs.readFileSync(DOC_ABS, 'utf8');
  });

  describe('leak-shape scan (§6 secrets / §10a no surfaced X content)', () => {
    for (const { name, pattern } of LEAK_PATTERNS) {
      it(`does not contain a ${name}`, () => {
        const match = text.match(pattern);
        if (match) {
          const lineNum = text.slice(0, match.index ?? 0).split('\n').length;
          throw new Error(
            `${DOC_REL}:${lineNum} contains a ${name} match: ${JSON.stringify(
              match[0].slice(0, 48),
            )}`,
          );
        }
        expect(match).toBeNull();
      });
    }
  });

  describe('no raw hostile body content (soft proxy)', () => {
    it('contains no fenced code block longer than ~200 chars', () => {
      // A pasted raw body excerpt would appear as a fenced ``` block. Markdown
      // BLOCKQUOTES are deliberately excluded from this proxy: the doc
      // legitimately uses a 264-char blockquote for the acceptance-gate
      // invariant (line 13) and other doctrine quotes. A fenced block > 200
      // chars is the structural shape of a pasted body and must not appear.
      const FENCE = /```[\s\S]*?```/g;
      let m: RegExpExecArray | null;
      const long: Array<{ line: number; len: number }> = [];
      while ((m = FENCE.exec(text)) !== null) {
        if (m[0].length > 200) {
          long.push({
            line: text.slice(0, m.index).split('\n').length,
            len: m[0].length,
          });
        }
      }
      if (long.length) {
        throw new Error(
          `${DOC_REL} contains fenced block(s) > 200 chars (possible pasted ` +
            `body): ${JSON.stringify(long)}`,
        );
      }
      expect(long).toEqual([]);
    });
  });

  describe('not-a-suppression-workflow (policy_no_censorship)', () => {
    it('every suppression verb is negated/prohibited, never a prescriptive action step', () => {
      const bare: string[] = [];
      let m: RegExpExecArray | null;
      SUPPRESSION_VERB.lastIndex = 0;
      while ((m = SUPPRESSION_VERB.exec(text)) !== null) {
        const start = Math.max(0, m.index - NEGATION_WINDOW);
        const end = m.index + m[0].length + NEGATION_WINDOW;
        const ctx = text.slice(start, end);
        if (!NEGATION.test(ctx)) {
          const lineNum = text.slice(0, m.index).split('\n').length;
          bare.push(
            `${DOC_REL}:${lineNum} suppression verb "${m[0]}" has no ` +
              `negation/prohibition within ±${NEGATION_WINDOW} chars: ` +
              `${JSON.stringify(ctx.replace(/\s+/g, ' ').slice(0, 120))}`,
          );
        }
      }
      if (bare.length) {
        throw new Error(
          'Bare prescriptive suppression verb(s) found:\n' + bare.join('\n'),
        );
      }
      expect(bare).toEqual([]);
    });

    it('finds the expected suppression verbs (the guard is actually exercising the doc)', () => {
      // Sanity: the doc's §1/§6 disclaimers DO mention the verbs (negated). If
      // this drops to zero, the doc changed shape and the negation guard above
      // is no longer protecting anything — fail loudly rather than pass vacuously.
      SUPPRESSION_VERB.lastIndex = 0;
      const count = (text.match(SUPPRESSION_VERB) ?? []).length;
      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  /**
   * REGEX-SCOPING DISCIPLINE (#496 §3 — the PR #495 lesson). The xai- key regex
   * must NOT false-positive on the sibling-doc filename `xai-adversarial-...`,
   * and MUST still catch a real key shape. These unit tests pin both directions
   * so the scoping cannot silently regress. No real key is ever embedded —
   * the positive case uses an obvious synthetic placeholder.
   */
  describe('xai- key regex scoping (negative + positive)', () => {
    it('does NOT match the sibling-doc filename or the bare "xai-adversarial" token', () => {
      expect('2026-06-03-xai-adversarial-bot-corpus.md').not.toMatch(XAI_KEY);
      expect('xai-adversarial').not.toMatch(XAI_KEY);
      expect('xai-adversarial-corpus-summary.md').not.toMatch(XAI_KEY);
    });

    it('DOES match a synthetic xai- key shape (≥30 base64-ish body chars, no hyphens)', () => {
      const SYNTHETIC_KEY = 'xai-' + 'EXAMPLENOTAREALKEY'.repeat(2);
      expect(SYNTHETIC_KEY).toMatch(XAI_KEY);
    });
  });

  it('declares no service-role / no provider call in the doctrine attestation', () => {
    // §7 attestation: the run used scripts/bot-fixtures/ only and the board
    // makes no provider call. Confirm the doc carries that attestation so a
    // future edit that strips it is caught.
    const hasNoProviderCall =
      /no provider call/i.test(text) || /makes no provider call/i.test(text);
    expect(hasNoProviderCall).toBe(true);
  });
});
