# X News Disagreement Epidemiology

_Stage 6.1.3.2 — 2026-05-17_

## Purpose

We are studying public reply patterns to improve CDiscourse's deterministic engagement rules. The goal is to map **how people partially agree and partially disagree** in real online conversations, then convert the patterns into TypeScript rule candidates that the app can adopt.

This is **epidemiology of disagreement**, not truth scoring. We are measuring how agreement and disagreement coexist, not picking who is right.

## Core research questions

- How often do replies partially agree while disagreeing on scope?
- How often do replies agree with a value but dispute a fact?
- How often do replies agree with a conclusion but challenge the evidence?
- How often do replies disagree with tone but agree with substance?
- Which replies invite productive follow-up?
- Which replies request receipts? Quote anchors? Definitions?
- Which replies are tangents that should branch into their own room?
- Which patterns are engaging without being abusive?

## Key conceptual rule — agreement and disagreement are SEPARATE dimensions

A single "stance" scalar (-1 to +1) collapses the most useful state. We model two scalars:

```ts
type AgreementDisagreementVector = {
  agreementScore: number;      // 0..1
  disagreementScore: number;   // 0..1
  coexistenceScore: number;    // min(agreementScore, disagreementScore) × 2
  uncertaintyScore: number;    // 0..1
  primaryStance: 'strong_agree' | 'weak_agree' | 'mixed_agree_disagree'
               | 'weak_disagree' | 'strong_disagree' | 'unclear'
               | 'tangent' | 'joke_or_meme'
               | 'receipt_request' | 'quote_request';
  agreementType: 'premise' | 'evidence' | 'conclusion' | 'value' | 'framing' | 'context' | 'none';
  disagreementType: 'fact' | 'definition' | 'causal' | 'value' | 'evidence' | 'logic' | 'scope' | 'framing' | 'none';
  replyFunction: 'support' | 'extend' | 'caveat' | 'rebut' | 'counterexample'
               | 'ask_source' | 'ask_quote' | 'ask_definition' | 'narrow_scope'
               | 'branch_tangent' | 'synthesize' | 'joke' | 'unclear';
  scalarRationale: string;
  userReviewRequired: true;
};
```

## Worked examples

| Reply (paraphrased) | agreement | disagreement | coexistence | function |
|---|---:|---:|---:|---|
| "Fair, but…" | medium | medium | high | caveat |
| "This is true, but only for…" | high | medium (scope) | medium | narrow_scope |
| "Source?" | unknown | weak/medium (evidence) | low | ask_source |
| "That does not follow." | low | high (logic) | low | rebut |
| "Yes, and…" | high | low | low | extend |
| "Actually…" | low/medium | medium/high (fact/logic) | medium | rebut / caveat |

## Scope of the scaffold (this stage)

- Synthetic-only by default. Live X API calls are off unless explicitly enabled.
- Pilot ceilings: **5 news stories**, up to **3 root posts per story**, top **12 replies per post**, hard cap **180 reply pairs** for the first live run.
- Topic safety: news-like / current public discussions, low-risk only. No medical / legal / financial advice. No protected-class conflict. No real-person accusations. No sexual / violent / extremist content. No current named politicians until politics-mode is explicitly opted in.

## What this is NOT

- Not a moderation tool. We never recommend suspending, banning, or hiding any account.
- Not a truth engine. We classify language, not facts.
- Not a fine-tuning dataset. We do not train or fine-tune any model on collected content.
- Not a research output about real people. Raw post IDs, handles, URLs, and emails are stripped before anything is written.
- Not production app data. Real public replies are not imported into argument rooms.
- Not scraping. Official X API only.

## Compliance baseline

- Official X API endpoints only (`/2/news/search`, recent search). No browser automation. No unofficial endpoints. No likes / replies / quotes / follows / DMs / posts on the operator side.
- `data/engagement-intelligence/raw/` and `data/engagement-intelligence/redacted/` are gitignored. Only **aggregate** Markdown reports go into `docs/testing-runs/`.
- Secrets only in `.env.engagement-intelligence` (gitignored). The example file is `.env.engagement-intelligence.example`.
- xAI usage is optional. When enabled, it classifies **observable language relationships** only, with explicit prompt-level prohibitions on truth claims, winner/loser language, and any "bad faith / dishonest / manipulative / liar / extremist / propagandist" labels.
- Every classified pair carries `userReviewRequired: true`. Outputs are advisory; the production Constitution remains the app's deterministic brain.

## Files

```
src/features/engagementIntelligence/
  types.ts                       — shared types (post / pair / vector / aggregate / rule candidate)
  lexicons.ts                    — agreement / disagreement / axis lexeme lists
  agreementScalar.ts             — deterministic scalar; no network
  redaction.ts                   — handle / URL / email / phone / secret redactors + ID hashing
  ruleCandidates.ts              — build app rule candidates + aggregate epidemiology
  xaiStanceClassifier.ts         — prompt + schema + validator + merge (no HTTP here)
  index.ts                       — re-exports

scripts/engagement-intelligence/
  loadEngagementEnv.js           — parse .env.engagement-intelligence; never print values
  xNewsPlan.js                   — print planned queries / volume; no API call
  xApiClient.js                  — official-API fetch wrapper; refuses live calls unless enabled
  xNewsCollect.js                — dry by default; --pilot required for live News Search
  xReplyCollect.js               — dry by default; scaffold-only in 6.1.3.2
  normalizeXSample.js            — hash IDs, redact text, classify safety, build reply pairs
  analyzeEngagementSamples.js    — offline: deterministic scalar over synthetic / pilot samples
  writeEpidemiologyReport.js     — committable Markdown report builder
  xaiClassifyPairs.js            — disabled by default; refuses HTTP unless --pilot + env enabled
  agreementScalarJs.js           — JS twin of agreementScalar.ts (parity test in __tests__)
```

## What lives where

| Surface | Location | Committed? |
|---|---|---|
| Synthetic fixture | `fixtures/engagement-intelligence/synthetic-news-reply-pairs.json` | yes |
| Aggregate report (synthetic) | `docs/testing-runs/<date>-engagement-epidemiology-synthetic.md` | yes |
| Aggregate report (pilot) | `docs/testing-runs/<date>-engagement-epidemiology-pilot.md` | yes (after operator review) |
| Raw X posts | `data/engagement-intelligence/raw/` | NO (gitignored) |
| Redacted X samples | `data/engagement-intelligence/redacted/` | NO (gitignored) |
| Classified xAI outputs | `data/engagement-intelligence/classified/` | NO (gitignored) |
| Run logs | `logs/engagement-intelligence/` | NO (gitignored) |
| Secrets | `.env.engagement-intelligence` | NO (gitignored) |

## Pilot plan (next stage — 6.1.3.3, not in this commit)

The first live pilot is intentionally tiny:
- **5 news stories** from low-risk buckets only.
- Up to **3 root posts per story**.
- Top **12 replies per root post**.
- Hard cap: **180 reply pairs**.
- xAI: **disabled** for the first pilot. Pure deterministic scalar.
- Output: a redacted local JSONL + one committable Markdown aggregate.

Do not scale to thousands or tens-of-thousands until cost / compliance / storage are reviewed.

See also: `docs/x-api-and-xai-setup.md`.
