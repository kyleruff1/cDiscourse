#!/usr/bin/env node
/**
 * UX terminology audit — deterministic scan for prohibited / discouraged
 * normal-user UI strings in CDiscourse app source.
 *
 * Companion to:
 *   - .claude/skills/storyline-narrative-officer/SKILL.md
 *   - docs/ux-storyboards/terminology-and-copy-rules.md
 *
 * What it does
 *   Scans app source (src/ and App.tsx) for user-facing string literals and
 *   JSX text, then flags terminology that breaks the CDiscourse copy rules:
 *   the app is an "argument" product — its normal-user UI must not say "game"
 *   and should not say "debate".
 *
 * What it does NOT do
 *   - It does not scan docs/ (design docs intentionally discuss legacy terms
 *     and quote prohibited words as examples).
 *   - It does not scan tests, scripts, supabase/ Edge Functions, or migrations.
 *   - It does not flag internal identifiers (`gameCopy`, `argumentGameSurface`)
 *     or database table names (`debates`) — only strings that look like copy a
 *     normal user would read.
 *   - It makes no network call, no AI call, no Supabase call. Pure file I/O.
 *
 * Severity
 *   - prohibited  — hard rule break in normal-user UI (game / gaming /
 *                   game surface / debate room / "Debates" page-or-tab label /
 *                   Tap to join / player / winner / loser).
 *   - discouraged — should be reworded (the word "debate" / "moderator" in
 *                   prose copy).
 *
 * Output
 *   Writes docs/ux-storyboards/terminology-audit.md and prints a summary.
 *
 * Exit code
 *   Default (warn mode): always exits 0 so the audit never blocks CI while a
 *   backlog of pre-existing violations is worked down.
 *   `--strict`: exits 1 when a *live* (non-legacy) prohibited violation exists.
 *
 * Suppression
 *   - A line containing `ux-audit-ignore-line` is skipped.
 *   - A file containing `ux-audit-ignore-file` is skipped entirely.
 *
 * Never prints or writes secrets. Pure terminology scan.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = process.cwd();
const REPORT_PATH = path.join('docs', 'ux-storyboards', 'terminology-audit.md');

// Roots scanned for user-facing copy. App source only — never docs/tests.
const SCAN_ROOTS = ['src', 'App.tsx'];
const SCAN_EXTENSIONS = ['.ts', '.tsx'];

// Directory names skipped entirely — dev/test tooling, not shipped UI. The
// engagement-intelligence and dev-fixture modules contain analysis prompts and
// scenario builders, never normal-user copy.
const SKIP_DIR_NAMES = new Set([
  '__tests__',
  'node_modules',
  'engagementIntelligence',
  'devFixtures',
]);

// Files that still contain legacy copy but are NOT currently mounted in the
// running app (dead code behind a disabled render branch). Their findings are
// reported in a separate section and never count toward a strict-mode failure.
const LEGACY_NOT_MOUNTED = [
  // DebateListScreen is rendered behind `{false && ...}` in App.tsx — the live
  // Arguments tab uses ConversationGalleryScreen. Tracked by QOL-035.
  path.join('src', 'features', 'debates', 'DebateListScreen.tsx'),
];

// Known non-violations: a (file-suffix, literal-substring) pair whose match is
// intentional and safe. Kept tiny on purpose.
const ALLOWLIST = [
  // none yet — add deterministic, justified entries here if needed.
];

// ---------------------------------------------------------------------------
// Pattern tables
// ---------------------------------------------------------------------------

// Each entry: { re, term, replacement }. `re` is tested against a single
// user-copy candidate string (one literal / one JSX text fragment).
const PROHIBITED_PATTERNS = [
  { re: /\bgame surface\b/i, term: 'game surface', replacement: 'interaction surface / argument board' },
  { re: /\bgaming\b/i, term: 'gaming', replacement: 'argument experience' },
  { re: /\bgames?\b/i, term: 'game', replacement: 'argument experience / interaction surface / argument flow / argument board' },
  { re: /\bdebate rooms?\b/i, term: 'debate room', replacement: 'argument room' },
  { re: /\btap to join\b/i, term: 'Tap to join', replacement: 'Open / Observe / Respond / Jump in' },
  { re: /\bplayers?\b/i, term: 'player', replacement: 'participant' },
  { re: /\bwinners?\b/i, term: 'winner', replacement: 'resolved / supported / settled' },
  { re: /\blosers?\b/i, term: 'loser', replacement: 'unresolved / challenged / conceded' },
];

const DISCOURAGED_PATTERNS = [
  { re: /\bdebates?\b/i, term: 'debate', replacement: 'argument' },
  { re: /\bmoderators?\b/i, term: 'moderator', replacement: 'observer / admin (context-dependent)' },
];

// ---------------------------------------------------------------------------
// User-copy candidate detection
// ---------------------------------------------------------------------------

/**
 * True when `s` looks like a string a normal user would read on screen —
 * not an import path, identifier, enum code, style value, or testID.
 */
function isUserCopyCandidate(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length < 2) return false;
  // Must contain a letter.
  if (!/[A-Za-z]/.test(t)) return false;
  // Import / module paths.
  if (/^[.@]/.test(t)) return false;
  if (t.includes('/') && !/\s/.test(t)) return false;
  // Hex colors, rgba, numeric-ish.
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
  if (/^rgba?\(/i.test(t)) return false;
  // Pure identifier / enum-code shapes (no spaces): camelCase, snake_case,
  // kebab-case, SCREAMING_CASE, dotted accessors, testIDs.
  if (!/\s/.test(t)) {
    // A single word with no space is treated as copy ONLY when it is a real
    // word in Title/lower case (e.g. a page label like "Debates"). snake_case,
    // kebab-case, camelCase and dotted strings are code, not copy.
    if (/[_]/.test(t)) return false;
    if (/-/.test(t)) return false;
    if (/\./.test(t)) return false;
    // camelCase / PascalCase-with-internal-caps that is clearly an identifier.
    if (/^[a-z]+[A-Z]/.test(t)) return false;
    if (/^[A-Z][a-z]+[A-Z]/.test(t)) return false;
  }
  return true;
}

const ALWAYS_IGNORE_LINE = /ux-audit-ignore-line/;
const IGNORE_FILE_MARKER = /ux-audit-ignore-file/;

/**
 * Blank out `//` and block comments so an apostrophe in a comment (`bot's`) is
 * never mistaken for a string-literal delimiter. Newlines are preserved so line
 * numbers stay correct. A tiny state machine — aware of string and template
 * literals so a `//` inside a URL string is left intact.
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let state = 'code'; // code | sq | dq | tpl | line | block
  while (i < n) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : '';
    if (state === 'code') {
      if (ch === '/' && next === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (ch === '/' && next === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (ch === "'") { state = 'sq'; out += ch; i += 1; continue; }
      if (ch === '"') { state = 'dq'; out += ch; i += 1; continue; }
      if (ch === '`') { state = 'tpl'; out += ch; i += 1; continue; }
      out += ch; i += 1; continue;
    }
    if (state === 'sq' || state === 'dq' || state === 'tpl') {
      if (ch === '\\') { out += ch + (next || ''); i += 2; continue; }
      if (state === 'sq' && ch === "'") state = 'code';
      else if (state === 'dq' && ch === '"') state = 'code';
      else if (state === 'tpl' && ch === '`') state = 'code';
      out += ch; i += 1; continue;
    }
    if (state === 'line') {
      if (ch === '\n') { state = 'code'; out += ch; i += 1; continue; }
      out += ch === '\t' ? '\t' : ' '; i += 1; continue;
    }
    // block comment
    if (ch === '*' && next === '/') { state = 'code'; out += '  '; i += 2; continue; }
    out += ch === '\n' ? '\n' : (ch === '\t' ? '\t' : ' ');
    i += 1;
  }
  return out;
}

// Roadmap card IDs (`GAME-004`, `RULE-003`) are code references, never UI copy.
const ROADMAP_CARD_ID = /\b[A-Z]{2,8}-\d{2,4}\b/g;

/**
 * Pull user-copy candidate strings out of one source line.
 * Returns an array of candidate strings (string literals, single-line template
 * literals with `${...}` blanked, and plain JSX text nodes).
 */
function extractCandidatesFromLine(line) {
  const out = [];
  // Single- and double-quoted string literals.
  const quoteRe = /(['"])((?:\\.|(?!\1).)*)\1/g;
  let m;
  while ((m = quoteRe.exec(line)) !== null) {
    out.push(m[2]);
  }
  // Single-line template literals — blank out interpolations.
  const tplRe = /`((?:\\.|[^`])*)`/g;
  while ((m = tplRe.exec(line)) !== null) {
    out.push(m[1].replace(/\$\{[^}]*\}/g, ' '));
  }
  // Plain JSX text nodes: text between > and < with no braces/tags inside.
  const jsxRe = />([^<>{}]+)</g;
  while ((m = jsxRe.exec(line)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Classify one user-copy string. Returns an array of findings:
 * { term, severity, replacement }.
 */
function classifyText(text) {
  const findings = [];
  if (!isUserCopyCandidate(text)) return findings;
  const trimmed = text.trim();

  // A single token with no whitespace is a code constant — an enum value, a
  // ban-list / forbidden-token entry, a type literal, or a database table
  // name (`debates`). It is not a sentence of UI copy. The ONLY prohibited
  // single-token case is the rendered page/tab label "Debates" itself, which
  // a user reads in Title case; the lowercase `debates` table name is exempt.
  if (!/\s/.test(trimmed)) {
    if (/^Debates$/.test(trimmed)) {
      findings.push({
        term: 'Debates (page/tab label)',
        severity: 'prohibited',
        replacement: 'Arguments',
      });
    }
    return findings;
  }

  // Remove roadmap card IDs (GAME-004, RULE-003) so a card reference in a
  // copy string never trips the "game" pattern.
  const scan = trimmed.replace(ROADMAP_CARD_ID, ' ');

  for (const p of PROHIBITED_PATTERNS) {
    if (p.re.test(scan)) {
      findings.push({ term: p.term, severity: 'prohibited', replacement: p.replacement });
    }
  }
  for (const p of DISCOURAGED_PATTERNS) {
    if (p.re.test(scan)) {
      findings.push({ term: p.term, severity: 'discouraged', replacement: p.replacement });
    }
  }
  return findings;
}

function isAllowlisted(relFile, text) {
  return ALLOWLIST.some(
    (a) => relFile.replace(/\\/g, '/').endsWith(a.file) && text.includes(a.literal),
  );
}

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function walk(absDir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(abs, acc);
    } else if (entry.isFile()) {
      if (entry.name.includes('.test.')) continue;
      if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) acc.push(abs);
    }
  }
  return acc;
}

function collectScanFiles() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    const abs = path.join(REPO_ROOT, root);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, files);
    } else if (stat.isFile() && SCAN_EXTENSIONS.includes(path.extname(abs))) {
      files.push(abs);
    }
  }
  return files.sort();
}

/** Audit one file's text. Returns an array of findings with line numbers. */
function auditFile(relFile, content) {
  const findings = [];
  if (IGNORE_FILE_MARKER.test(content)) return findings;
  // Strip comments first — an apostrophe in `bot's` must never be read as a
  // string delimiter, and a term inside a comment is not user-facing copy.
  const lines = stripComments(content).split(/\r?\n/);
  // The raw lines are kept so an `ux-audit-ignore-line` marker (which may sit
  // in a now-stripped comment) is still honoured.
  const rawLines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (ALWAYS_IGNORE_LINE.test(rawLines[i] || '')) continue;
    const candidates = extractCandidatesFromLine(line);
    for (const candidate of candidates) {
      if (isAllowlisted(relFile, candidate)) continue;
      const classified = classifyText(candidate);
      for (const f of classified) {
        findings.push({
          file: relFile.replace(/\\/g, '/'),
          line: i + 1,
          term: f.term,
          severity: f.severity,
          replacement: f.replacement,
          excerpt: candidate.trim().slice(0, 120),
        });
      }
    }
  }
  return findings;
}

function isLegacyFile(relFile) {
  const norm = relFile.replace(/\\/g, '/');
  return LEGACY_NOT_MOUNTED.some((l) => norm.endsWith(l.replace(/\\/g, '/')));
}

/** Run the full audit. Returns a structured result. */
function runAudit() {
  const files = collectScanFiles();
  const liveFindings = [];
  const legacyFindings = [];
  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs);
    const content = fs.readFileSync(abs, 'utf8');
    const findings = auditFile(rel, content);
    for (const f of findings) {
      if (isLegacyFile(rel)) legacyFindings.push(f);
      else liveFindings.push(f);
    }
  }
  const sortFn = (a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1);
  liveFindings.sort(sortFn);
  legacyFindings.sort(sortFn);
  return {
    scannedFileCount: files.length,
    liveFindings,
    legacyFindings,
    liveProhibited: liveFindings.filter((f) => f.severity === 'prohibited'),
    liveDiscouraged: liveFindings.filter((f) => f.severity === 'discouraged'),
  };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderFindingTable(findings) {
  if (findings.length === 0) return '_None._\n';
  const rows = ['| File | Line | Severity | Term | Suggested replacement | Excerpt |',
    '|---|---|---|---|---|---|'];
  for (const f of findings) {
    const excerpt = f.excerpt.replace(/\|/g, '\\|');
    rows.push(`| \`${f.file}\` | ${f.line} | ${f.severity} | ${f.term} | ${f.replacement} | ${excerpt} |`);
  }
  return rows.join('\n') + '\n';
}

function renderReport(result) {
  const L = [];
  L.push('# CDiscourse — User-Facing Terminology Audit');
  L.push('');
  L.push('> Generated by `npm run ux:terminology:audit`');
  L.push('> (`scripts/ux/auditUserFacingTerminology.js`). Deterministic — re-run to refresh.');
  L.push('> Companion: `docs/ux-storyboards/terminology-and-copy-rules.md`.');
  L.push('');
  L.push('CDiscourse is an **argument** product. Normal-user UI must not say');
  L.push('"game" and should not say "debate". This report scans app source');
  L.push('(`src/`, `App.tsx`) for user-facing string literals and JSX text that');
  L.push('break those rules. It does **not** scan docs, tests, scripts, or the');
  L.push('Supabase functions — database table names like `debates` are allowed to');
  L.push('keep their internal names.');
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push(`- Files scanned: **${result.scannedFileCount}**`);
  L.push(`- Live prohibited violations: **${result.liveProhibited.length}**`);
  L.push(`- Live discouraged usages: **${result.liveDiscouraged.length}**`);
  L.push(`- Legacy (not-mounted) findings: **${result.legacyFindings.length}**`);
  L.push('');
  if (result.liveProhibited.length === 0) {
    L.push('No prohibited terminology in live, mounted user-facing surfaces. ✅');
  } else {
    L.push('Live prohibited terminology remains — see the table below. The');
    L.push('terminology scrub is tracked as a roadmap card (QOL-035).');
  }
  L.push('');
  L.push('## Live prohibited violations');
  L.push('');
  L.push(renderFindingTable(result.liveProhibited));
  L.push('## Live discouraged usages');
  L.push('');
  L.push('"debate" / "moderator" in user-facing copy. Reword opportunistically;');
  L.push('not a hard blocker.');
  L.push('');
  L.push(renderFindingTable(result.liveDiscouraged));
  L.push('## Legacy / not-currently-mounted findings');
  L.push('');
  L.push('Findings in source files that are not rendered in the running app');
  L.push('(dead code behind a disabled render branch). Tracked, not failing.');
  L.push('');
  L.push(renderFindingTable(result.legacyFindings));
  L.push('## How to fix');
  L.push('');
  L.push('- Replace the term with the suggested replacement in the same row.');
  L.push('- If a match is a false positive (an internal identifier the scanner');
  L.push('  misread), add `ux-audit-ignore-line` as a trailing comment on that');
  L.push('  line, or add a justified entry to `ALLOWLIST` in the audit script.');
  L.push('- Database table names (`debates`) and internal code identifiers');
  L.push('  (`gameCopy`, `argumentGameSurface`) are intentionally out of scope.');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv) {
  const strict = argv.includes('--strict');
  const result = runAudit();
  const report = renderReport(result);
  const abs = path.join(REPO_ROOT, REPORT_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, report.endsWith('\n') ? report : report + '\n', 'utf8');

  console.log('[ux-terminology-audit] scan complete');
  console.log(`  files scanned        : ${result.scannedFileCount}`);
  console.log(`  live prohibited      : ${result.liveProhibited.length}`);
  console.log(`  live discouraged     : ${result.liveDiscouraged.length}`);
  console.log(`  legacy (not mounted) : ${result.legacyFindings.length}`);
  console.log(`  report               : ${REPORT_PATH}`);

  if (strict && result.liveProhibited.length > 0) {
    console.error('[ux-terminology-audit] FAIL (--strict): live prohibited violations present');
    process.exitCode = 1;
    return;
  }
  if (result.liveProhibited.length > 0) {
    console.log('[ux-terminology-audit] WARN: live prohibited violations present (warn mode — not failing)');
  } else {
    console.log('[ux-terminology-audit] OK: no live prohibited violations');
  }
  process.exitCode = 0;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  REPORT_PATH,
  SCAN_ROOTS,
  LEGACY_NOT_MOUNTED,
  PROHIBITED_PATTERNS,
  DISCOURAGED_PATTERNS,
  isUserCopyCandidate,
  extractCandidatesFromLine,
  classifyText,
  auditFile,
  isLegacyFile,
  runAudit,
  renderReport,
};
