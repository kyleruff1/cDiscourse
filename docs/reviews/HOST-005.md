# HOST-005 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** `feat/HOST-005-secret-manager-migration-and-cloud-run-s`
**Design:** `docs/designs/HOST-005.md`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/87

---

## Summary

HOST-005 lands the dev-environment Secret Manager contract: a names-only manifest, a draft-07 JSON Schema, two operator helper scripts (`print-secret-commands` and `preflight-secrets`) with PowerShell + bash wrappers, a 9-step operator runbook, plus a patch to HOST-001 step 13. **No production code changes**, **no `src/**` or `app/**` modifications**, **no `package.json` / `package-lock.json` churn**, **no HOST-001 file mutations**, and **zero new dependencies**.

The implementation matches the design with four deliberate strengthening deviations (each documented below) — all of which tighten doctrine compliance further than the design originally specified. The most consequential one: the `versions add` command shape uses pure stdin (`gcloud secrets versions add ... --data-file=-` with the operator pressing Ctrl-D / Ctrl-Z+Enter to feed the value), rather than the design's `printf %s "<VALUE>" | gcloud ...` shape that would have put the value briefly in `printf`'s argv. The implementer's choice removes the argv leak path entirely. Operator runbook step 6 and HOST-001 step-13 patch agree.

All 106 new HOST-005 tests pass. Typecheck and lint are clean. The 19 pre-existing failures in `__tests__/aiDrivenBotCorpus.test.ts`, `__tests__/xaiAdversarialPipeline.test.ts`, `__tests__/xaiAdversarialProvider.test.ts`, `__tests__/xaiAdversarialSourceHarvest.test.ts`, and `__tests__/xaiSeededStancesLive.test.ts` are environmental (caused by `.env.engagement-intelligence.example` existing on the operator's local worktree, which the bot-fixture loader treats as a present env file) — they are reproducible on a clean `main` checkout and are NOT introduced by HOST-005.

## Verification

- **typecheck:** PASS (zero output from `tsc --noEmit`).
- **lint:** PASS (zero warnings, `eslint . --max-warnings 0`).
- **test:** PASS for HOST-005 (`106 / 106`). Full suite: `3307 / 3326` (matches implementer's report; the 19 failures pre-exist on main, confirmed by re-running the failing suite against the unmodified main branch). +106 net.
- **secret scan:** CLEAN. Every match for `ANTHROPIC_API_KEY`, `SERVICE_ROLE`, `sk-ant-`, `xai-`, `sb_secret_`, `Bearer`, `eyJ`, `.supabase.co` is in either a denylist literal (helpers/test fixtures asserting refusal), a doctrine narrative (design / runbook / current-status), or a negative regex assertion (test confirming the helper rejects them). No real values, no JWT-shaped strings, no project URLs.
- **doctrine scan:** CLEAN. No truth/winner/loser language. No `SERVICE_ROLE` token in client paths. No direct `public.arguments` access. No AI client surface added.

## Design conformance

- [x] All design file-changes are present (10 new + 2 modified — matches the design's File-changes section).
- [x] No undocumented file-changes (every changed file traces to a design requirement).
- [x] Data model matches design (manifest schema, JSON shape, env-var pattern, secret-name pattern, runtime SA shape).
- [x] API contracts match design (exit codes 0/2/3/4/5/6/7 for preflight, 0/2/3/4/5 for print-secret-commands; `--json` output schema; `--strict-project` semantics).
- [x] Manifest contains EXACTLY two entries with the locked names and env vars (D10).
- [x] Cross-file alignment with `infra/cloud-run/cdiscourse-dev.template.yaml` `secretKeyRef.name` confirmed by test (and by hand: `cdiscourse-dev-supabase-url` and `cdiscourse-dev-supabase-publishable-key` appear with the matching env-var names).
- [x] Cross-file alignment with `infra/iam/cdiscourse-dev-runner.iam.yaml` resource bindings confirmed by test (resource-scoped `secretAccessor`, not project-scoped).

## Doctrine self-check

- [x] **No truth/winner/loser language in user-facing strings.** Card is pure ops plumbing; no user-facing copy added.
- [x] **Score never blocks posting.** N/A (no scoring surface).
- [x] **No service-role in client code.** `git diff main..HEAD -- 'src/**' 'app/**'` is empty.
- [x] **No direct insert into `public.arguments`.** No DB surface touched.
- [x] **No AI calls in production app paths.** No Anthropic / xAI / X / Resend surface added. Helpers have no network paths beyond `spawnSync('gcloud', ...)` and that is operator-authorized preflight only.
- [x] **Plain language only (no raw internal codes in UI strings).** N/A (no UI).
- [x] **Epic-specific doctrine (`supabase-edge-contract`):** The publishable / anon key is the only Supabase secret the bundle reads; HOST-005 routes it through Cloud Run Secret Manager (not committed `.env`); service-role remains in Supabase Function secrets and is never bound to Cloud Run. The forbidden-name list explicitly refuses `service-role`, `service_role`, `supabase_service_role_key`, `sb-secret`, `sb_secret` (helper exit 3). PASS.

## Security checks (per parent's listed risk areas)

1. **Value leakage paths in helper output — PASS.** Hand-ran the helper:

   ```
   gcloud secrets versions add cdiscourse-dev-supabase-url \
     --data-file=- \
     --project=cdiscourse-host
   ```

   No inline value substitution, no `printf %s "<VALUE>"` shape. Value enters only via stdin. Test `output never contains \`printf %s\`` explicitly enforces this.

2. **`gcloud secrets versions access` invocation — PASS.** Source-scan test at `__tests__/hostFivePreflightSecrets.test.ts:170-190` strips comment lines + help-text literals first, then asserts the argv-tuple form (`'versions', 'access'`) never appears. Confirmed by hand: `grep -E "versions access|versions[\"',]\s+access"` in helper sources matches only doctrine self-references in comments / help text, never an actual subprocess call.

3. **`.env*` read attempts — PASS.** No `dotenv` import. `readFileSync` is only ever called with the explicit manifest path argument. Tests at `__tests__/hostFivePrintSecretCommands.test.ts:353-356` and `__tests__/hostFivePreflightSecrets.test.ts:224-227` enforce.

4. **New dependencies — PASS.** `package.json` and `package-lock.json` are unchanged in the diff (`git diff main..HEAD --name-only | grep package` is empty).

5. **Manifest schema enforcement — PASS.** Hand-ran with a `cloudRunEnvVar: "SOME_OTHER_VAR"`: exit 2 with `secrets[0].cloudRunEnvVar must start with EXPO_PUBLIC_`. Tests at `hostFivePrintSecretCommands.test.ts:194-208` enforce.

6. **Forbidden-name list completeness — PASS+.** Implementer's `FORBIDDEN_NAME_TOKENS` is a **superset** of the design's list. Design specified: `service-role`, `service_role`, `anthropic`, `xai`, `x-bearer`, `resend`, `bearer`, `*-api-key`, `*-secret-key`. Implementer added: `x_bearer`, `_api_key`, `_secret_key`, `supabase_service_role_key`, `sb-secret`, `sb_secret`. More restrictive, doctrine-aligned.

7. **`--strict-project` flag — PASS.** Hand-ran the preflight with `HOST_005_STUB_PROJECT=cdiscourse-prod`:
   - With `--strict-project`: exit 4 (`gcloud project "cdiscourse-prod" does not match manifest.project "cdiscourse-host"`).
   - With `--no-strict-project`: exit 0 + two stderr warnings (`--no-strict-project: project mismatch ignored` + the standard mismatch warning).
   - With neither flag: exit 0 + the standard mismatch warning only.

8. **Runtime SA IAM binding check — PASS.** Hand-ran preflight with `HOST_005_STUB_NO_IAM=cdiscourse-dev-supabase-url`: exit 5, output `hasRuntimeBinding=false` on the affected secret. The `hasAccessorBinding` helper at `preflight-secrets.mjs:289-303` checks each binding's `role` (must be `roles/secretmanager.secretAccessor`) and `members` (must include `serviceAccount:<runtimeServiceAccount>` exactly). Test `exit 5 when at least one secret has no runtime IAM binding` at `hostFivePreflightSecrets.test.ts:78-83` enforces.

9. **HOST-001 file invariance — PASS.** `git diff main..HEAD --name-only` shows zero changes to `Dockerfile`, `.dockerignore`, `scripts/runtime/server.mjs`, `scripts/build/*`, `src/lib/supabase.ts`, `infra/cloud-run/*`, `infra/iam/*`. Only `docs/deployment/host-001-operator-runbook.md` is modified (step-13 patch only — Phase 1/2/4/5 untouched, confirmed by reading the diff).

10. **Constitution engine invariance — PASS.** `src/lib/constitution/engine.ts` unchanged. No `src/**` files changed at all.

11. **No service-account JSON anywhere — PASS.** `grep -E "BEGIN PRIVATE KEY"` returns zero matches across all new files.

12. **Test count — PASS.** Re-ran the full suite myself: `3307 passed, 19 failed, 3326 total`. Matches implementer's report. The 19 failures all pre-exist on main (verified by running `__tests__/aiDrivenBotCorpus.test.ts` against a clean `main` checkout — same failure pattern). Cause: the loader at `scripts/bot-fixtures/claudeMessagesClient.js:113` treats the presence of `.env.engagement-intelligence.example` as `cfg.fileExists=true`, which flips the failure mode from `api_key_missing` to `env_file_missing`. This is environmental noise from the operator's worktree, NOT a HOST-005 regression.

## Spot-check findings

- `scripts/deploy/print-secret-commands.mjs:79-97` (parseArgs): clean — no value-accepting flags; `--manifest` is the only positional input.
- `scripts/deploy/print-secret-commands.mjs:302-324` (renderVersionsAddSection): emits `--data-file=-` only. No `printf %s` shape. Inline guidance: `# then type / paste the value, Ctrl-D to send EOF (bash) or Ctrl-Z then Enter (PowerShell)` followed by `# Immediately after: Clear-History; Set-Clipboard $null` and `history -c; pbcopy < /dev/null` lines.
- `scripts/deploy/preflight-secrets.mjs:243-253` (runGcloud): the test-only `.mjs`/`.js`/`.cjs` branch is gated by a regex that the production `--gcloud-bin=gcloud` default cannot match (literal `gcloud` has no `.mjs` suffix). Production behavior is `spawnSync(bin, args, ...)` with `bin='gcloud'`.
- `scripts/deploy/preflight-secrets.mjs:286-303` (hasAccessorBinding): correctly tolerates malformed JSON (`return false` in catch) and requires both role AND member match — a bare `bindings: []` returns false.
- `docs/deployment/host-005-secrets-runbook.md:38-241` (9 numbered steps): `grep -cE '^#+\s*[1-9]\.\s+\*\*'` returns exactly `9`. Each step carries an explicit `> **The agent does NOT run any command in this section.**` blockquote (or equivalent). Step 6's stdin / Ctrl-D / Ctrl-Z+Enter / `Clear-History` / `history -c` / `Set-Clipboard $null` / `pbcopy < /dev/null` / `xclip ... clipboard` guidance is all present. Step 6 also explicitly states "Never paste a secret value into Claude or any agent chat".
- `docs/deployment/host-001-operator-runbook.md:151-186` (step 13 patch): now references `docs/deployment/host-005-secrets-runbook.md`, `print-secret-commands`, and `preflight-secrets` by name. The old `printf %s "<PROJECT_URL_VALUE>" | ...` line is replaced with the stdin shape. Old language `When HOST-005 lands` is updated to `HOST-005 has landed`. Phase 1/2/4/5 untouched.

## Test verification (RUN, not trusted)

```
npm run typecheck → exit 0
npm run lint      → exit 0
npm run test      → 3307 passed, 19 failed (pre-existing), 3326 total
npm run test -- __tests__/hostFive*.test.ts → 106 / 106 (all HOST-005 tests pass)
```

The 19 pre-existing failures span `aiDrivenBotCorpus.test.ts`, `xaiAdversarialPipeline.test.ts`, `xaiAdversarialProvider.test.ts`, `xaiAdversarialSourceHarvest.test.ts`, and `xaiSeededStancesLive.test.ts`. None touch HOST-005. They reproduce on a clean `main` checkout. They are NOT a HOST-005 blocker.

## Implementation deviations from design (4 judgment calls)

1. **`--data-file=-` stdin path replaces design's `printf %s "<VALUE>" | gcloud ...` shape.** **Verdict: ACCEPT.**
   - Rationale (implementer's): command-line value substitution puts the value in `printf`'s argv, which shells often persist to history. The stdin path avoids this entirely.
   - Hand-verified: helper output uses only `--data-file=-`. No `printf %s` literal appears (test enforces). Runbook step 6 instructs operator to type / paste the value with Ctrl-D / Ctrl-Z+Enter to send EOF, then `Clear-History; Set-Clipboard $null` (PowerShell) or `history -c; pbcopy < /dev/null` (bash). HOST-001 step-13 patch also uses the stdin shape. All three places agree.
   - Strictly safer than the design. Doctrine-aligned.

2. **`__tests__/fixtures/` directory created.** **Verdict: ACCEPT.**
   - Verified: `git log --all --diff-filter=A` shows `__tests__/fixtures/host-005-gcloud-stub.mjs` is added in commit `a1a9fb7`. The directory did not previously exist. Filename is clearly namespaced (`host-005-gcloud-stub.mjs`) — future cards can drop fixtures next to it without collision.

3. **Cross-platform stub invocation in `preflight-secrets.mjs`.** **Verdict: ACCEPT.**
   - Verified: `runGcloud(bin, args)` at `preflight-secrets.mjs:243-253` checks if `bin` ends in `.mjs`/`.js`/`.cjs`; if so, invokes via `process.execPath` so the Windows-without-shebang case works. The default `bin='gcloud'` literal never matches the regex, so production always takes the direct-spawn path.
   - Source-scan test at `__tests__/hostFivePreflightSecrets.test.ts:192-217` still asserts only the documented `gcloud` subcommands appear in the source (`--version`, `config get-value project`, `secrets describe`, `secrets versions list`, `secrets get-iam-policy`). Confirmed by hand.

4. **Runbook step heading shape `### N. **Title.**` (ATX H3 + bold).** **Verdict: ACCEPT.**
   - Verified: `grep -cE '^#+\s*[1-9]\.\s+\*\*'` returns 9. Renders sensibly in GitHub markdown (each step is a clearly bolded H3 anchor). Test regex `/^#+\s*[1-9]\.\s+\*\*/gm` matches.

## What's still needed before the operator deploys (HOST-006 / HOST-007 prereqs)

These are operator-runnable steps; the agent is done.

1. Operator re-reads `docs/deployment/host-005-secrets-runbook.md`.
2. Operator runs runbook steps 1-9 in order against `cdiscourse-host` / `us-central1`. Confirm:
   - Step 1 — `gcloud auth login` + `gcloud auth application-default login`.
   - Step 2 — `gcloud config set project cdiscourse-host`, `gcloud config set run/region us-central1`.
   - Step 3 — `gcloud services enable secretmanager.googleapis.com --project=cdiscourse-host`.
   - Step 4 — `node scripts/deploy/print-secret-commands.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json > /tmp/host-005-commands.sh`. Visually inspect.
   - Step 5 — paste the two `gcloud secrets create ...` commands.
   - Step 6 — for each secret, run the `gcloud secrets versions add ... --data-file=-` command, type / paste the value, send EOF, then `Clear-History; Set-Clipboard $null` (PowerShell) or `history -c; pbcopy < /dev/null` (bash). Note: the runtime SA `cdiscourse-dev-runner` must exist (HOST-001 Phase 1 step 6) before step 7 binding works.
   - Step 7 — paste the two `gcloud secrets add-iam-policy-binding ...` commands.
   - Step 8 — `node scripts/deploy/preflight-secrets.mjs --manifest=infra/secrets/cdiscourse-dev-manifest.json --strict-project` must exit 0.
   - Step 9 — return to HOST-001 Phase 4 step 19 (`gcloud run services replace ...`).
3. HOST-004 (deploy scripts) is the next card; it will read the manifest and call `preflight-secrets.mjs --strict-project` before every `gcloud run deploy`.
4. HOST-006 (DNS records) and HOST-007 (IAP) are independent of HOST-005.
5. HOST-008 (prod manifest under `cdiscourse-prod-*` namespace) inherits the same schema and helpers but is out of scope here.

No `npx supabase db push`, no `npx supabase functions deploy`, no DNS mutation. Pure ops plumbing.

## Operator next steps

- Push the branch: `git push -u origin feat/HOST-005-secret-manager-migration-and-cloud-run-s` (already pushed per the upstream-tracking line in `git status -sb`).
- Open PR: `gh pr create --title "HOST-005: Secret Manager manifest + helpers + runbook" --body-file docs/reviews/HOST-005.md`.
- After merge: walk runbook steps 1-9 above.
