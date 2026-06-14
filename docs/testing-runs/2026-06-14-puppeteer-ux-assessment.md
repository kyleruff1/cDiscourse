# 2026-06-14 — Browser UX assessment pass (Puppeteer substitute)

Companion to `docs/designs/UX-MEDIATOR-ASSESSMENT-001.md` §11.

## Did Puppeteer run?

**No — Puppeteer is not installed and was not installed** (no authorization to add deps).
**Yes — a real browser render pass ran** via a non-mutating substitute: the production web bundle was built locally, served, and a headless render of the **logged-out screen only** was inspected with the **Claude_Preview MCP**. No login, no backend writes, no production data touched.

- Puppeteer/Playwright presence: **absent** from [package.json](package.json) deps + devDeps and `package-lock.json`. Test stack is Jest + jest-expo + React Test Renderer (no browser/E2E harness anywhere in the repo).

## Environment

| Field | Value |
|---|---|
| Target | `http://localhost:5050/` (local static serve of `dist/`) |
| Build | `npm run web:build` → `expo export --platform web --output-dir dist` — **exit 0**, 751 modules, 2.78 MB web bundle |
| Serve | `npx serve dist -l 5050 --single` (serve already a dependency) |
| Driver | Claude_Preview MCP: `preview_start` → `preview_eval` (DOM/text/dimensions) |
| Backend | **None.** Local build has no `.env`, so Supabase is unconfigured by design — this is what makes the pass non-mutating. |
| Viewport | 1280 × 720 |
| Auth state | Logged-out `AuthScreen` only |

## Exact commands (reproducible)

```bash
npm run web:build
npx serve dist -l 5050 --single        # or: preview_start "ux-assessment-dist" via .claude/launch.json
# then drive http://localhost:5050/ with a browser tool (Claude_Preview / Claude_in_Chrome / Puppeteer)
```

## Journeys attempted

| # | Journey | Ran? | Result |
|---|---|---|---|
| 1 | First landing — can a newcomer understand the app in 10s? | **Yes** | Findings F1–F5 below |
| 2 | Create private 1v1 with one invite | No | Needs auth + backend (mutating) — operator-gated (UX-TEST-001) |
| 3 | Create public, no invite (cap visible?) | No | Needs auth + backend |
| 4 | Enter as observer (observer vs participant clear?) | No | Needs auth + backend |
| 5 | Read a debate — identify the disagreement points | No | Needs auth + seeded fixture room |
| 6 | Respond to a specific point (stays anchored?) | No | Needs auth + backend |
| 7 | Add evidence (expectation clear?) | No | Needs auth + backend |
| 8 | Concede / narrow (safe partial-agreement path?) | No | Needs auth + backend |
| 9 | Unresolved conflict — are impasse kinds distinguished? | No | Needs auth + seeded fixture |
| 10 | Mobile-width — does the board communicate structure? | Partial | DOM dimensions captured at 1280px; mobile re-render not screenshotted |

## Findings (journey #1 — real, not fabricated)

- **F1 [P1] No value proposition on the logged-out screen.** Visible content is: brand logo, tagline "...Just get to the bottom of it", "Sign In", Email, Password, "Don't have an account? Sign up". No sentence stating what the app is/does; no sample; no learn-more link (`links: []`). A newcomer cannot answer "what is this and why sign up?" before the gate. → UX-COPY-001.
- **F2 [P1] Browser tab title is `expo-scaffold`.** `document.title === "expo-scaffold"`, sourced from [app.json:3-4](app.json) (`name`/`slug` are the default Expo scaffold values). In-app brand aria-label is "CivilDiscourse". → UX-COPY-001.
- **F3 [P2 — operator decision, not a bug].** Header `height: 296px` (logo image 288×432) on a 720px viewport — ~41% of vertical space before the sign-in fields; pushes the form below the fold on phones. **Source-grounded** in `PROMINENT_LOGO_HEIGHT_PX = 288` ([AppHeader.tsx:107](src/components/AppHeader.tsx)) — an **explicit 2026-05-26 operator request** to render the logo at ≥3× prior size. Reported as an operator **decision item** (sign-in-screen-specific logo size), **not** a unilateral fix. → UX-COPY-001 (decision).
- **F4 [info] Graceful degradation.** With no backend config, the screen shows a clear "Supabase is not configured…" alert (`role="alert"`) instead of a white screen. This message is build-config-only (no `.env`), **not** a product defect.
- **F5 [P3] Masthead semantics double-up.** The brand is exposed both as `<h1 role="heading">` and a `<button>` with the same label — minor screen-reader redundancy.

## Capture limitation (reported, not faked)

`preview_screenshot` **timed out at 30 s on three attempts** — a capture-pipeline limitation with the react-native-web renderer (the page rendered fine; `preview_eval` returned full DOM/text/dimensions). **No raster PNG was produced. No screenshot is fabricated.**

Saved artifacts (under `.tmp/ux-mediator-assessment/`, gitignored — not committed):
- `auth-screen-dom-snapshot.html` — faithful DOM-structure snapshot of the logged-out screen.
- `auth-screen-extract.json` — extracted title, headings, buttons, inputs, dimensions, findings.
- `puppeteer-run-notes.md` — this run's raw notes.
- `journeys.draft.md` — draft script for the authenticated journeys (UX-TEST-001).

## To produce raster screenshots / full journeys

1. **Logged-out raster (non-mutating):** point Puppeteer (if installed under UX-TEST-001) or a working browser-capture tool at `http://localhost:5050/` or the [dev host](https://dev-cdiscourse.netlify.app). Stay logged-out to remain non-mutating.
2. **Authenticated journeys (operator-gated):** UX-TEST-001 harness with test credentials against a **non-production / fixture** backend, behind an explicit env flag — never against production data. Draft: `.tmp/ux-mediator-assessment/journeys.draft.md`.

## Boundary attestation

No runtime mutation, no provider call, no queue arm, no Supabase config write, no deployment, no H/I/J flip, no service-role/client leakage, no issue creation. Local build + local static serve + logged-out DOM read only.
