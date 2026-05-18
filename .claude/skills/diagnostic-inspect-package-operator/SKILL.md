---
name: diagnostic-inspect-package-operator
description: Packages CDiscourse diagnostic data (JSONL telemetry, redacted reports, code-state metadata, skill hashes) into a timestamped, safety-scanned ZIP for offline inspection. Manual-only. Never calls xAI/Anthropic/Supabase, never mutates state, never includes secrets or raw identifiers.
disable-model-invocation: true
user-invocable: true
effort: low
---

# Skill: diagnostic-inspect-package-operator

Builds a reproducible inspection bundle of CDiscourse run state so an operator (or a teammate, or a future session) can audit what happened without re-running any live API.

## Scope guard (read before any other step)

- Do NOT call xAI, Anthropic, or any other LLM provider.
- Do NOT call Supabase. No SELECT, no INSERT, no UPDATE, no DELETE, no function deploy, no migration.
- Do NOT use the `service-role` key. Do NOT direct-insert into `public.arguments`.
- Do NOT include `.env*` files, raw JSONL, raw X response dumps, screenshots, `node_modules`, `.expo`, or unredacted X data in the ZIP.
- Do NOT include secrets in any form: `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_…`, `sk-ant-…`, `xai-…` key shapes, Bearer tokens, JWTs, Authorization headers.
- Do NOT include raw user identifiers: X handles (`@name`), `x.com` / `twitter.com` / `t.co` URLs, raw 15–20-digit post IDs, email-like strings.
- Do NOT include raw hostile text. The harvester's `convertHostileBody` placeholders are safe; raw abusive bodies are not.

If any of the above would land in the staging folder, the builder must abort, write `FAILED_SAFETY_SCAN.txt` listing the offending file + pattern (NOT the secret value), and exit non-zero.

## What it packages

The skill stages **existing on-disk artifacts only**:

- `logs/engagement-intelligence/*.jsonl` — sanitised before staging (redactor stripped on the fly; output filenames suffixed `-sanitized`)
- `logs/bot-stress/*.jsonl` — sanitised
- `docs/testing-runs/*.md` — already-redacted run reports; rescanned defensively
- `docs/current-status.md`, `docs/next-prompts.md`, `CLAUDE.md`
- `package.json` scripts table (script names + commands; no secret env vars)
- Skill files under `.claude/skills/*/SKILL.md` (text + 16-hex SHA prefix of each)
- Safe code-state metadata: branch, last commit, working-tree status (summarised, not raw diff)
- Optional read-only dev-database snapshot — **only** when the operator passes `--include-db` AND `.env` is configured with anon-key credentials. The snapshot uses the anon-key client and read-only RLS-bound queries (no service-role). If anything would require service-role, the snapshot is omitted with a recorded reason.

## ZIP contract

Final shape inside `<timestamp>-cdiscourse-diagnostic-inspect.zip`:

```
README.md
MANIFEST.json
diagnostic-summary.md
decision-ledger.md
decision-ledger.json
corpus-event-index.json
corpus-metrics.json
semantic-values.json
game-change-recommendations.md
ux-playability-recommendations.md
sanitized-jsonl/<runId>-*-sanitized.jsonl
redacted-reports/<file>.md
code-state/branch.txt
code-state/last-commit.txt
code-state/working-tree.txt
code-state/skill-hashes.json
code-state/package-scripts.json
safety-scan/scan-summary.json
safety-scan/scan-passed.txt
analysis-scripts/analyze-sanitized-corpus.js
db-snapshot/    (only when --include-db is passed)
```

## CLI

```
node scripts/diagnostics/buildDiagnosticInspectPackage.js [flags]

  --dry                       Stage files + run safety scan; do NOT create the ZIP.
                              Useful for a no-write verification pass.
  --include-db                Add a read-only dev-database snapshot
                              (requires .env anon-key creds; refuses
                              service-role; gracefully omits on failure).
  --include-all-reports       Include every file under docs/testing-runs/
                              (default: only the most recent N per name pattern).
  --include-all-jsonl         Include every JSONL under logs/ (default:
                              only the 5 newest per directory).
  --out-dir <path>            Override the artifacts/diagnostics root.
```

## Behavior contract

1. **Skill gate first.** The builder reads its own SKILL.md and refuses to run if the safety scan finds a forbidden token inside its own file (defense in depth).
2. **Stage** to `artifacts/diagnostics/<timestamp>-cdiscourse-diagnostic-inspect/`.
3. **Sanitise** every staged JSONL line through the redactor (`xaiSourceRedactor.redactRaw` for X-derived files; a generic pattern stripper for the rest). Output files are renamed with `-sanitized.jsonl`.
4. **Compute derived artifacts**:
   - `corpus-event-index.json` — per-runId event-stage histogram
   - `corpus-metrics.json` — moves attempted/posted/rejected, top axes, jsonParsed coverage, mechanism coverage, validation failure reasons, submit rejection reasons, stop reasons, annotation source counts, room count, scenario count, top disagreement axes, top chosen axes, top fallback axes
   - `semantic-values.json` — distribution of issue-frame / political-valence / amplification signals when present
   - `decision-ledger.md` + `.json` — operator decisions, options presented, deferred choices (parsed from recent commit messages + current-status entries)
   - `game-change-recommendations.md` — recommendations derived from corpus-metrics (e.g., axes the model rarely picks, mechanism coverage gaps)
   - `ux-playability-recommendations.md` — recommendations from rejection patterns (e.g., topic-satisfaction rejections still hitting deployed Edge Function)
5. **Run the safety scan** on every staged file. The scan looks for:
   - Secret shapes: `ANTHROPIC_API_KEY=\S`, `XAI_API_KEY=\S`, `X_BEARER_TOKEN=\S`, `SUPABASE_SERVICE_ROLE_KEY=\S`, `sb_secret_[A-Za-z0-9]`, `sk-ant-[A-Za-z0-9]`, `xai-[A-Za-z0-9_-]{16,}`, `Bearer\s+[A-Za-z0-9._-]{16,}`, `Authorization:\s*\S`, `eyJ[A-Za-z0-9_-]{40,}` (JWT)
   - User identifiers: `@[A-Za-z0-9_]{1,15}\b` (X handle), `https?://(x|twitter)\.com/`, `https?://t\.co/`, `\b\d{15,20}\b` (post id), `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` (email)
6. **If the scan fails**: drop `FAILED_SAFETY_SCAN.txt` with file + pattern names (NO secret values), keep the staging folder for inspection, exit `2`.
7. **If the scan passes**: zip the staging folder to `<timestamp>-cdiscourse-diagnostic-inspect.zip` next to it. The staging folder is kept for inspection.

## Cross-platform ZIP

The builder shells out to `Compress-Archive` on Windows (the default dev environment) and falls back to `zip -r` then `tar -a -c -f`. If no zipper is available, the staging folder remains as the artifact and `MANIFEST.json` records `zipMethod: "staging_only"`.

## Operator workflow

```
npm run skills:validate     # gate
npm run typecheck
npm run lint
npm run test
npm run diagnostics:inspect:dry
# inspect the staging folder
npm run diagnostics:inspect          # produces the ZIP
# optionally:
npm run diagnostics:inspect:db       # adds the read-only dev DB snapshot
npm run diagnostics:inspect:all      # everything
```

## Hard rules summary

- Manual-only.
- Dev/test scope.
- No network at runtime (except optional Supabase READ via anon-key client when `--include-db` is passed; no writes).
- No service-role.
- No secrets in any output.
- No raw X data in any output.
- ZIP is OPTIONAL — if zipping fails, the staging folder is the artifact.
- Safety scan is mandatory — packaging fails closed if it fails.
