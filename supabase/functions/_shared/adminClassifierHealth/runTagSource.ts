/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Deno-clean twin of
 * `src/features/adminClassifierHealth/runTagSource.ts`. Behavior-parity copy;
 * pure TS, no imports. Server (Deno / Edge) side.
 *
 * runTag source abstraction (Q3).
 *
 * There is NO durable `run_tag` column on `argument_machine_observation_runs`
 * at HEAD (#476 CORPUS-30-RUNTAG-PERSIST is OPEN). Until it lands, the panel
 * derives a runTag from the debate-title suffix the corpus runner writes:
 * `buildRoomTitle` emits `... [<runTag> tNN]` (see
 * `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:167`). This mirrors the
 * gallery `SUFFIX_TAG_PATTERNS` dedupe convention in
 * `conversationGalleryModel.ts`.
 *
 * The `RunTagSource` interface is the SEAM: a future card swaps the heuristic
 * impl for a `durable_column` impl (when #476 lands) by changing ONE line at
 * the call site — `makeRunTagSource()` → `makeDurableColumnRunTagSource()` —
 * without touching the aggregation model or the Edge query shape.
 *
 * Follow-up issue: DEVEX-RUNTAG-COLUMN-SWAP-001 (swap to the durable indexed
 * `run_tag` column when #476 lands).
 *
 * Pure TS — no React, no Supabase, no fetch. Deno-loadable + Jest-loadable.
 */

/** How a runTag value was derived, for transparency in the verdict. */
export type RunTagSourceKind = 'title_suffix_heuristic' | 'durable_column' | 'none';

/**
 * The stable seam. Given the per-row title context, a `RunTagSource` extracts
 * the runTag value for that row (or `null` when none is present), and reports
 * which strategy it used. A row "matches" a runTag filter when its extracted
 * runTag equals the filter value (case-insensitive).
 */
export interface RunTagSource {
  readonly kind: RunTagSourceKind;
  /** Extract the runTag from a row's title context. `null` when absent. */
  extract(titleContext: { debateTitle: string | null | undefined }): string | null;
}

/**
 * Matches a trailing `[<runTag> tNN]` suffix and captures the runTag token.
 * The runTag token allows the corpus-runner shapes (`xai-adv`, `ai-corpus`,
 * `stress`, `scenario-NN`, `seed-NN`, `stage-N.N`, `run-NN`) plus any
 * word/dash/dot tag — it is the token BEFORE the ` tNN` thread index.
 *
 * Examples that match:
 *   "Claim text [xai-adv t03]"   → "xai-adv"
 *   "Foo [ai-corpus t12]"        → "ai-corpus"
 *   "Bar [stress t00]"           → "stress"
 */
const TITLE_SUFFIX_RUNTAG_PATTERN = /\[([\w.\-:]+)\s+t\d{1,4}\]\s*$/i;

/** The title-suffix heuristic implementation (v1 default; Q3). */
class TitleSuffixRunTagSource implements RunTagSource {
  readonly kind: RunTagSourceKind = 'title_suffix_heuristic';

  extract(titleContext: { debateTitle: string | null | undefined }): string | null {
    const title = titleContext?.debateTitle;
    if (typeof title !== 'string' || title.length === 0) return null;
    const match = TITLE_SUFFIX_RUNTAG_PATTERN.exec(title.trim());
    if (!match) return null;
    const tag = match[1].trim();
    return tag.length > 0 ? tag : null;
  }
}

/**
 * The default runTag source — the title-suffix heuristic. Swap this factory
 * for a durable-column factory when #476 lands (DEVEX-RUNTAG-COLUMN-SWAP-001).
 */
export function makeRunTagSource(): RunTagSource {
  return new TitleSuffixRunTagSource();
}

/**
 * True when `extracted` matches the `filter` runTag (case-insensitive). A
 * `null`/empty filter matches everything (no runTag filter applied).
 */
export function runTagMatches(
  extracted: string | null,
  filter: string | null | undefined,
): boolean {
  if (filter == null || filter.length === 0) return true;
  if (extracted == null) return false;
  return extracted.trim().toLowerCase() === filter.trim().toLowerCase();
}
