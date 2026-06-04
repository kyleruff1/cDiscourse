/**
 * CORPUS-30-RUN-COMMIT-001 — leakage scan over the committed CORPUS-30 testing-run
 * markdown reports.
 *
 * Asserts that neither the 30-stage live run report nor the harvest summary
 * leaks: X handles, x.com / twitter.com / t.co URLs, 15-20 digit post IDs,
 * Bearer tokens, API keys (sk-ant-, xai-), JWTs, service-role mentions, or
 * raw `.env` secret names. These docs MUST stay safe for the public repo.
 *
 * Doctrine: cdiscourse-doctrine §6 (secrets) + §10a (no Allegation-shaped
 * X content surfaced). Per operator policy `policy_no_censorship`, the test
 * does NOT scan for "hostile rhetoric" — only structural leak patterns.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');

const REPORTS = [
  'docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md',
  'docs/testing-runs/2026-06-03-xai-adversarial-corpus-summary.md',
];

const X_HANDLE = /(?:^|[^A-Za-z0-9_/])@([A-Za-z0-9_]{1,15})\b/;
const X_DOMAIN = /\b(?:x\.com|twitter\.com|t\.co)\//;
const POST_ID = /"id"\s*:\s*"[0-9]{15,20}"/;
const BEARER = /\bBearer\s+[A-Z][A-Za-z0-9._\-]{15,}\b/;
const SK_ANT = /\bsk-ant-[A-Za-z0-9_-]{10,}\b/;
const XAI_KEY = /\bxai-[A-Za-z0-9]{10,}\b/;
const SB_SECRET = /\bsb_secret[_-]?[A-Za-z0-9]{10,}\b/;
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/;
const SECRET_NAMES = /\b(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN)\b/;

interface NamedPattern { name: string; pattern: RegExp }

const PATTERNS: NamedPattern[] = [
  { name: 'X handle', pattern: X_HANDLE },
  { name: 'X / twitter / t.co URL', pattern: X_DOMAIN },
  { name: 'post id (15-20 digits)', pattern: POST_ID },
  { name: 'Bearer token', pattern: BEARER },
  { name: 'sk-ant- key', pattern: SK_ANT },
  { name: 'xai- key', pattern: XAI_KEY },
  { name: 'sb_secret key', pattern: SB_SECRET },
  { name: 'JWT shape', pattern: JWT_SHAPE },
  { name: 'secret env name', pattern: SECRET_NAMES },
];

describe('CORPUS-30 testing-run reports — leakage scan', () => {
  for (const rel of REPORTS) {
    const abs = path.join(REPO_ROOT, rel);

    describe(rel, () => {
      let text: string;

      beforeAll(() => {
        expect(fs.existsSync(abs)).toBe(true);
        text = fs.readFileSync(abs, 'utf8');
      });

      for (const { name, pattern } of PATTERNS) {
        it(`does not contain a ${name}`, () => {
          const match = text.match(pattern);
          if (match) {
            const lineNum = text.slice(0, match.index ?? 0).split('\n').length;
            throw new Error(
              `${rel}:${lineNum} contains a ${name} match: ${JSON.stringify(
                match[0].slice(0, 40),
              )}`,
            );
          }
        });
      }

      it('declares no service-role usage in the run header', () => {
        const headerSlice = text.slice(0, 1200);
        const declaresNo =
          /_service-role used_:\s*(no|false)/i.test(headerSlice) ||
          /No\s+`?service-role`?/i.test(headerSlice) ||
          /service-role used:\s*NO/i.test(headerSlice);
        expect(declaresNo).toBe(true);
      });
    });
  }
});
