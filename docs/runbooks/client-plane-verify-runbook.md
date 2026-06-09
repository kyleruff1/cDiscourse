# Client-Plane Verification Runbook

**Purpose.** After a Netlify/Expo-Web client release, prove that the live client bundle is
serving the intended `main` SHA and that newly-merged UI/mapping behavior (currently the
Build-2 A–G machine-observation chips) renders for a real **authenticated** user — **safely,
verdict-free, and without leaking internals** — using a **dedicated bot account in bash**, with
**no interactive browser sign-in, no provider spend, and no writes**.

This is a **verification lane, not a build lane.** It changes nothing in production.

Motivating context: the six-plane delivery model (GitHub `main` / Supabase Edge / Deno Deploy
MCP / **Netlify client** / audit plane / worktrees). Backend-live does **not** imply
client-visible — the client bundle must be published and proven separately. This runbook closes
that last plane. Pairs with `docs/deployment/host-simple-001-netlify-runbook.md` (the deploy
side).

---

## What this proves — and what it does not

**Proves (bash-automatable):**
- `main` is clean and the live bundle is a build of the current `main` SHA (content-marker match).
- The served bundle contains the merged mapping code and **no token-shaped secrets**.
- A real **authenticated bot** can load the same data surfaces the client renders (room list,
  a room's arguments, a node's machine observations).
- ≥1 already-live Build-2 family's persisted observations are present and render-mapped.
- The data is **leak-safe at the RLS boundary** for a non-admin user (no raw `evidence_span` /
  admin-only columns), and the render-doctrine guard suites are green.

**Does NOT prove:**
- Pixel-level React rendering (no browser). Combine this with (a) the bundle content-marker
  proof and (b) the doctrine test suites for a strong client-plane PASS. If you need true pixel
  proof, run a separate headless-browser (Playwright) lane.

---

## Prerequisites

- `.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the live client config).
- `.env.bot-tests` — `CDISCOURSE_BOT_A_*` (a non-admin bot) and `CDISCOURSE_ADMIN_*`.
- Existing bot-login plumbing to **reuse, not reinvent**:
  `scripts/bot-fixtures/loadEnv.js` (`loadEnvFiles`, `buildBotConfig`) +
  `scripts/bot-fixtures/supabaseClient.js` (`createBotClient`, `signInBot`).
- Known-populated fixtures: the `#479` corpus left 3 live debate rooms with A–G observations —
  `2a66ca93-750e-473d-abc6-753ba256c1b5`, `2315f479-69cc-416e-9767-ce8651a33f9b`,
  `8a158837-d6c3-408b-a8ff-4c6a4299d293`.

## Hard guardrails

- **READ-ONLY.** No `submit-argument`, no `classify-argument-boolean-observations`, no
  `admin_validation`, no INSERT/UPDATE/DELETE, no Edge call that triggers an MCP/Anthropic
  provider call. **No provider spend.**
- **Never print secrets** — reference by SHA-256 prefix + length only.
- **Leak-safe output** — counts + key NAMES only. Never echo `evidence_span` text, argument
  bodies, emails, or JWTs.
- Do **not** flip `productionEnabled`, touch `#394`, or arm classifier-queue routing.
- Use a **non-admin** bot for the leak boundary — admins see everything; real client users do not.

---

## Procedure

1. **Source-of-truth.** `git checkout main && git pull --ff-only`. Assert `HEAD == origin/main`,
   `tracked_mods = 0`, and `gh pr list --state open` is `0` (or only unrelated lanes). Record the
   HEAD short SHA.

2. **Derive the Build-2 key set + source-level doctrine check.** Dump the family definitions:
   ```bash
   for f in src/features/nodeLabels/machineObservationDefinitions/family{A,B,C,D,E,F,G}.ts; do
     echo "--- $f"
     grep -nE "rawKey|label|diagnostic|doctrineNote|falsePositiveGuards" "$f" | head -120
   done
   ```
   Derive the 3 new Family-G keys from `familyG.ts` / `mcp-server/lib/familyGKeys.ts`. The
   already-live Build-2 **new** keys to target (≥1 family must render):
   - **Family B:** `isolates_main_disagreement`, `distinguishes_fact_value_disagreement`, `preserves_face_while_disagreeing`
   - **Family A:** `acknowledges_parent_strength`, `compares_parent_to_sibling_branch`, `identifies_parent_scope_limit`
   - **Family F:** `question_names_uncertainty`, `question_separates_claim_evidence`, `question_invites_revision`
   - **Family G:** `records_remaining_disagreement`, `defines_next_evidence_needed`, `separates_normative_from_empirical`

   Assert **no verdict token** (winner/loser/true/false/liar/dishonest/bad faith/manipulative/
   extremist/propagandist/correct/wrong/won/lost) appears in any `label` / `diagnostic` /
   `doctrineNote` value. Verdict words inside `falsePositiveGuards` **negations** are expected and OK.

3. **Live bundle re-affirm (no auth).** `curl` the live `/` (default
   `https://dev-cdiscourse.netlify.app`) → extract the `/_expo/static/js/web/index-<hash>.js` ref →
   fetch it. Assert (a) **no token-shaped secrets**
   (`sk-ant-…` | `sb_secret_…` | `SUPABASE_SERVICE_ROLE` | a 3-segment `eyJ…` JWT), and (b) the
   Build-2 new keys from step 2 are **present** in the bundle (proves the served client code
   includes the merged mapping rows). Note: a local `web:build` hash will differ from the live
   hash because `EXPO_PUBLIC_*` values bake into the content hash — compare **content markers**,
   not the hash.

4. **Authed login.** Authenticate `BOT_A` via the Supabase password grant
   (`POST {SUPABASE_URL}/auth/v1/token?grant_type=password`, header `apikey: <anon>`). Assert a
   non-empty `access_token` (print length + SHA-256 prefix only). Login working = the client auth
   path works.

5. **Discover + replicate the client's real reads.** Read the client data layer in `src/`
   (`src/features/debates/`, the conversation-gallery model, `listArgumentsForDebateIds`, the
   node-annotation / machine-observation fetchers). Identify the exact tables/columns/filters the
   authed app uses for (a) the room/conversation list, (b) a room's arguments, (c) a node's
   machine observations. **Replicate those exact reads** as `BOT_A` (`apikey: <anon>` +
   `Authorization: Bearer <bot jwt>`). Do not invent queries the client never makes.

6. **Authed surfaces load + Build-2 visibility.** Assert `BOT_A`'s replicated reads return
   non-empty data: room list non-empty; the 3 corpus rooms' arguments load; machine observations
   are readable. Group observations by family; print family → count + distinct `raw_key` NAMES
   (never spans).
   - **Pass condition (relaxed):** it is **enough** that the client can render cards containing
     **any** already-live Build-2 family (≥1 of B/A/F/G's new keys present and render-mapped).
     **Do NOT require every key to be positive on a single card.** The bar is: persisted Build-2
     observations that **are** present render correctly, safely, and verdict-free — and the UI does
     not leak raw internals.

7. **Data-absence vs UI-failure (do not conflate).** If a card/room shows **no** Build-2 rows,
   first prove whether the **data** is absent (no persisted Build-2 observation rows for that node)
   vs the **UI** failing to render present rows. Cross-check against `#479` evidence/comments + the
   known-populated corpus rooms above. If data is genuinely absent on all reachable cards, report
   **DATA-ABSENCE** (not a UI failure) and stop — **do not trigger a fresh provider call to
   manufacture data** unless separately authorized. (Note: the `#479` auto-trigger burst lost ~96%
   of classifications, so many corpus cards legitimately carry few/zero rows — see
   `docs/rca/OPS-MCP-AUTOTRIGGER-BURST-PROVIDER-NETWORK-ERROR-RCA-2026-06-08.md`.)

8. **RLS leak-safety (doctrinally critical).** As **non-admin** `BOT_A`, read
   `argument_machine_observation_results`. Determine whether RLS returns `evidence_span` /
   admin-only columns to a non-admin.
   - If non-admins **can** read `evidence_span` → that is a **finding**: confirm the client render
     path **redacts** it and maps raw codes through `gameCopy.toPlainLanguage` (no raw `snake_case`
     reaches the UI).
   - If RLS **blocks** `evidence_span` for non-admins → record that as the protection.
   - Also assert the client never surfaces `inactive_reason` / `inactive_by` / service-role strings
     to a non-admin.

9. **Leak scan + artifact handling.** Capture **only safe artifacts**:
   - screenshots / log captures with **no** secrets, `evidence_span`, bodies, emails, or JWTs;
   - **before saving or posting any artifact**, run a redaction scan over it
     (`sk-ant-` | `sb_secret_` | `SUPABASE_SERVICE_ROLE` | `eyJ…` JWT | `@`-emails | X handles |
     `evidence_span` values) and **abort** the save/post on any match;
   - store artifacts under a gitignored scratch dir (`.claude-tmp/`), never commit raw captures;
   - any value you must reference goes in by SHA-256 prefix + length, never raw.

10. **Doctrine render guards (no browser).** Run the targeted suites that enforce verdict-free /
    no-raw-classifier-ID / no-`snake_case`-in-UI / `evidence_span`-redaction rules, e.g.:
    ```bash
    npx jest gameCopy nodeAnnotation observationMapping messageQualifier --silent
    ```
    Assert green. These are the automated proof the rendered copy is doctrine-safe.

---

## Pass / fail criteria

**PASS** when steps 1–10 are all green:
- `main` clean; live bundle is a `main` build, secret-free, and Build-2-bearing.
- Source definitions are verdict-free.
- Bot login works; authed room/card/observation reads return data.
- ≥1 already-live Build-2 family (B/A/F/G) renders **present** rows safely + verdict-free
  (**not** every key positive).
- Any no-rows case is proven **DATA-ABSENCE**, not a UI failure.
- `evidence_span` is RLS-blocked for non-admins **or** provably redacted in the render path; no raw
  internals leak.
- Doctrine suites green; all artifacts redaction-scanned clean.

**FAIL / STOP** on any failed step — report the exact query/file. Do not paper over it.

## Recording

Post a `CLIENT-PLANE VERIFY — PASS/FAIL` summary (**leak-safe** — counts + key names only) as a
comment on the Build-2 closeout anchor (PR `#548`). Include: `main` SHA, live bundle hash,
bot-login OK, per-family observation counts + key names, the `evidence_span` RLS verdict, the
data-absence-vs-render distinction, and the doctrine-suite result.

---

## Reusable Claude Code (git bash) prompt

The procedure above is encoded as a self-contained prompt for a fresh Claude Code session. Keep it
in sync with the steps above.

```
ROLE: Run the CDiscourse CLIENT-PLANE VERIFICATION lane automatically in git bash — NO interactive
browser sign-in. Prove the live Netlify client serving main works for a real AUTHENTICATED user and
that merged Build-2 (A–G machine-observation) mapping data renders present, leak-safe, verdict-free —
by authenticating as a dedicated BOT account and exercising the same Supabase reads the client makes.
READ-ONLY, no provider spend, no writes, no flag flips.

Follow docs/runbooks/client-plane-verify-runbook.md steps 1–10 exactly. Reuse the bot-login plumbing in
scripts/bot-fixtures/{loadEnv,supabaseClient}.js. Use NON-ADMIN BOT_A for the RLS leak boundary. Known-
populated fixtures: debate_ids 2a66ca93-…, 2315f479-…, 8a158837-… (#479 corpus).

GUARDRAILS: never print secrets (sha256 prefix + length only); leak-safe output (counts + key names,
never evidence_span/bodies/emails/JWTs); redaction-scan every artifact before save/post and store under
.claude-tmp/; do not flip productionEnabled / touch #394 / arm routing; do not trigger a fresh provider
call to manufacture data (distinguish DATA-ABSENCE from UI failure per step 7).

PASS = runbook pass criteria. Record CLIENT-PLANE VERIFY — PASS/FAIL on PR #548, leak-safe. On any
failure, STOP and report the exact query/file.
```
