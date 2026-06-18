# CivilDiscourse v4 — Design Package Inventory

**Date:** 2026-06-18
**Run type:** DOCS-ONLY inventory (slate §12.1). No git, no GitHub, no code edits, no installs, no provider/Supabase calls.
**Visible brand:** CivilDiscourse (one word). Internal repo identifiers remain `cdiscourse` until a separate operator-gated migration (design file L91).
**Grounding:** verified facts bundle `.tmp/cd-v4-facts.md`; canonical export `CivilDiscourse v4.dc.html` inspected in `.tmp/` only.

---

## 1. Package path used

The package is an operator-supplied zip placed in the operator's Downloads folder:

- **Zip name:** `Civil discourse app redesign (1).zip`
- **Zip size:** 2,886,591 bytes
- **Unpacked to:** `.tmp/civildiscourse-v4-design-export/` (working inspection directory)
- **Commit status:** NOT committed. The zip, the unpacked directory, and every asset under it stay out of version control. Only this inventory doc (and the other planning docs in this slate) are committed.

All inspection in this run was read-only against the unpacked copy under `.tmp/`. No file inside the package was modified.

---

## 2. File inventory + SHA256 (16-hex prefixes)

Eleven files plus one stray `.thumbnail`, as unpacked under `.tmp/civildiscourse-v4-design-export/`. SHA256 prefixes computed this run; the design-export and asset prefixes match the verified facts bundle (§A) exactly.

| File (relative to export root) | Bytes | SHA256 (16-hex prefix) | Role |
|---|---|---|---|
| `CivilDiscourse v4.dc.html` | 181,386 | `afb7f2b19633a13a` | **Canonical design export** (current) |
| `CDiscourse v3.dc.html` | 177,068 | `0d3a470ea94a6404` | Prior design (history only) |
| `CDiscourse Redesign v2.dc.html` | 97,171 | `99d39d5da6261840` | Prior design (history only) |
| `CDiscourse Redesign.dc.html` | 94,104 | `264a103d9ebb2e3c` | Prior design (history only) |
| `support.js` | 53,975 | `505f94e08eeccbc8` | Design-tool runtime (not product code) |
| `assets/branding/civic-discourse-logo.png` | 2,310,665 | `481e06cfed3d3e14` | Full sign-in lockup |
| `assets/civildiscourse-mark.png` | 226,481 | `83539af84bf87051` | Crane mark / header mark |
| `assets/lockup-horizontal.png` | 128,937 | `5d30a3b80c708e28` | Horizontal lockup |
| `assets/lockup-horizontal-ink.png` | 103,444 | `45cd9699024edae9` | Horizontal lockup (ink variant) |
| `assets/icon.png` | 22,380 | `74c64047eb557b13` | App icon |
| `assets/favicon.png` | 1,466 | `24272cdaeff82cc5` | Favicon |
| `.thumbnail` (stray) | 7,108 | `7915449f29470db4` | Design-tool thumbnail artifact (not a deliverable) |

> Facts §A listed sizes/prefixes for the four `.dc.html` exports and the six branding assets; this run additionally captured `support.js` (`505f94e0`), `icon.png` (`74c64047`), `favicon.png` (`24272cda`), and the stray `.thumbnail` (`7915449f`). No discrepancy with §A.

---

## 3. Canonical design export

**`CivilDiscourse v4.dc.html`** — 181,386 B, sha `afb7f2b19633a13a`, 1,029 lines.

A design-tool single-file HTML export (`x-dc` document). It is the authoritative source for all v4 screens, the brand strip, the tweak-control props block, the implementation-handoff table, and the 7 open questions. The visible product name throughout is **CivilDiscourse** (e.g. app-header lockup, L85; minimum mobile-safe lockup, L89).

---

## 4. Prior design files (history only)

These three exports are retained for lineage and are **not** the basis for v4 planning. Treat them as reference history; do not extract requirements from them.

- `CDiscourse v3.dc.html` (177,068 B, `0d3a470e`) — immediate predecessor; introduced the warm `#08060F` BRAND-black room internals that open question 01 now weighs against the cooler `#020617` surface family.
- `CDiscourse Redesign v2.dc.html` (97,171 B, `99d39d5d`).
- `CDiscourse Redesign.dc.html` (94,104 B, `264a103d`).

All three still carry the legacy "CDiscourse" visible name; v4 is the first export to adopt "CivilDiscourse" as the visible brand.

---

## 5. Asset inventory

Under `assets/` (plus `assets/branding/`):

| Asset | Bytes | Prefix | Use in design |
|---|---|---|---|
| `branding/civic-discourse-logo.png` | 2,310,665 | `481e06cf` | Full sign-in lockup (largest asset) |
| `civildiscourse-mark.png` | 226,481 | `83539af8` | Crane mark in app-header lockup, icon/favicon tiles, minimum mobile-safe lockup |
| `lockup-horizontal.png` | 128,937 | `5d30a3b8` | Horizontal lockup |
| `lockup-horizontal-ink.png` | 103,444 | `45cd9699` | Horizontal lockup, ink variant |
| `icon.png` | 22,380 | `74c64047` | App icon |
| `favicon.png` | 1,466 | `24272cda` | Favicon |

No SVG sources are present in the package — all marks/lockups ship as PNG raster.

---

## 6. Logo asset inventory (brand handoff)

The brand strip (export L85-91) lays out the logo treatments and ends with the handoff note. Load-bearing facts:

- **App-header lockup** (L85): crane mark `civildiscourse-mark.png` (height 42px in the design) + the wordmark "CivilDiscourse" in Newsreader serif on `#08060F`.
- **Icon / favicon** (L87): the same crane mark on a `#13101D` tile with a gold-tinted border.
- **Minimum mobile-safe** (L89): crane mark (height 26px) + "CivilDiscourse" wordmark at 16px.
- **Full sign-in lockup:** `branding/civic-discourse-logo.png` (the 2.3MB asset).

**Handoff note, verbatim (L91):**

> handoff → logo / masthead / header treatment · UX-COPY-001 · aspect ratio preserved, no recolor · internal repo identifiers stay cdiscourse until a separate operator-gated migration

So: preserve aspect ratio, no recolor, and the visible brand becomes CivilDiscourse while repo identifiers (`app.json` slug/name, package name, env prefixes) stay `cdiscourse` until a separate operator-gated migration. Asset adoption maps to **UX-BRAND-ASSETS-001** (P0/M, GATE-C case-by-case) and the brand-strip/header treatment maps to **UX-COPY-001**.

---

## 7. Extracted visible strings (taglines / product names)

Visible product name throughout: **CivilDiscourse** (L85, L89). Target copy strings (line numbers in the canonical export):

- **"A high-trust room for hard conversations."** (L110; also L453)
- **"Mark the point. Respond clearly. See what remains unresolved."** (L111)
- **"Mark the point, not the person."** (L31)
- **"A mediator, not a judge. We surface the structure of a disagreement — never who's right."** (L119)
- Hero quote: **"I can finally see what this argument is actually about."** (L29)
- Next-move framing: **"What would move this forward? The mediator suggests an action — never a belief, winner, or truth."** (L324)
- Impasse framing: **"You both made the case. The disagreement is preserved — not lost, and not decided."** (L382)

These taglines replace the legacy, doctrine-violating tagline currently shipping in the repo ("Just get to the bottom of it", `src/lib/designTokens.ts:204`). The swap lands under **UX-COPY-001**; the doctrine-clean enforcement lands under **UX-COPY-DOCTRINE-001**.

---

## 8. Extracted screen list

Mobile flow screens (each with its design "maps →" footer to a likely repo home + work card):

| # | Screen title (verbatim) | Line | maps → (verbatim footer) |
|---|---|---|---|
| 01 | Sign in / first run | L104 | AppHeader · auth · UX-COPY-001 |
| 02 | Room board · selected node | L128 | ArgumentTimelineMap · UX-MEDIATOR-002 |
| 03 | Selected node · Act / Inspect / Go | L179 | TimelineNodeActionDock · TimelineSelectedReadoutPanel · UX-MEDIATOR-002 |
| 04 | Speech-first composer · listening | L213 | ArgumentComposerDock · VOICE-007 / VOICE-008 |
| 05 | Post-response · progress moment | L257 | ArgumentTimelineMap + node state · UX-MEDIATOR-002 · VOICE-009 |
| 06 | Disagreement points · bottom sheet | L288 | new DisagreementPointsSheet · UX-MEDIATOR-005 (+003/004) |
| 07 | Suggest my next move | L319 | mediator suggestions · new UX-NEXT-MOVE · MCP-K-001 |
| 08 | Feedback · clarity, not popularity | L342 | clarity ratings · new UX-FEEDBACK |
| 09 | Structured impasse · dignified end | L374 | StructuredImpasseCard · UX-MEDIATOR-003/004 |

Additional surfaces in the export:

- **Tablet (768)** and **Desktop (1440)** three-column layout (path · node+composer · ledger) — section starts L399/L444; desktop is "three-column" (L446). Maps to **UX-RESPONSIVE-V4-001**; the col-3 ledger is the subject of open question 05.
- **The 1:1 room model** section (L504) — rows R1-R7. Maps to **UX-ROOM-1V1-CHIMEIN-001** (with VOICE-007 noted on R7).
- **Node-state precedence** section (L702) + states S1-S4 — the 9-state precedence table. Maps to **UX-MEDIATOR-001** (derive) and **UX-MEDIATOR-002** (one chip).
- **Component inventory** and the **Implementation handoff** table (L915-927).

---

## 9. Extracted tweak controls

The design's `data-props` block (export L951-1026) exposes four enum tweak controls. Each is an emphasis/temperament/layout knob — none of them is a content or doctrine toggle. Verbatim help text retained:

| Control | Options | Default | Help (verbatim) |
|---|---|---|---|
| **brandAccent** ("Brand accent") | Warm gold · Cool active · Quiet mono | Warm gold | "The gold emphasis role — wordmark, selected-node halo, dignified state & impasse, premium card borders. **Never the action color.**" |
| **actionAccent** ("Action accent") | Indigo · Violet · Steel | Indigo | "The functional / active-path color: Act buttons, CTAs, composer record ring, responding-to rail." |
| **roomEnergy** ("Room energy") | Hushed · Calm · Lively | Calm | "Motion temperament across the waveform, selected-node glow and mic ring. Hushed = near-static / reduce-motion feel." |
| **brandLockup** ("Brand lockup") | Compact · Balanced · Editorial | Balanced | "Logo prominence across the sign-in lockup and brand strip. Compact = restrained; Editorial = larger hero mark. Cascades via the --logo-scale variable." |

Resolved CSS-variable values (from the props script body):

- **brandAccent → `--gold` / `--gold-rgb`:** Warm gold `#C6A15B` (198,161,91); Cool active `#8FA0E8` (143,160,232); Quiet mono `#BCB3A2` (188,179,162). Gold is the brand/dignity emphasis role — **never** the action color.
- **actionAccent → `--act-bg` / `--act-bd` / `--act-fg` / `--act-bd-rgb` / `--act-glow-rgb`:** Indigo `#312e81` / `#6366f1` / `#e0e7ff` (99,102,241 · 165,180,252); Violet `#3b2a6b` / `#8b5cf6` / `#ede9fe`; Steel `#26415e` / `#5b8def` / `#dbeafe`.
- **roomEnergy → `--wf-dur` / `--glow-dur` / `--ring-dur`:** Hushed 7s / 9s / 2.8s; Calm 1.1s / 4s / 1.5s; Lively 0.7s / 2.2s / 1.05s. (Hushed ≈ reduce-motion.)
- **brandLockup → `--logo-scale`:** Compact 0.82 · Balanced 1 · Editorial 1.2.

These knobs inform **UX-TOKENS-001** (token mapping) and **UX-RESPONSIVE-V4-001** / **UX-ACCESSIBILITY-001** (roomEnergy ↔ reduce-motion). Note the doctrine-relevant constraint baked into the control itself: gold is emphasis-only and must never become the action color (no truth/credibility coloring).

---

## 10. Extracted implementation annotations

### 10.1 Design's own card mapping (Implementation handoff table, L918-927)

Each surface → its likely repo home + work card, verbatim from the table:

| Surface (verbatim) | Card |
|---|---|
| One primary state chip · node markup | UX-MEDIATOR-002 |
| Disagreement Points rail / sheet | UX-MEDIATOR-005 |
| Evidence blocked / debt stack | UX-MEDIATOR-003 |
| Definition / scope bridge | UX-MEDIATOR-004 |
| Speech composer + waveform | VOICE-007 / 008 |
| Speech artifact persistence | VOICE-009 |
| Family K speech/waveform observations | MCP-K-001 / 002 |
| First-run clarity / sign-in copy | UX-COPY-001 |
| Clarity feedback ratings | new · UX-FEEDBACK |
| "Suggest my next move" | new · UX-NEXT-MOVE |

Per-screen "maps →" footers (already tabulated in §8) align with this table and additionally route screen 01 to `AppHeader · auth`, screen 02/05 to `ArgumentTimelineMap`, screen 03 to `TimelineNodeActionDock · TimelineSelectedReadoutPanel`, screen 04 to `ArgumentComposerDock`, and screen 09 to `StructuredImpasseCard`.

### 10.2 The 7 open questions for the operator (L936-944, verbatim intent)

1. **Room internals color:** unify on the warm `#08060F` BRAND black (v3's choice), or keep the cooler `#020617` SURFACE family for the timeline?
2. **Card status:** are `UX-FEEDBACK` and `UX-NEXT-MOVE` net-new cards, or extensions of existing mediator / standing work?
3. **State collapse:** how exactly do today's lifecycle tags + manual tags + classifier chips collapse into *one* state? Need the precedence rule (VOICE-009 / UX-MEDIATOR-002).
4. **Speech persistence:** transcript text only, plus a stored amplitude envelope for the static waveform? Confirm **no raw audio** per doctrine.
5. **Desktop ledger (col 3):** does it replace the existing side action rail, or coexist with it?
6. **State vocabulary:** is the 9-state vocabulary final? (Open · Needs evidence · Definition not shared · Scope mismatch · Missing link · Narrowed · Evidence blocked · Accounts differ · Structured impasse.)
7. **Reduce-motion:** waveform + selected-node glow must degrade to static. Confirm amplitude-only still reads as "mic active".

These are recorded so they can be carried into the roadmap as operator decisions that change the build.

### 10.3 Doctrine strip (export L946, verbatim)

> DOCTRINE HELD · no winner/loser · no AI judge · no truth verdict · no person labels · no "fallacy" · no emotion/intent inference · no likes/heat · no red/green · waveform = amplitude only, never credibility.

The design's own doctrine strip aligns with the project's acceptance-gate and visible-copy invariants (facts §E).

---

## 11. Design package caveats

- The exports are **design-tool single-file HTML** (`x-dc` documents) with a `support.js` runtime — they are **mockups, not production code**. No component, screen, or token in the package is wired to the app; everything is a visual/spec reference.
- The package uses **CivilDiscourse** as the visible brand, but per L91 the **internal repo identifiers stay `cdiscourse`** until a separate operator-gated migration. Planning must keep visible-brand changes (UX-COPY-001 / UX-BRAND-ASSETS-001) decoupled from identity/slug/domain/Supabase changes.
- Assets are PNG raster only (no SVG sources); `civic-discourse-logo.png` is 2.3MB, which is a packaging consideration for any future adoption card (handle under UX-BRAND-ASSETS-001).
- The `.thumbnail` file is a stray design-tool artifact, not a deliverable.
- The card names in the handoff table are the **design's suggested homes**; the authoritative card dispositions live in facts §D (FILE/FOLD/DEFER/AMEND) and the slate, not in the HTML.

---

## 12. What was NOT committed

- The operator-supplied zip `Civil discourse app redesign (1).zip` (2,886,591 B) in Downloads.
- The unpacked working directory `.tmp/civildiscourse-v4-design-export/` and **all** files under it (the four `.dc.html` exports, `support.js`, all six branding assets, `.thumbnail`).
- Nothing under `.tmp/` is added to version control by this run.

Only this inventory document (and the other planning docs in the v4 slate) are committed. This run wrote exactly one file:
`docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md`.

---

## 13. Boundary attestation

- **NO git, NO GitHub, NO code edits, NO installs by Claude in this run.**
- **NO provider (Anthropic / xAI / X) calls; NO Supabase reads or writes; NO service-role usage.**
- The design package was inspected read-only under `.tmp/`; no package file was modified, and neither the zip nor the unpacked assets were committed.
- Visible brand = CivilDiscourse; internal repo identifiers remain `cdiscourse` (L91) — no identity/slug/domain/Supabase migration performed or implied.
- Doctrine-clean: this inventory implies no winner/loser, no AI judge, no truth/score verdict, no red/green, no person labels, no likes/heat, no stored raw audio; waveform is amplitude-only; first open public seat is the respondent principal seat, not a chime-in; private rooms have no observers/chime-ins.
- This is a DOCS-ONLY planning artifact (slate §12.1, Agent INVENTORY). It files nothing, opens nothing, and deploys nothing.
