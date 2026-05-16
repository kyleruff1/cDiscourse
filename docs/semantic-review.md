# CDiscourse — Semantic Review Notes

_Last updated: 2026-05-16_

## What Semantic Review Means in This App

"Semantic review" refers to optional, AI-assisted analysis of argument text — specifically, reviewing the language and structure of a draft, not the truth or merit of its claims.

The app deliberately avoids using the term "AI moderation" for this feature because:
- Moderation implies authority over content
- This app's AI layer has no authority
- All review is advisory; the user controls every decision

---

## What the Language-Processing Layer Reviews

| Dimension | Method | Notes |
|---|---|---|
| Topic relation to resolution | Lexical + AI | Is the text connected to the debate topic? |
| Topic relation to parent | Lexical + AI | Does the text respond to the parent argument? |
| Argument structure | AI | Is there a clear claim? Multiple claims? |
| Segment classification | AI | claim / evidence / question / rebuttal / concession / filler |
| Suggested argument type | AI | thesis / claim / rebuttal / etc. |
| Disagreement axis | AI | fact / definition / causal / value / evidence / logic / scope |
| Civility heuristic | Lexical + AI | Possible loaded language or ad hominem phrasing |
| Transcript issues | AI | Filler words, incomplete sentences, multiple arguments |

---

## What the AI Layer Never Decides

| Forbidden decision | Why |
|---|---|
| Who is right or wrong | AI cannot evaluate truth |
| Debate winner | No scoring system exists; truth is not determined by argument form |
| User intent | Intent is not observable from text alone |
| Whether to ban a user | Only human moderators may take user-level actions |
| Whether to hide content | Content is never hidden automatically |
| Whether a claim is true | AI assesses structure, not factual accuracy |
| Whether an argument is in bad faith | Bad faith is an intent judgment |

These forbidden decisions are enforced at three levels:
1. System prompt instructs the model to avoid them
2. `possibleFlags` enum does not include forbidden codes (schema validation rejects them)
3. `userReviewRequired: true` is enforced as a `z.literal(true)` in the Zod schema

---

## Relationship to Deterministic Constitution

The deterministic Constitution (rules engine) is **primary and authoritative**.

```
Deterministic rules     →  Always run
  └─ transition matrix
  └─ parent requirement
  └─ evidence source requirement
  └─ length check
  └─ lexical topic check

Language processing (AI)  →  Optional, advisory, disabled by default
  └─ Runs AFTER deterministic checks, not instead of them
  └─ Cannot override a blocking error from the Constitution
  └─ Cannot make a blocked argument pass validation
  └─ Cannot make a passing argument fail validation
```

---

## Review Flow (Future UI)

When the language-processing feature is wired into the UI (Stage 6.1):

1. User types a draft in `ArgumentComposer`
2. User taps "Help me structure this" (explicit action)
3. Client calls `processLanguageDraft(payload)` → `process-language-draft` Edge Function
4. Edge Function returns `LanguageProcessingResult` (or `{ enabled: false }`)
5. UI displays suggestions in a review panel:
   - Cleaned text (user may accept or dismiss)
   - Suggested argument type (user may accept or choose differently)
   - Suggested tags (user must confirm each)
   - Possible flags (advisory — user sees them but they don't block)
6. User edits and finalizes the draft
7. User submits via `submitArgumentDraft` (the existing authoritative path)
8. Server runs deterministic Constitution checks — those are final

The AI suggestion step is never in the critical path. It never gatekeeps submission.

---

## Provider Abstraction

See `docs/ai-provider-decision.md` for provider selection rationale and switching instructions.
