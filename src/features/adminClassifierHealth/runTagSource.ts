/**
 * DEVEX-RUNTAG-COLUMN-SWAP-001 — runTag source abstraction (Q3 → durable swap).
 *
 * The durable `public.debates.run_tag text NULL` column landed in #476
 * (migration `supabase/migrations/20260605000001_corpus30_runtag_persist.sql`)
 * — it is joined into the runs query (`debates(title, run_tag)`) and is now the
 * CANONICAL runTag. The corpus runner writes the run identifier as structured
 * data; the panel reads it directly instead of parsing the title.
 *
 * Backfill of legacy rows is an OPERATOR-run, one-time step (the recipe is a
 * commented block in the migration) and has NOT been run — so legacy rooms
 * still carry `run_tag = NULL`. For those rows the panel FALLS BACK to the
 * legacy title-suffix heuristic: the corpus runner emits `... [<runTag> tNN]`
 * (see `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js`), mirroring the
 * gallery `SUFFIX_TAG_PATTERNS` dedupe convention in
 * `conversationGalleryModel.ts`. The fallback is genuinely needed.
 *
 * Canonical rule (operator-mandated; fallback PRESERVED):
 *   - Durable `run_tag` is AUTHORITATIVE when present (non-null AND non-empty
 *     AND non-whitespace after trim).
 *   - The title-suffix derivation is FALLBACK ONLY, used when `run_tag` is
 *     absent / null / empty / whitespace.
 *   - If durable `run_tag` and the parsed title-suffix DISAGREE, durable WINS.
 *   - Empty-string / whitespace `run_tag` is treated as ABSENT (→ fallback).
 *
 * The `RunTagSource` interface remains the SEAM. `makeRunTagSource()` now
 * returns the `DurableColumnRunTagSource` (kind `'durable_column'`); the
 * `TitleSuffixRunTagSource` (kind `'title_suffix_heuristic'`) is retained for
 * back-compat + tests and is the fallback the durable source delegates to when
 * no durable value is present.
 *
 * Pure TS — no React, no Supabase, no fetch, no Deno. Jest-loadable.
 */

/** How a runTag value was derived, for transparency in the verdict. */
export type RunTagSourceKind = 'title_suffix_heuristic' | 'durable_column' | 'none';

/**
 * The per-row context a `RunTagSource` reads. `debateRunTag` is the durable
 * `public.debates.run_tag` column value (joined in); `debateTitle` is the room
 * title used only for the legacy suffix fallback.
 */
export interface RunTagExtractContext {
  debateTitle: string | null | undefined;
  /** The durable `debates.run_tag` column value, when joined. Optional. */
  debateRunTag?: string | null;
}

/**
 * The stable seam. Given the per-row context, a `RunTagSource` extracts the
 * runTag value for that row (or `null` when none is present), and reports which
 * strategy it used. A row "matches" a runTag filter when its extracted runTag
 * equals the filter value (case-insensitive).
 */
export interface RunTagSource {
  readonly kind: RunTagSourceKind;
  /** Extract the runTag from a row's context. `null` when absent. */
  extract(context: RunTagExtractContext): string | null;
}

/**
 * True when a durable `run_tag` value is genuinely present: a non-empty,
 * non-whitespace string. Empty / whitespace / null / undefined is ABSENT.
 * Returns the trimmed value when present, else `null`.
 */
function durableRunTagOrNull(debateRunTag: string | null | undefined): string | null {
  if (typeof debateRunTag !== 'string') return null;
  const trimmed = debateRunTag.trim();
  return trimmed.length > 0 ? trimmed : null;
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

/**
 * The legacy title-suffix heuristic implementation. Retained for back-compat +
 * tests; it is the FALLBACK the durable source delegates to. Reads ONLY the
 * trailing `[<runTag> tNN]` suffix from the room title.
 */
class TitleSuffixRunTagSource implements RunTagSource {
  readonly kind: RunTagSourceKind = 'title_suffix_heuristic';

  extract(context: RunTagExtractContext): string | null {
    const title = context?.debateTitle;
    if (typeof title !== 'string' || title.length === 0) return null;
    const match = TITLE_SUFFIX_RUNTAG_PATTERN.exec(title.trim());
    if (!match) return null;
    const tag = match[1].trim();
    return tag.length > 0 ? tag : null;
  }
}

/**
 * The durable-column runTag source (canonical; DEVEX-RUNTAG-COLUMN-SWAP-001).
 * Returns the trimmed durable `debates.run_tag` value when it is present
 * (non-empty / non-whitespace); otherwise FALLS BACK to the legacy title-suffix
 * parse for legacy rows whose `run_tag` is NULL. Durable WINS on disagreement.
 */
class DurableColumnRunTagSource implements RunTagSource {
  readonly kind: RunTagSourceKind = 'durable_column';

  private readonly fallback = new TitleSuffixRunTagSource();

  extract(context: RunTagExtractContext): string | null {
    const durable = durableRunTagOrNull(context?.debateRunTag);
    if (durable !== null) return durable;
    return this.fallback.extract(context);
  }
}

/**
 * The default runTag source — the durable-column source (canonical), which
 * falls back to the title-suffix heuristic for legacy rows whose `run_tag` is
 * NULL (DEVEX-RUNTAG-COLUMN-SWAP-001).
 */
export function makeRunTagSource(): RunTagSource {
  return new DurableColumnRunTagSource();
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
