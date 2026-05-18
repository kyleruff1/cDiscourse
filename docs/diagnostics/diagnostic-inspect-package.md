# Diagnostic inspect package

Reusable skill + builder that packages CDiscourse diagnostic data for offline inspection. The skill body owns the rules; this doc explains the operator workflow + ZIP contents.

Skill file: `.claude/skills/diagnostic-inspect-package-operator/SKILL.md`
Builder: `scripts/diagnostics/buildDiagnosticInspectPackage.js`

## What it does

Stages on-disk telemetry + redacted reports + safe code-state metadata into a timestamped folder under `artifacts/diagnostics/`, runs a final safety scan over every staged file, then produces a ZIP next to the folder.

Never:

- Calls xAI, Anthropic, or any LLM provider.
- Calls Supabase as service-role. (Optional `--include-db` uses anon-key READ only.)
- Mutates state.
- Writes secrets, raw X data, or raw hostile text into any output file.

## CLI

```
npm run diagnostics:inspect:dry        # stage + scan, no ZIP
npm run diagnostics:inspect            # produce the ZIP
npm run diagnostics:inspect:db         # include a read-only DB snapshot
npm run diagnostics:inspect:all        # all reports + all JSONL + DB
```

Or directly with flags:

```
node scripts/diagnostics/buildDiagnosticInspectPackage.js [flags]

  --dry                       Stage files + scan; do NOT create the ZIP.
  --include-db                Add a read-only dev-DB snapshot via anon-key.
  --include-all-reports       Include every file under docs/testing-runs/
                              (default: only the most recent N per family).
  --include-all-jsonl         Include every JSONL under logs/.
  --out-dir <path>            Override artifacts/diagnostics root.
  --timestamp <stamp>         Override the ISO timestamp (for tests).
  --jsonl-per-dir-limit <N>   Cap newest-N JSONL per dir (default 5).
```

## Output layout

```
artifacts/diagnostics/<timestamp>-cdiscourse-diagnostic-inspect/
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
  sanitized-jsonl/<runId>-...-sanitized.jsonl
  redacted-reports/<file>.md
  code-state/{branch.txt,last-commit.txt,working-tree.txt,skill-hashes.json,package-scripts.json}
  safety-scan/{scan-summary.json,scan-passed.txt}
  analysis-scripts/analyze-sanitized-corpus.js
  db-snapshot/  (only when --include-db)
artifacts/diagnostics/<timestamp>-cdiscourse-diagnostic-inspect.zip
```

## Safety scan

Runs over every staged file. Patterns checked: env-var key assignments, secret shapes (`sk-ant-`, `xai-`, `sb_secret_`), JWT, Bearer tokens, Authorization headers, X handles, x.com/twitter.com/t.co URLs, 15–20 digit raw post IDs, email-like strings.

If anything matches:

- `FAILED_SAFETY_SCAN.txt` is written listing each offending file + pattern name (NO secret value).
- No ZIP is produced.
- Exit code 2.
- Staging folder is kept so the operator can inspect.

## How the redactor works

Every staged JSONL line passes through `sanitiseLine`, which replaces:

- `sk-ant-…` → `[redacted-sk-ant]`
- `xai-…` → `[redacted-xai]`
- `sb_secret_…` → `[redacted-sb-secret]`
- `eyJ…` (JWT) → `[redacted-jwt]`
- `Bearer …` → `Bearer [redacted]`
- `Authorization: …` → `Authorization: [redacted]`
- `https://x.com/…` / `https://twitter.com/…` / `https://t.co/…` → `<x-link>`
- bare host references (`x.com/handle`, `t.co/abc`) → `<x-link>`
- `@handle` → `<x-handle>`
- 15–20-digit numbers → `<x-id>`
- email-like strings → `<email>`

`docs/testing-runs/*.md` files were already redacted upstream; they're rescanned defensively.

## Cross-platform ZIP

The builder tries (in order):

1. `powershell.exe Compress-Archive` (default Windows dev env)
2. `zip -r` (POSIX)
3. `tar -a -c -f` (Windows 10+ tar can produce zip)

If none work, the staging folder remains as the artifact and `MANIFEST.json` records `zipMethod: "staging_only"`.

## Operator workflow

```
npm run skills:validate
npm run typecheck
npm run lint
npm run test

npm run diagnostics:inspect:dry        # inspect the staging folder

# if clean:
npm run diagnostics:inspect            # produces the ZIP

# optional:
npm run diagnostics:inspect:db         # adds the read-only DB snapshot
```

## Hard rules summary

- Manual-only. Operator invokes; not auto-run.
- Dev/test scope.
- No network at build time (except optional anon-key Supabase READ).
- No service-role. No direct insert. No function deploy. No migration.
- No secret in any output file.
- No raw X identifier in any output file.
- Safety scan failure → no ZIP, exit non-zero.
