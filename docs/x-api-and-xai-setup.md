# X API + xAI setup

_Stage 6.1.3.2 — 2026-05-17_

## Purpose

This document tells operators how to enable the X API + xAI for the engagement-intelligence pilot **and how to keep both off by default**. The scaffold ships disabled. Nothing here turns into a live call without explicit operator action.

## Required keys

| Key | Where | Required for |
|---|---|---|
| `X_BEARER_TOKEN` | `.env.engagement-intelligence` | Live X API collection (`xNewsCollect.js --pilot`, future `xReplyCollect.js --pilot`) |
| `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` | `.env.engagement-intelligence` | Reserved for OAuth-required endpoints we are not using in this stage |
| `XAI_API_KEY` | `.env.engagement-intelligence` | Optional stance classifier (`xaiClassifyPairs.js --pilot`) |
| `XAI_MODEL` | `.env.engagement-intelligence` | Optional override; defaults are picked by the script when wired |

Both bearer and xAI keys are read at runtime. **Never paste any of them into Claude.** **Never commit `.env.engagement-intelligence`.** It is gitignored.

## Kill switches

```bash
# Set in .env.engagement-intelligence
ENGAGEMENT_INTEL_ENABLE_X_API=false
ENGAGEMENT_INTEL_ENABLE_XAI=false
```

Both default to `false`. Even with credentials present, the live scripts refuse to call out unless both the flag is `true` AND the operator passes `--pilot` on the CLI.

## Pilot volume caps

```bash
ENGAGEMENT_INTEL_MAX_NEWS_STORIES=5
ENGAGEMENT_INTEL_MAX_POSTS_PER_STORY=3
ENGAGEMENT_INTEL_TOP_REPLIES_PER_POST=12
ENGAGEMENT_INTEL_MAX_TOTAL_REPLY_PAIRS=180
ENGAGEMENT_INTEL_NEWS_QUERY=news
ENGAGEMENT_INTEL_MAX_AGE_HOURS=24
```

The script clamps to these caps even if the operator asks for more. Scaling to thousands / tens-of-thousands requires explicit cost/compliance review.

## First-time setup

1. Copy the template:
   ```bash
   cp .env.engagement-intelligence.example .env.engagement-intelligence
   ```
2. Open `.env.engagement-intelligence` in your editor. Fill `X_BEARER_TOKEN` (and `XAI_API_KEY` if you want optional classification).
3. Leave `ENGAGEMENT_INTEL_ENABLE_X_API=false` until you've reviewed the plan.
4. Run the dry plan and synthetic analyzer to confirm everything is wired:
   ```bash
   npm run engagement:intel:plan
   npm run engagement:intel:synthetic
   npm run engagement:intel:x-news:dry
   ```
   None of these calls X or xAI.

## Turning the X API on (for the future tiny pilot)

1. Flip the env flag:
   ```bash
   ENGAGEMENT_INTEL_ENABLE_X_API=true
   ```
2. Run the **dry plan** one more time. Verify volumes and excluded topics.
3. Run the pilot with the explicit flag:
   ```bash
   npm run engagement:intel:x-news:pilot
   ```
4. Inspect the redacted local output at `data/engagement-intelligence/redacted/<timestamp>-news-stories.jsonl`. The directory is gitignored.
5. Run the offline analyzer over the local file:
   ```bash
   node scripts/engagement-intelligence/analyzeEngagementSamples.js --input data/engagement-intelligence/redacted/<file>.jsonl
   ```
6. The Markdown aggregate lands in `docs/testing-runs/<date>-engagement-epidemiology-pilot.md` and is safe to commit after a manual look.

## Turning xAI on (later)

1. `ENGAGEMENT_INTEL_ENABLE_XAI=true` and `XAI_API_KEY=<your key>` in `.env.engagement-intelligence`.
2. xAI is **advisory only**. The deterministic scalar is primary. xAI output is merged via `mergeVectors`, which averages numeric fields and only promotes xAI's categorical fields when the deterministic vector returned `none` / `unclear`.
3. The xAI system prompt explicitly forbids:
   - truth claims, winner / loser declarations
   - bad-faith / manipulative / dishonest / liar / extremist / propagandist labels
   - moderation recommendations
   - protected-class inference
4. The output schema fixes `userReviewRequired: true`. Outputs that fail the validator are rejected.

## Volume guardrails

| Stage | Max stories | Max posts | Max replies | Max pairs | xAI |
|---|---:|---:|---:|---:|---:|
| **6.1.3.2 (this stage)** | 0 | 0 | 0 | 0 | off |
| **6.1.3.3 — tiny pilot** | 5 | 3 | 12 | 180 | off |
| **6.1.3.4 — broader pilot** | 20 | 3 | 12 | 720 | optional |
| **6.1.3.5 — full** | 100+ | 3 | 12 | 3,600+ | optional |

Do not skip stages. Each step is gated on a clean offline report + operator review.

## xAI auth reality check (Stage 6.1.3.2a)

If anything on this machine appears to reach `api.x.ai` without an `XAI_API_KEY` set, we treat that as a bug / misconfiguration / inherited credential / SDK auto-load until proven otherwise. The official xAI inference API requires `Authorization: Bearer <xAI API key>`. **There is no documented unauthenticated inference path.**

A fail-closed probe is shipped to verify exactly that:

```bash
npm run engagement:intel:xai:probe:dry       # default — no network, prints booleans only
npm run engagement:intel:xai:probe:live      # one GET /v1/models with auth — needs XAI_API_KEY
npm run engagement:intel:xai:probe:no-key    # one GET /v1/models WITHOUT auth — expects 401/403
```

Behavior:

| Mode | Network? | Auth header? | Expected outcome |
|---|---|---|---|
| `probe:dry` | no | n/a | prints `mode=dry` and `dry auth probe only; no network` |
| `probe:live` with key | yes (1 request) | yes | `auth_ok` (200) or `auth_required_401/403` |
| `probe:live` without key | no | n/a | **refuses** (no `--probe-missing-key`) |
| `probe:no-key` | yes (1 request) | **no** | `auth_required_401` / `auth_required_403` expected; a `200` is reported as `unexpected_unauthenticated_access` (exit 2) |

The probe never sends a prompt, classification payload, or any user / public-X text. The response body is never read. Only the status code and a sanitized category are printed. The `XAI_API_KEY`, the `Authorization` header, and Bearer tokens never appear in stdout or in any error message — the sanitizer strips `xai-…`, `sk-…`, `sk-ant-…`, `Bearer …`, JWT-shape tokens, and `Authorization: …` lines.

The probe targets the official xAI base host (`https://api.x.ai`) on a documented read-only endpoint (`GET /v1/models`). It does NOT call inference.

If `probe:no-key` returns `unexpected_unauthenticated_access`, **do not** treat the situation as an opportunity to skip auth. Open a ticket, audit your `~/.config` / `~/.aws` / SDK auto-loaders / proxy credentials / shell environment for inherited xAI auth, and re-run the probe in a clean shell to confirm.

xAI **stays disabled** by default regardless of probe results. The Stage 6.1.3.3 tiny X News pilot remains X API only, xAI off.

## Safety reminders

- **Do not paste any key into Claude.**
- **Do not commit `.env.engagement-intelligence` or any file in `data/engagement-intelligence/` / `logs/engagement-intelligence/`.**
- **Do not run live calls without operator approval.**
- **Do not engage on X** — no posting / replying / liking / quoting / following / DMs.
- **Do not import** real public posts into production argument rooms.

See also: `docs/x-news-disagreement-epidemiology.md`.
