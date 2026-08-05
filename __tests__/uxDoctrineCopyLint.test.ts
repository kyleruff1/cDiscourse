/**
 * UX-DOCTRINE-COPY-LINT (issue 677) — doctrine ban-list lint over visible copy.
 *
 * Bidirectional guard mirroring cohesionPrinciple9Guard (ratchet structure) and
 * voice003ForbiddenInferenceGuard (firing positive control + role-tally):
 *
 *   (a) NEGATIVE (ban-list). A locked lexicon of ~60 tokens across 11 doctrine
 *       groups must NEVER appear in a visible-copy string literal across the
 *       25-file Tier A + Tier B scan set. See BANNED_LEXICON_BY_GROUP below.
 *
 *   (b) POSITIVE (canonical vocabulary). MEDIATOR_STATE_COPY, PATHWAY_STEP_COPY,
 *       MOVE_COPY, and the five brandCopy constants are byte-equal-asserted.
 *       A rename or missing key fires loudly.
 *
 *   (c) FIRING POSITIVE CONTROL. The .ts.txt fixture kept beside a scanned
 *       file must trip the scanner on 3-or-more distinct banned tokens spread
 *       across 3-or-more role tallies (comment / string-literal / field-name).
 *       If the extractor regex or the scan-file walk is broken, this bites.
 *
 *   (d) MUST-NOT-FIRE CONTROL. Canonical clean strings pass the scanner clean.
 *
 *   (e) ALLOWLIST-COMPLETENESS RATCHET. Every allowlist entry is verified to
 *       exist on disk (a stale entry from a burn-down fires); every scanner
 *       hit either matches the allowlist or is reported as an offender.
 *
 * FOUR-TIER CARVE-OUT (in order, see extractCandidateLines):
 *   1. Path exclusion — admin, __tests__, __fixtures__, scripts are never in
 *      the scan set (enforced by SCAN_SET being an authored list).
 *   2. Ban-list declaration stripper — a FORBIDDEN_* / BANNED_* / _forbidden*
 *      Tokens / _banned* Tokens declaration removes every string literal from
 *      the declaration until the matching close-bracket, counted by a bracket-
 *      depth counter over [ ] and { }.
 *   3. Comment stripper — /* block *_/ and // line comments are removed before
 *      the literal extractor runs.
 *   4. Per-file allowlist — a (path, token, literal) triple silences the hit;
 *      no other hit at that path silences.
 *
 * SCANNER-HAZARD NOTES (mandatory):
 *   - All comments in this file are apostrophe-free so the naive quote-parity
 *     scanners (uxOneOneTwoDoctrine) running in the same jest process do not
 *     misparse it. This guard uses a proper string-literal extractor and is
 *     itself immune.
 *   - No hash-sign issue references in comments. Convention is (issue N).
 *   - The guard test file lives at __tests__ and is NEVER in its own scan set,
 *     so its ban-list declaration arrays are not self-scanned.
 *   - The .ts.txt fixture is out of tsc + eslint recurse; testMatch (jest.config
 *     in package.json) only picks up *.test.(ts|tsx).
 *
 * Pure TS. No React, no Supabase, no network. Helpers are self-contained so a
 * production refactor cannot silently disarm the guard.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { MOVE_COPY } from '../src/features/arguments/gameCopy';
import {
  MEDIATOR_STATE_COPY,
  PATHWAY_STEP_COPY,
} from '../src/features/mediator/mediatorPlainLanguage';
import {
  PRODUCT_NAME,
  PRIMARY_TAGLINE,
  PRINCIPLE_MARK_THE_POINT,
  WHAT_REMAINS_UNRESOLVED,
  WHAT_WOULD_MOVE_THIS_FORWARD,
} from '../src/lib/brandCopy';

const REPO = process.cwd();

// ---------- Banned lexicon (11 groups; flattened for scanning) --------------

// Group human structure is for the failure diagnostic and self-documentation
// only; the guard flattens all tokens into one set.
type BannedGroup =
  | 'verdict'
  | 'truth_frame'
  | 'person_labels'
  | 'fallacy'
  | 'emotion_intent'
  | 'popularity_heat'
  | 'color_verdict'
  | 'score_frame'
  | 'wrong_frame'
  | 'honest_dishonest'
  | 'waveform_credibility'
  | 'stored_audio';

// verdict — cdiscourse-doctrine section 1: the app never labels a person, post,
// or claim as winner or loser. The referee never adjudicates.
const VERDICT_BANS: readonly string[] = Object.freeze([
  'winner', 'loser', 'verdict', 'defeated', 'won', 'lost',
]);

// truth-frame — cdiscourse-doctrine section 1: no truth value on a claim.
const TRUTH_FRAME_BANS: readonly string[] = Object.freeze([
  'truth', 'truthful', 'true', 'false', 'proven', 'disproven', 'validated', 'proof',
]);

// person-labels — cdiscourse-doctrine section 1 + evidence-doctrine person-labels
// banned by the AI annotator: never call a HUMAN one of these.
const PERSON_LABELS_BANS: readonly string[] = Object.freeze([
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulator', 'manipulation',
  'extremist', 'propagandist', 'troll', 'bot', 'astroturfer',
]);

// fallacy — logic-shaming vocabulary the mediator never uses.
const FALLACY_BANS: readonly string[] = Object.freeze([
  'fallacy', 'fallacious',
]);

// emotion-intent — VOICE-003 and the referee never infer feeling or intent.
const EMOTION_INTENT_BANS: readonly string[] = Object.freeze([
  'angry', 'emotional', 'emotion', 'anger', 'mood', 'sentiment',
  'intent', 'intention', 'manipulated',
]);

// popularity-heat — cdiscourse-doctrine section 3: popularity is not evidence.
// The `hot` carve-out (gallery activity) is intentionally NOT banned.
const POPULARITY_HEAT_BANS: readonly string[] = Object.freeze([
  'likes', 'retweets', 'shares', 'views', 'followers', 'verified',
  'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral',
]);

// color-verdict — only fires on English verdict phrases combining red or green
// with a mark, verdict, flag, or light noun. A raw red or green in a color-token
// identifier does NOT fire (owned by cohesionPrinciple9Guard and the color-token
// layer). This is a phrase-level substring scan, NOT the whole-word rule.
const COLOR_VERDICT_PHRASE_BANS: readonly string[] = Object.freeze([
  'red mark', 'green mark',
  'red verdict', 'green verdict',
  'red flag on the claim', 'green light on the claim',
]);

// score-frame — the app never presents a scoreboard. The imperative NOT-to-score
// warning is the one allowlisted carve-out (see ALLOWLIST_BY_FILE).
const SCORE_FRAME_BANS: readonly string[] = Object.freeze([
  'score', 'scored', 'scoring', 'scoreboard',
]);

// wrong-frame — the both-sides humility phrase is the shipped carve-out; every
// other appearance in visible copy fires.
const WRONG_FRAME_BANS: readonly string[] = Object.freeze([
  'wrong',
]);

// honest-dishonest — the shape-adjective carve-out (keeps the shape honest) is
// allowlisted; every other appearance fires. Never a person-attribution.
const HONEST_DISHONEST_BANS: readonly string[] = Object.freeze([
  'honest', 'honesty', 'sincere', 'sincerity',
  'authentic', 'authenticity', 'genuine', 'genuineness',
]);

// waveform-credibility — VOICE-ADR-002 doctrine layer. Voice is a mode of speech,
// never a signal of speaker identity, credibility, or authenticity. Substring
// scan (compound tokens with whitespace).
const WAVEFORM_CREDIBILITY_BANS: readonly string[] = Object.freeze([
  'voiceprint', 'voice signature', 'credibility from audio', 'identifies the speaker',
]);

// stored-audio — VOICE-ADR-002: the app never stores or persists raw audio.
// Substring scan.
const STORED_AUDIO_BANS: readonly string[] = Object.freeze([
  'stored audio', 'saved audio', 'audio uploaded', 'voice recording saved',
]);

const BANNED_LEXICON_BY_GROUP: Readonly<Record<BannedGroup, readonly string[]>> =
  Object.freeze({
    verdict: VERDICT_BANS,
    truth_frame: TRUTH_FRAME_BANS,
    person_labels: PERSON_LABELS_BANS,
    fallacy: FALLACY_BANS,
    emotion_intent: EMOTION_INTENT_BANS,
    popularity_heat: POPULARITY_HEAT_BANS,
    color_verdict: COLOR_VERDICT_PHRASE_BANS,
    score_frame: SCORE_FRAME_BANS,
    wrong_frame: WRONG_FRAME_BANS,
    honest_dishonest: HONEST_DISHONEST_BANS,
    waveform_credibility: WAVEFORM_CREDIBILITY_BANS,
    stored_audio: STORED_AUDIO_BANS,
  });

// Flat set of tokens. Tokens with whitespace or a leading non-word char are
// scanned as literal substrings; everything else is scanned as a whole word.
const FLAT_BANS: readonly string[] = Object.freeze(
  Object.values(BANNED_LEXICON_BY_GROUP).flatMap((g) => [...g]),
);

// ---------- Scan set (Tier A + Tier B, exactly 25 files) --------------------

// Tier A — every *Copy.ts family file plus a small handful of non-Copy visible
// strings modules under src/features that carry mediator, referee, or a11y
// user-facing copy. Enumerated explicitly (glob-agnostic): a NEW *Copy.ts under
// src/features must be added here (or to EXPLICITLY_EXCLUDED) or the
// completeness check below bites.
const SCAN_SET_TIER_A: readonly string[] = Object.freeze([
  'src/lib/brandCopy.ts',
  'src/features/arguments/gameCopy.ts',
  'src/features/arguments/standingBandCopy.ts',
  'src/features/arguments/viewModeCopy.ts',
  'src/features/arguments/markers/markerCopy.ts',
  'src/features/arguments/crossRoom/callbackComposerCopy.ts',
  'src/features/arguments/crossRoom/callbackEchoCopy.ts',
  'src/features/arguments/crossRoom/linkedPriorArgumentCopy.ts',
  'src/features/auth/authCallbackCopy.ts',
  'src/features/evidence/evidenceApplicabilityCopy.ts',
  'src/features/evidence/sourceChainPresetCopy.ts',
  'src/features/feedback/moveMarksCopy.ts',
  'src/features/invites/inviteCopy.ts',
  'src/features/mediator/mediatorPlainLanguage.ts',
  'src/features/mediator/mediatorRailCopy.ts',
  'src/features/nodeAnnotations/annotationAriaLabel.ts',
  'src/features/notifications/notificationCopy.ts',
  'src/features/preferences/preferencesCopy.ts',
  'src/features/profileTags/profileTagCopy.ts',
  'src/features/proof/proofDrawerCopy.ts',
  'src/features/refereeBanners/accessibilityLabel.ts',
  'src/features/refereeLedger/refereeLedgerCopy.ts',
]);

// Tier B — non-*Copy.ts modules carrying visible strings, surfaced by the
// pre-launch reality audit (issue 677 design section 4.2).
const SCAN_SET_TIER_B: readonly string[] = Object.freeze([
  'src/lib/designTokens.ts',
  'src/features/mediator/nextMovesForState.ts',
  'src/features/arguments/gameStatus.ts',
]);

const SCAN_SET: readonly string[] = Object.freeze([
  ...SCAN_SET_TIER_A,
  ...SCAN_SET_TIER_B,
]);

// *Copy.ts files under src/features intentionally excluded from the scan set.
// Admin-surface copy has Era-D allowances (admin doctrine is scoped by admin-
// only visibility, not this general guard).
const EXPLICITLY_EXCLUDED: readonly string[] = Object.freeze([
  'src/features/admin/adminSpecificityReadoutCopy.ts',
]);

// Firing positive control fixture — kept out of tsc + eslint by extension.
const POSITIVE_CONTROL_REL =
  'src/features/mediator/__fixtures__/uxDoctrineCopyLintFiring.positiveControl.ts.txt';

// ---------- Per-file allowlist (see design section 8) -----------------------

interface AllowlistEntry {
  readonly token: string;    // banned-lexicon token (lowercase)
  readonly literal: string;  // exact string-literal that contains the token
  readonly tag: string;      // operator-ruling or doctrine carve-out citation
}

// Allowlist is per (path, token, literal) triple. Every entry needs a tag that
// cites operator-ruling or the specific doctrine carve-out. A burn-down PR that
// removes the literal MUST shrink this map in the same PR; the allowlist
// completeness ratchet below fires on stale entries. See design section 14.4.
const ALLOWLIST_BY_FILE: Readonly<Record<string, readonly AllowlistEntry[]>> =
  Object.freeze({
    // gameCopy line 89 — mightBothBeWrong. Both-sides humility phrase, not a
    // person-verdict. Shipped product copy owned by issue 676. See design 8.2.
    // gameCopy line 182 — anti_amplification. Doctrine anti-amplification
    // message; "proof" is the token being disclaimed (see next-move rationale
    // below in the same doctrine ruling family).
    // gameCopy line 188 — platform_support_warning. Anti-scoring imperative;
    // the label warns users NOT to score. See design 8.1.
    // gameCopy line 232 — inactive marker. "default views" is a UI-panels sense
    // of the word, not popularity engagement.
    // gameCopy line 390 — source_chain_gap_popularity_not_proof. Same anti-
    // amplification doctrine content pattern as line 182.
    // gameCopy lines 1458-1477 — BOT_MARKER_COPY. HONEST machine-participant
    // labeling: the app calls a bot a bot to be transparent. This is the
    // OPPOSITE of the banned "call a human a bot" doctrine. Operator-ruling
    // 2026-08-04 (issue 677): calm, honest, structural-not-verdict.
    'src/features/arguments/gameCopy.ts': [
      { token: 'wrong',  literal: 'You might both be wrong',
        tag: 'shipped-676 both-sides-humility-phrase (STATUS_COPY.mightBothBeWrong)' },
      { token: 'proof',  literal: 'Popularity is not proof',
        tag: 'operator-ruling-2026-08-04-677 anti-amplification-message' },
      { token: 'score',  literal: 'Do not score as proven yet',
        tag: 'operator-ruling-2026-08-04-677 anti-scoring-imperative' },
      { token: 'proven', literal: 'Do not score as proven yet',
        tag: 'operator-ruling-2026-08-04-677 anti-scoring-imperative' },
      { token: 'views',  literal: 'Inactive (hidden from default views)',
        tag: 'operator-ruling-2026-08-04-677 default-views-is-UI-panels-not-popularity' },
      { token: 'proof',  literal: "Popularity isn't proof — what's the source?",
        tag: 'operator-ruling-2026-08-04-677 anti-amplification-message (source-chain-gap)' },
      { token: 'bot',    literal: 'Test bot',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: '{persona} · test bot',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'This participant is a test bot, not a person. Test bots help ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bots',   literal: 'This participant is a test bot, not a person. Test bots help ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'Bot-seeded test room',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'This is a public test room seeded by a test bot. You can read and ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'follow along; a test bot started it.',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'This public room includes one or more test bots. Each test bot is ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bots',   literal: 'This public room includes one or more test bots. Each test bot is ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bot',    literal: 'A test bot started this public room. Test bots help exercise ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
      { token: 'bots',   literal: 'A test bot started this public room. Test bots help exercise ',
        tag: 'operator-ruling-2026-08-04-677 BOT_MARKER_COPY honest-machine-labeling' },
    ],
    // gameStatus line 96 — mirror of STATUS_COPY.mightBothBeWrong. Same
    // shipped-676 rationale as the gameCopy entry.
    'src/features/arguments/gameStatus.ts': [
      { token: 'wrong',  literal: 'You might both be wrong',
        tag: 'shipped-676 both-sides-humility-phrase (STATUS_COPY mirror in gameStatus)' },
    ],
    // nextMovesForState line 98 — mark_evidence_unavailable rationale. "honest"
    // describes the SHAPE of the argument, not a person. Mediator structural
    // vocabulary. See design 8.5.
    'src/features/mediator/nextMovesForState.ts': [
      { token: 'honest', literal: 'Noting the record is unavailable keeps the shape honest.',
        tag: 'operator-ruling-2026-08-04-677 shape-adjective (not person-attribution)' },
    ],
  });

// ---------- Positive contract (canonical vocabulary present) ----------------

// The 13 keys of MEDIATOR_STATE_COPY — the 11 v4 display state labels
// (per shipped UX-IMPASSE-002 issue 710) plus 2 internal-only codes
// retained for traceability. The design section 6.1 encodes on-disk truth;
// the operator ruling on the design open question (per issue 677 prompt) is
// that the 11-state on-disk count is authoritative. Byte-equal-asserted so a
// silent rename fires the guard.
const EXPECTED_MEDIATOR_STATE_LABELS: Readonly<Record<string, string>> =
  Object.freeze({
    open: 'Open',
    needs_evidence: 'Needs evidence',
    evidence_blocked: 'Evidence blocked',
    key_detail_unavailable: 'Key detail unavailable',
    definition_not_shared: 'Definition not shared',
    scope_mismatch: 'Scope mismatch',
    missing_mechanism: 'Missing link',
    value_tradeoff: 'Different priorities',
    narrowed: 'Partially narrowed',
    structured_impasse: 'Structured impasse',
    resolved_or_settled: 'Resolved',
    off_point: 'Off-point response',
    accounts_differ: 'Difference of recollection',
  });

// The 7 pathway-step verbs (dominant next-move copy).
const EXPECTED_PATHWAY_STEP_LABELS: Readonly<Record<string, string>> =
  Object.freeze({
    provide_source: 'Add a source.',
    define_term: 'Define the term',
    narrow_or_branch: 'Narrow or branch the claim',
    respond_to_point: 'Respond to the open point',
    name_tradeoff: 'Name the tradeoff',
    supply_mechanism: 'Supply the missing step',
    await_record: 'A primary record would distinguish these claims',
  });

// The 9 core move verbs on MOVE_COPY. `counter` is included because MOVE_COPY
// ships it as an alias for `reply` (ASP-CLEAN-001 primary-reply unification).
const EXPECTED_MOVE_COPY: Readonly<Record<string, string>> = Object.freeze({
  challenge: 'Disagree',
  clarify: 'Clarify',
  dropReceipts: 'Drop receipts',
  concede: 'Concede',
  narrow: 'Narrow it',
  synthesize: 'Synthesize',
  branchOff: 'Branch this off',
  reply: 'Reply',
  yourMove: 'Your Move',
});

// The 5 brand + mediator framing constants on brandCopy.
const EXPECTED_BRAND_COPY: Readonly<Record<string, string>> = Object.freeze({
  PRODUCT_NAME: 'CivilDiscourse',
  PRIMARY_TAGLINE: 'A high-trust room for hard conversations.',
  PRINCIPLE_MARK_THE_POINT: 'Mark the point, not the person.',
  WHAT_REMAINS_UNRESOLVED: 'What remains unresolved',
  WHAT_WOULD_MOVE_THIS_FORWARD: 'What would move this forward',
});

// ---------- Helpers: comment strip, ban-list strip, literal extract ---------

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip block comments across the whole source (multi-line) with a single-pass
// regex. Newlines inside a stripped block become spaces so line numbers stay
// aligned when we split.
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

// Strip trailing single-line comments from a line (everything after //).
function stripLineComment(line: string): string {
  return line.replace(/\/\/.*$/, '');
}

// Ban-list declaration stripper. A file may declare its own ban-list array or
// function whose body is a token list; the string literals INSIDE that block
// are exempt from the scan.
//
// Mechanism: scan line by line. When a line matches a declaration name
// (FORBIDDEN_*, BANNED_*, _forbiddenXxxTokens, _bannedXxxTokens), we ENTER
// strip mode and start counting the depth of `[` and `{`. Strip mode ends on
// the line where the running depth returns to zero (or lower). The declaration
// line is itself stripped so the pattern name never lands in the literal set.
//
// The starting count is set from the depth of that declaration line so the
// tracker survives declarations that open the bracket on the same line as the
// name and declarations that open the bracket on a subsequent line.
const BAN_LIST_DECLARATION_RE = new RegExp(
  '(?:export\\s+)?(?:const|function|let)\\s+' +
  '(?:_forbidden\\w+Tokens|_banned\\w+Tokens|FORBIDDEN_\\w+|BANNED_\\w+)\\b',
);

function stripBanListDeclarations(source: string): string {
  const lines = source.split('\n');
  const out: string[] = new Array(lines.length);
  let inBanList = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!inBanList) {
      if (BAN_LIST_DECLARATION_RE.test(raw)) {
        inBanList = true;
        depth = 0;
        for (const c of raw) {
          if (c === '[' || c === '{') depth += 1;
          else if (c === ']' || c === '}') depth -= 1;
        }
        // Blank this line so its literal content is exempt.
        out[i] = '';
        if (depth <= 0) {
          // A single-line declaration such as `const FOO = ['x'];` closes on
          // the same line the tracker starts. Exit at end of loop iteration.
          inBanList = false;
          depth = 0;
        }
        continue;
      }
      out[i] = raw;
      continue;
    }
    // Inside a ban-list declaration — blank the line and track depth.
    for (const c of raw) {
      if (c === '[' || c === '{') depth += 1;
      else if (c === ']' || c === '}') depth -= 1;
    }
    out[i] = '';
    if (depth <= 0) {
      inBanList = false;
      depth = 0;
    }
  }
  return out.join('\n');
}

// Extract every quoted string literal on a line. Uses a non-greedy match that
// respects the delimiter (single, double, or backtick) and honors backslash-
// escaped delimiters. Template-literal expressions (${...}) are extracted as
// part of the literal text and are not evaluated.
function extractStringLiterals(line: string): string[] {
  const uncommented = stripLineComment(line);
  const rx = /(['"`])((?:\\\1|(?!\1).)*)\1/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(uncommented))) out.push(m[2]);
  return out;
}

interface Hit {
  readonly token: string;
  readonly line: number;
  readonly literal: string;
  readonly snippet: string;
  readonly role: 'stringLiteral' | 'comment' | 'fieldName';
}

// Token classifier: whole-word for identifiers, substring for compound tokens
// (whitespace or non-word characters). A whole-word token must match with the
// \b word-boundary anchor to prevent false-fires on legitimate compound
// English words. Verified on this scan set: `intent` does NOT fire on
// `intentional`, `honest` does NOT fire on `honestly` or `dishonesty`.
function isWholeWordToken(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

function tokenMatchesLine(token: string, text: string): boolean {
  if (isWholeWordToken(token)) {
    return new RegExp('\\b' + escapeRe(token) + '\\b', 'i').test(text);
  }
  return new RegExp(escapeRe(token), 'i').test(text);
}

// Scan a source for banned-token hits inside STRING LITERALS only (comments
// and ban-list declaration bodies are already stripped). The `role` field
// classifies the surrounding context so the firing-fixture role-tally test
// can verify comment / field-name / string-literal all fire.
function scanBanned(source: string): Hit[] {
  const noBlocks = stripBlockComments(source);
  const noDecls = stripBanListDeclarations(noBlocks);
  const lines = noDecls.split('\n');
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const literals = extractStringLiterals(line);
    for (const lit of literals) {
      for (const token of FLAT_BANS) {
        if (tokenMatchesLine(token, lit)) {
          hits.push({
            token,
            line: i + 1,
            literal: lit,
            snippet: line.trim(),
            role: 'stringLiteral',
          });
        }
      }
    }
  }
  return hits;
}

// Fixture-only scanner that ALSO reports comment and field-name hits. Used by
// the firing positive control to assert the scanner sees hits in every role.
// Production code never calls this — the production surface is scanBanned.
function scanBannedForFixture(source: string): Hit[] {
  const hits = scanBanned(source);
  // Also walk the raw source (WITHOUT the comment strip) for field-name and
  // comment hits so the role-tally has something to count.
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const isComment = trimmed.startsWith('//') || trimmed.startsWith('*');
    // Field-name role: `readonly foo: T`, `foo:` on a line without a string.
    const fieldNameMatch = trimmed.match(/^(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    for (const token of FLAT_BANS) {
      if (!isWholeWordToken(token)) continue;
      if (isComment) {
        if (tokenMatchesLine(token, raw)) {
          hits.push({
            token, line: i + 1, literal: '', snippet: trimmed, role: 'comment',
          });
        }
        continue;
      }
      if (fieldNameMatch) {
        const name = fieldNameMatch[1];
        if (tokenMatchesLine(token, name)) {
          hits.push({
            token, line: i + 1, literal: name, snippet: trimmed, role: 'fieldName',
          });
        }
      }
    }
  }
  return hits;
}

function loadSource(rel: string): string {
  return readFileSync(join(REPO, rel), 'utf8');
}

// Offenders for a file: scanner hits MINUS allowlist entries (matched by both
// token and literal). A hit that is not in the allowlist is an offender.
function offendersFor(rel: string): Hit[] {
  const src = loadSource(rel);
  const hits = scanBanned(src);
  const allow = ALLOWLIST_BY_FILE[rel] ?? [];
  const isAllowed = (h: Hit): boolean =>
    allow.some((a) => a.token === h.token && a.literal === h.literal);
  return hits.filter((h) => !isAllowed(h));
}

// Walk *Copy.ts files under src/features (used only by the completeness ratchet
// that guards against a new *Copy.ts landing without being classified).
function walkCopyTsUnderFeatures(): string[] {
  const out: string[] = [];
  const start = join(REPO, 'src', 'features');
  function recurse(dir: string): void {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === '__tests__' || name === '__fixtures__') continue;
      const full = join(dir, name);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        recurse(full);
      } else if (name.endsWith('Copy.ts')) {
        out.push(relative(REPO, full).replace(/\\/g, '/'));
      }
    }
  }
  recurse(start);
  return out.sort();
}

// ---------- (a) Scan set coverage + per-file assert-absent -----------------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — visible-copy surface scan', () => {
  test('the scan set covers exactly 25 files (22 Tier A + 3 Tier B)', () => {
    expect(SCAN_SET_TIER_A).toHaveLength(22);
    expect(SCAN_SET_TIER_B).toHaveLength(3);
    expect(SCAN_SET).toHaveLength(25);
    for (const rel of SCAN_SET) {
      const src = readFileSync(join(REPO, rel), 'utf8');
      expect(src.length).toBeGreaterThan(0);
    }
  });

  test.each(SCAN_SET)(
    '%s carries no banned doctrine token outside the allowlist',
    (rel) => {
      const offenders = offendersFor(rel);
      if (offenders.length > 0) {
        const rendered = offenders
          .map((h) => `  line ${h.line} [${h.token}]: ${h.literal}`)
          .join('\n');
        throw new Error(
          `banned doctrine tokens found in ${rel}:\n${rendered}\n\n` +
          `If the literal is legitimate, add a per-file allowlist entry with ` +
          `an operator-ruling tag. If the literal is a defect, reword it (in a ` +
          `separate copy card such as UX-COPY-001-follow).`,
        );
      }
      expect(offenders).toEqual([]);
    },
  );
});

// ---------- (b) Positive contract (canonical vocabulary present) -----------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — positive contract', () => {
  test('MEDIATOR_STATE_COPY has the 11 v4 display + 2 internal states with expected byte-equal labels', () => {
    const keys = Object.keys(EXPECTED_MEDIATOR_STATE_LABELS);
    expect(keys).toHaveLength(13);
    for (const [code, expected] of Object.entries(EXPECTED_MEDIATOR_STATE_LABELS)) {
      expect((MEDIATOR_STATE_COPY as Record<string, string>)[code]).toBe(expected);
    }
    // Every code shipped in MEDIATOR_STATE_COPY is in the positive contract.
    // A silent addition would land here and fail loudly, which is the intended
    // regression signal.
    for (const k of Object.keys(MEDIATOR_STATE_COPY)) {
      expect(EXPECTED_MEDIATOR_STATE_LABELS).toHaveProperty(k);
    }
  });

  test('PATHWAY_STEP_COPY has 7 pathway-step verbs with expected byte-equal labels', () => {
    const keys = Object.keys(EXPECTED_PATHWAY_STEP_LABELS);
    expect(keys).toHaveLength(7);
    for (const [code, expected] of Object.entries(EXPECTED_PATHWAY_STEP_LABELS)) {
      expect((PATHWAY_STEP_COPY as Record<string, string>)[code]).toBe(expected);
    }
    for (const k of Object.keys(PATHWAY_STEP_COPY)) {
      expect(EXPECTED_PATHWAY_STEP_LABELS).toHaveProperty(k);
    }
  });

  test('MOVE_COPY has the 9 canonical core move verbs with expected byte-equal labels', () => {
    for (const [code, expected] of Object.entries(EXPECTED_MOVE_COPY)) {
      expect((MOVE_COPY as Record<string, string>)[code]).toBe(expected);
    }
    // MOVE_COPY may ship additional aliases (for example counter aliases reply)
    // per ASP-CLEAN-001; the positive contract asserts the 9 canonical keys are
    // present and byte-equal, and does not forbid aliases.
    expect(Object.keys(EXPECTED_MOVE_COPY)).toHaveLength(9);
  });

  test('brandCopy has the 5 canonical brand + mediator framing constants byte-equal', () => {
    expect(PRODUCT_NAME).toBe(EXPECTED_BRAND_COPY.PRODUCT_NAME);
    expect(PRIMARY_TAGLINE).toBe(EXPECTED_BRAND_COPY.PRIMARY_TAGLINE);
    expect(PRINCIPLE_MARK_THE_POINT).toBe(EXPECTED_BRAND_COPY.PRINCIPLE_MARK_THE_POINT);
    expect(WHAT_REMAINS_UNRESOLVED).toBe(EXPECTED_BRAND_COPY.WHAT_REMAINS_UNRESOLVED);
    expect(WHAT_WOULD_MOVE_THIS_FORWARD).toBe(EXPECTED_BRAND_COPY.WHAT_WOULD_MOVE_THIS_FORWARD);
  });
});

// ---------- (c) Firing positive control — the scanner bites ----------------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — firing positive control', () => {
  test('the .ts.txt fixture trips the scanner on 3-or-more distinct tokens across 3-or-more roles', () => {
    const src = readFileSync(join(REPO, POSITIVE_CONTROL_REL), 'utf8');
    const hits = scanBannedForFixture(src);
    const distinct = new Set(hits.map((h) => h.token));
    expect(distinct.size).toBeGreaterThanOrEqual(3);
    const roles = { comment: 0, stringLiteral: 0, fieldName: 0 };
    for (const h of hits) roles[h.role] += 1;
    expect(roles.comment).toBeGreaterThanOrEqual(1);
    expect(roles.stringLiteral).toBeGreaterThanOrEqual(1);
    expect(roles.fieldName).toBeGreaterThanOrEqual(1);
  });

  test('the .ts.txt fixture is NOT in the production scan set', () => {
    expect(SCAN_SET).not.toContain(POSITIVE_CONTROL_REL);
    // And a walk of *Copy.ts under src/features never surfaces the .ts.txt
    // path (extension guard) — belt and braces.
    const copyTs = walkCopyTsUnderFeatures();
    for (const rel of copyTs) {
      expect(rel.endsWith('.ts.txt')).toBe(false);
      expect(rel).not.toContain('__fixtures__');
    }
  });
});

// ---------- (d) Must-NOT-fire control — canonical strings pass clean -------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — must-NOT-fire control', () => {
  // Canonical strings drawn from the shipped mediator, brand, and pathway
  // vocabulary — none of these must trip the scanner.
  const CANONICAL_CLEAN: readonly string[] = Object.freeze([
    'Needs evidence',
    'Evidence blocked',
    'Structured impasse',
    'Different priorities',
    'A high-trust room for hard conversations.',
    'Mark the point, not the person.',
    'What remains unresolved',
    'What would move this forward',
    'Add a source.',
    'Narrow or branch the claim',
  ]);

  test.each(CANONICAL_CLEAN)(
    'canonical string %j does not trip the scanner',
    (text) => {
      // Wrap the literal in a fake source line so the extractor sees it.
      const fakeSource = `const x = ${JSON.stringify(text)};`;
      const hits = scanBanned(fakeSource);
      expect(hits).toEqual([]);
    },
  );

  test('word-boundary bans do not false-fire on compound English words', () => {
    // Design section 11.3 verified: intent does NOT fire on intentional; honest
    // does NOT fire on honestly or dishonesty. These assertions pin that
    // behavior against a future regex regression.
    const nonFiring = [
      'a fully intentional pause',
      'she spoke honestly at length',
      'he denied any dishonesty',
      'this is a good conversation',
      'the hot gallery card',
    ];
    for (const t of nonFiring) {
      const hits = scanBanned(`const x = ${JSON.stringify(t)};`);
      expect(hits).toEqual([]);
    }
  });
});

// ---------- (e) Allowlist-completeness ratchet ------------------------------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — allowlist completeness ratchet', () => {
  // Flatten allowlist for a per-entry .each check.
  const flat: ReadonlyArray<[string, AllowlistEntry]> =
    Object.entries(ALLOWLIST_BY_FILE).flatMap(
      ([file, entries]) => entries.map((e) => [file, e] as [string, AllowlistEntry]),
    );

  test.each(flat)('allowlist entry for %s (%o) is present on disk', (rel, entry) => {
    const src = loadSource(rel);
    expect(src).toContain(entry.literal);
    // Every entry carries a non-empty tag citing operator-ruling or the doctrine
    // carve-out. The tag is enforced by convention plus this assertion so a
    // silent tagless addition surfaces.
    expect(entry.tag.length).toBeGreaterThan(10);
  });

  test('every scanner hit at each allowlisted path is EITHER in the allowlist OR reported as an offender (no third path)', () => {
    for (const rel of Object.keys(ALLOWLIST_BY_FILE)) {
      const allSourceHits = scanBanned(loadSource(rel));
      const allow = ALLOWLIST_BY_FILE[rel];
      for (const hit of allSourceHits) {
        const allowed = allow.some(
          (a) => a.token === hit.token && a.literal === hit.literal,
        );
        const offender = offendersFor(rel).some(
          (o) => o.token === hit.token && o.line === hit.line && o.literal === hit.literal,
        );
        // A hit is EXACTLY one of (allowed, offender). Both true or both false
        // means the offender/allowlist partition has a bug.
        expect(allowed !== offender).toBe(true);
      }
    }
  });
});

// ---------- Completeness — every *Copy.ts is classified --------------------

describe('UX-DOCTRINE-COPY-LINT (issue 677) — every *Copy.ts under src/features is classified', () => {
  test('every *Copy.ts is either in the scan set or in EXPLICITLY_EXCLUDED', () => {
    const walked = walkCopyTsUnderFeatures();
    const covered = new Set<string>([
      ...SCAN_SET_TIER_A,
      ...EXPLICITLY_EXCLUDED,
    ]);
    const uncovered = walked.filter((f) => !covered.has(f));
    expect(uncovered).toEqual([]);
    // Also assert the EXPLICITLY_EXCLUDED file is a real file (a stale entry
    // would otherwise silently drift). This mirrors the allowlist ratchet.
    for (const rel of EXPLICITLY_EXCLUDED) {
      const src = readFileSync(join(REPO, rel), 'utf8');
      expect(src.length).toBeGreaterThan(0);
    }
  });

  test('BANNED_LEXICON_BY_GROUP flattens to a non-empty deterministic set', () => {
    expect(FLAT_BANS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(FLAT_BANS).size).toBe(FLAT_BANS.length);
    // All 11 groups are populated. (12 keys total — see BannedGroup union with
    // color-verdict added as a phrase substring group; the design section 3.1
    // says 11 doctrine groups for HUMAN readability but the color-verdict
    // group is a separate row in the lexicon table.)
    expect(Object.keys(BANNED_LEXICON_BY_GROUP)).toHaveLength(12);
    for (const g of Object.values(BANNED_LEXICON_BY_GROUP)) {
      expect(g.length).toBeGreaterThan(0);
    }
  });
});
