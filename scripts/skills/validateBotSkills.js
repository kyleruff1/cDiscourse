#!/usr/bin/env node
/**
 * Stage 6.1.9 — Skill gate validator.
 *
 * Validates `.claude/skills/bot-provocateur/SKILL.md` and
 * `.claude/skills/bot-revocateur/SKILL.md` against the Phase A spec:
 *   - exact frontmatter shape (name, description, disable-model-invocation,
 *     user-invocable, effort: high)
 *   - Markdown structure: H1 matches skill name, balanced code fences,
 *     no control chars, newline at EOF
 *   - required content markers
 *   - banned-canned-phrase enumeration
 *   - no secret-shape strings, no real handles / URLs / emails / JWTs
 *   - no scrape / browser-automation imperative
 *
 * Exit code 0 on success. Non-zero on any failure. Prints a structured
 * issue list. Never prints any secret value.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const SKILLS = [
  {
    name: 'bot-provocateur',
    path: path.join(REPO_ROOT, '.claude', 'skills', 'bot-provocateur', 'SKILL.md'),
  },
  {
    name: 'bot-revocateur',
    path: path.join(REPO_ROOT, '.claude', 'skills', 'bot-revocateur', 'SKILL.md'),
  },
];

const REQUIRED_CONTENT_MARKERS = [
  'manual-only',
  'dev/test',
  'xAI',
  'X-derived',
  'source-chain',
  'anti-amplification',
  'popularity is not evidence',
  'quote',
  'axis',
  'mechanism',
  'evidence debt',
  'hostile source',
  'redact',
  'submit-argument',
  'service-role',
  'direct insert',
  'do not pretend to be human',
  'dynamic room engagement mode',
  'heat reason codes',
  'hot does not mean rude',
  'avoid repeating the same axis',
  'do not keyword-stuff',
];

const BANNED_CANNED_PHRASES = [
  'Counter to the previous point',
  'The causal disagreement is the heart of it',
  'The evidence disagreement is the heart of it',
  'This evidence is on point',
  'Pushing back on the rebuttal',
  'narrow back to',
  'On the [keyword] point',
];

const FORBIDDEN_USER_LABELS = [
  'liar', 'dishonest', 'bad faith', 'manipulative',
  'extremist', 'propagandist', 'troll', 'bot', 'astroturfer',
];

// Patterns that look like raw secrets / identifiers. Any one match is a fail.
const SECRET_LIKE_PATTERNS = [
  { re: /sk-ant-[A-Za-z0-9_-]{12,}/g, name: 'Anthropic key shape' },
  { re: /xai-[A-Za-z0-9_-]{12,}/g, name: 'xAI key shape' },
  { re: /sb_secret_[A-Za-z0-9_-]{8,}/g, name: 'Supabase service-role key shape' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, name: 'JWT shape' },
  { re: /eyJ[A-Za-z0-9_-]{40,}/g, name: 'JWT-like prefix' },
  // Authorization: Bearer <token> with a non-placeholder token value.
  { re: /Bearer\s+[A-Za-z0-9._-]{16,}/g, name: 'Bearer token value' },
  { re: /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{8,}/gi, name: 'Authorization header value' },
];

const X_IDENTIFIER_PATTERNS = [
  { re: /https?:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_/]+/gi, name: 'X.com / twitter.com URL' },
  { re: /https?:\/\/t\.co\/[A-Za-z0-9]+/gi, name: 't.co URL' },
  // Bare host without protocol.
  { re: /\b(?:x|twitter)\.com\/[A-Za-z0-9_]+/gi, name: 'X.com / twitter.com bare URL' },
  { re: /\bt\.co\/[A-Za-z0-9]+/gi, name: 't.co bare URL' },
  // Email-like strings (will trigger on `foo@bar.com`; we don't include any in skill bodies).
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, name: 'email address' },
];

// Imperative scrape / browser-automation instructions. We allow negation
// ("do not scrape", "no scraping", "no browser automation") but reject
// imperative instructions that direct scraping.
const SCRAPE_IMPERATIVE_PATTERNS = [
  { re: /\bscrape\s+(?:x|twitter|the\s+site|the\s+page|posts)\b/i, name: 'scrape imperative' },
  { re: /\bopen\s+a?\s*headless\s+browser\b/i, name: 'headless browser instruction' },
  { re: /\buse\s+puppeteer\b/i, name: 'puppeteer instruction' },
  { re: /\buse\s+selenium\b/i, name: 'selenium instruction' },
  { re: /\buse\s+playwright\b/i, name: 'playwright instruction' },
];

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8');
}

function parseFrontmatter(text, file) {
  const issues = [];
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    issues.push(`${file}: frontmatter must start at the first line with ---`);
    return { ok: false, issues, fm: null };
  }
  const endMatch = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!endMatch) {
    issues.push(`${file}: missing closing --- frontmatter delimiter`);
    return { ok: false, issues, fm: null };
  }
  const body = endMatch[1];
  // Reject a second closing delimiter (means more than one frontmatter block).
  const rest = text.slice(endMatch[0].length);
  if (/^---\s*$/m.test(rest)) {
    issues.push(`${file}: more than one frontmatter delimiter detected`);
  }
  const fm = {};
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx < 0) {
      issues.push(`${file}: invalid frontmatter line (missing colon): ${line}`);
      continue;
    }
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    fm[k] = v;
  }
  return { ok: issues.length === 0, issues, fm, bodyStart: endMatch[0].length };
}

function checkFrontmatter(fm, expectedName, file) {
  const issues = [];
  if (!fm) return { ok: false, issues };
  if (fm.name !== expectedName) issues.push(`${file}: frontmatter name="${fm.name}" must match folder "${expectedName}"`);
  if (!fm.description || fm.description.length < 10) issues.push(`${file}: frontmatter description missing or too short`);
  if (String(fm['disable-model-invocation']).toLowerCase() !== 'true') {
    issues.push(`${file}: frontmatter must declare disable-model-invocation: true`);
  }
  if (String(fm['user-invocable']).toLowerCase() !== 'true') {
    issues.push(`${file}: frontmatter must declare user-invocable: true`);
  }
  if (fm.effort !== 'high') {
    issues.push(`${file}: frontmatter effort must be "high" (got "${fm.effort || '(missing)'}")`);
  }
  return { ok: issues.length === 0, issues };
}

function checkStructure(text, bodyStart, expectedName, file) {
  const issues = [];
  const body = text.slice(bodyStart || 0);
  // 1. H1
  const h1Match = body.match(/^#\s+(.+)$/m);
  if (!h1Match) {
    issues.push(`${file}: missing H1`);
  } else if (!h1Match[1].includes(expectedName)) {
    issues.push(`${file}: H1 "${h1Match[1].trim()}" does not include skill name "${expectedName}"`);
  }
  // 2. balanced code fences
  const fenceCount = (body.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) issues.push(`${file}: unbalanced code fences (${fenceCount})`);
  // 3. control characters (allow CR/LF/TAB; reject any other 0x00–0x1F).
  const ctrlChars = body.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g);
  if (ctrlChars && ctrlChars.length) issues.push(`${file}: contains ${ctrlChars.length} control character(s)`);
  // 4. newline at EOF
  if (!body.endsWith('\n')) issues.push(`${file}: missing newline at EOF`);
  // 5. malformed JSON code blocks — scan ```json blocks for parse failures.
  const jsonBlockRe = /```json\s*\r?\n([\s\S]*?)\r?\n```/g;
  let m;
  while ((m = jsonBlockRe.exec(body)) !== null) {
    try { JSON.parse(m[1]); } catch (err) {
      issues.push(`${file}: malformed JSON in code block (${String(err.message).slice(0, 80)})`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function checkRequiredContent(text, file) {
  const issues = [];
  const lower = text.toLowerCase();
  for (const marker of REQUIRED_CONTENT_MARKERS) {
    // Required content markers are matched case-INSENSITIVELY so the skill
    // can capitalize them naturally (e.g. "Do not pretend to be human" in a
    // section header). The required list itself is lowercase.
    if (!lower.includes(marker.toLowerCase())) issues.push(`${file}: missing required content marker "${marker}"`);
  }
  return { ok: issues.length === 0, issues };
}

function checkBannedPhraseEnumeration(text, file) {
  const issues = [];
  // The skill must ENUMERATE the banned canned phrases so model output
  // can be scanned against the same list. Each phrase must appear literally
  // somewhere in the skill body.
  for (const phrase of BANNED_CANNED_PHRASES) {
    if (!text.includes(phrase)) issues.push(`${file}: banned-canned-phrase enumeration missing "${phrase}"`);
  }
  return { ok: issues.length === 0, issues };
}

function checkForbiddenLabelsAreListed(text, file) {
  const issues = [];
  // Each forbidden user label must appear in the skill body so the model
  // sees the explicit prohibition list (mirrored by the runner's
  // post-generation validator).
  for (const label of FORBIDDEN_USER_LABELS) {
    if (!text.toLowerCase().includes(label.toLowerCase())) {
      issues.push(`${file}: forbidden-user-label list missing "${label}"`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function checkSafety(text, file) {
  const issues = [];
  for (const { re, name } of SECRET_LIKE_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) issues.push(`${file}: secret-shape detected (${name})`);
  }
  for (const { re, name } of X_IDENTIFIER_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) issues.push(`${file}: raw X identifier detected (${name})`);
  }
  // Negation-aware scrape / automation check. An imperative scrape /
  // browser-automation instruction line is rejected. Negated lines such
  // as "no scraping" / "do not scrape" / "no browser automation" pass.
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lc = trimmed.toLowerCase();
    const isNegated = /\b(no|never|do not|don'?t|must not|prohibited|forbidden|disallow)\b/.test(lc);
    if (isNegated) continue;
    for (const { re, name } of SCRAPE_IMPERATIVE_PATTERNS) {
      if (re.test(trimmed)) issues.push(`${file}: imperative-style ${name} detected ("${trimmed.slice(0, 80)}")`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function validateOne(skill) {
  const issues = [];
  if (!fs.existsSync(skill.path)) {
    return { name: skill.name, ok: false, issues: [`${skill.path}: file does not exist`] };
  }
  const text = readUtf8(skill.path);

  const fmRes = parseFrontmatter(text, skill.path);
  issues.push(...fmRes.issues);
  if (!fmRes.fm) return { name: skill.name, ok: false, issues };

  const fmCheck = checkFrontmatter(fmRes.fm, skill.name, skill.path);
  issues.push(...fmCheck.issues);

  const structRes = checkStructure(text, fmRes.bodyStart || 0, skill.name, skill.path);
  issues.push(...structRes.issues);

  const contentRes = checkRequiredContent(text, skill.path);
  issues.push(...contentRes.issues);

  const bannedRes = checkBannedPhraseEnumeration(text, skill.path);
  issues.push(...bannedRes.issues);

  const labelsRes = checkForbiddenLabelsAreListed(text, skill.path);
  issues.push(...labelsRes.issues);

  const safetyRes = checkSafety(text, skill.path);
  issues.push(...safetyRes.issues);

  return { name: skill.name, ok: issues.length === 0, issues, fm: fmRes.fm };
}

function shortSkillHash(text) {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function main() {
  const results = SKILLS.map(validateOne);
  let allOk = true;
  for (const r of results) {
    if (!r.ok) {
      allOk = false;
      console.error(`[skill-gate] FAIL ${r.name}:`);
      for (const issue of r.issues) console.error(`  - ${issue}`);
    } else {
      const hash = shortSkillHash(readUtf8(SKILLS.find((s) => s.name === r.name).path));
      console.log(`[skill-gate] OK ${r.name} (hash=${hash}, effort=${r.fm.effort})`);
    }
  }
  process.exitCode = allOk ? 0 : 1;
  if (allOk) console.log('[skill-gate] all skills pass — safe to proceed to Phase B');
}

if (require.main === module) main();

module.exports = {
  SKILLS,
  REQUIRED_CONTENT_MARKERS,
  BANNED_CANNED_PHRASES,
  FORBIDDEN_USER_LABELS,
  SECRET_LIKE_PATTERNS,
  X_IDENTIFIER_PATTERNS,
  SCRAPE_IMPERATIVE_PATTERNS,
  parseFrontmatter,
  checkFrontmatter,
  checkStructure,
  checkRequiredContent,
  checkBannedPhraseEnumeration,
  checkForbiddenLabelsAreListed,
  checkSafety,
  validateOne,
  shortSkillHash,
};
