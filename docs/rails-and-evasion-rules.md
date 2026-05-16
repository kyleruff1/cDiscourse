# Discourse Rails and Evasion Rules

## Philosophy

The rails rules enforce **structural discourse norms** — not truth.

- They cannot declare who is right or wrong.
- They cannot censor a disagreement because it is unpopular.
- They cannot assign intent to a user.
- They can only enforce that arguments are **connected to what they claim to be responding to** and that **the type of disagreement is made explicit**.

All evasion flags are named "possible." A flag is an artifact for moderator review, not a verdict.

---

## Rules

### C-RAIL-001 — Parent Responsiveness (`parent_responsiveness_lexical`)

**Applies to:** rebuttal, counter_rebuttal, evidence, clarification_request, concession, synthesis

**What it checks:** Whether the argument body has meaningful lexical overlap with the parent body.

**Bypass:** Providing a `target_excerpt` that appears in the parent body passes the check immediately. This is the preferred way to cite a specific part of the parent.

**Thresholds:**
- Overlap < 5%: Hard block → `parent_nonresponsive`
- Overlap < 15%: Warning → `tangent_shift_possible`

**What it does NOT mean:**
- It does not mean the argument is wrong.
- It does not mean the user is being deceptive.
- Low overlap may mean the argument is addressing a different framing — the author should use `target_excerpt` to clarify.

---

### C-RAIL-002 — Disagreement Axis Required (`disagreement_axis_required`)

**Applies to:** rebuttal, counter_rebuttal

**What it checks:** Whether the argument declares what kind of disagreement is being made via a disagreement-axis tag or the `disagreement_axis` target field.

**Available axes:**

| Tag | Meaning |
|-----|---------|
| `fact_disagreement` | Disputes a specific fact in the parent |
| `definition_disagreement` | Disputes the meaning of a key term |
| `causal_disagreement` | Disputes a claimed cause-effect relationship |
| `value_disagreement` | Disputes a normative premise or how a value is weighted |
| `evidence_challenge` | Challenges the quality or sourcing of evidence |
| `logic_challenge` | Challenges the inferential step from premise to conclusion |
| `scope_challenge` | Challenges whether the debate framing is appropriate |

**Why this rule exists:** A rebuttal that does not say what kind of disagreement it is making is harder for the opponent and moderators to evaluate. Forcing this declaration does not judge whether the disagreement is correct — it just makes it legible.

**What it does NOT mean:**
- It does not mean the rebuttal is wrong.
- It does not mean the user must agree with any of the axes.
- The user may choose any axis that accurately describes their disagreement.

---

### C-RAIL-003 — Concession Integrity (`concession_integrity`)

**Applies to:** concession, synthesis

**What it checks:**
1. Whether the body includes an explicit concession marker.
2. Whether a "but/however/that said" clause introduces a new dispute with very low parent overlap.

**Required concession markers:** "I concede", "I grant", "I agree with", "that point is valid", "you are right", "fair point", "I acknowledge"

**Flag: `parent_nonresponsive` (blocking)** — no marker present.

**Flag: `concession_evasion_possible` (review)** — marker present, but "but/however" introduces new content with < 10% parent overlap.

**What "concession evasion possible" does NOT mean:**
- It does not mean the user is lying.
- It does not mean the concession is invalid.
- A concession may legitimately narrow the dispute and introduce a narrower claim after "but." The flag means this pattern was detected and a moderator should review it to confirm the dispute is genuinely narrowed (not evaded).

---

### C-RAIL-004 — Clarification Purity (`clarification_purity`)

**Applies to:** clarification_request

**What it checks:**
1. Whether the body asks for a definition, source, scope, or missing premise (has a question structure).
2. Whether the body uses loaded or accusatory language ("you obviously", "you clearly", "you always", "you never").

**Flag: `loaded_clarification_possible` (review)** — loaded language detected.

**Flag: `parent_nonresponsive` (blocking)** — no question structure and essentially no connection to the parent.

**What "loaded clarification possible" does NOT mean:**
- It does not mean the clarification is invalid.
- It does not mean the user is being deceptive.
- Some rhetorical styles use direct language. The flag means the phrasing patterns were detected and should be reviewed.

---

### C-RAIL-005 — Fact Confusion Channel (`fact_confusion_channel`)

**Applies to:** all argument types

**What it checks:** Whether the argument appears to dispute a factual premise while also using uncertainty language or source-request tags.

**Trigger conditions:**
- Body contains uncertainty language: "maybe", "perhaps", "I think", "uncertain", "not sure", "could be"
- OR selected tags include `evidence_challenge` or `source_request`

**Flag: `fact_confusion_possible` (info/advisory)**

**This is not a misconduct flag.**

**What it means:** The disagreement may be primarily about missing evidence, an unclear source, or a definition — rather than a value or logic dispute. This flag helps participants and moderators identify that providing a source might resolve the dispute rather than continuing the argument.

**What it does NOT mean:**
- It does not mean the user is confused or wrong.
- It does not mean the argument is invalid.
- It is purely informational.

---

## Topic Satisfaction

Topic satisfaction checks measure **lexical overlap** between the argument body and the debate resolution (and, for replies, the parent body).

- **Resolution score:** How much of the debate resolution's key terms appear in the body.
- **Parent score:** How much of the parent argument's key terms appear in the body.
- **Combined score:**
  - Root argument: = resolution score
  - Reply argument: = min(resolution score, parent score)

The combined score is what determines status:
- ≥ 25%: satisfied
- 10–25%: weak (warning flag)
- < 10%: failed (blocking flag, but this threshold is intentionally permissive)

**What this does NOT mean:**
- A high score does not mean the argument is correct.
- A low score does not mean the argument is off-topic — dense arguments on a specific sub-point may legitimately use different vocabulary.
- If the lexical check flags a legitimate argument, the author can add `target_excerpt` to provide context.

---

## Flags Are Not Verdicts

Every flag created by the rails rules is:
- Stored in `argument_flags` as `source = 'server_rules'`
- Subject to moderator review
- Never acted on automatically (no content hidden or deleted)
- Named as "possible" when declaring any pattern that could have multiple explanations

The rules engine and rails system provide **transparent artifacts** that participants and moderators can examine. They do not make final decisions.
