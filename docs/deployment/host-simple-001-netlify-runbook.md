# HOST-SIMPLE-001 — Netlify dev deploy runbook

_Status: operator-runnable. Last updated 2026-05-19. Card scope: get the CDiscourse Expo web build reachable from multiple machines on a temporary Netlify URL. Custom domain (`dev.cdiscourse.com`) is intentionally deferred — that's the HOST-006 + HOST-007 path._

This runbook stands the app up on a managed PaaS in **about 5 minutes** so the operator can stop working off `localhost` and dogfood the app from any browser. The longer-term Cloud Run path (HOST-001 + HOST-005 + HOST-006 + HOST-007) stays valid and remains the production track. This is the dev-stopgap.

## Hard rules (held throughout the runbook)

- **No service-role key, Anthropic key, xAI key, X Bearer, or Resend key in the Netlify dashboard.** Only the two `EXPO_PUBLIC_*` Supabase values, which are safe by Supabase design.
- **No `.env*` file committed to git.** Netlify reads env vars from its dashboard, not from the repo.
- **No rotation of any existing key** unless evidence of exposure (committed, logged, pasted into a transcript) is found. Per locked decision D11 from the master plan, the agent has been told the keys never left local gitignored files.
- **Service-role stays in Supabase Function secrets.** Edge Functions continue to run inside Supabase, NOT on Netlify. Netlify hosts only the static web bundle.
- **Agent does NOT run any `netlify` command, does NOT click in the Netlify dashboard, does NOT paste any value anywhere.** Every step below is operator-runnable in a browser + a shell.

---

## Prerequisites

- [ ] A Netlify account (operator's own; free tier is sufficient).
- [ ] The `cdiscourse` GitHub repo is accessible from that Netlify account.
- [ ] The dev Supabase project's URL + publishable / anon key are accessible to the operator. Get them at: Supabase Dashboard → Project Settings → API → `Project URL` + `anon public` key.
- [ ] **Do NOT** paste those values into Claude or anywhere outside the Netlify dashboard.

---

## Step 1 — Connect the GitHub repo to Netlify

Operator runs in a browser:

1. Sign in at [https://app.netlify.com](https://app.netlify.com).
2. **Add new site → Import an existing project → GitHub**.
3. Authorize Netlify on the GitHub `kyleruff1` org if not already authorized.
4. Pick the `cDiscourse` repo.
5. Branch to deploy: **`main`**.
6. Build settings — Netlify should auto-detect from `netlify.toml`. Confirm:
   - **Build command**: `npm ci && npm run web:build`
   - **Publish directory**: `dist`
   - **Node version**: `22` (from `netlify.toml` `[build.environment]`).

**Do NOT click "Deploy site" yet.** The first deploy will fail without env vars set; setting them first avoids a noisy first-deploy error.

**Verify**: site appears in the Netlify dashboard with status "Not yet deployed" or "Awaiting config".

**Rollback**: from site settings → General → Danger zone → Delete this site.

---

## Step 2 — Set environment variables in the Netlify dashboard

Operator clicks **Site settings → Environment variables → Add a variable** twice:

1. Key: `EXPO_PUBLIC_SUPABASE_URL`
   Value: the operator's dev Supabase project URL (e.g. `https://<project-ref>.supabase.co`).
   Scopes: **Builds** + **Functions** (Functions is unused for v0 but harmless; if the toggle is binary, "Builds" alone is fine).
2. Key: `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   Value: the operator's dev Supabase `anon public` key.
   Scopes: **Builds** + **Functions**.

**Critical**:
- Type or paste the values **once** into Netlify's UI. Do not paste them anywhere else. Do not commit them.
- Both values are `EXPO_PUBLIC_` prefixed by Expo convention — they are bundled into the client at build time, which is safe because the publishable key is designed for client distribution and RLS gates every table.
- **Do not** add `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `X_BEARER_TOKEN`, or `RESEND_API_KEY` to Netlify. Ever. Those live only in Supabase Function secrets.

**Verify**: both keys appear in Site settings → Environment variables.

**Rollback**: delete the variables from the same UI.

---

## Step 3 — Trigger the first build

Operator clicks **Deploys → Trigger deploy → Deploy site**.

Expected:
1. Netlify clones the repo at `main`.
2. Runs `npm ci` (≈ 60–90 seconds first time).
3. Runs `npm run web:build` → `expo export --platform web --output-dir dist` (≈ 30–90 seconds).
4. Publishes `dist/` to Netlify's CDN.
5. Status flips to **Published**.

The site URL is shown at the top of the Deploys page (e.g. `https://serene-pasta-abcdef.netlify.app`). That URL is reachable from any browser on any machine.

**Verify**:
- Deploy log shows no errors.
- Deploy log does NOT show any of `sk-ant-`, `xai-`, `sb_secret_`, `Bearer `, or `eyJ[A-Za-z0-9_-]{20,}\.` in the output — Netlify's secrets scanner is configured to omit the two `EXPO_PUBLIC_*` keys, but if any other value-shaped string appears in the log, **stop and investigate**.

**Rollback**: from Deploys → click the prior deploy → "Publish deploy" reverts the live site. The bad deploy stays in history for diagnosis.

---

## Step 4 — Smoke the live URL

In an incognito browser window, open the Netlify-provided URL.

| # | Check | Pass |
|---|---|---|
| H1 | TLS valid, cert issuer is Let's Encrypt (Netlify's default) | `curl -I https://<site>.netlify.app` returns `HTTP/2 200` and a green padlock in the browser |
| H2 | App entry renders | Auth screen (or current default landing) appears in under 3 seconds |
| H3 | Supabase connects | Sign up or sign in with a throwaway account; lands on the gallery without console errors |
| H4 | SPA refresh works | Navigate into a debate room, then hit browser refresh. App reloads, does NOT 404 |
| H5 | No secret leakage in bundle | DevTools → Network → JS bundle search for `sk-ant-`, `xai-`, `sb_secret_`, `Bearer `. Should return zero matches |
| H6 | No service-role in bundle | Bundle search for `service_role` returns zero matches |

If any check fails, do NOT keep the URL live. Either roll back to the prior deploy or take the site down (Site settings → General → Status → Stop autopublishing).

---

## Step 5 — Share the URL (limited)

Once H1–H6 pass:
- Copy the Netlify URL.
- Share it with **only people you trust** for now. The site is publicly reachable; there is NO sign-in gate at the Netlify layer for v0.
- The Supabase project is the dev project. Posts made via the Netlify URL go into the same database as your `localhost` sessions. That's per locked decision D10.

If you want a sign-in gate in front of the URL, that's HOST-007 (IAP via Cloud Run) on the long-term path. Netlify has its own paid SSO product (Netlify Identity); not needed for v0.

---

## Step 6 — Daily deploy loop

For every change you push to `main`:
1. Push the commit.
2. Netlify auto-detects the push and rebuilds within ~10 seconds.
3. Watch the deploy in **Deploys → Latest**.
4. If green, the new revision is live on the same URL within ~2 minutes total.
5. If red, the prior deploy stays live; investigate the deploy log.

To deploy a feature branch to a preview URL: open a GitHub PR. Netlify auto-creates a **deploy preview** at a per-PR URL.

---

## When this card becomes obsolete

Once HOST-006 (DNS) and HOST-007 (IAP) land and the Cloud Run path is live at `https://dev.cdiscourse.com`, the operator can:
1. Turn off Netlify auto-deploy (Site settings → Build & deploy → Stop builds).
2. Optionally delete the Netlify site after a week of running both side-by-side to confirm Cloud Run is stable.
3. Update `docs/current-status.md` to mark HOST-SIMPLE-001 as superseded by the Cloud Run path.

Until then, **HOST-SIMPLE-001 and HOST-001 coexist**: HOST-001's Dockerfile and Cloud Run scaffolding stay in the repo; they don't conflict with Netlify because Netlify ignores them.

---

## Rollback / takedown

To take the site offline immediately:
- Site settings → General → Status → **Stop autopublishing**. Site becomes unreachable.
- OR Site settings → General → Danger zone → **Delete this site**. Permanent.

To roll back to a prior good deploy:
- Deploys → click the good deploy → **Publish deploy**.

---

## Cost watchpoints

- Free tier: 100GB bandwidth / month, 300 build minutes / month. More than enough for invite-only dev.
- If bandwidth spikes unexpectedly, check the Analytics tab for unusual referrers (someone shared the URL publicly).
