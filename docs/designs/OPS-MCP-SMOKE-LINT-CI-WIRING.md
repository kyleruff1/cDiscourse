# OPS-MCP-SMOKE-LINT-CI-WIRING — Audit-lint GitHub Actions CI completion

**Status:** Design draft (designer Stage 1 output)
**Epic:** OPS — process / audit-integrity tooling (CI completion of OPS-MCP-SMOKE-DOCTRINE-HARDENING)
**Release:** N/A (operator process tooling)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/341
**Intent brief:** `docs/designs/OPS-MCP-SMOKE-LINT-CI-WIRING-intent.md` (commit `925b616`)
**Branch:** `feat/OPS-MCP-SMOKE-LINT-CI-WIRING` (from `main` at `925b616`)
**Predecessor:** PR #340 merged at `91a3664` (OPS-MCP-SMOKE-DOCTRINE-HARDENING); post-merge smoke audit at `e4fe8c6` (verdict PARTIAL by design — CI deferred).

---

## Goal (one paragraph)

Lift the PARTIAL cap from OPS-MCP-SMOKE-DOCTRINE-HARDENING by wiring the audit-lint runner into GitHub Actions so the L1-L6 rules are mechanically enforced on every PR that adds or modifies a post-hardening smoke audit doc. The card creates `.github/workflows/audit-lint.yml` and extends `scripts/ops/audit-lint.mjs` with a new `--classify-changed` mode that the workflow calls to compute the in-scope set; the classification predicate lives as a pure function in `audit-lint-lib.cjs` so both the workflow and the Jest suite consume the same decision logic. The card touches NO runtime code, NO linter rules, NO `package.json`, and NO historical audit docs. Doctrine: this card is entirely OPS tooling — no scoring surface, no AI surface, no user-facing copy; the cdiscourse-doctrine constraints are vacuously satisfied (no truth labels, no service-role, no AI calls, no secrets touched).

---

## Phase A.1 — Workflow shape (full YAML draft)

### File: `.github/workflows/audit-lint.yml`

```yaml
name: audit-lint

on:
  pull_request:
    paths:
      - 'docs/audits/**SMOKE*.md'
      - 'scripts/ops/audit-lint.mjs'
      - 'scripts/ops/audit-lint-lib.cjs'
      - 'scripts/ops/audit-lint-rules.cjs'
      - '__tests__/fixtures/audit-lint/**'

concurrency:
  group: audit-lint-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint:
    name: Lint changed audit docs (L1-L6)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR head with full history
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Resolve PR base/head SHAs and classify changed files
        id: classify
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          IN_SCOPE=$(node scripts/ops/audit-lint.mjs --classify-changed --base "$BASE_SHA" --head "$HEAD_SHA")
          echo "in_scope<<EOF" >> "$GITHUB_OUTPUT"
          echo "$IN_SCOPE" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"
          if [ -z "$IN_SCOPE" ]; then
            echo "::notice::No in-scope audit docs in this PR — skipping lint."
          else
            echo "In-scope docs:"
            echo "$IN_SCOPE"
          fi

      - name: Lint each in-scope doc
        if: steps.classify.outputs.in_scope != ''
        env:
          IN_SCOPE: ${{ steps.classify.outputs.in_scope }}
        run: |
          FAIL=0
          while IFS= read -r path; do
            if [ -z "$path" ]; then
              continue
            fi
            echo "::group::audit-lint $path"
            if ! node scripts/ops/audit-lint.mjs "$path"; then
              FAIL=1
            fi
            echo "::endgroup::"
          done <<< "$IN_SCOPE"
          exit "$FAIL"
```

### Why this shape

| Element | Choice | Why |
| --- | --- | --- |
| `name` | `audit-lint` | Single-purpose workflow. Distinct from any future general CI workflow this repo may add. |
| `on.pull_request.paths` | 5 patterns verbatim from intent §3 | Path-scoped trigger; the workflow does not run on unrelated PRs. Path-filter list MUST match intent §3 exactly. |
| `concurrency.group` | `audit-lint-<PR number>` | If a PR is rapidly updated, only the latest run completes; earlier runs cancel. Standard pattern; not load-bearing for correctness. |
| `concurrency.cancel-in-progress` | `true` | Pairs with `group`. |
| `permissions.contents` | `read` | Read-only token; the workflow does not push, comment, or write. |
| `runs-on` | `ubuntu-latest` | Standard GitHub-hosted runner. Audit-lint is pure Node — no platform-specific behavior. |
| `checkout@v4` with `fetch-depth: 0` | Required | `git diff $BASE_SHA $HEAD_SHA` needs both commits' trees fetchable; default depth 1 only fetches HEAD. **HALT trigger 6** is gated by this: if `fetch-depth: 0` is absent, the classifier shell-out cannot resolve `$BASE_SHA`. |
| `setup-node@v4` with `node-version: '20.x'` | Pin to 20.x | `package.json` has NO `engines.node` field (confirmed via grep). Brief §A.1 directs: "read project preference (check `engines` if present; else pin 20.x — match existing project Node usage)". Stage 6.x development is on Node 20 LTS per CLAUDE.md ergonomic patterns. |
| `BASE_SHA` / `HEAD_SHA` as step-level env vars | YES | Resolved from `github.event.pull_request.base.sha` and `.head.sha` exactly as brief §A.1 requires. Step-level scoping prevents leak to unrelated steps. |
| Single `node scripts/ops/audit-lint.mjs --classify-changed` invocation | YES — Option A | Workflow does NOT shell out `git diff` directly; the classifier does that internally. NO YAML-side decision logic (HALT trigger 7). |
| Per-doc lint via bash `while IFS= read -r path` | YES | Aggregates exit codes via the `FAIL=1` accumulator; exits with the worst code. A single doc failure fails the whole check. |
| `if: steps.classify.outputs.in_scope != ''` on the lint step | YES | If the classifier produces empty output (no in-scope changes), the lint step is skipped — the job exits 0. Matches intent §4: "If no applicable files → exit 0." |
| Default shell (`bash` on `ubuntu-latest`) | Implicit | `runs-on: ubuntu-latest` defaults `run:` to `bash`. The `<<<` here-string syntax used in the lint step is bash-specific. |
| `GITHUB_OUTPUT` heredoc | YES | Standard idiom for multi-line step outputs in modern GH Actions; required because the classifier output may be multiple paths. |
| No additional steps | YES | No artifact upload, no PR comment, no Slack notification. The workflow is binary: green or red. Pre-existing GitHub PR-check UI surfaces the result. |

### Exact diff command resolution

Specified by brief §A.1: `git diff --name-status "$BASE_SHA" "$HEAD_SHA"` — NOT `HEAD~1`, NOT `origin/main`. The shell-out lives **inside** the classifier (in `.mjs`), NOT in the workflow YAML. The workflow YAML only references `$BASE_SHA` and `$HEAD_SHA` as the two CLI args passed to the classifier.

### HALT triggers this section disposes of

| # | Trigger | How this section disposes |
| --- | --- | --- |
| 5 | Any non-audit-lint CI workflow added | Workflow is single-purpose: `name: audit-lint`. |
| 6 | Diff base is `HEAD~1` / `origin/main` / any guessed base | Base is `${{ github.event.pull_request.base.sha }}`; same for head. |
| 7 | Added-vs-modified scoping re-implemented in YAML/bash separately from the classifier | All scoping lives inside the classifier; the workflow shells out to it once and consumes its output. |
| 10 | Workflow does NOT call the classifier (uses inline shell logic) | Workflow's lint step calls `node scripts/ops/audit-lint.mjs --classify-changed`. |

---

## Phase A.2 — Classifier surface (Option A vs B decision; CLI + pure-function API)

### Decision: **Option A** — extend `scripts/ops/audit-lint.mjs` with `--classify-changed`.

#### Why Option A over Option B

| Criterion | Option A (extend `.mjs`) | Option B (separate `.mjs` helper) | Winner |
| --- | --- | --- | --- |
| Single CLI entry point the workflow knows | YES | NO (workflow must know two tool paths) | A |
| Operator ergonomic (one tool to memorize) | YES — `audit-lint.mjs <doc>` for linting, `audit-lint.mjs --classify-changed` for CI | NO — different binary for CI | A |
| Test seam quality (Jest tests pure function) | EQUAL — both can expose a pure helper in `audit-lint-lib.cjs` | EQUAL | tie |
| Risk of bloating the entry `.mjs` | LOW — `+30 to +60 lines` for arg parsing + git shell-out + output emission | ZERO | B (marginal) |
| Marker-string single-source path | EQUAL — both paths import `MARKER_STRING` from `audit-lint-rules.cjs` | EQUAL | tie |
| Operator doc updates | LIGHTER — one CLI surface section | HEAVIER — two CLI sections in `docs/ops/AUDIT-LINT.md` | A |
| Reuses existing CLI arg parser (`parseCliArgs`) | YES — extend it with `--classify-changed`, `--base`, `--head` flags | NO — separate parser | A |
| Reuses existing exit-code contract (0/1/2/3/5) | YES — classification mode always exits 0 (empty stdout means no work; brief §A.2 requires "exit 0 always") | EQUAL | tie |

**Verdict:** Option A wins on 4 dimensions and ties on 4. The marginal "bloat" risk of Option B is small (we are adding ~60 lines to a 111-line `.mjs`). Picking Option A.

#### CLI surface (extension)

The existing `.mjs` accepts:
- `node scripts/ops/audit-lint.mjs <doc-path> [--report-only]`
- `node scripts/ops/audit-lint.mjs --help`

This card adds a third invocation form:

```
node scripts/ops/audit-lint.mjs --classify-changed --base <sha> --head <sha>
```

| Flag | Required | Effect |
| --- | --- | --- |
| `--classify-changed` | required to enter this mode | Switches to classifier mode; the positional doc-path arg is disallowed. |
| `--base <sha>` | required in this mode | Base commit SHA for `git diff`. Caller-supplied; brief §A.1 forbids defaulting to `HEAD~1` / `origin/main`. |
| `--head <sha>` | required in this mode | Head commit SHA for `git diff`. |

#### Exit-code contract (classifier mode)

| Code | Meaning |
| --- | --- |
| 0 | Always — including the case of empty stdout (no in-scope files). Per brief §A.2: "exit 0 always (empty stdout means no applicable changes)". |
| 5 | CLI argument error (missing `--base`, missing `--head`, positional + `--classify-changed` mix, etc.) — consistent with the existing parser. |

Classifier mode never exits 1, 2, or 3. The classifier is purely a list-emitter — it does not lint the contents of any doc. (Note: a separate path-not-readable case is handled gracefully by the in-lib predicate, which receives a `false` from the injected `readMarkerAtHead` callback and treats the file as non-marked.)

#### stdout contract (classifier mode)

- One in-scope path per line. Newline-separated. Trailing newline OK.
- Empty stdout when no in-scope paths.
- Paths are written relative to the repo root (consistent with `git diff --name-status` output).
- ZERO non-path content on stdout. Diagnostics (e.g., "classified N candidates, M in-scope") go to stderr ONLY.

This contract is consumable by the workflow's `while IFS= read -r path; do ... done` loop.

#### The pure-function API (lives in `audit-lint-lib.cjs`)

Exported alongside the existing public API:

```ts
/**
 * Classify a list of changed-file entries against the audit-lint
 * scoping rule. Pure function: NO fs, NO spawn, NO git. The caller
 * (the .mjs entry) is responsible for resolving the actual entries
 * (via `git diff --name-status`) and for the marker reader (via
 * `readFileSync` at HEAD-tree).
 *
 * @param entries   Array of { status, path } where status is one of
 *                  the git diff --name-status letters: A, M, D, R, C.
 * @param readMarkerAtHead  Closure (path: string) => boolean. Returns
 *                  true iff the file at HEAD contains the
 *                  MARKER_STRING. The implementer wires this to
 *                  `git show <head>:<path>` -> includes MARKER_STRING.
 * @returns         Array of in-scope path strings. Stable, sorted in
 *                  the input order (so test output is deterministic).
 */
function classifyChangedFiles(
  entries: Array<{ status: string; path: string }>,
  readMarkerAtHead: (path: string) => boolean,
): string[];
```

#### Predicate (per intent §4 truth table)

```
FOR EACH entry IN entries (preserving input order):
  // 1. Path-filter: only docs under docs/audits/ that match the SMOKE pattern
  //    AND ARE NOT templates (the existing isTemplateFilename refuses templates).
  IF NOT (entry.path matches /^docs\/audits\/.*SMOKE.*\.md$/i): CONTINUE
  IF isTemplateFilename(entry.path): CONTINUE

  // 2. Status filter: A or M only. D / R / C are out-of-scope.
  IF entry.status === 'A':
    // ADDED — ALWAYS in-scope. Marker not required. This closes the
    // "submit new audit without marker" evasion (intent §4 + §8 HALT 8).
    EMIT entry.path
    CONTINUE
  IF entry.status === 'M':
    // MODIFIED — in-scope iff the HEAD version carries the marker.
    IF readMarkerAtHead(entry.path):
      EMIT entry.path
    CONTINUE
  // D, R, C and any other status: skip silently. Renames are handled
  // by the natural A+D pair git produces under default rename
  // detection, so the A side is already covered above.
```

#### Test seam — `--changed-list-stdin`

For Jest tests that need to exercise the `.mjs` CLI surface (NOT the in-lib predicate; that's tested directly), the entry also supports stdin injection so tests need not shell out to git:

```
node scripts/ops/audit-lint.mjs --classify-changed --changed-list-stdin
  (reads stdin lines of the form "<status>\t<path>"; one per line; ignores blanks)
```

When `--changed-list-stdin` is present, `--base` and `--head` are NOT required and are ignored if supplied. This flag is for tests and for ad-hoc operator dry-runs only; the workflow YAML uses `--base` + `--head`, never `--changed-list-stdin`.

Marker resolution for stdin-mode is via the local working tree (`readFileSync(path, 'utf8').includes(MARKER_STRING)`). This is acceptable because stdin-mode is operator-debug-only; the workflow never touches it.

#### Single-source rule for the marker string

The classifier — both the in-lib predicate and the `.mjs` shell-out wrapper — sources `MARKER_STRING` from `require('./audit-lint-rules.cjs').MARKER_STRING`. NO inline literal `'Audit-Lint: v1'` string is permitted in the new code (HALT trigger 11). The existing test at `__tests__/opsAuditLint.test.ts:1283-1285` asserts `rules.MARKER_STRING === 'Audit-Lint: v1'`; this card adds a NEW test asserting the workflow YAML does NOT contain a literal `'Audit-Lint: v1'` string either (covered in Phase A.3).

#### Doctrine fit: `.cjs` lib stays pure

The lib file `audit-lint-lib.cjs` currently passes these tests:

- `expect(src).not.toContain('spawnSync')` (line 1240)
- `expect(src).not.toContain('node:child_process')` (line 1245)
- `expect(src).not.toContain('readFileSync')` (line 1250)
- `expect(src).not.toContain('readFile(')` (line 1251)

The new `classifyChangedFiles` predicate maintains this purity by accepting `readMarkerAtHead` as an injected closure. The fs read and the `git diff` shell-out live in the `.mjs` entry (which IS allowed to do both — there is NO test forbidding fs or spawn in the entry script). This is the same architectural pattern the predecessor card established for `parseAuditDoc` (pure) vs `main()` in `.mjs` (uses `readFileSync` + `existsSync`).

#### File-layer changes (Option A summary)

| File | New surface | Lines added (est.) |
| --- | --- | --- |
| `scripts/ops/audit-lint-lib.cjs` | `classifyChangedFiles(entries, readMarkerAtHead): string[]` + helpers; new exports | +30 to +60 |
| `scripts/ops/audit-lint.mjs` | `--classify-changed` mode + `runClassifyChanged()` function: parses `--base` + `--head` (or `--changed-list-stdin`), shells out via `spawnSync('git', ['diff', '--name-status', BASE, HEAD], ...)`, calls `classifyChangedFiles` with a `readMarkerAtHead` closure that does `spawnSync('git', ['show', HEAD + ':' + path])` and `.includes(MARKER_STRING)` | +60 to +90 |
| Existing `parseCliArgs` | Extended to recognize `--classify-changed`, `--base <sha>`, `--head <sha>`, `--changed-list-stdin` | +20 |
| `scripts/ops/audit-lint-rules.cjs` | UNCHANGED — `MARKER_STRING` already exported | 0 |

Total new code: ~110-170 lines, well within "narrow card" guidance.

### HALT triggers this section disposes of

| # | Trigger | How this section disposes |
| --- | --- | --- |
| 7 | Added-vs-modified scoping re-implemented in YAML/bash | Decision rule is a single pure function `classifyChangedFiles` in `.cjs` lib; the workflow YAML and the implementer-`.mjs` BOTH consume it. |
| 8 | Adding a new smoke audit without `Audit-Lint: v1` can evade enforcement | Status `A` is ALWAYS in-scope regardless of marker (`IF entry.status === 'A': EMIT path`). |
| 10 | Workflow does NOT call the classifier | Workflow exclusively calls `node scripts/ops/audit-lint.mjs --classify-changed`. |
| 11 | Marker string in classifier differs from `audit-lint-rules.cjs` | Both the lib and the `.mjs` source `MARKER_STRING` from `audit-lint-rules.cjs`; no literal duplication. |

---

## Phase A.3 — Truth-table tests + Jest seams (each row spelled out)

### Test file: `__tests__/opsAuditLint.test.ts` (additive to the existing 105 tests)

A new section is appended to the existing file. The existing 1328 lines are unchanged. The new section is delimited by:

```
/* ============================================================ */
/* 12. CI scoping classifier + workflow shape                    */
/* ============================================================ */
```

### Section 12.A — `classifyChangedFiles` pure-function truth-table

Each truth-table row from intent §4 gets its own `it()`:

```ts
describe('OPS-MCP-SMOKE-LINT-CI-WIRING — classifyChangedFiles truth table', () => {
  const MARKED_PATH = 'docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-06-01.md';
  const UNMARKED_PATH = 'docs/audits/MCP-SERVER-001-FAMILY-A-SMOKE-2026-01-01.md';
  const NON_AUDIT_PATH = 'src/lib/foo.ts';
  const TEMPLATE_PATH = 'docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md';

  // The injected reader stub. Returns true iff the path is in the
  // `marked` set (simulates the file containing MARKER_STRING at HEAD).
  function reader(marked: Set<string>) {
    return (p: string) => marked.has(p);
  }

  it('Added smoke audit (status A) without marker -> IN SCOPE', () => {
    const entries = [{ status: 'A', path: UNMARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([UNMARKED_PATH]);
  });

  it('Added smoke audit (status A) with marker -> IN SCOPE', () => {
    const entries = [{ status: 'A', path: MARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set([MARKED_PATH])))).toEqual([MARKED_PATH]);
  });

  it('Modified smoke audit (status M) with marker -> IN SCOPE', () => {
    const entries = [{ status: 'M', path: MARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set([MARKED_PATH])))).toEqual([MARKED_PATH]);
  });

  it('Modified smoke audit (status M) without marker -> OUT OF SCOPE', () => {
    const entries = [{ status: 'M', path: UNMARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Non-audit file (status A) -> OUT OF SCOPE', () => {
    const entries = [{ status: 'A', path: NON_AUDIT_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Non-audit file (status M) -> OUT OF SCOPE', () => {
    const entries = [{ status: 'M', path: NON_AUDIT_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set([NON_AUDIT_PATH])))).toEqual([]);
  });

  it('Deleted smoke audit (status D) with marker -> OUT OF SCOPE', () => {
    const entries = [{ status: 'D', path: MARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set([MARKED_PATH])))).toEqual([]);
  });

  it('Template doc (status A) -> OUT OF SCOPE (templates are refused)', () => {
    const entries = [{ status: 'A', path: TEMPLATE_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Multiple entries preserve input order in the in-scope list', () => {
    const entries = [
      { status: 'M', path: UNMARKED_PATH },  // out
      { status: 'A', path: MARKED_PATH },    // in
      { status: 'A', path: UNMARKED_PATH },  // in (added always)
    ];
    const out = classifyChangedFiles(entries, reader(new Set([MARKED_PATH])));
    expect(out).toEqual([MARKED_PATH, UNMARKED_PATH]);
  });

  it('Empty entries -> empty result', () => {
    expect(classifyChangedFiles([], reader(new Set()))).toEqual([]);
  });

  it('readMarkerAtHead is invoked at most once per Modified path', () => {
    const calls: string[] = [];
    const tracker = (p: string) => {
      calls.push(p);
      return false;
    };
    classifyChangedFiles(
      [
        { status: 'M', path: UNMARKED_PATH },
        { status: 'A', path: MARKED_PATH },  // A -> reader NOT called
        { status: 'D', path: MARKED_PATH },  // D -> reader NOT called
      ],
      tracker,
    );
    expect(calls).toEqual([UNMARKED_PATH]);
  });
});
```

| # | `it()` | Truth-table row | Asserts |
| --- | --- | --- | --- |
| 1 | Added + no marker | A row 1 | IN SCOPE |
| 2 | Added + marker | A row 2 | IN SCOPE |
| 3 | Modified + marker | M row 1 | IN SCOPE |
| 4 | Modified + no marker | M row 2 | OUT OF SCOPE |
| 5 | Non-audit file (A) | extra | OUT OF SCOPE |
| 6 | Non-audit file (M) | extra | OUT OF SCOPE |
| 7 | Deleted | D row | OUT OF SCOPE |
| 8 | Template doc | template carve-out | OUT OF SCOPE |
| 9 | Order preservation | determinism | input order kept |
| 10 | Empty input | edge | empty output |
| 11 | Reader-not-called for non-M paths | efficiency / side-effect bound | tracker proves it |

**11 tests in this block.**

### Section 12.B — Single-source marker check

```ts
describe('OPS-MCP-SMOKE-LINT-CI-WIRING — marker string single-source', () => {
  it('classifyChangedFiles uses the same MARKER_STRING as audit-lint-rules.cjs', () => {
    // Re-use the existing marker-presence path via parseAuditDoc as the
    // ground truth: classifyChangedFiles must treat a doc whose body
    // contains rules.MARKER_STRING as marked, and a doc whose body does
    // NOT contain that exact string as unmarked.
    const markedBody = `# x\n\n${rules.MARKER_STRING}\n\nbody`;
    const unmarkedBody = '# x\n\nbody';
    // Inject a reader that simulates content-level checking via parseAuditDoc.
    const reader = (p: string) =>
      p === 'docs/audits/M-SMOKE.md' ? parseAuditDoc(markedBody).hasMarker
      : p === 'docs/audits/U-SMOKE.md' ? parseAuditDoc(unmarkedBody).hasMarker
      : false;
    const inScope = classifyChangedFiles(
      [
        { status: 'M', path: 'docs/audits/M-SMOKE.md' },
        { status: 'M', path: 'docs/audits/U-SMOKE.md' },
      ],
      reader,
    );
    expect(inScope).toEqual(['docs/audits/M-SMOKE.md']);
  });

  it('audit-lint-lib source: no literal "Audit-Lint: v1" string outside rules import', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    // The lib MUST source the marker from the rules file via require().
    // No literal duplication permitted (HALT trigger 11).
    expect(src).not.toContain("'Audit-Lint: v1'");
    expect(src).not.toContain('"Audit-Lint: v1"');
  });

  it('audit-lint.mjs source: no literal "Audit-Lint: v1" string', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).not.toContain("'Audit-Lint: v1'");
    expect(src).not.toContain('"Audit-Lint: v1"');
  });
});
```

**3 tests in this block.**

### Section 12.C — Workflow YAML inspection

```ts
const WORKFLOW_PATH = path.join(
  process.cwd(),
  '.github',
  'workflows',
  'audit-lint.yml',
);

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — workflow YAML inspection', () => {
  it('workflow file exists at .github/workflows/audit-lint.yml', () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('workflow calls the classifier via --classify-changed', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('audit-lint.mjs --classify-changed');
  });

  it('workflow uses PR base SHA, NOT HEAD~1 / origin/main / ~1', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('${{ github.event.pull_request.base.sha }}');
    expect(yml).not.toContain('HEAD~1');
    expect(yml).not.toContain('origin/main');
    expect(yml).not.toMatch(/git\s+diff\s+~1\b/);
  });

  it('workflow uses PR head SHA', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('${{ github.event.pull_request.head.sha }}');
  });

  it('workflow trigger paths include all 5 patterns from intent §3', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain("'docs/audits/**SMOKE*.md'");
    expect(yml).toContain("'scripts/ops/audit-lint.mjs'");
    expect(yml).toContain("'scripts/ops/audit-lint-lib.cjs'");
    expect(yml).toContain("'scripts/ops/audit-lint-rules.cjs'");
    expect(yml).toContain("'__tests__/fixtures/audit-lint/**'");
  });

  it('workflow uses actions/checkout with fetch-depth: 0', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('actions/checkout@v4');
    expect(yml).toMatch(/fetch-depth:\s*0/);
  });

  it('workflow uses actions/setup-node with Node 20.x', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('actions/setup-node@v4');
    expect(yml).toMatch(/node-version:\s*'?20/);
  });

  it('workflow has read-only permissions on contents', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toMatch(/permissions:\s*[\s\S]*?contents:\s*read/);
  });

  it('workflow does NOT contain a literal Audit-Lint: v1 marker string', () => {
    // Single-source rule: the marker lives in audit-lint-rules.cjs.
    // The workflow only invokes the classifier, which sources the marker
    // through the lib.
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).not.toContain('Audit-Lint: v1');
  });

  it('workflow does NOT implement inline added-vs-modified scoping logic', () => {
    // No git diff --name-status invocation; no marker-substring grep
    // in YAML/bash. All scoping logic must live in the classifier.
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).not.toContain('git diff --name-status');
    expect(yml).not.toContain('grep -q "Audit-Lint: v1"');
    expect(yml).not.toMatch(/git\s+show.*Audit-Lint/);
  });
});
```

**10 tests in this block.**

### Section 12.D — CLI arg parsing for `--classify-changed` mode

```ts
describe('OPS-MCP-SMOKE-LINT-CI-WIRING — --classify-changed CLI parsing', () => {
  it('parses --classify-changed --base SHA1 --head SHA2', () => {
    const result = parseCliArgs(['--classify-changed', '--base', 'abc123', '--head', 'def456']);
    expect(result.ok).toBe(true);
    expect(result.options?.classifyChanged).toBe(true);
    expect(result.options?.baseSha).toBe('abc123');
    expect(result.options?.headSha).toBe('def456');
  });

  it('rejects --classify-changed with positional doc path', () => {
    const result = parseCliArgs(['--classify-changed', '--base', 'a', '--head', 'b', 'docs/x.md']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/positional|classify-changed/i);
  });

  it('rejects --classify-changed without --base', () => {
    const result = parseCliArgs(['--classify-changed', '--head', 'b']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--base/);
  });

  it('rejects --classify-changed without --head', () => {
    const result = parseCliArgs(['--classify-changed', '--base', 'a']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--head/);
  });

  it('parses --changed-list-stdin as alternative to --base/--head', () => {
    const result = parseCliArgs(['--classify-changed', '--changed-list-stdin']);
    expect(result.ok).toBe(true);
    expect(result.options?.classifyChanged).toBe(true);
    expect(result.options?.changedListStdin).toBe(true);
  });

  it('rejects --base/--head outside --classify-changed mode', () => {
    const result = parseCliArgs(['docs/x.md', '--base', 'a']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--base|classify-changed/i);
  });
});
```

**6 tests in this block.**

### Section 12 total test count

| Block | Tests |
| --- | --- |
| 12.A truth table | 11 |
| 12.B single-source marker | 3 |
| 12.C workflow YAML inspection | 10 |
| 12.D CLI arg parsing | 6 |
| **Subtotal** | **30** |

Plus minor extension to existing pure-helper-discipline tests (Block 10 in the existing file):

```ts
it('lib source: classifyChangedFiles signature is exported', () => {
  const src = fs.readFileSync(LIB_PATH, 'utf8');
  expect(src).toContain('classifyChangedFiles');
  expect(src).toContain('module.exports');
});

it('lib source: classifyChangedFiles is pure (no fs / no spawn / no fetch)', () => {
  const src = fs.readFileSync(LIB_PATH, 'utf8');
  // existing tests already cover readFileSync / readFile / spawnSync
  // not appearing anywhere in lib; this test re-asserts the contract
  // applies after the classifyChangedFiles addition.
  expect(src).not.toContain('readFileSync');
  expect(src).not.toContain('spawnSync');
  expect(src).not.toContain('global.fetch');
});
```

**2 additional tests** to existing Block 10 invariants.

### Total test forecast

**32 new tests** (11 + 3 + 10 + 6 + 2). This sits squarely in the brief's +10 to +25 band's upper edge plus a small overflow that remains well below the HARD HALT at +50. The implementer may consolidate (e.g., merge 12.C tests 5 patterns into a single `each.toContain` loop) to land closer to +20 if desired.

**Forecast: +20 to +32 tests.** Baseline 105 → ~125-137 in `opsAuditLint.test.ts`.

### HALT triggers this section disposes of

| # | Trigger | How this section disposes |
| --- | --- | --- |
| 9 | Classifier unit test does NOT exist OR does not cover all 4 truth-table rows | Section 12.A covers all 4 rows + edge cases. |
| 13 | `__tests__/opsAuditLint.test.ts` baseline (105) regresses | Section 12 is purely additive; existing 105 tests are not modified. |

---

## Phase A.4 — Smoke audit shape (5-phase plan; dogfood; CI-dogfood addressability)

### File: `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md`

(Date matches the design commit date; if implementation runs across a date boundary, the implementer adjusts the filename to match the post-merge audit-author date per existing convention.)

#### Pre-audit invariants

- Carries `Audit-Lint: v1` marker on its own line within the first 50 lines.
- Title shape: `# OPS-MCP-SMOKE-LINT-CI-WIRING — Post-merge smoke audit`.
- Audit-type detection: `ops` (per existing `AUDIT_TYPE_PATTERNS.ops`). L5 / L6 should NOT trigger (this audit is not amendment / hosted-completion / doctrine-risk).
- L1 required-phase set for `ops` is `{phase-1-preflight}`; the audit MUST include a Phase 1 (Preflight) with `**Status:** PASS` or similar non-NOT-RUN status, or the L1 check will fire. Designer choice: Phase 1 of this smoke audit IS the centerpiece (classifier truth-table verification), but the audit's narrative Phase 1 should be NAMED with "preflight" semantics OR include the preflight slug variant so canonicalization maps it to `phase-1-preflight`. Implementer should write `## Phase 1 — Preflight + classifier truth-table verification` so canonicalization produces `phase-1-preflight` and `_targeted_signal` (actually `preflight` wins per canonicalizePhaseSlug).

#### Phase 1 (CENTERPIECE) — Classifier truth-table verification

**Status:** PASS

Direct invocation of the classifier via stdin-mode against each of the 4 truth-table rows from intent §4. Each row produces the expected in-scope/out-of-scope result.

| Row | Status | Path | Marker at HEAD? | Expected | Actual | EXIT |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A | docs/audits/<test-new>.md | NO | IN SCOPE | (operator runs the classifier) | 0 |
| 2 | A | docs/audits/<test-new>.md | YES | IN SCOPE | ... | 0 |
| 3 | M | docs/audits/<existing>.md | YES | IN SCOPE | ... | 0 |
| 4 | M | docs/audits/<existing>.md | NO | OUT OF SCOPE | ... | 0 |

Plus the 4 negative cases (non-audit, deleted, template, empty-input) demonstrated by the existing Jest tests.

The Jest centerpiece run is the primary mechanical proof; the smoke audit cites the test names + exit codes from the Jest run rather than re-running them manually.

#### Phase 2 — Workflow-shape inspection (greps against the YAML)

**Status:** PASS

| Assertion | Method | Result |
| --- | --- | --- |
| `on.pull_request.paths` contains 5 patterns | `grep -F "'docs/audits/**SMOKE*.md'"` etc. | PASS (5/5) |
| `actions/checkout@v4` with `fetch-depth: 0` | `grep -E "fetch-depth:\s*0"` | PASS |
| `${{ github.event.pull_request.base.sha }}` present | `grep -F "github.event.pull_request.base.sha"` | PASS |
| `${{ github.event.pull_request.head.sha }}` present | `grep -F "github.event.pull_request.head.sha"` | PASS |
| `HEAD~1` / `origin/main` ABSENT | `grep -E "HEAD~1\|origin/main"` returns nothing | PASS |
| `node-version: '20.x'` present | `grep -E "node-version:\s*'20"` | PASS |
| `permissions.contents: read` present | yaml-shape check | PASS |
| Inline `git diff --name-status` ABSENT in YAML | `grep -F "git diff --name-status"` returns nothing | PASS |
| Literal `Audit-Lint: v1` ABSENT in YAML | `grep -F "Audit-Lint: v1"` returns nothing | PASS |
| Concurrency group defined | `grep -E "concurrency:"` | PASS |

The Jest section 12.C tests provide the mechanized version of these greps.

#### Phase 3 — Single-source marker check

**Status:** PASS

| Source file | Contains literal `'Audit-Lint: v1'` / `"Audit-Lint: v1"` | Expected | Actual |
| --- | --- | --- | --- |
| `scripts/ops/audit-lint-rules.cjs` | YES (defines `MARKER_STRING`) | YES | PASS |
| `scripts/ops/audit-lint-lib.cjs` | NO (imports via `require()`) | NO | PASS |
| `scripts/ops/audit-lint.mjs` | NO (imports via `createRequire`) | NO | PASS |
| `.github/workflows/audit-lint.yml` | NO | NO | PASS |
| `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md` | YES (THIS doc carries the marker for scoping purposes) | YES | PASS |

The smoke audit doc itself contains the marker line for CI scoping; that's correct usage, not a violation.

#### Phase 4 — Regression

**Status:** PASS

```
npx jest --testPathPattern="opsAuditLint" --no-coverage
→ Test Suites: 1 passed, 1 total
  Tests:       (105 + 30) = 135 passed, 135 total      [forecast: 125-137]
EXIT: 0

npx jest --no-coverage
→ Test Suites: 570 passed, 570 total                   [baseline 570]
  Tests:       (18121 + 30) ≈ 18151 passed             [forecast: 18131-18153]
EXIT: 0

npm run typecheck
→ EXIT: 0

npm run lint
→ EXIT: 0

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 792 passed | 0 failed
EXIT: 0
```

Plus the 4 historical fixtures still self-validate (lint each manually; expected verdicts unchanged):

```
node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/original-family-e-IMPROPER-PASS.md
→ EXIT: 1 (L1 + L2 + L5 trip — unchanged)

node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-amendment-PARTIAL.md
→ EXIT: 0 (consistent-PARTIAL — unchanged)

node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-e-hosted-completion-PASS.md
→ EXIT: 0 (gap closed — unchanged)

node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-d-strengthened-amendment-PASS.md
→ EXIT: 0 (strengthened — unchanged)
```

#### Phase 5 — Dogfood

**Status:** PASS

**Local dogfood (binding for this card):**

```
node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md
→ findings: 0 (PASS)
→ EXIT: 0
```

**CI-side dogfood (addressability):**

The merge PR for THIS card touches:
- `.github/workflows/audit-lint.yml` (matches trigger path)
- `scripts/ops/audit-lint.mjs` (matches trigger path)
- `scripts/ops/audit-lint-lib.cjs` (matches trigger path)
- `__tests__/opsAuditLint.test.ts` (does NOT match trigger paths — `__tests__/fixtures/audit-lint/**` only)
- `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md` (matches trigger path)

So the audit-lint workflow WILL trigger on this very PR — the workflow file itself triggers a workflow run (per GitHub Actions semantics, the workflow's path-filter is evaluated against the PR's changed files, and `.github/workflows/audit-lint.yml` itself is NOT in the path-filter, but `scripts/ops/audit-lint.mjs` AND the smoke audit doc both ARE).

**Expected CI behavior on the merge PR:**

1. The workflow triggers.
2. `--classify-changed` is invoked with the PR base + head.
3. The classifier emits ONE in-scope path: the new smoke audit (status A; matches `docs/audits/**SMOKE*.md`).
4. `audit-lint.mjs <new smoke audit path>` is invoked.
5. Result: 0 findings, EXIT 0.
6. Workflow exits 0; PR check is green.

If the merge PR cannot itself trigger the workflow (e.g., the smoke audit lands in a separate post-merge commit, OR the workflow is added in a way that doesn't activate for the merging PR per GitHub's "default branch rules" semantics for new workflow files), Phase 5 CI dogfood is marked "deferred to first follow-up audit PR" and the LOCAL dogfood is the binding proof for this card.

**Note on GitHub's first-workflow-run semantics:** When a workflow YAML file is ADDED in a PR, GitHub may not run that workflow on the PR itself (it runs on subsequent PRs after the workflow file is merged to the default branch). Reference: GitHub's "Workflows must be on the default branch to run" rule. If this is observed on the merge PR, the reviewer notes it and Phase 5 CI-dogfood waits for the next audit PR.

The intent brief §11 anticipates this: "Phase 5 — Dogfood: smoke audit lints itself + CI dry-run [...] the audit-lint workflow ran on the PR; result was green (or appropriately green-skipped if no paths matched at merge time)". Designer interpretation: green-skipped = deferred to first follow-up.

#### Verdict rules (from intent §11)

**PASS:** workflow is additive, path-scoped, uses PR base SHA, calls shared classifier (no YAML-side rule copy), 4 fixtures unchanged, smoke audit dogfoods green.
**PARTIAL:** workflow genuinely cannot be added cleanly (surface specific cause).
**FAIL:** workflow globally lints corpus; marker bypass; YAML/bash scoping copy; guessed diff base.

The card targets PASS. Brief §7 (Authorizations) ties PASS to lifting the PARTIAL cap from OPS-MCP-SMOKE-DOCTRINE-HARDENING.

---

## File-touch matrix (what's NEW vs MODIFIED; explicit guarantee package.json is NOT touched)

### NEW files

| Path | Purpose | Est. lines |
| --- | --- | --- |
| `.github/workflows/audit-lint.yml` | GitHub Actions workflow; single job; calls `audit-lint.mjs --classify-changed` then lints each in-scope path | ~55 |
| `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md` | 5-phase smoke audit (Phase 1 centerpiece, 2 workflow shape, 3 marker single-source, 4 regression, 5 dogfood); carries `Audit-Lint: v1` | ~150 |

### MODIFIED files (additive only — trigger 14 safety)

| Path | What changes | What stays |
| --- | --- | --- |
| `scripts/ops/audit-lint.mjs` | New `runClassifyChanged()` function + dispatch in `main()` when `options.classifyChanged === true`; new args parsed for `--classify-changed`, `--base`, `--head`, `--changed-list-stdin`; `spawnSync('git', ...)` for diff + per-path show. The existing single-doc linting path is UNCHANGED for callers that pass a positional doc path. | All existing lint behavior; ESM entry shape; existing exit codes 0/1/2/3/5 for non-classify mode. |
| `scripts/ops/audit-lint-lib.cjs` | New pure-function `classifyChangedFiles(entries, readMarkerAtHead)` + new `parseCliArgs` branches for `--classify-changed` / `--base` / `--head` / `--changed-list-stdin`. New exports: `classifyChangedFiles`. Existing exports unchanged. | All existing parser / linter logic; pure-helper discipline (no fs, no spawn, no network). |
| `__tests__/opsAuditLint.test.ts` | NEW Section 12 (CI scoping) appended after existing Section 11 (rules-file invariants). Existing Block 10 picks up 2 more invariant tests for the new lib surface. | All existing 105 tests unchanged. |
| `docs/ops/AUDIT-LINT.md` | NEW section between "Marker mechanism" and "CI deferred": "## CI enforcement (GitHub Actions)" describes the workflow + `--classify-changed` mode + how to read the PR check. The existing "## CI deferred" section is REPLACED with a "## CI deferred → CI enforced" historical-note paragraph that points readers to the new section. | All other operator-facing content (Usage, Exit codes, six rules, audit-type detection, phase-id normalization, adding doctrine-risk family, adding indirect-proof phrase, fixture directory, updating smoke template, "What the linter is NOT", Source links). |

### DELETED files

None.

### Files EXPLICITLY NOT TOUCHED

| Path | Why |
| --- | --- |
| `package.json` | RO-36 ratchet (intent §2 OUT; HALT trigger 3). No new npm script. Operators continue to call `node scripts/ops/audit-lint.mjs` directly. |
| `scripts/ops/audit-lint-rules.cjs` | Pure DATA file; marker string already exported; no rule changes (intent §2 OUT; HALT trigger 1). |
| Any file under `src/`, `app/`, `supabase/`, `mcp-server/`, `__tests__/fixtures/audit-lint/` | No runtime / no rules / no fixtures changed (HALT triggers 2 and 4). |
| Any existing `docs/audits/*SMOKE*.md` doc | Read-only over the corpus (HALT trigger 4); only NEW smoke audit added. |
| Any existing `docs/audits/*-template.md` doc | Templates already carry marker + required final step from predecessor card; not touched. |
| `docs/core/current-status.md` | Test-count update is the implementer's call AFTER gates green; design does not pre-commit to a count. |

### Guarantee statement

**`package.json` is NOT modified by this card.** Existing operator invocation continues to be `node scripts/ops/audit-lint.mjs <doc>` for the single-doc lint path. The CI path is invoked by GitHub Actions only. The RO-36 ratchet is preserved (HALT trigger 3 does not fire).

---

## HALT trigger table (all 15)

### Scope (1-5)

| # | Trigger | Status |
| --- | --- | --- |
| 1 | Any linter RULE change without surfacing FIRST | **NOT FIRED.** No edits to L1-L6 rules; `audit-lint-rules.cjs` UNCHANGED. |
| 2 | Any runtime code change (`src/`, `supabase/functions/`, `mcp-server/`) | **NOT FIRED.** Design touches only `.github/`, `scripts/ops/`, `__tests__/`, `docs/`. |
| 3 | `package.json` modified (RO-36 ratchet must hold) | **NOT FIRED.** Explicit guarantee above. |
| 4 | Workflow lints the FULL historical corpus by default | **NOT FIRED.** Workflow only lints `git diff --name-status base..head` filtered to A/M smoke audits; never iterates the full corpus. |
| 5 | Any non-audit-lint CI workflow added | **NOT FIRED.** `.github/workflows/audit-lint.yml` is the only workflow file; single-purpose `name: audit-lint`. |

### Correctness (6-11)

| # | Trigger | Status |
| --- | --- | --- |
| 6 | Diff base is `HEAD~1` / `origin/main` / any guessed base instead of `${{ github.event.pull_request.base.sha }}` | **NOT FIRED.** Workflow YAML uses `${{ github.event.pull_request.base.sha }}` and `.head.sha`; Section 12.C test 3 asserts `HEAD~1` / `origin/main` are ABSENT. |
| 7 | Added-vs-modified scoping re-implemented in YAML/bash separately from the classifier | **NOT FIRED.** All scoping logic lives in `classifyChangedFiles`; Section 12.C test 10 asserts no `git diff --name-status` or marker-grep appears in YAML. |
| 8 | Adding a new smoke audit without `Audit-Lint: v1` can evade enforcement | **NOT FIRED.** Predicate rule: `IF entry.status === 'A': EMIT path` — added files are ALWAYS in-scope. Section 12.A test 1 asserts this. |
| 9 | Classifier unit test does NOT exist OR does not cover all 4 truth-table rows | **NOT FIRED.** Section 12.A covers all 4 truth-table rows + 7 additional edge cases. |
| 10 | Workflow does NOT call the classifier (uses inline shell logic instead) | **NOT FIRED.** Workflow's lint step is `node scripts/ops/audit-lint.mjs --classify-changed`; Section 12.C test 2 asserts this. |
| 11 | Marker string in classifier differs from `audit-lint-rules.cjs` | **NOT FIRED.** Lib + entry `.mjs` source `MARKER_STRING` from `audit-lint-rules.cjs`; Section 12.B tests 2 and 3 assert no literal duplication. |

### Process (12-13)

| # | Trigger | Status |
| --- | --- | --- |
| 12 | Test forecast exceeds +50 | **NOT FIRED.** Forecast +20 to +32. |
| 13 | `__tests__/opsAuditLint.test.ts` baseline (105) regresses | **NOT FIRED.** Section 12 is purely additive; existing 105 tests are not modified. Implementer instructed not to delete or reorder existing tests. |

### Working tree (14-15)

| # | Trigger | Status |
| --- | --- | --- |
| 14 | Verdict tokens / doctrine ban-list violations in any shipped string | **NOT FIRED at design.** No verdict tokens (winner/loser/liar/dishonest/etc.) appear in YAML, lib changes, smoke audit, or doc updates. Implementer must preserve this in shipped code. |
| 15 | Unclassified untracked files at PR creation | **NOT FIRED at design.** The 10 known operator-territory files (`docs/testing-runs/2026-05-25-*`, `mcp021c-edge-smoke-*`, `netlify-prod.git`, `phase5-mcpserver002-*`) remain present per session start state. Implementer must NOT add unclassified files. |

**All 15 triggers do not fire.** The design is fully within the brief's scope envelope.

---

## Test forecast: +20 to +32 (binding within brief's +10 to +25)

### Breakdown

| Block | Tests | Source |
| --- | --- | --- |
| 12.A truth table | 11 | 4 truth-table rows + 7 edge cases (non-audit, deleted, template, order, empty, reader-not-called for non-M) |
| 12.B single-source marker | 3 | classifier-uses-rules-marker; lib has no literal; .mjs has no literal |
| 12.C workflow YAML inspection | 10 | exists; --classify-changed substring; base.sha; head.sha; 5 paths; checkout v4 + fetch-depth 0; setup-node 20.x; permissions read; no literal marker; no inline scoping |
| 12.D CLI arg parsing | 6 | --classify-changed + base + head; rejects positional; rejects no-base; rejects no-head; --changed-list-stdin; rejects --base outside classify mode |
| Block 10 extension | 2 | lib classifyChangedFiles export; lib purity preserved |
| **Subtotal new tests** | **32** | (forecast upper bound) |

### Lower-bound

If the implementer consolidates Section 12.C's 5-path test into a single `forEach` loop (1 test instead of 5), and similarly tightens 12.B + 12.D, the count lands at **~20**.

### Forecast band

| Scenario | New tests | New `opsAuditLint.test.ts` count |
| --- | --- | --- |
| Consolidated (lower bound) | +20 | 125 |
| Spelled-out (upper bound) | +32 | 137 |

Brief band: +10 to +25; HARD HALT +50. **Implementer should target the +20 to +25 range** to stay within brief; the +30 upper bound is the designer's hint of what fits if every test is spelled out separately.

### Full-suite delta

Jest baseline: 18,121.

| Scenario | New Jest total |
| --- | --- |
| +20 new | 18,141 |
| +25 new | 18,146 |
| +32 new | 18,153 |

Deno: 792 (unchanged).

---

## Read-only boundary list

| Path | Boundary | Why |
| --- | --- | --- |
| `scripts/ops/audit-lint-rules.cjs` | READ-ONLY | Pure data; marker string already exported; no rules to add. Modification fires HALT 1. |
| `__tests__/fixtures/audit-lint/**` | READ-ONLY | 4 fixtures are reference data; modification fires HALT 4 (corpus change). |
| `docs/audits/MCP-*-SMOKE-*.md` (existing) | READ-ONLY | Historical corpus exempted by marker; modification fires HALT 4. |
| `docs/audits/*-template.md` | READ-ONLY | Predecessor card established marker + required final step; templates not changed. |
| `package.json` | READ-ONLY | RO-36 ratchet; modification fires HALT 3. |
| `src/`, `app/`, `supabase/`, `mcp-server/` | READ-ONLY | Runtime code; modification fires HALT 2. |
| `docs/core/current-status.md` | OPERATOR-DISCRETION | Implementer may add the test-count line after gates green; not pre-committed. |
| `docs/core/session-handoff.md` | READ-ONLY | Architectural invariants; this card adds none. |
| `docs/core/implementation-plan.md` | READ-ONLY | Stage discipline; this card is OPS-track, not a stage. |
| `.env*` | READ-ONLY | Secrets policy. The workflow does not consume any secrets. |
| `CLAUDE.md` | READ-ONLY | Project-level constants; this card adds no stage transition. |

### Allowed-write boundary list

| Path | Boundary | Note |
| --- | --- | --- |
| `.github/workflows/audit-lint.yml` | NEW; allowed-write | Single new file; ~55 lines. |
| `scripts/ops/audit-lint.mjs` | MODIFIED; allowed-write | Additive: new `--classify-changed` mode + dispatch. Existing single-doc path UNCHANGED. |
| `scripts/ops/audit-lint-lib.cjs` | MODIFIED; allowed-write | Additive: `classifyChangedFiles` + new parser branches. Existing exports UNCHANGED. |
| `__tests__/opsAuditLint.test.ts` | MODIFIED; allowed-write | Additive: Section 12 appended; Block 10 gains 2 invariant tests. Existing 105 tests UNCHANGED. |
| `docs/ops/AUDIT-LINT.md` | MODIFIED; allowed-write | Replace "CI deferred" section with "CI enforced (GitHub Actions)" + a brief historical paragraph. |
| `docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md` | NEW; allowed-write | Smoke audit; ~150 lines; carries `Audit-Lint: v1`. |
| `docs/core/current-status.md` | OPERATOR-discretion; allowed-write | Implementer may add a one-line entry under the Stage 6.4 follow-up; not required for card success. |

---

## Brief ledger (orchestrator-authored brief sections; designer interpretive notes)

Per the POSTRUN-UX001 multi-card ledger discipline, this card's brief is **operator-authored** (per the explicit "operator-authored intent brief" commit message at `925b616`). The ledger below names each section's source of authority + the few items where designer interpretation was needed.

### Brief sections — source of authority

| Brief section | Source |
| --- | --- |
| §1 Why this card exists | Operator-authored; lift-PARTIAL motivation from predecessor PR #340 / e4fe8c6 |
| §2 Strict scope (IN / OUT) | Operator-stated; binding |
| §3 Required workflow shape | Operator-stated; YAML shape, 5 trigger paths verbatim, BASE_SHA / HEAD_SHA mechanics |
| §4 Single-source scoping rule (truth table) | Operator-stated; the 4 truth-table rows are existential per HALT 9 |
| §5 Classifier surface (Option A vs B) | Operator gave choice; designer selected A with justification (Phase A.2 above) |
| §6 Required tests | Operator-stated; classifier truth-table + workflow-calls-classifier proof |
| §7 Post-merge smoke audit | Operator-stated; 5-phase plan; dogfood requirement |
| §8 HALT triggers (15) | Operator-stated; binding |
| §9 Designer Phase A audits (4) | Operator-stated; this design executes them |
| §10 Test forecast band +10 to +25 | Operator-stated; HARD HALT +50 |
| §11 Smoke plan (5-phase) | Operator-stated |
| §12 Authorizations on PASS | Operator-stated |
| §13 Brief ledger structure | Operator-stated |
| §14 Execution order | Operator-stated |

### Designer interpretive judgments where the brief left freedom

1. **`--classify-changed` mode flag name** — the brief said "extend `audit-lint.mjs` with a `--classify-changed` mode" (suggesting that flag name) but did not bind it absolutely. Designer kept `--classify-changed` because (a) it self-describes vs `--ci-scope` or `--diff-classify`, (b) it pairs naturally with `--changed-list-stdin` for the test seam. Implementer may rename but should keep the workflow YAML and the tests aligned.

2. **`--changed-list-stdin` test seam** — the brief required a "function-level API in `audit-lint-lib.cjs` that accepts a `<status>\t<path>` list" but did not specify a CLI flag for stdin injection. Designer added `--changed-list-stdin` for operator-debug convenience (the workflow does NOT use it). If the implementer prefers function-level-only testing, the flag can be omitted; Section 12.D test 5 would then be removed (1 fewer test).

3. **Node version pinned to 20.x** — the brief said "read `engines` if present, else pin 20.x". `package.json` confirmed to lack `engines` field. Designer picked `'20.x'` (string with `.x` wildcard) per the `actions/setup-node` convention; the implementer may pin to a specific minor (e.g., `'20.18'`) if a stricter version control is preferred.

4. **Concurrency group + cancel-in-progress** — the brief said "include a small concurrency group so duplicate PR-update runs cancel earlier runs"; designer picked the standard `audit-lint-${{ github.event.pull_request.number }}` group key with `cancel-in-progress: true`. Implementer may rename or remove; not load-bearing for correctness.

5. **Permissions block** — the brief did not specify GH permissions. Designer picked `contents: read` minimal (matches read-only doctrine). Implementer may keep or remove the explicit block; default GH token has more permissions, so the explicit block is defensive.

6. **`docs/ops/AUDIT-LINT.md` section structure** — the brief said "operator doc workflow section"; designer specified: REPLACE the existing "CI deferred" section with "CI enforced (GitHub Actions)" + a paragraph noting the historical CI deferral and its resolution by this card. Implementer may restructure if a different section order reads better.

7. **Smoke audit Phase 1 naming** — the brief said "Phase 1 (CENTERPIECE): classifier truth-table verification". The designer notes that L1 expects an `ops` audit's `phase-1-preflight` slot to be PASS; the implementer should NAME the Phase 1 heading something that canonicalizes to `phase-1-preflight` (e.g., `## Phase 1 — Preflight + classifier truth-table verification`) so the smoke audit dogfoods green. This is an internal-doctrine note; the implementer may instead use `## Phase 1 — Preflight` and put the classifier verification under `## Phase 2 — Classifier truth-table` if a cleaner narrative is preferred. The brief's "Phase 1 CENTERPIECE" framing is about the audit's logical centerpiece, not its phase number. Designer judgment: keep the centerpiece IN Phase 1 to surface it most prominently to readers; rename the brief's "Phase 2 — Workflow-shape inspection" to "Phase 3" etc. if the implementer wants a separate Preflight phase, OR fold preflight into Phase 1's narrative.

   **Resolution preference**: write `## Phase 1 — Preflight + classifier truth-table verification` (single phase that satisfies L1 preflight AND houses the centerpiece). The 5-phase plan above describes the centerpiece as Phase 1 substance; preflight bookkeeping (git rev, branch state) sits at the top of the same phase.

8. **CI-side dogfood "deferred to first follow-up" fallback** — the brief said "won't trigger until next smoke-audit PR" is a concern; designer resolved that the merge PR for THIS card touches the workflow file AND a smoke audit AND the lib file AND the `.mjs` entry, three of which are in the path-filter. So the workflow SHOULD trigger on the merge PR — but GitHub has a known semantic that new workflow YAML files do not execute on the PR that adds them; they only start executing after merging to default. The designer marks Phase 5 CI-dogfood as "PASS if observable on merge PR; deferred to first follow-up audit PR otherwise". The reviewer will note which path actually obtained.

### Operator-deferred review (if any)

The designer reports **zero** items requiring operator review post-ship that are not already covered by the implementer/reviewer flow. All design choices either trace to brief stipulations or to defensible designer judgment within brief freedom envelope. The implementer's discretion items listed in points 1-7 above can be adjusted without operator re-approval; point 8 (CI-side dogfood) is observational and the reviewer reports whichever case obtained.

---

## Doctrine self-check

### cdiscourse-doctrine

| Rule | How the design respects it |
| --- | --- |
| §1 score is not truth | N/A — no scoring surface touched. |
| §2 heat is activity, not truth | N/A. |
| §3 popularity is not evidence | N/A. |
| §4 AI moderator limits | N/A — no AI / LLM call. |
| §5 rules engine sacred | N/A — does not touch `src/lib/constitution/engine.ts`. |
| §6 secrets policy | The workflow consumes ZERO secrets. `GITHUB_TOKEN` is auto-provided by GH Actions; `permissions.contents: read` is the only access requested. No secrets are read, written, or logged. |
| §7 no AI calls from prod app | N/A — script is `scripts/ops/` + `.github/workflows/`, not prod app. |
| §8 Supabase conventions | N/A — no DB, no migration, no RLS. |
| §9 plain language for users | N/A — operator-facing tool, not user-facing. |
| §10 v1 scope guards | N/A — process tooling, not a user feature. |

### test-discipline

| Rule | How the design respects it |
| --- | --- |
| Tests are part of done | +20 to +32 tests bundled in this card. |
| Test file location | `__tests__/opsAuditLint.test.ts` (top-level; appending Section 12 to existing file). |
| Pure-model tests | `classifyChangedFiles` is pure (no fs, no spawn, no network); tests invoke it directly with injected entries + reader. |
| Doctrine ban-list test | No new ban-list test required; the workflow YAML + new test strings contain no verdict tokens. |
| Test count goes UP | +20 to +32 forecast; baseline 105 → ~125-137 in `opsAuditLint.test.ts`. |
| Gate timeouts | Targeted Jest gate via `--testPathPattern="opsAuditLint"` runs in seconds; full suite gate is `npm run test` (well within 10-minute Bash timeout). |

---

## Operator steps (after implementer commits)

| Step | Command | When |
| --- | --- | --- |
| 1. Run targeted Jest gate | `npx jest --testPathPattern="opsAuditLint" --no-coverage` | After each commit |
| 2. Run typecheck | `npm run typecheck` | Before PR |
| 3. Run lint | `npm run lint` | Before PR |
| 4. Run full test suite | `npm run test` | Before PR |
| 5. Run Deno regression (unchanged) | `cd mcp-server && deno test --allow-net --allow-env --allow-read` | Before PR |
| 6. Verify 4 historical fixtures still self-validate | `node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/<each>.md` for all 4 fixtures | Before PR |
| 7. Local dogfood — smoke audit lints itself | `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-SMOKE-LINT-CI-WIRING-SMOKE-2026-05-28.md` | Before PR |
| 8. Push PR and observe GH Actions tab | Manual; report whether `audit-lint` workflow ran on the PR and whether it was green | At PR creation |
| 9. (Post-merge) Open the next PR that touches a smoke audit and verify CI fires green | Manual; surface to reviewer | First follow-on smoke-audit PR |

**None require Supabase deploy. Zero secrets touched. Zero `.env*` files written.**

---

## Out of scope

- ANY runtime code change to MCP server, Edge Functions, src/, or any production path
- ANY linter rule change (L1-L6 unchanged; rules file untouched)
- ANY existing audit doc under `docs/audits/` modified or deleted (read-only over corpus)
- Any non-audit-lint CI workflow (no general test workflow, no deploy workflow, no preview workflow)
- `package.json` change (RO-36 ratchet preserved)
- Push notifications to operator on workflow failure (PR check is the surface)
- Slack / email / webhook notification on workflow failure
- Comment-on-PR by the workflow (`permissions: contents: read` prevents this anyway)
- Artifact upload (no logs / no reports persisted as artifacts)
- Scheduled / cron run (workflow is `on: pull_request` only)
- Manual `workflow_dispatch` trigger (not added; could be added in a follow-up if operator wants a manual re-run button)
- Matrix builds (single-OS, single-Node-version)
- Caching (workflow runs in seconds; no benefit)
- Branch protection rule change (separate operator action; this card defines the check, not the protection)
- CI on a different mechanism (Netlify deploy preview, husky pre-commit, GitLab) — design specifies GitHub Actions only
- OPS-MCP-AUDIT-SCHEMA-V2 (deferred follow-on; structured front-matter schema)

---

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Workflow first-run-on-default-branch semantic prevents CI-dogfood on this PR | MEDIUM | Phase 5 CI-dogfood is marked addressable; if not observable, defer to first follow-up audit PR. Local dogfood is the binding proof. |
| `git diff --name-status` produces output the classifier mis-parses on rename (R) or copy (C) operations | LOW | Classifier handles R/C by ignoring them (not A and not M → CONTINUE). Git's default rename detection produces an A+D pair under `--diff-filter` adjacent semantics, so the A side of a rename is still in scope. Implementer should run a quick test of a renamed smoke audit during local dogfood (`git mv` an existing smoke doc) to confirm. |
| `--changed-list-stdin` test seam adds CLI surface area that may regress later | LOW | If undesired, the seam can be removed; tests would shift to function-level only. The pure `classifyChangedFiles` is the binding contract. |
| Concurrency cancellation makes a CI dogfood transient (race against subsequent PR updates) | LOW | Operators are not expected to be observing CI mid-run; the final-state result is what the PR check shows. |
| `actions/checkout@v4` upgrade in the future changes `fetch-depth: 0` semantics | LOW | Pin is to v4 major. Major-version upgrades go through their own review. |
| `setup-node@v4` v20.x resolution shifts under us when Node 20 LTS receives patches | LOW | Patch shifts are not behavior-affecting for this workflow (pure Node, no native deps). |
| Workflow runs out of minutes on a heavily-active PR | LOW | Workflow runs in seconds; concurrency cancellation discards earlier runs. |
| Implementer accidentally edits `__tests__/fixtures/audit-lint/**` while wiring tests | LOW | Read-only boundary list explicit; implementer prompted to verify `git status` shows no changes under that directory. |
| Implementer accidentally introduces a literal `'Audit-Lint: v1'` in `.mjs` or YAML | LOW | Section 12.B tests 2-3 + Section 12.C test 9 catch this mechanically. |
| Implementer accidentally hardcodes `HEAD~1` while debugging | LOW | Section 12.C test 3 + Section 12.B test 3 catch this mechanically. |

---

## Dependencies (cards / docs / files)

### This design assumes is complete

- **OPS-MCP-SMOKE-DOCTRINE-HARDENING** (PR #340; merged at `91a3664`) — the audit-lint runner + L1-L6 rules + 4 self-validation fixtures + `audit-lint-rules.cjs` with `MARKER_STRING` export are in main. **Confirmed at session start.**
- **Post-merge smoke audit at `e4fe8c6`** verifies PARTIAL verdict by design (CI deferred). **Confirmed at session start.**
- **Intent brief commit `925b616`** is on this branch (HEAD per session start). **Confirmed.**

### Reads existing files at functions / patterns

- `scripts/ops/audit-lint.mjs` `main()` — extend dispatch path
- `scripts/ops/audit-lint-lib.cjs` `parseCliArgs`, `isTemplateFilename` — extend / reuse
- `scripts/ops/audit-lint-rules.cjs` `MARKER_STRING` — sole source-of-truth
- `__tests__/opsAuditLint.test.ts` Block 10 pure-helper discipline — extend with classifier purity assertions
- `__tests__/opsAuditLint.test.ts` Block 11 rules-file invariants — pattern for "lib source: X" tests
- `actions/checkout@v4` and `actions/setup-node@v4` (external; pinned by major)

### Cards this design BLOCKS

- **MCP-SERVER-007-FAMILY-F** — its smoke audit will pass through the CI workflow from PR open; the smoke audit MUST carry the marker (predecessor card already wired the F-template carry-over).
- **MCP-021C-EDGE-FAMILY-E-ENABLE** — its production-enable audit MUST satisfy L3 + L4 (predecessor card; this card adds mechanical PR-time enforcement).
- Any future smoke audit added to a PR.

### Cards this design DOES NOT block

- Any non-MCP card; any UI / UX card; any roadmap card outside the audit pipeline.
- OPS-MCP-AUDIT-SCHEMA-V2 — a follow-on that may rewrite parsing to YAML front-matter. Independent of CI wiring.

---

## Edge cases

| Case | How the design handles it |
| --- | --- |
| PR has no audit-related changes | Trigger `on.pull_request.paths` does not match; workflow does not run. (GH default behavior.) |
| PR touches only the lib or `.mjs` or rules (no audit doc changes) | Workflow triggers; classifier produces empty stdout; lint step is skipped; job exits 0. |
| PR adds a non-smoke audit doc under `docs/audits/` (no SMOKE in name) | Path-filter glob `**SMOKE*.md` excludes it; classifier path-filter also excludes it; both layers agree. |
| PR adds a smoke audit WITH marker | Classifier returns the path; linter lints it; PASS or FAIL per L1-L6. |
| PR adds a smoke audit WITHOUT marker | Classifier returns the path anyway (status A); linter lints it; PASS or FAIL per L1-L6. **Evasion closed.** |
| PR modifies an existing pre-hardening smoke audit (no marker) | Classifier filters it out; lint step skipped for it; job exits 0. |
| PR modifies the post-hardening smoke template | Path-filter EXCLUDES templates because of the doc title match — wait: the template paths DO match `docs/audits/**SMOKE*.md` glob. Classifier filters them via `isTemplateFilename` returning true → path skipped. **Templates are NOT linted.** |
| PR modifies `__tests__/fixtures/audit-lint/**` | Path-filter `__tests__/fixtures/audit-lint/**` includes them; classifier reaches them but `isTemplateFilename` returns false (they're not `-template.md`); marker check applies. Fixtures already carry `<!-- AUDIT-LINT-FIXTURE -->` markers but do NOT carry `Audit-Lint: v1` (they are INTENTIONAL NEGATIVE FIXTURES); if status is M, classifier returns empty (no marker); job exits 0. If status is A (new fixture added), classifier returns the path; linter lints it. This is the expected behavior: adding a new fixture should be reviewable. The implementer notes this in `docs/ops/AUDIT-LINT.md`. |
| PR force-pushes; the base SHA changes mid-run | Concurrency cancels the old run; new run uses the new base SHA. |
| `git diff --name-status` errors because the base SHA is not in the cloned history | `fetch-depth: 0` prevents this; if it still errors, `spawnSync` returns non-zero `status`; the classifier surfaces a non-zero exit code (5? — implementer choice). Operator-facing diagnostic. |
| `git show` errors when reading a marker at HEAD | Reader closure returns `false` (treats as no marker); `M` paths drop out of scope. Conservative behavior. |
| Workflow YAML has a syntax error | GitHub UI surfaces "invalid workflow file"; no run starts; PR check is unreachable. Operator fix needed before merge. |
| `node-version: '20.x'` fails to resolve (Node 20 EOL) | `setup-node@v4` errors; workflow fails; PR check is red. Future maintenance concern (likely 2028+). |
| Two PRs open simultaneously each modifying a smoke audit | Each PR gets its own concurrency group (keyed by PR number); both run independently. |
| Author edits a fixture file by mistake | Classifier may flag it as in-scope (status M, no marker → out-of-scope; status A in a new fixture → in-scope). If linting a fixture produces L1/L2 findings (because the fixture IS a negative-case), the workflow fails the PR. **This is correct**: fixture changes should be reviewed by humans, not auto-linted-through. |

---

## Risks summary

| Risk | Severity | Existential? |
| --- | --- | --- |
| CI-dogfood not observable on merge PR (GH first-workflow semantics) | LOW | NO — local dogfood is binding |
| Rename/copy edge cases in `git diff --name-status` | LOW | NO |
| Concurrency cancellation race | LOW | NO |
| Implementer drift (literal marker in YAML, HEAD~1 in code) | LOW | NO (Section 12 tests catch all named drift) |
| Implementer over-scopes test count (>+50) | MEDIUM | YES — HARD HALT 12 |
| Implementer modifies linter rules accidentally | LOW | YES — HALT 1 |
| Implementer breaks existing 105 tests | LOW | YES — HALT 13 |

No existential risks are unmitigated. The implementer's primary discipline: keep Section 12 additive, source the marker from rules only, use PR base SHA only.

---

## Final designer summary

| Decision | Choice | Rationale |
| --- | --- | --- |
| Classifier surface | Option A (extend `audit-lint.mjs`) | Single CLI entry, lighter operator surface, reuses parser + exit codes |
| Pure-function API | `classifyChangedFiles(entries, readMarkerAtHead): string[]` | Pure; lib retains "no fs / no spawn" discipline |
| Test seam | Function-level + `--changed-list-stdin` CLI flag | Tests work without git; operator can dry-run with stdin |
| Workflow trigger | `on.pull_request.paths` with 5 verbatim patterns | Path-scoped; matches intent §3 |
| Diff base | `${{ github.event.pull_request.base.sha }}` | Per intent §3; rejects HEAD~1 / origin/main |
| Node pin | `'20.x'` | No `engines` in `package.json`; brief default |
| Concurrency | `audit-lint-<PR>` + cancel-in-progress | Standard idiom |
| Permissions | `contents: read` | Minimal; defensive |
| Test forecast | +20 to +32 | Within brief band; spelled-out vs consolidated |
| Smoke audit phases | 5 (Preflight+centerpiece, Workflow shape, Marker single-source, Regression, Dogfood) | Per intent §11 |
| Files touched | 2 NEW (`.yml`, smoke audit) + 4 MODIFIED (`.mjs`, `.cjs` lib, `.test.ts`, AUDIT-LINT.md) | All additive; `package.json` untouched |
| HALT triggers | 0/15 fire | All disposed per per-section tables |
| Open questions | 0 | Brief is comprehensive |

The implementer has all the information needed to land this card without further clarification. The reviewer has 15 HALT triggers + 32 new tests + 5 phases of the smoke audit to verify mechanically.
