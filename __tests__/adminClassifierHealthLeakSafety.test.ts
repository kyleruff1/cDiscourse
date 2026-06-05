/**
 * OPS-MCP-OBSERVABILITY-002 — leak-safety convergence gate.
 *
 * Patterned after `corpus30HumanReviewLeakage.test.ts` + the
 * cutover-health-monitor `containsForbiddenSubstring` scrub. For adversarial
 * synthetic fixtures (rows whose columns smuggle handles / URLs / post-ids /
 * emails / secrets / an evidence_span key), the aggregate VERDICT + the CSV:
 *   - contain NO X handle / social URL / 15-20 digit post-id / email
 *   - contain NO sk-ant- / scoped xai- key / sb_secret / JWT / Bearer /
 *     SERVICE_ROLE / full UUID / secret env-name
 *   - NEVER contain an `evidence_span` key at any JSON depth
 *   - `failure_detail` is consumed only as the allow-list keys (no smuggled
 *     key survives into the verdict)
 * Plus the xai- regex scoping (negative on `xai-adversarial`, positive on a
 * synthetic key).
 *
 * No real secret is ever embedded — every fixture uses obvious placeholders.
 */
import {
  aggregateClassifierHealth,
  buildClassifierHealthCsv,
} from '../src/features/adminClassifierHealth';
import type { ClassifierHealthRunRow } from '../src/features/adminClassifierHealth';
import { containsForbiddenSubstring } from '../src/features/cutoverHealthAlerts/cutoverHealthAlertModel';

// ── Leak-shape patterns (mirrors corpus30HumanReviewLeakage) ─────

const X_HANDLE = /(?<![A-Za-z0-9_])@[A-Za-z0-9_]{1,15}(?![A-Za-z0-9_])/;
const SOCIAL_URL = /\b(?:x\.com|twitter\.com|t\.co)\//i;
const POST_ID = /\b\d{15,20}\b/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const SK_ANT = /\bsk-ant-[A-Za-z0-9_-]{20,}\b/;
const XAI_KEY = /\bxai-[A-Za-z0-9_]{30,}\b/;
const SB_SECRET = /\bsb_secret[_-]?[A-Za-z0-9]{10,}\b/;
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/;
const BEARER = /\bBearer\s+[A-Za-z0-9._-]{15,}\b/;
const SECRET_ENV =
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN)\b/;
const FULL_UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

const LEAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'X handle', pattern: X_HANDLE },
  { name: 'social URL', pattern: SOCIAL_URL },
  { name: 'post id (15-20 digits)', pattern: POST_ID },
  { name: 'email', pattern: EMAIL },
  { name: 'sk-ant- key', pattern: SK_ANT },
  { name: 'xai- key', pattern: XAI_KEY },
  { name: 'sb_secret key', pattern: SB_SECRET },
  { name: 'JWT shape', pattern: JWT_SHAPE },
  { name: 'Bearer token', pattern: BEARER },
  { name: 'secret env name', pattern: SECRET_ENV },
  { name: 'full UUID', pattern: FULL_UUID },
];

// ── Adversarial synthetic fixtures (placeholders only) ───────────
//
// The status / state / failure_reason / failure_sub_reason / dead_letter_reason
// columns are DRAINER-WRITTEN controlled-vocabulary codes (enum-like). The two
// realistic free-text leak vectors the panel reads are:
//   (1) `debate_title` — free text that could carry a handle / URL / secret.
//       The panel reads ONLY the trailing `[<runTag> tNN]` suffix and NEVER
//       echoes the title into the aggregate.
//   (2) `failure_detail` jsonb — could carry a smuggled key. The Edge reader
//       strips it to the allow-list; this fixture proves the aggregate output
//       is leak-free regardless.
// Every adversarial title below carries a leak shape; the verdict + CSV must
// surface NONE of it.

const ADVERSARIAL_ROWS: ClassifierHealthRunRow[] = [
  {
    status: 'failed',
    state: 'failed_terminal',
    failure_reason: 'mcp_api_error',
    failure_sub_reason: 'provider_server_error',
    dead_letter_reason: null,
    run_mode: 'production',
    requested_families: ['parent_relation'],
    family: 'parent_relation',
    started_at: '2026-06-01T10:00:00.000Z',
    completed_at: '2026-06-01T10:00:05.000Z',
    failure_detail: {
      reason: 'mcp_api_error',
      validator_path: 'evidenceSpan.abductive_explanation_present',
      family: 'parent_relation',
      correlation_id: '11111111-1111-1111-1111-111111111111',
      attempt_count: 2,
      run_mode: 'production',
      schema_version: 'v2',
    },
    // Adversarial free-text title smuggling a handle + social URL + post id +
    // email + secret-shaped tokens. NONE may surface in the aggregate.
    debate_title:
      'Cars @evilhandle https://x.com/evil/status/1234567890123456789 ' +
      'attacker@example.com sk-ant-PLACEHOLDERPLACEHOLDERPLACEHOLDER [xai-adv t03]',
  },
  {
    status: 'success',
    state: 'succeeded',
    failure_reason: null,
    failure_sub_reason: null,
    dead_letter_reason: null,
    run_mode: 'admin_validation',
    requested_families: ['claim_clarity'],
    family: 'sensitive_composer',
    started_at: '2026-06-01T11:00:00.000Z',
    completed_at: '2026-06-01T11:00:09.000Z',
    failure_detail: null,
    debate_title:
      'Hidden Bearer PLACEHOLDERTOKENVALUE123456 ' +
      'sb_secret_PLACEHOLDERSECRET1234 [stress t99]',
  },
];

/** Recursively collect every object key in a JSON-serializable value. */
function collectKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (value === null || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, acc);
    return acc;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    acc.add(k);
    collectKeys(v, acc);
  }
  return acc;
}

describe('classifier-health leak-safety — verdict + CSV', () => {
  const verdict = aggregateClassifierHealth(ADVERSARIAL_ROWS);
  const jsonString = JSON.stringify(verdict);
  const csv = buildClassifierHealthCsv(verdict);

  describe('the verdict JSON is leak-free', () => {
    for (const { name, pattern } of LEAK_PATTERNS) {
      it(`contains no ${name}`, () => {
        const match = jsonString.match(pattern);
        expect(match).toBeNull();
      });
    }
  });

  describe('the CSV export is leak-free', () => {
    for (const { name, pattern } of LEAK_PATTERNS) {
      it(`contains no ${name}`, () => {
        const match = csv.match(pattern);
        expect(match).toBeNull();
      });
    }
  });

  it('the cutover-health containsForbiddenSubstring scrub passes on the verdict + CSV', () => {
    expect(containsForbiddenSubstring(jsonString)).toBe(false);
    expect(containsForbiddenSubstring(csv)).toBe(false);
  });

  it('the verdict NEVER contains an evidence_span key at any depth', () => {
    const keys = collectKeys(verdict);
    expect(keys.has('evidence_span')).toBe(false);
    // Also no body / raw payload / prompt keys.
    expect(keys.has('body')).toBe(false);
    expect(keys.has('payload')).toBe(false);
    expect(keys.has('prompt')).toBe(false);
  });

  it('the verdict never carries a raw debate_title (only counts survive)', () => {
    // The adversarial titles must not appear in the aggregate output — the
    // panel reads only the runTag suffix for bucketing, never the title text.
    expect(jsonString).not.toContain('Cars');
    expect(jsonString).not.toContain('Hidden');
    expect(jsonString).not.toContain('evilhandle');
    expect(jsonString).not.toContain('PLACEHOLDER');
  });
});

describe('classifier-health leak-safety — failure_detail allow-list', () => {
  it('a smuggled extra failure_detail key never survives into the verdict', () => {
    // Build a row whose failure_detail jsonb carries a forbidden extra key.
    // The model TYPE only exposes the allow-list, but a runtime object could
    // carry extra keys — verify the aggregate never re-emits them.
    // Cast through `unknown` so the smuggled non-allow-list keys
    // (evidence_span, body) ride a runtime object the TYPE does not expose —
    // exactly the shape a future writer regression could produce.
    const poisoned = {
      status: 'failed',
      state: 'failed_terminal',
      failure_reason: 'mcp_validation_failed',
      failure_sub_reason: null,
      dead_letter_reason: null,
      run_mode: 'production',
      requested_families: ['parent_relation'],
      family: 'parent_relation',
      started_at: '2026-06-01T10:00:00.000Z',
      completed_at: '2026-06-01T10:00:05.000Z',
      failure_detail: {
        reason: 'mcp_validation_failed',
        evidence_span: 'SECRET SPAN TEXT THAT MUST NOT LEAK',
        body: 'raw argument body that must not leak',
      },
    } as unknown as ClassifierHealthRunRow;
    const verdict = aggregateClassifierHealth([poisoned]);
    const jsonString = JSON.stringify(verdict);
    expect(jsonString).not.toContain('SECRET SPAN TEXT');
    expect(jsonString).not.toContain('raw argument body');
    const keys = collectKeys(verdict);
    expect(keys.has('evidence_span')).toBe(false);
  });
});

describe('xai- key regex scoping (negative + positive)', () => {
  it('does NOT match the bare "xai-adversarial" token / runTag suffix', () => {
    expect('xai-adversarial').not.toMatch(XAI_KEY);
    expect('Cars are bad [xai-adv t03]').not.toMatch(XAI_KEY);
    expect('2026-06-05-xai-adversarial-bot-corpus.md').not.toMatch(XAI_KEY);
  });

  it('DOES match a synthetic xai- key shape (>=30 base64-ish body chars, no hyphens)', () => {
    const SYNTHETIC_KEY = 'xai-' + 'EXAMPLENOTAREALKEY'.repeat(2);
    expect(SYNTHETIC_KEY).toMatch(XAI_KEY);
  });
});
