/**
 * UX-PR-G (#920) — the ONE canonical fixture-tag registry.
 *
 * Pure TypeScript with ZERO runtime imports (only a type-only `Debate`
 * import, erased at build). This module is deliberately import-free so it
 * can be depended on by the broadly-imported `conversationGalleryModel`
 * without risking a web-bundle TDZ require cycle. The repo has been bitten
 * twice by such cycles (see `railActionCategories.ts` header); a leaf module
 * is the cycle-proof home for a widely-shared helper.
 *
 * It consolidates the THREE drifted regex mirrors that previously each
 * carried a private copy of the corpus-runner title-tag family:
 *   - `botRoomPolicyModel.BOT_SEED_TAG_PATTERNS` (source of truth; had reseed)
 *   - `conversationGalleryModel.SUFFIX_TAG_PATTERNS` (had reseed)
 *   - `argumentArtifactModel.SUFFIX_TAG_PATTERNS` (MISSING reseed — drifted)
 * All three now delegate here, which fixes the argumentArtifactModel reseed
 * drift by construction (proven by the mirror-parity test).
 *
 * Doctrine (cdiscourse-doctrine §9): a raw fixture tag
 * (`[stress ...]` / `[xai-adv ...]` / `[reseed-...]` / `[ai-corpus ...]`) is
 * an internal code and must NEVER render verbatim on a user surface. The
 * display-strip below is the single hoisted implementation the gallery, the
 * room title, the circles picker, and the weave picker all call. The
 * fixture exclusion (§10a) marks an account/room TYPE, never a person.
 */
import type { Debate } from './types';

/**
 * The ONE canonical fixture-tag pattern family (moved verbatim from
 * `botRoomPolicyModel.BOT_SEED_TAG_PATTERNS`, which already carried the
 * HOME-001 #874 `reseed` alternative). Each pattern is anchored to the real
 * trailing-tag shapes and keyed to specific run-tag keywords + an end-anchor,
 * so a legitimate title that merely contains a bracket
 * (e.g. `"[2024] budget debate"`) is NOT treated as a fixture.
 */
export const FIXTURE_SUFFIX_TAG_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /\s*\[(?:xai-adv|ai-corpus|stress|reseed|stage-\d+(?:\.\d+)*|run-\d+|scenario-\d+|seed-\d+)\b[^\]]*\]\s*$/i,
  /\s*\[(?:xai|ai|bot|corpus|stress|scenario|seed|reseed)[\w\d\s\-_:.,#]*\]\s*$/i,
  /\s*\([\w\d\s\-_:.,#]*?(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d\s\-_:.,#]*?\)\s*$/i,
  /\s*#(?:xai-adv|ai-corpus|stress|scenario|seed)[\w\d_-]+\s*$/i,
]);

/**
 * Collapse runs of whitespace and trim. Byte-identical to the private helper
 * both `conversationGalleryModel` and `argumentArtifactModel` already used, so
 * their delegated output is unchanged for non-fixture titles.
 */
function normaliseWhitespace(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Predicate: does this RAW title carry a corpus/bot/reseed fixture tag?
 * Tests the raw string (never normalised first) so it stays byte-parity with
 * the previous `botRoomPolicyModel.looksLikeBotSeedTag`. Null / empty /
 * whitespace-only => false.
 */
export function looksLikeBotSeedTag(title: string | null | undefined): boolean {
  if (typeof title !== 'string' || title.trim().length === 0) return false;
  return FIXTURE_SUFFIX_TAG_PATTERNS.some((re) => re.test(title));
}

/**
 * Display-strip: remove the trailing fixture tag(s) for user display.
 * `"Chime cohort smoke [stress chime-mrgpodh6]"` -> `"Chime cohort smoke"`.
 * Returns the whitespace-normalised original when no tag matches. Can return
 * `''` only when the whole title was a bare tag (callers fall back with
 * `stripFixtureTag(t) || t`). This is the EXACT loop `cleanTitleForDedupe` /
 * `cleanArtifactTitleForDedupe` already ran — hoisted so all three share one
 * implementation.
 */
export function stripFixtureTag(title: string | null | undefined): string {
  let t = normaliseWhitespace(title ?? '');
  for (let i = 0; i < 3 && t.length > 0; i++) {
    let changed = false;
    for (const re of FIXTURE_SUFFIX_TAG_PATTERNS) {
      const next = t.replace(re, '');
      if (next !== t) {
        t = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return t;
}

/**
 * Convenience: hide a fixture room for a NON-admin viewer only. Admins keep
 * fixture rooms visible (marked by the existing BotRoomMarker); non-admins get
 * them excluded from discovery.
 */
export function shouldHideFixtureForViewer(input: {
  title: string | null | undefined;
  isAdminViewer: boolean;
}): boolean {
  return !input.isAdminViewer && looksLikeBotSeedTag(input.title);
}

/**
 * The set of debateIds whose RAW title is a fixture tag. Built from the raw
 * `debate.title` (never a stripped card title, which would no longer match).
 * Mirrors the shipped `homeModel.collectFixtureDebateIds` precedent.
 */
export function collectFixtureDebateIds(
  debates: ReadonlyArray<Pick<Debate, 'id' | 'title'>>,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(debates)) return ids;
  for (const d of debates) {
    if (d && looksLikeBotSeedTag(d.title)) ids.add(d.id);
  }
  return ids;
}
